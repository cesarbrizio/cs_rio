import { type PlayerInventoryItem } from '@cs-rio/shared';

export type InventoryActionKind = 'consume' | 'equip' | 'repair' | 'unequip';
export type InventoryStatusTone = 'accent' | 'danger' | 'info' | 'muted' | 'success' | 'warning';

export const INVENTORY_SCREEN_DESCRIPTION =
  'O card do proprio item virou a superficie principal de acao. Equipar, desequipar, reparar e consumir agora disparam feedback imediato no inventario.';

export const INVENTORY_EXPANSION_HINT =
  'Toque ou clique em um item para expandir o card e agir dali mesmo, sem depender de outro painel.';

export interface InventoryResolvedAction {
  disabledReason: string | null;
  kind: InventoryActionKind;
  label: string;
}

export interface InventoryItemPresentation {
  primaryAction: InventoryResolvedAction | null;
  secondaryAction: InventoryResolvedAction | null;
  statusLabel: string;
  statusTone: InventoryStatusTone;
}

export function buildInventoryBenefitLines(item: PlayerInventoryItem): string[] {
  const equipment = item.equipment ?? null;

  if (equipment?.slot === 'weapon' && typeof equipment.power === 'number') {
    return [
      `Poder ofensivo: +${equipment.power}.`,
      `Combate direto soma +${equipment.power} ao poder do confronto.`,
      `Crimes e guerra territorial somam +${equipment.power} ao peso ofensivo do loadout.`,
    ];
  }

  if (equipment?.slot === 'vest' && typeof equipment.defense === 'number') {
    return [
      `Defesa / absorcao: +${equipment.defense}.`,
      `Combate direto soma +${equipment.defense} de protecao efetiva.`,
      `Crimes e guerra territorial convertem isso em +${equipment.defense * 6} de forca operacional.`,
    ];
  }

  return [];
}

export function resolveInventoryItemPresentation(
  item: PlayerInventoryItem,
  playerLevel: number,
): InventoryItemPresentation {
  const equipable = item.itemType === 'weapon' || item.itemType === 'vest';
  const repairable =
    equipable &&
    typeof item.durability === 'number' &&
    typeof item.maxDurability === 'number' &&
    item.maxDurability > 0 &&
    item.durability < item.maxDurability;
  const broken = equipable && (item.durability ?? 0) <= 0;
  const lockedByLevel = item.levelRequired !== null && playerLevel < item.levelRequired;

  if (item.isEquipped) {
    return {
      primaryAction: {
        disabledReason: null,
        kind: 'unequip',
        label: 'Desequipar',
      },
      secondaryAction: repairable
        ? {
            disabledReason: null,
            kind: 'repair',
            label: 'Reparar',
          }
        : null,
      statusLabel: 'Equipado',
      statusTone: 'success',
    };
  }

  if (broken) {
    return {
      primaryAction: {
        disabledReason: null,
        kind: 'repair',
        label: 'Reparar',
      },
      secondaryAction: null,
      statusLabel: 'Quebrado',
      statusTone: 'danger',
    };
  }

  if (equipable && lockedByLevel) {
    return {
      primaryAction: {
        disabledReason: `Requer nivel ${item.levelRequired}.`,
        kind: 'equip',
        label: 'Equipar',
      },
      secondaryAction: repairable
        ? {
            disabledReason: null,
            kind: 'repair',
            label: 'Reparar',
          }
        : null,
      statusLabel: `Nivel ${item.levelRequired} necessario`,
      statusTone: 'warning',
    };
  }

  if (equipable) {
    return {
      primaryAction: {
        disabledReason: null,
        kind: 'equip',
        label: 'Equipar',
      },
      secondaryAction: repairable
        ? {
            disabledReason: null,
            kind: 'repair',
            label: 'Reparar',
          }
        : null,
      statusLabel: repairable ? 'Pronto com desgaste' : 'Pronto para equipar',
      statusTone: repairable ? 'warning' : 'accent',
    };
  }

  if (item.itemType === 'drug') {
    return {
      primaryAction: {
        disabledReason: null,
        kind: 'consume',
        label: 'Usar',
      },
      secondaryAction: null,
      statusLabel: 'Consumivel',
      statusTone: 'info',
    };
  }

  return {
    primaryAction: null,
    secondaryAction: null,
    statusLabel: 'No estoque',
    statusTone: 'muted',
  };
}

export function resolveInventoryItemTypeLabel(item: PlayerInventoryItem): string {
  switch (item.itemType) {
    case 'weapon':
      return 'Arma';
    case 'vest':
      return 'Colete';
    case 'drug':
      return 'Droga';
    case 'component':
      return 'Componente';
    case 'consumable':
      return 'Consumivel';
    case 'boost':
      return 'Boost';
    case 'property_upgrade':
      return 'Upgrade';
  }
}
