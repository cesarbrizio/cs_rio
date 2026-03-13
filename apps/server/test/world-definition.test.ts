import { RegionId } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  WorldDefinitionService,
  type WorldDefinitionRepository,
} from '../src/services/world-definition.js';

class FakeWorldDefinitionRepository implements WorldDefinitionRepository {
  constructor(
    private readonly regions: Awaited<ReturnType<WorldDefinitionService['listActiveRegions']>>,
    private readonly favelas: Awaited<ReturnType<WorldDefinitionService['listActiveFavelas']>>,
    private readonly fixedFactions: Awaited<ReturnType<WorldDefinitionService['listFixedFactionTemplates']>>,
  ) {}

  async findRegion(regionId: RegionId) {
    return this.regions.find((region) => region.id === regionId) ?? null;
  }

  async findSpawnRegion() {
    return (
      [...this.regions]
        .filter((region) => region.isActive)
        .sort((left, right) => {
          if (left.isDefaultSpawn !== right.isDefaultSpawn) {
            return left.isDefaultSpawn ? -1 : 1;
          }

          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name, 'pt-BR');
        })[0] ?? null
    );
  }

  async listActiveFavelas() {
    return this.favelas.filter((favela) => favela.isActive);
  }

  async listActiveRegions() {
    return this.regions.filter((region) => region.isActive);
  }

  async listFixedFactionTemplates() {
    return this.fixedFactions.filter((faction) => faction.isActive);
  }
}

describe('WorldDefinitionService', () => {
  it('prefers the active default spawn region from the database definition', async () => {
    const service = new WorldDefinitionService({
      repository: new FakeWorldDefinitionRepository(
        [
          buildRegion({
            id: RegionId.ZonaSul,
            isDefaultSpawn: false,
            sortOrder: 2,
          }),
          buildRegion({
            id: RegionId.Centro,
            isDefaultSpawn: true,
            sortOrder: 3,
          }),
        ],
        [],
        [],
      ),
    });

    const spawnRegion = await service.getDefaultSpawnRegion();

    expect(spawnRegion?.id).toBe(RegionId.Centro);
    expect(spawnRegion?.spawnPositionX).toBe(128);
    expect(spawnRegion?.spawnPositionY).toBe(116);
  });

  it('returns only active fixed factions and active favelas from the persisted templates', async () => {
    const service = new WorldDefinitionService({
      repository: new FakeWorldDefinitionRepository(
        [buildRegion({ id: RegionId.Centro })],
        [
          buildFavela({
            code: 'rocinha',
            isActive: true,
            sortOrder: 1,
          }),
          buildFavela({
            code: 'fantasma',
            isActive: false,
            sortOrder: 2,
          }),
        ],
        [
          buildFixedFaction({
            isActive: true,
            name: 'Comando Vermelho',
            sortOrder: 1,
            templateCode: 'cv',
          }),
          buildFixedFaction({
            isActive: false,
            name: 'Template Desativada',
            sortOrder: 2,
            templateCode: 'off',
          }),
        ],
      ),
    });

    const [favelas, fixedFactions] = await Promise.all([
      service.listActiveFavelas(),
      service.listFixedFactionTemplates(),
    ]);

    expect(favelas).toHaveLength(1);
    expect(favelas[0]).toMatchObject({
      baseBanditTarget: 50,
      code: 'rocinha',
      maxSoldiers: 36,
    });

    expect(fixedFactions).toHaveLength(1);
    expect(fixedFactions[0]).toMatchObject({
      name: 'Comando Vermelho',
      templateCode: 'cv',
    });
  });
});

function buildRegion(
  overrides: Partial<Awaited<ReturnType<WorldDefinitionService['listActiveRegions']>>[number]> & {
    id: RegionId;
  },
): Awaited<ReturnType<WorldDefinitionService['listActiveRegions']>>[number] {
  return {
    defaultPolicePressure: 70,
    densityIndex: 60,
    densityLabel: 'média',
    dominationBonus: '+20% nas receitas',
    isActive: true,
    isDefaultSpawn: false,
    name: 'Centro',
    operationCostMultiplier: 1.05,
    policePressure: 70,
    sortOrder: 1,
    spawnPositionX: 128,
    spawnPositionY: 116,
    wealthIndex: 65,
    wealthLabel: 'média',
    ...overrides,
  };
}

function buildFavela(
  overrides: Partial<Awaited<ReturnType<WorldDefinitionService['listActiveFavelas']>>[number]> & {
    code: string;
  },
): Awaited<ReturnType<WorldDefinitionService['listActiveFavelas']>>[number] {
  return {
    baseBanditTarget: 50,
    code: overrides.code,
    defaultSatisfaction: 50,
    difficulty: 7,
    id: `favela-${overrides.code}`,
    isActive: true,
    maxSoldiers: 36,
    name: 'Rocinha',
    population: 72_000,
    regionId: RegionId.ZonaSul,
    sortOrder: 1,
    ...overrides,
  };
}

function buildFixedFaction(
  overrides: Partial<Awaited<ReturnType<WorldDefinitionService['listFixedFactionTemplates']>>[number]> & {
    templateCode: string;
  },
): Awaited<ReturnType<WorldDefinitionService['listFixedFactionTemplates']>>[number] {
  return {
    abbreviation: 'TMP',
    description: 'Template fixa',
    id: `faction-${overrides.templateCode}`,
    initialTerritory: 'Favela inicial',
    isActive: true,
    name: 'Template',
    sortOrder: 1,
    templateCode: overrides.templateCode,
    thematicBonus: '+10% em operação',
    ...overrides,
  };
}
