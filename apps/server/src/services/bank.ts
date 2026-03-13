import {
  type PlayerBankActionResponse,
  type PlayerBankCenterResponse,
  type PlayerBankDepositInput,
  type PlayerBankEntryType,
  type PlayerBankWithdrawInput,
} from '@cs-rio/shared';
import { and, desc, eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { playerBankDailyDeposits, playerBankLedger, players } from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { buildPlayerProfileCacheKey } from './player.js';

const BANK_DAILY_DEPOSIT_LIMIT_BASE = 500_000;
const BANK_DAILY_DEPOSIT_LIMIT_PER_LEVEL = 25_000;
const BANK_DAILY_INTEREST_RATE = 0.01;
const BANK_LEDGER_LIMIT = 50;
const BANK_TIME_ZONE = 'America/Sao_Paulo';
const BANK_WITHDRAW_FEE_RATE = 0.005;

type DatabaseClient = typeof db;

interface BankPlayerRecord {
  bankInterestSyncedAt: Date;
  bankMoney: number;
  characterCreatedAt: Date | null;
  createdAt: Date;
  id: string;
  level: number;
  money: number;
}

interface BankLedgerRecord {
  balanceAfter: number;
  createdAt: Date;
  description: string;
  entryType: PlayerBankEntryType;
  feeAmount: number;
  grossAmount: number;
  id: string;
  netAmount: number;
}

interface BankServiceOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
}

export interface BankServiceContract {
  close?(): Promise<void>;
  deposit(playerId: string, input: PlayerBankDepositInput): Promise<PlayerBankActionResponse>;
  getCenter(playerId: string): Promise<PlayerBankCenterResponse>;
  withdraw(playerId: string, input: PlayerBankWithdrawInput): Promise<PlayerBankActionResponse>;
}

type BankErrorCode = 'conflict' | 'not_found' | 'unauthorized' | 'validation';

export class BankError extends Error {
  constructor(
    public readonly code: BankErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BankError';
  }
}

export class BankService implements BankServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: BankServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getCenter(playerId: string): Promise<PlayerBankCenterResponse> {
    const now = this.now();

    await db.transaction(async (tx) => {
      await syncBankInterest(tx as unknown as DatabaseClient, playerId, now);
    });

