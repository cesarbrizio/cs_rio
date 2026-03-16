import {
  FACTION_REALTIME_MAX_LABEL_LENGTH,
  FACTION_REALTIME_MAX_MESSAGE_LENGTH,
  FACTION_REALTIME_ROOM_NAME,
  REALTIME_MESSAGE_FACTION_CHAT,
  REALTIME_MESSAGE_FACTION_COORDINATION,
  type FactionChatSendMessage,
  type FactionCoordinationKind,
  type FactionCoordinationSendMessage,
} from '@cs-rio/shared';
import { Client } from 'colyseus.js';

import { appEnv } from '../config/env';
import { recordRealtimeEvent } from '../features/mobile-observability';
import {
  BaseRealtimeRoomService,
  type BaseColyseusClientLike,
  type BaseColyseusRoomLike,
  type BaseRealtimeConnectionStatus,
} from './realtime/baseRealtimeRoom';
import {
  collectRealtimeValues,
  isRecord,
  iterateRealtimeCollection,
  readBoolean,
  readString,
} from './realtime/stateGuards';

export type FactionRealtimeConnectionStatus = BaseRealtimeConnectionStatus;

export interface FactionRealtimeMemberSnapshot {
  isLeader: boolean;
  joinedAt: string;
  nickname: string;
  playerId: string;
  rank: string;
  sessionId: string;
  title: string;
  vocation: string;
}

export interface FactionRealtimeChatEntrySnapshot {
  createdAt: string;
  id: string;
  kind: string;
  message: string;
  nickname: string;
  playerId: string;
}

export interface FactionRealtimeCoordinationSnapshot {
  createdAt: string;
  id: string;
  kind: FactionCoordinationKind;
  label: string;
  nickname: string;
  playerId: string;
}

export interface FactionRealtimeSnapshot {
  chatMessages: FactionRealtimeChatEntrySnapshot[];
  coordinationCalls: FactionRealtimeCoordinationSnapshot[];
  errorMessage: string | null;
  factionAbbreviation: string | null;
  factionId: string | null;
  factionName: string | null;
  members: FactionRealtimeMemberSnapshot[];
  roomId: string | null;
  roomName: string | null;
  status: FactionRealtimeConnectionStatus;
}

interface ConnectToFactionRoomInput {
  accessToken: string;
  factionId: string;
}

interface FactionRealtimeStateShape {
  chatMessages?: unknown;
  coordinationCalls?: unknown;
  factionAbbreviation?: string;
  factionId?: string;
  factionName?: string;
  members?: unknown;
}

const INITIAL_SNAPSHOT: FactionRealtimeSnapshot = {
  chatMessages: [],
  coordinationCalls: [],
  errorMessage: null,
  factionAbbreviation: null,
  factionId: null,
  factionName: null,
  members: [],
  roomId: null,
  roomName: null,
  status: 'disconnected',
};

export class FactionRealtimeService extends BaseRealtimeRoomService<
  FactionRealtimeSnapshot,
  FactionRealtimeStateShape
