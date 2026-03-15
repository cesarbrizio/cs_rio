import {
  recordRealtimeEvent,
  type MobileRealtimeChannel,
} from '../../features/mobile-observability';

export type BaseRealtimeConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting';

export interface BaseColyseusClientLike<State = unknown> {
  joinOrCreate: (
    roomName: string,
    options?: unknown,
  ) => Promise<BaseColyseusRoomLike<State>>;
  reconnect: (reconnectionToken: string) => Promise<BaseColyseusRoomLike<State>>;
}

export interface BaseColyseusRoomLike<State = unknown> {
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

type Listener<Snapshot> = (snapshot: Snapshot) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

interface ReconnectConfig<Snapshot, State, Fallback> {
  buildReconnectErrorSnapshot: (current: Snapshot, error: unknown) => Snapshot;
  buildReconnectExhaustedSnapshot?: (current: Snapshot) => Snapshot;
  buildErrorSnapshot: (current: Snapshot, code: number, message?: string) => Snapshot;
  buildDisconnectedSnapshot: (current: Snapshot) => Snapshot;
  buildReconnectingSnapshot: (current: Snapshot, reason?: string) => Snapshot;
  fallbackContext: Fallback;
  maxReconnectAttempts?: number;
  onBeforeBind?: () => void;
  onBeforeUnexpectedLeave?: () => void;
  updateFromState: (
    state: State | undefined,
    room: BaseColyseusRoomLike<State>,
    status: BaseRealtimeConnectionStatus,
    fallbackContext: Fallback,
  ) => Snapshot;
}

export class BaseRealtimeRoomService<Snapshot, State> {
  protected readonly listeners = new Set<Listener<Snapshot>>();

  protected readonly clientFactory: () => BaseColyseusClientLike<State>;

  protected client: BaseColyseusClientLike<State> | null = null;

  protected currentRoom: BaseColyseusRoomLike<State> | null = null;

  protected disconnectRequested = false;

  protected reconnectAttempts = 0;

  protected reconnectTimer: TimerHandle | null = null;

  protected snapshot: Snapshot;

  protected constructor(
    initialSnapshot: Snapshot,
    clientFactory: () => BaseColyseusClientLike<State>,
    private readonly observabilityChannel?: MobileRealtimeChannel,
  ) {
    this.snapshot = initialSnapshot;
    this.clientFactory = clientFactory;
  }

  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener<Snapshot>): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  protected async disconnectRoom(
    buildSnapshot: (current: Snapshot) => Snapshot,
    onBeforeDisconnect?: () => void,
  ): Promise<void> {
    this.disconnectRequested = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    onBeforeDisconnect?.();

    const room = this.currentRoom;
    this.currentRoom = null;

    if (room) {
      try {
        await room.leave(true);
      } catch {
        // Best-effort cleanup on navigation/logout.
      }
    }

    this.setSnapshot(buildSnapshot(this.snapshot));
    this.recordRealtimeEvent('disconnected');
  }

  protected async leaveCurrentRoom(onBeforeLeave?: () => void): Promise<void> {
    onBeforeLeave?.();

    const room = this.currentRoom;
    this.currentRoom = null;

    if (room) {
      try {
        await room.leave(true);
      } catch {
        // Best-effort cleanup while switching rooms.
      }
    }
  }

  protected bindRoom<Fallback>(
    room: BaseColyseusRoomLike<State>,
    config: ReconnectConfig<Snapshot, State, Fallback>,
  ): void {
    this.currentRoom = room;
    this.reconnectAttempts = 0;
    config.onBeforeBind?.();
    this.recordRealtimeEvent('connected');
    this.setSnapshot(
      config.updateFromState(room.state, room, 'connected', config.fallbackContext),
    );

    room.onStateChange((state) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.setSnapshot(
        config.updateFromState(state, room, 'connected', config.fallbackContext),
      );
    });

    room.onError((code, message) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.recordRealtimeEvent('connected', `[${code}] ${message ?? 'Erro de realtime.'}`);
      this.setSnapshot(config.buildErrorSnapshot(this.snapshot, code, message));
    });

    room.onLeave((_code, reason) => {
      if (room !== this.currentRoom) {
        return;
      }

      this.currentRoom = null;
      config.onBeforeUnexpectedLeave?.();

      if (this.disconnectRequested) {
        this.recordRealtimeEvent('disconnected');
        this.setSnapshot(config.buildDisconnectedSnapshot(this.snapshot));
        return;
      }

      this.recordRealtimeEvent(
        'reconnecting',
        reason ?? 'Conexão em tempo real perdida.',
      );
      this.setSnapshot(config.buildReconnectingSnapshot(this.snapshot, reason));
      this.scheduleReconnect(room.reconnectionToken, config);
    });
  }

  protected clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  protected ensureClient(): BaseColyseusClientLike<State> {
    if (!this.client) {
      this.client = this.clientFactory();
    }

    return this.client;
  }

  protected setSnapshot(snapshot: Snapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private scheduleReconnect<Fallback>(
    reconnectionToken: string,
    config: ReconnectConfig<Snapshot, State, Fallback>,
  ): void {
    this.clearReconnectTimer();
    const attempt = this.reconnectAttempts + 1;
    const maxReconnectAttempts = config.maxReconnectAttempts ?? Number.POSITIVE_INFINITY;

    if (attempt > maxReconnectAttempts) {
      if (config.buildReconnectExhaustedSnapshot) {
        this.recordRealtimeEvent('disconnected', 'Tentativas de reconexão esgotadas.');
        this.setSnapshot(config.buildReconnectExhaustedSnapshot(this.snapshot));
      } else {
        this.recordRealtimeEvent('disconnected', 'Tentativas de reconexão esgotadas.');
        this.setSnapshot(config.buildDisconnectedSnapshot(this.snapshot));
      }
      return;
    }

    const delayMs = Math.min(500 * 2 ** (attempt - 1), 4_000);
    this.reconnectAttempts = attempt;
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect(reconnectionToken, config);
    }, delayMs);
  }

  private async reconnect<Fallback>(
    reconnectionToken: string,
    config: ReconnectConfig<Snapshot, State, Fallback>,
  ): Promise<void> {
    if (this.disconnectRequested) {
      return;
    }

    try {
      const room = await this.ensureClient().reconnect(reconnectionToken);
      this.bindRoom(room, config);
    } catch (error) {
      this.recordRealtimeEvent('reconnecting', normalizeReconnectError(error));
      this.setSnapshot(config.buildReconnectErrorSnapshot(this.snapshot, error));
      this.scheduleReconnect(reconnectionToken, config);
    }
  }

  protected recordRealtimeEvent(
    status: BaseRealtimeConnectionStatus,
    errorMessage?: string,
  ): void {
    if (!this.observabilityChannel) {
      return;
    }

    recordRealtimeEvent({
      channel: this.observabilityChannel,
      errorMessage,
      status,
    });
  }
}

function normalizeReconnectError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Falha ao reconectar o realtime.';
}
