import { RegionId, type OwnedPropertySummary, PROPERTY_DEFINITIONS } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildPuteiroAcquisitionState,
  buildPuteiroDashboardSnapshot,
  buildSlotMachineAcquisitionState,
  countOperationalAlerts,
  countReadyOperations,
  filterPropertiesByTab,
  resolveOperationsTabDescription,
  resolveOperationsTabLabel,
  resolvePropertyOperationSnapshot,
  resolvePropertyAssetClassLabel,
  resolvePropertyUtilityLines,
  sumCollectableCash,
  sumPropertyDailyUpkeep,
  type OperationsDashboardData,
} from '../src/features/operations';

const NORMAL_SABOTAGE_STATUS = {
  blocked: false,
  operationalMultiplier: 1,
  recoveryCost: null,
  recoveryReady: false,
  recoveryReadyAt: null,
  resolvedAt: null,
  state: 'normal' as const,
};

describe('operations helpers', () => {
  it('splits business and patrimony properties while summing daily upkeep', () => {
    const boca = buildOwnedProperty('boca');
    const mansion = buildOwnedProperty('mansion');

    expect(filterPropertiesByTab([boca, mansion], 'business').map((property) => property.type)).toEqual(['boca']);
    expect(filterPropertiesByTab([boca, mansion], 'patrimony').map((property) => property.type)).toEqual(['mansion']);
    expect(resolveOperationsTabLabel('business')).toBe('Operações');
    expect(resolveOperationsTabLabel('patrimony')).toBe('Base e logística');
    expect(resolveOperationsTabDescription('business')).toContain('giram caixa');
    expect(resolveOperationsTabDescription('patrimony')).toContain('mobilidade');
    expect(sumPropertyDailyUpkeep([boca, mansion])).toBe(2200);
  });

  it('builds slot machine acquisition state from the authoritative property catalog', () => {
    const slotMachineDefinition = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'slot_machine');

    if (!slotMachineDefinition) {
      throw new Error('slot_machine definition not found');
    }

    const state = buildSlotMachineAcquisitionState({
      availableProperties: [slotMachineDefinition],
      ownedProperties: [],
      playerLevel: 6,
      playerMoney: 120_000,
      playerRegionId: RegionId.Centro,
    });

    expect(state.canPurchase).toBe(true);
    expect(state.blockerLabel).toBeNull();
    expect(state.purchaseInput).toEqual({
      regionId: RegionId.Centro,
      type: 'slot_machine',
    });
    expect(state.currentRegionLabel).toBe('Centro');
    expect(state.baseCapacity).toBe(5);
    expect(state.estimatedHourlyRevenueAtCapacity).toBeGreaterThan(state.estimatedHourlyRevenueAtBase);
  });

  it('blocks slot machine acquisition when the player is not ready yet', () => {
    const slotMachineDefinition = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'slot_machine');

    if (!slotMachineDefinition) {
      throw new Error('slot_machine definition not found');
    }

    const lockedState = buildSlotMachineAcquisitionState({
      availableProperties: [slotMachineDefinition],
      ownedProperties: [],
      playerLevel: 4,
      playerMoney: 10_000,
      playerRegionId: RegionId.Centro,
    });

    expect(lockedState.canPurchase).toBe(false);
    expect(lockedState.blockerLabel).toContain('Nível 5 necessário');

    const ownedState = buildSlotMachineAcquisitionState({
      availableProperties: [slotMachineDefinition],
      ownedProperties: [buildOwnedProperty('slot_machine')],
      playerLevel: 8,
      playerMoney: 200_000,
      playerRegionId: RegionId.Centro,
    });

    expect(ownedState.canPurchase).toBe(false);
    expect(ownedState.ownedCount).toBe(1);
    expect(ownedState.blockerLabel).toContain('já possui uma maquininha');
  });

  it('describes patrimonial utility and counts operational pressure', () => {
    const beachHouse = buildOwnedProperty('beach_house', {
      protection: { invasionRisk: 24, robberyRisk: 26, takeoverRisk: 0 },
    });
    const car = buildOwnedProperty('car', {
      maintenanceStatus: { blocked: true },
      protection: { invasionRisk: 12, robberyRisk: 36, takeoverRisk: 0 },
    });

    expect(resolvePropertyUtilityLines(beachHouse.definition)).toContain('+8 slots no inventário');
    expect(resolvePropertyUtilityLines(car.definition)).toContain('Mobilidade terrestre');
    expect(resolvePropertyAssetClassLabel(beachHouse.definition)).toBe('Imóvel');
    expect(countOperationalAlerts([beachHouse, car])).toBe(1);
  });

  it('builds puteiro acquisition state from the authoritative catalog and templates', () => {
    const puteiroDefinition = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'puteiro');

    if (!puteiroDefinition) {
      throw new Error('puteiro definition not found');
    }

    const state = buildPuteiroAcquisitionState({
      availableProperties: [puteiroDefinition],
      gpTemplates: [
        {
          baseDailyRevenue: 1800,
          label: 'Novinha',
          purchasePrice: 2200,
          cansacoRestorePercent: 0.08,
          type: 'novinha',
        },
        {
          baseDailyRevenue: 4200,
          label: 'Vip',
          purchasePrice: 7000,
          cansacoRestorePercent: 0.18,
          type: 'vip',
        },
      ],
      ownedProperties: [],
      playerLevel: 6,
      playerMoney: 120_000,
      playerRegionId: RegionId.Centro,
    });

    expect(state.canPurchase).toBe(true);
    expect(state.purchaseInput).toEqual({
      regionId: RegionId.Centro,
      type: 'puteiro',
    });
    expect(state.capacity).toBe(5);
    expect(state.entryTemplate?.type).toBe('novinha');
    expect(state.estimatedHourlyRevenueAtCapacity).toBeGreaterThan(state.estimatedHourlyRevenueAtEntry);
    expect(state.currentRegionLabel).toBe('Centro');
  });

  it('builds a dedicated puteiro dashboard snapshot and collect snapshot', () => {
    const puteiro = buildOwnedProperty('puteiro');
    const summary = buildPuteiroSummary(puteiro.id);
    const dashboard: OperationsDashboardData = {
      bocaBook: {
        bocas: [],
      },
      factoryBook: {
        availableRecipes: [],
        factories: [],
      },
      frontStoreBook: {
        frontStores: [],
        kinds: [],
      },
      propertyBook: {
        availableProperties: [],
        ownedProperties: [puteiro],
        soldierTemplates: [],
      },
      puteiroBook: {
        puteiros: [summary],
        templates: [
          {
            baseDailyRevenue: 1800,
            label: 'Novinha',
            purchasePrice: 2200,
            cansacoRestorePercent: 0.08,
            type: 'novinha',
          },
        ],
      },
      raveBook: {
        raves: [],
      },
      slotMachineBook: {
        slotMachines: [],
      },
    };

    const puteiroSnapshot = buildPuteiroDashboardSnapshot(summary);
    const operationSnapshot = resolvePropertyOperationSnapshot(puteiro, dashboard);

    expect(puteiroSnapshot.operatingHeadline).toContain('ainda com vagas abertas');
    expect(puteiroSnapshot.workerStatusSummary).toContain('2 ativas');
    expect(puteiroSnapshot.incidentSummary).toContain('DST ativas nas GPs 1');
    expect(operationSnapshot?.readyToCollect).toBe(true);
    expect(operationSnapshot?.detailLines).toContain('GPs ativos: 2/5');
    expect(sumCollectableCash(dashboard)).toBe(9800);
    expect(countReadyOperations(dashboard)).toBe(1);
  });

  it('builds collect snapshots and counts ready operations', () => {
    const boca = buildOwnedProperty('boca');
    const factory = buildOwnedProperty('factory');
    const dashboard: OperationsDashboardData = {
      bocaBook: {
        bocas: [
          {
            cashbox: {
              availableToCollect: 5400,
              grossRevenueLifetime: 15000,
              lastCollectedAt: null,
              lastSaleAt: '2026-03-10T13:00:00.000Z',
              totalFactionCommission: 648,
            },
            economics: {
              cycleMinutes: 60,
              effectiveFactionCommissionRate: 0.12,
              estimatedHourlyGrossRevenue: 2700,
              locationMultiplier: 1.15,
              npcDemandPerCycle: 18,
              profitable: true,
            },
            favelaId: 'favela-centro-1',
            id: boca.id,
            level: 1,
            maintenanceStatus: {
              blocked: false,
              lastMaintenanceAt: '2026-03-10T12:00:00.000Z',
              moneySpentOnSync: 0,
              overdueDays: 0,
            },
            regionId: RegionId.Centro,
            sabotageStatus: NORMAL_SABOTAGE_STATUS,
            status: 'active',
            stock: [],
            stockUnits: 45,
          },
        ],
      },
      factoryBook: {
        availableRecipes: [],
        factories: [
          {
            baseProduction: 3,
            blockedReason: null,
            createdAt: '2026-03-10T11:00:00.000Z',
            cycleMinutes: 45,
            dailyMaintenanceCost: 900,
            drugId: 'drug-cocaina',
            drugName: 'Cocaina',
            id: factory.id,
            maintenanceStatus: {
              blocked: false,
              moneySpentOnSync: 0,
              overdueDays: 0,
            },
            multipliers: {
              impulse: 1.1,
              intelligence: 1.2,
              universityProduction: 1,
              vocation: 1,
            },
            outputPerCycle: 4,
            regionId: RegionId.Centro,
            requirements: [],
            sabotageStatus: NORMAL_SABOTAGE_STATUS,
            storedOutput: 8,
          },
        ],
      },
      frontStoreBook: {
        frontStores: [],
        kinds: [],
      },
      propertyBook: {
        availableProperties: [],
        ownedProperties: [boca, factory],
        soldierTemplates: [],
      },
      puteiroBook: {
        puteiros: [],
        templates: [],
      },
      raveBook: {
        raves: [],
      },
      slotMachineBook: {
        slotMachines: [],
      },
    };

    const bocaSnapshot = resolvePropertyOperationSnapshot(boca, dashboard);
    const factorySnapshot = resolvePropertyOperationSnapshot(factory, dashboard);

    expect(bocaSnapshot?.readyToCollect).toBe(true);
    expect(bocaSnapshot?.collectTone).toBe('cash');
    expect(factorySnapshot?.collectTone).toBe('inventory');
    expect(factorySnapshot?.collectableLabel).toBe('8x Cocaina');
    expect(sumCollectableCash(dashboard)).toBe(5400);
    expect(countReadyOperations(dashboard)).toBe(2);
  });
});