> {
  constructor(
    clientFactory: () => BaseColyseusClientLike<FactionRealtimeStateShape> = () =>
      new Client(appEnv.wsUrl),
  ) {
    super(INITIAL_SNAPSHOT, clientFactory, 'faction');
  }

  async connectToFactionRoom(input: ConnectToFactionRoomInput): Promise<FactionRealtimeSnapshot> {
    if (
      this.currentRoom &&
      this.snapshot.status === 'connected' &&
      this.snapshot.factionId === input.factionId
    ) {
      return this.snapshot;
    }

    this.disconnectRequested = false;
    super.clearReconnectTimer();

    if (this.currentRoom) {
      await this.leaveCurrentRoom();
    }

    this.setSnapshot({
      ...INITIAL_SNAPSHOT,
      factionId: input.factionId,
      roomName: FACTION_REALTIME_ROOM_NAME,
      status: 'connecting',
    });
    recordRealtimeEvent({
      channel: 'faction',
      status: 'connecting',
    });

    try {
      const room = await this.ensureClient().joinOrCreate(FACTION_REALTIME_ROOM_NAME, {
        accessToken: input.accessToken,
        factionId: input.factionId,
      });

      this.bindFactionRoom(room, input.factionId);
    } catch (error) {
      const normalizedError = normalizeRealtimeError(error);
      recordRealtimeEvent({
        channel: 'faction',
        errorMessage: normalizedError,
        status: 'disconnected',
      });
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: normalizedError,
        status: 'disconnected',
      });
    }
    return this.snapshot;
  }

  async disconnect(): Promise<void> {
    await this.disconnectRoom((current) => ({
      ...INITIAL_SNAPSHOT,
      factionId: current.factionId,
      factionName: current.factionName,
      factionAbbreviation: current.factionAbbreviation,
      roomName: current.roomName,
      status: 'disconnected',
    }));
  }

  sendChatMessage(message: FactionChatSendMessage | string): void {
    if (!this.currentRoom || this.snapshot.status !== 'connected') {
      return;
    }

    const normalizedMessage = typeof message === 'string' ? message.trim() : message.message.trim();

    if (!normalizedMessage) {
      return;
    }

    if (normalizedMessage.length > FACTION_REALTIME_MAX_MESSAGE_LENGTH) {
      return;
    }

    this.currentRoom.send(REALTIME_MESSAGE_FACTION_CHAT, {
      message: normalizedMessage,
    } satisfies FactionChatSendMessage);
  }

  sendCoordinationMessage(message: FactionCoordinationSendMessage): void {
    if (!this.currentRoom || this.snapshot.status !== 'connected') {
      return;
    }

    const normalizedLabel = message.label.trim();

    if (!normalizedLabel) {
      return;
    }

    if (normalizedLabel.length > FACTION_REALTIME_MAX_LABEL_LENGTH) {
      return;
    }

    this.currentRoom.send(REALTIME_MESSAGE_FACTION_COORDINATION, {
      kind: message.kind,
      label: normalizedLabel,
    } satisfies FactionCoordinationSendMessage);
  }

  private bindFactionRoom(
    room: BaseColyseusRoomLike<FactionRealtimeStateShape>,
    fallbackFactionId: string,
  ): void {
    super.bindRoom(room, {
      buildDisconnectedSnapshot: (current) => ({
        ...current,
        errorMessage: null,
        roomId: null,
        status: 'disconnected',
      }),
      buildErrorSnapshot: (current, code, message) => ({
        ...current,
        errorMessage: `[${code}] ${message ?? 'Erro na sala da facção.'}`,
      }),
      buildReconnectErrorSnapshot: (current, error) => ({
        ...current,
        errorMessage: normalizeRealtimeError(error),
        status: 'reconnecting',
      }),
      buildReconnectingSnapshot: (current, reason) => ({
        ...current,
        errorMessage: reason ?? 'Conexão com a sala da facção perdida.',
        roomId: null,
        status: 'reconnecting',
      }),
      fallbackContext: fallbackFactionId,
      updateFromState: (state, activeRoom, status, factionId) =>
        this.buildSnapshotFromState(state, activeRoom, status, factionId),
    });
  }

  private buildSnapshotFromState(
    state: FactionRealtimeStateShape | undefined,
    room: BaseColyseusRoomLike<FactionRealtimeStateShape>,
    status: FactionRealtimeConnectionStatus,
    fallbackFactionId: string,
  ): FactionRealtimeSnapshot {
    return {
      chatMessages: extractFactionChatMessages(state?.chatMessages),
      coordinationCalls: extractFactionCoordinationCalls(state?.coordinationCalls),
      errorMessage: null,
      factionAbbreviation: normalizeText(state?.factionAbbreviation),
      factionId: normalizeText(state?.factionId) ?? fallbackFactionId,
      factionName: normalizeText(state?.factionName),
      members: extractFactionMembers(state?.members),
      roomId: room.roomId,
      roomName: room.name,
      status,
    };
  }
}

export const factionRealtimeService = new FactionRealtimeService();

function extractFactionMembers(source: unknown): FactionRealtimeMemberSnapshot[] {
  const members: FactionRealtimeMemberSnapshot[] = [];

  iterateRealtimeCollection(source, (sessionId, value) => {
    if (!isRecord(value)) {
      return;
    }

    const playerId = readString(value, 'playerId');
    const nickname = readString(value, 'nickname');

    if (!playerId || !nickname) {
      return;
    }

    members.push({
      isLeader: readBoolean(value, 'isLeader') ?? false,
      joinedAt: readString(value, 'joinedAt') ?? new Date(0).toISOString(),
      nickname,
      playerId,
      rank: readString(value, 'rank') ?? 'cria',
      sessionId,
      title: readString(value, 'title') ?? 'pivete',
      vocation: readString(value, 'vocation') ?? 'cria',
    });
  });

  return members;
}

function extractFactionChatMessages(source: unknown): FactionRealtimeChatEntrySnapshot[] {
  return collectRealtimeValues(source)
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const id = readString(entry, 'id');
      const messageText = readString(entry, 'message');

      if (!id || !messageText) {
        return null;
      }

      return {
        createdAt: readString(entry, 'createdAt') ?? new Date(0).toISOString(),
        id,
        kind: readString(entry, 'kind') ?? 'chat',
        message: messageText,
        nickname: readString(entry, 'nickname') ?? 'Sistema',
        playerId: readString(entry, 'playerId') ?? 'system',
      };
    })
    .filter((entry): entry is FactionRealtimeChatEntrySnapshot => entry !== null);
}

function extractFactionCoordinationCalls(source: unknown): FactionRealtimeCoordinationSnapshot[] {
  return collectRealtimeValues(source)
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const id = readString(entry, 'id');
      const label = readString(entry, 'label');

      if (!id || !label) {
        return null;
      }

      return {
        createdAt: readString(entry, 'createdAt') ?? new Date(0).toISOString(),
        id,
        kind: isFactionCoordinationKind(entry.kind) ? entry.kind : 'gather',
        label,
        nickname: readString(entry, 'nickname') ?? 'Sistema',
        playerId: readString(entry, 'playerId') ?? 'system',
      };
    })
    .filter((entry): entry is FactionRealtimeCoordinationSnapshot => entry !== null);
}

function isFactionCoordinationKind(value: unknown): value is FactionCoordinationKind {
  return value === 'attack' || value === 'defend' || value === 'gather' || value === 'supply';
}

function normalizeRealtimeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Falha de conexão com a sala da facção.';
}

function normalizeText(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
