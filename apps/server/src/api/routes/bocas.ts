import { type BocaStockInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  bocaStockBodySchema,
  buildIdParamsSchema,
  buildStandardResponseSchema,
} from '../schemas.js';
import { type BocaServiceContract } from '../../services/boca.js';

interface BocaRouteDependencies {
  bocaService: BocaServiceContract;
}

export function createBocaRoutes({
  bocaService,
}: BocaRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/bocas',
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
        const result = await bocaService.listBocas(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendBocaError(reply, error);
      }
      },
    );

    fastify.post<{ Body: BocaStockInput; Params: { propertyId: string } }>(
      '/bocas/:propertyId/stock',
      {
        schema: {
          body: bocaStockBodySchema,
          params: propertyIdParamsSchema,
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
      {
        schema: {
          params: propertyIdParamsSchema,
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
          const result = await bocaService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendBocaError(reply, error);
        }
      },
    );
  };
}

function sendBocaError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de bocas.');
}
