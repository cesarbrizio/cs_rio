import {
  REALTIME_MESSAGE_PLAYER_MOVE,
  REALTIME_MOVEMENT_THROTTLE_MS,
  REGION_REALTIME_ROOM_NAMES,
  RegionId,
  type MovePlayerMessage,
} from '@cs-rio/shared';
import { Client } from 'colyseus.js';

import { appEnv } from '../config/env';

export type RealtimeConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting';

export interface RealtimePlayerSnapshot {
  animation: string;
  nickname: string;
  playerId: string;
  regionId: string;
  sessionId: string;
  title: string;
  vocation: string;
  x: number;
  y: number;
}

export interface RealtimeSnapshot {
  errorMessage: string | null;
  players: RealtimePlayerSnapshot[];
  regionId: RegionId | null;
  roomId: string | null;
  roomName: string | null;
  status: RealtimeConnectionStatus;
}

interface ConnectToRegionRoomInput {
  accessToken: string;
  regionId: RegionId;
}

interface ColyseusClientLike {
  joinOrCreate: (
    roomName: string,
    options?: unknown,
  ) => Promise<ColyseusRoomLike<RealtimeStateShape>>;
  reconnect: (reconnectionToken: string) => Promise<ColyseusRoomLike<RealtimeStateShape>>;
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

interface RealtimeStateShape {
  players?: unknown;
  regionId?: string;
}

type Listener = (snapshot: RealtimeSnapshot) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

const INITIAL_SNAPSHOT: RealtimeSnapshot = {
  errorMessage: null,
  players: [],
  regionId: null,
  roomId: null,
  roomName: null,
  status: 'disconnected',
};

const MAX_RECONNECT_ATTEMPTS = 8;
const OFFLINE_FALLBACK_MS = 10_000;

export class ColyseusService {
  private readonly listeners = new Set<Listener>();

  private readonly clientFactory: () => ColyseusClientLike;

  private client: ColyseusClientLike | null = null;

  private currentRoom: ColyseusRoomLike<RealtimeStateShape> | null = null;

  private disconnectRequested = false;

  private reconnectAttempts = 0;

  private reconnectTimer: TimerHandle | null = null;

  private movementTimer: TimerHandle | null = null;

  private queuedMovement: MovePlayerMessage | null = null;

  private lastMovementSentAt = 0;

  private snapshot: RealtimeSnapshot = INITIAL_SNAPSHOT;

  constructor(clientFactory: () => ColyseusClientLike = () => new Client(appEnv.wsUrl)) {
    this.clientFactory = clientFactory;
  }

  async connectToRegionRoom(input: ConnectToRegionRoomInput): Promise<RealtimeSnapshot> {
    const roomName = REGION_REALTIME_ROOM_NAMES[input.regionId];

    if (
      this.currentRoom &&
      this.snapshot.status === 'connected' &&
      this.snapshot.roomName === roomName
    ) {
      return this.snapshot;
    }

    this.disconnectRequested = false;
    this.clearReconnectTimer();
    this.clearMovementTimer();
    this.lastMovementSentAt = 0;
    this.queuedMovement = null;

    if (this.currentRoom) {
      await this.disconnect();
    }

    this.setSnapshot({
      errorMessage: null,
      players: [],
      regionId: input.regionId,
      roomId: null,
      roomName,
      status: 'connecting',
    });

    try {
      const room = await this.ensureClient().joinOrCreate(roomName, {
        accessToken: input.accessToken,
        regionId: input.regionId,
      });

      this.bindRoom(room, input.regionId);
    } catch (error) {
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: normalizeRealtimeError(error),
        status: 'disconnected',
      });

      // Schedule a deferred retry after the offline fallback delay
      this.reconnectAttempts = 0;
      this.reconnectTimer = setTimeout(() => {
        if (!this.disconnectRequested) {
          void this.connectToRegionRoom(input);
        }
      }, OFFLINE_FALLBACK_MS);
    }

