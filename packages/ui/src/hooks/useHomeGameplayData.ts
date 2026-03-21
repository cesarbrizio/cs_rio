import {
  type EventResultListResponse,
  type NpcInflationSummary,
  type PlayerProfile,
  type PropertyCatalogResponse,
  type PropertySlotSummary,
  type RegionId,
  type RoundLeaderboardEntry,
  type RoundSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type EventRuntimeState } from './homeTypes';

interface RegionRealtimePlayerSnapshot {
  animation: string;
  nickname: string;
  playerId: string;
  regionId: string;
  sessionId: string;
  title: string;
  vocation: string;
  x: number;
  y: number;
}

interface RegionRealtimeSnapshot {
  players: RegionRealtimePlayerSnapshot[];
}

interface UseHomeGameplayDataInput {
  eventApi: {
    getDocksStatus: () => Promise<EventRuntimeState['docks']>;
    getPoliceStatus: () => Promise<EventRuntimeState['police']>;
    getResults: () => Promise<EventResultListResponse>;
    getSeasonalStatus: () => Promise<EventRuntimeState['seasonal']>;
  };
  player: PlayerProfile | null;
  propertyApi: {
    list: () => Promise<PropertyCatalogResponse>;
  };
  realtimeService: Pick<
    {
      connectToRegionRoom: (input: {
        accessToken: string;
        regionId: RegionId;
      }) => Promise<unknown>;
      disconnect: () => Promise<unknown>;
      getSnapshot: () => RegionRealtimeSnapshot;
      subscribe: (
        listener: (snapshot: RegionRealtimeSnapshot) => void,
      ) => () => void;
    },
    'connectToRegionRoom' | 'disconnect' | 'getSnapshot' | 'subscribe'
  >;
  refreshPlayerProfile: () => Promise<PlayerProfile | null>;
  roundApi: {
    getCenter: () => Promise<{
      leaderboard: RoundLeaderboardEntry[];
      npcInflation: NpcInflationSummary;
      round: RoundSummary;
    }>;
  };
  territoryApi: {
    list: () => Promise<TerritoryOverviewResponse>;
  };
  token: string | null;
}

interface HomeEventResultEntry {
  body: string;
  destination: string;
  headline: string;
  id: string;
  resolvedAt: string;
  severity: string;
  title: string;
}

export interface HomeGameplayDataResult {
  eventResults: HomeEventResultEntry[];
  eventRuntimeState: EventRuntimeState | null;
  isLoading: boolean;
  loadHomeData: () => Promise<void>;
  realtimeSnapshot: RegionRealtimeSnapshot;
  relevantRemotePlayers: Array<{
    distance: number;
    player: RegionRealtimeSnapshot['players'][number];
  }>;
  propertySlots: PropertySlotSummary[];
  roundInflation: NpcInflationSummary | null;
  roundLeaderboard: RoundLeaderboardEntry[];
  roundSummary: RoundSummary | null;
  territoryOverview: TerritoryOverviewResponse | null;
}

const RELEVANT_REMOTE_PLAYER_MAX_COUNT = 4;
const RELEVANT_REMOTE_PLAYER_MAX_DISTANCE = 18;
const RELEVANT_REMOTE_PLAYER_MIN_COUNT = 2;

