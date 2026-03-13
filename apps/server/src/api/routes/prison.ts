import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { PrisonError, type PrisonServiceContract } from '../../services/prison.js';

interface PrisonRouteDependencies {
  prisonService: PrisonServiceContract;
}

export function createPrisonRoutes({ prisonService }: PrisonRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/prison', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await prisonService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
    });

    fastify.post('/prison/bribe', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await prisonService.attemptBribe(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
    });

    fastify.post('/prison/bail', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await prisonService.bailOut(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
    });

    fastify.post('/prison/escape', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await prisonService.attemptEscape(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
    });

    fastify.post<{ Params: { targetPlayerId: string } }>(
      '/prison/faction-rescue/:targetPlayerId',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({ message: 'Token ausente.' });
        }

        try {
          const result = await prisonService.rescueFactionMember(request.playerId, request.params.targetPlayerId);
          return reply.send(result);
        } catch (error) {
          return sendPrisonError(reply, error);
        }
      },
    );
  };
}

function sendPrisonError(reply: FastifyReply, error: unknown) {
  if (error instanceof PrisonError) {
    const statusCode =
      error.code === 'unauthorized'
        ? 401
        : error.code === 'not_found'
          ? 404
          : error.code === 'forbidden'
            ? 403
            : error.code === 'validation'
              ? 400
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada ao processar a prisao.',
  });
}
