import { type EventFeedSnapshot, type EventNotificationItem } from '../features/events';
import { type NotificationPermissionState } from '../features/notifications';
import { type TutorialStepId } from '../features/tutorial';
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
  lastEventSyncAt: string | null;
  mapReturnCue: {
    accent?: string;
    message: string;
  } | null;
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
  resetEventFeed: () => void;
  setNotificationPermissionStatus: (status: NotificationPermissionState) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
  setBootstrapStatus: (status: string) => void;
  setEventFeed: (feed: EventFeedSnapshot) => void;
  showEventToast: (notification: EventNotificationItem) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeEventToast: null,
  audioSettings: {
    musicEnabled: true,
    musicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80,
  },
  bootstrapStatus: 'Você entrou no mapa. Toque no chão para andar ou abra Ações rápidas para escolher o próximo passo.',
  dismissedEventIds: [],
  eventBanner: null,
  eventNotifications: [],
  lastEventSyncAt: null,
  mapReturnCue: null,
  notificationSettings: {
    enabled: true,
    permissionStatus: 'undetermined',
  },
  tutorial: {
    completedStepIds: [],
    dismissed: false,
    playerId: null,
    startedAt: null,
  },
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
  resetEventFeed: () =>
    set({
      activeEventToast: null,
      dismissedEventIds: [],
      eventBanner: null,
      eventNotifications: [],
      lastEventSyncAt: null,
      mapReturnCue: null,
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
  showEventToast: (notification) => set({ activeEventToast: notification }),
}));

function clampAudioVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
