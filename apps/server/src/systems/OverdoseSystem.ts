import {
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DrugType,
  type HospitalizationReason,
  type OverdoseTrigger,
  type PlayerHospitalizationStatus,
} from '@cs-rio/shared';
import { eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { players } from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';
import { resolveHospitalCycleKey } from '../services/hospital-cycle.js';

const HOSPITALIZATION_DURATION_MS = 30 * 60 * 1000;
const HEALTH_PLAN_DURATION_MULTIPLIER = 0.25;
const HEALTH_PLAN_MAX_DURATION_MS = 45 * 60 * 1000;
const HEALTH_PLAN_MIN_DURATION_MS = 4 * 60 * 1000;
const POLY_DRUG_WINDOW_MS = 60 * 60 * 1000;
const POLY_DRUG_WINDOW_TTL_SECONDS = POLY_DRUG_WINDOW_MS / 1000;

interface HospitalizationState {
  endsAt: number;
  reason: HospitalizationReason;
  startedAt: number;
  trigger: OverdoseTrigger | null;
}

interface RecentDrugUseState {
  type: DrugType;
  usedAt: number;
}

export interface OverdoseSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export interface RecentDrugMixResult {
  distinctTypes: DrugType[];
  recentUses: DrugType[];
}

export class OverdoseSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: OverdoseSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getHospitalizationStatus(playerId: string): Promise<PlayerHospitalizationStatus> {
    const state = await this.readHospitalizationState(playerId);

    if (!state) {
      return DEFAULT_PLAYER_HOSPITALIZATION_STATUS;
    }

    const now = this.now();

    if (state.endsAt <= now) {
      await this.keyValueStore.delete?.(buildHospitalizationKey(playerId));
      return DEFAULT_PLAYER_HOSPITALIZATION_STATUS;
    }

    return {
      endsAt: new Date(state.endsAt).toISOString(),
      isHospitalized: true,
      reason: state.reason,
      remainingSeconds: Math.max(0, Math.ceil((state.endsAt - now) / 1000)),
      startedAt: new Date(state.startedAt).toISOString(),
      trigger: state.trigger,
    };
  }

  async hospitalizeForOverdose(
    playerId: string,
    trigger: OverdoseTrigger,
  ): Promise<PlayerHospitalizationStatus> {
    return this.hospitalize(playerId, {
      durationMs: HOSPITALIZATION_DURATION_MS,
      reason: 'overdose',
      trigger,
    });
  }

  async hospitalize(
    playerId: string,
    input: {
      durationMs: number;
      reason: HospitalizationReason;
      trigger?: OverdoseTrigger | null;
    },
  ): Promise<PlayerHospitalizationStatus> {
    const now = this.now();
    const durationMs = await this.resolveDurationMs(playerId, input.durationMs);
    const state: HospitalizationState = {
      endsAt: now + durationMs,
      reason: input.reason,
      startedAt: now,
      trigger: input.trigger ?? null,
    };

    await this.keyValueStore.set(
      buildHospitalizationKey(playerId),
      JSON.stringify(state),
      Math.ceil(durationMs / 1000),
    );

    return this.getHospitalizationStatus(playerId);
  }

  async clearHospitalization(playerId: string): Promise<void> {
    await this.keyValueStore.delete?.(buildHospitalizationKey(playerId));
  }

  async recordDrugUse(playerId: string, drugType: DrugType): Promise<RecentDrugMixResult> {
    const now = this.now();
    const current = await this.readRecentDrugUseState(playerId);
    const pruned = current.filter((entry) => now - entry.usedAt < POLY_DRUG_WINDOW_MS);
    const nextState = [...pruned, { type: drugType, usedAt: now }];
    const distinctTypes = Array.from(new Set(nextState.map((entry) => entry.type)));

    await this.keyValueStore.set(
      buildRecentDrugUseKey(playerId),
      JSON.stringify(nextState),
      POLY_DRUG_WINDOW_TTL_SECONDS,
    );

    return {
      distinctTypes,
      recentUses: nextState.map((entry) => entry.type),
    };
  }

  async clearRecentDrugUse(playerId: string): Promise<void> {
    await this.keyValueStore.delete?.(buildRecentDrugUseKey(playerId));
  }

  private async readHospitalizationState(playerId: string): Promise<HospitalizationState | null> {
    const rawState = await this.keyValueStore.get(buildHospitalizationKey(playerId));

    if (!rawState) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawState) as Partial<HospitalizationState>;

      if (
        typeof parsed.endsAt !== 'number' ||
        Number.isNaN(parsed.endsAt) ||
        typeof parsed.startedAt !== 'number' ||
        Number.isNaN(parsed.startedAt) ||
        !isHospitalizationReason(parsed.reason) ||
        !isHospitalizationTrigger(parsed.trigger)
      ) {
        await this.keyValueStore.delete?.(buildHospitalizationKey(playerId));
        return null;
      }

      return {
        endsAt: parsed.endsAt,
        reason: parsed.reason,
        startedAt: parsed.startedAt,
        trigger: parsed.trigger,
      };
    } catch {
      await this.keyValueStore.delete?.(buildHospitalizationKey(playerId));
      return null;
    }
  }

  private async readRecentDrugUseState(playerId: string): Promise<RecentDrugUseState[]> {
    const rawState = await this.keyValueStore.get(buildRecentDrugUseKey(playerId));

    if (!rawState) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawState) as RecentDrugUseState[];

      if (!Array.isArray(parsed)) {
        await this.keyValueStore.delete?.(buildRecentDrugUseKey(playerId));
        return [];
      }

      return parsed.filter(
        (entry): entry is RecentDrugUseState =>
          typeof entry === 'object' &&
          entry !== null &&
          isDrugType((entry as { type?: unknown }).type) &&
          typeof (entry as { usedAt?: unknown }).usedAt === 'number' &&
          !Number.isNaN((entry as { usedAt: number }).usedAt),
      );
    } catch {
      await this.keyValueStore.delete?.(buildRecentDrugUseKey(playerId));
      return [];
    }
  }

  private async resolveDurationMs(playerId: string, inputDurationMs: number): Promise<number> {
    const durationMs = Math.max(1000, Math.round(inputDurationMs));
    const cycleKey = resolveHospitalCycleKey(new Date(this.now()));
    const [player] = await db
      .select({
        healthPlanCycleKey: players.healthPlanCycleKey,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player || player.healthPlanCycleKey !== cycleKey) {
      return durationMs;
    }

    return Math.min(
      HEALTH_PLAN_MAX_DURATION_MS,
      Math.max(HEALTH_PLAN_MIN_DURATION_MS, Math.round(durationMs * HEALTH_PLAN_DURATION_MULTIPLIER)),
    );
  }
}

export function buildHospitalizationKey(playerId: string): string {
  return `player:hospitalization:${playerId}`;
}

export function buildRecentDrugUseKey(playerId: string): string {
  return `player:recent_drug_use:${playerId}`;
}

function isDrugType(value: unknown): value is DrugType {
  return typeof value === 'string' && Object.values(DrugType).includes(value as DrugType);
}

function isOverdoseTrigger(value: unknown): value is OverdoseTrigger {
  return (
    value === 'max_addiction' ||
    value === 'poly_drug_mix' ||
    value === 'stamina_overflow'
  );
}

function isHospitalizationReason(value: unknown): value is HospitalizationReason {
  return value === 'combat' || value === 'overdose';
}

function isHospitalizationTrigger(value: unknown): value is OverdoseTrigger | null {
  return value === null || isOverdoseTrigger(value);
}
