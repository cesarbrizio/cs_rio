import {
  BICHO_ANIMALS,
  BICHO_DRAW_INTERVAL_MINUTES,
  BICHO_MAX_BET,
  BICHO_MIN_BET,
  BICHO_PAYOUT_MULTIPLIERS,
  type BichoAnimalSummary,
  type BichoBetMode,
  type BichoBetStatus,
  type BichoCurrentDrawSummary,
  type BichoHistoryDrawSummary,
  type BichoListResponse,
  type BichoPlaceBetInput,
  type BichoPlaceBetResponse,
} from '@cs-rio/shared';
import { and, asc, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  bichoBets,
  bichoDraws,
  factions,
  players,
  transactions,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { calculateFactionPointsDelta, insertFactionBankLedgerEntry } from './faction/repository.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { roundCurrency } from './property.js';

const BICHO_FACTION_COMMISSION_RATE = 0.07;

interface BichoPlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface BichoDrawRecord {
  closesAt: Date;
  id: string;
  opensAt: Date;
  sequence: number;
  settledAt: Date | null;
  totalBetAmount: number;
  totalPayoutAmount: number;
  winningAnimalNumber: number | null;
  winningDozen: number | null;
}

interface BichoBetRecord {
  amount: number;
  animalNumber: number | null;
  dozen: number | null;
  drawId: string;
  id: string;
  mode: BichoBetMode;
  payout: number;
  placedAt: Date;
  playerId: string;
  settledAt: Date | null;
  status: BichoBetStatus;
}

interface BichoBetHistoryRecord extends BichoBetRecord {
  drawClosesAt: Date;
}

interface BichoPlaceBetRecord {
  betId: string;
  factionCommissionAmount: number;
  playerMoneyAfterBet: number;
}

interface BichoSettlementRecord {
  affectedPlayerIds: string[];
}

export interface BichoRepository {
  createDraw(input: { closesAt: Date; opensAt: Date; sequence: number }): Promise<BichoDrawRecord>;
  getCurrentDraw(opensAt: Date, closesAt: Date): Promise<BichoDrawRecord | null>;
  getLatestDraw(): Promise<BichoDrawRecord | null>;
  getPlayer(playerId: string): Promise<BichoPlayerRecord | null>;
  listBetsForDraw(drawId: string): Promise<BichoBetRecord[]>;
  listPendingDraws(now: Date): Promise<BichoDrawRecord[]>;
  listPlayerBets(playerId: string, limit: number): Promise<BichoBetHistoryRecord[]>;
  listRecentDraws(limit: number): Promise<BichoDrawRecord[]>;
  placeBet(
    playerId: string,
    input: {
      amount: number;
      animalNumber: number | null;
      drawId: string;
      dozen: number | null;
      mode: BichoBetMode;
      placedAt: Date;
    },
  ): Promise<BichoPlaceBetRecord | null>;
  settleDraw(input: {
    drawId: string;
    settledAt: Date;
    settlements: Array<{
      betId: string;
      payout: number;
      playerId: string;
      settledAt: Date;
      status: BichoBetStatus;
    }>;
    totalPayoutAmount: number;
    winningAnimalNumber: number;
    winningDozen: number;
  }): Promise<BichoSettlementRecord | null>;
}

export interface BichoServiceOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  random?: () => number;
  repository?: BichoRepository;
}

export interface BichoServiceContract {
  close?(): Promise<void>;
  listState(playerId: string): Promise<BichoListResponse>;
  placeBet(playerId: string, input: BichoPlaceBetInput): Promise<BichoPlaceBetResponse>;
}

type BichoErrorCode =
  | 'character_not_ready'
  | 'insufficient_funds'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class BichoError extends Error {
  constructor(
    public readonly code: BichoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BichoError';
  }
}

export class DatabaseBichoRepository implements BichoRepository {
  async createDraw(input: { closesAt: Date; opensAt: Date; sequence: number }): Promise<BichoDrawRecord> {
    const [createdDraw] = await db
      .insert(bichoDraws)
      .values({
        closesAt: input.closesAt,
        opensAt: input.opensAt,
        sequence: input.sequence,
      })
      .returning({
        closesAt: bichoDraws.closesAt,
        id: bichoDraws.id,
        opensAt: bichoDraws.opensAt,
        sequence: bichoDraws.sequence,
        settledAt: bichoDraws.settledAt,
        totalBetAmount: bichoDraws.totalBetAmount,
        totalPayoutAmount: bichoDraws.totalPayoutAmount,
        winningAnimalNumber: bichoDraws.winningAnimalNumber,
        winningDozen: bichoDraws.winningDozen,
      });

    if (!createdDraw) {
      throw new Error('Falha ao criar sorteio do jogo do bicho.');
    }

    return mapDrawRecord(createdDraw);
  }

