import { type RegionId } from './types.js';

export interface JoinRegionMessage {
  regionId: RegionId;
}

export interface MovePlayerMessage {
  x: number;
  y: number;
  animation: string;
}

export interface AttemptCrimeMessage {
  crimeId: string;
}

export interface RemotePlayerState {
  id: string;
  nickname: string;
  x: number;
  y: number;
  animation: string;
}

export interface RoomSnapshotMessage {
  regionId: RegionId;
  players: RemotePlayerState[];
}

export interface PlayerMovedMessage {
  player: RemotePlayerState;
}

export interface CrimeResultMessage {
  crimeId: string;
  success: boolean;
  moneyDelta: number;
  conceitoDelta: number;
  message: string;
}

export type FactionCoordinationKind = 'attack' | 'defend' | 'gather' | 'supply';

export interface FactionChatSendMessage {
  message: string;
}

export interface FactionCoordinationSendMessage {
  kind: FactionCoordinationKind;
  label: string;
}
