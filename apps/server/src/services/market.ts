import {
  MARKET_AUCTION_MAX_DURATION_MINUTES,
  MARKET_AUCTION_MIN_BID_INCREMENT_FLAT,
  MARKET_AUCTION_MIN_BID_INCREMENT_RATE,
  MARKET_AUCTION_MIN_DURATION_MINUTES,
  MARKET_ORDER_DEFAULT_EXPIRY_HOURS,
  MARKET_ORDER_FEE_RATE,
} from '@cs-rio/shared/dist/constants.js';
import {
  normalizeOptionalToken,
  normalizePositiveInteger,
  normalizePositiveMoney,
  normalizeRoundedMoney,
} from '@cs-rio/shared';
import {
  type InventoryItemType,
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type MarketAuctionNotification,
  type MarketAuctionNotificationType,
  type MarketAuctionSettlementSummary,
  type MarketAuctionStatus,
  type MarketAuctionSummary,
  type MarketOrderBookResponse,
  type MarketOrderCreateInput,
  type MarketOrderMutationResponse,
  type MarketOrderSide,
  type MarketOrderStatus,
  type MarketOrderSummary,
  type MarketTradeSummary,
} from '@cs-rio/shared/dist/types.js';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { MARKET_SYSTEM_OFFER_SEED } from '../db/seed.js';
import {
  components,
  drugs,
  marketAuctionBids,
  marketAuctionNotifications,
  marketAuctions,
  marketOrders,
  marketSystemOffers,
  playerInventory,
  players,
  round,
  transactions,
  vests,
  weapons,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { GameConfigService } from './game-config.js';
import { resolveRoundLifecycleConfig } from './gameplay-config.js';
import {
  buildNpcInflationSummary,
  DatabaseNpcInflationReader,
  inflateNpcMoney,
  type NpcInflationProfile,
  type NpcInflationReaderContract,
} from './npc-inflation.js';
import { invalidatePlayerProfileCaches } from './player-cache.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';

const MARKET_AUCTION_SUPPORTED_ITEM_TYPES: Array<'vest' | 'weapon'> = ['vest', 'weapon'];
const MARKET_SUPPORTED_ITEM_TYPES: InventoryItemType[] = ['component', 'drug', 'vest', 'weapon'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type DatabaseClient = typeof db;

type MarketAuctionRow = typeof marketAuctions.$inferSelect;
type MarketOrderRow = typeof marketOrders.$inferSelect;
type MarketSystemOfferRow = typeof marketSystemOffers.$inferSelect;

export interface MarketServiceOptions {
  gameConfigService?: GameConfigService;
  inflationReader?: NpcInflationReaderContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  repository?: MarketRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface MarketServiceContract {
  bidAuction(
    playerId: string,
    auctionId: string,
    input: MarketAuctionBidInput,
  ): Promise<MarketAuctionMutationResponse>;
  cancelOrder(playerId: string, orderId: string): Promise<MarketOrderMutationResponse>;
  close?(): Promise<void>;
  createAuction(playerId: string, input: MarketAuctionCreateInput): Promise<MarketAuctionMutationResponse>;
  createOrder(playerId: string, input: MarketOrderCreateInput): Promise<MarketOrderMutationResponse>;
  getAuctionBook(
    playerId: string,
    filters?: MarketAuctionBookFilters,
  ): Promise<MarketAuctionBookResponse>;
  getOrderBook(
    playerId: string,
    filters?: MarketOrderBookFilters,
  ): Promise<MarketOrderBookResponse>;
}

export interface MarketAuctionBookFilters {
  itemId?: string;
  itemType?: 'vest' | 'weapon';
}

export interface MarketOrderBookFilters {
  itemId?: string;
  itemType?: InventoryItemType;
}

interface MarketPlayerRecord {
  characterCreatedAt: Date | null;
  id: string;
  level: number;
  money: number;
}

interface MarketItemDefinitionRecord {
  durabilityMax: number | null;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  levelRequired: number | null;
  stackable: boolean;
}

interface MarketInventoryItemRecord {
  durability: number | null;
  equippedSlot: 'vest' | 'weapon' | null;
  id: string;
  itemId: string | null;
  itemName: string | null;
  itemType: InventoryItemType;
  levelRequired: number | null;
  proficiency: number;
  quantity: number;
  stackable: boolean;
}

interface MarketAuctionNotificationRecord {
  auctionId: string;
  createdAt: Date;
  id: string;
  message: string;
  playerId: string;
  title: string;
  type: MarketAuctionNotificationType;
}

interface MarketAuctionQuery {
  excludePlayerId?: string;
  itemId?: string;
  itemType?: 'vest' | 'weapon';
  playerId?: string;
  status?: MarketAuctionStatus;
}

interface MarketAuctionRecord {
  buyoutPrice: number | null;
  createdAt: Date;
  currentBid: number | null;
  durabilitySnapshot: number | null;
  endsAt: Date;
  id: string;
  itemId: string;
  itemName: string;
  itemType: 'vest' | 'weapon';
  leadingBidderId: string | null;
  playerId: string;
  proficiencySnapshot: number;
  quantity: number;
  settledAt: Date | null;
  startingBid: number;
  status: MarketAuctionStatus;
}

interface MarketOrderQuery {
  excludePlayerId?: string;
  itemId?: string;
  itemType?: InventoryItemType;
  ownerPlayerId?: string;
  side?: MarketOrderSide;
  status?: MarketOrderStatus;
}

interface MarketOrderRecord {
  createdAt: Date;
  durabilitySnapshot: number | null;
  expiresAt: Date;
  id: string;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  playerId: string;
  pricePerUnit: number;
  proficiencySnapshot: number;
  quantity: number;
  remainingQuantity: number;
  side: MarketOrderSide;
  sourceLabel: string | null;
  sourceType: 'player' | 'system';
  status: MarketOrderStatus;
  systemOfferId: string | null;
}

interface MarketSystemOfferRecord {
  code: string;
  createdAt: Date;
  id: string;
  isActive: boolean;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  label: string;
  lastRestockedGameDay: number;
  lastRestockedRoundId: string | null;
  pricePerUnit: number;
  restockAmount: number;
  restockIntervalGameDays: number;
  sortOrder: number;
  stockAvailable: number;
  stockMax: number;
  updatedAt: Date;
}

interface MarketTransactionRepository {
  addInventoryItem(input: {
    durability: number | null;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    proficiency: number;
    quantity: number;
  }): Promise<void>;
  addTransaction(input: {
    amount: number;
    description: string;
    playerId: string;
    type: string;
  }): Promise<void>;
  adjustPlayerMoney(playerId: string, delta: number): Promise<void>;
  createAuction(input: {
    buyoutPrice: number | null;
    durabilitySnapshot: number | null;
    endsAt: Date;
    itemId: string;
    itemType: 'vest' | 'weapon';
    playerId: string;
    proficiencySnapshot: number;
    quantity: number;
    startingBid: number;
    status: MarketAuctionStatus;
  }): Promise<MarketAuctionRecord>;
  createAuctionBid(input: {
    amount: number;
    auctionId: string;
    bidderPlayerId: string;
  }): Promise<void>;
  createAuctionNotification(input: {
    auctionId: string;
    message: string;
    playerId: string;
    title: string;
    type: MarketAuctionNotificationType;
  }): Promise<MarketAuctionNotificationRecord>;
  createOrder(input: {
    durabilitySnapshot: number | null;
    expiresAt: Date;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    pricePerUnit: number;
    proficiencySnapshot: number;
    quantity: number;
    remainingQuantity: number;
    side: MarketOrderSide;
    status: MarketOrderStatus;
  }): Promise<MarketOrderRecord>;
  getAuctionById(auctionId: string): Promise<MarketAuctionRecord | null>;
  getInventoryItem(playerId: string, inventoryItemId: string): Promise<MarketInventoryItemRecord | null>;
  getItemDefinition(itemType: InventoryItemType, itemId: string): Promise<MarketItemDefinitionRecord | null>;
  getOrderById(orderId: string): Promise<MarketOrderRecord | null>;
  getPlayer(playerId: string): Promise<MarketPlayerRecord | null>;
  getSystemOfferById(offerId: string): Promise<MarketSystemOfferRecord | null>;
  listAuctionNotifications(playerId: string, limit: number): Promise<MarketAuctionNotificationRecord[]>;
  listAuctions(query: MarketAuctionQuery): Promise<MarketAuctionRecord[]>;
  listOrders(query: MarketOrderQuery): Promise<MarketOrderRecord[]>;
  listSystemOffers(query: {
    isActive?: boolean;
    itemId?: string;
    itemType?: InventoryItemType;
  }): Promise<MarketSystemOfferRecord[]>;
  removeInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean>;
  saveAuction(auction: MarketAuctionRecord): Promise<void>;
  saveOrder(order: MarketOrderRecord): Promise<void>;
  saveSystemOffer(offer: MarketSystemOfferRecord): Promise<void>;
  updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean>;
}

export interface MarketRepository {
  listAuctions(query: MarketAuctionQuery): Promise<MarketAuctionRecord[]>;
  listOrders(query: MarketOrderQuery): Promise<MarketOrderRecord[]>;
  withTransaction<T>(run: (repository: MarketTransactionRepository) => Promise<T>): Promise<T>;
}

type MarketErrorCode =
  | 'auction_closed'
  | 'auction_own_bid'
  | 'bid_too_low'
  | 'character_not_ready'
  | 'insufficient_funds'
  | 'invalid_order'
  | 'item_not_supported'
  | 'not_found'
  | 'order_not_cancelable'
  | 'ownership_required';

export class MarketError extends Error {
  constructor(
    public readonly code: MarketErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MarketError';
  }
}

export class DatabaseMarketRepository implements MarketRepository {
  async listAuctions(query: MarketAuctionQuery): Promise<MarketAuctionRecord[]> {
    return new DatabaseMarketTransactionRepository(db).listAuctions(query);
  }

  async listOrders(query: MarketOrderQuery): Promise<MarketOrderRecord[]> {
    return new DatabaseMarketTransactionRepository(db).listOrders(query);
  }

  async withTransaction<T>(run: (repository: MarketTransactionRepository) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) =>
      run(new DatabaseMarketTransactionRepository(tx as unknown as DatabaseClient)),
    );
  }
}

class DatabaseMarketTransactionRepository implements MarketTransactionRepository {
  constructor(private readonly client: DatabaseClient) {}

  async addInventoryItem(input: {
    durability: number | null;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    proficiency: number;
    quantity: number;
  }): Promise<void> {
    const definition = await this.getItemDefinition(input.itemType, input.itemId);

    if (!definition) {
      throw new MarketError('not_found', 'Definicao do item nao encontrada no mercado.');
    }

    if (definition.stackable) {
      const [existingEntry] = await this.client
        .select({
          id: playerInventory.id,
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.playerId, input.playerId),
            eq(playerInventory.itemType, input.itemType),
            eq(playerInventory.itemId, input.itemId),
            isNull(playerInventory.equippedSlot),
          ),
        )
        .limit(1);

      if (existingEntry) {
        await this.client
          .update(playerInventory)
          .set({
            quantity: existingEntry.quantity + input.quantity,
          })
          .where(eq(playerInventory.id, existingEntry.id));
        return;
      }
    }

    await this.client.insert(playerInventory).values({
      durability: definition.stackable ? null : input.durability,
      itemId: input.itemId,
      itemType: input.itemType,
      playerId: input.playerId,
      proficiency: definition.stackable ? 0 : input.proficiency,
      quantity: input.quantity,
    });
  }

  async addTransaction(input: {
    amount: number;
    description: string;
    playerId: string;
    type: string;
  }): Promise<void> {
    await this.client.insert(transactions).values({
      amount: toMoneyString(input.amount),
      description: input.description,
      playerId: input.playerId,
      type: input.type,
    });
  }

  async adjustPlayerMoney(playerId: string, delta: number): Promise<void> {
    const normalizedDelta = roundCurrency(delta);
    const [updatedPlayer] = await this.client
      .update(players)
      .set({
        money: sql`round((${players.money} + ${toMoneyString(normalizedDelta)})::numeric, 2)`,
      })
      .where(
        and(
          eq(players.id, playerId),
          sql`(${players.money} + ${toMoneyString(normalizedDelta)}) >= 0`,
        ),
      )
      .returning({
        id: players.id,
      });

    if (updatedPlayer) {
      return;
    }

    const player = await this.getPlayer(playerId);

    if (!player) {
      throw new MarketError('not_found', 'Jogador nao encontrado para ajuste financeiro.');
    }

    throw new MarketError('insufficient_funds', 'Saldo insuficiente para concluir a operacao.');
  }

  async createAuction(input: {
    buyoutPrice: number | null;
    durabilitySnapshot: number | null;
    endsAt: Date;
    itemId: string;
    itemType: 'vest' | 'weapon';
    playerId: string;
    proficiencySnapshot: number;
    quantity: number;
    startingBid: number;
    status: MarketAuctionStatus;
  }): Promise<MarketAuctionRecord> {
    const [createdAuction] = await this.client
      .insert(marketAuctions)
      .values({
        buyoutPrice: input.buyoutPrice === null ? null : toMoneyString(input.buyoutPrice),
        durabilitySnapshot: input.durabilitySnapshot,
        endsAt: input.endsAt,
        itemId: input.itemId,
        itemType: input.itemType,
        playerId: input.playerId,
        proficiencySnapshot: input.proficiencySnapshot,
        quantity: input.quantity,
        startingBid: toMoneyString(input.startingBid),
        status: input.status,
      })
      .returning();

    if (!createdAuction) {
      throw new Error('Falha ao criar o leilao.');
    }

    return this.mapAuctionRow(createdAuction);
  }

  async createAuctionBid(input: {
    amount: number;
    auctionId: string;
    bidderPlayerId: string;
  }): Promise<void> {
    await this.client.insert(marketAuctionBids).values({
      amount: toMoneyString(input.amount),
      auctionId: input.auctionId,
      bidderPlayerId: input.bidderPlayerId,
    });
  }

  async createAuctionNotification(input: {
    auctionId: string;
    message: string;
    playerId: string;
    title: string;
    type: MarketAuctionNotificationType;
  }): Promise<MarketAuctionNotificationRecord> {
    const [createdNotification] = await this.client
      .insert(marketAuctionNotifications)
      .values({
        auctionId: input.auctionId,
        message: input.message,
        playerId: input.playerId,
        title: input.title,
        type: input.type,
      })
      .returning();

    if (!createdNotification) {
      throw new Error('Falha ao criar notificacao de leilao.');
    }

    return {
      auctionId: createdNotification.auctionId,
      createdAt: createdNotification.createdAt,
      id: createdNotification.id,
      message: createdNotification.message,
      playerId: createdNotification.playerId,
      title: createdNotification.title,
      type: createdNotification.type,
    };
  }

  async createOrder(input: {
    durabilitySnapshot: number | null;
    expiresAt: Date;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    pricePerUnit: number;
    proficiencySnapshot: number;
    quantity: number;
    remainingQuantity: number;
    side: MarketOrderSide;
    status: MarketOrderStatus;
  }): Promise<MarketOrderRecord> {
    const [createdOrder] = await this.client
      .insert(marketOrders)
      .values({
        durabilitySnapshot: input.durabilitySnapshot,
        expiresAt: input.expiresAt,
        itemId: input.itemId,
        itemType: input.itemType,
        playerId: input.playerId,
        pricePerUnit: toMoneyString(input.pricePerUnit),
        proficiencySnapshot: input.proficiencySnapshot,
        quantity: input.quantity,
        remainingQuantity: input.remainingQuantity,
        side: input.side,
        status: input.status,
      })
      .returning();

    if (!createdOrder) {
      throw new Error('Falha ao criar a ordem de mercado.');
    }

    return this.mapOrderRow(createdOrder);
  }

  async getAuctionById(auctionId: string): Promise<MarketAuctionRecord | null> {
    const [auction] = await this.client
      .select()
      .from(marketAuctions)
      .where(eq(marketAuctions.id, auctionId))
      .limit(1);

    return auction ? this.mapAuctionRow(auction) : null;
  }

  async getInventoryItem(playerId: string, inventoryItemId: string): Promise<MarketInventoryItemRecord | null> {
    const [item] = await this.client
      .select({
        durability: playerInventory.durability,
        equippedSlot: playerInventory.equippedSlot,
        id: playerInventory.id,
        itemId: playerInventory.itemId,
        itemType: playerInventory.itemType,
        proficiency: playerInventory.proficiency,
        quantity: playerInventory.quantity,
      })
      .from(playerInventory)
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .limit(1);

    if (!item || !item.itemId) {
      return null;
    }

    const definition = await this.getItemDefinition(item.itemType, item.itemId);

    if (!definition) {
      return null;
    }

    return {
      durability: item.durability,
      equippedSlot: item.equippedSlot,
      id: item.id,
      itemId: item.itemId,
      itemName: definition.itemName,
      itemType: item.itemType,
      levelRequired: definition.levelRequired,
      proficiency: item.proficiency,
      quantity: item.quantity,
      stackable: definition.stackable,
    };
  }

  async getItemDefinition(
    itemType: InventoryItemType,
    itemId: string,
  ): Promise<MarketItemDefinitionRecord | null> {
    if (itemType === 'weapon') {
      const [weapon] = await this.client
        .select({
          durabilityMax: weapons.durabilityMax,
          id: weapons.id,
          levelRequired: weapons.levelRequired,
          name: weapons.name,
        })
        .from(weapons)
        .where(eq(weapons.id, itemId))
        .limit(1);

      return weapon
        ? {
            durabilityMax: weapon.durabilityMax,
            itemId: weapon.id,
            itemName: weapon.name,
            itemType,
            levelRequired: weapon.levelRequired,
            stackable: false,
          }
        : null;
    }

    if (itemType === 'vest') {
      const [vest] = await this.client
        .select({
          durabilityMax: vests.durabilityMax,
          id: vests.id,
          levelRequired: vests.levelRequired,
          name: vests.name,
        })
        .from(vests)
        .where(eq(vests.id, itemId))
        .limit(1);

      return vest
        ? {
            durabilityMax: vest.durabilityMax,
            itemId: vest.id,
            itemName: vest.name,
            itemType,
            levelRequired: vest.levelRequired,
            stackable: false,
          }
        : null;
    }

    if (itemType === 'drug') {
      const [drug] = await this.client
        .select({
          id: drugs.id,
          levelRequired: drugs.productionLevel,
          name: drugs.name,
        })
        .from(drugs)
        .where(eq(drugs.id, itemId))
        .limit(1);

      return drug
        ? {
            durabilityMax: null,
            itemId: drug.id,
            itemName: drug.name,
            itemType,
            levelRequired: drug.levelRequired,
            stackable: true,
          }
        : null;
    }

    if (itemType === 'component') {
      const [component] = await this.client
        .select({
          id: components.id,
          name: components.name,
        })
        .from(components)
        .where(eq(components.id, itemId))
        .limit(1);

      return component
        ? {
            durabilityMax: null,
            itemId: component.id,
            itemName: component.name,
            itemType,
            levelRequired: null,
            stackable: true,
          }
        : null;
    }

    return null;
  }

  async getOrderById(orderId: string): Promise<MarketOrderRecord | null> {
    const [order] = await this.client.select().from(marketOrders).where(eq(marketOrders.id, orderId)).limit(1);
    return order ? this.mapOrderRow(order) : null;
  }

  async getPlayer(playerId: string): Promise<MarketPlayerRecord | null> {
    const [player] = await this.client
      .select({
        characterCreatedAt: players.characterCreatedAt,
        id: players.id,
        level: players.level,
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    return player
      ? {
          characterCreatedAt: player.characterCreatedAt,
          id: player.id,
          level: player.level,
          money: parseMoney(player.money),
        }
      : null;
  }

  async getSystemOfferById(offerId: string): Promise<MarketSystemOfferRecord | null> {
    const [offer] = await this.client
      .select()
      .from(marketSystemOffers)
      .where(eq(marketSystemOffers.id, offerId))
      .limit(1);

    return offer ? this.mapSystemOfferRow(offer) : null;
  }

  async listAuctionNotifications(playerId: string, limit: number): Promise<MarketAuctionNotificationRecord[]> {
    const rows = await this.client
      .select()
      .from(marketAuctionNotifications)
      .where(eq(marketAuctionNotifications.playerId, playerId))
      .orderBy(desc(marketAuctionNotifications.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      auctionId: row.auctionId,
      createdAt: row.createdAt,
      id: row.id,
      message: row.message,
      playerId: row.playerId,
      title: row.title,
      type: row.type,
    }));
  }

  async listAuctions(query: MarketAuctionQuery): Promise<MarketAuctionRecord[]> {
    const rows = await this.client
      .select()
      .from(marketAuctions)
      .where(
        and(
          query.itemId ? eq(marketAuctions.itemId, query.itemId) : undefined,
          query.itemType ? eq(marketAuctions.itemType, query.itemType) : undefined,
          query.playerId ? eq(marketAuctions.playerId, query.playerId) : undefined,
          query.status ? eq(marketAuctions.status, query.status) : undefined,
        ),
      )
      .orderBy(asc(marketAuctions.endsAt), desc(marketAuctions.createdAt));

    const mappedRows = await Promise.all(rows.map((row) => this.mapAuctionRow(row)));

    return query.excludePlayerId
      ? mappedRows.filter((auction) => auction.playerId !== query.excludePlayerId)
      : mappedRows;
  }

  async listOrders(query: MarketOrderQuery): Promise<MarketOrderRecord[]> {
    const rows = await this.client
      .select()
      .from(marketOrders)
      .where(
        and(
          query.itemId ? eq(marketOrders.itemId, query.itemId) : undefined,
          query.itemType ? eq(marketOrders.itemType, query.itemType) : undefined,
          query.ownerPlayerId ? eq(marketOrders.playerId, query.ownerPlayerId) : undefined,
          query.side ? eq(marketOrders.side, query.side) : undefined,
          query.status ? eq(marketOrders.status, query.status) : undefined,
        ),
      )
      .orderBy(
        query.side === 'buy'
          ? desc(marketOrders.pricePerUnit)
          : query.side === 'sell'
            ? asc(marketOrders.pricePerUnit)
            : asc(marketOrders.createdAt),
        asc(marketOrders.createdAt),
      );

    const mappedRows = await Promise.all(rows.map((row) => this.mapOrderRow(row)));

    return query.excludePlayerId
      ? mappedRows.filter((order) => order.playerId !== query.excludePlayerId)
      : mappedRows;
  }

  async listSystemOffers(query: {
    isActive?: boolean;
    itemId?: string;
    itemType?: InventoryItemType;
  }): Promise<MarketSystemOfferRecord[]> {
    const rows = await this.client
      .select()
      .from(marketSystemOffers)
      .where(
        and(
          query.itemId ? eq(marketSystemOffers.itemId, query.itemId) : undefined,
          query.itemType ? eq(marketSystemOffers.itemType, query.itemType) : undefined,
          typeof query.isActive === 'boolean' ? eq(marketSystemOffers.isActive, query.isActive) : undefined,
        ),
      )
      .orderBy(asc(marketSystemOffers.sortOrder), asc(marketSystemOffers.pricePerUnit), asc(marketSystemOffers.code));

    return Promise.all(rows.map((row) => this.mapSystemOfferRow(row)));
  }

  async removeInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean> {
    const [deletedItem] = await this.client
      .delete(playerInventory)
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .returning({
        id: playerInventory.id,
      });

    return Boolean(deletedItem);
  }

  async saveAuction(auction: MarketAuctionRecord): Promise<void> {
    await this.client
      .update(marketAuctions)
      .set({
        buyoutPrice: auction.buyoutPrice === null ? null : toMoneyString(auction.buyoutPrice),
        currentBid: auction.currentBid === null ? null : toMoneyString(auction.currentBid),
        endsAt: auction.endsAt,
        leadingBidderId: auction.leadingBidderId,
        settledAt: auction.settledAt,
        status: auction.status,
      })
      .where(eq(marketAuctions.id, auction.id));
  }

  async saveOrder(order: MarketOrderRecord): Promise<void> {
    await this.client
      .update(marketOrders)
      .set({
        remainingQuantity: order.remainingQuantity,
        status: order.status,
      })
      .where(eq(marketOrders.id, order.id));
  }

  async saveSystemOffer(offer: MarketSystemOfferRecord): Promise<void> {
    await this.client
      .update(marketSystemOffers)
      .set({
        isActive: offer.isActive,
        lastRestockedGameDay: offer.lastRestockedGameDay,
        lastRestockedRoundId: offer.lastRestockedRoundId,
        pricePerUnit: toMoneyString(offer.pricePerUnit),
        stockAvailable: offer.stockAvailable,
        stockMax: offer.stockMax,
        updatedAt: offer.updatedAt,
      })
      .where(eq(marketSystemOffers.id, offer.id));
  }

  async updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean> {
    const [updatedItem] = await this.client
      .update(playerInventory)
      .set({
        quantity,
      })
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .returning({
        id: playerInventory.id,
      });

    return Boolean(updatedItem);
  }

  private async mapAuctionRow(row: MarketAuctionRow): Promise<MarketAuctionRecord> {
    const definition = await this.getItemDefinition(row.itemType, row.itemId);

    return {
      buyoutPrice: row.buyoutPrice ? parseMoney(row.buyoutPrice) : null,
      createdAt: row.createdAt,
      currentBid: row.currentBid ? parseMoney(row.currentBid) : null,
      durabilitySnapshot: row.durabilitySnapshot,
      endsAt: row.endsAt,
      id: row.id,
      itemId: row.itemId,
      itemName: definition?.itemName ?? row.itemId,
      itemType: row.itemType as 'vest' | 'weapon',
      leadingBidderId: row.leadingBidderId,
      playerId: row.playerId,
      proficiencySnapshot: row.proficiencySnapshot,
      quantity: row.quantity,
      settledAt: row.settledAt,
      startingBid: parseMoney(row.startingBid),
      status: row.status,
    };
  }

  private async mapOrderRow(row: MarketOrderRow): Promise<MarketOrderRecord> {
    const definition = await this.getItemDefinition(row.itemType, row.itemId);

    return {
      createdAt: row.createdAt,
      durabilitySnapshot: row.durabilitySnapshot,
      expiresAt: row.expiresAt,
      id: row.id,
      itemId: row.itemId,
      itemName: definition?.itemName ?? row.itemId,
      itemType: row.itemType,
      playerId: row.playerId,
      pricePerUnit: parseMoney(row.pricePerUnit),
      proficiencySnapshot: row.proficiencySnapshot,
      quantity: row.quantity,
      remainingQuantity: row.remainingQuantity,
      side: row.side,
      sourceLabel: null,
      sourceType: 'player',
      status: row.status,
      systemOfferId: null,
    };
  }

  private async mapSystemOfferRow(row: MarketSystemOfferRow): Promise<MarketSystemOfferRecord> {
    const definition = await this.getItemDefinition(row.itemType, row.itemId);

    return {
      code: row.code,
      createdAt: row.createdAt,
      id: row.id,
      isActive: row.isActive,
      itemId: row.itemId,
      itemName: definition?.itemName ?? row.itemId,
      itemType: row.itemType,
      label: row.label,
      lastRestockedGameDay: row.lastRestockedGameDay,
      lastRestockedRoundId: row.lastRestockedRoundId,
      pricePerUnit: parseMoney(row.pricePerUnit),
      restockAmount: row.restockAmount,
      restockIntervalGameDays: row.restockIntervalGameDays,
      sortOrder: row.sortOrder,
      stockAvailable: row.stockAvailable,
      stockMax: row.stockMax,
      updatedAt: row.updatedAt,
    };
  }
}

export class MarketService implements MarketServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly inflationReader: NpcInflationReaderContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: MarketRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: MarketServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.inflationReader = options.inflationReader ?? new DatabaseNpcInflationReader(options.now ?? (() => new Date()));
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseMarketRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async bidAuction(
    playerId: string,
    auctionId: string,
    input: MarketAuctionBidInput,
  ): Promise<MarketAuctionMutationResponse> {
    const sanitizedInput = sanitizeMarketAuctionBidInput(input);
    const cacheInvalidations = new Set<string>();

    const result = await this.repository.withTransaction(async (repository) => {
      await this.settleExpiredAuctions(repository, cacheInvalidations);
      const [auction, player] = await Promise.all([
        repository.getAuctionById(auctionId),
        repository.getPlayer(playerId),
      ]);

      if (!auction) {
        throw new MarketError('not_found', 'Leilao nao encontrado.');
      }

      if (!player) {
        throw new MarketError('not_found', 'Jogador nao encontrado.');
      }

      if (!player.characterCreatedAt) {
        throw new MarketError('character_not_ready', 'Crie seu personagem antes de usar o mercado negro.');
      }

      if (auction.status !== 'open' || auction.endsAt.getTime() <= this.now().getTime()) {
        throw new MarketError('auction_closed', 'Esse leilao ja foi encerrado.');
      }

      if (auction.playerId === playerId) {
        throw new MarketError('auction_own_bid', 'Nao e permitido dar lance no proprio leilao.');
      }

      const minNextBid = resolveMinimumAuctionBid(auction);

      if (sanitizedInput.amount < minNextBid) {
        throw new MarketError(
          'bid_too_low',
          `O proximo lance minimo para ${auction.itemName} e R$ ${minNextBid.toFixed(2)}.`,
        );
      }

      if (player.money < sanitizedInput.amount) {
        throw new MarketError('insufficient_funds', 'Saldo insuficiente para cobrir esse lance.');
      }

      await repository.adjustPlayerMoney(playerId, -sanitizedInput.amount);
      await repository.addTransaction({
        amount: -sanitizedInput.amount,
        description: `Reserva do lance no leilao de ${auction.itemName}.`,
        playerId,
        type: 'market_auction_bid_hold',
      });

      if (auction.leadingBidderId && auction.currentBid !== null) {
        await repository.adjustPlayerMoney(auction.leadingBidderId, auction.currentBid);
        await repository.addTransaction({
          amount: auction.currentBid,
          description: `Reembolso do lance superado em ${auction.itemName}.`,
          playerId: auction.leadingBidderId,
          type: 'market_auction_bid_refund',
        });
        await repository.createAuctionNotification({
          auctionId: auction.id,
          message: `Outro jogador cobriu seu lance em ${auction.itemName}.`,
          playerId: auction.leadingBidderId,
          title: 'Lance superado',
          type: 'outbid',
        });
        cacheInvalidations.add(auction.leadingBidderId);
      }

      await repository.createAuctionBid({
        amount: sanitizedInput.amount,
        auctionId: auction.id,
        bidderPlayerId: playerId,
      });

      auction.currentBid = sanitizedInput.amount;
      auction.leadingBidderId = playerId;

      let settlement: MarketAuctionSettlementSummary | null = null;

      if (auction.buyoutPrice !== null && sanitizedInput.amount >= auction.buyoutPrice) {
        settlement = await this.settleAuction(repository, auction, cacheInvalidations);
      } else {
        await repository.saveAuction(auction);
      }

      return {
        auction: serializeMarketAuction(auction),
        notifications: (await repository.listAuctionNotifications(playerId, 10)).map(serializeAuctionNotification),
        settlement,
      } satisfies MarketAuctionMutationResponse;
    });

    await this.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async cancelOrder(playerId: string, orderId: string): Promise<MarketOrderMutationResponse> {
    const cacheInvalidations = new Set<string>([playerId]);
    const result = await this.repository.withTransaction(async (repository) => {
      const order = await repository.getOrderById(orderId);

      if (!order) {
        throw new MarketError('not_found', 'Ordem de mercado nao encontrada.');
      }

      if (order.playerId !== playerId) {
        throw new MarketError('ownership_required', 'A ordem pertence a outro jogador.');
      }

      if (order.status !== 'open' || order.remainingQuantity < 1) {
        throw new MarketError('order_not_cancelable', 'A ordem nao pode mais ser cancelada.');
      }

      let refundedAmount = 0;
      let returnedQuantity = 0;

      if (order.side === 'buy') {
        refundedAmount = roundCurrency(order.remainingQuantity * order.pricePerUnit);
        await repository.adjustPlayerMoney(playerId, refundedAmount);
        await repository.addTransaction({
          amount: refundedAmount,
          description: `Cancelamento da ordem de compra de ${order.itemName}.`,
          playerId,
          type: 'market_order_cancel_refund',
        });
      } else {
        returnedQuantity = order.remainingQuantity;
        await repository.addInventoryItem({
          durability: order.durabilitySnapshot,
          itemId: order.itemId,
          itemType: order.itemType,
          playerId,
          proficiency: order.proficiencySnapshot,
          quantity: returnedQuantity,
        });
      }

      order.status = 'cancelled';
      await repository.saveOrder(order);

      return {
        feeTotal: 0,
        matchedTrades: [],
        order: serializeMarketOrder(order),
        refundedAmount,
        returnedQuantity,
      } satisfies MarketOrderMutationResponse;
    });

    await this.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async createAuction(playerId: string, input: MarketAuctionCreateInput): Promise<MarketAuctionMutationResponse> {
    const now = this.now();
    const sanitizedInput = sanitizeMarketAuctionCreateInput(input);
    const cacheInvalidations = new Set<string>([playerId]);

    const result = await this.repository.withTransaction(async (repository) => {
      await this.settleExpiredAuctions(repository, cacheInvalidations);
      const [player, definition, inventoryItem] = await Promise.all([
        repository.getPlayer(playerId),
        repository.getItemDefinition(sanitizedInput.itemType, sanitizedInput.itemId),
        repository.getInventoryItem(playerId, sanitizedInput.inventoryItemId),
      ]);

      if (!player) {
        throw new MarketError('not_found', 'Jogador nao encontrado.');
      }

      if (!player.characterCreatedAt) {
        throw new MarketError('character_not_ready', 'Crie seu personagem antes de usar o mercado negro.');
      }

      if (!definition) {
        throw new MarketError('not_found', 'Item inexistente para o leilao.');
      }

      if (!inventoryItem || !inventoryItem.itemId) {
        throw new MarketError('not_found', 'Item do inventario nao encontrado para leilao.');
      }

      if (inventoryItem.itemId !== sanitizedInput.itemId || inventoryItem.itemType !== sanitizedInput.itemType) {
        throw new MarketError('invalid_order', 'O item do inventario nao corresponde ao leilao.');
      }

      if (inventoryItem.equippedSlot) {
        throw new MarketError('invalid_order', 'Desequipe o item antes de criar um leilao.');
      }

      if (inventoryItem.stackable) {
        throw new MarketError('invalid_order', 'Leiloes aceitam apenas itens individuais.');
      }

      if ((inventoryItem.durability ?? 0) < 1) {
        throw new MarketError('invalid_order', 'Itens quebrados nao podem ser leiloados.');
      }

      await repository.removeInventoryItem(playerId, inventoryItem.id);

      const auction = await repository.createAuction({
        buyoutPrice: sanitizedInput.buyoutPrice ?? null,
        durabilitySnapshot: inventoryItem.durability,
        endsAt: new Date(now.getTime() + sanitizedInput.durationMinutes * 60 * 1000),
        itemId: sanitizedInput.itemId,
        itemType: sanitizedInput.itemType,
        playerId,
        proficiencySnapshot: inventoryItem.proficiency,
        quantity: 1,
        startingBid: sanitizedInput.startingBid,
        status: 'open',
      });

      return {
        auction: serializeMarketAuction(auction),
        notifications: (await repository.listAuctionNotifications(playerId, 10)).map(serializeAuctionNotification),
        settlement: null,
      } satisfies MarketAuctionMutationResponse;
    });

    await this.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async createOrder(playerId: string, input: MarketOrderCreateInput): Promise<MarketOrderMutationResponse> {
    const now = this.now();
    const sanitizedInput = sanitizeMarketOrderInput(input);
    const cacheInvalidations = new Set<string>([playerId]);
    const systemOfferContext = await this.resolveSystemOfferContext();

    const result = await this.repository.withTransaction(async (repository) => {
      await this.syncSystemOffers(repository, systemOfferContext);
      const player = await repository.getPlayer(playerId);

      if (!player) {
        throw new MarketError('not_found', 'Jogador nao encontrado.');
      }

      if (!player.characterCreatedAt) {
        throw new MarketError('character_not_ready', 'Crie seu personagem antes de usar o mercado negro.');
      }

      const definition = await repository.getItemDefinition(
        sanitizedInput.itemType,
        sanitizedInput.itemId,
      );

      if (!definition) {
        throw new MarketError('not_found', 'Item inexistente para o mercado negro.');
      }

      let durabilitySnapshot: number | null = null;
      let proficiencySnapshot = 0;

      if (sanitizedInput.side === 'sell') {
        if (!sanitizedInput.inventoryItemId) {
          throw new MarketError('invalid_order', 'Ordens de venda exigem um item do inventario.');
        }

        const inventoryItem = await repository.getInventoryItem(
          playerId,
          sanitizedInput.inventoryItemId,
        );

        if (!inventoryItem || !inventoryItem.itemId) {
          throw new MarketError('not_found', 'Item do inventario nao encontrado para venda.');
        }

        if (inventoryItem.itemId !== sanitizedInput.itemId || inventoryItem.itemType !== sanitizedInput.itemType) {
          throw new MarketError('invalid_order', 'O item do inventario nao corresponde a ordem.');
        }

        if (inventoryItem.equippedSlot) {
          throw new MarketError('invalid_order', 'Desequipe o item antes de anunciar no mercado negro.');
        }

        if (!inventoryItem.stackable && (inventoryItem.durability ?? 0) < 1) {
          throw new MarketError('invalid_order', 'Itens quebrados nao podem ser vendidos no mercado negro.');
        }

        if (!inventoryItem.stackable && sanitizedInput.quantity !== 1) {
          throw new MarketError('invalid_order', 'Itens nao stackaveis so podem ser vendidos um por vez.');
        }

        if (inventoryItem.quantity < sanitizedInput.quantity) {
          throw new MarketError('invalid_order', 'Quantidade insuficiente no inventario para anunciar.');
        }

        durabilitySnapshot = inventoryItem.durability;
        proficiencySnapshot = inventoryItem.proficiency;

        if (inventoryItem.stackable) {
          const remainingQuantity = inventoryItem.quantity - sanitizedInput.quantity;

          if (remainingQuantity > 0) {
            await repository.updateInventoryItemQuantity(
              playerId,
              inventoryItem.id,
              remainingQuantity,
            );
          } else {
            await repository.removeInventoryItem(playerId, inventoryItem.id);
          }
        } else {
          await repository.removeInventoryItem(playerId, inventoryItem.id);
        }
      } else if (sanitizedInput.systemOfferId) {
        const systemOffer = await repository.getSystemOfferById(sanitizedInput.systemOfferId);

        if (!systemOffer || !systemOffer.isActive) {
          throw new MarketError('not_found', 'Oferta sistêmica não encontrada no Mercado Negro.');
        }

        if (
          systemOffer.itemId !== sanitizedInput.itemId ||
          systemOffer.itemType !== sanitizedInput.itemType
        ) {
          throw new MarketError('invalid_order', 'A oferta sistêmica não corresponde ao item solicitado.');
        }

        if (systemOffer.stockAvailable < sanitizedInput.quantity) {
          throw new MarketError(
            'invalid_order',
            `O fornecedor da rodada só tem ${systemOffer.stockAvailable} unidade(s) disponível(is).`,
          );
        }

        if (roundCurrency(systemOffer.pricePerUnit) !== roundCurrency(sanitizedInput.pricePerUnit)) {
          throw new MarketError('invalid_order', 'O preço da oferta sistêmica mudou. Atualize o Mercado Negro.');
        }

        const reserveTotal = roundCurrency(sanitizedInput.quantity * sanitizedInput.pricePerUnit);

        if (player.money < reserveTotal) {
          throw new MarketError('insufficient_funds', 'Saldo insuficiente para comprar nessa oferta sistêmica.');
        }

        await repository.adjustPlayerMoney(playerId, -reserveTotal);
        await repository.addTransaction({
          amount: -reserveTotal,
          description: `Compra direta no fornecedor da rodada: ${definition.itemName} (${sanitizedInput.quantity}x).`,
          playerId,
          type: 'market_system_buy',
        });
        await repository.addInventoryItem({
          durability: definition.stackable ? null : definition.durabilityMax,
          itemId: sanitizedInput.itemId,
          itemType: sanitizedInput.itemType,
          playerId,
          proficiency: 0,
          quantity: sanitizedInput.quantity,
        });

        systemOffer.stockAvailable = Math.max(0, systemOffer.stockAvailable - sanitizedInput.quantity);
        systemOffer.updatedAt = now;
        await repository.saveSystemOffer(systemOffer);

        return {
          feeTotal: 0,
          matchedTrades: [
            {
              buyerId: playerId,
              feeTotal: 0,
              grossTotal: reserveTotal,
              itemId: sanitizedInput.itemId,
              itemName: definition.itemName,
              itemType: sanitizedInput.itemType,
              pricePerUnit: sanitizedInput.pricePerUnit,
              quantity: sanitizedInput.quantity,
              sellerId: 'system',
              sellerNetTotal: 0,
            },
          ],
          order: serializeSystemOfferPurchase({
            createdAt: now,
            itemId: sanitizedInput.itemId,
            itemName: definition.itemName,
            itemType: sanitizedInput.itemType,
            pricePerUnit: sanitizedInput.pricePerUnit,
            quantity: sanitizedInput.quantity,
            remainingStock: systemOffer.stockAvailable,
            systemOfferId: systemOffer.id,
            systemSourceLabel: systemOffer.label,
          }),
          refundedAmount: 0,
          returnedQuantity: 0,
        } satisfies MarketOrderMutationResponse;
      } else {
        const reserveTotal = roundCurrency(sanitizedInput.quantity * sanitizedInput.pricePerUnit);

        if (player.money < reserveTotal) {
          throw new MarketError('insufficient_funds', 'Saldo insuficiente para abrir a ordem de compra.');
        }

        await repository.adjustPlayerMoney(playerId, -reserveTotal);
        await repository.addTransaction({
          amount: -reserveTotal,
          description: `Reserva da ordem de compra de ${definition.itemName}.`,
          playerId,
          type: 'market_order_buy_reserve',
        });
      }

      const createdOrder = await repository.createOrder({
        durabilitySnapshot,
        expiresAt: new Date(now.getTime() + MARKET_ORDER_DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000),
        itemId: sanitizedInput.itemId,
        itemType: sanitizedInput.itemType,
        playerId,
        pricePerUnit: sanitizedInput.pricePerUnit,
        proficiencySnapshot,
        quantity: sanitizedInput.quantity,
        remainingQuantity: sanitizedInput.quantity,
        side: sanitizedInput.side,
        status: 'open',
      });
      const execution = await this.matchOrder(repository, createdOrder, cacheInvalidations);

      return {
        feeTotal: execution.feeTotal,
        matchedTrades: execution.matchedTrades,
        order: serializeMarketOrder(execution.order),
        refundedAmount: execution.refundedAmount,
        returnedQuantity: 0,
      } satisfies MarketOrderMutationResponse;
    });

    await this.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async getAuctionBook(
    playerId: string,
    filters: MarketAuctionBookFilters = {},
  ): Promise<MarketAuctionBookResponse> {
    const cacheInvalidations = new Set<string>();

    const result = await this.repository.withTransaction(async (repository) => {
      await this.settleExpiredAuctions(repository, cacheInvalidations);
      const sanitizedFilters = sanitizeMarketAuctionBookFilters(filters);
      const [viewerProfile, auctions, myAuctions, notifications] = await Promise.all([
        this.universityReader.getPassiveProfile(playerId),
        repository.listAuctions({
          ...sanitizedFilters,
          excludePlayerId: playerId,
          status: 'open',
        }),
        repository.listAuctions({
          playerId,
        }),
        repository.listAuctionNotifications(playerId, 10),
      ]);

      return {
        auctions: auctions.map(serializeMarketAuction),
        marketFeeRate: viewerProfile.market.feeRate,
        myAuctions: myAuctions.map(serializeMarketAuction),
        notifications: notifications.map(serializeAuctionNotification),
      } satisfies MarketAuctionBookResponse;
    });

    await this.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async getOrderBook(
    playerId: string,
    filters: MarketOrderBookFilters = {},
  ): Promise<MarketOrderBookResponse> {
    const sanitizedFilters = sanitizeMarketOrderBookFilters(filters);
    const systemOfferContext = await this.resolveSystemOfferContext();

    return this.repository.withTransaction(async (repository) => {
      await this.syncSystemOffers(repository, systemOfferContext);

      const [viewerProfile, buyOrders, myOrders, sellOrders, systemOffers] = await Promise.all([
        this.universityReader.getPassiveProfile(playerId),
        repository.listOrders({
          ...sanitizedFilters,
          excludePlayerId: playerId,
          side: 'buy',
          status: 'open',
        }),
        repository.listOrders({
          ownerPlayerId: playerId,
          status: 'open',
        }),
        repository.listOrders({
          ...sanitizedFilters,
          excludePlayerId: playerId,
          side: 'sell',
          status: 'open',
        }),
        repository.listSystemOffers({
          ...sanitizedFilters,
          isActive: true,
        }),
      ]);

      const mergedSellOrders = [
        ...systemOffers
          .filter((offer) => offer.stockAvailable > 0)
          .map(serializeSystemOfferAsOrder),
        ...sellOrders.map(serializeMarketOrder),
      ].sort((left, right) => {
        if (left.pricePerUnit !== right.pricePerUnit) {
          return left.pricePerUnit - right.pricePerUnit;
        }

        return left.createdAt.localeCompare(right.createdAt);
      });

      return {
        buyOrders: buyOrders.map(serializeMarketOrder),
        marketFeeRate: viewerProfile.market.feeRate,
        myOrders: myOrders.map(serializeMarketOrder),
        npcInflation: buildNpcInflationSummary(systemOfferContext.inflationProfile),
        sellOrders: mergedSellOrders,
      };
    });
  }

  private async resolveSystemOfferContext(): Promise<{
    currentGameDay: number;
    inflationProfile: NpcInflationProfile;
    roundId: string | null;
  }> {
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog();
    const lifecycle = resolveRoundLifecycleConfig(catalog);
    const inflationProfile = await this.inflationReader.getProfile();
    const [activeRound] = await db
      .select({
        id: round.id,
        startedAt: round.startedAt,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .orderBy(desc(round.startedAt))
      .limit(1);

    if (!activeRound) {
      return {
        currentGameDay: 1,
        inflationProfile,
        roundId: null,
      };
    }

    const elapsedMs = Math.max(0, now.getTime() - activeRound.startedAt.getTime());
    const currentGameDay = Math.min(
      lifecycle.totalGameDays,
      Math.floor(elapsedMs / lifecycle.gameDayRealMs) + 1,
    );

    return {
      currentGameDay,
      inflationProfile,
      roundId: activeRound.id,
    };
  }

  private async syncSystemOffers(
    repository: MarketTransactionRepository,
    context: {
      currentGameDay: number;
      inflationProfile: NpcInflationProfile;
      roundId: string | null;
    },
  ): Promise<void> {
    const offers = await repository.listSystemOffers({
      isActive: true,
    });

    for (const offer of offers) {
      let changed = false;

      if (context.roundId && offer.lastRestockedRoundId !== context.roundId) {
        offer.stockAvailable = offer.stockMax;
        offer.lastRestockedRoundId = context.roundId;
        offer.lastRestockedGameDay = 1;
        offer.updatedAt = this.now();
        changed = true;
      } else if (context.currentGameDay > offer.lastRestockedGameDay) {
        const daysElapsed = context.currentGameDay - offer.lastRestockedGameDay;
        const cycles = Math.floor(daysElapsed / offer.restockIntervalGameDays);

        if (cycles > 0) {
          offer.stockAvailable = Math.min(
            offer.stockMax,
            offer.stockAvailable + cycles * offer.restockAmount,
          );
          offer.lastRestockedGameDay += cycles * offer.restockIntervalGameDays;
          offer.updatedAt = this.now();
          changed = true;
        }
      }

      const inflatedOfferPrice = resolveInflatedSystemOfferPrice(offer, context.inflationProfile);

      if (roundCurrency(offer.pricePerUnit) !== roundCurrency(inflatedOfferPrice)) {
        offer.pricePerUnit = inflatedOfferPrice;
        offer.updatedAt = this.now();
        changed = true;
      }

      if (changed) {
        await repository.saveSystemOffer(offer);
      }
    }
  }

  private async invalidatePlayerCaches(playerIds: Iterable<string>): Promise<void> {
    await invalidatePlayerProfileCaches(this.keyValueStore, playerIds);
  }

  private async matchOrder(
    repository: MarketTransactionRepository,
    order: MarketOrderRecord,
    cacheInvalidations: Set<string>,
  ): Promise<{
    feeTotal: number;
    matchedTrades: MarketTradeSummary[];
    order: MarketOrderRecord;
    refundedAmount: number;
  }> {
    const candidates = await repository.listOrders({
      excludePlayerId: order.playerId,
      itemId: order.itemId,
      itemType: order.itemType,
      side: order.side === 'buy' ? 'sell' : 'buy',
      status: 'open',
    });
    const eligibleCandidates = candidates.filter((candidate) =>
      order.side === 'buy'
        ? candidate.pricePerUnit <= order.pricePerUnit && candidate.remainingQuantity > 0
        : candidate.pricePerUnit >= order.pricePerUnit && candidate.remainingQuantity > 0,
    );
    const matchedTrades: MarketTradeSummary[] = [];
    let feeTotal = 0;
    let refundedAmount = 0;

    for (const candidate of eligibleCandidates) {
      if (order.remainingQuantity < 1) {
        break;
      }

      const tradeQuantity = Math.min(order.remainingQuantity, candidate.remainingQuantity);
      const tradePricePerUnit = candidate.pricePerUnit;
      const grossTotal = roundCurrency(tradeQuantity * tradePricePerUnit);
      const buyerId = order.side === 'buy' ? order.playerId : candidate.playerId;
      const sellerId = order.side === 'sell' ? order.playerId : candidate.playerId;
      const sellerOrder = order.side === 'sell' ? order : candidate;
      const sellerProfile = await this.universityReader.getPassiveProfile(sellerId);
      const marketFeeRate = resolveMarketFeeRate(sellerProfile);
      const tradeFee = roundCurrency(grossTotal * marketFeeRate);
      const sellerNetTotal = roundCurrency(grossTotal - tradeFee);

      await repository.addInventoryItem({
        durability: sellerOrder.durabilitySnapshot,
        itemId: order.itemId,
        itemType: order.itemType,
        playerId: buyerId,
        proficiency: sellerOrder.proficiencySnapshot,
        quantity: tradeQuantity,
      });
      await repository.adjustPlayerMoney(sellerId, sellerNetTotal);
      await repository.addTransaction({
        amount: sellerNetTotal,
        description: `Venda no mercado negro de ${order.itemName} (${tradeQuantity}x) com taxa de ${(marketFeeRate * 100).toFixed(0)}%.`,
        playerId: sellerId,
        type: 'market_order_sell_proceeds',
      });

      if (order.side === 'buy' && tradePricePerUnit < order.pricePerUnit) {
        const priceRefund = roundCurrency((order.pricePerUnit - tradePricePerUnit) * tradeQuantity);
        refundedAmount = roundCurrency(refundedAmount + priceRefund);
        await repository.adjustPlayerMoney(order.playerId, priceRefund);
        await repository.addTransaction({
          amount: priceRefund,
          description: `Ajuste de preco da ordem de compra de ${order.itemName}.`,
          playerId: order.playerId,
          type: 'market_order_buy_refund',
        });
      }

      order.remainingQuantity -= tradeQuantity;
      candidate.remainingQuantity -= tradeQuantity;
      order.status = order.remainingQuantity > 0 ? 'open' : 'filled';
      candidate.status = candidate.remainingQuantity > 0 ? 'open' : 'filled';

      await repository.saveOrder(candidate);
      feeTotal = roundCurrency(feeTotal + tradeFee);
      cacheInvalidations.add(buyerId);
      cacheInvalidations.add(sellerId);
      matchedTrades.push({
        buyerId,
        feeTotal: tradeFee,
        grossTotal,
        itemId: order.itemId,
        itemName: order.itemName,
        itemType: order.itemType,
        pricePerUnit: tradePricePerUnit,
        quantity: tradeQuantity,
        sellerId,
        sellerNetTotal,
      });
    }

    await repository.saveOrder(order);

    return {
      feeTotal,
      matchedTrades,
      order,
      refundedAmount,
    };
  }

  private async settleAuction(
    repository: MarketTransactionRepository,
    auction: MarketAuctionRecord,
    cacheInvalidations: Set<string>,
  ): Promise<MarketAuctionSettlementSummary> {
    if (auction.status !== 'open') {
      return {
        feeTotal: 0,
        grossTotal: 0,
        returnedToSeller: auction.status === 'expired',
        sellerNetTotal: 0,
        winnerPlayerId: auction.leadingBidderId,
      };
    }

    if (auction.leadingBidderId && auction.currentBid !== null) {
      const grossTotal = roundCurrency(auction.currentBid * auction.quantity);
      const sellerProfile = await this.universityReader.getPassiveProfile(auction.playerId);
      const marketFeeRate = resolveMarketFeeRate(sellerProfile);
      const feeTotal = roundCurrency(grossTotal * marketFeeRate);
      const sellerNetTotal = roundCurrency(grossTotal - feeTotal);

      await repository.addInventoryItem({
        durability: auction.durabilitySnapshot,
        itemId: auction.itemId,
        itemType: auction.itemType,
        playerId: auction.leadingBidderId,
        proficiency: auction.proficiencySnapshot,
        quantity: auction.quantity,
      });
      await repository.adjustPlayerMoney(auction.playerId, sellerNetTotal);
      await repository.addTransaction({
        amount: sellerNetTotal,
        description: `Leilao concluido de ${auction.itemName} com taxa de ${(marketFeeRate * 100).toFixed(0)}%.`,
        playerId: auction.playerId,
        type: 'market_auction_sell_proceeds',
      });
      await repository.createAuctionNotification({
        auctionId: auction.id,
        message: `Voce venceu o leilao de ${auction.itemName} por R$ ${grossTotal.toFixed(2)}.`,
        playerId: auction.leadingBidderId,
        title: 'Leilao vencido',
        type: 'won',
      });
      await repository.createAuctionNotification({
        auctionId: auction.id,
        message: `Seu leilao de ${auction.itemName} terminou por R$ ${grossTotal.toFixed(2)}.`,
        playerId: auction.playerId,
        title: 'Leilao concluido',
        type: 'sold',
      });

      auction.settledAt = this.now();
      auction.status = 'settled';
      await repository.saveAuction(auction);

      cacheInvalidations.add(auction.leadingBidderId);
      cacheInvalidations.add(auction.playerId);

      return {
        feeTotal,
        grossTotal,
        returnedToSeller: false,
        sellerNetTotal,
        winnerPlayerId: auction.leadingBidderId,
      };
    }

    await repository.addInventoryItem({
      durability: auction.durabilitySnapshot,
      itemId: auction.itemId,
      itemType: auction.itemType,
      playerId: auction.playerId,
      proficiency: auction.proficiencySnapshot,
      quantity: auction.quantity,
    });
    await repository.createAuctionNotification({
      auctionId: auction.id,
      message: `O leilao de ${auction.itemName} terminou sem lances e o item voltou ao inventario.`,
      playerId: auction.playerId,
      title: 'Leilao encerrado sem venda',
      type: 'returned',
    });

    auction.settledAt = this.now();
    auction.status = 'expired';
    await repository.saveAuction(auction);

    cacheInvalidations.add(auction.playerId);

    return {
      feeTotal: 0,
      grossTotal: 0,
      returnedToSeller: true,
      sellerNetTotal: 0,
      winnerPlayerId: null,
    };
  }

  private async settleExpiredAuctions(
    repository: MarketTransactionRepository,
    cacheInvalidations: Set<string>,
  ): Promise<void> {
    const openAuctions = await repository.listAuctions({
      status: 'open',
    });
    const now = this.now().getTime();

    for (const auction of openAuctions) {
      if (auction.endsAt.getTime() > now) {
        continue;
      }

      await this.settleAuction(repository, auction, cacheInvalidations);
    }
  }
}

function parseMoney(value: string): number {
  return Number.parseFloat(value);
}

function roundCurrency(value: number): number {
  return normalizeRoundedMoney(value + Number.EPSILON);
}

function resolveAuctionMinIncrement(referenceBid: number): number {
  return roundCurrency(
    Math.max(
      MARKET_AUCTION_MIN_BID_INCREMENT_FLAT,
      referenceBid * MARKET_AUCTION_MIN_BID_INCREMENT_RATE,
    ),
  );
}

function resolveMinimumAuctionBid(auction: MarketAuctionRecord): number {
  if (auction.currentBid === null) {
    return auction.startingBid;
  }

  return roundCurrency(auction.currentBid + resolveAuctionMinIncrement(auction.currentBid));
}

function resolveMarketFeeRate(
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
): number {
  return passiveProfile.market.feeRate || MARKET_ORDER_FEE_RATE;
}

function resolveInflatedSystemOfferPrice(
  offer: MarketSystemOfferRecord,
  inflationProfile: NpcInflationProfile,
): number {
  const seededOffer = MARKET_SYSTEM_OFFER_SEED.find((entry) => entry.code === offer.code);

  if (!seededOffer) {
    return offer.pricePerUnit;
  }

  return inflateNpcMoney(Number.parseFloat(seededOffer.pricePerUnit), inflationProfile);
}

function sanitizeMarketAuctionBidInput(input: MarketAuctionBidInput): MarketAuctionBidInput {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new MarketError('invalid_order', 'O lance precisa ser maior que zero.');
  }

  return {
    amount: roundCurrency(input.amount),
  };
}

function sanitizeMarketAuctionBookFilters(filters: MarketAuctionBookFilters): MarketAuctionBookFilters {
  if (!filters.itemType && !filters.itemId) {
    return {};
  }

  return {
    itemId: normalizeOptionalToken(filters.itemId),
    itemType: filters.itemType,
  };
}

function sanitizeMarketAuctionCreateInput(input: MarketAuctionCreateInput): MarketAuctionCreateInput {
  if (!MARKET_AUCTION_SUPPORTED_ITEM_TYPES.includes(input.itemType)) {
    throw new MarketError('item_not_supported', 'Leiloes aceitam apenas armas e coletes.');
  }

  const durationMinutes = normalizePositiveInteger(
    input.durationMinutes,
    MARKET_AUCTION_MIN_DURATION_MINUTES,
    MARKET_AUCTION_MAX_DURATION_MINUTES,
  );

  if (durationMinutes === null) {
    throw new MarketError('invalid_order', 'A duracao do leilao precisa ser um numero inteiro em minutos.');
  }

  const startingBid = normalizePositiveMoney(input.startingBid);

  if (startingBid === null) {
    throw new MarketError('invalid_order', 'O lance inicial precisa ser maior que zero.');
  }

  let buyoutPrice: number | null = null;
  if (input.buyoutPrice !== undefined && input.buyoutPrice !== null) {
    buyoutPrice = normalizePositiveMoney(input.buyoutPrice);

    if (buyoutPrice === null || buyoutPrice <= startingBid) {
      throw new MarketError('invalid_order', 'O valor de compra imediata deve ser maior que o lance inicial.');
    }
  }

  return {
    ...input,
    buyoutPrice,
    durationMinutes,
    inventoryItemId: input.inventoryItemId.trim(),
    itemId: input.itemId.trim(),
    startingBid,
  };
}

function sanitizeMarketOrderBookFilters(filters: MarketOrderBookFilters): MarketOrderBookFilters {
  if (!filters.itemType && !filters.itemId) {
    return {};
  }

  return {
    itemId: normalizeOptionalToken(filters.itemId),
    itemType: filters.itemType,
  };
}

function sanitizeMarketOrderInput(input: MarketOrderCreateInput): MarketOrderCreateInput {
  if (!MARKET_SUPPORTED_ITEM_TYPES.includes(input.itemType)) {
    throw new MarketError('item_not_supported', 'O mercado negro aceita apenas armas, coletes e drogas.');
  }

  const quantity = normalizePositiveInteger(input.quantity);

  if (quantity === null) {
    throw new MarketError('invalid_order', 'Quantidade da ordem deve ser um inteiro maior ou igual a 1.');
  }

  const pricePerUnit = normalizePositiveMoney(input.pricePerUnit);

  if (pricePerUnit === null) {
    throw new MarketError('invalid_order', 'Preco por unidade deve ser maior que zero.');
  }

  return {
    ...input,
    inventoryItemId: input.inventoryItemId ?? null,
    itemId: input.itemId.trim(),
    pricePerUnit,
    quantity,
    systemOfferId: normalizeOptionalToken(input.systemOfferId) ?? null,
  };
}

function serializeAuctionNotification(
  notification: MarketAuctionNotificationRecord,
): MarketAuctionNotification {
  return {
    auctionId: notification.auctionId,
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    message: notification.message,
    title: notification.title,
    type: notification.type,
  };
}

function serializeMarketAuction(auction: MarketAuctionRecord): MarketAuctionSummary {
  return {
    buyoutPrice: auction.buyoutPrice,
    createdAt: auction.createdAt.toISOString(),
    currentBid: auction.currentBid,
    endsAt: auction.endsAt.toISOString(),
    id: auction.id,
    itemId: auction.itemId,
    itemName: auction.itemName,
    itemType: auction.itemType,
    leadingBidderId: auction.leadingBidderId,
    minNextBid: resolveMinimumAuctionBid(auction),
    playerId: auction.playerId,
    quantity: auction.quantity,
    startingBid: auction.startingBid,
    status: auction.status,
  };
}

function serializeMarketOrder(order: MarketOrderRecord): MarketOrderSummary {
  return {
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    id: order.id,
    itemId: order.itemId,
    itemName: order.itemName,
    itemType: order.itemType,
    playerId: order.playerId,
    pricePerUnit: order.pricePerUnit,
    quantity: order.quantity,
    remainingQuantity: order.remainingQuantity,
    side: order.side,
    sourceLabel: order.sourceLabel,
    sourceType: order.sourceType,
    status: order.status,
    systemOfferId: order.systemOfferId,
  };
}

function serializeSystemOfferAsOrder(offer: MarketSystemOfferRecord): MarketOrderSummary {
  const createdAt = offer.updatedAt ?? offer.createdAt;
  const expiresAt = new Date(createdAt.getTime() + offer.restockIntervalGameDays * ONE_DAY_MS);

  return {
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    id: `system-offer:${offer.id}`,
    itemId: offer.itemId,
    itemName: offer.itemName,
    itemType: offer.itemType,
    playerId: 'system',
    pricePerUnit: offer.pricePerUnit,
    quantity: offer.stockMax,
    remainingQuantity: offer.stockAvailable,
    side: 'sell',
    sourceLabel: offer.label,
    sourceType: 'system',
    status: offer.isActive ? 'open' : 'cancelled',
    systemOfferId: offer.id,
  };
}

function serializeSystemOfferPurchase(input: {
  createdAt: Date;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  pricePerUnit: number;
  quantity: number;
  remainingStock: number;
  systemOfferId: string;
  systemSourceLabel: string;
}): MarketOrderSummary {
  return {
    createdAt: input.createdAt.toISOString(),
    expiresAt: input.createdAt.toISOString(),
    id: `system-purchase:${input.systemOfferId}:${input.createdAt.getTime()}`,
    itemId: input.itemId,
    itemName: input.itemName,
    itemType: input.itemType,
    playerId: 'system',
    pricePerUnit: input.pricePerUnit,
    quantity: input.quantity,
    remainingQuantity: input.remainingStock,
    side: 'sell',
    sourceLabel: input.systemSourceLabel,
    sourceType: 'system',
    status: 'filled',
    systemOfferId: input.systemOfferId,
  };
}

function toMoneyString(value: number): string {
  return roundCurrency(value).toFixed(2);
}