function buildOwnedProperty(
  type: OwnedPropertySummary['type'],
  overrides: Partial<{
    economics: Partial<OwnedPropertySummary['economics']>;
    maintenanceStatus: Partial<OwnedPropertySummary['maintenanceStatus']>;
    protection: Partial<OwnedPropertySummary['protection']>;
  }> = {},
): OwnedPropertySummary {
  const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === type);

  if (!definition) {
    throw new Error(`Property definition not found for ${type}`);
  }

  return {
    createdAt: '2026-03-10T12:00:00.000Z',
    definition,
    economics: {
      effectiveFactionCommissionRate: definition.factionCommissionRate,
      profitable: definition.profitable,
      totalDailyUpkeep: definition.baseDailyMaintenanceCost,
      ...overrides.economics,
    },
    favelaId: null,
    id: `property-${type}`,
    level: 1,
    maintenanceStatus: {
      blocked: false,
      lastMaintenanceAt: '2026-03-10T12:00:00.000Z',
      moneySpentOnSync: 0,
      overdueDays: 0,
      ...overrides.maintenanceStatus,
    },
    protection: {
      defenseScore: definition.baseProtectionScore,
      factionProtectionActive: false,
      invasionRisk: 20,
      robberyRisk: 20,
      soldiersPower: 0,
      takeoverRisk: definition.profitable ? 12 : 0,
      territoryControlRatio: 0,
      territoryTier: 'none',
      ...overrides.protection,
    },
    regionId: RegionId.Centro,
    sabotageStatus: NORMAL_SABOTAGE_STATUS,
    soldierRoster: [],
    soldiersCount: 0,
    status: 'active',
    type,
  };
}

