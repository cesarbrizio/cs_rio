import { type AssassinationContractNotification, type PlayerProfile } from '@cs-rio/shared';
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
  buildEventNotificationDraft,
  buildTimerNotificationDrafts,
  type NotificationPermissionState,
} from '../features/notifications';
import { type EventNotificationItem } from '../features/events';
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
  notifyEvent: (notification: EventNotificationItem) => Promise<void>;
  requestNotificationPermissions: () => Promise<NotificationPermissionState>;
  syncTimerNotifications: (player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined) => Promise<void>;
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

    const drafts = buildTimerNotificationDrafts(player);
    const nextKeys = new Set(drafts.map((draft) => draft.key));

    for (const [key, notificationId] of scheduledIdsRef.current.entries()) {
      if (nextKeys.has(key)) {
        continue;
      }

      await Notifications.cancelScheduledNotificationAsync(notificationId);
      scheduledIdsRef.current.delete(key);
    }

    for (const draft of drafts) {
      const existingId = scheduledIdsRef.current.get(draft.key);

      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      }

      const identifier = await Notifications.scheduleNotificationAsync({
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
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });

      scheduledIdsRef.current.set(draft.key, identifier);
    }
  }, [notificationSettings.enabled, notificationSettings.permissionStatus]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifyAttack,
      notifyEvent,
      requestNotificationPermissions,
      syncTimerNotifications,
    }),
    [notifyAttack, notifyEvent, requestNotificationPermissions, syncTimerNotifications],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
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
