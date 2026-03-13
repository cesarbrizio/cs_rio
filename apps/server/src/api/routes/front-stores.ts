import { type FrontStoreInvestInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { FrontStoreError, type FrontStoreServiceContract } from '../../services/front-store.js';

interface FrontStoreRouteDependencies {
  frontStoreService: FrontStoreServiceContract;
}

export function createFrontStoreRoutes({
  frontStoreService,
}: FrontStoreRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/front-stores', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await frontStoreService.listFrontStores(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendFrontStoreError(reply, error);
      }
    });

    fastify.post<{ Body: FrontStoreInvestInput; Params: { propertyId: string } }>(
      '/front-stores/:propertyId/invest',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await frontStoreService.invest(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFrontStoreError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/front-stores/:propertyId/collect',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await frontStoreService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendFrontStoreError(reply, error);
        }
      },
    );
  };
}

function sendFrontStoreError(reply: FastifyReply, error: unknown) {
  if (error instanceof FrontStoreError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'not_found'
            ? 404
            : error.code === 'insufficient_funds'
              ? 422
              : error.code === 'capacity' ||
                  error.code === 'conflict' ||
                  error.code === 'character_not_ready'
                ? 409
                : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de lojas de fachada.',
  });
}
