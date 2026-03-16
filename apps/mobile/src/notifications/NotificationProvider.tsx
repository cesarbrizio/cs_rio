import {
  type AssassinationContractNotification,
  type PlayerProfile,
  type TrainingSessionSummary,
  type UniversityCourseSummary,
} from '@cs-rio/shared';
import {
  createContext,
  type MutableRefObject,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Platform } from 'react-native';

import {
  buildAttackNotificationDraft,
  buildAsyncActivityNotificationDraft,
  buildEventNotificationDraft,
  buildEventResultNotificationDraft,
  buildFactionPromotionNotificationDraft,
  buildPrivateMessageNotificationDraft,
  buildSabotageNotificationDraft,
  buildTerritoryLossNotificationDraft,
  buildTimerNotificationDrafts,
  buildTribunalCueNotificationDraft,
  buildWarResultNotificationDraft,
  type NotificationPermissionState,
} from '../features/notifications';
import { type AsyncActivityCue } from '../features/activity-results';
import { type EventNotificationItem } from '../features/events';
import { type EventResultCue } from '../features/event-results';
import { type FactionPromotionCue } from '../features/faction-promotion';
import { type PrivateMessageCue } from '../features/private-messages';
import { type SabotageCue } from '../features/sabotage';
import { type TerritoryLossCue } from '../features/territory-loss';
import { type TribunalCue } from '../features/tribunal-results';
import { type WarResultCue } from '../features/war-results';
import { useAppStore } from '../stores/appStore';

const ANDROID_CHANNEL_ID = 'cs-rio-pre-alpha';
type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';
let cachedNotificationsModule: NotificationsModule | null | undefined;
let hasWarnedNotificationsUnavailable = false;

interface NotificationsModule {
  AndroidImportance: {
    HIGH: number;
  };
  AndroidNotificationVisibility: {
    PUBLIC: number;
  };
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: string;
  };
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  getPermissionsAsync: () => Promise<{
    status: NotificationPermissionStatus;
  }>;
  requestPermissionsAsync: () => Promise<{
    status: NotificationPermissionStatus;
  }>;
  scheduleNotificationAsync: (request: {
    content: {
      body: string;
      data?: Record<string, string>;
      sound: boolean;
      title: string;
    };
    identifier?: string;
    trigger:
      | null
      | {
          channelId: string;
          repeats: boolean;
          seconds: number;
          type: string;
        };
  }) => Promise<string>;
  setNotificationChannelAsync: (
    channelId: string,
    channel: {
      importance: number;
      lightColor: string;
      lockscreenVisibility: number;
      name: string;
      vibrationPattern: number[];
    },
  ) => Promise<void>;
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowAlert: boolean;
    }>;
  }) => void;
}

