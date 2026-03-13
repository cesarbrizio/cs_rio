import { type RegionId } from '@cs-rio/shared';
import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { factions, favelas, regions } from '../db/schema.js';

export interface WorldRegionDefinitionRecord {
  defaultPolicePressure: number;
  densityIndex: number;
  densityLabel: string;
  dominationBonus: string;
  id: RegionId;
  isActive: boolean;
  isDefaultSpawn: boolean;
  name: string;
  operationCostMultiplier: number;
  policePressure: number;
  sortOrder: number;
  spawnPositionX: number;
  spawnPositionY: number;
  wealthIndex: number;
  wealthLabel: string;
}

export interface WorldFavelaDefinitionRecord {
  baseBanditTarget: number;
  code: string;
  defaultSatisfaction: number;
  difficulty: number;
  id: string;
  isActive: boolean;
  maxSoldiers: number;
  name: string;
  population: number;
  regionId: RegionId;
  sortOrder: number;
}

export interface WorldFixedFactionTemplateRecord {
  abbreviation: string;
  description: string | null;
  id: string;
  initialTerritory: string | null;
  isActive: boolean;
  name: string;
  sortOrder: number;
  templateCode: string | null;
  thematicBonus: string | null;
}

export interface WorldDefinitionRepository {
  findRegion(regionId: RegionId): Promise<WorldRegionDefinitionRecord | null>;
  findSpawnRegion(): Promise<WorldRegionDefinitionRecord | null>;
  listActiveFavelas(): Promise<WorldFavelaDefinitionRecord[]>;
  listActiveRegions(): Promise<WorldRegionDefinitionRecord[]>;
  listFixedFactionTemplates(): Promise<WorldFixedFactionTemplateRecord[]>;
}

class DatabaseWorldDefinitionRepository implements WorldDefinitionRepository {
  async findRegion(regionId: RegionId): Promise<WorldRegionDefinitionRecord | null> {
    const [row] = await db
      .select({
        defaultPolicePressure: regions.defaultPolicePressure,
        densityIndex: regions.densityIndex,
        densityLabel: regions.densityLabel,
        dominationBonus: regions.dominationBonus,
        id: regions.id,
        isActive: regions.isActive,
        isDefaultSpawn: regions.isDefaultSpawn,
        name: regions.name,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        sortOrder: regions.sortOrder,
        spawnPositionX: regions.spawnPositionX,
        spawnPositionY: regions.spawnPositionY,
        wealthIndex: regions.wealthIndex,
        wealthLabel: regions.wealthLabel,
      })
      .from(regions)
      .where(eq(regions.id, regionId))
      .limit(1);

    return row ? mapRegionDefinition(row) : null;
  }

  async findSpawnRegion(): Promise<WorldRegionDefinitionRecord | null> {
    const [row] = await db
      .select({
        defaultPolicePressure: regions.defaultPolicePressure,
        densityIndex: regions.densityIndex,
        densityLabel: regions.densityLabel,
        dominationBonus: regions.dominationBonus,
        id: regions.id,
        isActive: regions.isActive,
        isDefaultSpawn: regions.isDefaultSpawn,
        name: regions.name,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        sortOrder: regions.sortOrder,
        spawnPositionX: regions.spawnPositionX,
        spawnPositionY: regions.spawnPositionY,
        wealthIndex: regions.wealthIndex,
        wealthLabel: regions.wealthLabel,
      })
      .from(regions)
      .where(eq(regions.isActive, true))
      .orderBy(desc(regions.isDefaultSpawn), asc(regions.sortOrder), asc(regions.name))
      .limit(1);

    return row ? mapRegionDefinition(row) : null;
  }

