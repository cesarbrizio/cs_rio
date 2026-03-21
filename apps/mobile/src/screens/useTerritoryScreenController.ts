import { type TerritoryFavelaSummary, type TerritoryOverviewResponse } from '@cs-rio/shared';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type RootStackParamList } from '../../App';
import {
  buildFavelaAlertLines,
  buildTerritoryHeadlineStats,
  groupFavelasByRegion,
  resolveTerritoryActionVisibility,
  resolveWarSideForPlayer,
} from '../features/territory';
import { buildTerritoryLossCue } from '../features/territory-loss';
import { buildWarResultCue, type WarResultCue } from '../features/war-results';
import { formatApiError, territoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import {
  resolvePreferredFavelaId,
  resolvePreferredRegionId,
} from './territoryScreenSupport';
import { useTerritoryScreenMutations } from './useTerritoryScreenMutations';

export function useTerritoryScreenController() {
  const route = useRoute<RouteProp<RootStackParamList, 'Territory'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [overview, setOverview] = useState<TerritoryOverviewResponse | null>(null);
  const [lossFeed, setLossFeed] = useState<Awaited<
    ReturnType<typeof territoryApi.getLosses>
  > | null>(null);
  const [servicesBook, setServicesBook] = useState<Awaited<
    ReturnType<typeof territoryApi.getServices>
  > | null>(null);
  const [baileBook, setBaileBook] = useState<Awaited<
    ReturnType<typeof territoryApi.getBaile>
  > | null>(null);
  const [warBook, setWarBook] = useState<Awaited<ReturnType<typeof territoryApi.getWar>> | null>(
    null,
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(player?.regionId ?? null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(
    route.params?.focusFavelaId ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [baileBudgetInput, setBaileBudgetInput] = useState('45000');
  const [baileEntryPriceInput, setBaileEntryPriceInput] = useState('120');
  const [selectedBaileTier, setSelectedBaileTier] = useState<'local' | 'regional' | 'estelar'>(
    'regional',
  );
  const [warBudgetInput, setWarBudgetInput] = useState('25000');
  const [warSoldierCommitmentInput, setWarSoldierCommitmentInput] = useState('6');
  const [expandedActionId, setExpandedActionId] = useState<
    'conquer' | 'declare-war' | 'propina' | 'x9' | null
  >(null);
  const [warResultCue, setWarResultCue] = useState<WarResultCue | null>(null);

  const playerFactionId = overview?.playerFactionId ?? player?.faction?.id ?? null;
  const headlineStats = useMemo(() => buildTerritoryHeadlineStats(overview), [overview]);
  const recentLosses = useMemo(
    () => (lossFeed?.cues ?? []).map(buildTerritoryLossCue).slice(0, 4),
    [lossFeed],
  );
  const regionGroups = useMemo(() => (overview ? groupFavelasByRegion(overview) : []), [overview]);
  const visibleRegionId = useMemo(() => {
    if (!overview) {
      return selectedRegionId;
    }

    if (
      selectedRegionId &&
      overview.regions.some((region) => region.regionId === selectedRegionId)
    ) {
      return selectedRegionId;
    }

    return overview.regions[0]?.regionId ?? player?.regionId ?? null;
  }, [overview, player?.regionId, selectedRegionId]);
  const selectedRegion = useMemo(
    () => regionGroups.find((group) => group.region.regionId === visibleRegionId) ?? null,
    [regionGroups, visibleRegionId],
  );
  const selectedFavela = useMemo(
    () =>
      overview?.favelas.find((favela) => favela.id === selectedFavelaId) ??
      selectedRegion?.favelas[0] ??
      null,
    [overview?.favelas, selectedFavelaId, selectedRegion?.favelas],
  );
  const selectedServices = servicesBook?.services ?? [];
  const selectedWar = warBook?.war ?? selectedFavela?.war ?? null;
  const selectedWarSide = useMemo(
    () => resolveWarSideForPlayer(playerFactionId, selectedWar),
    [playerFactionId, selectedWar],
  );
  const selectedWarPreparation = useMemo(() => {
    if (!selectedWar || !selectedWarSide) {
      return null;
    }

    return selectedWarSide === 'attacker'
      ? selectedWar.attackerPreparation
      : selectedWar.defenderPreparation;
  }, [selectedWar, selectedWarSide]);
  const selectedWarResultCue = useMemo(
    () => (selectedFavela ? buildWarResultCue(selectedFavela, player) : null),
    [player, selectedFavela],
  );
  const selectedActionVisibility = useMemo(
    () =>
      resolveTerritoryActionVisibility({
        favela: selectedFavela,
        playerFactionId,
      }),
    [playerFactionId, selectedFavela],
  );
  const selectedAlerts = useMemo(
    () => (selectedFavela ? buildFavelaAlertLines(selectedFavela) : []),
    [selectedFavela],
  );
  const canPrepareSelectedWar = Boolean(
    selectedWar &&
    selectedWarSide &&
    (selectedWar.status === 'declared' || selectedWar.status === 'preparing') &&
    !selectedWarPreparation,
  );
  const canAdvanceSelectedWarRound = Boolean(
    selectedWar && selectedWarSide && selectedWar.status === 'active',
  );
  const hasLiveCountdown = Boolean(
    baileBook?.baile.cooldownEndsAt ||
    selectedFavela?.x9?.warningEndsAt ||
    selectedWar?.nextRoundAt ||
    selectedWar?.preparationEndsAt,
  );

  const loadFavelaDetail = useCallback(async (favelaId: string) => {
    setIsDetailLoading(true);
    setServicesBook(null);
    setBaileBook(null);
    setWarBook(null);

    try {
      const [nextServicesBook, nextBaileBook, nextWarBook] = await Promise.allSettled([
        territoryApi.getServices(favelaId),
        territoryApi.getBaile(favelaId),
        territoryApi.getWar(favelaId),
      ]);

      setServicesBook(nextServicesBook.status === 'fulfilled' ? nextServicesBook.value : null);
      setBaileBook(nextBaileBook.status === 'fulfilled' ? nextBaileBook.value : null);
      setWarBook(nextWarBook.status === 'fulfilled' ? nextWarBook.value : null);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const loadTerritoryHub = useCallback(
    async (
      preferredFavelaId: string | null,
      preferredRegionId: string | null,
    ): Promise<string | null> => {
      setIsLoading(true);
      setLoadErrorMessage(null);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const [nextOverview, nextLossFeed] = await Promise.all([
          territoryApi.list(),
          territoryApi.getLosses(),
        ]);
        const nextRegionId = resolvePreferredRegionId(
          nextOverview,
          preferredRegionId,
          preferredFavelaId,
          player?.regionId ?? null,
        );
        const nextFavelaId = resolvePreferredFavelaId(
          nextOverview,
          nextRegionId,
          preferredFavelaId,
          route.params?.focusFavelaId ?? null,
        );

        setOverview(nextOverview);
        setLossFeed(nextLossFeed);
        setSelectedRegionId(nextRegionId);
        setSelectedFavelaId(nextFavelaId);

        if (nextFavelaId) {
          await loadFavelaDetail(nextFavelaId);
        } else {
          setServicesBook(null);
          setBaileBook(null);
          setWarBook(null);
        }

        return nextFavelaId;
      } catch (error) {
        setLoadErrorMessage(formatApiError(error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [loadFavelaDetail, player?.regionId, route.params?.focusFavelaId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTerritoryHub(route.params?.focusFavelaId ?? null, player?.regionId ?? null);
      return undefined;
    }, [loadTerritoryHub, route.params?.focusFavelaId, player?.regionId]),
  );

  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());

      if (!hasLiveCountdown) {
        return undefined;
      }

      const intervalId = setInterval(() => {
        setNowMs(Date.now());
      }, 60_000);

      return () => {
        clearInterval(intervalId);
      };
    }, [hasLiveCountdown]),
  );

  useEffect(() => {
    const focusFavelaId = route.params?.focusFavelaId ?? null;

    if (!focusFavelaId || focusFavelaId === selectedFavelaId) {
      return;
    }

    const nextFavela = overview?.favelas.find((favela) => favela.id === focusFavelaId) ?? null;

    if (!nextFavela) {
      return;
    }

    setSelectedRegionId(nextFavela.regionId);
    setSelectedFavelaId(nextFavela.id);
    void loadFavelaDetail(nextFavela.id);
  }, [loadFavelaDetail, overview?.favelas, route.params?.focusFavelaId, selectedFavelaId]);

  useEffect(() => {
    setExpandedActionId(null);
  }, [selectedFavelaId]);

  useEffect(() => {
    if (
      (expandedActionId === 'conquer' && !selectedActionVisibility.canConquer) ||
      (expandedActionId === 'declare-war' && !selectedActionVisibility.canDeclareWar) ||
      (expandedActionId === 'propina' && !selectedActionVisibility.showNegotiatePropina) ||
      (expandedActionId === 'x9' && !selectedActionVisibility.showX9Desenrolo)
    ) {
      setExpandedActionId(null);
    }
  }, [expandedActionId, selectedActionVisibility]);

  const handleSelectRegion = useCallback(
    (regionId: string) => {
      setSelectedRegionId(regionId);

      const nextFavela = overview?.favelas.find((favela) => favela.regionId === regionId) ?? null;

      if (!nextFavela) {
        setSelectedFavelaId(null);
        setServicesBook(null);
        setBaileBook(null);
        setWarBook(null);
        return;
      }

      setSelectedFavelaId(nextFavela.id);
      void loadFavelaDetail(nextFavela.id);
    },
    [loadFavelaDetail, overview?.favelas],
  );

  const handleSelectFavela = useCallback(
    (favela: TerritoryFavelaSummary) => {
      setSelectedRegionId(favela.regionId);
      setSelectedFavelaId(favela.id);
      void loadFavelaDetail(favela.id);
    },
    [loadFavelaDetail],
  );

  const {
    handleAdvanceWarRound,
    handleConquer,
    handleDeclareWar,
    handleInstallService,
    handleNegotiatePropina,
    handleOrganizeBaile,
    handlePrepareWar,
    handleUpgradeService,
    handleX9Desenrolo,
  } = useTerritoryScreenMutations({
    baileBudgetInput,
    baileEntryPriceInput,
    loadTerritoryHub,
    player,
    refreshPlayerProfile,
    runContext: {
      selectedBaileTier,
      selectedFavela,
      selectedFavelaId,
      selectedRegionId,
      selectedWarSide,
      warBudgetInput,
      warSoldierCommitmentInput,
    },
    setBootstrapStatus,
    setErrorMessage,
    setFeedbackMessage,
    setIsMutating,
    setWarResultCue,
  });

  return {
    baileBook,
    baileBudgetInput,
    baileEntryPriceInput,
    canAdvanceSelectedWarRound,
    canPrepareSelectedWar,
    errorMessage,
    expandedActionId,
    feedbackMessage,
    handleAdvanceWarRound,
    handleConquer,
    handleDeclareWar,
    handleInstallService,
    handleNegotiatePropina,
    handleOrganizeBaile,
    handlePrepareWar,
    handleSelectFavela,
    handleSelectRegion,
    handleUpgradeService,
    handleX9Desenrolo,
    headlineStats,
    isDetailLoading,
    isLoading,
    isMutating,
    loadErrorMessage,
    loadFavelaDetail,
    loadTerritoryHub,
    nowMs,
    overview,
    playerFactionId,
    recentLosses,
    regionGroups,
    selectedActionVisibility,
    selectedAlerts,
    selectedBaileTier,
    selectedFavela,
    selectedFavelaId,
    selectedRegion,
    selectedRegionId,
    selectedServices,
    selectedWar,
    selectedWarResultCue,
    selectedWarSide,
    servicesBook,
    setBaileBudgetInput,
    setBaileEntryPriceInput,
    setErrorMessage,
    setExpandedActionId,
    setFeedbackMessage,
    setSelectedBaileTier,
    setSelectedFavelaId,
    setSelectedRegionId,
    setWarBudgetInput,
    setWarResultCue,
    setWarSoldierCommitmentInput,
    visibleRegionId,
    warBook,
    warBudgetInput,
    warResultCue,
    warSoldierCommitmentInput,
  };
}

export type TerritoryScreenController = ReturnType<typeof useTerritoryScreenController>;