  async getCurrentDraw(opensAt: Date, closesAt: Date): Promise<BichoDrawRecord | null> {
    const [draw] = await db
      .select({
        closesAt: bichoDraws.closesAt,
        id: bichoDraws.id,
        opensAt: bichoDraws.opensAt,
        sequence: bichoDraws.sequence,
        settledAt: bichoDraws.settledAt,
        totalBetAmount: bichoDraws.totalBetAmount,
        totalPayoutAmount: bichoDraws.totalPayoutAmount,
        winningAnimalNumber: bichoDraws.winningAnimalNumber,
        winningDozen: bichoDraws.winningDozen,
      })
      .from(bichoDraws)
      .where(and(eq(bichoDraws.opensAt, opensAt), eq(bichoDraws.closesAt, closesAt)))
      .limit(1);

    return draw ? mapDrawRecord(draw) : null;
  }

  async getLatestDraw(): Promise<BichoDrawRecord | null> {
    const [draw] = await db
      .select({
        closesAt: bichoDraws.closesAt,
        id: bichoDraws.id,
        opensAt: bichoDraws.opensAt,
        sequence: bichoDraws.sequence,
        settledAt: bichoDraws.settledAt,
        totalBetAmount: bichoDraws.totalBetAmount,
        totalPayoutAmount: bichoDraws.totalPayoutAmount,
        winningAnimalNumber: bichoDraws.winningAnimalNumber,
        winningDozen: bichoDraws.winningDozen,
      })
      .from(bichoDraws)
      .orderBy(desc(bichoDraws.sequence))
      .limit(1);

    return draw ? mapDrawRecord(draw) : null;
  }

