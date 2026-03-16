import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';
import {
  buildTimedResourceKey,
  readTimedResourceState,
  resolveTimedBaseline,
  writeTimedResourceState,
} from './resource-state.js';

const HOUR_IN_MS = 60 * 60 * 1000;
const CANSACO_RESOURCE_KEY = 'cansaco';

export interface CansacoSyncContext {
  baselineAt?: Date | string | null;
  max?: number;
  recoveryPerHour?: number;
}

export interface CansacoSyncResult {
  changed: boolean;
  key: string;
  nextValue: number;
  previousValue: number;
  recoveredPoints: number;
}

export interface CansacoSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export class CansacoSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: CansacoSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async sync(
    playerId: string,
    currentValue: number,
    context: CansacoSyncContext = {},
  ): Promise<CansacoSyncResult> {
    const now = this.now();
    const key = buildTimedResourceKey(CANSACO_RESOURCE_KEY, playerId);
    const max = Math.max(1, Math.round(context.max ?? 100));
    const previousValue = clamp(Math.round(currentValue), 0, max);
    const recoveryPerHour = Math.max(0, context.recoveryPerHour ?? 12);
    const currentState = resolveTimedBaseline(
      now,
      await readTimedResourceState(this.keyValueStore, key),
      context.baselineAt,
    );

    if (previousValue >= max || recoveryPerHour === 0) {
      await writeTimedResourceState(this.keyValueStore, key, {
        ...currentState,
        lastSyncAt: now,
      });

      return {
        changed: false,
        key,
        nextValue: previousValue,
        previousValue,
        recoveredPoints: 0,
      };
    }

    const msPerPoint = HOUR_IN_MS / recoveryPerHour;
    const recoveredPoints = Math.floor(Math.max(0, now - currentState.lastSyncAt) / msPerPoint);
    const nextValue = clamp(previousValue + recoveredPoints, 0, max);
    const lastSyncAt =
      nextValue >= max
        ? now
        : currentState.lastSyncAt + recoveredPoints * msPerPoint;

    await writeTimedResourceState(this.keyValueStore, key, {
      ...currentState,
      lastSyncAt,
    });

    return {
      changed: nextValue !== previousValue,
      key,
      nextValue,
      previousValue,
      recoveredPoints: Math.max(0, nextValue - previousValue),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