    return this.buildCenterResponse(playerId, now);
  }

  async deposit(playerId: string, input: PlayerBankDepositInput): Promise<PlayerBankActionResponse> {
    const amount = normalizeTransactionAmount(input.amount);
    const now = this.now();
    const cycleKey = resolveBankCycleKey(now);
    let interestApplied = 0;

    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;
      const syncResult = await syncBankInterest(executor, playerId, now);
      const player = syncResult.player;
      interestApplied = syncResult.interestApplied;

      ensureCharacterReady(player);

      if (player.money < amount) {
        throw new BankError('conflict', 'Dinheiro insuficiente no bolso para deposito.');
      }

      const depositedToday = await getDepositedAmountForCycle(executor, playerId, cycleKey);
      const dailyDepositLimit = resolveDailyDepositLimit(player.level);
      const remainingDepositLimit = roundCurrency(Math.max(0, dailyDepositLimit - depositedToday));

      if (amount > remainingDepositLimit) {
        throw new BankError(
          'conflict',
          `Limite diario de deposito excedido. Disponivel no dia: R$ ${remainingDepositLimit.toFixed(2)}.`,
        );
      }

      const nextPocketMoney = roundCurrency(player.money - amount);
      const nextBankMoney = roundCurrency(player.bankMoney + amount);

      await executor
        .update(players)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
          money: nextPocketMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await executor
        .insert(playerBankDailyDeposits)
        .values({
          cycleKey,
          depositedAmount: amount.toFixed(2),
          playerId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          set: {
            depositedAmount: `${roundCurrency(depositedToday + amount).toFixed(2)}`,
            updatedAt: now,
          },
          target: [playerBankDailyDeposits.playerId, playerBankDailyDeposits.cycleKey],
        });

      await insertPlayerBankLedgerEntry(executor, {
        balanceAfter: nextBankMoney,
        createdAt: now,
        description: 'Deposito realizado no banco.',
        entryType: 'deposit',
        feeAmount: 0,
        grossAmount: amount,
        netAmount: amount,
        playerId,
      });
    });

    return this.buildActionResponse(playerId, {
      bankMoneyDelta: amount,
      feePaid: 0,
      interestApplied,
      message: `Deposito de R$ ${amount.toFixed(2)} realizado com sucesso.`,
      pocketMoneyDelta: -amount,
    });
  }

  async withdraw(playerId: string, input: PlayerBankWithdrawInput): Promise<PlayerBankActionResponse> {
    const amount = normalizeTransactionAmount(input.amount);
    const now = this.now();
    let interestApplied = 0;
    let feePaid = 0;
    let netWithdraw = 0;

    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;
      const syncResult = await syncBankInterest(executor, playerId, now);
      const player = syncResult.player;
      interestApplied = syncResult.interestApplied;

      ensureCharacterReady(player);

      if (player.bankMoney < amount) {
        throw new BankError('conflict', 'Saldo insuficiente no banco para saque.');
      }

      feePaid = roundCurrency(amount * BANK_WITHDRAW_FEE_RATE);
      netWithdraw = roundCurrency(amount - feePaid);

      const nextPocketMoney = roundCurrency(player.money + netWithdraw);
      const nextBankMoney = roundCurrency(player.bankMoney - amount);

      await executor
        .update(players)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
          money: nextPocketMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await insertPlayerBankLedgerEntry(executor, {
        balanceAfter: nextBankMoney,
        createdAt: now,
        description: 'Saque realizado no banco.',
        entryType: 'withdrawal',
        feeAmount: feePaid,
        grossAmount: amount,
        netAmount: netWithdraw,
        playerId,
      });
    });

    return this.buildActionResponse(playerId, {
      bankMoneyDelta: -amount,
      feePaid,
      interestApplied,
      message: `Saque de R$ ${amount.toFixed(2)} realizado com taxa de R$ ${feePaid.toFixed(2)}.`,
      pocketMoneyDelta: netWithdraw,
    });
  }

  private async buildActionResponse(
    playerId: string,
    input: {
      bankMoneyDelta: number;
      feePaid: number;
      interestApplied: number;
      message: string;
      pocketMoneyDelta: number;
    },
  ): Promise<PlayerBankActionResponse> {
    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const bank = await this.getCenter(playerId);

    return {
      bank,
      bankMoneyDelta: roundCurrency(input.bankMoneyDelta),
      feePaid: roundCurrency(input.feePaid),
      interestApplied: roundCurrency(input.interestApplied),
      message: input.message,
      pocketMoneyDelta: roundCurrency(input.pocketMoneyDelta),
    };
  }

  private async buildCenterResponse(playerId: string, now: Date): Promise<PlayerBankCenterResponse> {
    const [player, ledger, depositedToday] = await Promise.all([
      getBankPlayerOrThrow(db, playerId),
      listPlayerBankLedger(db, playerId, BANK_LEDGER_LIMIT),
      getDepositedAmountForCycle(db, playerId, resolveBankCycleKey(now)),
    ]);

    ensureCharacterReady(player);

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);

    const dailyDepositLimit = resolveDailyDepositLimit(player.level);

    return {
      bankMoney: roundCurrency(player.bankMoney),
      dailyDepositLimit,
      dailyInterestRatePercent: BANK_DAILY_INTEREST_RATE * 100,
      depositedToday,
      ledger: ledger.map((entry) => ({
        balanceAfter: entry.balanceAfter,
        createdAt: entry.createdAt.toISOString(),
        description: entry.description,
        entryType: entry.entryType,
        feeAmount: entry.feeAmount,
        grossAmount: entry.grossAmount,
        id: entry.id,
        netAmount: entry.netAmount,
      })),
      pocketMoney: roundCurrency(player.money),
      protection: {
        fromDeathLoss: true,
        fromPoliceSeizure: true,
        fromPvpLoot: true,
      },
      remainingDepositLimit: roundCurrency(Math.max(0, dailyDepositLimit - depositedToday)),
      syncedAt: now.toISOString(),
      withdrawFeeRatePercent: BANK_WITHDRAW_FEE_RATE * 100,
    };
  }
}

async function getBankPlayerOrThrow(
  executor: DatabaseClient,
  playerId: string,
): Promise<BankPlayerRecord> {
  const [player] = await executor
    .select({
      bankInterestSyncedAt: players.bankInterestSyncedAt,
      bankMoney: players.bankMoney,
      characterCreatedAt: players.characterCreatedAt,
      createdAt: players.createdAt,
      id: players.id,
      level: players.level,
      money: players.money,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    throw new BankError('unauthorized', 'Jogador nao encontrado.');
  }

  return {
    bankInterestSyncedAt: player.bankInterestSyncedAt,
    bankMoney: roundCurrency(Number.parseFloat(String(player.bankMoney))),
    characterCreatedAt: player.characterCreatedAt,
    createdAt: player.createdAt,
    id: player.id,
    level: player.level,
    money: roundCurrency(Number.parseFloat(String(player.money))),
  };
}

async function getDepositedAmountForCycle(
  executor: DatabaseClient,
  playerId: string,
  cycleKey: string,
): Promise<number> {
  const [row] = await executor
    .select({
      depositedAmount: playerBankDailyDeposits.depositedAmount,
    })
    .from(playerBankDailyDeposits)
    .where(
      and(
        eq(playerBankDailyDeposits.playerId, playerId),
        eq(playerBankDailyDeposits.cycleKey, cycleKey),
      ),
    )
    .limit(1);

  return roundCurrency(Number.parseFloat(String(row?.depositedAmount ?? '0')));
}

async function insertPlayerBankLedgerEntry(
  executor: DatabaseClient,
  input: {
    balanceAfter: number;
    createdAt: Date;
    description: string;
    entryType: PlayerBankEntryType;
    feeAmount: number;
    grossAmount: number;
    netAmount: number;
    playerId: string;
  },
): Promise<void> {
  await executor.insert(playerBankLedger).values({
    balanceAfter: input.balanceAfter.toFixed(2),
    createdAt: input.createdAt,
    description: input.description,
    entryType: input.entryType,
    feeAmount: input.feeAmount.toFixed(2),
    grossAmount: input.grossAmount.toFixed(2),
    netAmount: input.netAmount.toFixed(2),
    playerId: input.playerId,
  });
}

async function invalidatePlayerProfileCache(keyValueStore: KeyValueStore, playerId: string): Promise<void> {
  await keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));
}

