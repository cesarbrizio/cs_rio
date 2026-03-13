import {
  type DrugFactoryRecipeSummary,
  type DrugFactorySummary,
  type PlayerInventoryItem,
} from '@cs-rio/shared';

export function filterFactoryRecipes(
  recipes: DrugFactoryRecipeSummary[],
): DrugFactoryRecipeSummary[] {
  return [...recipes].sort((left, right) => {
    if (left.levelRequired !== right.levelRequired) {
      return left.levelRequired - right.levelRequired;
    }

    return left.drugName.localeCompare(right.drugName, 'pt-BR');
  });
}

export function filterStockableComponentItems(
  items: PlayerInventoryItem[],
  factory: DrugFactorySummary | null,
): PlayerInventoryItem[] {
  const allowedComponentIds = new Set(factory?.requirements.map((requirement) => requirement.componentId) ?? []);

  return items
    .filter((item) => item.itemType === 'component' && item.quantity > 0 && item.itemId)
    .filter((item) => (allowedComponentIds.size > 0 ? allowedComponentIds.has(item.itemId ?? '') : true))
    .sort((left, right) =>
      (left.itemName ?? left.itemId ?? '').localeCompare(right.itemName ?? right.itemId ?? '', 'pt-BR'),
    );
}

export function formatFactoryCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function resolveFactoryStatus(factory: DrugFactorySummary): string {
  if (factory.blockedReason === 'maintenance') {
    return 'Bloqueada por manutenção';
  }

  if (factory.blockedReason === 'components') {
    return 'Parada por falta de componentes';
  }

  return 'Operando';
}

export function sanitizeFactoryQuantity(value: string, maxQuantity: number): number {
  const parsed = Number.parseInt(value.trim(), 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, Math.max(1, maxQuantity));
}
