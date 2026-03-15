import { type UniversityEnrollInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import { buildStandardResponseSchema, universityEnrollBodySchema } from '../schemas.js';
import { type UniversityServiceContract } from '../../services/university.js';

interface UniversityRouteDependencies {
  universityService: UniversityServiceContract;
}

export function createUniversityRoutes({
  universityService,
}: UniversityRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/university',
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
        const result = await universityService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendUniversityError(reply, error);
      }
      },
    );

    fastify.post<{ Body: UniversityEnrollInput }>(
      '/university/enrollments',
      {
        schema: {
          body: universityEnrollBodySchema,
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
        const result = await universityService.enroll(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendUniversityError(reply, error);
      }
      },
    );
  };
}

function sendUniversityError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na universidade do crime.');
}
