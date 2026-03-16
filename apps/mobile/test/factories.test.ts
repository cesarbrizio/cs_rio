import { RegionId } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  filterFactoryRecipes,
  filterStockableComponentItems,
  formatFactoryCurrency,
  resolveFactoryStatus,
  sanitizeFactoryQuantity,
} from '../src/features/factories';

const NORMAL_SABOTAGE_STATUS = {
  blocked: false,
  operationalMultiplier: 1,
  recoveryCost: null,
  recoveryReady: false,
  recoveryReadyAt: null,
  resolvedAt: null,
  state: 'normal' as const,
};

describe('factory helpers', () => {
  it('sorts recipes by level and drug name', () => {
    const recipes = filterFactoryRecipes([
      {
        baseProduction: 4,
        cycleMinutes: 45,
        dailyMaintenanceCost: 900,
        drugId: 'drug-z',
        drugName: 'Zeta',
        levelRequired: 8,
        requirements: [],
      },
      {
        baseProduction: 2,
        cycleMinutes: 30,
        dailyMaintenanceCost: 500,
        drugId: 'drug-a',
        drugName: 'Alpha',
        levelRequired: 4,
        requirements: [],
      },
      {
        baseProduction: 3,
        cycleMinutes: 35,
        dailyMaintenanceCost: 700,
        drugId: 'drug-b',
        drugName: 'Beta',
        levelRequired: 4,
        requirements: [],
      },
    ]);

    expect(recipes.map((recipe) => recipe.drugId)).toEqual(['drug-a', 'drug-b', 'drug-z']);
  });

  it('filters stockable components for the selected factory', () => {
    const items = filterStockableComponentItems(
      [
        {
          durability: null,
          equipSlot: null,
          id: 'inventory-1',
          isEquipped: false,
          itemId: 'component-acetona',
          itemName: 'Acetona',
          itemType: 'component',
          levelRequired: 1,
          maxDurability: null,
          proficiency: 0,
          quantity: 5,
          stackable: true,
          totalWeight: 5,
          unitWeight: 1,
        },
        {
          durability: null,
          equipSlot: null,
          id: 'inventory-2',
          isEquipped: false,
          itemId: 'component-po',
          itemName: 'Po base',
          itemType: 'component',
          levelRequired: 1,
          maxDurability: null,
          proficiency: 0,
          quantity: 3,
          stackable: true,
          totalWeight: 3,
          unitWeight: 1,
        },
        {
          durability: null,
          equipSlot: null,
          id: 'inventory-3',
          isEquipped: false,
          itemId: 'drug-1',
          itemName: 'Maconha',
          itemType: 'drug',
          levelRequired: 1,
          maxDurability: null,
          proficiency: 0,
          quantity: 2,
          stackable: true,
          totalWeight: 2,
          unitWeight: 1,
        },
      ],
      {
        baseProduction: 2,
        blockedReason: null,
        createdAt: '2026-03-10T12:00:00.000Z',
        cycleMinutes: 40,
        dailyMaintenanceCost: 500,
        drugId: 'drug-cocaina',
        drugName: 'Cocaina',
        id: 'factory-1',
        maintenanceStatus: {
          blocked: false,
          moneySpentOnSync: 0,
          overdueDays: 0,
        },
        multipliers: {
          impulse: 1,
          intelligence: 1,
          universityProduction: 1,
          vocation: 1,
        },
        outputPerCycle: 2,
        regionId: RegionId.ZonaNorte,
        requirements: [
          {
            availableQuantity: 0,
            componentId: 'component-acetona',
            componentName: 'Acetona',
            quantityPerCycle: 2,
          },
        ],
        sabotageStatus: NORMAL_SABOTAGE_STATUS,
        storedOutput: 0,
      },
    );

    expect(items.map((item) => item.id)).toEqual(['inventory-1']);
  });

  it('formats status, money and quantity bounds', () => {
    expect(formatFactoryCurrency(1800)).toBe('R$\u00a01.800');
    expect(
      resolveFactoryStatus({
        baseProduction: 2,
        blockedReason: 'components',
        createdAt: '2026-03-10T12:00:00.000Z',
        cycleMinutes: 40,
        dailyMaintenanceCost: 500,
        drugId: 'drug-1',
        drugName: 'Maconha',
        id: 'factory-1',
        maintenanceStatus: {
          blocked: false,
          moneySpentOnSync: 0,
          overdueDays: 0,
        },
        multipliers: {
          impulse: 1,
          intelligence: 1,
          universityProduction: 1,
          vocation: 1,
        },
        outputPerCycle: 2,
        regionId: RegionId.ZonaNorte,
        requirements: [],
        sabotageStatus: NORMAL_SABOTAGE_STATUS,
        storedOutput: 0,
      }),
    ).toBe('Parada por falta de componentes');
    expect(sanitizeFactoryQuantity('7', 3)).toBe(3);
    expect(sanitizeFactoryQuantity('0', 5)).toBe(1);
  });
});
