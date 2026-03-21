import { type PlayerInventoryItem } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildInventoryBenefitLines,
  resolveInventoryItemPresentation,
  resolveInventoryItemTypeLabel,
} from '../src/features/inventory';

describe('inventory helpers', () => {
  it('marks broken equipment for repair and blocks low-level equips', () => {
    const brokenWeapon: PlayerInventoryItem = {
      durability: 0,
      equipSlot: null,
      equipment: {
        defense: null,
        power: 18,
        slot: 'weapon',
      },
      id: 'inventory-1',
      isEquipped: false,
      itemId: 'weapon-1',
      itemName: 'Pistola de treino',
      itemType: 'weapon',
      levelRequired: 2,
      maxDurability: 100,
      proficiency: 6,
      quantity: 1,
      stackable: false,
      totalWeight: 3,
      unitWeight: 3,
    };
    const lockedVest: PlayerInventoryItem = {
      durability: 80,
      equipSlot: null,
      equipment: {
        defense: 10,
        power: null,
        slot: 'vest',
      },
      id: 'inventory-2',
      isEquipped: false,
      itemId: 'vest-1',
      itemName: 'Colete pesado',
      itemType: 'vest',
      levelRequired: 8,
      maxDurability: 100,
      proficiency: 0,
      quantity: 1,
      stackable: false,
      totalWeight: 4,
      unitWeight: 4,
    };

    expect(resolveInventoryItemPresentation(brokenWeapon, 5)).toMatchObject({
      primaryAction: {
        disabledReason: null,
        kind: 'repair',
        label: 'Reparar',
      },
      statusLabel: 'Quebrado',
      statusTone: 'danger',
    });
    expect(resolveInventoryItemPresentation(lockedVest, 4)).toMatchObject({
      primaryAction: {
        disabledReason: 'Requer nivel 8.',
        kind: 'equip',
        label: 'Equipar',
      },
      statusLabel: 'Nivel 8 necessario',
      statusTone: 'warning',
    });
  });

  it('describes weapon and vest benefits using the real combat formulas', () => {
    const weapon: PlayerInventoryItem = {
      durability: 50,
      equipSlot: null,
      equipment: {
        defense: null,
        power: 22,
        slot: 'weapon',
      },
      id: 'inventory-weapon',
      isEquipped: false,
      itemId: 'weapon-2',
      itemName: 'Submetralhadora',
      itemType: 'weapon',
      levelRequired: 4,
      maxDurability: 80,
      proficiency: 0,
      quantity: 1,
      stackable: false,
      totalWeight: 4,
      unitWeight: 4,
    };
    const vest: PlayerInventoryItem = {
      durability: 70,
      equipSlot: 'vest',
      equipment: {
        defense: 9,
        power: null,
        slot: 'vest',
      },
      id: 'inventory-vest',
      isEquipped: true,
      itemId: 'vest-2',
      itemName: 'Colete tatico',
      itemType: 'vest',
      levelRequired: 3,
      maxDurability: 100,
      proficiency: 0,
      quantity: 1,
      stackable: false,
      totalWeight: 5,
      unitWeight: 5,
    };

    expect(buildInventoryBenefitLines(weapon)).toEqual([
      'Poder ofensivo: +22.',
      'Combate direto soma +22 ao poder do confronto.',
      'Crimes e guerra territorial somam +22 ao peso ofensivo do loadout.',
    ]);
    expect(buildInventoryBenefitLines(vest)).toEqual([
      'Defesa / absorcao: +9.',
      'Combate direto soma +9 de protecao efetiva.',
      'Crimes e guerra territorial convertem isso em +54 de forca operacional.',
    ]);
    expect(resolveInventoryItemPresentation(vest, 9)).toMatchObject({
      primaryAction: {
        disabledReason: null,
        kind: 'unequip',
        label: 'Desequipar',
      },
      secondaryAction: {
        disabledReason: null,
        kind: 'repair',
        label: 'Reparar',
      },
      statusLabel: 'Equipado',
      statusTone: 'success',
    });
    expect(resolveInventoryItemTypeLabel(weapon)).toBe('Arma');
  });

  it('keeps drugs consumable inline in the shared inventory contract', () => {
    const drug: PlayerInventoryItem = {
      durability: null,
      equipSlot: null,
      equipment: null,
      id: 'inventory-drug',
      isEquipped: false,
      itemId: 'drug-1',
      itemName: 'Maconha',
      itemType: 'drug',
      levelRequired: null,
      maxDurability: null,
      proficiency: 0,
      quantity: 3,
      stackable: true,
      totalWeight: 0.3,
      unitWeight: 0.1,
    };

    expect(resolveInventoryItemPresentation(drug, 1)).toMatchObject({
      primaryAction: {
        disabledReason: null,
        kind: 'consume',
        label: 'Usar',
      },
      secondaryAction: null,
      statusLabel: 'Consumivel',
      statusTone: 'info',
    });
    expect(resolveInventoryItemTypeLabel(drug)).toBe('Droga');
  });
});
