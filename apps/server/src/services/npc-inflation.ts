import type {
  NpcInflationAffectedService,
  NpcInflationScheduleEntry,
  NpcInflationSummary,
  NpcInflationTier,
} from '@cs-rio/shared';
import { desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { round } from '../db/schema.js';

export const ROUND_GAME_DAY_MS = 6 * 60 * 60 * 1000;
export const ROUND_TOTAL_GAME_DAYS = 156;
export const ROUND_NPC_MAX_MONEY_MULTIPLIER = 1.65;

const DEFAULT_AFFECTED_SERVICES: NpcInflationAffectedService[] = [
  'hospital',
  'training',
  'university',
  'black_market',
];

export interface NpcInflationProfile {
  currentRoundDay: number;
  moneyMultiplier: number;
  roundId: string | null;
}

export interface NpcInflationReaderContract {
  getProfile(): Promise<NpcInflationProfile>;
}

export class DatabaseNpcInflationReader implements NpcInflationReaderContract {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async getProfile(): Promise<NpcInflationProfile> {
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
        currentRoundDay: 1,
        moneyMultiplier: 1,
        roundId: null,
      };
    }

    const elapsedMs = Math.max(0, this.now().getTime() - activeRound.startedAt.getTime());
    const currentRoundDay = clamp(Math.floor(elapsedMs / ROUND_GAME_DAY_MS) + 1, 1, ROUND_TOTAL_GAME_DAYS);

    return {
      currentRoundDay,
      moneyMultiplier: resolveRoundNpcMoneyMultiplier(currentRoundDay),
      roundId: activeRound.id,
    };
  }
}

export class NoopNpcInflationReader implements NpcInflationReaderContract {
  async getProfile(): Promise<NpcInflationProfile> {
    return {
      currentRoundDay: 1,
      moneyMultiplier: 1,
      roundId: null,
    };
  }
}

export function inflateNpcMoney(baseAmount: number, profile: NpcInflationProfile): number {
  return roundCurrency(baseAmount * profile.moneyMultiplier);
}

export function buildNpcInflationSummary(
  profile: NpcInflationProfile,
  affectedServices: NpcInflationAffectedService[] = DEFAULT_AFFECTED_SERVICES,
): NpcInflationSummary {
  const currentGameDay = clamp(profile.currentRoundDay, 1, ROUND_TOTAL_GAME_DAYS);
  const currentMultiplier = roundCurrency(profile.moneyMultiplier);
  const roundActive = profile.roundId !== null;
  const nextIncrease = roundActive
    ? NPC_INFLATION_SCHEDULE.find(
        (entry) => entry.gameDay > currentGameDay && entry.multiplier > currentMultiplier,
      ) ?? null
    : null;

  return {
    affectedServices: [...affectedServices],
    currentGameDay,
    currentMultiplier,
    currentSurchargePercent: resolveSurchargePercent(currentMultiplier),
    gameDayDurationHours: Math.round(ROUND_GAME_DAY_MS / (60 * 60 * 1000)),
    maxMultiplier: ROUND_NPC_MAX_MONEY_MULTIPLIER,
    nextIncreaseGameDay: nextIncrease?.gameDay ?? null,
    nextIncreaseInDays: nextIncrease ? nextIncrease.gameDay - currentGameDay : null,
    nextMultiplier: nextIncrease?.multiplier ?? null,
    nextSurchargePercent: nextIncrease?.surchargePercent ?? null,
    resetsOnNewRound: true,
    roundActive,
    schedule: NPC_INFLATION_SCHEDULE,
    tier: resolveNpcInflationTier(currentMultiplier),
    totalGameDays: ROUND_TOTAL_GAME_DAYS,
  };
}

function resolveRoundNpcMoneyMultiplier(currentRoundDay: number): number {
  const progress = (clamp(currentRoundDay, 1, ROUND_TOTAL_GAME_DAYS) - 1) / (ROUND_TOTAL_GAME_DAYS - 1);
  const lateGameCurve = Math.pow(progress, 1.35);

  return roundCurrency(1 + lateGameCurve * (ROUND_NPC_MAX_MONEY_MULTIPLIER - 1));
}

function resolveNpcInflationTier(multiplier: number): NpcInflationTier {
  if (multiplier >= 1.55) {
    return 'peak';
  }

  if (multiplier >= 1.32) {
    return 'high';
  }

  if (multiplier >= 1.1) {
    return 'rising';
  }

  return 'low';
}

function resolveSurchargePercent(multiplier: number): number {
  return roundCurrency((multiplier - 1) * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const NPC_INFLATION_SCHEDULE: NpcInflationScheduleEntry[] = Array.from(
  {
    length: ROUND_TOTAL_GAME_DAYS,
  },
  (_unused, index) => {
    const gameDay = index + 1;
    const multiplier = resolveRoundNpcMoneyMultiplier(gameDay);

    return {
      gameDay,
      multiplier,
      surchargePercent: resolveSurchargePercent(multiplier),
    };
  },
);
