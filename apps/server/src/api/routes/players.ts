import { type PlayerCreationInput, type PlayerTravelInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  playerCreationBodySchema,
  playerTravelBodySchema,
} from '../schemas.js';
import { type PlayerService } from '../../services/player.js';

interface PlayerRouteDependencies {
  playerService: PlayerService;
}

export function createPlayerRoutes({
  playerService,
}: PlayerRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
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
  };
}

function sendPlayerError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao do jogador.');
}
