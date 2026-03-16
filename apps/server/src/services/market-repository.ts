import { MARKET_ORDER_FEE_RATE } from '@cs-rio/shared/dist/constants.js';
import {
  normalizeRoundedMoney,
  type InventoryItemType,
  type MarketAuctionNotificationType,
  type MarketAuctionStatus,
  type MarketOrderSide,
  type MarketOrderStatus,
} from '@cs-rio/shared';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { db, type DatabaseExecutor } from '../db/client.js';
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
  transactions,
  vests,
  weapons,
} from '../db/schema.js';
import { DomainError, inferDomainErrorCategory } from '../errors/domain-error.js';
import type { UniversityEffectReaderContract } from './university.js';

type MarketAuctionRow = typeof marketAuctions.$inferSelect;
type MarketOrderRow = typeof marketOrders.$inferSelect;
type MarketSystemOfferRow = typeof marketSystemOffers.$inferSelect;

export interface MarketPlayerRecord {
  characterCreatedAt: Date | null;
  id: string;
  level: number;
  money: number;
}

export interface MarketItemDefinitionRecord {
  durabilityMax: number | null;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  levelRequired: number | null;
  stackable: boolean;
}

export interface MarketInventoryItemRecord {
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

export interface MarketAuctionNotificationRecord {
  auctionId: string;
  createdAt: Date;
  id: string;
  message: string;
  playerId: string;
  title: string;
  type: MarketAuctionNotificationType;
}

export interface MarketAuctionQuery {
  excludePlayerId?: string;
  itemId?: string;
  itemType?: 'vest' | 'weapon';
  playerId?: string;
  status?: MarketAuctionStatus;
}

export interface MarketAuctionRecord {
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

export interface MarketOrderQuery {
  excludePlayerId?: string;
  itemId?: string;
  itemType?: InventoryItemType;
  ownerPlayerId?: string;
  side?: MarketOrderSide;
  status?: MarketOrderStatus;
}

export interface MarketOrderRecord {
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

export interface MarketSystemOfferRecord {
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

export interface MarketTransactionRepository {
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

export type MarketErrorCode =
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

export function marketError(code: MarketErrorCode, message: string): DomainError {
  return new DomainError('market', code, inferDomainErrorCategory(code), message);
}

export class MarketError extends DomainError {
  constructor(
    code: MarketErrorCode,
    message: string,
  ) {
    super('market', code, inferDomainErrorCategory(code), message);
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
    return db.transaction(async (tx) => run(new DatabaseMarketTransactionRepository(tx)));
  }
}

class DatabaseMarketTransactionRepository implements MarketTransactionRepository {
  constructor(private readonly client: DatabaseExecutor) {}

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

export function roundCurrency(value: number): number {
  return normalizeRoundedMoney(value + Number.EPSILON);
}

export function resolveMarketFeeRate(
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
): number {
  return passiveProfile.market.feeRate || MARKET_ORDER_FEE_RATE;
}

function parseMoney(value: string): number {
  return Number.parseFloat(value);
}

function toMoneyString(value: number): string {
  return roundCurrency(value).toFixed(2);
}
