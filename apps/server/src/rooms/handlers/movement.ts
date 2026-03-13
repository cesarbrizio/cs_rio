import {
  REALTIME_MAX_SPEED_TILES_PER_SECOND,
  REALTIME_MESSAGE_PLAYER_MOVE,
  REALTIME_MOVEMENT_THROTTLE_MS,
  REALTIME_POSITION_BUFFER_TILES,
  type MovePlayerMessage,
} from '@cs-rio/shared';
import { type Client } from 'colyseus';

import { type GameState } from '../schemas/GameState.js';

export interface MovementClientUserData {
  lastAcceptedMoveAt?: number;
  playerId?: string;
}

export interface MovementRoomLike {
  onMessage: <T>(
    type: string,
    callback: (client: Client<{ userData: MovementClientUserData }>, message: T) => void,
  ) => void;
  state: GameState;
}

export interface HandlePlayerMoveMessageOptions {
  allowedDistanceBuffer?: number;
  maxSpeedTilesPerSecond?: number;
  now?: () => number;
}

export function registerMovementHandlers(
  room: MovementRoomLike,
  options: HandlePlayerMoveMessageOptions = {},
): void {
  room.onMessage<MovePlayerMessage>(REALTIME_MESSAGE_PLAYER_MOVE, (client, message) => {
    handlePlayerMoveMessage({
      client,
      message,
      now: options.now,
      room,
      maxSpeedTilesPerSecond: options.maxSpeedTilesPerSecond,
      allowedDistanceBuffer: options.allowedDistanceBuffer,
    });
  });
}

export function handlePlayerMoveMessage({
  client,
  message,
  now = Date.now,
  room,
  maxSpeedTilesPerSecond = REALTIME_MAX_SPEED_TILES_PER_SECOND,
  allowedDistanceBuffer = REALTIME_POSITION_BUFFER_TILES,
}: {
  client: Client<{ userData: MovementClientUserData }>;
  message: MovePlayerMessage;
  now?: () => number;
  room: Pick<MovementRoomLike, 'state'>;
} & HandlePlayerMoveMessageOptions): boolean {
  if (!isMovePlayerMessage(message)) {
    return false;
  }

  const playerState = room.state.players.get(client.sessionId);

  if (!playerState) {
    return false;
  }

  const acceptedAt = now();
  const lastAcceptedMoveAt =
    client.userData?.lastAcceptedMoveAt ?? acceptedAt - REALTIME_MOVEMENT_THROTTLE_MS;
  const elapsedSeconds = clamp(
    (acceptedAt - lastAcceptedMoveAt) / 1000,
    REALTIME_MOVEMENT_THROTTLE_MS / 1000,
    1,
  );
  const distance = Math.hypot(message.x - playerState.x, message.y - playerState.y);
  const allowedDistance = maxSpeedTilesPerSecond * elapsedSeconds + allowedDistanceBuffer;

  if (distance > allowedDistance) {
    return false;
  }

  playerState.animation = sanitizeAnimation(message.animation, playerState.animation);
  playerState.x = roundCoordinate(message.x);
  playerState.y = roundCoordinate(message.y);
  client.userData = {
    ...client.userData,
    lastAcceptedMoveAt: acceptedAt,
  };

  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isMovePlayerMessage(message: unknown): message is MovePlayerMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as Partial<MovePlayerMessage>;

  return (
    typeof candidate.animation === 'string' &&
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y)
  );
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

function sanitizeAnimation(animation: string, fallback: string): string {
  return /^(idle|walk)_(n|ne|e|se|s|sw|w|nw)$/.test(animation) ? animation : fallback;
}