export function useHomeGameplayData({
  eventApi,
  player,
  propertyApi,
  realtimeService,
  refreshPlayerProfile,
  roundApi,
  territoryApi,
  token,
}: UseHomeGameplayDataInput): HomeGameplayDataResult {
  const [eventResults, setEventResults] = useState<HomeEventResultEntry[]>([]);
  const [eventRuntimeState, setEventRuntimeState] = useState<EventRuntimeState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RegionRealtimeSnapshot>(
    realtimeService.getSnapshot(),
  );
  const [roundInflation, setRoundInflation] = useState<NpcInflationSummary | null>(null);
  const [roundLeaderboard, setRoundLeaderboard] = useState<RoundLeaderboardEntry[]>([]);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [territoryOverview, setTerritoryOverview] = useState<TerritoryOverviewResponse | null>(null);
  const [propertySlots, setPropertySlots] = useState<PropertySlotSummary[]>([]);

  const loadHomeData = useCallback(async () => {
    if (!player?.hasCharacter) {
      return;
    }

    setIsLoading(true);

    try {
      await refreshPlayerProfile();
      const [roundCenter, territory, docks, police, seasonal, eventResultsResponse, propertyCatalog] =
        await Promise.allSettled([
          roundApi.getCenter(),
          territoryApi.list(),
          eventApi.getDocksStatus(),
          eventApi.getPoliceStatus(),
          eventApi.getSeasonalStatus(),
          eventApi.getResults(),
          propertyApi.list(),
        ]);

      if (roundCenter.status === 'fulfilled') {
        setRoundInflation(roundCenter.value.npcInflation);
        setRoundLeaderboard(roundCenter.value.leaderboard);
        setRoundSummary(roundCenter.value.round);
      } else {
        setRoundInflation(null);
        setRoundLeaderboard([]);
        setRoundSummary(null);
      }

      if (territory.status === 'fulfilled') {
        setTerritoryOverview(territory.value);
      } else {
        setTerritoryOverview(null);
      }

      if (
        docks.status === 'fulfilled' &&
        police.status === 'fulfilled' &&
        seasonal.status === 'fulfilled'
      ) {
        setEventRuntimeState({
          docks: docks.value,
          police: police.value,
          seasonal: seasonal.value,
        });
      } else {
        setEventRuntimeState(null);
      }

      if (eventResultsResponse.status === 'fulfilled') {
        setEventResults(eventResultsResponse.value.results.slice(0, 6));
      } else {
        setEventResults([]);
      }

      if (propertyCatalog.status === 'fulfilled') {
        setPropertySlots(propertyCatalog.value.propertySlots);
      } else {
        setPropertySlots([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventApi, player?.hasCharacter, propertyApi, refreshPlayerProfile, roundApi, territoryApi]);

  useEffect(() => realtimeService.subscribe(setRealtimeSnapshot), [realtimeService]);

  useEffect(() => {
    if (!player?.hasCharacter || !player.regionId || !token) {
      return;
    }

    void realtimeService.connectToRegionRoom({
      accessToken: token,
      regionId: player.regionId,
    });

    return () => {
      void realtimeService.disconnect();
    };
  }, [player?.hasCharacter, player?.regionId, realtimeService, token]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  const relevantRemotePlayers = useMemo(() => {
    const remotePlayers = realtimeSnapshot.players.filter(
      (realtimePlayer) => realtimePlayer.playerId !== player?.id,
    );

    if (!player) {
      return remotePlayers.slice(0, RELEVANT_REMOTE_PLAYER_MIN_COUNT).map((remotePlayer) => ({
        distance: Number.POSITIVE_INFINITY,
        player: remotePlayer,
      }));
    }

    return remotePlayers
      .map((remotePlayer) => ({
        distance:
          Math.abs(remotePlayer.x - player.location.positionX) +
          Math.abs(remotePlayer.y - player.location.positionY),
        player: remotePlayer,
      }))
      .sort((left, right) => left.distance - right.distance)
      .filter(
        (entry, index) =>
          entry.distance <= RELEVANT_REMOTE_PLAYER_MAX_DISTANCE ||
          index < RELEVANT_REMOTE_PLAYER_MIN_COUNT,
      )
      .slice(0, RELEVANT_REMOTE_PLAYER_MAX_COUNT);
  }, [player, realtimeSnapshot.players]);

  return {
    eventResults,
    eventRuntimeState,
    isLoading,
    loadHomeData,
    realtimeSnapshot,
    relevantRemotePlayers,
    propertySlots,
    roundInflation,
    roundLeaderboard,
    roundSummary,
    territoryOverview,
  };
}
