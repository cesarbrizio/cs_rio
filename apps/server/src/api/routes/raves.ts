import {
  type RavePricingInput,
  type RaveStockInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  ravePricingBodySchema,
  raveStockBodySchema,
} from '../schemas.js';
import { type RaveServiceContract } from '../../services/rave.js';

interface RaveRouteDependencies {
  raveService: RaveServiceContract;
}

export function createRaveRoutes({
  raveService,
}: RaveRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/raves',
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
        const result = await raveService.listRaves(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendRaveError(reply, error);
      }
      },
    );

    fastify.post<{ Body: RaveStockInput; Params: { propertyId: string } }>(
      '/raves/:propertyId/stock',
      {
        schema: {
          body: raveStockBodySchema,
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
      {
        schema: {
          body: ravePricingBodySchema,
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
          const result = await raveService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendRaveError(reply, error);
        }
      },
    );
  };
}

function sendRaveError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de raves.');
}
