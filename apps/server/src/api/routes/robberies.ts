import { type RobberyAttemptInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { RobberyError, type RobberyServiceContract } from '../../services/robbery.js';

interface RobberyRouteDependencies {
  robberyService: RobberyServiceContract;
}

export function createRobberyRoutes({
  robberyService,
}: RobberyRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/robberies', async (request, reply) => {
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
    });

    fastify.post<{ Body: RobberyAttemptInput; Params: { robberyType: string } }>(
      '/robberies/:robberyType/attempt',
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

function sendRobberyError(reply: FastifyReply, error: unknown) {
  if (error instanceof RobberyError) {
    const statusCode =
      error.code === 'not_found'
        ? 404
        : error.code === 'forbidden'
          ? 403
          : error.code === 'validation'
            ? 400
            : error.code === 'cooldown_active' ||
                error.code === 'character_not_ready' ||
                error.code === 'conflict' ||
                error.code === 'insufficient_resources'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada ao processar roubos.',
  });
}
