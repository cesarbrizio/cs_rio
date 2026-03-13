import {
  type RavePricingInput,
  type RaveStockInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { RaveError, type RaveServiceContract } from '../../services/rave.js';

interface RaveRouteDependencies {
  raveService: RaveServiceContract;
}

export function createRaveRoutes({
  raveService,
}: RaveRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/raves', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await raveService.listRaves(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendRaveError(reply, error);
      }
    });

    fastify.post<{ Body: RaveStockInput; Params: { propertyId: string } }>(
      '/raves/:propertyId/stock',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await raveService.stockDrug(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendRaveError(reply, error);
        }
      },
    );

    fastify.post<{ Body: RavePricingInput; Params: { propertyId: string } }>(
      '/raves/:propertyId/pricing',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await raveService.configurePricing(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendRaveError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/raves/:propertyId/collect',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await raveService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendRaveError(reply, error);
        }
      },
    );
  };
}

function sendRaveError(reply: FastifyReply, error: unknown) {
  if (error instanceof RaveError) {
    const statusCode =
      error.code === 'validation' || error.code === 'invalid_lineup'
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
    message: 'Falha inesperada na gestao de raves.',
  });
}
