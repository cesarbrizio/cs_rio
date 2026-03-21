import type { GpTemplateSummary, OwnedPropertySummary } from '@cs-rio/shared';
import { useEffect } from 'react';

import { isBusinessProperty } from '../features/operations';
import {
  HIRE_QUANTITY_OPTIONS,
  formatPercentageInput,
  type HireQuantity,
  type SlotMachineActionMode,
} from './operationsScreenSupport';

interface UseOperationsScreenSelectionsInput {
  activeTab: 'business' | 'patrimony';
  allProperties: OwnedPropertySummary[];
  filteredProperties: OwnedPropertySummary[];
  focusPropertyId: string | null;
  focusPropertyType: OwnedPropertySummary['type'] | null;
  gpHireQuantity: HireQuantity;
  pendingFocusPropertyId: string | null;
  propertyTemplates: { type: GpTemplateSummary['type'] }[];
  selectedGpTemplate: GpTemplateSummary | null;
  selectedGpType: GpTemplateSummary['type'] | null;
  selectedPropertyId: string | null;
  selectedPuteiroAvailableSlots: number;
  selectedSlotMachineConfig:
    | {
        houseEdge: number;
        jackpotChance: number;
        maxBet: number;
        minBet: number;
      }
    | null
    | undefined;
  selectedSoldierTemplate:
    | {
        type: string;
      }
    | null
    | undefined;
  selectedSoldierType: string | null;
  setActiveTab: (tab: 'business' | 'patrimony') => void;
  setGpHireQuantity: (value: HireQuantity) => void;
  setPendingFocusPropertyId: (value: string | null) => void;
  setSelectedGpType: (value: GpTemplateSummary['type'] | null) => void;
  setSelectedPropertyId: (value: string | null) => void;
  setSelectedSoldierType: (value: string | null) => void;
  setSlotMachineActionMode: (value: SlotMachineActionMode) => void;
  setSlotMachineHouseEdgeInput: (value: string) => void;
  setSlotMachineJackpotInput: (value: string) => void;
  setSlotMachineMaxBetInput: (value: string) => void;
  setSlotMachineMinBetInput: (value: string) => void;
  soldierTemplates: {
    type: string;
  }[];
}

export function useOperationsScreenSelections({
  activeTab,
  allProperties,
  filteredProperties,
  focusPropertyId,
  focusPropertyType,
  gpHireQuantity,
  pendingFocusPropertyId,
  propertyTemplates,
  selectedGpTemplate,
  selectedGpType,
  selectedPropertyId,
  selectedPuteiroAvailableSlots,
  selectedSlotMachineConfig,
  selectedSoldierTemplate,
  selectedSoldierType,
  setActiveTab,
  setGpHireQuantity,
  setPendingFocusPropertyId,
  setSelectedGpType,
  setSelectedPropertyId,
  setSelectedSoldierType,
  setSlotMachineActionMode,
  setSlotMachineHouseEdgeInput,
  setSlotMachineJackpotInput,
  setSlotMachineMaxBetInput,
  setSlotMachineMinBetInput,
  soldierTemplates,
}: UseOperationsScreenSelectionsInput) {
  useEffect(() => {
    if (allProperties.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    const focusedById = pendingFocusPropertyId
      ? allProperties.find((property) => property.id === pendingFocusPropertyId) ?? null
      : focusPropertyId
        ? allProperties.find((property) => property.id === focusPropertyId) ?? null
        : null;
    const focusedByType = pendingFocusPropertyId
      ? null
      : focusPropertyType
        ? allProperties.find((property) => property.type === focusPropertyType) ?? null
        : null;
    const preferredProperty = focusedById ?? focusedByType;

    if (preferredProperty) {
      const preferredTab = isBusinessProperty(preferredProperty)
        ? 'business'
        : 'patrimony';

      if (preferredTab !== activeTab) {
        setActiveTab(preferredTab);
      }

      if (preferredProperty.id !== selectedPropertyId) {
        setSelectedPropertyId(preferredProperty.id);
      }

      if (pendingFocusPropertyId === preferredProperty.id) {
        setPendingFocusPropertyId(null);
      }
      return;
    }

    if (
      !selectedPropertyId ||
      !filteredProperties.some((property) => property.id === selectedPropertyId)
    ) {
      setSelectedPropertyId(filteredProperties[0]?.id ?? null);
    }
  }, [
    activeTab,
    allProperties,
    filteredProperties,
    focusPropertyId,
    focusPropertyType,
    pendingFocusPropertyId,
    selectedPropertyId,
    setActiveTab,
    setPendingFocusPropertyId,
    setSelectedPropertyId,
  ]);

  useEffect(() => {
    if (!selectedSoldierTemplate && soldierTemplates.length > 0) {
      setSelectedSoldierType(soldierTemplates[0]?.type ?? null);
      return;
    }

    if (selectedSoldierTemplate && selectedSoldierTemplate.type !== selectedSoldierType) {
      setSelectedSoldierType(selectedSoldierTemplate.type);
      return;
    }

    if (soldierTemplates.length === 0) {
      setSelectedSoldierType(null);
    }
  }, [selectedSoldierTemplate, selectedSoldierType, setSelectedSoldierType, soldierTemplates]);

  useEffect(() => {
    if (!selectedGpTemplate && propertyTemplates.length > 0) {
      setSelectedGpType(propertyTemplates[0]?.type ?? null);
      return;
    }

    if (selectedGpTemplate && selectedGpTemplate.type !== selectedGpType) {
      setSelectedGpType(selectedGpTemplate.type);
      return;
    }

    if (propertyTemplates.length === 0) {
      setSelectedGpType(null);
    }
  }, [propertyTemplates, selectedGpTemplate, selectedGpType, setSelectedGpType]);

  useEffect(() => {
    if (selectedPuteiroAvailableSlots <= 0 || gpHireQuantity <= selectedPuteiroAvailableSlots) {
      return;
    }

    const nextQuantity =
      [...HIRE_QUANTITY_OPTIONS]
        .reverse()
        .find((quantity) => quantity <= selectedPuteiroAvailableSlots) ?? 1;
    setGpHireQuantity(nextQuantity);
  }, [gpHireQuantity, selectedPuteiroAvailableSlots, setGpHireQuantity]);

  useEffect(() => {
    if (!selectedSlotMachineConfig) {
      setSlotMachineActionMode(null);
      return;
    }

    setSlotMachineHouseEdgeInput(formatPercentageInput(selectedSlotMachineConfig.houseEdge));
    setSlotMachineJackpotInput(
      formatPercentageInput(selectedSlotMachineConfig.jackpotChance),
    );
    setSlotMachineMinBetInput(String(Math.round(selectedSlotMachineConfig.minBet)));
    setSlotMachineMaxBetInput(String(Math.round(selectedSlotMachineConfig.maxBet)));
  }, [
    selectedSlotMachineConfig,
    setSlotMachineActionMode,
    setSlotMachineHouseEdgeInput,
    setSlotMachineJackpotInput,
    setSlotMachineMaxBetInput,
    setSlotMachineMinBetInput,
  ]);
}