function buildPuteiroSummary(propertyId: string) {
  return {
    cashbox: {
      availableToCollect: 9800,
      grossRevenueLifetime: 21000,
      lastCollectedAt: null,
      lastRevenueAt: '2026-03-10T15:00:00.000Z',
      totalFactionCommission: 1176,
    },
    economics: {
      activeGps: 2,
      availableSlots: 3,
      capacity: 5,
      charismaMultiplier: 1.2,
      cycleMinutes: 60,
      effectiveFactionCommissionRate: 0.12,
      estimatedHourlyGrossRevenue: 410,
      locationMultiplier: 1.3,
      profitable: true,
    },
    favelaId: 'favela-centro-1',
    id: propertyId,
    incidents: {
      activeDstCases: 1,
      totalDeaths: 0,
      totalDstIncidents: 2,
      totalEscapes: 1,
    },
    level: 1,
    maintenanceStatus: {
      blocked: false,
      lastMaintenanceAt: '2026-03-10T12:00:00.000Z',
      moneySpentOnSync: 0,
      overdueDays: 0,
    },
    regionId: RegionId.Centro,
    roster: [
      {
        baseDailyRevenue: 2400,
        dstRecoversAt: null,
        hasDst: false,
        hourlyGrossRevenueEstimate: 120,
        id: 'gp-1',
        incidentRisk: {
          deathChancePerCycle: 0.01,
          dstChancePerCycle: 0.03,
          escapeChancePerCycle: 0.02,
        },
        label: 'Novinha',
        lastIncidentAt: null,
        purchasePrice: 2200,
        cansacoRestorePercent: 0.08,
        status: 'active' as const,
        type: 'novinha' as const,
      },
      {
        baseDailyRevenue: 5400,
        dstRecoversAt: '2026-03-11T12:00:00.000Z',
        hasDst: true,
        hourlyGrossRevenueEstimate: 290,
        id: 'gp-2',
        incidentRisk: {
          deathChancePerCycle: 0.02,
          dstChancePerCycle: 0.05,
          escapeChancePerCycle: 0.04,
        },
        label: 'Vip',
        lastIncidentAt: '2026-03-10T11:00:00.000Z',
        purchasePrice: 7000,
        cansacoRestorePercent: 0.18,
        status: 'active' as const,
        type: 'vip' as const,
      },
      {
        baseDailyRevenue: 1800,
        dstRecoversAt: null,
        hasDst: false,
        hourlyGrossRevenueEstimate: 0,
        id: 'gp-3',
        incidentRisk: {
          deathChancePerCycle: 0.01,
          dstChancePerCycle: 0.02,
          escapeChancePerCycle: 0.06,
        },
        label: 'Experiente',
        lastIncidentAt: '2026-03-09T11:00:00.000Z',
        purchasePrice: 3200,
        cansacoRestorePercent: 0.1,
        status: 'escaped' as const,
        type: 'experiente' as const,
      },
    ],
    sabotageStatus: NORMAL_SABOTAGE_STATUS,
    status: 'active' as const,
  };
}