  async getPlayer(playerId: string): Promise<BichoPlayerRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: roundCurrency(Number.parseFloat(String(player.money))),
    };
  }

  async listBetsForDraw(drawId: string): Promise<BichoBetRecord[]> {
    const rows = await db
      .select({
        amount: bichoBets.amount,
        animalNumber: bichoBets.animalNumber,
        dozen: bichoBets.dozen,
        drawId: bichoBets.drawId,
        id: bichoBets.id,
        mode: bichoBets.mode,
        payout: bichoBets.payout,
        placedAt: bichoBets.placedAt,
        playerId: bichoBets.playerId,
        settledAt: bichoBets.settledAt,
        status: bichoBets.status,
      })
      .from(bichoBets)
      .where(eq(bichoBets.drawId, drawId))
      .orderBy(asc(bichoBets.placedAt));

    return rows.map(mapBetRecord);
  }

  async listPendingDraws(now: Date): Promise<BichoDrawRecord[]> {
    const rows = await db
      .select({
        closesAt: bichoDraws.closesAt,
        id: bichoDraws.id,
        opensAt: bichoDraws.opensAt,
        sequence: bichoDraws.sequence,
        settledAt: bichoDraws.settledAt,
        totalBetAmount: bichoDraws.totalBetAmount,
        totalPayoutAmount: bichoDraws.totalPayoutAmount,
        winningAnimalNumber: bichoDraws.winningAnimalNumber,
        winningDozen: bichoDraws.winningDozen,
      })
      .from(bichoDraws)
      .where(and(lte(bichoDraws.closesAt, now), isNull(bichoDraws.settledAt)))
      .orderBy(asc(bichoDraws.closesAt));

    return rows.map(mapDrawRecord);
  }

  async listPlayerBets(playerId: string, limit: number): Promise<BichoBetHistoryRecord[]> {
    const rows = await db
      .select({
        amount: bichoBets.amount,
        animalNumber: bichoBets.animalNumber,
        closesAt: bichoDraws.closesAt,
        dozen: bichoBets.dozen,
        drawId: bichoBets.drawId,
        id: bichoBets.id,
        mode: bichoBets.mode,
        payout: bichoBets.payout,
        placedAt: bichoBets.placedAt,
        playerId: bichoBets.playerId,
        settledAt: bichoBets.settledAt,
        status: bichoBets.status,
      })
      .from(bichoBets)
      .innerJoin(bichoDraws, eq(bichoDraws.id, bichoBets.drawId))
      .where(eq(bichoBets.playerId, playerId))
      .orderBy(desc(bichoBets.placedAt))
      .limit(limit);

    return rows.map((row) => ({
      ...mapBetRecord(row),
      drawClosesAt: row.closesAt,
    }));
  }

  async listRecentDraws(limit: number): Promise<BichoDrawRecord[]> {
    const rows = await db
      .select({
        closesAt: bichoDraws.closesAt,
        id: bichoDraws.id,
        opensAt: bichoDraws.opensAt,
        sequence: bichoDraws.sequence,
        settledAt: bichoDraws.settledAt,
        totalBetAmount: bichoDraws.totalBetAmount,
        totalPayoutAmount: bichoDraws.totalPayoutAmount,
        winningAnimalNumber: bichoDraws.winningAnimalNumber,
        winningDozen: bichoDraws.winningDozen,
      })
      .from(bichoDraws)
      .where(isNotNull(bichoDraws.settledAt))
      .orderBy(desc(bichoDraws.settledAt), desc(bichoDraws.sequence))
      .limit(limit);

    return rows
      .map(mapDrawRecord)
      .filter((draw): draw is BichoDrawRecord & { settledAt: Date } => draw.settledAt !== null);
  }

  async placeBet(
    playerId: string,
    input: {
      amount: number;
      animalNumber: number | null;
      drawId: string;
      dozen: number | null;
      mode: BichoBetMode;
      placedAt: Date;
    },
  ): Promise<BichoPlaceBetRecord | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          factionId: players.factionId,
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);
      const [draw] = await tx
        .select({
          id: bichoDraws.id,
          totalBetAmount: bichoDraws.totalBetAmount,
        })
        .from(bichoDraws)
        .where(eq(bichoDraws.id, input.drawId))
        .limit(1);

      if (!player || !draw) {
        return null;
      }

      const playerMoneyAfterBet = roundCurrency(Number.parseFloat(String(player.money)) - input.amount);
      const factionCommissionAmount =
        player.factionId === null ? 0 : roundCurrency(input.amount * BICHO_FACTION_COMMISSION_RATE);

      await tx
        .update(players)
        .set({
          money: playerMoneyAfterBet.toFixed(2),
        })
        .where(eq(players.id, playerId));

      const [bet] = await tx
        .insert(bichoBets)
        .values({
          amount: input.amount.toFixed(2),
          animalNumber: input.animalNumber,
          dozen: input.dozen,
          drawId: input.drawId,
          mode: input.mode,
          placedAt: input.placedAt,
          playerId,
        })
        .returning({
          id: bichoBets.id,
        });

      const nextTotalBetAmount = roundCurrency(
        Number.parseFloat(String(draw.totalBetAmount)) + input.amount,
      );

      await tx
        .update(bichoDraws)
        .set({
          totalBetAmount: nextTotalBetAmount.toFixed(2),
        })
        .where(eq(bichoDraws.id, input.drawId));

      await tx.insert(transactions).values({
        amount: input.amount.toFixed(2),
        description: `Aposta no jogo do bicho ${input.mode} no sorteio ${input.drawId}`,
        playerId,
        type: 'bicho_bet',
      });

      if (factionCommissionAmount > 0 && player.factionId) {
        const [faction] = await tx
          .select({
            bankMoney: factions.bankMoney,
          })
          .from(factions)
          .where(eq(factions.id, player.factionId))
          .limit(1);

        if (faction) {
          const nextBankMoney = roundCurrency(
            Number.parseFloat(String(faction.bankMoney)) + factionCommissionAmount,
          );
          const pointsDelta = calculateFactionPointsDelta(factionCommissionAmount);

          await tx
            .update(factions)
            .set({
              bankMoney: nextBankMoney.toFixed(2),
              points: sql`${factions.points} + ${pointsDelta}`,
            })
            .where(eq(factions.id, player.factionId));

          await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
            balanceAfter: nextBankMoney,
            commissionAmount: factionCommissionAmount,
            createdAt: input.placedAt,
            description: 'Comissão automática recebida de aposta no jogo do bicho de membro.',
            entryType: 'business_commission',
            factionId: player.factionId,
            grossAmount: input.amount,
            netAmount: roundCurrency(input.amount - factionCommissionAmount),
            originType: 'bicho',
            playerId,
          });
        }
      }

      return bet
        ? {
            betId: bet.id,
            factionCommissionAmount,
            playerMoneyAfterBet,
          }
        : null;
    });
  }

  async settleDraw(input: {
    drawId: string;
    settledAt: Date;
    settlements: Array<{
      betId: string;
      payout: number;
      playerId: string;
      settledAt: Date;
      status: BichoBetStatus;
    }>;
    totalPayoutAmount: number;
    winningAnimalNumber: number;
    winningDozen: number;
  }): Promise<BichoSettlementRecord | null> {
    return db.transaction(async (tx) => {
      const [draw] = await tx
        .select({
          id: bichoDraws.id,
        })
        .from(bichoDraws)
        .where(eq(bichoDraws.id, input.drawId))
        .limit(1);

      if (!draw) {
        return null;
      }

      await tx
        .update(bichoDraws)
        .set({
          settledAt: input.settledAt,
          totalPayoutAmount: input.totalPayoutAmount.toFixed(2),
          winningAnimalNumber: input.winningAnimalNumber,
          winningDozen: input.winningDozen,
        })
        .where(eq(bichoDraws.id, input.drawId));

      const payoutsByPlayer = new Map<string, number>();

      for (const settlement of input.settlements) {
        await tx
          .update(bichoBets)
          .set({
            payout: settlement.payout.toFixed(2),
            settledAt: settlement.settledAt,
            status: settlement.status,
          })
          .where(eq(bichoBets.id, settlement.betId));

        if (settlement.payout > 0) {
          payoutsByPlayer.set(
            settlement.playerId,
            roundCurrency((payoutsByPlayer.get(settlement.playerId) ?? 0) + settlement.payout),
          );
        }
      }

      for (const [playerId, payout] of payoutsByPlayer.entries()) {
        const [player] = await tx
          .select({
            money: players.money,
          })
          .from(players)
          .where(eq(players.id, playerId))
          .limit(1);

        if (!player) {
          continue;
        }

        const nextMoney = roundCurrency(Number.parseFloat(String(player.money)) + payout);

        await tx
          .update(players)
          .set({
            money: nextMoney.toFixed(2),
          })
          .where(eq(players.id, playerId));

        await tx.insert(transactions).values({
          amount: payout.toFixed(2),
          description: `Premio do jogo do bicho no sorteio ${input.drawId}`,
          playerId,
          type: 'bicho_payout',
        });
      }

      return {
        affectedPlayerIds: [...payoutsByPlayer.keys()],
      };
    });
  }
}

