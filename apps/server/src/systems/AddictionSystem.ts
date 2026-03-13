import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';
import {
  buildTimedResourceKey,
  readTimedResourceState,
  resolveTimedBaseline,
  writeTimedResourceState,
} from './resource-state.js';

const ADDICTION_DECAY_INTERVAL_MS = 60 * 60 * 1000;
const ADDICTION_RESOURCE_KEY = 'addiction';

export interface AddictionSyncContext {
  baselineAt?: Date | string | null;
  max?: number;
}

export interface AddictionSyncResult {
  changed: boolean;
  decayedPoints: number;
  key: string;
  nextValue: number;
  previousValue: number;
}

export interface AddictionSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export class AddictionSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: AddictionSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async recordDrugUse(playerId: string): Promise<void> {
    const now = this.now();
    const key = buildTimedResourceKey(ADDICTION_RESOURCE_KEY, playerId);

    await writeTimedResourceState(this.keyValueStore, key, {
      lastDrugUseAt: now,
      lastSyncAt: now,
    });
  }

  async sync(
    playerId: string,
    currentValue: number,
    context: AddictionSyncContext = {},
  ): Promise<AddictionSyncResult> {
    const now = this.now();
    const key = buildTimedResourceKey(ADDICTION_RESOURCE_KEY, playerId);
    const max = Math.max(0, Math.round(context.max ?? 100));
    const previousValue = clamp(Math.round(currentValue), 0, max);
    const currentState = resolveTimedBaseline(
      now,
      await readTimedResourceState(this.keyValueStore, key),
      context.baselineAt,
    );

    if (previousValue <= 0) {
      await writeTimedResourceState(this.keyValueStore, key, {
        ...currentState,
        lastSyncAt: now,
      });

      return {
        changed: false,
        decayedPoints: 0,
        key,
        nextValue: 0,
        previousValue,
      };
    }

    const baseline = Math.max(currentState.lastSyncAt, currentState.lastDrugUseAt ?? 0);
    const decayedPoints = Math.floor(Math.max(0, now - baseline) / ADDICTION_DECAY_INTERVAL_MS);
    const nextValue = clamp(previousValue - decayedPoints, 0, max);
    const lastSyncAt =
      nextValue <= 0
        ? now
        : baseline + decayedPoints * ADDICTION_DECAY_INTERVAL_MS;

    await writeTimedResourceState(this.keyValueStore, key, {
      ...currentState,
      lastSyncAt,
    });

    return {
      changed: nextValue !== previousValue,
      decayedPoints: Math.max(0, previousValue - nextValue),
      key,
      nextValue,
      previousValue,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
