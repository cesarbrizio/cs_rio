import {
  type FavelaBaileStatusResponse,
  type FavelaPropinaNegotiationResponse,
  type FavelaServicesResponse,
  type FactionWarDeclareResponse,
  type FactionWarStatusResponse,
  type TerritoryOverviewResponse,
  type PlayerProfile,
  type FavelaServiceType,
  type TerritoryLossFeedResponse,
} from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildTerritoryHeadlineStats,
  groupFavelasByRegion,
} from './territoryHelpers';

interface UseTerritoryControllerInput {
  player: PlayerProfile | null;
  refreshPlayerProfile: () => Promise<unknown>;
  territoryApi: {
    conquer: (favelaId: string) => Promise<unknown>;
    declareWar: (favelaId: string) => Promise<FactionWarDeclareResponse>;
    getBaile: (favelaId: string) => Promise<FavelaBaileStatusResponse>;
    getLosses: () => Promise<TerritoryLossFeedResponse>;
    getServices: (favelaId: string) => Promise<FavelaServicesResponse>;
    getWar: (favelaId: string) => Promise<FactionWarStatusResponse>;
    installService: (favelaId: string, input: { serviceType: FavelaServiceType }) => Promise<unknown>;
    list: () => Promise<TerritoryOverviewResponse>;
    negotiatePropina: (favelaId: string) => Promise<FavelaPropinaNegotiationResponse>;
  };
}

export function useTerritoryController({
  player,
  refreshPlayerProfile,
  territoryApi,
}: UseTerritoryControllerInput) {
  const [overview, setOverview] = useState<TerritoryOverviewResponse | null>(null);
  const [lossFeed, setLossFeed] = useState<Array<{ body: string; occurredAt: string; title: string }>>([]);
  const [servicesBook, setServicesBook] = useState<Awaited<ReturnType<typeof territoryApi.getServices>> | null>(null);
  const [baileBook, setBaileBook] = useState<Awaited<ReturnType<typeof territoryApi.getBaile>> | null>(null);
  const [warBook, setWarBook] = useState<Awaited<ReturnType<typeof territoryApi.getWar>> | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(player?.regionId ?? null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const headlineStats = useMemo(() => buildTerritoryHeadlineStats(overview), [overview]);
  const regionGroups = useMemo(
    () => (overview ? groupFavelasByRegion(overview) : []),
    [overview],
  );
  const visibleRegionId = useMemo(() => {
    if (!overview) {
      return selectedRegionId;
    }

    if (selectedRegionId && overview.regions.some((region) => region.regionId === selectedRegionId)) {
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

  const loadFavelaDetail = useCallback(
    async (favelaId: string) => {
      setIsDetailLoading(true);

      try {
        const [nextServices, nextBaile, nextWar] = await Promise.allSettled([
          territoryApi.getServices(favelaId),
          territoryApi.getBaile(favelaId),
          territoryApi.getWar(favelaId),
        ]);

        setServicesBook(nextServices.status === 'fulfilled' ? nextServices.value : null);
        setBaileBook(nextBaile.status === 'fulfilled' ? nextBaile.value : null);
        setWarBook(nextWar.status === 'fulfilled' ? nextWar.value : null);
      } finally {
        setIsDetailLoading(false);
      }
    },
    [territoryApi],
  );

  const loadTerritoryHub = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextOverview, nextLossFeed] = await Promise.all([
        territoryApi.list(),
        territoryApi.getLosses(),
      ]);

      setOverview(nextOverview);
      setLossFeed(nextLossFeed.cues.slice(0, 6));

      const nextRegionId =
        selectedRegionId && nextOverview.regions.some((region) => region.regionId === selectedRegionId)
          ? selectedRegionId
          : nextOverview.regions[0]?.regionId ?? player?.regionId ?? null;
      const nextFavelaId =
        nextOverview.favelas.find((favela) => favela.id === selectedFavelaId)?.id ??
        nextOverview.favelas.find((favela) => favela.regionId === nextRegionId)?.id ??
        null;

      setSelectedRegionId(nextRegionId);
      setSelectedFavelaId(nextFavelaId);

      if (nextFavelaId) {
        await loadFavelaDetail(nextFavelaId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar territorio.');
    } finally {
      setIsLoading(false);
    }
  }, [loadFavelaDetail, player?.regionId, selectedFavelaId, selectedRegionId, territoryApi]);

  useEffect(() => {
    void loadTerritoryHub();
  }, [loadTerritoryHub]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const selectFavela = useCallback(
    async (favelaId: string) => {
      setSelectedFavelaId(favelaId);
      await loadFavelaDetail(favelaId);
    },
    [loadFavelaDetail],
  );

  const runMutation = useCallback(
    async (operation: () => Promise<void>, successMessage: string) => {
      setError(null);
      setIsMutating(true);

      try {
        await operation();
        await refreshPlayerProfile();
        await loadTerritoryHub();
        setFeedback(successMessage);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Falha ao atualizar territorio.');
      } finally {
        setIsMutating(false);
      }
    },
    [loadTerritoryHub, refreshPlayerProfile],
  );

  const conquerSelectedFavela = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      async () => {
        await territoryApi.conquer(selectedFavela.id);
      },
      `Investida iniciada em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela, territoryApi]);

  const declareWarOnSelectedFavela = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      async () => {
        await territoryApi.declareWar(selectedFavela.id);
      },
      `Guerra declarada em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela, territoryApi]);

  const negotiateSelectedPropina = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      async () => {
        await territoryApi.negotiatePropina(selectedFavela.id);
      },
      `Negociacao de arrego enviada para ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela, territoryApi]);

  const installSelectedService = useCallback(
    async (serviceType: FavelaServiceType) => {
      if (!selectedFavela) {
        return;
      }

      await runMutation(
        async () => {
          await territoryApi.installService(selectedFavela.id, { serviceType });
        },
        `Servico ${serviceType} instalado em ${selectedFavela.name}.`,
      );
    },
    [runMutation, selectedFavela, territoryApi],
  );

  return {
    baileBook,
    conquerSelectedFavela,
    declareWarOnSelectedFavela,
    error,
    feedback,
    headlineStats,
    isDetailLoading,
    isLoading,
    isMutating,
    installSelectedService,
    loadTerritoryHub,
    lossFeed,
    negotiateSelectedPropina,
    nowMs,
    overview,
    regionGroups,
    selectFavela,
    selectedFavela,
    selectedFavelaId,
    selectedRegion,
    selectedRegionId: visibleRegionId,
    servicesBook,
    setSelectedRegionId,
    warBook,
  };
}
