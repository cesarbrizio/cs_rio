import { type BichoPlaceBetInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { BichoError, type BichoServiceContract } from '../../services/bicho.js';

interface BichoRouteDependencies {
  bichoService: BichoServiceContract;
}

export function createBichoRoutes({
  bichoService,
}: BichoRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/jogo-do-bicho', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await bichoService.listState(request.playerId);
        return reply.send(response);
      } catch (error) {
        return sendBichoError(reply, error);
      }
    });

    fastify.post<{ Body: BichoPlaceBetInput }>('/jogo-do-bicho/bets', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await bichoService.placeBet(request.playerId, request.body);
        return reply.code(201).send(response);
      } catch (error) {
        return sendBichoError(reply, error);
      }
    });
  };
}

function sendBichoError(reply: FastifyReply, error: unknown) {
  if (error instanceof BichoError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'not_found'
            ? 404
            : error.code === 'insufficient_funds' || error.code === 'character_not_ready'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no jogo do bicho.',
  });
}
