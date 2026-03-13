import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';

const SECOND_IN_MS = 1000;

interface StoredCooldownRecord {
  expiresAt: number;
}

export interface CrimeCooldownState {
  active: boolean;
  expiresAt: string | null;
  key: string;
  remainingSeconds: number;
}

export interface CooldownSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => number;
}

export function buildCrimeCooldownKey(playerId: string, crimeId: string): string {
  return `crime:${playerId}:${crimeId}`;
}

export class CooldownSystem {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => number;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: CooldownSystemOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => Date.now());
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async activateCrimeCooldown(
    playerId: string,
    crimeId: string,
    cooldownSeconds: number,
  ): Promise<CrimeCooldownState> {
    const key = buildCrimeCooldownKey(playerId, crimeId);

    if (cooldownSeconds <= 0) {
      return buildCooldownState(key, this.now(), this.now());
    }

    const expiresAt = this.now() + cooldownSeconds * SECOND_IN_MS;

    await this.keyValueStore.set(key, JSON.stringify({ expiresAt } satisfies StoredCooldownRecord), cooldownSeconds);

    return buildCooldownState(key, expiresAt, this.now());
  }

  async getCrimeCooldown(playerId: string, crimeId: string): Promise<CrimeCooldownState> {
    const key = buildCrimeCooldownKey(playerId, crimeId);
    const record = await this.readCooldownRecord(key);

    if (!record) {
      return buildCooldownState(key, this.now(), this.now());
    }

    return buildCooldownState(key, record.expiresAt, this.now());
  }

  async isCrimeOnCooldown(playerId: string, crimeId: string): Promise<boolean> {
    const cooldown = await this.getCrimeCooldown(playerId, crimeId);
    return cooldown.active;
  }

  private async readCooldownRecord(key: string): Promise<StoredCooldownRecord | null> {
    const rawValue = await this.keyValueStore.get(key);

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredCooldownRecord>;

      if (typeof parsed.expiresAt !== 'number' || Number.isNaN(parsed.expiresAt)) {
        return null;
      }

      return {
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }
}

function buildCooldownState(
  key: string,
  expiresAt: number,
  now: number,
): CrimeCooldownState {
  const remainingMs = expiresAt - now;
  const active = remainingMs > 0;

  return {
    active,
    expiresAt: active ? new Date(expiresAt).toISOString() : null,
    key,
    remainingSeconds: active ? Math.ceil(remainingMs / SECOND_IN_MS) : 0,
  };
}
