import {
  MARKET_AUCTION_MAX_DURATION_MINUTES,
  MARKET_AUCTION_MIN_BID_INCREMENT_FLAT,
  MARKET_AUCTION_MIN_BID_INCREMENT_RATE,
  MARKET_AUCTION_MIN_DURATION_MINUTES,
} from '@cs-rio/shared/dist/constants.js';
import {
  normalizeOptionalToken,
  normalizePositiveInteger,
  normalizePositiveMoney,
} from '@cs-rio/shared';
import {
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type MarketAuctionNotification,
  type MarketAuctionSettlementSummary,
  type MarketAuctionSummary,
} from '@cs-rio/shared/dist/types.js';

import type {
  MarketAuctionNotificationRecord,
  MarketAuctionRecord,
  MarketRepository,
  MarketTransactionRepository,
} from './market-repository.js';
import {
  MarketError,
  resolveMarketFeeRate,
  roundCurrency,
} from './market-repository.js';
import type { UniversityEffectReaderContract } from './university.js';

const MARKET_AUCTION_SUPPORTED_ITEM_TYPES: Array<'vest' | 'weapon'> = ['vest', 'weapon'];

export interface MarketAuctionBookFilters {
  itemId?: string;
  itemType?: 'vest' | 'weapon';
}

export interface MarketAuctionServiceOptions {
  invalidatePlayerCaches(playerIds: Iterable<string>): Promise<void>;
  now: () => Date;
  repository: MarketRepository;
  universityReader: UniversityEffectReaderContract;
}

export class MarketAuctionService {
  constructor(private readonly options: MarketAuctionServiceOptions) {}

  async bidAuction(
    playerId: string,
    auctionId: string,
    input: MarketAuctionBidInput,
  ): Promise<MarketAuctionMutationResponse> {
    const sanitizedInput = sanitizeMarketAuctionBidInput(input);
    const cacheInvalidations = new Set<string>();

    const result = await this.options.repository.withTransaction(async (repository) => {
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

      if (auction.status !== 'open' || auction.endsAt.getTime() <= this.options.now().getTime()) {
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

    await this.options.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async createAuction(
    playerId: string,
    input: MarketAuctionCreateInput,
  ): Promise<MarketAuctionMutationResponse> {
    const now = this.options.now();
    const sanitizedInput = sanitizeMarketAuctionCreateInput(input);
    const cacheInvalidations = new Set<string>([playerId]);

    const result = await this.options.repository.withTransaction(async (repository) => {
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

    await this.options.invalidatePlayerCaches(cacheInvalidations);
    return result;
  }

  async getAuctionBook(
    playerId: string,
    filters: MarketAuctionBookFilters = {},
  ): Promise<MarketAuctionBookResponse> {
    const cacheInvalidations = new Set<string>();

    const result = await this.options.repository.withTransaction(async (repository) => {
      await this.settleExpiredAuctions(repository, cacheInvalidations);
      const sanitizedFilters = sanitizeMarketAuctionBookFilters(filters);
      const [viewerProfile, auctions, myAuctions, notifications] = await Promise.all([
        this.options.universityReader.getPassiveProfile(playerId),
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

    await this.options.invalidatePlayerCaches(cacheInvalidations);
    return result;
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
      const sellerProfile = await this.options.universityReader.getPassiveProfile(auction.playerId);
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

      auction.settledAt = this.options.now();
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

    auction.settledAt = this.options.now();
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
    const now = this.options.now().getTime();

    for (const auction of openAuctions) {
      if (auction.endsAt.getTime() > now) {
        continue;
      }

      await this.settleAuction(repository, auction, cacheInvalidations);
    }
  }
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
