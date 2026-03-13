import { desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { round } from '../db/schema.js';

const ROUND_GAME_DAY_MS = 6 * 60 * 60 * 1000;
const ROUND_TOTAL_GAME_DAYS = 156;
const ROUND_NPC_MAX_MONEY_MULTIPLIER = 1.65;

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

function resolveRoundNpcMoneyMultiplier(currentRoundDay: number): number {
  const progress = (clamp(currentRoundDay, 1, ROUND_TOTAL_GAME_DAYS) - 1) / (ROUND_TOTAL_GAME_DAYS - 1);
  const lateGameCurve = Math.pow(progress, 1.35);

  return roundCurrency(1 + lateGameCurve * (ROUND_NPC_MAX_MONEY_MULTIPLIER - 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
