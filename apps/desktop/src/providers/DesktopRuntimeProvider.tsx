import {
  NotificationOrchestrator,
  buildAsyncActivityNotificationDraft,
  buildEventFeed,
  buildEventNotificationDraft,
  buildEventResultNotificationDraft,
  buildFactionPromotionCueFromSummary,
  buildFactionPromotionNotificationDraft,
  buildPendingActivityCues,
  buildPendingEventResultCues,
  buildPendingPrivateMessageCues,
  buildPendingTerritoryAlertCues,
  buildPendingTerritoryLossCues,
  buildPendingTribunalCues,
  buildPendingWarResultCues,
  buildPrivateMessageNotificationDraft,
  buildTerritoryAlertNotificationDraft,
  buildTerritoryLossNotificationDraft,
  buildTimerNotificationDrafts,
  buildTribunalCueNotificationDraft,
  buildWarResultNotificationDraft,
} from '@cs-rio/domain/notify';
import {
  loadSeenActivityResultKeys,
  loadSeenEventResultKeys,
  loadSeenFactionPromotionKeys,
  loadSeenPrivateMessageIds,
  loadSeenTerritoryAlertKeys,
  loadSeenTerritoryLossKeys,
  loadSeenTribunalCueKeys,
  loadSeenWarResultKeys,
  rememberSeenActivityResult,
  rememberSeenEventResult,
  rememberSeenFactionPromotion,
  rememberSeenPrivateMessage,
  rememberSeenTerritoryAlert,
  rememberSeenTerritoryLoss,
  rememberSeenTribunalCue,
  rememberSeenWarResult,
} from '@cs-rio/domain/features';
import { usePlatform } from '@cs-rio/ui';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { useToast } from '../components/ui';
import {
  eventApi,
  factionApi,
  privateMessageApi,
  territoryApi,
  tribunalApi,
  universityApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import { DESKTOP_REGION_MUSIC_TRACKS } from '../runtime/audioCatalog';

const POLL_INTERVAL_MS = 60_000;

interface DesktopRuntimeProviderProps {
  children: ReactNode;
}

export function DesktopRuntimeProvider({
  children,
}: DesktopRuntimeProviderProps): JSX.Element {
  const platform = usePlatform();
  const { pushToast } = useToast();
  const player = useAuthStore((state) => state.player);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const audioSettings = useDesktopRuntimeStore((state) => state.audioSettings);
  const hasHydrated = useDesktopRuntimeStore((state) => state.hasHydrated);
  const hydratePreferences = useDesktopRuntimeStore((state) => state.hydratePreferences);
  const notificationSettings = useDesktopRuntimeStore((state) => state.notificationSettings);
  const pushNotificationHistory = useDesktopRuntimeStore((state) => state.pushNotificationHistory);
  const setNotificationPermissionStatus = useDesktopRuntimeStore((state) => state.setNotificationPermissionStatus);
  const orchestrator = useMemo(() => new NotificationOrchestrator(platform.notify), [platform.notify]);
  const seenEventNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  useEffect(() => {
    void platform.audio.setMusicVolume(
      audioSettings.musicEnabled ? audioSettings.musicVolume / 100 : 0,
    );
    void platform.audio.setSfxVolume(
      audioSettings.sfxEnabled ? audioSettings.sfxVolume / 100 : 0,
    );
  }, [audioSettings, platform.audio]);

  useEffect(() => {
    if (!audioSettings.musicEnabled || !player?.regionId) {
      void platform.audio.stopMusic();
      return;
    }

    void platform.audio.playMusic(DESKTOP_REGION_MUSIC_TRACKS[player.regionId], {
      loop: true,
      volume: audioSettings.musicVolume / 100,
    });
  }, [audioSettings.musicEnabled, audioSettings.musicVolume, platform.audio, player?.regionId]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    let isActive = true;

    const probePermission = async (): Promise<void> => {
      try {
        const granted = await orchestrator.hasPermission();

        if (isActive) {
          setNotificationPermissionStatus(granted ? 'granted' : 'undetermined');
        }
      } catch {
        if (isActive) {
          setNotificationPermissionStatus('undetermined');
        }
      }
    };

    void probePermission();

    return () => {
      isActive = false;
    };
  }, [hasHydrated, orchestrator, setNotificationPermissionStatus]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !player?.id) {
      void orchestrator.cancelAll();
      return;
    }

    let isCancelled = false;

    const emitDraft = async (
      draft: {
        body: string;
        key: string;
        title: string;
      },
      meta: {
        kind: string;
        tone: 'danger' | 'info' | 'success' | 'warning';
      },
    ): Promise<void> => {
      pushNotificationHistory({
        body: draft.body,
        kind: meta.kind,
        title: draft.title,
        tone: meta.tone,
      });

      if (!notificationSettings.enabled || isCancelled) {
        return;
      }

      pushToast({
        description: draft.body,
        title: draft.title,
        tone: meta.tone,
      });
      await platform.audio.playSfx('notification');
      await orchestrator.showDraft(draft, {
        enabled: notificationSettings.permissionStatus === 'granted',
      });
    };

    const poll = async (): Promise<void> => {
      const [
        universityResult,
        privateMessageResult,
        factionResult,
        tribunalResult,
        eventResultsResult,
        territoryOverviewResult,
        territoryLossResult,
        docksResult,
        policeResult,
        seasonalResult,
      ] = await Promise.allSettled([
        universityApi.getCenter(),
        privateMessageApi.listThreads(),
        factionApi.list(),
        tribunalApi.getCues(),
        eventApi.getResults(),
        territoryApi.list(),
        territoryApi.getLosses(),
        eventApi.getDocksStatus(),
        eventApi.getPoliceStatus(),
        eventApi.getSeasonalStatus(),
      ]);

      if (isCancelled) {
        return;
      }

      const universityCenter = universityResult.status === 'fulfilled' ? universityResult.value : null;

      await orchestrator.syncScheduledDrafts({
        drafts: buildTimerNotificationDrafts({
          player,
          universityCourse: universityCenter?.activeCourse,
        }),
        enabled: notificationSettings.enabled && notificationSettings.permissionStatus === 'granted',
      });

      if (universityCenter) {
        const seenActivityKeys = await loadSeenActivityResultKeys(platform.storage, player.id);
        const activityCues = buildPendingActivityCues({
          seenKeys: seenActivityKeys,
          universityCenter,
        });

        for (const cue of activityCues) {
          await emitDraft(buildAsyncActivityNotificationDraft(cue), {
            kind: 'activity',
            tone: 'success',
          });
          await rememberSeenActivityResult(platform.storage, player.id, cue.key);
        }
      }

      if (privateMessageResult.status === 'fulfilled') {
        const seenPrivateMessageIds = await loadSeenPrivateMessageIds(platform.storage, player.id);
        const cues = buildPendingPrivateMessageCues({
          feed: privateMessageResult.value,
          seenMessageIds: seenPrivateMessageIds,
        });

        for (const cue of cues) {
          await emitDraft(buildPrivateMessageNotificationDraft(cue), {
            kind: 'private-message',
            tone: 'info',
          });
          await rememberSeenPrivateMessage(platform.storage, player.id, cue.messageId);
        }
      }

      if (factionResult.status === 'fulfilled') {
        const seenFactionPromotionKeys = await loadSeenFactionPromotionKeys(
          platform.storage,
          player.id,
        );
        const currentFaction =
          factionResult.value.factions.find(
            (entry) => entry.id === factionResult.value.playerFactionId,
          ) ?? null;
        const cue = buildFactionPromotionCueFromSummary(currentFaction);

        if (cue && !seenFactionPromotionKeys.has(cue.key)) {
          await emitDraft(buildFactionPromotionNotificationDraft(cue), {
            kind: 'faction-promotion',
            tone: 'success',
          });
          await rememberSeenFactionPromotion(platform.storage, player.id, cue.key);
        }
      }

      if (tribunalResult.status === 'fulfilled') {
        const seenTribunalKeys = await loadSeenTribunalCueKeys(platform.storage, player.id);
        const cues = buildPendingTribunalCues({
          feed: tribunalResult.value,
          seenKeys: seenTribunalKeys,
        });

        for (const cue of cues) {
          await emitDraft(buildTribunalCueNotificationDraft(cue), {
            kind: 'tribunal',
            tone: cue.kind === 'opened' ? 'warning' : 'info',
          });
          await rememberSeenTribunalCue(platform.storage, player.id, cue.key);
        }
      }

      if (eventResultsResult.status === 'fulfilled') {
        const seenEventResultKeys = await loadSeenEventResultKeys(platform.storage, player.id);
        const cues = buildPendingEventResultCues({
          results: eventResultsResult.value,
          seenKeys: seenEventResultKeys,
        });

        for (const cue of cues) {
          await emitDraft(buildEventResultNotificationDraft(cue), {
            kind: 'event-result',
            tone: 'info',
          });
          await rememberSeenEventResult(platform.storage, player.id, cue.key);
        }
      }

      if (
        docksResult.status === 'fulfilled' &&
        policeResult.status === 'fulfilled' &&
        seasonalResult.status === 'fulfilled'
      ) {
        const feed = buildEventFeed({
          docks: docksResult.value,
          police: policeResult.value,
          seasonal: seasonalResult.value,
        });

        for (const notification of feed.notifications.slice(0, 4)) {
          if (seenEventNotificationIdsRef.current.has(notification.id)) {
            continue;
          }

          await emitDraft(buildEventNotificationDraft(notification), {
            kind: 'event',
            tone: mapEventTone(notification.severity),
          });
          seenEventNotificationIdsRef.current.add(notification.id);
        }
      }

      if (territoryOverviewResult.status === 'fulfilled') {
        const seenTerritoryAlertKeys = await loadSeenTerritoryAlertKeys(
          platform.storage,
          player.id,
        );
        const territoryAlerts = buildPendingTerritoryAlertCues({
          overview: territoryOverviewResult.value,
          player,
          seenKeys: seenTerritoryAlertKeys,
        });

        for (const cue of territoryAlerts) {
          await emitDraft(buildTerritoryAlertNotificationDraft(cue), {
            kind: 'territory-alert',
            tone: cue.tone,
          });
          await rememberSeenTerritoryAlert(platform.storage, player.id, cue.key);
        }

        const seenWarKeys = await loadSeenWarResultKeys(platform.storage, player.id);
        const warCues = buildPendingWarResultCues({
          overview: territoryOverviewResult.value,
          player,
          seenKeys: seenWarKeys,
        });

        for (const cue of warCues) {
          await emitDraft(buildWarResultNotificationDraft(cue), {
            kind: 'war',
            tone: cue.outcomeTone,
          });
          await rememberSeenWarResult(platform.storage, player.id, cue.key);
        }

        if (territoryLossResult.status === 'fulfilled') {
          const seenTerritoryLossKeys = await loadSeenTerritoryLossKeys(platform.storage, player.id);
          const territoryLosses = buildPendingTerritoryLossCues({
            feed: territoryLossResult.value,
            seenKeys: seenTerritoryLossKeys,
            warCues,
          });

          for (const pendingLoss of territoryLosses) {
            if (pendingLoss.dedupedByWar) {
              await rememberSeenTerritoryLoss(platform.storage, player.id, pendingLoss.cue.key);
              continue;
            }

            await emitDraft(buildTerritoryLossNotificationDraft(pendingLoss.cue), {
              kind: 'territory-loss',
              tone: pendingLoss.cue.outcomeTone,
            });
            await rememberSeenTerritoryLoss(platform.storage, player.id, pendingLoss.cue.key);
          }
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    hasHydrated,
    isAuthenticated,
    notificationSettings.enabled,
    notificationSettings.permissionStatus,
    orchestrator,
    platform.audio,
    platform.storage,
    player,
    pushNotificationHistory,
    pushToast,
  ]);

  return <>{children}</>;
}

function mapEventTone(
  severity: 'danger' | 'info' | 'warning',
): 'danger' | 'info' | 'success' | 'warning' {
  if (severity === 'danger') {
    return 'danger';
  }

  if (severity === 'warning') {
    return 'warning';
  }

  return 'info';
}