export class BichoService implements BichoServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly random: () => number;

  private readonly repository: BichoRepository;

  constructor(options: BichoServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseBichoRepository();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async listState(playerId: string): Promise<BichoListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const currentDraw = await this.ensureCurrentDraw();
    const bets = await this.repository.listPlayerBets(playerId, 12);
    const recentDraws = await this.repository.listRecentDraws(6);

    return {
      animals: BICHO_ANIMALS.map((animal: BichoAnimalSummary) => ({
        ...animal,
        groupNumbers: [...animal.groupNumbers],
      })),
      bets: bets.map(serializeBetSummary),
      currentDraw: serializeCurrentDraw(currentDraw),
      factionCommission: serializeFactionCommission(player.factionId !== null, 0),
      recentDraws: recentDraws.map(serializeHistoryDraw),
    };
  }

  async placeBet(playerId: string, input: BichoPlaceBetInput): Promise<BichoPlaceBetResponse> {
    await this.requireReadyPlayer(playerId);
    validateBetInput(input);
    const currentDraw = await this.ensureCurrentDraw();
    const player = await this.requireReadyPlayer(playerId);

    if (player.money < input.amount) {
      throw new BichoError('insufficient_funds', 'Dinheiro em maos insuficiente para fazer essa aposta.');
    }

    const created = await this.repository.placeBet(playerId, {
      amount: roundCurrency(input.amount),
      animalNumber: input.mode === 'dezena' ? null : input.animalNumber ?? null,
      drawId: currentDraw.id,
      dozen: input.mode === 'dezena' ? input.dozen ?? null : null,
      mode: input.mode,
      placedAt: this.now(),
    });

    if (!created) {
      throw new BichoError('not_found', 'Sorteio atual do jogo do bicho nao encontrado.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const bets = await this.repository.listPlayerBets(playerId, 1);
    const latestBet = bets[0];

    if (!latestBet) {
      throw new BichoError('not_found', 'Aposta nao encontrada apos o registro.');
    }

    return {
      bet: serializeBetSummary(latestBet),
      currentDraw: serializeCurrentDraw(currentDraw),
      factionCommission: serializeFactionCommission(
        player.factionId !== null,
        created.factionCommissionAmount,
      ),
      playerMoneyAfterBet: created.playerMoneyAfterBet,
    };
  }

  private async ensureCurrentDraw(): Promise<BichoDrawRecord> {
    await this.settlePendingDraws();
    const { closesAt, opensAt } = resolveDrawWindow(this.now());
    const existing = await this.repository.getCurrentDraw(opensAt, closesAt);

    if (existing) {
      return existing;
    }

    const latestDraw = await this.repository.getLatestDraw();
    return this.repository.createDraw({
      closesAt,
      opensAt,
      sequence: (latestDraw?.sequence ?? 0) + 1,
    });
  }

  private async requireReadyPlayer(playerId: string): Promise<BichoPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new BichoError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new BichoError('character_not_ready', 'Crie seu personagem antes de apostar no bicho.');
    }

    return player;
  }

  private async settlePendingDraws(): Promise<void> {
    const pendingDraws = await this.repository.listPendingDraws(this.now());

    for (const draw of pendingDraws) {
      const bets = await this.repository.listBetsForDraw(draw.id);
      const winningAnimalNumber = randomIntInclusive(this.random, 1, BICHO_ANIMALS.length);
      const winningDozen = randomIntInclusive(this.random, 0, 99);
      const settledAt = this.now();
      const settlements = bets.map((bet) => {
        const payout = resolveBetPayout(bet, winningAnimalNumber, winningDozen);

        return {
          betId: bet.id,
          payout,
          playerId: bet.playerId,
          settledAt,
          status: payout > 0 ? 'won' : 'lost' as BichoBetStatus,
        };
      });
      const totalPayoutAmount = roundCurrency(
        settlements.reduce((total, settlement) => total + settlement.payout, 0),
      );
      const result = await this.repository.settleDraw({
        drawId: draw.id,
        settledAt,
        settlements,
        totalPayoutAmount,
        winningAnimalNumber,
        winningDozen,
      });

      if (!result) {
        throw new Error('Falha ao liquidar sorteio do jogo do bicho.');
      }

      for (const playerId of result.affectedPlayerIds) {
        await invalidatePlayerProfileCache(this.keyValueStore, playerId);
      }
    }
  }
}

