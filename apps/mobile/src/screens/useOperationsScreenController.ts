import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { GpTemplateSummary } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type RootStackParamList } from '../../App';
import {
  buildPuteiroAcquisitionState,
  buildPuteiroDashboardSnapshot,
  buildSlotMachineAcquisitionState,
  countOperationalAlerts,
  countReadyOperations,
  filterPropertiesByTab,
  isBusinessProperty,
  resolvePropertyOperationSnapshot,
  sumCollectableCash,
  sumPropertyDailyUpkeep,
  type OperationsDashboardData,
  type OperationsTab,
} from '../features/operations';
import {
  bocaApi,
  factoryApi,
  formatApiError,
  frontStoreApi,
  propertyApi,
  puteiroApi,
  raveApi,
  slotMachineApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import {
  DEFAULT_SLOT_MACHINE_HOUSE_EDGE_INPUT,
  DEFAULT_SLOT_MACHINE_INSTALL_QUANTITY_INPUT,
  DEFAULT_SLOT_MACHINE_JACKPOT_INPUT,
  DEFAULT_SLOT_MACHINE_MAX_BET_INPUT,
  DEFAULT_SLOT_MACHINE_MIN_BET_INPUT,
  type HireQuantity,
  type OperationResultState,
  type SlotMachineActionMode,
} from './operationsScreenSupport';
import { useOperationsScreenMutations } from './useOperationsScreenMutations';
import { useOperationsScreenSelections } from './useOperationsScreenSelections';

export type OperationsScreenController = ReturnType<typeof useOperationsScreenController>;

export function useOperationsScreenController() {
  const route = useRoute<RouteProp<RootStackParamList, 'Operations'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [dashboard, setDashboard] = useState<OperationsDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>(
    route.params?.initialTab ?? 'business',
  );
  const [pendingFocusPropertyId, setPendingFocusPropertyId] = useState<string | null>(
    null,
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    route.params?.focusPropertyId ?? null,
  );
  const [selectedSoldierType, setSelectedSoldierType] = useState<string | null>(null);
  const [hireQuantity, setHireQuantity] = useState<HireQuantity>(1);
  const [selectedGpType, setSelectedGpType] = useState<GpTemplateSummary['type'] | null>(
    null,
  );
  const [gpHireQuantity, setGpHireQuantity] = useState<HireQuantity>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [slotMachineActionMode, setSlotMachineActionMode] =
    useState<SlotMachineActionMode>(null);
  const [slotMachineInstallQuantityInput, setSlotMachineInstallQuantityInput] = useState(
    DEFAULT_SLOT_MACHINE_INSTALL_QUANTITY_INPUT,
  );
  const [slotMachineHouseEdgeInput, setSlotMachineHouseEdgeInput] = useState(
    DEFAULT_SLOT_MACHINE_HOUSE_EDGE_INPUT,
  );
  const [slotMachineJackpotInput, setSlotMachineJackpotInput] = useState(
    DEFAULT_SLOT_MACHINE_JACKPOT_INPUT,
  );
  const [slotMachineMinBetInput, setSlotMachineMinBetInput] = useState(
    DEFAULT_SLOT_MACHINE_MIN_BET_INPUT,
  );
  const [slotMachineMaxBetInput, setSlotMachineMaxBetInput] = useState(
    DEFAULT_SLOT_MACHINE_MAX_BET_INPUT,
  );
  const [operationResult, setOperationResult] = useState<OperationResultState | null>(
    null,
  );

  const loadDashboard = useCallback(async (): Promise<OperationsDashboardData | null> => {
    setError(null);
    setIsLoading(true);

    try {
      const [
        propertyBook,
        bocaBook,
        raveBook,
        puteiroBook,
        frontStoreBook,
        slotMachineBook,
        factoryBook,
      ] = await Promise.all([
        propertyApi.list(),
        bocaApi.list(),
        raveApi.list(),
        puteiroApi.list(),
        frontStoreApi.list(),
        slotMachineApi.list(),
        factoryApi.list(),
        refreshPlayerProfile(),
      ]);

      const nextDashboard = {
        bocaBook,
        factoryBook,
        frontStoreBook,
        propertyBook,
        puteiroBook,
        raveBook,
        slotMachineBook,
      };

      setDashboard(nextDashboard);
      return nextDashboard;
    } catch (nextError) {
      setError(formatApiError(nextError).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const allProperties = useMemo(
    () => dashboard?.propertyBook.ownedProperties ?? [],
    [dashboard?.propertyBook.ownedProperties],
  );
  const filteredProperties = useMemo(
    () => filterPropertiesByTab(allProperties, activeTab),
    [activeTab, allProperties],
  );
  const filteredCatalogProperties = useMemo(
    () =>
      (dashboard?.propertyBook.availableProperties ?? []).filter((definition) =>
        activeTab === 'business'
          ? definition.category === 'business'
          : definition.category !== 'business',
      ),
    [activeTab, dashboard?.propertyBook.availableProperties],
  );

  const selectedProperty = useMemo(
    () =>
      allProperties.find((property) => property.id === selectedPropertyId) ??
      filteredProperties[0] ??
      null,
    [allProperties, filteredProperties, selectedPropertyId],
  );
  const selectedOperation = useMemo(
    () =>
      dashboard && selectedProperty
        ? resolvePropertyOperationSnapshot(selectedProperty, dashboard)
        : null,
    [dashboard, selectedProperty],
  );
  const selectedSlotMachine = useMemo(
    () =>
      dashboard?.slotMachineBook.slotMachines.find(
        (entry) => entry.id === selectedProperty?.id,
      ) ?? null,
    [dashboard?.slotMachineBook.slotMachines, selectedProperty?.id],
  );
  const selectedPuteiro = useMemo(
    () =>
      dashboard?.puteiroBook.puteiros.find((entry) => entry.id === selectedProperty?.id) ??
      null,
    [dashboard?.puteiroBook.puteiros, selectedProperty?.id],
  );
  const slotMachineAcquisition = useMemo(
    () =>
      buildSlotMachineAcquisitionState({
        availableProperties: dashboard?.propertyBook.availableProperties ?? [],
        ownedProperties: allProperties,
        playerLevel: player?.level ?? 0,
        playerMoney: player?.resources.money ?? 0,
        playerRegionId: player?.regionId ?? null,
      }),
    [
      allProperties,
      dashboard?.propertyBook.availableProperties,
      player?.level,
      player?.regionId,
      player?.resources.money,
    ],
  );
  const puteiroAcquisition = useMemo(
    () =>
      buildPuteiroAcquisitionState({
        availableProperties: dashboard?.propertyBook.availableProperties ?? [],
        gpTemplates: dashboard?.puteiroBook.templates ?? [],
        ownedProperties: allProperties,
        playerLevel: player?.level ?? 0,
        playerMoney: player?.resources.money ?? 0,
        playerRegionId: player?.regionId ?? null,
      }),
    [
      allProperties,
      dashboard?.propertyBook.availableProperties,
      dashboard?.puteiroBook.templates,
      player?.level,
      player?.regionId,
      player?.resources.money,
    ],
  );
  const showSlotMachineOffer =
    activeTab === 'business' &&
    Boolean(slotMachineAcquisition.definition) &&
    !slotMachineAcquisition.isOwned;
  const showPuteiroOffer =
    activeTab === 'business' &&
    Boolean(puteiroAcquisition.definition) &&
    !puteiroAcquisition.isOwned;
  const isSlotMachineDiscoveryActive =
    route.params?.focusPropertyType === 'slot_machine' ||
    selectedProperty?.type === 'slot_machine' ||
    showSlotMachineOffer;
  const isPuteiroDiscoveryActive =
    route.params?.focusPropertyType === 'puteiro' ||
    selectedProperty?.type === 'puteiro' ||
    showPuteiroOffer;
  const puteiroDashboardSnapshot = useMemo(
    () => (selectedPuteiro ? buildPuteiroDashboardSnapshot(selectedPuteiro) : null),
    [selectedPuteiro],
  );
  const unlockedSoldierTemplates = useMemo(
    () =>
      (dashboard?.propertyBook.soldierTemplates ?? []).filter(
        (template) => (player?.level ?? 0) >= template.unlockLevel,
      ),
    [dashboard?.propertyBook.soldierTemplates, player?.level],
  );
  const selectedSoldierTemplate = useMemo(
    () =>
      unlockedSoldierTemplates.find((template) => template.type === selectedSoldierType) ??
      unlockedSoldierTemplates[0] ??
      null,
    [selectedSoldierType, unlockedSoldierTemplates],
  );
  const selectedGpTemplate = useMemo(
    () =>
      (dashboard?.puteiroBook.templates ?? []).find(
        (template) => template.type === selectedGpType,
      ) ??
      dashboard?.puteiroBook.templates[0] ??
      null,
    [dashboard?.puteiroBook.templates, selectedGpType],
  );

  useOperationsScreenSelections({
    activeTab,
    allProperties,
    filteredProperties,
    focusPropertyId: route.params?.focusPropertyId ?? null,
    focusPropertyType: route.params?.focusPropertyType ?? null,
    gpHireQuantity,
    pendingFocusPropertyId,
    propertyTemplates: dashboard?.puteiroBook.templates ?? [],
    selectedGpTemplate,
    selectedGpType,
    selectedPropertyId,
    selectedPuteiroAvailableSlots: selectedPuteiro?.economics.availableSlots ?? 0,
    selectedSlotMachineConfig: selectedSlotMachine?.config,
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
    soldierTemplates: unlockedSoldierTemplates,
  });

  const summary = useMemo(() => {
    const ownedProperties = dashboard?.propertyBook.ownedProperties ?? [];
    const businessCount = ownedProperties.filter(isBusinessProperty).length;
    const patrimonyCount = ownedProperties.length - businessCount;

    return {
      alerts: countOperationalAlerts(ownedProperties),
      businessCount,
      cashReady: sumCollectableCash(
        dashboard ?? {
          bocaBook: { bocas: [] },
          factoryBook: { availableRecipes: [], factories: [] },
          frontStoreBook: { frontStores: [], kinds: [] },
          propertyBook: {
            availableProperties: [],
            ownedProperties: [],
            propertySlots: [],
            soldierTemplates: [],
          },
          puteiroBook: { puteiros: [], templates: [] },
          raveBook: { raves: [] },
          slotMachineBook: { slotMachines: [] },
        },
      ),
      dailyUpkeep: sumPropertyDailyUpkeep(ownedProperties),
      patrimonyCount,
      readyOperations: dashboard ? countReadyOperations(dashboard) : 0,
    };
  }, [dashboard]);

  const actions = useOperationsScreenMutations({
    gpHireQuantity,
    hireQuantity,
    loadDashboard,
    playerMoney: player?.resources.money ?? 0,
    playerRegionId: player?.regionId ?? null,
    puteiroAcquisition,
    selectedGpTemplate,
    selectedOperation,
    selectedProperty,
    selectedPuteiro,
    selectedSoldierTemplate,
    setActiveTab,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
    setPendingFocusPropertyId,
    setSelectedPropertyId,
    setSlotMachineActionMode,
    slotMachineAcquisition,
    slotMachineHouseEdgeInput,
    slotMachineInstallQuantityInput,
    slotMachineJackpotInput,
    slotMachineMaxBetInput,
    slotMachineMinBetInput,
  });

  const canUpgrade =
    Boolean(selectedProperty) &&
    selectedProperty.level < selectedProperty.definition.maxLevel &&
    !isLoading &&
    !isSubmitting;
  const canCollect = Boolean(selectedOperation?.readyToCollect) && !isLoading && !isSubmitting;
  const canHireSoldiers =
    Boolean(
      selectedProperty &&
        selectedProperty.definition.soldierCapacity > 0 &&
        selectedSoldierTemplate,
    ) &&
    !isLoading &&
    !isSubmitting;
  const canInstallSlotMachine =
    Boolean(selectedProperty && selectedProperty.type === 'slot_machine' && selectedSlotMachine) &&
    !isLoading &&
    !isSubmitting;
  const canConfigureSlotMachine =
    Boolean(selectedProperty && selectedProperty.type === 'slot_machine' && selectedSlotMachine) &&
    !isLoading &&
    !isSubmitting;
  const canPurchaseSlotMachine = slotMachineAcquisition.canPurchase && !isLoading && !isSubmitting;
  const canPurchasePuteiro = puteiroAcquisition.canPurchase && !isLoading && !isSubmitting;
  const canHireGps =
    Boolean(
      selectedProperty &&
        selectedProperty.type === 'puteiro' &&
        selectedPuteiro &&
        selectedGpTemplate &&
        selectedPuteiro.economics.availableSlots >= gpHireQuantity,
    ) &&
    !isLoading &&
    !isSubmitting;

  return {
    actions,
    activeTab,
    allProperties,
    canCollect,
    canConfigureSlotMachine,
    canHireGps,
    canHireSoldiers,
    canInstallSlotMachine,
    canPurchasePuteiro,
    canPurchaseSlotMachine,
    canUpgrade,
    dashboard,
    error,
    feedback,
    filteredCatalogProperties,
    filteredProperties,
    gpHireQuantity,
    hireQuantity,
    isLoading,
    isPuteiroDiscoveryActive,
    isSlotMachineDiscoveryActive,
    isSubmitting,
    operationResult,
    player,
    puteiroAcquisition,
    puteiroDashboardSnapshot,
    selectedGpTemplate,
    selectedOperation,
    selectedProperty,
    selectedPuteiro,
    selectedSlotMachine,
    selectedSoldierTemplate,
    setActiveTab,
    setGpHireQuantity,
    setOperationResult,
    setSelectedGpType,
    setSelectedPropertyId,
    setSelectedSoldierType,
    setSlotMachineActionMode,
    setSlotMachineHouseEdgeInput,
    setSlotMachineInstallQuantityInput,
    setSlotMachineJackpotInput,
    setSlotMachineMaxBetInput,
    setSlotMachineMinBetInput,
    setHireQuantity,
    showPuteiroOffer,
    showSlotMachineOffer,
    slotMachineAcquisition,
    slotMachineActionMode,
    slotMachineHouseEdgeInput,
    slotMachineInstallQuantityInput,
    slotMachineJackpotInput,
    slotMachineMaxBetInput,
    slotMachineMinBetInput,
    summary,
    unlockedSoldierTemplates,
  };
}
