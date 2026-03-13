import { type PuteiroHireInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { PuteiroError, type PuteiroServiceContract } from '../../services/puteiro.js';

interface PuteiroRouteDependencies {
  puteiroService: PuteiroServiceContract;
}

export function createPuteiroRoutes({
  puteiroService,
}: PuteiroRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/puteiros', async (request, reply) => {
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
    });

    fastify.post<{ Body: PuteiroHireInput; Params: { propertyId: string } }>(
      '/puteiros/:propertyId/gps',
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

function sendPuteiroError(reply: FastifyReply, error: unknown) {
  if (error instanceof PuteiroError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'not_found'
            ? 404
            : error.code === 'capacity' ||
                error.code === 'conflict' ||
                error.code === 'character_not_ready'
              ? 409
              : error.code === 'insufficient_funds'
                ? 422
                : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de puteiros.',
  });
}
