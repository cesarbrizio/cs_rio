import {
  type NpcInflationSummary,
  type PlayerProfile,
  type RoundSummary,
} from '@cs-rio/shared';
import { useCallback, useEffect, useState } from 'react';

import {
  colyseusService,
  type RealtimeSnapshot,
} from '../../services/colyseus';
import { eventApi, roundApi, territoryApi } from '../../services/api';
import { type EventRuntimeState } from './homeTypes';

type TerritoryOverview = Awaited<ReturnType<typeof territoryApi.list>>;

interface UseHomeMapDataInput {
  hasCharacter: boolean;
  regionId: PlayerProfile['regionId'] | null | undefined;
  token: string | null;
}

interface UseHomeMapDataResult {
  eventRuntimeState: EventRuntimeState | null;
  realtimeSnapshot: RealtimeSnapshot;
  refreshHomeMapData: (cancelled?: () => boolean) => Promise<void>;
  roundInflation: NpcInflationSummary | null;
  roundSummary: RoundSummary | null;
  territoryOverview: TerritoryOverview | null;
}

export function useHomeMapData({
  hasCharacter,
  regionId,
  token,
}: UseHomeMapDataInput): UseHomeMapDataResult {
  const [territoryOverview, setTerritoryOverview] = useState<TerritoryOverview | null>(null);
  const [eventRuntimeState, setEventRuntimeState] = useState<EventRuntimeState | null>(null);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>(
    colyseusService.getSnapshot(),
  );
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [roundInflation, setRoundInflation] = useState<NpcInflationSummary | null>(null);

  const loadRoundSummary = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await roundApi.getCenter();

      if (!cancelled?.()) {
        setRoundInflation(response.npcInflation);
        setRoundSummary(response.round);
      }
    } catch {
      // Keep the round pill on placeholder copy until the center endpoint recovers.
      // Keep the HUD on placeholder copy while the center endpoint is unavailable.
    }
  }, []);

  const loadTerritoryOverview = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await territoryApi.list();

      if (!cancelled?.()) {
        setTerritoryOverview(response);
      }
    } catch {
      // Hide territorial overlays when the overview endpoint is unavailable.
      if (!cancelled?.()) {
        setTerritoryOverview(null);
      }
    }
  }, []);

  const loadEventRuntimeState = useCallback(async (cancelled?: () => boolean) => {
    try {
      const [docks, police, seasonal] = await Promise.all([
        eventApi.getDocksStatus(),
        eventApi.getPoliceStatus(),
        eventApi.getSeasonalStatus(),
      ]);

      if (!cancelled?.()) {
        setEventRuntimeState({
          docks,
          police,
          seasonal,
        });
      }
    } catch {
      // Clear event overlays when runtime status is unavailable to avoid stale highlights.
      if (!cancelled?.()) {
        setEventRuntimeState(null);
      }
    }
  }, []);

  const refreshHomeMapData = useCallback(
    async (cancelled?: () => boolean) => {
      await Promise.all([
        loadRoundSummary(cancelled),
        loadTerritoryOverview(cancelled),
        loadEventRuntimeState(cancelled),
      ]);
    },
    [loadEventRuntimeState, loadRoundSummary, loadTerritoryOverview],
  );

  useEffect(() => colyseusService.subscribe(setRealtimeSnapshot), []);

  useEffect(() => {
    if (!hasCharacter || !token || !regionId) {
      return;
    }

    void colyseusService.connectToRegionRoom({
      accessToken: token,
      regionId,
    });

    return () => {
      void colyseusService.disconnect();
    };
  }, [hasCharacter, regionId, token]);

  return {
    eventRuntimeState,
    realtimeSnapshot,
    refreshHomeMapData,
    roundInflation,
    roundSummary,
    territoryOverview,
  };
}
