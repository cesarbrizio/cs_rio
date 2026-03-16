import {
  type EventResultListResponse,
  type GameEventResultSummary,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadSummary,
} from '@cs-rio/shared';
import { create } from 'zustand';

import { type EventFeedSnapshot, type EventNotificationItem } from '../features/events';

interface EventFeedStoreState {
  activeEventToast: EventNotificationItem | null;
  dismissedEventIds: string[];
  eventBanner: EventNotificationItem | null;
  eventNotifications: EventNotificationItem[];
  eventResultHistory: GameEventResultSummary[];
  lastEventResultSyncAt: string | null;
  lastEventSyncAt: string | null;
  lastPrivateMessageSyncAt: string | null;
  privateMessageThreads: PrivateMessageThreadSummary[];
  dismissEventBanner: (eventId: string) => void;
  dismissEventToast: () => void;
  resetEventFeed: () => void;
  resetEventFeedStore: () => void;
  resetPrivateMessageFeed: () => void;
  setEventFeed: (feed: EventFeedSnapshot) => void;
  setEventResultFeed: (feed: EventResultListResponse) => void;
  setPrivateMessageFeed: (feed: PrivateMessageThreadListResponse) => void;
  showEventToast: (notification: EventNotificationItem) => void;
}

function createEventFeedState() {
  return {
    activeEventToast: null,
    dismissedEventIds: [] as string[],
    eventBanner: null as EventNotificationItem | null,
    eventNotifications: [] as EventNotificationItem[],
    eventResultHistory: [] as GameEventResultSummary[],
    lastEventResultSyncAt: null as string | null,
    lastEventSyncAt: null as string | null,
    lastPrivateMessageSyncAt: null as string | null,
    privateMessageThreads: [] as PrivateMessageThreadSummary[],
  };
}

export const useEventFeedStore = create<EventFeedStoreState>((set) => ({
  ...createEventFeedState(),
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
  resetEventFeed: () =>
    set({
      activeEventToast: null,
      dismissedEventIds: [],
      eventBanner: null,
      eventNotifications: [],
      eventResultHistory: [],
      lastEventResultSyncAt: null,
      lastEventSyncAt: null,
    }),
  resetEventFeedStore: () => set(createEventFeedState()),
  resetPrivateMessageFeed: () =>
    set({
      lastPrivateMessageSyncAt: null,
      privateMessageThreads: [],
    }),
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
