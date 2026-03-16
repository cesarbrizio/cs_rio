import {
  type EventResultListResponse,
  type GameEventResultSummary,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadSummary,
} from '@cs-rio/shared';
import { useMemo } from 'react';

import { type EventFeedSnapshot, type EventNotificationItem } from '../features/events';
import { type NotificationPermissionState } from '../features/notifications';
import { type TutorialStepId } from '../features/tutorial';
import {
  type AudioSettingsState,
  useAudioStore,
} from './audioStore';
import { useEventFeedStore } from './eventFeedStore';
import {
  type NotificationSettingsState,
  useNotificationStore,
} from './notificationStore';
import { type TutorialState, useTutorialStore } from './tutorialStore';
import { type MapReturnCue, useUIStore } from './uiStore';

export interface AppStore {
  activeEventToast: EventNotificationItem | null;
  audioSettings: AudioSettingsState;
  bootstrapStatus: string;
  dismissedEventIds: string[];
  eventBanner: EventNotificationItem | null;
  eventNotifications: EventNotificationItem[];
  eventResultHistory: GameEventResultSummary[];
  lastEventResultSyncAt: string | null;
  lastEventSyncAt: string | null;
  lastPrivateMessageSyncAt: string | null;
  mapReturnCue: MapReturnCue | null;
  notificationSettings: NotificationSettingsState;
  privateMessageThreads: PrivateMessageThreadSummary[];
  tutorial: TutorialState;
  bootstrapTutorial: (playerId: string) => void;
  completeTutorialStep: (stepId: TutorialStepId) => void;
  consumeMapReturnCue: () => MapReturnCue | null;
  dismissEventBanner: (eventId: string) => void;
  dismissEventToast: () => void;
  dismissTutorial: () => void;
  queueMapReturnCue: (cue: MapReturnCue) => void;
  resetEventFeed: () => void;
  resetForLogout: () => void;
  resetPrivateMessageFeed: () => void;
  setBootstrapStatus: (status: string) => void;
  setEventFeed: (feed: EventFeedSnapshot) => void;
  setEventResultFeed: (feed: EventResultListResponse) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setNotificationPermissionStatus: (status: NotificationPermissionState) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setPrivateMessageFeed: (feed: PrivateMessageThreadListResponse) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
  showEventToast: (notification: EventNotificationItem) => void;
}

type AppStoreHook = (<T>(selector: (state: AppStore) => T) => T) & {
  getState: () => AppStore;
  setState: (partial: Partial<AppStore>) => void;
};

function buildAppStoreSnapshot(): AppStore {
  const audioState = useAudioStore.getState();
  const eventFeedState = useEventFeedStore.getState();
  const notificationState = useNotificationStore.getState();
  const tutorialState = useTutorialStore.getState();
  const uiState = useUIStore.getState();

  return {
    activeEventToast: eventFeedState.activeEventToast,
    audioSettings: audioState.audioSettings,
    bootstrapStatus: uiState.bootstrapStatus,
    bootstrapTutorial: tutorialState.bootstrapTutorial,
    completeTutorialStep: tutorialState.completeTutorialStep,
    consumeMapReturnCue: uiState.consumeMapReturnCue,
    dismissEventBanner: eventFeedState.dismissEventBanner,
    dismissEventToast: eventFeedState.dismissEventToast,
    dismissTutorial: tutorialState.dismissTutorial,
    dismissedEventIds: eventFeedState.dismissedEventIds,
    eventBanner: eventFeedState.eventBanner,
    eventNotifications: eventFeedState.eventNotifications,
    eventResultHistory: eventFeedState.eventResultHistory,
    lastEventResultSyncAt: eventFeedState.lastEventResultSyncAt,
    lastEventSyncAt: eventFeedState.lastEventSyncAt,
    lastPrivateMessageSyncAt: eventFeedState.lastPrivateMessageSyncAt,
    mapReturnCue: uiState.mapReturnCue,
    notificationSettings: notificationState.notificationSettings,
    privateMessageThreads: eventFeedState.privateMessageThreads,
    queueMapReturnCue: uiState.queueMapReturnCue,
    resetEventFeed: eventFeedState.resetEventFeed,
    resetForLogout: resetAppStoreForLogout,
    resetPrivateMessageFeed: eventFeedState.resetPrivateMessageFeed,
    setBootstrapStatus: uiState.setBootstrapStatus,
    setEventFeed: eventFeedState.setEventFeed,
    setEventResultFeed: eventFeedState.setEventResultFeed,
    setMusicEnabled: audioState.setMusicEnabled,
    setMusicVolume: audioState.setMusicVolume,
    setNotificationPermissionStatus: notificationState.setNotificationPermissionStatus,
    setNotificationsEnabled: notificationState.setNotificationsEnabled,
    setPrivateMessageFeed: eventFeedState.setPrivateMessageFeed,
    setSfxEnabled: audioState.setSfxEnabled,
    setSfxVolume: audioState.setSfxVolume,
    showEventToast: eventFeedState.showEventToast,
    tutorial: tutorialState.tutorial,
  };
}

