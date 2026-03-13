import { type PlayerCreationInput, type PlayerTravelInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError } from '../../services/auth.js';
import { PlayerError, type PlayerService } from '../../services/player.js';

interface PlayerRouteDependencies {
  playerService: PlayerService;
}

export function createPlayerRoutes({
  playerService,
}: PlayerRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/players/me', async (request, reply) => {
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
    });

    fastify.post<{ Body: PlayerCreationInput }>('/players/create', async (request, reply) => {
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
    });

    fastify.post<{ Body: PlayerTravelInput }>('/players/travel', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const body = request.body as PlayerTravelInput;
        const player = await playerService.travelToRegion(request.playerId, body.regionId);
        return reply.send(player);
      } catch (error) {
        return sendPlayerError(reply, error);
      }
    });
  };
}

function sendPlayerError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    const statusCode =
      error.code === 'validation' ? 400 : error.code === 'conflict' ? 409 : 401;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  if (error instanceof PlayerError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'conflict'
          ? 409
          : error.code === 'not_found'
            ? 404
            : 401;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao do jogador.',
  });
}