function mapBetRecord(row: {
  amount: unknown;
  animalNumber: number | null;
  dozen: number | null;
  drawId: string;
  id: string;
  mode: BichoBetMode;
  payout: unknown;
  placedAt: Date;
  playerId: string;
  settledAt: Date | null;
  status: BichoBetStatus;
}): BichoBetRecord {
  return {
    amount: roundCurrency(Number.parseFloat(String(row.amount))),
    animalNumber: row.animalNumber,
    dozen: row.dozen,
    drawId: row.drawId,
    id: row.id,
    mode: row.mode,
    payout: roundCurrency(Number.parseFloat(String(row.payout))),
    placedAt: row.placedAt,
    playerId: row.playerId,
    settledAt: row.settledAt,
    status: row.status,
  };
}

function mapDrawRecord(row: {
  closesAt: Date;
  id: string;
  opensAt: Date;
  sequence: number;
  settledAt: Date | null;
  totalBetAmount: unknown;
  totalPayoutAmount: unknown;
  winningAnimalNumber: number | null;
  winningDozen: number | null;
}): BichoDrawRecord {
  return {
    closesAt: row.closesAt,
    id: row.id,
    opensAt: row.opensAt,
    sequence: row.sequence,
    settledAt: row.settledAt,
    totalBetAmount: roundCurrency(Number.parseFloat(String(row.totalBetAmount))),
    totalPayoutAmount: roundCurrency(Number.parseFloat(String(row.totalPayoutAmount))),
    winningAnimalNumber: row.winningAnimalNumber,
    winningDozen: row.winningDozen,
  };
}

