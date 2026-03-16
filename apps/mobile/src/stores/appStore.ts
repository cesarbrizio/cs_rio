import { type EventFeedSnapshot, type EventNotificationItem } from '../features/events';
import { type NotificationPermissionState } from '../features/notifications';
import { type TutorialStepId } from '../features/tutorial';
import {
  type EventResultListResponse,
  type GameEventResultSummary,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadSummary,
} from '@cs-rio/shared';
import { create } from 'zustand';

interface AppStore {
  activeEventToast: EventNotificationItem | null;
  audioSettings: {
    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
  };
  bootstrapStatus: string;
  dismissedEventIds: string[];
  eventBanner: EventNotificationItem | null;
  eventNotifications: EventNotificationItem[];
  eventResultHistory: GameEventResultSummary[];
  lastEventSyncAt: string | null;
  lastEventResultSyncAt: string | null;
  mapReturnCue: {
    accent?: string;
    message: string;
  } | null;
  privateMessageThreads: PrivateMessageThreadSummary[];
  lastPrivateMessageSyncAt: string | null;
  notificationSettings: {
    enabled: boolean;
    permissionStatus: NotificationPermissionState;
  };
  tutorial: {
    completedStepIds: TutorialStepId[];
    dismissed: boolean;
    playerId: string | null;
    startedAt: string | null;
  };
  bootstrapTutorial: (playerId: string) => void;
  completeTutorialStep: (stepId: TutorialStepId) => void;
  consumeMapReturnCue: () => {
    accent?: string;
    message: string;
  } | null;
  dismissEventBanner: (eventId: string) => void;
  dismissEventToast: () => void;
  dismissTutorial: () => void;
  queueMapReturnCue: (cue: {
    accent?: string;
    message: string;
  }) => void;
  resetForLogout: () => void;
  resetEventFeed: () => void;
  resetPrivateMessageFeed: () => void;
  setNotificationPermissionStatus: (status: NotificationPermissionState) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
  setBootstrapStatus: (status: string) => void;
  setEventFeed: (feed: EventFeedSnapshot) => void;
  setEventResultFeed: (feed: EventResultListResponse) => void;
  setPrivateMessageFeed: (feed: PrivateMessageThreadListResponse) => void;
  showEventToast: (notification: EventNotificationItem) => void;
}

const DEFAULT_BOOTSTRAP_STATUS =
  'Você entrou no mapa. Toque no chão para andar ou abra Ações rápidas para escolher o próximo passo.';

const DEFAULT_AUDIO_SETTINGS = {
  musicEnabled: true,
  musicVolume: 70,
  sfxEnabled: true,
  sfxVolume: 80,
} as const;

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  permissionStatus: 'undetermined' as NotificationPermissionState,
} as const;

function createMutableAppState() {
  return {
    activeEventToast: null,
    audioSettings: {
      ...DEFAULT_AUDIO_SETTINGS,
    },
    bootstrapStatus: DEFAULT_BOOTSTRAP_STATUS,
    dismissedEventIds: [],
    eventBanner: null,
    eventNotifications: [],
    eventResultHistory: [],
    lastEventSyncAt: null,
    lastEventResultSyncAt: null,
    lastPrivateMessageSyncAt: null,
    mapReturnCue: null,
    notificationSettings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
    },
    privateMessageThreads: [],
    tutorial: {
      completedStepIds: [],
      dismissed: false,
      playerId: null,
      startedAt: null,
    },
  };
}

export const useAppStore = create<AppStore>((set) => ({
  ...createMutableAppState(),
  bootstrapTutorial: (playerId) =>
    set((state) => {
      if (state.tutorial.playerId === playerId && state.tutorial.startedAt) {
        return state;
      }

      return {
        tutorial: {
          completedStepIds: [],
          dismissed: false,
          playerId,
          startedAt: new Date().toISOString(),
        },
      };
    }),
  completeTutorialStep: (stepId) =>
    set((state) => {
      if (state.tutorial.completedStepIds.includes(stepId)) {
        return state;
      }

      return {
        tutorial: {
          ...state.tutorial,
          completedStepIds: [...state.tutorial.completedStepIds, stepId],
          dismissed: false,
        },
      };
    }),
  consumeMapReturnCue: () => {
    let nextCue: {
      accent?: string;
      message: string;
    } | null = null;

    set((state) => {
      nextCue = state.mapReturnCue;
      return {
        mapReturnCue: null,
      };
    });

    return nextCue;
  },
  dismissEventBanner: (eventId) =>
    set((state) => {
      const dismissedEventIds = state.dismissedEventIds.includes(eventId)
        ? state.dismissedEventIds
        : [...state.dismissedEventIds, eventId];

      return {
        dismissedEventIds,
        eventBanner:
          state.eventNotifications.find((notification) => !dismissedEventIds.includes(notification.id)) ??
          null,
      };
    }),
  dismissEventToast: () => set({ activeEventToast: null }),
  dismissTutorial: () =>
    set((state) => ({
      tutorial: {
        ...state.tutorial,
        dismissed: true,
      },
    })),
  queueMapReturnCue: (cue) => set({ mapReturnCue: cue }),
  resetForLogout: () =>
    set((state) => ({
      ...createMutableAppState(),
      notificationSettings: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        permissionStatus: state.notificationSettings.permissionStatus,
      },
    })),
  resetEventFeed: () =>
    set({
      activeEventToast: null,
      dismissedEventIds: [],
      eventBanner: null,
      eventNotifications: [],
      eventResultHistory: [],
      lastEventSyncAt: null,
      lastEventResultSyncAt: null,
      mapReturnCue: null,
    }),
  resetPrivateMessageFeed: () =>
    set({
      lastPrivateMessageSyncAt: null,
      privateMessageThreads: [],
    }),
  setNotificationPermissionStatus: (permissionStatus) =>
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        permissionStatus,
      },
    })),
  setNotificationsEnabled: (enabled) =>
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        enabled,
      },
    })),
  setMusicEnabled: (enabled) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicEnabled: enabled,
      },
    })),
  setMusicVolume: (volume) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicVolume: clampAudioVolume(volume),
      },
    })),
  setSfxEnabled: (enabled) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxEnabled: enabled,
      },
    })),
  setSfxVolume: (volume) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxVolume: clampAudioVolume(volume),
      },
    })),
  setBootstrapStatus: (bootstrapStatus) => set({ bootstrapStatus }),
  setEventFeed: (feed) =>
    set((state) => ({
      eventBanner:
        feed.notifications.find((notification) => !state.dismissedEventIds.includes(notification.id)) ??
        null,
      eventNotifications: feed.notifications,
      lastEventSyncAt: feed.generatedAt,
    })),
  setEventResultFeed: (feed) =>
    set({
      eventResultHistory: feed.results,
      lastEventResultSyncAt: feed.generatedAt,
    }),
  setPrivateMessageFeed: (feed) =>
    set({
      lastPrivateMessageSyncAt: feed.generatedAt,
      privateMessageThreads: feed.threads,
    }),
  showEventToast: (notification) => set({ activeEventToast: notification }),
}));

function clampAudioVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
