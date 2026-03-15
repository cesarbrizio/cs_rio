import {
  REGION_REALTIME_ROOM_NAMES,
  RegionId,
} from '@cs-rio/shared';
import { type AuthContext, type Client, Room } from 'colyseus';

import { type InfrastructureLogger } from '../observability/logger.js';
import { AuthError, type AuthService } from '../services/auth.js';
import { type PlayerService } from '../services/player.js';
import { resolveRealtimeAccessToken } from './auth.js';
import {
  GameState,
  NpcState,
  PlayerState,
  WorldEntityState,
} from './schemas/GameState.js';
import { registerMovementHandlers } from './handlers/movement.js';

export interface GameRoomAuth {
  nickname: string;
  playerId: string;
  positionX: number;
  positionY: number;
  regionId: RegionId;
  title: string;
  vocation: string;
}

export interface GameRoomDependencies {
  authService: Pick<AuthService, 'verifyAccessToken'>;
  logger?: Pick<InfrastructureLogger, 'error'>;
  playerService: Pick<PlayerService, 'getFreshPlayerProfile'>;
}

export interface GameRoomOptions {
  regionId: RegionId;
  roomName?: string;
}

type AuthenticatedGameClient = Client<{
  auth: GameRoomAuth;
  userData: {
    lastAcceptedMoveAt?: number;
    playerId: string;
  };
}>;

export function createGameRoom(dependencies: GameRoomDependencies) {
  return class CsRioGameRoom extends Room<{ state: GameState }> {
    declare state: GameState;

    public override onCreate(options: GameRoomOptions): void {
      const regionId = normalizeRegionId(options.regionId);

      this.maxClients = 100;
      this.patchRate = 1000 / 15;
      this.autoDispose = false;
      this.setState(new GameState(regionId));
      seedRegionState(this.state, regionId);
      registerMovementHandlers(this);
    }

    public override async onAuth(
      _client: Client,
      options: Record<string, unknown> = {},
      context: AuthContext,
    ): Promise<GameRoomAuth> {
      const token = resolveRealtimeAccessToken(options, context);

      if (!token) {
        throw new AuthError('unauthorized', 'Token ausente.');
      }

      const identity = dependencies.authService.verifyAccessToken(token);
      const profile = await dependencies.playerService.getFreshPlayerProfile(identity.playerId);

      if (!profile.hasCharacter) {
        throw new AuthError('unauthorized', 'Personagem ainda nao foi criado para esta conta.');
      }

      if (profile.regionId !== this.state.regionId) {
        throw new AuthError('unauthorized', 'Jogador nao pertence a esta room de regiao.');
      }

      return {
        nickname: profile.nickname,
        playerId: profile.id,
        positionX: profile.location.positionX,
        positionY: profile.location.positionY,
        regionId: profile.regionId,
        title: profile.title,
        vocation: profile.vocation,
      };
    }

    public override onJoin(client: AuthenticatedGameClient): void {
      const auth = ensureClientAuth(client);

      client.userData = {
        lastAcceptedMoveAt: Date.now(),
        playerId: auth.playerId,
      };

      this.state.players.set(
        client.sessionId,
        new PlayerState({
          animation: 'idle_s',
          nickname: auth.nickname,
          playerId: auth.playerId,
          regionId: auth.regionId,
          title: auth.title,
          vocation: auth.vocation,
          x: auth.positionX,
          y: auth.positionY,
        }),
      );
    }

    public override onLeave(client: Client): void {
      this.state.players.delete(client.sessionId);
    }

    public override onUncaughtException(error: Error, methodName: string): void {
      dependencies.logger?.error(
        {
          err: error,
          methodName,
          regionId: this.state?.regionId,
          roomId: this.roomId,
          roomName: this.roomName,
        },
        'Realtime game room uncaught exception.',
      );
    }
  };
}

function ensureClientAuth(client: AuthenticatedGameClient): GameRoomAuth {
  if (!client.auth) {
    throw new AuthError('unauthorized', 'Cliente entrou sem auth validada.');
  }

  return client.auth;
}

function normalizeRegionId(regionId: RegionId): RegionId {
  if (!Object.values(RegionId).includes(regionId)) {
    throw new AuthError('validation', 'Regiao da room invalida.');
  }

  return regionId;
}

function seedRegionState(state: GameState, regionId: RegionId): void {
  for (const npc of buildRegionNpcs(regionId)) {
    state.npcs.set(npc.id, new NpcState(npc));
  }

  for (const entity of buildRegionEntities(regionId)) {
    state.entities.set(entity.id, new WorldEntityState(entity));
  }
}

function buildRegionEntities(regionId: RegionId): WorldEntitySeed[] {
  const roomName = REGION_REALTIME_ROOM_NAMES[regionId];
  const base = regionSeedBase(regionId);

  return [
    {
      animation: 'idle_neon',
      id: `${roomName}:black_market`,
      kind: 'mercado_negro',
      label: 'Mercado Negro',
      x: base.x + 18,
      y: base.y + 10,
    },
    {
      animation: 'smoke',
      id: `${roomName}:boca`,
      kind: 'boca',
      label: 'Boca da Favela',
      x: base.x + 46,
      y: base.y + 24,
    },
    {
      animation: 'pulse',
      id: `${roomName}:stash`,
      kind: 'caixa',
      label: 'Caixa Rota',
      x: base.x + 30,
      y: base.y + 38,
    },
  ];
}

function buildRegionNpcs(regionId: RegionId): NpcSeed[] {
  const roomName = REGION_REALTIME_ROOM_NAMES[regionId];
  const base = regionSeedBase(regionId);

  return [
    {
      animation: 'idle_s',
      behavior: 'vigia',
      id: `${roomName}:vigia`,
      label: 'Vigia',
      x: base.x + 12,
      y: base.y + 18,
    },
    {
      animation: 'idle_w',
      behavior: 'comerciante',
      id: `${roomName}:fornecedor`,
      label: 'Fornecedor',
      x: base.x + 58,
      y: base.y + 14,
    },
  ];
}

function regionSeedBase(regionId: RegionId): { x: number; y: number } {
  switch (regionId) {
    case RegionId.ZonaSul:
      return { x: 110, y: 68 };
    case RegionId.ZonaNorte:
      return { x: 76, y: 110 };
    case RegionId.Centro:
      return { x: 92, y: 86 };
    case RegionId.ZonaOeste:
      return { x: 138, y: 120 };
    case RegionId.ZonaSudoeste:
      return { x: 154, y: 78 };
    case RegionId.Baixada:
      return { x: 48, y: 142 };
    default:
      return { x: 92, y: 86 };
  }
}

interface WorldEntitySeed {
  animation: string;
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}

interface NpcSeed {
  animation: string;
  behavior: string;
  id: string;
  label: string;
  x: number;
  y: number;
}
