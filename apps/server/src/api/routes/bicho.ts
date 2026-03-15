import { type BichoPlaceBetInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import { bichoPlaceBetBodySchema, buildStandardResponseSchema } from '../schemas.js';
import { type BichoServiceContract } from '../../services/bicho.js';

interface BichoRouteDependencies {
  bichoService: BichoServiceContract;
}

export function createBichoRoutes({
  bichoService,
}: BichoRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/jogo-do-bicho',
      {
        schema: {
          response: buildStandardResponseSchema(),
        },
      },
      async (request, reply) => {
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
      },
    );

    fastify.post<{ Body: BichoPlaceBetInput }>(
      '/jogo-do-bicho/bets',
      {
        schema: {
          body: bichoPlaceBetBodySchema,
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
        const response = await bichoService.placeBet(request.playerId, request.body);
        return reply.code(201).send(response);
      } catch (error) {
        return sendBichoError(reply, error);
      }
      },
    );
  };
}

function sendBichoError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no jogo do bicho.');
}
