import { type UniversityEnrollInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError } from '../../services/auth.js';
import {
  UniversityError,
  type UniversityServiceContract,
} from '../../services/university.js';

interface UniversityRouteDependencies {
  universityService: UniversityServiceContract;
}

export function createUniversityRoutes({
  universityService,
}: UniversityRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/university', async (request, reply) => {
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
    });

    fastify.post<{ Body: UniversityEnrollInput }>('/university/enrollments', async (request, reply) => {
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
    });
  };
}

function sendUniversityError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    return reply.code(401).send({
      message: error.message,
    });
  }

  if (error instanceof UniversityError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'not_found'
          ? 404
          : error.code === 'character_not_ready'
            ? 409
            : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na universidade do crime.',
  });
}
