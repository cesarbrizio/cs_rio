import { useCallback } from 'react';

import {
  buildPendingActivityCues,
  type AsyncActivityCue,
} from '../features/activity-results';
import {
  rememberSeenActivityResult,
} from '../features/activity-result-storage';
import {
  buildPendingEventResultCues,
  type EventResultCue,
} from '../features/event-results';
import {
  rememberSeenEventResult,
} from '../features/event-result-storage';
import { buildEventFeed } from '../features/events';
import {
  buildFactionPromotionCueFromSummary,
  type FactionPromotionCue,
} from '../features/faction-promotion';
import {
  rememberSeenFactionPromotion,
} from '../features/faction-promotion-storage';
import {
  buildPendingTerritoryAlertCues,
} from '../features/territory-alerts';
import {
  rememberSeenTerritoryAlert,
} from '../features/territory-alert-storage';
import {
  buildPendingTerritoryLossCues,
  type TerritoryLossCue,
} from '../features/territory-loss';
import {
  rememberSeenTerritoryLoss,
} from '../features/territory-loss-storage';
import { canPlayerLeadTribunal } from '../features/tribunal';
import {
  buildPendingTribunalCues,
  type TribunalCue,
} from '../features/tribunal-results';
import {
  rememberSeenTribunalCue,
} from '../features/tribunal-result-storage';
import {
  buildPendingWarResultCues,
  type WarResultCue,
} from '../features/war-results';
import {
  rememberSeenWarResult,
} from '../features/war-result-storage';
import { type useAudio } from '../audio/AudioProvider';
import { type useNotifications } from '../notifications/NotificationProvider';
import {
  eventApi,
  factionApi,
  territoryApi,
  tribunalApi,
  universityApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useEventFeedStore } from '../stores/eventFeedStore';
import { useUIStore } from '../stores/uiStore';
import {
  pollEventFeedTask,
  pollPrivateMessagesTask,
} from './pollManagerTasks';
import { usePollCueState } from './usePollCueState';
import { usePollManagerLifecycle } from './usePollManagerLifecycle';
import { usePollSeenState } from './usePollSeenState';

type AudioApi = ReturnType<typeof useAudio>;
type NotificationsApi = ReturnType<typeof useNotifications>;

interface PollManagerInput {
  notifyEvent: NotificationsApi['notifyEvent'];
  notifyEventResult: NotificationsApi['notifyEventResult'];
  notifyFactionPromotion: NotificationsApi['notifyFactionPromotion'];
  notifyPrivateMessage: NotificationsApi['notifyPrivateMessage'];
  notifyTerritoryAlert: NotificationsApi['notifyTerritoryAlert'];
  notifyTerritoryLoss: NotificationsApi['notifyTerritoryLoss'];
  notifyTribunalCue: NotificationsApi['notifyTribunalCue'];
  notifyWarResult: NotificationsApi['notifyWarResult'];
  playSfx: AudioApi['playSfx'];
  syncRegionMusic: AudioApi['syncRegionMusic'];
  syncTimerNotifications: NotificationsApi['syncTimerNotifications'];
  syncUniversityNotifications: NotificationsApi['syncUniversityNotifications'];
}

interface PollManagerResult {
  activeActivityCue: AsyncActivityCue | null;
  activeEventResultCue: EventResultCue | null;
  activeFactionPromotionCue: FactionPromotionCue | null;
  activeTerritoryLossCue: TerritoryLossCue | null;
  activeTribunalCue: TribunalCue | null;
  activeWarResultCue: WarResultCue | null;
  closeActivityCue: () => void;
  closeEventResultCue: () => void;
  closeFactionPromotionCue: () => void;
  closeTerritoryLossCue: () => void;
  closeTribunalCue: () => void;
  closeWarResultCue: () => void;
}

