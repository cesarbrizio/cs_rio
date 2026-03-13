import { REGIONS, RegionId } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { ServerConfigService } from '../src/services/server-config.js';
import type {
  WorldFavelaDefinitionRecord,
  WorldFixedFactionTemplateRecord,
  WorldRegionDefinitionRecord,
} from '../src/services/world-definition.js';

const NOW = new Date('2026-03-12T15:00:00.000Z');

describe('ServerConfigService', () => {
  it('resolves property definitions from the active catalog with fallback fields intact', async () => {
    const service = new ServerConfigService({
      gameConfigService: {
        getResolvedCatalog: async () => ({
          activeRoundId: 'round-18',
          activeSet: {
            code: 'pre_alpha_default_2026_03',
            description: null,
            id: 'set-1',
            isDefault: true,
            name: 'Pre-Alpha',
            notes: null,
            status: 'active',
          },
          entries: [
            {
              effectiveFrom: NOW.toISOString(),
              effectiveUntil: null,
              id: 'entry-boca',
              key: 'economy.property_definition',
              notes: null,
              scope: 'property_type',
              source: 'set_entry',
              status: 'active',
              targetKey: 'boca',
              valueJson: {
                basePrice: 222_222,
                factionCommissionRate: 0.27,
              },
            },
          ],
          featureFlags: [],
        }),
      },
      now: () => NOW,
      runtimeStateRepository: {
        getVersion: async () => 0,
      },
      worldDefinitionService: createEmptyWorldDefinitionService(),
    });

    const definition = await service.getPropertyDefinition('boca');

    expect(definition.type).toBe('boca');
    expect(definition.basePrice).toBe(222_222);
    expect(definition.factionCommissionRate).toBe(0.27);
    expect(definition.assetClass).toBe('business');
  });

  it('falls back to shared regions when the database has no active region definitions', async () => {
    const service = new ServerConfigService({
      gameConfigService: {
        getResolvedCatalog: async () => ({
          activeRoundId: null,
          activeSet: null,
          entries: [],
          featureFlags: [],
        }),
      },
      now: () => NOW,
      runtimeStateRepository: {
        getVersion: async () => 0,
      },
      worldDefinitionService: createEmptyWorldDefinitionService(),
    });

    const regions = await service.listActiveRegions();
    const rooms = await service.listRealtimeRoomDefinitions();
    const spawnRegion = await service.getDefaultSpawnRegion();

    expect(regions).toHaveLength(REGIONS.length);
    expect(rooms).toHaveLength(REGIONS.length);
    expect(spawnRegion.id).toBe(RegionId.Centro);
    expect(rooms).toContainEqual({
      regionId: RegionId.ZonaSul,
      roomName: 'room_zona_sul',
    });
  });
});

function createEmptyWorldDefinitionService(): Pick<
  {
    getDefaultSpawnRegion(): Promise<WorldRegionDefinitionRecord | null>;
    getRegion(regionId: RegionId): Promise<WorldRegionDefinitionRecord | null>;
    listActiveFavelas(): Promise<WorldFavelaDefinitionRecord[]>;
    listActiveRegions(): Promise<WorldRegionDefinitionRecord[]>;
    listFixedFactionTemplates(): Promise<WorldFixedFactionTemplateRecord[]>;
  },
  'getDefaultSpawnRegion' | 'getRegion' | 'listActiveFavelas' | 'listActiveRegions' | 'listFixedFactionTemplates'
> {
  return {
    async getDefaultSpawnRegion() {
      return null;
    },
    async getRegion() {
      return null;
    },
    async listActiveFavelas() {
      return [];
    },
    async listActiveRegions() {
      return [];
    },
    async listFixedFactionTemplates() {
      return [];
    },
  };
}
