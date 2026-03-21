import { buildEventFeed } from '../features/events';
import {
  buildPendingPrivateMessageCues,
} from '../features/private-messages';
import {
  rememberSeenPrivateMessage,
} from '../features/private-message-storage';
import {
  eventApi,
  privateMessageApi,
} from '../services/api';

interface PollEventFeedTaskInput {
  eventFeedPrimedRef: { current: boolean };
  isAuthenticated: boolean;
  notifyEvent: (notification: ReturnType<typeof buildEventFeed>['notifications'][number]) => Promise<unknown> | void;
  playSfx: (soundId: 'notification') => Promise<unknown> | void;
  playerHasCharacter: boolean | undefined;
  seenEventIdsRef: { current: Set<string> };
  setEventFeed: (feed: ReturnType<typeof buildEventFeed>) => void;
  showEventToast: (notification: ReturnType<typeof buildEventFeed>['notifications'][number]) => void;
}

export async function pollEventFeedTask({
  eventFeedPrimedRef,
  isAuthenticated,
  notifyEvent,
  playSfx,
  playerHasCharacter,
  seenEventIdsRef,
  setEventFeed,
  showEventToast,
}: PollEventFeedTaskInput): Promise<void> {
  if (!isAuthenticated || !playerHasCharacter) {
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
}

interface PollPrivateMessagesTaskInput {
  ensureSeenPrivateMessagesLoaded: () => Promise<void>;
  isAuthenticated: boolean;
  notifyPrivateMessage: (cue: ReturnType<typeof buildPendingPrivateMessageCues>[number]) => Promise<unknown> | void;
  playerHasCharacter: boolean | undefined;
  playerId: string | undefined;
  privateMessageFeedPrimedRef: { current: boolean };
  seenPrivateMessageIdsRef: { current: Set<string> };
  setBootstrapStatus: (message: string) => void;
  setPrivateMessageFeed: (feed: Awaited<ReturnType<typeof privateMessageApi.listThreads>>) => void;
}

export async function pollPrivateMessagesTask({
  ensureSeenPrivateMessagesLoaded,
  isAuthenticated,
  notifyPrivateMessage,
  playerHasCharacter,
  playerId,
  privateMessageFeedPrimedRef,
  seenPrivateMessageIdsRef,
  setBootstrapStatus,
  setPrivateMessageFeed,
}: PollPrivateMessagesTaskInput): Promise<void> {
  if (!isAuthenticated || !playerHasCharacter || !playerId) {
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
      seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(playerId, cue.messageId);
    }
    privateMessageFeedPrimedRef.current = true;
    return;
  }

  const nextCue = pendingCues[0];

  if (!nextCue) {
    return;
  }

  seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(playerId, nextCue.messageId);
  setBootstrapStatus(`${nextCue.contactNickname} te mandou uma mensagem privada.`);
  void notifyPrivateMessage(nextCue);
}
