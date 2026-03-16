import { MARKET_ORDER_DEFAULT_EXPIRY_HOURS } from '@cs-rio/shared/dist/constants.js';
import {
  normalizeOptionalToken,
  normalizePositiveInteger,
  normalizePositiveMoney,
  type InventoryItemType,
} from '@cs-rio/shared';
import {
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type MarketOrderBookResponse,
  type MarketOrderCreateInput,
  type MarketOrderMutationResponse,
  type MarketOrderSummary,
  type MarketTradeSummary,
} from '@cs-rio/shared/dist/types.js';
import { desc, eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { MARKET_SYSTEM_OFFER_SEED } from '../db/seed.js';
import { round } from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import {
  MarketAuctionService,
  type MarketAuctionBookFilters,
} from './market-auction.js';
import {
  DatabaseMarketRepository,
  MarketError,
  resolveMarketFeeRate,
  roundCurrency,
  type MarketOrderRecord,
  type MarketRepository,
  type MarketSystemOfferRecord,
  type MarketTransactionRepository,
} from './market-repository.js';
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

const MARKET_SUPPORTED_ITEM_TYPES: InventoryItemType[] = ['component', 'drug', 'vest', 'weapon'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

export interface MarketOrderBookFilters {
  itemId?: string;
  itemType?: InventoryItemType;
}

export { DatabaseMarketRepository, MarketError };
export type { MarketAuctionBookFilters } from './market-auction.js';
export type { MarketRepository } from './market-repository.js';

export class MarketService implements MarketServiceContract {
  private readonly auctionService: MarketAuctionService;

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
    this.auctionService = new MarketAuctionService({
      invalidatePlayerCaches: (playerIds) => this.invalidatePlayerCaches(playerIds),
      now: this.now,
      repository: this.repository,
      universityReader: this.universityReader,
    });
  }

  async bidAuction(
    playerId: string,
    auctionId: string,
    input: MarketAuctionBidInput,
  ): Promise<MarketAuctionMutationResponse> {
    return this.auctionService.bidAuction(playerId, auctionId, input);
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

  async createAuction(
    playerId: string,
    input: MarketAuctionCreateInput,
  ): Promise<MarketAuctionMutationResponse> {
    return this.auctionService.createAuction(playerId, input);
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
    return this.auctionService.getAuctionBook(playerId, filters);
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