function applyAppStorePartial(partial: Partial<AppStore>): void {
  const nextAudioSettings: Partial<AudioSettingsState> = {};
  const nextEventFeedState: Record<string, unknown> = {};
  const nextNotificationSettings: Partial<NotificationSettingsState> = {};
  const nextTutorialState: Partial<TutorialState> = {};
  const nextUIState: Record<string, unknown> = {};

  if (partial.audioSettings) {
    Object.assign(nextAudioSettings, partial.audioSettings);
  }

  if (partial.notificationSettings) {
    Object.assign(nextNotificationSettings, partial.notificationSettings);
  }

  if (partial.tutorial) {
    Object.assign(nextTutorialState, partial.tutorial);
  }

  const eventFeedKeys: Array<keyof AppStore> = [
    'activeEventToast',
    'dismissedEventIds',
    'eventBanner',
    'eventNotifications',
    'eventResultHistory',
    'lastEventResultSyncAt',
    'lastEventSyncAt',
    'lastPrivateMessageSyncAt',
    'privateMessageThreads',
  ];
  for (const key of eventFeedKeys) {
    if (key in partial) {
      nextEventFeedState[key] = partial[key];
    }
  }

  const uiKeys: Array<keyof AppStore> = ['bootstrapStatus', 'mapReturnCue'];
  for (const key of uiKeys) {
    if (key in partial) {
      nextUIState[key] = partial[key];
    }
  }

  if (Object.keys(nextAudioSettings).length > 0) {
    useAudioStore.setState((state) => ({
      audioSettings: {
        ...state.audioSettings,
        ...nextAudioSettings,
      },
    }));
  }

  if (Object.keys(nextEventFeedState).length > 0) {
    useEventFeedStore.setState(nextEventFeedState);
  }

  if (Object.keys(nextNotificationSettings).length > 0) {
    useNotificationStore.setState((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        ...nextNotificationSettings,
      },
    }));
  }

  if (Object.keys(nextTutorialState).length > 0) {
    useTutorialStore.setState((state) => ({
      tutorial: {
        ...state.tutorial,
        ...nextTutorialState,
      },
    }));
  }

  if (Object.keys(nextUIState).length > 0) {
    useUIStore.setState(nextUIState);
  }
}

export function resetAppStoreForLogout(): void {
  const permissionStatus = useNotificationStore.getState().notificationSettings.permissionStatus;
  useAudioStore.getState().resetAudioSettings();
  useEventFeedStore.getState().resetEventFeedStore();
  useNotificationStore.getState().resetNotificationSettings(permissionStatus);
  useTutorialStore.getState().resetTutorial();
  useUIStore.getState().resetUIState();
}

export const useAppStore = ((
  selector: (state: AppStore) => unknown,
) => {
  const audioState = useAudioStore();
  const eventFeedState = useEventFeedStore();
  const notificationState = useNotificationStore();
  const tutorialState = useTutorialStore();
  const uiState = useUIStore();

  const snapshot = useMemo<AppStore>(
    () => ({
      activeEventToast: eventFeedState.activeEventToast,
      audioSettings: audioState.audioSettings,
      bootstrapStatus: uiState.bootstrapStatus,
      bootstrapTutorial: tutorialState.bootstrapTutorial,
      completeTutorialStep: tutorialState.completeTutorialStep,
      consumeMapReturnCue: uiState.consumeMapReturnCue,
      dismissEventBanner: eventFeedState.dismissEventBanner,
      dismissEventToast: eventFeedState.dismissEventToast,
      dismissTutorial: tutorialState.dismissTutorial,
      dismissedEventIds: eventFeedState.dismissedEventIds,
      eventBanner: eventFeedState.eventBanner,
      eventNotifications: eventFeedState.eventNotifications,
      eventResultHistory: eventFeedState.eventResultHistory,
      lastEventResultSyncAt: eventFeedState.lastEventResultSyncAt,
      lastEventSyncAt: eventFeedState.lastEventSyncAt,
      lastPrivateMessageSyncAt: eventFeedState.lastPrivateMessageSyncAt,
      mapReturnCue: uiState.mapReturnCue,
      notificationSettings: notificationState.notificationSettings,
      privateMessageThreads: eventFeedState.privateMessageThreads,
      queueMapReturnCue: uiState.queueMapReturnCue,
      resetEventFeed: eventFeedState.resetEventFeed,
      resetForLogout: resetAppStoreForLogout,
      resetPrivateMessageFeed: eventFeedState.resetPrivateMessageFeed,
      setBootstrapStatus: uiState.setBootstrapStatus,
      setEventFeed: eventFeedState.setEventFeed,
      setEventResultFeed: eventFeedState.setEventResultFeed,
      setMusicEnabled: audioState.setMusicEnabled,
      setMusicVolume: audioState.setMusicVolume,
      setNotificationPermissionStatus: notificationState.setNotificationPermissionStatus,
      setNotificationsEnabled: notificationState.setNotificationsEnabled,
      setPrivateMessageFeed: eventFeedState.setPrivateMessageFeed,
      setSfxEnabled: audioState.setSfxEnabled,
      setSfxVolume: audioState.setSfxVolume,
      showEventToast: eventFeedState.showEventToast,
      tutorial: tutorialState.tutorial,
    }),
    [audioState, eventFeedState, notificationState, tutorialState, uiState],
  );

  return selector(snapshot);
}) as AppStoreHook;

useAppStore.getState = buildAppStoreSnapshot;
useAppStore.setState = applyAppStorePartial;
