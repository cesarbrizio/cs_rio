import { type FactionRank } from '@cs-rio/shared';
import { type AuthContext, type Client, Room } from 'colyseus';

import { type InfrastructureLogger } from '../observability/logger.js';
import { AuthError, type AuthService } from '../services/auth.js';
import { type PlayerService } from '../services/player.js';
import { resolveRealtimeAccessToken } from './auth.js';
import {
  appendFactionSystemMessage,
  registerFactionRoomHandlers,
  upsertFactionPresence,
} from './handlers/faction.js';
import { FactionState } from './schemas/FactionState.js';

export interface FactionRoomAuth {
  factionAbbreviation: string;
  factionId: string;
  factionName: string;
  isLeader: boolean;
  nickname: string;
  playerId: string;
  rank: FactionRank;
  title: string;
  vocation: string;
}

export interface FactionRoomDependencies {
  authService: Pick<AuthService, 'verifyAccessToken'>;
  logger?: Pick<InfrastructureLogger, 'error'>;
  playerService: Pick<PlayerService, 'getFreshPlayerProfile'>;
}

export interface FactionRoomOptions {
  factionId: string;
  roomName?: string;
}

type AuthenticatedFactionClient = Client<{
  auth: FactionRoomAuth;
  userData: {
    factionId: string;
    playerId: string;
  };
}>;

export function createFactionRoom(dependencies: FactionRoomDependencies) {
  return class CsRioFactionRoom extends Room<{ state: FactionState }> {
    declare state: FactionState;

    public override onCreate(options: FactionRoomOptions): void {
      const factionId = normalizeFactionId(options.factionId);

      this.maxClients = 80;
      this.patchRate = 1000 / 8;
      this.autoDispose = true;
      this.setState(
        new FactionState({
          factionId,
        }),
      );
      registerFactionRoomHandlers(this);
    }

    public override async onAuth(
      _client: Client,
      options: Record<string, unknown> = {},
      context: AuthContext,
    ): Promise<FactionRoomAuth> {
      const token = resolveRealtimeAccessToken(options, context);

      if (!token) {
        throw new AuthError('unauthorized', 'Token ausente.');
      }

      const identity = dependencies.authService.verifyAccessToken(token);
      const profile = await dependencies.playerService.getFreshPlayerProfile(identity.playerId);

      if (!profile.hasCharacter) {
        throw new AuthError('unauthorized', 'Personagem ainda nao foi criado para esta conta.');
      }

      if (!profile.faction) {
        throw new AuthError('unauthorized', 'Jogador nao pertence a nenhuma faccao.');
      }

      const requestedFactionId = normalizeFactionId(
        typeof options.factionId === 'string' ? options.factionId : this.state.factionId,
      );

      if (requestedFactionId !== profile.faction.id) {
        throw new AuthError('unauthorized', 'Jogador nao pertence a esta room de faccao.');
      }

      return {
        factionAbbreviation: profile.faction.abbreviation,
        factionId: profile.faction.id,
        factionName: profile.faction.name,
        isLeader: profile.faction.rank === 'patrao',
        nickname: profile.nickname,
        playerId: profile.id,
        rank: profile.faction.rank ?? 'cria',
        title: profile.title,
        vocation: profile.vocation,
      };
    }

    public override onJoin(client: AuthenticatedFactionClient): void {
      const auth = ensureFactionClientAuth(client);
      const now = new Date();

      client.userData = {
        factionId: auth.factionId,
        playerId: auth.playerId,
      };

      this.state.factionAbbreviation = auth.factionAbbreviation;
      this.state.factionId = auth.factionId;
      this.state.factionName = auth.factionName;
      upsertFactionPresence(
        this.state,
        client.sessionId,
        {
          isLeader: auth.isLeader,
          nickname: auth.nickname,
          playerId: auth.playerId,
          rank: auth.rank,
          title: auth.title,
          vocation: auth.vocation,
        },
        now,
      );
      appendFactionSystemMessage(this.state, `${auth.nickname} entrou no QG da faccao.`, now);
    }

    public override onLeave(client: AuthenticatedFactionClient): void {
      const auth = client.auth;

      this.state.members.delete(client.sessionId);

      if (auth) {
        appendFactionSystemMessage(this.state, `${auth.nickname} saiu da room da faccao.`, new Date());
      }
    }

    public override onUncaughtException(error: Error, methodName: string): void {
      dependencies.logger?.error(
        {
          err: error,
          factionId: this.state?.factionId,
          methodName,
          roomId: this.roomId,
          roomName: this.roomName,
        },
        'Realtime faction room uncaught exception.',
      );
    }
  };
}

function ensureFactionClientAuth(client: AuthenticatedFactionClient): FactionRoomAuth {
  if (!client.auth) {
    throw new AuthError('unauthorized', 'Cliente entrou sem auth validada.');
  }

  return client.auth;
}

function normalizeFactionId(factionId: string): string {
  const normalized = factionId.trim();

  if (!normalized) {
    throw new AuthError('validation', 'Faccao da room invalida.');
  }

  return normalized;
}