export function usePollManager({
  notifyEvent,
  notifyEventResult,
  notifyFactionPromotion,
  notifyPrivateMessage,
  notifyTerritoryAlert,
  notifyTerritoryLoss,
  notifyTribunalCue,
  notifyWarResult,
  playSfx,
  syncRegionMusic,
  syncTimerNotifications,
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
  const cueState = usePollCueState();
  const seenState = usePollSeenState(player?.id);

  const pollEventFeed = useCallback(async () => {
    await pollEventFeedTask({
      eventFeedPrimedRef: seenState.eventFeedPrimedRef,
      isAuthenticated,
      notifyEvent,
      playSfx,
      playerHasCharacter: player?.hasCharacter,
      seenEventIdsRef: seenState.seenEventIdsRef,
      setEventFeed,
      showEventToast,
    });
  }, [isAuthenticated, notifyEvent, playSfx, player?.hasCharacter, setEventFeed, showEventToast]);

  const pollEventResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await seenState.ensureSeenEventResultsLoaded();

    const results = await eventApi.getResults();
    setEventResultFeed(results);

    if (cueState.hasBlockingCue) {
      return;
    }

    const cues = buildPendingEventResultCues({
      results,
      seenKeys: seenState.seenEventResultKeysRef.current,
    });
    const nextCue = cues[0];

    if (!nextCue) {
      return;
    }

    seenState.seenEventResultKeysRef.current = await rememberSeenEventResult(player.id, nextCue.key);
    cueState.setActiveEventResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyEventResult(nextCue);
  }, [
    cueState,
    isAuthenticated,
    notifyEventResult,
    player,
    seenState,
    setBootstrapStatus,
    setEventResultFeed,
  ]);

  const pollPrivateMessages = useCallback(async () => {
    await pollPrivateMessagesTask({
      ensureSeenPrivateMessagesLoaded: seenState.ensureSeenPrivateMessagesLoaded,
      isAuthenticated,
      notifyPrivateMessage,
      playerHasCharacter: player?.hasCharacter,
      playerId: player?.id,
      privateMessageFeedPrimedRef: seenState.privateMessageFeedPrimedRef,
      seenPrivateMessageIdsRef: seenState.seenPrivateMessageIdsRef,
      setBootstrapStatus,
      setPrivateMessageFeed,
    });
  }, [
    isAuthenticated,
    notifyPrivateMessage,
    player?.hasCharacter,
    player?.id,
    seenState,
    setBootstrapStatus,
    setPrivateMessageFeed,
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

    await seenState.ensureSeenTribunalCuesLoaded();

    if (cueState.hasBlockingCue) {
      return;
    }

    const feed = await tribunalApi.getCues();
    const nextCue = buildPendingTribunalCues({
      feed,
      seenKeys: seenState.seenTribunalCueKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenState.seenTribunalCueKeysRef.current = await rememberSeenTribunalCue(player.id, nextCue.key);
    cueState.setActiveTribunalCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyTribunalCue(nextCue);

    if (nextCue.kind === 'resolved') {
      void refreshPlayerProfile();
    }
  }, [
    cueState,
    isAuthenticated,
    notifyTribunalCue,
    player,
    refreshPlayerProfile,
    seenState,
    setBootstrapStatus,
  ]);

  const pollWarResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await Promise.all([
      seenState.ensureSeenTerritoryAlertsLoaded(),
      seenState.ensureSeenWarResultsLoaded(),
    ]);

    const overview = await territoryApi.list();
    const territoryAlert = buildPendingTerritoryAlertCues({
      overview,
      player,
      seenKeys: seenState.seenTerritoryAlertKeysRef.current,
    })[0];

    if (territoryAlert) {
      seenState.seenTerritoryAlertKeysRef.current = await rememberSeenTerritoryAlert(
        player.id,
        territoryAlert.key,
      );

      if (!cueState.hasBlockingCue) {
        setBootstrapStatus(territoryAlert.body);
      }

      void notifyTerritoryAlert(territoryAlert);
    }

    if (cueState.hasBlockingCue) {
      return;
    }

    const nextCue = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenState.seenWarResultKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenState.seenWarResultKeysRef.current = await rememberSeenWarResult(player.id, nextCue.key);
    cueState.setActiveWarResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyWarResult(nextCue);
  }, [
    cueState,
    isAuthenticated,
    notifyTerritoryAlert,
    notifyWarResult,
    player,
    seenState,
    setBootstrapStatus,
  ]);

  const pollTerritoryLosses = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await Promise.all([
      seenState.ensureSeenTerritoryLossesLoaded(),
      seenState.ensureSeenWarResultsLoaded(),
    ]);

    if (
      cueState.activeEventResultCue ||
      cueState.activeWarResultCue ||
      cueState.activeActivityCue ||
      cueState.activeFactionPromotionCue ||
      cueState.activeTerritoryLossCue ||
      cueState.activeTribunalCue
    ) {
      return;
    }

    const [feed, overview] = await Promise.all([territoryApi.getLosses(), territoryApi.list()]);
    const warCues = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenState.seenWarResultKeysRef.current,
    });
    const nextResult = buildPendingTerritoryLossCues({
      feed,
      seenKeys: seenState.seenTerritoryLossKeysRef.current,
      warCues,
    })[0];

    if (!nextResult) {
      return;
    }

    seenState.seenTerritoryLossKeysRef.current = await rememberSeenTerritoryLoss(
      player.id,
      nextResult.cue.key,
    );

    if (nextResult.dedupedByWar) {
      return;
    }

    cueState.setActiveTerritoryLossCue(nextResult.cue);
    setBootstrapStatus(nextResult.cue.body);
    void notifyTerritoryLoss(nextResult.cue);
  }, [
    cueState,
    isAuthenticated,
    notifyTerritoryLoss,
    player,
    seenState,
    setBootstrapStatus,
  ]);

  const pollAsyncActivityResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await seenState.ensureSeenActivityResultsLoaded();

    const universityCenter = await universityApi.getCenter();

    await syncUniversityNotifications(universityCenter.activeCourse);

    if (
      cueState.activeEventResultCue ||
      cueState.activeWarResultCue ||
      cueState.activeActivityCue ||
      cueState.activeTerritoryLossCue ||
      cueState.activeTribunalCue
    ) {
      return;
    }

    const nextCue = buildPendingActivityCues({
      seenKeys: seenState.seenActivityResultKeysRef.current,
      universityCenter,
    })[0];

    if (!nextCue) {
      return;
    }

    seenState.seenActivityResultKeysRef.current = await rememberSeenActivityResult(player.id, nextCue.key);
    cueState.setActiveActivityCue(nextCue);
    setBootstrapStatus(nextCue.body);
  }, [
    cueState,
    isAuthenticated,
    player,
    seenState,
    setBootstrapStatus,
    syncUniversityNotifications,
  ]);

  const pollFactionPromotionResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await seenState.ensureSeenFactionPromotionsLoaded();

    if (cueState.hasBlockingCue) {
      return;
    }

    const factionsBook = await factionApi.list();
    const currentFaction =
      factionsBook.factions.find((entry) => entry.id === factionsBook.playerFactionId) ?? null;
    const cue = buildFactionPromotionCueFromSummary(currentFaction);

    if (!cue) {
      return;
    }

    if (seenState.seenFactionPromotionKeysRef.current.has(cue.key)) {
      return;
    }

    seenState.seenFactionPromotionKeysRef.current = await rememberSeenFactionPromotion(player.id, cue.key);
    cueState.setActiveFactionPromotionCue(cue);
    setBootstrapStatus(cue.body);
    void notifyFactionPromotion(cue);
    void refreshPlayerProfile();
  }, [
    cueState,
    isAuthenticated,
    notifyFactionPromotion,
    player?.id,
    player?.faction?.id,
    player?.hasCharacter,
    refreshPlayerProfile,
    seenState,
    setBootstrapStatus,
  ]);

  const pollAll = useCallback(async () => {
    await Promise.all([
      pollAsyncActivityResults(),
      pollEventFeed(),
      pollEventResults(),
      pollFactionPromotionResults(),
      pollPrivateMessages(),
      pollTerritoryLosses(),
      pollTribunalCues(),
      pollWarResults(),
    ]);
  }, [
    pollAsyncActivityResults,
    pollEventFeed,
    pollEventResults,
    pollFactionPromotionResults,
    pollPrivateMessages,
    pollTerritoryLosses,
    pollTribunalCues,
    pollWarResults,
  ]);

  usePollManagerLifecycle({
    clearState: () => {
      seenState.resetSeenState();
      cueState.clearAllCues();
    },
    isAuthenticated,
    player,
    pollAll,
    resetEventFeed,
    resetPrivateMessageFeed,
    syncRegionMusic,
    syncTimerNotifications,
    syncUniversityNotifications,
  });

  return {
    activeActivityCue: cueState.activeActivityCue,
    activeEventResultCue: cueState.activeEventResultCue,
    activeFactionPromotionCue: cueState.activeFactionPromotionCue,
    activeTerritoryLossCue: cueState.activeTerritoryLossCue,
    activeTribunalCue: cueState.activeTribunalCue,
    activeWarResultCue: cueState.activeWarResultCue,
    closeActivityCue: cueState.closeActivityCue,
    closeEventResultCue: cueState.closeEventResultCue,
    closeFactionPromotionCue: cueState.closeFactionPromotionCue,
    closeTerritoryLossCue: cueState.closeTerritoryLossCue,
    closeTribunalCue: cueState.closeTribunalCue,
    closeWarResultCue: cueState.closeWarResultCue,
  };
}
