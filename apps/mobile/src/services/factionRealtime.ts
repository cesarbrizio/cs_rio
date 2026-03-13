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

export type FactionRealtimeConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting';

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

interface ColyseusClientLike {
  joinOrCreate: (
    roomName: string,
    options?: unknown,
  ) => Promise<ColyseusRoomLike<FactionRealtimeStateShape>>;
  reconnect: (reconnectionToken: string) => Promise<ColyseusRoomLike<FactionRealtimeStateShape>>;
}

interface ColyseusRoomLike<State = unknown> {
  name: string;
  onError: (callback: (code: number, message?: string) => void) => unknown;
  onLeave: (callback: (code: number, reason?: string) => void) => unknown;
  onStateChange: (callback: (state: State) => void) => unknown;
  reconnectionToken: string;
  roomId: string;
  send: (type: string, message?: unknown) => unknown;
  state: State;
  leave: (consented?: boolean) => Promise<number>;
}

type Listener = (snapshot: FactionRealtimeSnapshot) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

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

export class FactionRealtimeService {
  private readonly listeners = new Set<Listener>();

  private readonly clientFactory: () => ColyseusClientLike;

  private client: ColyseusClientLike | null = null;

  private currentRoom: ColyseusRoomLike<FactionRealtimeStateShape> | null = null;

  private disconnectRequested = false;

  private reconnectAttempts = 0;

  private reconnectTimer: TimerHandle | null = null;

  private snapshot: FactionRealtimeSnapshot = INITIAL_SNAPSHOT;

  constructor(clientFactory: () => ColyseusClientLike = () => new Client(appEnv.wsUrl)) {
    this.clientFactory = clientFactory;
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
    this.clearReconnectTimer();

    if (this.currentRoom) {
      await this.disconnect();
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

    this.bindRoom(room, input.factionId);
    return this.snapshot;
  }

  async disconnect(): Promise<void> {
    this.disconnectRequested = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();

    const room = this.currentRoom;
    this.currentRoom = null;

    if (room) {
      try {
        await room.leave(true);
      } catch {
        // Best-effort cleanup on navigation/logout.
      }
    }

    this.setSnapshot({
      ...INITIAL_SNAPSHOT,
      factionId: this.snapshot.factionId,
      factionName: this.snapshot.factionName,
      factionAbbreviation: this.snapshot.factionAbbreviation,
      roomName: this.snapshot.roomName,
      status: 'disconnected',
    });
  }

  getSnapshot(): FactionRealtimeSnapshot {
    return this.snapshot;
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

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private bindRoom(
    room: ColyseusRoomLike<FactionRealtimeStateShape>,
    fallbackFactionId: string,
  ): void {
    this.currentRoom = room;
    this.reconnectAttempts = 0;
    this.updateFromState(room.state, room, 'connected', fallbackFactionId);

    room.onStateChange((state) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.updateFromState(state, room, 'connected', fallbackFactionId);
    });

    room.onError((code, message) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        errorMessage: `[${code}] ${message ?? 'Erro na sala da facção.'}`,
      });
    });

    room.onLeave((_code, reason) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.currentRoom = null;

      if (this.disconnectRequested) {
        this.setSnapshot({
          ...this.snapshot,
          errorMessage: null,
          roomId: null,
          status: 'disconnected',
        });
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        errorMessage: reason ?? 'Conexão com a sala da facção perdida.',
        roomId: null,
        status: 'reconnecting',
      });
      this.scheduleReconnect(room.reconnectionToken, fallbackFactionId);
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private ensureClient(): ColyseusClientLike {
    if (!this.client) {
      this.client = this.clientFactory();
    }

    return this.client;
  }

  private scheduleReconnect(reconnectionToken: string, factionId: string): void {
    this.clearReconnectTimer();
    const attempt = this.reconnectAttempts + 1;
    const delayMs = Math.min(500 * 2 ** (attempt - 1), 4_000);

    this.reconnectAttempts = attempt;
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect(reconnectionToken, factionId);
    }, delayMs);
  }

  private async reconnect(reconnectionToken: string, factionId: string): Promise<void> {
    if (this.disconnectRequested) {
      return;
    }

    try {
      const room = await this.ensureClient().reconnect(reconnectionToken);
      this.bindRoom(room, factionId);
    } catch (error) {
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: normalizeRealtimeError(error),
        status: 'reconnecting',
      });
      this.scheduleReconnect(reconnectionToken, factionId);
    }
  }

  private setSnapshot(snapshot: FactionRealtimeSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private updateFromState(
    state: FactionRealtimeStateShape | undefined,
    room: ColyseusRoomLike<FactionRealtimeStateShape>,
    status: FactionRealtimeConnectionStatus,
    fallbackFactionId: string,
  ): void {
    this.setSnapshot({
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
    });
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
