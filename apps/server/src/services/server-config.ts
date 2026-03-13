import {
  PROPERTY_DEFINITIONS,
  REGIONS,
  REGION_REALTIME_ROOM_NAMES,
  REGION_SPAWN_POINTS,
  RegionId,
  type FavelaServiceDefinitionSummary,
  type FavelaServiceType,
  type PropertyDefinitionSummary,
  type PropertyType,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { configRuntimeState } from '../db/schema.js';
import {
  resolveAllFavelaServiceDefinitions,
  resolveEconomyPropertyDefinition,
  resolveFavelaServiceDefinition,
  resolvePropertyEventProfile,
  resolveTerritoryPropinaPolicy,
  resolveTerritoryPropinaRegionProfile,
  type PropertyEventProfile,
  type TerritoryPropinaPolicyProfile,
  type TerritoryPropinaRegionProfile,
} from './economy-config.js';
import { GameConfigService } from './game-config.js';
import {
  WorldDefinitionService,
  type WorldFavelaDefinitionRecord,
  type WorldFixedFactionTemplateRecord,
  type WorldRegionDefinitionRecord,
} from './world-definition.js';

const FALLBACK_DEFAULT_REGION_ID = RegionId.Centro;
const DEFAULT_RUNTIME_STATE_SYNC_INTERVAL_MS = 500;
const FALLBACK_REGION_OPERATION_COST_MULTIPLIER = 1;
const FALLBACK_REGION_DEFAULT_POLICE_PRESSURE: Record<RegionId, number> = {
  [RegionId.ZonaSul]: 13,
  [RegionId.ZonaNorte]: 11,
  [RegionId.Centro]: 12,
  [RegionId.ZonaOeste]: 10,
  [RegionId.ZonaSudoeste]: 11,
  [RegionId.Baixada]: 9,
};

export interface ServerRealtimeRoomDefinition {
  regionId: RegionId;
  roomName: string;
}

export interface ConfigRuntimeStateRepository {
  getVersion(): Promise<number>;
}

class DatabaseConfigRuntimeStateRepository implements ConfigRuntimeStateRepository {
  async getVersion(): Promise<number> {
    const [state] = await db
      .select({
        version: configRuntimeState.version,
      })
      .from(configRuntimeState)
      .where(eq(configRuntimeState.singletonKey, 'global'))
      .limit(1);

    return state?.version ?? 0;
  }
}

export interface ServerConfigServiceOptions {
  gameConfigService?: Pick<GameConfigService, 'getResolvedCatalog'>;
  now?: () => Date;
  runtimeStateRepository?: ConfigRuntimeStateRepository;
  runtimeStateSyncIntervalMs?: number;
  worldDefinitionService?: Pick<
    WorldDefinitionService,
    | 'getDefaultSpawnRegion'
    | 'getRegion'
    | 'listActiveFavelas'
    | 'listActiveRegions'
    | 'listFixedFactionTemplates'
  >;
}

let localServerConfigRuntimeVersion = 0;

export function notifyServerConfigRuntimeChange(): void {
  localServerConfigRuntimeVersion += 1;
}

export class ServerConfigService {
  private readonly catalogCache = new Map<string, Promise<ResolvedGameConfigCatalog>>();

  private readonly now: () => Date;

  private readonly gameConfigService: Pick<GameConfigService, 'getResolvedCatalog'>;

  private lastRuntimeStateSyncAt = 0;

  private knownLocalRuntimeVersion = localServerConfigRuntimeVersion;

  private knownRuntimeStateVersion: number | null = null;

  private readonly runtimeStateRepository: ConfigRuntimeStateRepository;

  private readonly runtimeStateSyncIntervalMs: number;

  private activeFavelasPromise: Promise<WorldFavelaDefinitionRecord[]> | null = null;

  private activeRegionsPromise: Promise<WorldRegionDefinitionRecord[]> | null = null;

  private fixedFactionTemplatesPromise: Promise<WorldFixedFactionTemplateRecord[]> | null = null;

  private readonly worldDefinitionService: Pick<
    WorldDefinitionService,
    | 'getDefaultSpawnRegion'
    | 'getRegion'
    | 'listActiveFavelas'
    | 'listActiveRegions'
    | 'listFixedFactionTemplates'
  >;

  constructor(options: ServerConfigServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.runtimeStateRepository =
      options.runtimeStateRepository ?? new DatabaseConfigRuntimeStateRepository();
    this.runtimeStateSyncIntervalMs =
      options.runtimeStateSyncIntervalMs ?? DEFAULT_RUNTIME_STATE_SYNC_INTERVAL_MS;
    this.worldDefinitionService = options.worldDefinitionService ?? new WorldDefinitionService();
  }

  clearCaches(): void {
    this.catalogCache.clear();
    this.activeFavelasPromise = null;
    this.activeRegionsPromise = null;
    this.fixedFactionTemplatesPromise = null;
  }

  async getResolvedCatalog(options: { now?: Date; roundId?: string | null } = {}): Promise<ResolvedGameConfigCatalog> {
    await this.ensureFreshRuntimeState();
    const now = options.now ?? this.now();
    const cacheKey = buildCatalogCacheKey(options.roundId ?? null);
    const cached = this.catalogCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const pending = this.gameConfigService.getResolvedCatalog({
      now,
      roundId: options.roundId ?? null,
    });
    this.catalogCache.set(cacheKey, pending);
    return pending;
  }

  async getPropertyDefinition(
    propertyType: PropertyType,
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<PropertyDefinitionSummary> {
    const catalog = await this.getResolvedCatalog(options);
    return resolveEconomyPropertyDefinition(catalog, propertyType);
  }

  async listPropertyDefinitions(options: { now?: Date; roundId?: string | null } = {}): Promise<PropertyDefinitionSummary[]> {
    const catalog = await this.getResolvedCatalog(options);
    return PROPERTY_DEFINITIONS.map((definition) =>
      resolveEconomyPropertyDefinition(catalog, definition.type),
    );
  }

  async getPropertyEventProfile(
    propertyType: PropertyType,
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<PropertyEventProfile> {
    const catalog = await this.getResolvedCatalog(options);
    return resolvePropertyEventProfile(catalog, propertyType);
  }

  async getFavelaServiceDefinition(
    serviceType: FavelaServiceType,
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<FavelaServiceDefinitionSummary> {
    const catalog = await this.getResolvedCatalog(options);
    return resolveFavelaServiceDefinition(catalog, serviceType);
  }

  async listFavelaServiceDefinitions(
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<FavelaServiceDefinitionSummary[]> {
    const catalog = await this.getResolvedCatalog(options);
    return resolveAllFavelaServiceDefinitions(catalog);
  }

  async getTerritoryPropinaPolicy(
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<TerritoryPropinaPolicyProfile> {
    const catalog = await this.getResolvedCatalog(options);
    return resolveTerritoryPropinaPolicy(catalog);
  }

  async getTerritoryPropinaRegionProfile(
    regionId: RegionId,
    options: { now?: Date; roundId?: string | null } = {},
  ): Promise<TerritoryPropinaRegionProfile> {
    const catalog = await this.getResolvedCatalog(options);
    return resolveTerritoryPropinaRegionProfile(catalog, regionId);
  }

  async getDefaultSpawnRegion(): Promise<WorldRegionDefinitionRecord> {
    await this.ensureFreshRuntimeState();
    const region = await this.worldDefinitionService.getDefaultSpawnRegion();
    return region ?? buildFallbackRegion(FALLBACK_DEFAULT_REGION_ID);
  }

  async getRegion(regionId: RegionId): Promise<WorldRegionDefinitionRecord> {
    await this.ensureFreshRuntimeState();
    const region = await this.worldDefinitionService.getRegion(regionId);
    return region ?? buildFallbackRegion(regionId);
  }

  async listActiveRegions(): Promise<WorldRegionDefinitionRecord[]> {
    await this.ensureFreshRuntimeState();
    if (!this.activeRegionsPromise) {
      this.activeRegionsPromise = this.worldDefinitionService.listActiveRegions().then((regions) =>
        regions.length > 0 ? regions : REGIONS.map((region) => buildFallbackRegion(region.id)),
      );
    }

    return this.activeRegionsPromise;
  }

  async listActiveFavelas(): Promise<WorldFavelaDefinitionRecord[]> {
    await this.ensureFreshRuntimeState();
    if (!this.activeFavelasPromise) {
      this.activeFavelasPromise = this.worldDefinitionService.listActiveFavelas();
    }

    return this.activeFavelasPromise;
  }

  async listFixedFactionTemplates(): Promise<WorldFixedFactionTemplateRecord[]> {
    await this.ensureFreshRuntimeState();
    if (!this.fixedFactionTemplatesPromise) {
      this.fixedFactionTemplatesPromise = this.worldDefinitionService.listFixedFactionTemplates();
    }

    return this.fixedFactionTemplatesPromise;
  }

  async listRealtimeRoomDefinitions(): Promise<ServerRealtimeRoomDefinition[]> {
    const regions = await this.listActiveRegions();

    return regions
      .filter((region) => region.isActive)
      .map((region) => ({
        regionId: region.id,
        roomName: REGION_REALTIME_ROOM_NAMES[region.id] ?? `room_${region.id}`,
      }));
  }

  private async ensureFreshRuntimeState(): Promise<void> {
    if (this.knownLocalRuntimeVersion !== localServerConfigRuntimeVersion) {
      this.knownLocalRuntimeVersion = localServerConfigRuntimeVersion;
      this.clearCaches();
    }

    const nowMs = Date.now();

    if (nowMs - this.lastRuntimeStateSyncAt < this.runtimeStateSyncIntervalMs) {
      return;
    }

    this.lastRuntimeStateSyncAt = nowMs;
    const currentVersion = await this.runtimeStateRepository.getVersion();

    if (this.knownRuntimeStateVersion !== null && currentVersion !== this.knownRuntimeStateVersion) {
      this.clearCaches();
    }

    this.knownRuntimeStateVersion = currentVersion;
  }
}

function buildCatalogCacheKey(roundId: string | null): string {
  return roundId ? `round:${roundId}` : 'active';
}

function buildFallbackRegion(regionId: RegionId): WorldRegionDefinitionRecord {
  const fallback = REGIONS.find((region) => region.id === regionId);
  const fallbackSpawnPoint = REGION_SPAWN_POINTS[regionId];
  const sortOrder =
    REGIONS.findIndex((region) => region.id === regionId) >= 0
      ? REGIONS.findIndex((region) => region.id === regionId)
      : REGIONS.length;

  return {
    defaultPolicePressure: FALLBACK_REGION_DEFAULT_POLICE_PRESSURE[regionId] ?? 10,
    densityIndex: 50,
    densityLabel: fallback?.density ?? 'media',
    dominationBonus: `controle_${regionId}`,
    id: regionId,
    isActive: true,
    isDefaultSpawn: regionId === FALLBACK_DEFAULT_REGION_ID,
    name: fallback?.label ?? String(regionId),
    operationCostMultiplier: FALLBACK_REGION_OPERATION_COST_MULTIPLIER,
    policePressure: FALLBACK_REGION_DEFAULT_POLICE_PRESSURE[regionId] ?? 10,
    sortOrder,
    spawnPositionX: fallbackSpawnPoint?.positionX ?? 128,
    spawnPositionY: fallbackSpawnPoint?.positionY ?? 116,
    wealthIndex: 50,
    wealthLabel: fallback?.wealth ?? 'media',
  };
}
