import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildPendingActivityCues,
  type AsyncActivityCue,
} from '../features/activity-results';
import {
  loadSeenActivityResultKeys,
  rememberSeenActivityResult,
} from '../features/activity-result-storage';
import {
  buildPendingEventResultCues,
  type EventResultCue,
} from '../features/event-results';
import {
  loadSeenEventResultKeys,
  rememberSeenEventResult,
} from '../features/event-result-storage';
import { buildEventFeed } from '../features/events';
import {
  buildFactionPromotionCueFromSummary,
  type FactionPromotionCue,
} from '../features/faction-promotion';
import {
  buildPendingPrivateMessageCues,
} from '../features/private-messages';
import {
  loadSeenPrivateMessageIds,
  rememberSeenPrivateMessage,
} from '../features/private-message-storage';
import {
  buildPendingSabotageCues,
  type SabotageCue,
} from '../features/sabotage';
import {
  loadSeenSabotageCueKeys,
  rememberSeenSabotageCue,
} from '../features/sabotage-storage';
import {
  buildPendingTerritoryLossCues,
  type TerritoryLossCue,
} from '../features/territory-loss';
import {
  loadSeenTerritoryLossKeys,
  rememberSeenTerritoryLoss,
} from '../features/territory-loss-storage';
import { canPlayerLeadTribunal } from '../features/tribunal';
import {
  buildPendingTribunalCues,
  type TribunalCue,
} from '../features/tribunal-results';
import {
  loadSeenTribunalCueKeys,
  rememberSeenTribunalCue,
} from '../features/tribunal-result-storage';
import {
  buildPendingWarResultCues,
  type WarResultCue,
} from '../features/war-results';
import {
  loadSeenWarResultKeys,
  rememberSeenWarResult,
} from '../features/war-result-storage';
import { type useAudio } from '../audio/AudioProvider';
import { type useNotifications } from '../notifications/NotificationProvider';
import {
  eventApi,
  factionApi,
  privateMessageApi,
  propertyApi,
  pvpApi,
  territoryApi,
  trainingApi,
  tribunalApi,
  universityApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useEventFeedStore } from '../stores/eventFeedStore';
import { useUIStore } from '../stores/uiStore';

type AudioApi = ReturnType<typeof useAudio>;
type NotificationsApi = ReturnType<typeof useNotifications>;

interface PollManagerInput {
  notifyAttack: NotificationsApi['notifyAttack'];
  notifyEvent: NotificationsApi['notifyEvent'];
  notifyEventResult: NotificationsApi['notifyEventResult'];
  notifyFactionPromotion: NotificationsApi['notifyFactionPromotion'];
  notifyPrivateMessage: NotificationsApi['notifyPrivateMessage'];
  notifySabotageCue: NotificationsApi['notifySabotageCue'];
  notifyTerritoryLoss: NotificationsApi['notifyTerritoryLoss'];
  notifyTribunalCue: NotificationsApi['notifyTribunalCue'];
  notifyWarResult: NotificationsApi['notifyWarResult'];
  playSfx: AudioApi['playSfx'];
  syncRegionMusic: AudioApi['syncRegionMusic'];
  syncTimerNotifications: NotificationsApi['syncTimerNotifications'];
  syncTrainingNotifications: NotificationsApi['syncTrainingNotifications'];
  syncUniversityNotifications: NotificationsApi['syncUniversityNotifications'];
}

interface PollManagerResult {
  activeActivityCue: AsyncActivityCue | null;
  activeEventResultCue: EventResultCue | null;
  activeFactionPromotionCue: FactionPromotionCue | null;
  activeSabotageCue: SabotageCue | null;
  activeTerritoryLossCue: TerritoryLossCue | null;
  activeTribunalCue: TribunalCue | null;
  activeWarResultCue: WarResultCue | null;
  closeActivityCue: () => void;
  closeEventResultCue: () => void;
  closeFactionPromotionCue: () => void;
  closeSabotageCue: () => void;
  closeTerritoryLossCue: () => void;
  closeTribunalCue: () => void;
  closeWarResultCue: () => void;
}

