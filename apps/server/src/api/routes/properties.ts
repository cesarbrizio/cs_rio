import {
  type PropertyHireSoldiersInput,
  type PropertyPurchaseInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { PropertyError, type PropertyServiceContract } from '../../services/property.js';

interface PropertyRouteDependencies {
  propertyService: PropertyServiceContract;
}

export function createPropertyRoutes({
  propertyService,
}: PropertyRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/properties', async (request, reply) => {
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
    });

    fastify.post<{ Body: PropertyPurchaseInput }>('/properties', async (request, reply) => {
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
    });

    fastify.post<{ Params: { propertyId: string } }>(
      '/properties/:propertyId/upgrade',
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

function sendPropertyError(reply: FastifyReply, error: unknown) {
  if (error instanceof PropertyError) {
    const statusCode =
      error.code === 'validation' || error.code === 'invalid_property' || error.code === 'invalid_favela'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'not_found'
            ? 404
            : error.code === 'insufficient_funds' || error.code === 'capacity'
              ? 409
              : error.code === 'character_not_ready'
                ? 409
                : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de propriedades.',
  });
}
