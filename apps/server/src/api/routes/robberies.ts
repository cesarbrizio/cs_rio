import { type RobberyAttemptInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  robberyAttemptBodySchema,
  robberyTypeSchema,
} from '../schemas.js';
import { type RobberyServiceContract } from '../../services/robbery.js';

interface RobberyRouteDependencies {
  robberyService: RobberyServiceContract;
}

export function createRobberyRoutes({
  robberyService,
}: RobberyRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const robberyTypeParamsSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['robberyType'],
      properties: {
        robberyType: robberyTypeSchema,
      },
    };

    fastify.get(
      '/robberies',
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
        const result = await robberyService.getCatalog(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendRobberyError(reply, error);
      }
      },
    );

    fastify.post<{ Body: RobberyAttemptInput; Params: { robberyType: string } }>(
      '/robberies/:robberyType/attempt',
      {
        schema: {
          body: robberyAttemptBodySchema,
          params: robberyTypeParamsSchema,
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
          const result = await robberyService.attemptRobbery(
            request.playerId,
            request.params.robberyType as never,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendRobberyError(reply, error);
        }
      },
    );
  };
}

function sendRobberyError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar roubos.');
}
