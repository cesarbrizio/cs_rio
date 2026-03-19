import {
  REALTIME_MESSAGE_PLAYER_MOVE,
  REALTIME_MOVEMENT_THROTTLE_MS,
  REGION_REALTIME_ROOM_NAMES,
  RegionId,
  type MovePlayerMessage,
} from '@cs-rio/shared';

import {
  BaseRealtimeRoomService,
  type BaseColyseusClientLike,
  type BaseColyseusRoomLike,
  type BaseRealtimeConnectionStatus,
  type RealtimeObservabilityEvent,
} from './baseRealtimeRoom';
import {
  isRecord,
  iterateRealtimeCollection,
  readNumber,
  readString,
} from './stateGuards';

export type RealtimeConnectionStatus = BaseRealtimeConnectionStatus;

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

interface RealtimeStateShape {
  players?: unknown;
  regionId?: string;
}

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

export class ColyseusService extends BaseRealtimeRoomService<
  RealtimeSnapshot,
  RealtimeStateShape
> {
  private movementTimer: TimerHandle | null = null;

  private queuedMovement: MovePlayerMessage | null = null;

  private lastMovementSentAt = 0;

  constructor(
    clientFactory: () => BaseColyseusClientLike<RealtimeStateShape>,
    onRealtimeEvent?: (input: RealtimeObservabilityEvent) => void,
  ) {
    super(
      INITIAL_SNAPSHOT,
      clientFactory,
      onRealtimeEvent
        ? {
            channel: 'region',
            onEvent: onRealtimeEvent,
          }
        : undefined,
    );
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

    this.clearMovementTimer();
    this.disconnectRequested = false;
    super.clearReconnectTimer();
    this.lastMovementSentAt = 0;
    this.queuedMovement = null;

    if (this.currentRoom) {
      await this.leaveCurrentRoom();
    }

    this.setSnapshot({
      errorMessage: null,
      players: [],
      regionId: input.regionId,
      roomId: null,
      roomName,
      status: 'connecting',
    });
    this.recordRealtimeEvent('connecting');

    try {
      const room = await this.ensureClient().joinOrCreate(roomName, {
        accessToken: input.accessToken,
        regionId: input.regionId,
      });

      this.bindRegionRoom(room, input.regionId);
    } catch (error) {
      const normalizedError = normalizeRealtimeError(error);
      this.recordRealtimeEvent('disconnected', normalizedError);
      this.setSnapshot({
        ...this.snapshot,
        errorMessage: normalizedError,
        status: 'disconnected',
      });

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
    await this.disconnectRoom(
      (current) => ({
        errorMessage: null,
        players: [],
        regionId: current.regionId,
        roomId: null,
        roomName: current.roomName,
        status: 'disconnected',
      }),
      () => {
        this.clearMovementTimer();
        this.queuedMovement = null;
        this.lastMovementSentAt = 0;
      },
    );
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

  private clearMovementTimer(): void {
    if (this.movementTimer) {
      clearTimeout(this.movementTimer);
      this.movementTimer = null;
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

  private bindRegionRoom(
    room: BaseColyseusRoomLike<RealtimeStateShape>,
    regionId: RegionId,
  ): void {
    super.bindRoom(room, {
      buildDisconnectedSnapshot: (current) => ({
        ...current,
        errorMessage: null,
        players: [],
        roomId: null,
        status: 'disconnected',
      }),
      buildErrorSnapshot: (current, code, message) => ({
        ...current,
        errorMessage: `[${code}] ${message ?? 'Erro na room realtime.'}`,
      }),
      buildReconnectErrorSnapshot: (current, error) => ({
        ...current,
        errorMessage: normalizeRealtimeError(error),
        status: 'reconnecting',
      }),
      buildReconnectingSnapshot: (current, reason) => ({
        ...current,
        errorMessage: reason ?? 'Conexão em tempo real perdida.',
        players: [],
        roomId: null,
        status: 'reconnecting',
      }),
      buildReconnectExhaustedSnapshot: (current) => ({
        ...current,
        errorMessage: 'Não foi possível reconectar. Jogo em modo offline.',
        status: 'disconnected',
      }),
      fallbackContext: regionId,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      onBeforeBind: () => {
        this.lastMovementSentAt = Date.now() - REALTIME_MOVEMENT_THROTTLE_MS;
      },
      onBeforeUnexpectedLeave: () => {
        this.clearMovementTimer();
        this.queuedMovement = null;
      },
      updateFromState: (state, activeRoom, status, fallbackRegionId) =>
        this.buildSnapshotFromState(state, activeRoom, status, fallbackRegionId),
    });
  }

  private buildSnapshotFromState(
    state: RealtimeStateShape | undefined,
    room: BaseColyseusRoomLike<RealtimeStateShape>,
    status: RealtimeConnectionStatus,
    fallbackRegionId: RegionId,
  ): RealtimeSnapshot {
    const regionId = normalizeRegionId(state?.regionId) ?? fallbackRegionId;

    return {
      errorMessage: null,
      players: extractPlayers(state?.players),
      regionId,
      roomId: room.roomId,
      roomName: room.name,
      status,
    };
  }
}

function extractPlayers(playersSource: unknown): RealtimePlayerSnapshot[] {
  const players: RealtimePlayerSnapshot[] = [];

  iterateRealtimeCollection(playersSource, (sessionId, value) => {
    if (!isRecord(value)) {
      return;
    }

    const playerId = readString(value, 'playerId');
    const nickname = readString(value, 'nickname');

    if (!playerId || !nickname) {
      return;
    }

    players.push({
      animation: readString(value, 'animation') ?? 'idle_s',
      nickname,
      playerId,
      regionId: readString(value, 'regionId') ?? 'centro',
      sessionId,
      title: readString(value, 'title') ?? 'pivete',
      vocation: readString(value, 'vocation') ?? 'cria',
      x: readNumber(value, 'x') ?? 0,
      y: readNumber(value, 'y') ?? 0,
    });
  });

  return players;
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
