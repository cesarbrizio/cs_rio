import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';

const HEAT_DECAY_INTERVAL_MS = 5 * 60 * 1000;
const HEAT_DECAY_INTERVAL_SECONDS = HEAT_DECAY_INTERVAL_MS / 1000;

interface StoredHeatRecord {
  lastCrimeAt: number;
  score: number;
}

export interface PoliceHeatState {
  decayedPoints: number;
  key: string;
  lastCrimeAt: string | null;
  nextDecayAt: string | null;
  score: number;
}

export interface PoliceHeatSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export function buildPoliceHeatKey(playerId: string): string {
  return `heat:${playerId}`;
}

export class PoliceHeatSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: PoliceHeatSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async addHeat(playerId: string, amount: number): Promise<PoliceHeatState> {
    const key = buildPoliceHeatKey(playerId);
    const normalizedAmount = Math.max(0, Math.round(amount));
    const currentState = await this.readHeatRecord(key);
    const currentScore = currentState ? deriveCurrentScore(currentState, this.now()) : 0;
    const nextScore = currentScore + normalizedAmount;
    const now = this.now();

    if (nextScore > 0) {
      await this.keyValueStore.set(
        key,
        JSON.stringify({
          lastCrimeAt: now,
          score: nextScore,
        } satisfies StoredHeatRecord),
        Math.ceil(nextScore * HEAT_DECAY_INTERVAL_SECONDS),
      );
    }

    return {
      decayedPoints: currentState ? Math.max(0, currentState.score - currentScore) : 0,
      key,
      lastCrimeAt: nextScore > 0 ? new Date(now).toISOString() : null,
      nextDecayAt: nextScore > 0 ? new Date(now + HEAT_DECAY_INTERVAL_MS).toISOString() : null,
      score: nextScore,
    };
  }

  async getHeat(playerId: string): Promise<PoliceHeatState> {
    const key = buildPoliceHeatKey(playerId);
    const record = await this.readHeatRecord(key);

    if (!record) {
      return {
        decayedPoints: 0,
        key,
        lastCrimeAt: null,
        nextDecayAt: null,
        score: 0,
      };
    }

    return buildHeatState(key, record, this.now());
  }

  private async readHeatRecord(key: string): Promise<StoredHeatRecord | null> {
    const rawValue = await this.keyValueStore.get(key);

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredHeatRecord>;

      if (
        typeof parsed.lastCrimeAt !== 'number' ||
        Number.isNaN(parsed.lastCrimeAt) ||
        typeof parsed.score !== 'number' ||
        Number.isNaN(parsed.score)
      ) {
        return null;
      }

      return {
        lastCrimeAt: parsed.lastCrimeAt,
        score: Math.max(0, Math.round(parsed.score)),
      };
    } catch {
      return null;
    }
  }
}

function buildHeatState(key: string, record: StoredHeatRecord, now: number): PoliceHeatState {
  const decayedPoints = Math.floor(Math.max(0, now - record.lastCrimeAt) / HEAT_DECAY_INTERVAL_MS);
  const score = Math.max(0, record.score - decayedPoints);

  return {
    decayedPoints: Math.min(record.score, decayedPoints),
    key,
    lastCrimeAt: score > 0 ? new Date(record.lastCrimeAt).toISOString() : null,
    nextDecayAt:
      score > 0
        ? new Date(record.lastCrimeAt + (decayedPoints + 1) * HEAT_DECAY_INTERVAL_MS).toISOString()
        : null,
    score,
  };
}

function deriveCurrentScore(record: StoredHeatRecord, now: number): number {
  return buildHeatState('heat', record, now).score;
}