export function usePollManager({
  notifyAttack,
  notifyEvent,
  notifyEventResult,
  notifyFactionPromotion,
  notifyPrivateMessage,
  notifySabotageCue,
  notifyTerritoryLoss,
  notifyTribunalCue,
  notifyWarResult,
  playSfx,
  syncRegionMusic,
  syncTimerNotifications,
  syncTrainingNotifications,
  syncUniversityNotifications,
}: PollManagerInput): PollManagerResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const resetEventFeed = useEventFeedStore((state) => state.resetEventFeed);
  const resetPrivateMessageFeed = useEventFeedStore((state) => state.resetPrivateMessageFeed);
  const setEventFeed = useEventFeedStore((state) => state.setEventFeed);
  const setEventResultFeed = useEventFeedStore((state) => state.setEventResultFeed);
  const setPrivateMessageFeed = useEventFeedStore((state) => state.setPrivateMessageFeed);
  const showEventToast = useEventFeedStore((state) => state.showEventToast);
  const setBootstrapStatus = useUIStore((state) => state.setBootstrapStatus);
  const seenContractNotificationIdsRef = useRef<Set<string>>(new Set());
  const contractFeedPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventFeedPrimedRef = useRef(false);
  const privateMessageFeedPrimedRef = useRef(false);
  const seenActivityResultKeysRef = useRef<Set<string>>(new Set());
  const seenActivityResultPlayerIdRef = useRef<string | null>(null);
  const seenEventResultKeysRef = useRef<Set<string>>(new Set());
  const seenEventResultPlayerIdRef = useRef<string | null>(null);
  const seenPrivateMessageIdsRef = useRef<Set<string>>(new Set());
  const seenPrivateMessagePlayerIdRef = useRef<string | null>(null);
  const seenSabotageCueKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryLossKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryLossPlayerIdRef = useRef<string | null>(null);
  const seenTribunalCueKeysRef = useRef<Set<string>>(new Set());
  const seenTribunalCuePlayerIdRef = useRef<string | null>(null);
  const seenWarResultKeysRef = useRef<Set<string>>(new Set());
  const seenWarResultPlayerIdRef = useRef<string | null>(null);
  const [activeActivityCue, setActiveActivityCue] = useState<AsyncActivityCue | null>(null);
  const [activeEventResultCue, setActiveEventResultCue] = useState<EventResultCue | null>(null);
  const [activeFactionPromotionCue, setActiveFactionPromotionCue] = useState<FactionPromotionCue | null>(null);
  const [activeSabotageCue, setActiveSabotageCue] = useState<SabotageCue | null>(null);
  const [activeTerritoryLossCue, setActiveTerritoryLossCue] = useState<TerritoryLossCue | null>(null);
  const [activeTribunalCue, setActiveTribunalCue] = useState<TribunalCue | null>(null);
  const [activeWarResultCue, setActiveWarResultCue] = useState<WarResultCue | null>(null);

  const hasBlockingCue = Boolean(
    activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue,
  );

  const ensureSeenEventResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenEventResultKeysRef.current = new Set();
      seenEventResultPlayerIdRef.current = null;
      return;
    }

    if (seenEventResultPlayerIdRef.current === player.id) {
      return;
    }

    seenEventResultKeysRef.current = await loadSeenEventResultKeys(player.id);
    seenEventResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenTerritoryLossesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenTerritoryLossKeysRef.current = new Set();
      seenTerritoryLossPlayerIdRef.current = null;
      return;
    }

    if (seenTerritoryLossPlayerIdRef.current === player.id) {
      return;
    }

    seenTerritoryLossKeysRef.current = await loadSeenTerritoryLossKeys(player.id);
    seenTerritoryLossPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenPrivateMessagesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenPrivateMessageIdsRef.current = new Set();
      seenPrivateMessagePlayerIdRef.current = null;
      return;
    }

    if (seenPrivateMessagePlayerIdRef.current === player.id) {
      return;
    }

    seenPrivateMessageIdsRef.current = await loadSeenPrivateMessageIds(player.id);
    seenPrivateMessagePlayerIdRef.current = player.id;
    privateMessageFeedPrimedRef.current = false;
  }, [player?.id]);

  const refreshSeenSabotageCues = useCallback(async () => {
    if (!player?.id) {
      seenSabotageCueKeysRef.current = new Set();
      return;
    }

    seenSabotageCueKeysRef.current = await loadSeenSabotageCueKeys(player.id);
  }, [player?.id]);

  const ensureSeenTribunalCuesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenTribunalCueKeysRef.current = new Set();
      seenTribunalCuePlayerIdRef.current = null;
      return;
    }

    if (seenTribunalCuePlayerIdRef.current === player.id) {
      return;
    }

    seenTribunalCueKeysRef.current = await loadSeenTribunalCueKeys(player.id);
    seenTribunalCuePlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenWarResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenWarResultKeysRef.current = new Set();
      seenWarResultPlayerIdRef.current = null;
      return;
    }

    if (seenWarResultPlayerIdRef.current === player.id) {
      return;
    }

    seenWarResultKeysRef.current = await loadSeenWarResultKeys(player.id);
    seenWarResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenActivityResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenActivityResultKeysRef.current = new Set();
      seenActivityResultPlayerIdRef.current = null;
      return;
    }

    if (seenActivityResultPlayerIdRef.current === player.id) {
      return;
    }

    seenActivityResultKeysRef.current = await loadSeenActivityResultKeys(player.id);
    seenActivityResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const pollEventFeed = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter) {
      return;
    }

    const [docks, police, seasonal] = await Promise.all([
      eventApi.getDocksStatus(),
      eventApi.getPoliceStatus(),
      eventApi.getSeasonalStatus(),
    ]);
    const feed = buildEventFeed({
      docks,
      police,
      seasonal,
    });

    setEventFeed(feed);

    if (!eventFeedPrimedRef.current) {
      for (const notification of feed.notifications) {
        seenEventIdsRef.current.add(notification.id);
      }
      eventFeedPrimedRef.current = true;
      return;
    }

    const newNotifications = feed.notifications.filter(
      (notification) => !seenEventIdsRef.current.has(notification.id),
    );

    if (newNotifications.length === 0) {
      return;
    }

    for (const notification of newNotifications) {
      seenEventIdsRef.current.add(notification.id);
    }

    showEventToast(newNotifications[0]);
    void playSfx('notification');
    void notifyEvent(newNotifications[0]);
  }, [isAuthenticated, notifyEvent, playSfx, player?.hasCharacter, setEventFeed, showEventToast]);

  const pollEventResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenEventResultsLoaded();

    const results = await eventApi.getResults();
    setEventResultFeed(results);

    if (hasBlockingCue) {
      return;
    }

    const cues = buildPendingEventResultCues({
      results,
      seenKeys: seenEventResultKeysRef.current,
    });
    const nextCue = cues[0];

    if (!nextCue) {
      return;
    }

    seenEventResultKeysRef.current = await rememberSeenEventResult(player.id, nextCue.key);
    setActiveEventResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyEventResult(nextCue);
  }, [
    ensureSeenEventResultsLoaded,
    hasBlockingCue,
    isAuthenticated,
    notifyEventResult,
    player,
    setBootstrapStatus,
    setEventResultFeed,
  ]);

  const pollPrivateMessages = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenPrivateMessagesLoaded();

    const feed = await privateMessageApi.listThreads();
    setPrivateMessageFeed(feed);

    const pendingCues = buildPendingPrivateMessageCues({
      feed,
      seenMessageIds: seenPrivateMessageIdsRef.current,
    });

    if (!privateMessageFeedPrimedRef.current) {
      for (const cue of pendingCues) {
        seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(player.id, cue.messageId);
      }
      privateMessageFeedPrimedRef.current = true;
      return;
    }

    const nextCue = pendingCues[0];

    if (!nextCue) {
      return;
    }

    seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(player.id, nextCue.messageId);
    setBootstrapStatus(`${nextCue.contactNickname} te mandou uma mensagem privada.`);
    void notifyPrivateMessage(nextCue);
  }, [
    ensureSeenPrivateMessagesLoaded,
    isAuthenticated,
    notifyPrivateMessage,
    player?.hasCharacter,
    player?.id,
    setBootstrapStatus,
    setPrivateMessageFeed,
  ]);

  const pollSabotageCues = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await refreshSeenSabotageCues();

    if (hasBlockingCue) {
      return;
    }

    const center = await propertyApi.getSabotageCenter();
    const nextCue = buildPendingSabotageCues({
      center,
      playerId: player.id,
      seenKeys: seenSabotageCueKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenSabotageCueKeysRef.current = await rememberSeenSabotageCue(player.id, nextCue.key);
    setActiveSabotageCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifySabotageCue(nextCue);
    void refreshPlayerProfile();
  }, [
    hasBlockingCue,
    isAuthenticated,
    notifySabotageCue,
    player?.hasCharacter,
    player?.id,
    refreshPlayerProfile,
    refreshSeenSabotageCues,
    setBootstrapStatus,
  ]);

  const pollTribunalCues = useCallback(async () => {
    if (
      !isAuthenticated ||
      !player?.hasCharacter ||
      !player.id ||
      !canPlayerLeadTribunal(player.faction?.rank ?? null)
    ) {
      return;
    }

    await ensureSeenTribunalCuesLoaded();

    if (hasBlockingCue) {
      return;
    }

    const feed = await tribunalApi.getCues();
    const nextCue = buildPendingTribunalCues({
      feed,
      seenKeys: seenTribunalCueKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenTribunalCueKeysRef.current = await rememberSeenTribunalCue(player.id, nextCue.key);
    setActiveTribunalCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyTribunalCue(nextCue);

    if (nextCue.kind === 'resolved') {
      void refreshPlayerProfile();
    }
  }, [
    ensureSeenTribunalCuesLoaded,
    hasBlockingCue,
    isAuthenticated,
    notifyTribunalCue,
    player,
    refreshPlayerProfile,
    setBootstrapStatus,
  ]);

  const pollAttackNotifications = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter) {
      return;
    }

    const contractsBook = await pvpApi.listContracts();

    if (!contractFeedPrimedRef.current) {
      for (const notification of contractsBook.notifications) {
        seenContractNotificationIdsRef.current.add(notification.id);
      }
      contractFeedPrimedRef.current = true;
      return;
    }

    const freshNotifications = contractsBook.notifications.filter(
      (notification) => !seenContractNotificationIdsRef.current.has(notification.id),
    );

    if (freshNotifications.length === 0) {
      return;
    }

    for (const notification of freshNotifications) {
      seenContractNotificationIdsRef.current.add(notification.id);
    }

    void notifyAttack(freshNotifications[0]);
  }, [isAuthenticated, notifyAttack, player?.hasCharacter]);

  const pollWarResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await ensureSeenWarResultsLoaded();

    if (hasBlockingCue) {
      return;
    }

    const overview = await territoryApi.list();
    const nextCue = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenWarResultKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenWarResultKeysRef.current = await rememberSeenWarResult(player.id, nextCue.key);
    setActiveWarResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyWarResult(nextCue);
  }, [
    ensureSeenWarResultsLoaded,
    hasBlockingCue,
    isAuthenticated,
    notifyWarResult,
    player,
    setBootstrapStatus,
  ]);

  const pollTerritoryLosses = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await Promise.all([ensureSeenTerritoryLossesLoaded(), ensureSeenWarResultsLoaded()]);

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const [feed, overview] = await Promise.all([territoryApi.getLosses(), territoryApi.list()]);
    const warCues = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenWarResultKeysRef.current,
    });
    const nextResult = buildPendingTerritoryLossCues({
      feed,
      seenKeys: seenTerritoryLossKeysRef.current,
      warCues,
    })[0];

    if (!nextResult) {
      return;
    }

    seenTerritoryLossKeysRef.current = await rememberSeenTerritoryLoss(
      player.id,
      nextResult.cue.key,
    );

    if (nextResult.dedupedByWar) {
      return;
    }

    setActiveTerritoryLossCue(nextResult.cue);
    setBootstrapStatus(nextResult.cue.body);
    void notifyTerritoryLoss(nextResult.cue);
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenTerritoryLossesLoaded,
    ensureSeenWarResultsLoaded,
    isAuthenticated,
    notifyTerritoryLoss,
    player,
    setBootstrapStatus,
  ]);

  const pollAsyncActivityResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenActivityResultsLoaded();

    const [trainingCenter, universityCenter] = await Promise.all([
      trainingApi.getCenter(),
      universityApi.getCenter(),
    ]);

    await Promise.all([
      syncTrainingNotifications(trainingCenter.activeSession),
      syncUniversityNotifications(universityCenter.activeCourse),
    ]);

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const nextCue = buildPendingActivityCues({
      seenKeys: seenActivityResultKeysRef.current,
      trainingCenter,
      universityCenter,
    })[0];

    if (!nextCue) {
      return;
    }

    seenActivityResultKeysRef.current = await rememberSeenActivityResult(player.id, nextCue.key);
    setActiveActivityCue(nextCue);
    setBootstrapStatus(nextCue.body);
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenActivityResultsLoaded,
    isAuthenticated,
    player,
    setBootstrapStatus,
    syncTrainingNotifications,
    syncUniversityNotifications,
  ]);

  const pollFactionPromotionResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id) {
      return;
    }

    if (hasBlockingCue) {
      return;
    }

    const factionsBook = await factionApi.list();
    const currentFaction =
      factionsBook.factions.find((entry) => entry.id === factionsBook.playerFactionId) ?? null;
    const cue = buildFactionPromotionCueFromSummary(currentFaction);

    if (!cue) {
      return;
    }

    setActiveFactionPromotionCue(cue);
    setBootstrapStatus(cue.body);
    void notifyFactionPromotion(cue);
    void refreshPlayerProfile();
  }, [
    hasBlockingCue,
    isAuthenticated,
    notifyFactionPromotion,
    player?.faction?.id,
    player?.hasCharacter,
    refreshPlayerProfile,
    setBootstrapStatus,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncRegionMusic(null);
      return;
    }

    void syncRegionMusic(player.regionId);
  }, [isAuthenticated, player?.hasCharacter, player?.regionId, syncRegionMusic]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      contractFeedPrimedRef.current = false;
      eventFeedPrimedRef.current = false;
      privateMessageFeedPrimedRef.current = false;
      seenActivityResultKeysRef.current.clear();
      seenActivityResultPlayerIdRef.current = null;
      seenContractNotificationIdsRef.current.clear();
      seenEventIdsRef.current.clear();
      seenEventResultKeysRef.current.clear();
      seenEventResultPlayerIdRef.current = null;
      seenPrivateMessageIdsRef.current.clear();
      seenPrivateMessagePlayerIdRef.current = null;
      seenSabotageCueKeysRef.current.clear();
      seenTerritoryLossKeysRef.current.clear();
      seenTerritoryLossPlayerIdRef.current = null;
      seenTribunalCueKeysRef.current.clear();
      seenTribunalCuePlayerIdRef.current = null;
      seenWarResultKeysRef.current.clear();
      seenWarResultPlayerIdRef.current = null;
      setActiveActivityCue(null);
      setActiveEventResultCue(null);
      setActiveFactionPromotionCue(null);
      setActiveSabotageCue(null);
      setActiveTerritoryLossCue(null);
      setActiveTribunalCue(null);
      setActiveWarResultCue(null);
      resetEventFeed();
      resetPrivateMessageFeed();
      void syncTimerNotifications(null);
      void syncTrainingNotifications(null);
      void syncUniversityNotifications(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await Promise.all([
          pollAttackNotifications(),
          pollAsyncActivityResults(),
          pollEventFeed(),
          pollEventResults(),
          pollFactionPromotionResults(),
          pollPrivateMessages(),
          pollSabotageCues(),
          pollTerritoryLosses(),
          pollTribunalCues(),
          pollWarResults(),
        ]);
      } catch {
        if (!cancelled) {
          // Silent fail in pre-alpha: the banner should not block auth or map boot.
        }
      }
    };

    void load();
    const intervalId = setInterval(() => {
      void load();
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    player?.hasCharacter,
    pollAttackNotifications,
    pollAsyncActivityResults,
    pollEventFeed,
    pollEventResults,
    pollFactionPromotionResults,
    pollPrivateMessages,
    pollSabotageCues,
    pollTerritoryLosses,
    pollTribunalCues,
    pollWarResults,
    resetEventFeed,
    resetPrivateMessageFeed,
    syncTimerNotifications,
    syncTrainingNotifications,
    syncUniversityNotifications,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncTimerNotifications(null);
      return;
    }

    void syncTimerNotifications(player);
  }, [
    isAuthenticated,
    player,
    player?.hasCharacter,
    player?.hospitalization?.endsAt,
    player?.hospitalization?.isHospitalized,
    player?.prison?.endsAt,
    player?.prison?.isImprisoned,
    syncTimerNotifications,
  ]);

  return {
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    closeActivityCue: () => setActiveActivityCue(null),
    closeEventResultCue: () => setActiveEventResultCue(null),
    closeFactionPromotionCue: () => setActiveFactionPromotionCue(null),
    closeSabotageCue: () => setActiveSabotageCue(null),
    closeTerritoryLossCue: () => setActiveTerritoryLossCue(null),
    closeTribunalCue: () => setActiveTribunalCue(null),
    closeWarResultCue: () => setActiveWarResultCue(null),
  };
}