  async listActiveFavelas(): Promise<WorldFavelaDefinitionRecord[]> {
    const rows = await db
      .select({
        baseBanditTarget: favelas.baseBanditTarget,
        code: favelas.code,
        defaultSatisfaction: favelas.defaultSatisfaction,
        difficulty: favelas.difficulty,
        id: favelas.id,
        isActive: favelas.isActive,
        maxSoldiers: favelas.maxSoldiers,
        name: favelas.name,
        population: favelas.population,
        regionId: favelas.regionId,
        sortOrder: favelas.sortOrder,
      })
      .from(favelas)
      .where(eq(favelas.isActive, true))
      .orderBy(asc(favelas.sortOrder), asc(favelas.name));

    return rows.map((row) => ({
      ...row,
      regionId: row.regionId as RegionId,
    }));
  }

  async listActiveRegions(): Promise<WorldRegionDefinitionRecord[]> {
    const rows = await db
      .select({
        defaultPolicePressure: regions.defaultPolicePressure,
        densityIndex: regions.densityIndex,
        densityLabel: regions.densityLabel,
        dominationBonus: regions.dominationBonus,
        id: regions.id,
        isActive: regions.isActive,
        isDefaultSpawn: regions.isDefaultSpawn,
        name: regions.name,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        sortOrder: regions.sortOrder,
        spawnPositionX: regions.spawnPositionX,
        spawnPositionY: regions.spawnPositionY,
        wealthIndex: regions.wealthIndex,
        wealthLabel: regions.wealthLabel,
      })
      .from(regions)
      .where(eq(regions.isActive, true))
      .orderBy(asc(regions.sortOrder), asc(regions.name));

    return rows.map((row) => mapRegionDefinition(row));
  }

  async listFixedFactionTemplates(): Promise<WorldFixedFactionTemplateRecord[]> {
    const rows = await db
      .select({
        abbreviation: factions.abbreviation,
        description: factions.description,
        id: factions.id,
        initialTerritory: factions.initialTerritory,
        isActive: factions.isActive,
        name: factions.name,
        sortOrder: factions.sortOrder,
        templateCode: factions.templateCode,
        thematicBonus: factions.thematicBonus,
      })
      .from(factions)
      .where(and(eq(factions.isFixed, true), eq(factions.isActive, true)))
      .orderBy(asc(factions.sortOrder), asc(factions.name));

    return rows.map((row) => ({
      ...row,
      description: row.description ?? null,
      initialTerritory: row.initialTerritory ?? null,
      templateCode: row.templateCode ?? null,
      thematicBonus: row.thematicBonus ?? null,
    }));
  }
}

export interface WorldDefinitionServiceOptions {
  repository?: WorldDefinitionRepository;
}

export class WorldDefinitionService {
  private readonly repository: WorldDefinitionRepository;

  constructor(options: WorldDefinitionServiceOptions = {}) {
    this.repository = options.repository ?? new DatabaseWorldDefinitionRepository();
  }

  getDefaultSpawnRegion(): Promise<WorldRegionDefinitionRecord | null> {
    return this.repository.findSpawnRegion();
  }

  getRegion(regionId: RegionId): Promise<WorldRegionDefinitionRecord | null> {
    return this.repository.findRegion(regionId);
  }

  listActiveFavelas(): Promise<WorldFavelaDefinitionRecord[]> {
    return this.repository.listActiveFavelas();
  }

  listActiveRegions(): Promise<WorldRegionDefinitionRecord[]> {
    return this.repository.listActiveRegions();
  }

  listFixedFactionTemplates(): Promise<WorldFixedFactionTemplateRecord[]> {
    return this.repository.listFixedFactionTemplates();
  }
}

function mapRegionDefinition(
  row: Omit<WorldRegionDefinitionRecord, 'id' | 'operationCostMultiplier'> & {
    id: string;
    operationCostMultiplier: string | number;
  },
): WorldRegionDefinitionRecord {
  return {
    ...row,
    id: row.id as RegionId,
    operationCostMultiplier: Number.parseFloat(String(row.operationCostMultiplier)),
  };
}
