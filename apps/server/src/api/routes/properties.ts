import {
  type PropertyHireSoldiersInput,
  type PropertyPurchaseInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  propertyHireSoldiersBodySchema,
  propertyPurchaseBodySchema,
} from '../schemas.js';
import { type PropertyServiceContract } from '../../services/property.js';

interface PropertyRouteDependencies {
  propertyService: PropertyServiceContract;
}

export function createPropertyRoutes({
  propertyService,
}: PropertyRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/properties',
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
        const result = await propertyService.listProperties(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPropertyError(reply, error);
      }
      },
    );

    fastify.post<{ Body: PropertyPurchaseInput }>(
      '/properties',
      {
        schema: {
          body: propertyPurchaseBodySchema,
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
        const result = await propertyService.purchaseProperty(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendPropertyError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/properties/:propertyId/upgrade',
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
          const result = await propertyService.upgradeProperty(
            request.playerId,
            request.params.propertyId,
          );
          return reply.send(result);
        } catch (error) {
          return sendPropertyError(reply, error);
        }
      },
    );

    fastify.post<{ Body: PropertyHireSoldiersInput; Params: { propertyId: string } }>(
      '/properties/:propertyId/soldiers',
      {
        schema: {
          body: propertyHireSoldiersBodySchema,
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
          const result = await propertyService.hireSoldiers(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendPropertyError(reply, error);
        }
      },
    );
  };
}

function sendPropertyError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de propriedades.');
}