function randomIntInclusive(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function resolveBetPayout(
  bet: Pick<BichoBetRecord, 'amount' | 'animalNumber' | 'dozen' | 'mode'>,
  winningAnimalNumber: number,
  winningDozen: number,
): number {
  if (bet.mode === 'cabeca' && bet.animalNumber === winningAnimalNumber) {
    return roundCurrency(bet.amount * BICHO_PAYOUT_MULTIPLIERS.cabeca);
  }

  if (bet.mode === 'grupo' && bet.animalNumber) {
    const animal = BICHO_ANIMALS.find(
      (entry: BichoAnimalSummary) => entry.number === bet.animalNumber,
    );

    if (animal && animal.groupNumbers.includes(winningDozen)) {
      return roundCurrency(bet.amount * BICHO_PAYOUT_MULTIPLIERS.grupo);
    }
  }

  if (bet.mode === 'dezena' && bet.dozen === winningDozen) {
    return roundCurrency(bet.amount * BICHO_PAYOUT_MULTIPLIERS.dezena);
  }

  return 0;
}

function resolveDrawWindow(now: Date): { closesAt: Date; opensAt: Date } {
  const intervalMs = BICHO_DRAW_INTERVAL_MINUTES * 60 * 1000;
  const closesAt = new Date(Math.floor(now.getTime() / intervalMs) * intervalMs + intervalMs);
  const opensAt = new Date(closesAt.getTime() - intervalMs);
  return {
    closesAt,
    opensAt,
  };
}

function serializeBetSummary(bet: BichoBetHistoryRecord) {
  return {
    amount: bet.amount,
    animalNumber: bet.animalNumber,
    dozen: bet.dozen,
    drawClosesAt: bet.drawClosesAt.toISOString(),
    drawId: bet.drawId,
    id: bet.id,
    mode: bet.mode,
    payout: bet.payout,
    placedAt: bet.placedAt.toISOString(),
    settledAt: bet.settledAt ? bet.settledAt.toISOString() : null,
    status: bet.status,
  };
}

function serializeCurrentDraw(draw: BichoDrawRecord): BichoCurrentDrawSummary {
  return {
    closesAt: draw.closesAt.toISOString(),
    id: draw.id,
    opensAt: draw.opensAt.toISOString(),
    sequence: draw.sequence,
  };
}

function serializeHistoryDraw(draw: BichoDrawRecord): BichoHistoryDrawSummary {
  if (!draw.settledAt || draw.winningAnimalNumber === null || draw.winningDozen === null) {
    throw new Error('Sorteio historico do bicho sem liquidacao completa.');
  }

  return {
    closesAt: draw.closesAt.toISOString(),
    id: draw.id,
    opensAt: draw.opensAt.toISOString(),
    sequence: draw.sequence,
    settledAt: draw.settledAt.toISOString(),
    totalBetAmount: draw.totalBetAmount,
    totalPayoutAmount: draw.totalPayoutAmount,
    winningAnimalNumber: draw.winningAnimalNumber,
    winningDozen: draw.winningDozen,
  };
}

function serializeFactionCommission(active: boolean, amount: number) {
  return {
    active,
    amount: roundCurrency(amount),
    ratePercent: Math.round(BICHO_FACTION_COMMISSION_RATE * 100),
  };
}

function validateBetInput(input: BichoPlaceBetInput): void {
  if (!Number.isFinite(input.amount) || input.amount < BICHO_MIN_BET || input.amount > BICHO_MAX_BET) {
    throw new BichoError(
      'validation',
      `A aposta deve ficar entre R$ ${BICHO_MIN_BET} e R$ ${BICHO_MAX_BET}.`,
    );
  }

  if (input.mode === 'cabeca' || input.mode === 'grupo') {
    const animalNumber = input.animalNumber;

    if (
      typeof animalNumber !== 'number'
      || !Number.isInteger(animalNumber)
      || animalNumber < 1
      || animalNumber > BICHO_ANIMALS.length
    ) {
      throw new BichoError('validation', 'Escolha um animal valido entre 1 e 25.');
    }
    return;
  }

  if (input.mode === 'dezena') {
    if (!Number.isInteger(input.dozen) || (input.dozen ?? -1) < 0 || (input.dozen ?? 100) > 99) {
      throw new BichoError('validation', 'Escolha uma dezena valida entre 00 e 99.');
    }
    return;
  }

  throw new BichoError('validation', 'Modo de aposta invalido.');
}
