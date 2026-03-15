import { type FrontStoreInvestInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  frontStoreInvestBodySchema,
} from '../schemas.js';
import { type FrontStoreServiceContract } from '../../services/front-store.js';

interface FrontStoreRouteDependencies {
  frontStoreService: FrontStoreServiceContract;
}

export function createFrontStoreRoutes({
  frontStoreService,
}: FrontStoreRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/front-stores',
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
        const result = await frontStoreService.listFrontStores(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendFrontStoreError(reply, error);
      }
      },
    );

    fastify.post<{ Body: FrontStoreInvestInput; Params: { propertyId: string } }>(
      '/front-stores/:propertyId/invest',
      {
        schema: {
          body: frontStoreInvestBodySchema,
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
          const result = await frontStoreService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendFrontStoreError(reply, error);
        }
      },
    );
  };
}

function sendFrontStoreError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de lojas de fachada.');
}
