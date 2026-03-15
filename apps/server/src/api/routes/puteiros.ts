import { type PuteiroHireInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  puteiroHireBodySchema,
} from '../schemas.js';
import { type PuteiroServiceContract } from '../../services/puteiro.js';

interface PuteiroRouteDependencies {
  puteiroService: PuteiroServiceContract;
}

export function createPuteiroRoutes({
  puteiroService,
}: PuteiroRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/puteiros',
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
        const result = await puteiroService.listPuteiros(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPuteiroError(reply, error);
      }
      },
    );

    fastify.post<{ Body: PuteiroHireInput; Params: { propertyId: string } }>(
      '/puteiros/:propertyId/gps',
      {
        schema: {
          body: puteiroHireBodySchema,
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
          const result = await puteiroService.hireGps(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendPuteiroError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/puteiros/:propertyId/collect',
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
          const result = await puteiroService.collectCash(request.playerId, request.params.propertyId);
          return reply.send(result);
        } catch (error) {
          return sendPuteiroError(reply, error);
        }
      },
    );
  };
}

function sendPuteiroError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de puteiros.');
}
