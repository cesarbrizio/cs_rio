import { type PlayerPrisonStatus } from '@cs-rio/shared';
import { and, desc, eq, gt } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { prisonRecords } from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from '../services/auth.js';
import { PoliceHeatSystem } from './PoliceHeatSystem.js';

export interface ActivePrisonRecord {
  allowBail: boolean;
  allowBribe: boolean;
  allowEscape: boolean;
  allowFactionRescue: boolean;
  escapeAttemptedAt: Date | null;
  id: string;
  reason: string;
  releaseAt: Date;
  sentencedAt: Date;
}

export interface PrisonSystemContract {
  close?(): Promise<void>;
  getStatus(playerId: string): Promise<PlayerPrisonStatus>;
}

export interface PrisonSystemOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
}

export async function getActivePrisonRecord(
  playerId: string,
  now: Date = new Date(),
): Promise<ActivePrisonRecord | null> {
  const [record] = await db
    .select({
      allowBail: prisonRecords.allowBail,
      allowBribe: prisonRecords.allowBribe,
      allowEscape: prisonRecords.allowEscape,
      allowFactionRescue: prisonRecords.allowFactionRescue,
      escapeAttemptedAt: prisonRecords.escapeAttemptedAt,
      id: prisonRecords.id,
      reason: prisonRecords.reason,
      releaseAt: prisonRecords.releaseAt,
      sentencedAt: prisonRecords.sentencedAt,
    })
    .from(prisonRecords)
    .where(and(eq(prisonRecords.playerId, playerId), gt(prisonRecords.releaseAt, now)))
    .orderBy(desc(prisonRecords.releaseAt))
    .limit(1);

  return record ?? null;
}

export function resolvePoliceHeatTier(score: number): PlayerPrisonStatus['heatTier'] {
  if (score >= 80) {
    return 'cacado';
  }

  if (score >= 60) {
    return 'quente';
  }

  if (score >= 40) {
    return 'marcado';
  }

  if (score >= 20) {
    return 'observado';
  }

  return 'frio';
}

export class PrisonSystem implements PrisonSystemContract {
  private readonly now: () => Date;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly policeHeatSystem: PoliceHeatSystem;

  constructor(options: PrisonSystemOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.policeHeatSystem =
      options.policeHeatSystem ??
      new PoliceHeatSystem({
        keyValueStore: options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl),
      });
  }

  async close(): Promise<void> {
    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close?.();
    }
  }

  async getStatus(playerId: string): Promise<PlayerPrisonStatus> {
    const currentTime = this.now();
    const [record, heat] = await Promise.all([
      getActivePrisonRecord(playerId, currentTime),
      this.policeHeatSystem.getHeat(playerId),
    ]);

    if (!record) {
      return {
        endsAt: null,
        heatScore: heat.score,
        heatTier: resolvePoliceHeatTier(heat.score),
        isImprisoned: false,
        reason: null,
        remainingSeconds: 0,
        sentencedAt: null,
      };
    }

    return {
      endsAt: record.releaseAt.toISOString(),
      heatScore: heat.score,
      heatTier: resolvePoliceHeatTier(heat.score),
      isImprisoned: true,
      reason: record.reason,
      remainingSeconds: Math.max(0, Math.ceil((record.releaseAt.getTime() - currentTime.getTime()) / 1000)),
      sentencedAt: record.sentencedAt.toISOString(),
    };
  }
}
