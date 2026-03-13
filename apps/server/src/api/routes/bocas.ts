import { type BocaStockInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { BocaError, type BocaServiceContract } from '../../services/boca.js';

interface BocaRouteDependencies {
  bocaService: BocaServiceContract;
}

export function createBocaRoutes({
  bocaService,
}: BocaRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/bocas', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await bocaService.listBocas(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendBocaError(reply, error);
      }
    });

    fastify.post<{ Body: BocaStockInput; Params: { propertyId: string } }>(
      '/bocas/:propertyId/stock',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await bocaService.stockDrug(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendBocaError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/bocas/:propertyId/collect',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await bocaService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendBocaError(reply, error);
        }
      },
    );
  };
}

function sendBocaError(reply: FastifyReply, error: unknown) {
  if (error instanceof BocaError) {
    const statusCode =
      error.code === 'validation' || error.code === 'invalid_stock'
        ? 400
        : error.code === 'not_found'
          ? 404
          : error.code === 'unauthorized'
            ? 401
            : error.code === 'character_not_ready'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de bocas.',
  });
}
