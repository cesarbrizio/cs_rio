import {
  FACTION_REALTIME_ROOM_NAME,
  type RegionId,
} from '@cs-rio/shared';
import { Server, WebSocketTransport } from 'colyseus';

import { createFactionRoom } from './rooms/FactionRoom.js';
import { createGameRoom, type GameRoomDependencies } from './rooms/GameRoom.js';
import { type AuthService } from './services/auth.js';
import { type PlayerService } from './services/player.js';
import { ServerConfigService } from './services/server-config.js';

export interface RealtimeRoomDefinition {
  regionId: RegionId;
  roomName: string;
}

export interface CreateRealtimeServerOptions extends GameRoomDependencies {
  serverConfigService?: Pick<ServerConfigService, 'listRealtimeRoomDefinitions'>;
  transport?: WebSocketTransport;
}

export async function createRealtimeServer({
  authService,
  playerService,
  serverConfigService,
  transport,
}: CreateRealtimeServerOptions): Promise<Server> {
  const realtimeServer = new Server({
    greet: false,
    transport: transport ?? new WebSocketTransport(),
  });
  const gameRoom = createGameRoom({
    authService,
    playerService,
  });
  const factionRoom = createFactionRoom({
    authService,
    playerService,
  });
  const roomDefinitions = await (serverConfigService ?? new ServerConfigService()).listRealtimeRoomDefinitions();

  for (const definition of roomDefinitions) {
    realtimeServer.define(definition.roomName, gameRoom, {
      regionId: definition.regionId,
      roomName: definition.roomName,
    });
  }

  realtimeServer
    .define(FACTION_REALTIME_ROOM_NAME, factionRoom, {
      factionId: '__pending__',
      roomName: FACTION_REALTIME_ROOM_NAME,
    })
    .filterBy(['factionId']);

  return realtimeServer;
}

export type RealtimeAuthService = Pick<AuthService, 'verifyAccessToken'>;
export type RealtimePlayerService = Pick<PlayerService, 'getPlayerProfile'>;
