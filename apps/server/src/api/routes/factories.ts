import {
  type DrugFactoryCreateInput,
  type DrugFactoryStockInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  drugFactoryCreateBodySchema,
  drugFactoryStockBodySchema,
} from '../schemas.js';
import { type FactoryServiceContract } from '../../services/factory.js';

interface FactoryRouteDependencies {
  factoryService: FactoryServiceContract;
}

export function createFactoryRoutes({
  factoryService,
}: FactoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const factoryIdParamsSchema = buildIdParamsSchema('factoryId');

    fastify.get(
      '/factories',
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
        const result = await factoryService.listFactories(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendFactoryError(reply, error);
      }
      },
    );

    fastify.post<{ Body: DrugFactoryCreateInput }>(
      '/factories',
      {
        schema: {
          body: drugFactoryCreateBodySchema,
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
        const result = await factoryService.createFactory(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendFactoryError(reply, error);
      }
      },
    );

    fastify.post<{ Body: DrugFactoryStockInput; Params: { factoryId: string } }>(
      '/factories/:factoryId/components',
      {
        schema: {
          body: drugFactoryStockBodySchema,
          params: factoryIdParamsSchema,
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
      {
        schema: {
          params: factoryIdParamsSchema,
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
          const result = await factoryService.collectOutput(request.playerId, request.params.factoryId);
          return reply.send(result);
        } catch (error) {
          return sendFactoryError(reply, error);
        }
      },
    );
  };
}

function sendFactoryError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de fabricas.');
}
