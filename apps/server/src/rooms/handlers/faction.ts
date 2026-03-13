import {
  FACTION_REALTIME_MAX_CHAT_MESSAGES,
  FACTION_REALTIME_MAX_COORDINATION_ITEMS,
  FACTION_REALTIME_MAX_LABEL_LENGTH,
  FACTION_REALTIME_MAX_MESSAGE_LENGTH,
  REALTIME_MESSAGE_FACTION_CHAT,
  REALTIME_MESSAGE_FACTION_COORDINATION,
  type FactionChatSendMessage,
  type FactionCoordinationSendMessage,
} from '@cs-rio/shared';
import { randomUUID } from 'node:crypto';

import {
  FactionChatEntryState,
  FactionCoordinationState,
  FactionPresenceState,
  type FactionState,
} from '../schemas/FactionState.js';

interface FactionRoomClient {
  sessionId: string;
}

interface FactionRoomLike {
  onMessage: (
    type: string,
    callback: (client: FactionRoomClient, message: unknown) => void,
  ) => void;
  state: FactionState;
}

interface HandleFactionChatInput {
  client: FactionRoomClient;
  message: FactionChatSendMessage;
  now?: () => Date;
  room: {
    state: FactionState;
  };
}

interface HandleFactionCoordinationInput {
  client: FactionRoomClient;
  message: FactionCoordinationSendMessage;
  now?: () => Date;
  room: {
    state: FactionState;
  };
}

export function registerFactionRoomHandlers(room: FactionRoomLike): void {
  room.onMessage(REALTIME_MESSAGE_FACTION_CHAT, (client, message) => {
    handleFactionChatMessage({
      client,
      message: message as FactionChatSendMessage,
      room,
    });
  });

  room.onMessage(REALTIME_MESSAGE_FACTION_COORDINATION, (client, message) => {
    handleFactionCoordinationMessage({
      client,
      message: message as FactionCoordinationSendMessage,
      room,
    });
  });
}

export function appendFactionSystemMessage(
  state: FactionState,
  message: string,
  now: Date = new Date(),
): void {
  appendFactionChatEntry(state, {
    kind: 'system',
    message,
    nickname: 'Sistema',
    playerId: 'system',
    timestamp: now,
  });
}

export function handleFactionChatMessage({
  client,
  message,
  now = () => new Date(),
  room,
}: HandleFactionChatInput): boolean {
  const member = room.state.members.get(client.sessionId);

  if (!member) {
    return false;
  }

  const normalizedMessage = normalizeFactionChatMessage(message);

  if (!normalizedMessage) {
    return false;
  }

  appendFactionChatEntry(room.state, {
    kind: 'chat',
    message: normalizedMessage,
    nickname: member.nickname,
    playerId: member.playerId,
    timestamp: now(),
  });

  return true;
}

export function handleFactionCoordinationMessage({
  client,
  message,
  now = () => new Date(),
  room,
}: HandleFactionCoordinationInput): boolean {
  const member = room.state.members.get(client.sessionId);

  if (!member) {
    return false;
  }

  const normalized = normalizeFactionCoordinationMessage(message);

  if (!normalized) {
    return false;
  }

  room.state.coordinationCalls.push(
    new FactionCoordinationState({
      createdAt: now().toISOString(),
      id: randomUUID(),
      kind: normalized.kind,
      label: normalized.label,
      nickname: member.nickname,
      playerId: member.playerId,
    }),
  );
  trimFactionCoordinationHistory(room.state);

  return true;
}

export function upsertFactionPresence(
  state: FactionState,
  sessionId: string,
  member: Pick<FactionPresenceState, 'isLeader' | 'nickname' | 'playerId' | 'rank' | 'title' | 'vocation'>,
  joinedAt: Date,
): void {
  state.members.set(
    sessionId,
    new FactionPresenceState({
      isLeader: member.isLeader,
      joinedAt: joinedAt.toISOString(),
      nickname: member.nickname,
      playerId: member.playerId,
      rank: member.rank,
      title: member.title,
      vocation: member.vocation,
    }),
  );
}

function appendFactionChatEntry(
  state: FactionState,
  input: {
    kind: string;
    message: string;
    nickname: string;
    playerId: string;
    timestamp: Date;
  },
): void {
  state.chatMessages.push(
    new FactionChatEntryState({
      createdAt: input.timestamp.toISOString(),
      id: randomUUID(),
      kind: input.kind,
      message: input.message,
      nickname: input.nickname,
      playerId: input.playerId,
    }),
  );
  trimFactionChatHistory(state);
}

function normalizeFactionChatMessage(message: FactionChatSendMessage | null | undefined): string | null {
  if (!message || typeof message.message !== 'string') {
    return null;
  }

  const normalized = message.message.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0 || normalized.length > FACTION_REALTIME_MAX_MESSAGE_LENGTH) {
    return null;
  }

  return normalized;
}

function normalizeFactionCoordinationMessage(
  message: FactionCoordinationSendMessage | null | undefined,
): FactionCoordinationSendMessage | null {
  if (!message || typeof message.label !== 'string') {
    return null;
  }

  const normalizedLabel = message.label.trim().replace(/\s+/g, ' ');

  if (normalizedLabel.length === 0 || normalizedLabel.length > FACTION_REALTIME_MAX_LABEL_LENGTH) {
    return null;
  }

  if (!['attack', 'defend', 'gather', 'supply'].includes(message.kind)) {
    return null;
  }

  return {
    kind: message.kind,
    label: normalizedLabel,
  };
}

function trimFactionChatHistory(state: FactionState): void {
  while (state.chatMessages.length > FACTION_REALTIME_MAX_CHAT_MESSAGES) {
    state.chatMessages.shift();
  }
}

function trimFactionCoordinationHistory(state: FactionState): void {
  while (state.coordinationCalls.length > FACTION_REALTIME_MAX_COORDINATION_ITEMS) {
    state.coordinationCalls.shift();
  }
}