async function listPlayerBankLedger(
  executor: DatabaseClient,
  playerId: string,
  limit: number,
): Promise<BankLedgerRecord[]> {
  const rows = await executor
    .select({
      balanceAfter: playerBankLedger.balanceAfter,
      createdAt: playerBankLedger.createdAt,
      description: playerBankLedger.description,
      entryType: playerBankLedger.entryType,
      feeAmount: playerBankLedger.feeAmount,
      grossAmount: playerBankLedger.grossAmount,
      id: playerBankLedger.id,
      netAmount: playerBankLedger.netAmount,
    })
    .from(playerBankLedger)
    .where(eq(playerBankLedger.playerId, playerId))
    .orderBy(desc(playerBankLedger.createdAt), desc(playerBankLedger.id))
    .limit(limit);

  return rows.map((row) => ({
    balanceAfter: roundCurrency(Number.parseFloat(String(row.balanceAfter))),
    createdAt: row.createdAt,
    description: row.description,
    entryType: row.entryType,
    feeAmount: roundCurrency(Number.parseFloat(String(row.feeAmount))),
    grossAmount: roundCurrency(Number.parseFloat(String(row.grossAmount))),
    id: row.id,
    netAmount: roundCurrency(Number.parseFloat(String(row.netAmount))),
  }));
}

function ensureCharacterReady(player: BankPlayerRecord): void {
  if (!player.characterCreatedAt) {
    throw new BankError('conflict', 'Personagem ainda nao foi criado.');
  }
}

function normalizeTransactionAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BankError('validation', 'Valor invalido para a operacao bancaria.');
  }

  const normalized = roundCurrency(value);

  if (normalized <= 0) {
    throw new BankError('validation', 'Valor invalido para a operacao bancaria.');
  }

  return normalized;
}

function resolveBankCycleKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function resolveDailyDepositLimit(level: number): number {
  return BANK_DAILY_DEPOSIT_LIMIT_BASE + Math.max(0, level - 1) * BANK_DAILY_DEPOSIT_LIMIT_PER_LEVEL;
}

async function syncBankInterest(
  executor: DatabaseClient,
  playerId: string,
  now: Date,
): Promise<{
  interestApplied: number;
  player: BankPlayerRecord;
}> {
  const player = await getBankPlayerOrThrow(executor, playerId);
  const lastCycleKey = resolveBankCycleKey(player.bankInterestSyncedAt ?? player.createdAt);
  const currentCycleKey = resolveBankCycleKey(now);
  const elapsedDays = resolveElapsedBankDays(lastCycleKey, currentCycleKey);

  if (elapsedDays <= 0) {
    return {
      interestApplied: 0,
      player,
    };
  }

  let nextBankMoney = player.bankMoney;
  let interestApplied = 0;

  for (let index = 0; index < elapsedDays; index += 1) {
    const dailyInterest = roundCurrency(nextBankMoney * BANK_DAILY_INTEREST_RATE);
    interestApplied = roundCurrency(interestApplied + dailyInterest);
    nextBankMoney = roundCurrency(nextBankMoney + dailyInterest);
  }

  await executor
    .update(players)
    .set({
      bankInterestSyncedAt: now,
      bankMoney: nextBankMoney.toFixed(2),
    })
    .where(eq(players.id, playerId));

  if (interestApplied > 0) {
    const label = elapsedDays === 1 ? '1 dia' : `${elapsedDays} dias`;

    await insertPlayerBankLedgerEntry(executor, {
      balanceAfter: nextBankMoney,
      createdAt: now,
      description: `Juros diarios aplicados sobre o saldo (${label}).`,
      entryType: 'interest',
      feeAmount: 0,
      grossAmount: interestApplied,
      netAmount: interestApplied,
      playerId,
    });
  }

  return {
    interestApplied,
    player: {
      ...player,
      bankInterestSyncedAt: now,
      bankMoney: nextBankMoney,
    },
  };
}

function resolveElapsedBankDays(fromCycleKey: string, toCycleKey: string): number {
  const fromDate = parseCycleKeyAsUtc(fromCycleKey);
  const toDate = parseCycleKeyAsUtc(toCycleKey);
  return Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000));
}

function parseCycleKeyAsUtc(cycleKey: string): Date {
  const [year, month, day] = cycleKey.split('-').map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return new Date(Date.UTC(1970, 0, 1));
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
