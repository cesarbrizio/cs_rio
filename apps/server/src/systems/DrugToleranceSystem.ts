import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';

const DRUG_TOLERANCE_TTL_SECONDS = 90 * 24 * 60 * 60;
const DRUG_TOLERANCE_DECAY_INTERVAL_MS = 60 * 60 * 1000;

interface DrugToleranceState {
  current: number;
  lastSyncAt: number;
  lastUsedAt: number;
}

export interface DrugToleranceRecord {
  current: number;
  decayedBy: number;
  increasedBy: number;
  key: string;
  previous: number;
}

export interface DrugToleranceSyncResult {
  changed: boolean;
  current: number;
  decayedBy: number;
  key: string;
  previous: number;
}

export interface DrugToleranceSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export class DrugToleranceSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: DrugToleranceSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getCurrent(playerId: string, drugId: string): Promise<number> {
    const result = await this.sync(playerId, drugId);
    return result.current;
  }

  async clear(playerId: string, drugId: string): Promise<void> {
    await this.keyValueStore.delete?.(buildDrugToleranceKey(playerId, drugId));
  }

  async recordUse(playerId: string, drugId: string, increase: number): Promise<DrugToleranceRecord> {
    const now = this.now();
    const synced = await this.sync(playerId, drugId);
    const key = synced.key;
    const previous = synced.current;
    const increasedBy = clamp(Math.round(increase), 0, 100);
    const current = clamp(previous + increasedBy, 0, 100);

    await this.keyValueStore.set(
      key,
      JSON.stringify({
        current,
        lastSyncAt: now,
        lastUsedAt: now,
      } satisfies DrugToleranceState),
      DRUG_TOLERANCE_TTL_SECONDS,
    );

    return {
      current,
      decayedBy: synced.decayedBy,
      increasedBy,
      key,
      previous,
    };
  }

  async sync(playerId: string, drugId: string): Promise<DrugToleranceSyncResult> {
    const now = this.now();
    const key = buildDrugToleranceKey(playerId, drugId);
    const state = await this.readState(playerId, drugId);

    if (!state || state.current <= 0) {
      if (state) {
        await this.keyValueStore.set(
          key,
          JSON.stringify({
            current: 0,
            lastSyncAt: now,
            lastUsedAt: state.lastUsedAt,
          } satisfies DrugToleranceState),
          DRUG_TOLERANCE_TTL_SECONDS,
        );
      }

      return {
        changed: false,
        current: 0,
        decayedBy: 0,
        key,
        previous: state?.current ?? 0,
      };
    }

    const baseline = Math.max(state.lastSyncAt, state.lastUsedAt);
    const decayedBy = Math.floor(Math.max(0, now - baseline) / DRUG_TOLERANCE_DECAY_INTERVAL_MS);
    const current = clamp(state.current - decayedBy, 0, 100);
    const lastSyncAt = current <= 0 ? now : baseline + decayedBy * DRUG_TOLERANCE_DECAY_INTERVAL_MS;

    await this.keyValueStore.set(
      key,
      JSON.stringify({
        current,
        lastSyncAt,
        lastUsedAt: state.lastUsedAt,
      } satisfies DrugToleranceState),
      DRUG_TOLERANCE_TTL_SECONDS,
    );

    return {
      changed: current !== state.current,
      current,
      decayedBy: Math.max(0, state.current - current),
      key,
      previous: state.current,
    };
  }

  private async readState(playerId: string, drugId: string): Promise<DrugToleranceState | null> {
    const rawState = await this.keyValueStore.get(buildDrugToleranceKey(playerId, drugId));

    if (!rawState) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawState) as Partial<DrugToleranceState>;

      if (
        typeof parsed.current !== 'number' ||
        Number.isNaN(parsed.current) ||
        typeof parsed.lastSyncAt !== 'number' ||
        Number.isNaN(parsed.lastSyncAt) ||
        typeof parsed.lastUsedAt !== 'number' ||
        Number.isNaN(parsed.lastUsedAt)
      ) {
        return null;
      }

      return {
        current: clamp(parsed.current, 0, 100),
        lastSyncAt: parsed.lastSyncAt,
        lastUsedAt: parsed.lastUsedAt,
      };
    } catch {
      return null;
    }
  }
}

export function buildDrugToleranceKey(playerId: string, drugId: string): string {
  return `resource:drug_tolerance:${playerId}:${drugId}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
