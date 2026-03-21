import { type DrugConsumeResponse, type PlayerProfile } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildInventoryBenefitLines,
  resolveInventoryItemPresentation,
} from './inventoryHelpers';

interface UseInventoryControllerInput {
  actions: {
    consumeDrugInventoryItem: (inventoryItemId: string) => Promise<DrugConsumeResponse>;
    equipInventoryItem: (inventoryItemId: string) => Promise<unknown>;
    repairInventoryItem: (inventoryItemId: string) => Promise<{
      repairCost: number;
    }>;
    unequipInventoryItem: (inventoryItemId: string) => Promise<unknown>;
  };
  player: PlayerProfile | null;
}

export function useInventoryController({ actions, player }: UseInventoryControllerInput) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => player?.inventory ?? [], [player?.inventory]);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );
  const repairableCount = useMemo(
    () =>
      items.filter((item) => {
        const presentation = resolveInventoryItemPresentation(item, player?.level ?? 1);
        return (
          presentation.primaryAction?.kind === 'repair' ||
          presentation.secondaryAction?.kind === 'repair'
        );
      }).length,
    [items, player?.level],
  );
  const equippedCount = useMemo(() => items.filter((item) => item.isEquipped).length, [items]);

  useEffect(() => {
    if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [items, selectedItemId]);

  const runAction = useCallback(
    async (
      kind: 'consume' | 'equip' | 'repair' | 'unequip',
      inventoryItemId: string,
      itemName: string,
    ) => {
      setFeedback(null);
      setError(null);
      setSubmittingItemId(inventoryItemId);

      try {
        if (kind === 'equip') {
          await actions.equipInventoryItem(inventoryItemId);
          setFeedback(`${itemName} equipado. O item ja entrou no seu corre.`);
          return;
        }

        if (kind === 'unequip') {
          await actions.unequipInventoryItem(inventoryItemId);
          setFeedback(`${itemName} desequipado. Slot liberado.`);
          return;
        }

        if (kind === 'repair') {
          const response = await actions.repairInventoryItem(inventoryItemId);
          setFeedback(`${itemName} reparado por ${formatInventoryCurrency(response.repairCost)}.`);
          return;
        }

        const response = await actions.consumeDrugInventoryItem(inventoryItemId);
        setFeedback(
          `${itemName} consumido. Brisa +${response.effects.brisaRecovered}, disposicao +${response.effects.disposicaoRecovered}.`,
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Falha ao atualizar inventario.');
      } finally {
        setSubmittingItemId(null);
      }
    },
    [actions],
  );

  return {
    buildInventoryBenefitLines,
    equippedCount,
    error,
    feedback,
    items,
    repairableCount,
    resolveInventoryItemPresentation,
    runAction,
    selectedItem,
    selectedItemId,
    setSelectedItemId,
    submittingItemId,
  };
}

function formatInventoryCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
