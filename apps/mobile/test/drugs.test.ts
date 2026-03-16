import { DEFAULT_PLAYER_PRISON_STATUS, LevelTitle, RegionId, VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildDrugUseWarnings,
  filterConsumableDrugItems,
  formatRemainingSeconds,
  resolveDrugCatalogEntry,
  resolveDrugRiskLevel,
} from '../src/features/drugs';

describe('drug helpers', () => {
  it('filters only usable drug inventory items in alphabetical order', () => {
    const filtered = filterConsumableDrugItems([
      {
        durability: null,
        equipSlot: null,
        id: 'inventory-2',
        isEquipped: false,
        itemId: 'uuid-2',
        itemName: 'Bala',
        itemType: 'drug',
        levelRequired: 4,
        maxDurability: null,
        proficiency: 0,
        quantity: 2,
        stackable: true,
        totalWeight: 2,
        unitWeight: 1,
      },
      {
        durability: null,
        equipSlot: null,
        id: 'inventory-1',
        isEquipped: false,
        itemId: 'uuid-1',
        itemName: 'Maconha',
        itemType: 'drug',
        levelRequired: 2,
        maxDurability: null,
        proficiency: 0,
        quantity: 4,
        stackable: true,
        totalWeight: 4,
        unitWeight: 1,
      },
      {
        durability: 90,
        equipSlot: null,
        id: 'inventory-3',
        isEquipped: false,
        itemId: 'weapon-1',
        itemName: 'Pistola',
        itemType: 'weapon',
        levelRequired: 2,
        maxDurability: 120,
        proficiency: 0,
        quantity: 1,
        stackable: false,
        totalWeight: 3,
        unitWeight: 3,
      },
    ]);

    expect(filtered.map((item) => item.itemName)).toEqual(['Bala', 'Maconha']);
  });

  it('resolves overdose warnings and high risk when cansaco can overflow', () => {
    const drug = resolveDrugCatalogEntry({
      itemId: 'ignored',
      itemName: 'Crack',
    });

    const player = {
      appearance: {
        hair: 'corte_curto',
        outfit: 'camisa_branca',
        skin: 'pele_media',
      },
      attributes: {
        carisma: 10,
        forca: 25,
        inteligencia: 20,
        resistencia: 15,
      },
      faction: null,
      hasCharacter: true,
      hospitalization: {
        endsAt: null,
        isHospitalized: false,
        reason: null,
        remainingSeconds: 0,
        startedAt: null,
        trigger: null,
      },
      id: 'player-1',
      inventory: [],
      level: 4,
      location: {
        positionX: 0,
        positionY: 0,
        regionId: RegionId.Centro,
      },
      nickname: 'Vapor_01',
      properties: [],
      prison: DEFAULT_PLAYER_PRISON_STATUS,
      regionId: RegionId.Centro,
      resources: {
        addiction: 96,
        bankMoney: 0,
        conceito: 500,
        hp: 100,
        brisa: 90,
        money: 1000,
        disposicao: 80,
        cansaco: 97,
      },
      title: LevelTitle.Vapor,
      vocation: VocationType.Gerente,
    };

    const warnings = buildDrugUseWarnings(player, drug);
    const risk = resolveDrugRiskLevel(player, drug);

    expect(warnings.some((warning) => warning.includes('ultrapassar 100'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('vício'))).toBe(true);
    expect(risk.level).toBe('high');
  });

  it('formats remaining seconds for hospitalization copy', () => {
    expect(formatRemainingSeconds(9)).toBe('9s');
    expect(formatRemainingSeconds(75)).toBe('1m 15s');
    expect(formatRemainingSeconds(3660)).toBe('1h 1m');
  });
});