    return this.snapshot;
  }

  async disconnect(): Promise<void> {
    this.disconnectRequested = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.clearMovementTimer();
    this.queuedMovement = null;
    this.lastMovementSentAt = 0;

    const room = this.currentRoom;
    this.currentRoom = null;

    if (room) {
      try {
        await room.leave(true);
      } catch {
        // Best-effort cleanup on mobile navigation/logout.
      }
    }

    this.setSnapshot({
      errorMessage: null,
      players: [],
      regionId: this.snapshot.regionId,
      roomId: null,
      roomName: this.snapshot.roomName,
      status: 'disconnected',
    });
  }

  getSnapshot(): RealtimeSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  sendPlayerMove(message: MovePlayerMessage): void {
    if (this.snapshot.status !== 'connected') {
      return;
    }

    const normalizedMessage = normalizeMovePlayerMessage(message);

    if (!normalizedMessage) {
      return;
    }

    this.queuedMovement = normalizedMessage;
    this.flushQueuedMovement();
  }

  private bindRoom(room: ColyseusRoomLike<RealtimeStateShape>, regionId: RegionId): void {
    this.currentRoom = room;
    this.reconnectAttempts = 0;
    this.lastMovementSentAt = Date.now() - REALTIME_MOVEMENT_THROTTLE_MS;
    this.updateFromState(room.state, room, 'connected', regionId);

    room.onStateChange((state) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.updateFromState(state, room, 'connected', regionId);
    });

    room.onError((code, message) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        errorMessage: `[${code}] ${message ?? 'Erro na room realtime.'}`,
      });
    });

    room.onLeave((_code, reason) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.currentRoom = null;
      this.clearMovementTimer();
      this.queuedMovement = null;

      if (this.disconnectRequested) {
        this.setSnapshot({
          ...this.snapshot,
          errorMessage: null,
          players: [],
          roomId: null,
          status: 'disconnected',
        });
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        errorMessage: reason ?? 'Conexão em tempo real perdida.',
        players: [],
        roomId: null,
        status: 'reconnecting',
      });
      this.scheduleReconnect(room.reconnectionToken, regionId);
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearMovementTimer(): void {
    if (this.movementTimer) {
      clearTimeout(this.movementTimer);
      this.movementTimer = null;
    }
  }

  private ensureClient(): ColyseusClientLike {
    if (!this.client) {
      this.client = this.clientFactory();
    }

    return this.client;
  }

  private scheduleReconnect(reconnectionToken: string, regionId: RegionId): void {
    this.clearReconnectTimer();
    const attempt = this.reconnectAttempts + 1;

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: 'Não foi possível reconectar. Jogo em modo offline.',
        status: 'disconnected',
      });
      return;
    }

    const delayMs = Math.min(500 * 2 ** (attempt - 1), 4_000);

    this.reconnectAttempts = attempt;
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect(reconnectionToken, regionId);
    }, delayMs);
  }

  private async reconnect(reconnectionToken: string, regionId: RegionId): Promise<void> {
    if (this.disconnectRequested) {
      return;
    }

    try {
      const room = await this.ensureClient().reconnect(reconnectionToken);
      this.bindRoom(room, regionId);
    } catch (error) {
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: normalizeRealtimeError(error),
        status: 'reconnecting',
      });
      this.scheduleReconnect(reconnectionToken, regionId);
    }
  }

  private flushQueuedMovement(): void {
    if (!this.queuedMovement || !this.currentRoom || this.snapshot.status !== 'connected') {
      return;
    }

    const elapsedMs = Date.now() - this.lastMovementSentAt;

    if (elapsedMs < REALTIME_MOVEMENT_THROTTLE_MS) {
      if (!this.movementTimer) {
        this.movementTimer = setTimeout(() => {
          this.movementTimer = null;
          this.flushQueuedMovement();
        }, REALTIME_MOVEMENT_THROTTLE_MS - elapsedMs);
      }

      return;
    }

    this.currentRoom.send(REALTIME_MESSAGE_PLAYER_MOVE, this.queuedMovement);
    this.lastMovementSentAt = Date.now();
    this.queuedMovement = null;
    this.clearMovementTimer();
  }

  private setSnapshot(snapshot: RealtimeSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private updateFromState(
    state: RealtimeStateShape | undefined,
    room: ColyseusRoomLike<RealtimeStateShape>,
    status: RealtimeConnectionStatus,
    fallbackRegionId: RegionId,
  ): void {
    const regionId = normalizeRegionId(state?.regionId) ?? fallbackRegionId;

    this.setSnapshot({
      errorMessage: null,
      players: extractPlayers(state?.players),
      regionId,
      roomId: room.roomId,
      roomName: room.name,
      status,
    });
  }
}

export const colyseusService = new ColyseusService();

function extractPlayers(playersSource: unknown): RealtimePlayerSnapshot[] {
  const players: RealtimePlayerSnapshot[] = [];

  iterateCollection(playersSource, (sessionId, value) => {
    const player = value as Partial<RealtimePlayerSnapshot> | undefined;

    if (!player?.playerId || !player.nickname) {
      return;
    }

    players.push({
      animation: player.animation ?? 'idle_s',
      nickname: player.nickname,
      playerId: player.playerId,
      regionId: player.regionId ?? 'centro',
      sessionId,
      title: player.title ?? 'pivete',
      vocation: player.vocation ?? 'cria',
      x: typeof player.x === 'number' ? player.x : 0,
      y: typeof player.y === 'number' ? player.y : 0,
    });
  });

  return players;
}

function iterateCollection(
  source: unknown,
  callback: (key: string, value: unknown) => void,
): void {
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

function normalizeRealtimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (!message) {
    return 'Falha ao reconectar em tempo real.';
  }

  if (/Cannot read property|undefined|null/i.test(message)) {
    return 'Falha ao sincronizar a rua em tempo real.';
  }

  if (/fetch|network|timeout|socket|ws/i.test(message)) {
    return 'Falha de conexão com o realtime.';
  }

  return message.length > 120 ? 'Falha ao sincronizar a rua em tempo real.' : message;
}

function normalizeRegionId(regionId: string | undefined): RegionId | null {
  if (regionId && Object.values(RegionId).includes(regionId as RegionId)) {
    return regionId as RegionId;
  }

  return null;
}

function normalizeMovePlayerMessage(message: MovePlayerMessage): MovePlayerMessage | null {
  if (
    !Number.isFinite(message.x) ||
    !Number.isFinite(message.y) ||
    typeof message.animation !== 'string'
  ) {
    return null;
  }

  return {
    animation: message.animation,
    x: Number(message.x.toFixed(3)),
    y: Number(message.y.toFixed(3)),
  };
}
