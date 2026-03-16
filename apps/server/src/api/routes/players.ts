import {
  type PlayerCreationInput,
  type PlayerTravelInput,
  type PlayerVocationChangeInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  playerCreationBodySchema,
  playerPublicProfileParamsSchema,
  playerTravelBodySchema,
  playerVocationChangeBodySchema,
} from '../schemas.js';
import { type PlayerService } from '../../services/player.js';

interface PlayerRouteDependencies {
  playerService: PlayerService;
}

export function createPlayerRoutes({
  playerService,
}: PlayerRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Params: { nickname: string } }>(
      '/players/public/:nickname',
      {
        schema: {
          params: playerPublicProfileParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        try {
          const profile = await playerService.getPublicProfileByNickname(request.params.nickname);
          return reply.send(profile);
        } catch (error) {
          return sendPlayerError(reply, error);
        }
      },
    );

    fastify.get(
      '/players/vocation',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const center = await playerService.getVocationCenter(request.playerId);
          return reply.send(center);
        } catch (error) {
          return sendPlayerError(reply, error);
        }
      },
    );

    fastify.get(
      '/players/me',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const player = await playerService.getPlayerProfile(request.playerId);
        return reply.send(player);
      } catch (error) {
        return sendPlayerError(reply, error);
      }
      },
    );

    fastify.post<{ Body: PlayerCreationInput }>(
      '/players/create',
      {
        schema: {
          body: playerCreationBodySchema,
          response: buildStandardResponseSchema(201),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const player = await playerService.createCharacter(request.playerId, request.body);
        return reply.code(201).send(player);
      } catch (error) {
        return sendPlayerError(reply, error);
      }
      },
    );

    fastify.post<{ Body: PlayerTravelInput }>(
      '/players/travel',
      {
        schema: {
          body: playerTravelBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const player = await playerService.travelToRegion(request.playerId, request.body.regionId);
        return reply.send(player);
      } catch (error) {
        return sendPlayerError(reply, error);
      }
      },
    );

    fastify.post<{ Body: PlayerVocationChangeInput }>(
      '/players/vocation/change',
      {
        schema: {
          body: playerVocationChangeBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const response = await playerService.changeVocation(request.playerId, request.body);
          return reply.send(response);
        } catch (error) {
          return sendPlayerError(reply, error);
        }
      },
    );
  };
}

function sendPlayerError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao do jogador.');
}