interface NotificationContextValue {
  notifyAttack: (notification: AssassinationContractNotification) => Promise<void>;
  notifyAsyncActivity: (cue: AsyncActivityCue) => Promise<void>;
  notifyEvent: (notification: EventNotificationItem) => Promise<void>;
  notifyEventResult: (cue: EventResultCue) => Promise<void>;
  notifyFactionPromotion: (cue: FactionPromotionCue) => Promise<void>;
  notifyPrivateMessage: (cue: PrivateMessageCue) => Promise<void>;
  notifySabotageCue: (cue: SabotageCue) => Promise<void>;
  notifyTerritoryLoss: (cue: TerritoryLossCue) => Promise<void>;
  notifyTribunalCue: (cue: TribunalCue) => Promise<void>;
  notifyWarResult: (cue: WarResultCue) => Promise<void>;
  requestNotificationPermissions: () => Promise<NotificationPermissionState>;
  syncTimerNotifications: (
    player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined,
  ) => Promise<void>;
  syncTrainingNotifications: (
    session: Pick<TrainingSessionSummary, 'endsAt' | 'id' | 'readyToClaim' | 'type'> | null | undefined,
  ) => Promise<void>;
  syncUniversityNotifications: (
    course: Pick<UniversityCourseSummary, 'code' | 'endsAt' | 'isInProgress' | 'label'> | null | undefined,
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren): JSX.Element {
  const notificationSettings = useAppStore((state) => state.notificationSettings);
  const setNotificationPermissionStatus = useAppStore(
    (state) => state.setNotificationPermissionStatus,
  );
  const scheduledIdsRef = useRef(new Map<string, string>());
  const deliveredIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const configureHandlerAsync = async () => {
      const Notifications = getNotificationsModule();

      if (!Notifications) {
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: notificationSettings.enabled,
          shouldSetBadge: false,
          shouldShowAlert: notificationSettings.enabled,
        }),
      });
    };

    void configureHandlerAsync();
  }, [notificationSettings.enabled]);

  useEffect(() => {
    const bootstrapAsync = async () => {
      const Notifications = getNotificationsModule();

      if (!Notifications) {
        setNotificationPermissionStatus('denied');
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#e0b04b',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          name: 'CS Rio Pré-Alpha',
          vibrationPattern: [0, 180, 120, 180],
        });
      }

      const permissions = await Notifications.getPermissionsAsync();
      setNotificationPermissionStatus(toPermissionState(permissions.status));
    };

    void bootstrapAsync();
  }, [setNotificationPermissionStatus]);

  useEffect(() => {
    if (notificationSettings.enabled || notificationSettings.permissionStatus !== 'undetermined') {
      return;
    }

    const clearNotificationsAsync = async () => {
      const Notifications = getNotificationsModule();

      if (!Notifications) {
        return;
      }

      for (const notificationId of scheduledIdsRef.current.values()) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
      scheduledIdsRef.current.clear();
    };

    void clearNotificationsAsync();
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const requestNotificationPermissions = useCallback(async () => {
    const Notifications = getNotificationsModule();

    if (!Notifications) {
      setNotificationPermissionStatus('denied');
      return 'denied';
    }

    const permissions = await Notifications.requestPermissionsAsync();
    const nextStatus = toPermissionState(permissions.status);
    setNotificationPermissionStatus(nextStatus);
    return nextStatus;
  }, [setNotificationPermissionStatus]);

  const notifyAttack = useCallback(async (notification: AssassinationContractNotification) => {
    const draft = buildAttackNotificationDraft(notification);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyEvent = useCallback(async (notification: EventNotificationItem) => {
    const draft = buildEventNotificationDraft(notification);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyAsyncActivity = useCallback(async (cue: AsyncActivityCue) => {
    const draft = buildAsyncActivityNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyEventResult = useCallback(async (cue: EventResultCue) => {
    const draft = buildEventResultNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyWarResult = useCallback(async (cue: WarResultCue) => {
    const draft = buildWarResultNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyFactionPromotion = useCallback(async (cue: FactionPromotionCue) => {
    const draft = buildFactionPromotionNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyPrivateMessage = useCallback(async (cue: PrivateMessageCue) => {
    const draft = buildPrivateMessageNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifySabotageCue = useCallback(async (cue: SabotageCue) => {
    const draft = buildSabotageNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyTerritoryLoss = useCallback(async (cue: TerritoryLossCue) => {
    const draft = buildTerritoryLossNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const notifyTribunalCue = useCallback(async (cue: TribunalCue) => {
    const draft = buildTribunalCueNotificationDraft(cue);
    await presentImmediateNotification({
      deliveredIdsRef,
      draft,
      enabled: notificationSettings.enabled,
      permissionStatus: notificationSettings.permissionStatus,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const syncTimerNotifications = useCallback(async (
    player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined,
  ) => {
    const Notifications = getNotificationsModule();

    if (!Notifications) {
      scheduledIdsRef.current.clear();
      return;
    }

    if (!notificationSettings.enabled || notificationSettings.permissionStatus !== 'granted') {
      for (const notificationId of scheduledIdsRef.current.values()) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
      scheduledIdsRef.current.clear();
      return;
    }

    await syncDraftsForPrefixes({
      Notifications,
      drafts: buildTimerNotificationDrafts({ player }),
      prefixes: ['timer:prison:', 'timer:hospital:'],
      scheduledIdsRef,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const syncTrainingNotifications = useCallback(async (
    session: Pick<TrainingSessionSummary, 'endsAt' | 'id' | 'readyToClaim' | 'type'> | null | undefined,
  ) => {
    const Notifications = getNotificationsModule();

    if (!Notifications) {
      return;
    }

    if (!notificationSettings.enabled || notificationSettings.permissionStatus !== 'granted') {
      await syncDraftsForPrefixes({
        Notifications,
        drafts: [],
        prefixes: ['timer:training:'],
        scheduledIdsRef,
      });
      return;
    }

    await syncDraftsForPrefixes({
      Notifications,
      drafts: buildTimerNotificationDrafts({ player: null, trainingSession: session ?? null }),
      prefixes: ['timer:training:'],
      scheduledIdsRef,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const syncUniversityNotifications = useCallback(async (
    course: Pick<UniversityCourseSummary, 'code' | 'endsAt' | 'isInProgress' | 'label'> | null | undefined,
  ) => {
    const Notifications = getNotificationsModule();

    if (!Notifications) {
      return;
    }

    if (!notificationSettings.enabled || notificationSettings.permissionStatus !== 'granted') {
      await syncDraftsForPrefixes({
        Notifications,
        drafts: [],
        prefixes: ['timer:university:'],
        scheduledIdsRef,
      });
      return;
    }

    await syncDraftsForPrefixes({
      Notifications,
      drafts: buildTimerNotificationDrafts({ player: null, universityCourse: course ?? null }),
      prefixes: ['timer:university:'],
      scheduledIdsRef,
    });
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifyAttack,
      notifyAsyncActivity,
      notifyEvent,
      notifyEventResult,
      notifyFactionPromotion,
      notifyPrivateMessage,
      notifySabotageCue,
      notifyTerritoryLoss,
      notifyTribunalCue,
      notifyWarResult,
      requestNotificationPermissions,
      syncTimerNotifications,
      syncTrainingNotifications,
      syncUniversityNotifications,
    }),
    [
      notifyAttack,
      notifyAsyncActivity,
      notifyEvent,
      notifyEventResult,
      notifyFactionPromotion,
      notifyPrivateMessage,
      notifySabotageCue,
      notifyTerritoryLoss,
      notifyTribunalCue,
      notifyWarResult,
      requestNotificationPermissions,
      syncTimerNotifications,
      syncTrainingNotifications,
      syncUniversityNotifications,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

async function syncDraftsForPrefixes(input: {
  Notifications: NotificationsModule;
  drafts: Array<{
    body: string;
    key: string;
    secondsUntilTrigger?: number;
    title: string;
  }>;
  prefixes: string[];
  scheduledIdsRef: MutableRefObject<Map<string, string>>;
}): Promise<void> {
  const nextKeys = new Set(input.drafts.map((draft) => draft.key));

  for (const [key, notificationId] of input.scheduledIdsRef.current.entries()) {
    if (!input.prefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    if (nextKeys.has(key)) {
      continue;
    }

    await input.Notifications.cancelScheduledNotificationAsync(notificationId);
    input.scheduledIdsRef.current.delete(key);
  }

  for (const draft of input.drafts) {
    const existingId = input.scheduledIdsRef.current.get(draft.key);

    if (existingId) {
      await input.Notifications.cancelScheduledNotificationAsync(existingId);
    }

    const identifier = await input.Notifications.scheduleNotificationAsync({
      content: {
        body: draft.body,
        data: {
          kind: 'timer',
          key: draft.key,
        },
        sound: true,
        title: draft.title,
      },
      identifier: draft.key,
      trigger: {
        channelId: ANDROID_CHANNEL_ID,
        repeats: false,
        seconds: Math.max(1, draft.secondsUntilTrigger ?? 1),
        type: input.Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });

    input.scheduledIdsRef.current.set(draft.key, identifier);
  }
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications precisa ser usado dentro de <NotificationProvider>.');
  }

  return context;
}

async function presentImmediateNotification(input: {
  deliveredIdsRef: MutableRefObject<Set<string>>;
  draft: {
    body: string;
    key: string;
    title: string;
  };
  enabled: boolean;
  permissionStatus: NotificationPermissionState;
}): Promise<void> {
  const Notifications = getNotificationsModule();

  if (!Notifications) {
    return;
  }

  if (!input.enabled || input.permissionStatus !== 'granted') {
    return;
  }

  if (input.deliveredIdsRef.current.has(input.draft.key)) {
    return;
  }

  input.deliveredIdsRef.current.add(input.draft.key);

  await Notifications.scheduleNotificationAsync({
    content: {
      body: input.draft.body,
      data: {
        key: input.draft.key,
      },
      sound: true,
      title: input.draft.title,
    },
    identifier: input.draft.key,
    trigger: null,
  });
}

function toPermissionState(status: NotificationPermissionStatus): NotificationPermissionState {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
    default:
      return 'undetermined';
  }
}

function getNotificationsModule(): NotificationsModule | null {
  if (cachedNotificationsModule !== undefined) {
    return cachedNotificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedNotificationsModule = require('expo-notifications') as NotificationsModule;
  } catch {
    cachedNotificationsModule = null;

    if (!hasWarnedNotificationsUnavailable) {
      hasWarnedNotificationsUnavailable = true;
      console.warn(
        '[notifications] expo-notifications indisponível neste build; notificações foram desativadas.',
      );
    }
  }

  return cachedNotificationsModule;
}
