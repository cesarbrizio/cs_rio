import {
  type CrimeAttemptResponse,
  type CrimeCatalogResponse,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogResponse,
} from '@cs-rio/shared';

import { env } from '../config/env.js';
import { CooldownSystem } from '../systems/CooldownSystem.js';
import {
  CrimeError,
  CrimeSystem,
  type CrimeRepository,
} from '../systems/CrimeSystem.js';
import {
  DatabaseFactionCrimeRepository,
  FactionCrimeSystem,
  type FactionCrimeRepository,
} from '../systems/FactionCrimeSystem.js';
import { PoliceHeatSystem } from '../systems/PoliceHeatSystem.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { type FactionUpgradeEffectReaderContract } from './faction.js';
import { buildPlayerProfileCacheKey } from './player.js';
import { type UniversityEffectReaderContract } from './university.js';

export interface CrimeServiceOptions {
  crimeSystem?: CrimeSystem;
  factionCrimeRepository?: FactionCrimeRepository;
  factionCrimeSystem?: FactionCrimeSystem;
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  keyValueStore?: KeyValueStore;
  repository?: CrimeRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface CrimeServiceContract {
  attemptFactionCrime(
    playerId: string,
    factionId: string,
    crimeId: string,
    input: FactionCrimeAttemptInput,
  ): Promise<FactionCrimeAttemptResponse>;
  close?(): Promise<void>;
  attemptCrime(playerId: string, crimeId: string): Promise<CrimeAttemptResponse>;
  getFactionCatalog(playerId: string, factionId: string): Promise<FactionCrimeCatalogResponse>;
  getCatalog(playerId: string): Promise<CrimeCatalogResponse>;
}

export class CrimeService implements CrimeServiceContract {
  private readonly crimeSystem: CrimeSystem;

  private readonly factionCrimeSystem: FactionCrimeSystem;

  private readonly keyValueStore: KeyValueStore;

  private readonly ownsCrimeSystem: boolean;

  private readonly ownsFactionCrimeSystem: boolean;

  private readonly ownsKeyValueStore: boolean;

  constructor(options: CrimeServiceOptions = {}) {
    this.ownsCrimeSystem = !options.crimeSystem;
    this.ownsFactionCrimeSystem = !options.factionCrimeSystem;
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.crimeSystem =
      options.crimeSystem ??
      new CrimeSystem({
        cooldownSystem: new CooldownSystem({
          keyValueStore: this.keyValueStore,
        }),
        factionUpgradeReader: options.factionUpgradeReader,
        policeHeatSystem: new PoliceHeatSystem({
          keyValueStore: this.keyValueStore,
        }),
        repository: options.repository,
        universityReader: options.universityReader,
      });
    this.factionCrimeSystem =
      options.factionCrimeSystem ??
      new FactionCrimeSystem({
        cooldownSystem: new CooldownSystem({
          keyValueStore: this.keyValueStore,
        }),
        factionUpgradeReader: options.factionUpgradeReader,
        repository: options.factionCrimeRepository ?? new DatabaseFactionCrimeRepository(),
      });
  }

  async close(): Promise<void> {
    if (this.ownsCrimeSystem) {
      await this.crimeSystem.close();
    }

    if (this.ownsFactionCrimeSystem) {
      await this.factionCrimeSystem.close();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async attemptCrime(playerId: string, crimeId: string): Promise<CrimeAttemptResponse> {
    const result = await this.crimeSystem.attemptCrime(playerId, crimeId);
    await this.keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));
    return result;
  }

  async attemptFactionCrime(
    playerId: string,
    factionId: string,
    crimeId: string,
    input: FactionCrimeAttemptInput,
  ): Promise<FactionCrimeAttemptResponse> {
    const result = await this.factionCrimeSystem.attemptCrime(playerId, factionId, crimeId, input);
    await Promise.all(
      result.participants.map((participant) =>
        this.keyValueStore.delete?.(buildPlayerProfileCacheKey(participant.id)),
      ),
    );
    return result;
  }

  async getCatalog(playerId: string): Promise<CrimeCatalogResponse> {
    const crimes = await this.crimeSystem.getCrimeCatalog(playerId);
    return { crimes };
  }

  async getFactionCatalog(playerId: string, factionId: string): Promise<FactionCrimeCatalogResponse> {
    return this.factionCrimeSystem.getCatalog(playerId, factionId);
  }
}

export { CrimeError };
