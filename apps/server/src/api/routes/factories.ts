import {
  type DrugFactoryCreateInput,
  type DrugFactoryStockInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { FactoryError, type FactoryServiceContract } from '../../services/factory.js';

interface FactoryRouteDependencies {
  factoryService: FactoryServiceContract;
}

export function createFactoryRoutes({
  factoryService,
}: FactoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/factories', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factoryService.listFactories(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendFactoryError(reply, error);
      }
    });

    fastify.post<{ Body: DrugFactoryCreateInput }>('/factories', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factoryService.createFactory(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendFactoryError(reply, error);
      }
    });

    fastify.post<{ Body: DrugFactoryStockInput; Params: { factoryId: string } }>(
      '/factories/:factoryId/components',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factoryService.stockComponent(
            request.playerId,
            request.params.factoryId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factoryId: string } }>(
      '/factories/:factoryId/collect',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factoryService.collectOutput(request.playerId, request.params.factoryId);
          return reply.send(result);
        } catch (error) {
          return sendFactoryError(reply, error);
        }
      },
    );
  };
}

function sendFactoryError(reply: FastifyReply, error: unknown) {
  if (error instanceof FactoryError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'invalid_component' || error.code === 'invalid_recipe'
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
    message: 'Falha inesperada na gestao de fabricas.',
  });
}
