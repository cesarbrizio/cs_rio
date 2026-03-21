import { useCallback, useRef } from 'react';

import {
  loadSeenActivityResultKeys,
} from '../features/activity-result-storage';
import {
  loadSeenEventResultKeys,
} from '../features/event-result-storage';
import {
  loadSeenFactionPromotionKeys,
} from '../features/faction-promotion-storage';
import {
  loadSeenPrivateMessageIds,
} from '../features/private-message-storage';
import {
  loadSeenTerritoryAlertKeys,
} from '../features/territory-alert-storage';
import {
  loadSeenTerritoryLossKeys,
} from '../features/territory-loss-storage';
import {
  loadSeenTribunalCueKeys,
} from '../features/tribunal-result-storage';
import {
  loadSeenWarResultKeys,
} from '../features/war-result-storage';

export function usePollSeenState(playerId: string | null | undefined) {
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventFeedPrimedRef = useRef(false);
  const privateMessageFeedPrimedRef = useRef(false);
  const seenActivityResultKeysRef = useRef<Set<string>>(new Set());
  const seenActivityResultPlayerIdRef = useRef<string | null>(null);
  const seenEventResultKeysRef = useRef<Set<string>>(new Set());
  const seenEventResultPlayerIdRef = useRef<string | null>(null);
  const seenFactionPromotionKeysRef = useRef<Set<string>>(new Set());
  const seenFactionPromotionPlayerIdRef = useRef<string | null>(null);
  const seenPrivateMessageIdsRef = useRef<Set<string>>(new Set());
  const seenPrivateMessagePlayerIdRef = useRef<string | null>(null);
  const seenTerritoryAlertKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryAlertPlayerIdRef = useRef<string | null>(null);
  const seenTerritoryLossKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryLossPlayerIdRef = useRef<string | null>(null);
  const seenTribunalCueKeysRef = useRef<Set<string>>(new Set());
  const seenTribunalCuePlayerIdRef = useRef<string | null>(null);
  const seenWarResultKeysRef = useRef<Set<string>>(new Set());
  const seenWarResultPlayerIdRef = useRef<string | null>(null);

  const ensurePlayerScopedSetLoaded = useCallback(async (
    keysRef: { current: Set<string> },
    ownerRef: { current: string | null },
    load: (nextPlayerId: string) => Promise<Set<string>>,
    options?: { resetPrimedPrivateMessages?: boolean },
  ) => {
    if (!playerId) {
      keysRef.current = new Set();
      ownerRef.current = null;
      if (options?.resetPrimedPrivateMessages) {
        privateMessageFeedPrimedRef.current = false;
      }
      return;
    }

    if (ownerRef.current === playerId) {
      return;
    }

    keysRef.current = await load(playerId);
    ownerRef.current = playerId;

    if (options?.resetPrimedPrivateMessages) {
      privateMessageFeedPrimedRef.current = false;
    }
  }, [playerId]);

  const ensureSeenEventResultsLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenEventResultKeysRef,
      seenEventResultPlayerIdRef,
      loadSeenEventResultKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenTerritoryLossesLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenTerritoryLossKeysRef,
      seenTerritoryLossPlayerIdRef,
      loadSeenTerritoryLossKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenTerritoryAlertsLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenTerritoryAlertKeysRef,
      seenTerritoryAlertPlayerIdRef,
      loadSeenTerritoryAlertKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenPrivateMessagesLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenPrivateMessageIdsRef,
      seenPrivateMessagePlayerIdRef,
      loadSeenPrivateMessageIds,
      { resetPrimedPrivateMessages: true },
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenTribunalCuesLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenTribunalCueKeysRef,
      seenTribunalCuePlayerIdRef,
      loadSeenTribunalCueKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenFactionPromotionsLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenFactionPromotionKeysRef,
      seenFactionPromotionPlayerIdRef,
      loadSeenFactionPromotionKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenWarResultsLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenWarResultKeysRef,
      seenWarResultPlayerIdRef,
      loadSeenWarResultKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const ensureSeenActivityResultsLoaded = useCallback(async () => {
    await ensurePlayerScopedSetLoaded(
      seenActivityResultKeysRef,
      seenActivityResultPlayerIdRef,
      loadSeenActivityResultKeys,
    );
  }, [ensurePlayerScopedSetLoaded]);

  const resetSeenState = useCallback(() => {
    eventFeedPrimedRef.current = false;
    privateMessageFeedPrimedRef.current = false;
    seenActivityResultKeysRef.current.clear();
    seenActivityResultPlayerIdRef.current = null;
    seenEventIdsRef.current.clear();
    seenEventResultKeysRef.current.clear();
    seenEventResultPlayerIdRef.current = null;
    seenFactionPromotionKeysRef.current.clear();
    seenFactionPromotionPlayerIdRef.current = null;
    seenPrivateMessageIdsRef.current.clear();
    seenPrivateMessagePlayerIdRef.current = null;
    seenTerritoryAlertKeysRef.current.clear();
    seenTerritoryAlertPlayerIdRef.current = null;
    seenTerritoryLossKeysRef.current.clear();
    seenTerritoryLossPlayerIdRef.current = null;
    seenTribunalCueKeysRef.current.clear();
    seenTribunalCuePlayerIdRef.current = null;
    seenWarResultKeysRef.current.clear();
    seenWarResultPlayerIdRef.current = null;
  }, []);

  return {
    ensureSeenActivityResultsLoaded,
    ensureSeenEventResultsLoaded,
    ensureSeenFactionPromotionsLoaded,
    ensureSeenPrivateMessagesLoaded,
    ensureSeenTerritoryAlertsLoaded,
    ensureSeenTerritoryLossesLoaded,
    ensureSeenTribunalCuesLoaded,
    ensureSeenWarResultsLoaded,
    eventFeedPrimedRef,
    privateMessageFeedPrimedRef,
    resetSeenState,
    seenActivityResultKeysRef,
    seenEventIdsRef,
    seenEventResultKeysRef,
    seenFactionPromotionKeysRef,
    seenPrivateMessageIdsRef,
    seenTerritoryAlertKeysRef,
    seenTerritoryLossKeysRef,
    seenTribunalCueKeysRef,
    seenWarResultKeysRef,
  };
}
