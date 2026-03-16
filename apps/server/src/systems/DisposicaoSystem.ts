import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';
import {
  buildTimedResourceKey,
  readTimedResourceState,
  resolveTimedBaseline,
  writeTimedResourceState,
} from './resource-state.js';

const DISPOSICAO_INTERVAL_MS = 5 * 60 * 1000;
const DISPOSICAO_RESOURCE_KEY = 'disposicao';

export interface DisposicaoSyncContext {
  baselineAt?: Date | string | null;
  max?: number;
}

export interface DisposicaoSyncResult {
  changed: boolean;
  key: string;
  nextValue: number;
  previousValue: number;
  recoveredPoints: number;
}

export interface DisposicaoSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export class DisposicaoSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: DisposicaoSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async sync(playerId: string, currentValue: number, context: DisposicaoSyncContext = {}): Promise<DisposicaoSyncResult> {
    const now = this.now();
    const key = buildTimedResourceKey(DISPOSICAO_RESOURCE_KEY, playerId);
    const max = Math.max(1, Math.round(context.max ?? 100));
    const previousValue = clamp(Math.round(currentValue), 0, max);
    const currentState = resolveTimedBaseline(
      now,
      await readTimedResourceState(this.keyValueStore, key),
      context.baselineAt,
    );

    if (previousValue >= max) {
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

    const recoveredPoints = Math.floor(Math.max(0, now - currentState.lastSyncAt) / DISPOSICAO_INTERVAL_MS);
    const nextValue = clamp(previousValue + recoveredPoints, 0, max);
    const lastSyncAt =
      nextValue >= max
        ? now
        : currentState.lastSyncAt + recoveredPoints * DISPOSICAO_INTERVAL_MS;

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
