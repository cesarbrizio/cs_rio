import {
  FACTION_REALTIME_ROOM_NAME,
  REALTIME_MESSAGE_FACTION_CHAT,
  REALTIME_MESSAGE_FACTION_COORDINATION,
  type FactionChatSendMessage,
  type FactionCoordinationKind,
  type FactionCoordinationSendMessage,
} from '@cs-rio/shared';
import { Client } from 'colyseus.js';

import { appEnv } from '../config/env';
import {
  BaseRealtimeRoomService,
  type BaseColyseusClientLike,
  type BaseColyseusRoomLike,
  type BaseRealtimeConnectionStatus,
} from './realtime/baseRealtimeRoom';

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
    super(INITIAL_SNAPSHOT, clientFactory);
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

    const room = await this.ensureClient().joinOrCreate(FACTION_REALTIME_ROOM_NAME, {
      accessToken: input.accessToken,
      factionId: input.factionId,
    });

    this.bindFactionRoom(room, input.factionId);
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

  iterateCollection(source, (sessionId, value) => {
    const member = value as Partial<FactionRealtimeMemberSnapshot> | undefined;

    if (!member?.playerId || !member.nickname) {
      return;
    }

    members.push({
      isLeader: member.isLeader ?? false,
      joinedAt: member.joinedAt ?? new Date(0).toISOString(),
      nickname: member.nickname,
      playerId: member.playerId,
      rank: member.rank ?? 'cria',
      sessionId,
      title: member.title ?? 'pivete',
      vocation: member.vocation ?? 'cria',
    });
  });

  return members;
}

function extractFactionChatMessages(source: unknown): FactionRealtimeChatEntrySnapshot[] {
  return extractArrayValues(source)
    .map((entry) => {
      const message = entry as Partial<FactionRealtimeChatEntrySnapshot> | undefined;

      if (!message?.id || !message.message) {
        return null;
      }

      return {
        createdAt: message.createdAt ?? new Date(0).toISOString(),
        id: message.id,
        kind: message.kind ?? 'chat',
        message: message.message,
        nickname: message.nickname ?? 'Sistema',
        playerId: message.playerId ?? 'system',
      };
    })
    .filter((entry): entry is FactionRealtimeChatEntrySnapshot => entry !== null);
}

function extractFactionCoordinationCalls(source: unknown): FactionRealtimeCoordinationSnapshot[] {
  return extractArrayValues(source)
    .map((entry) => {
      const coordination = entry as Partial<FactionRealtimeCoordinationSnapshot> | undefined;

      if (!coordination?.id || !coordination.label) {
        return null;
      }

      return {
        createdAt: coordination.createdAt ?? new Date(0).toISOString(),
        id: coordination.id,
        kind: isFactionCoordinationKind(coordination.kind) ? coordination.kind : 'gather',
        label: coordination.label,
        nickname: coordination.nickname ?? 'Sistema',
        playerId: coordination.playerId ?? 'system',
      };
    })
    .filter((entry): entry is FactionRealtimeCoordinationSnapshot => entry !== null);
}

function extractArrayValues(source: unknown): unknown[] {
  if (!source) {
    return [];
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (typeof (source as { toArray?: unknown }).toArray === 'function') {
    return (source as { toArray: () => unknown[] }).toArray();
  }

  if (typeof (source as { forEach?: unknown }).forEach === 'function') {
    const values: unknown[] = [];
    (source as { forEach: (cb: (value: unknown) => void) => void }).forEach((value) => {
      values.push(value);
    });
    return values;
  }

  if (typeof (source as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
    return Array.from(source as Iterable<unknown>);
  }

  return Object.values(source as Record<string, unknown>);
}

function iterateCollection(source: unknown, callback: (key: string, value: unknown) => void): void {
  if (!source) {
    return;
  }

  if (typeof (source as { forEach?: unknown }).forEach === 'function') {
    (source as { forEach: (cb: (value: unknown, key: string) => void) => void }).forEach(
      (value, key) => callback(key, value),
    );
    return;
  }

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    callback(key, value);
  }
}

function isFactionCoordinationKind(value: unknown): value is FactionCoordinationKind {
  return value === 'attack' || value === 'defend' || value === 'gather' || value === 'supply';
}

function normalizeRealtimeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha ao reconectar na sala da facção.';
}

function normalizeText(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
