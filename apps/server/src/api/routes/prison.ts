import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { throwRouteHttpError } from '../http-errors.js';
import { buildIdParamsSchema, buildStandardResponseSchema } from '../schemas.js';
import { type PrisonServiceContract } from '../../services/prison.js';

interface PrisonRouteDependencies {
  actionIdempotency: ActionIdempotency;
  prisonService: PrisonServiceContract;
}

export function createPrisonRoutes({
  actionIdempotency,
  prisonService,
}: PrisonRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/prison',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await prisonService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
      },
    );

    fastify.post(
      '/prison/bribe',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'prison.bribe',
          },
          () => prisonService.attemptBribe(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
      },
    );

    fastify.post(
      '/prison/bail',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'prison.bail',
          },
          () => prisonService.bailOut(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
      },
    );

    fastify.post(
      '/prison/escape',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'prison.escape',
          },
          () => prisonService.attemptEscape(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendPrisonError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { targetPlayerId: string } }>(
      '/prison/faction-rescue/:targetPlayerId',
      {
        schema: {
          params: buildIdParamsSchema('targetPlayerId'),
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({ message: 'Token ausente.' });
        }

        try {
          const result = await actionIdempotency.run(
            request,
            {
              action: 'prison.faction-rescue',
              keyParts: [request.params.targetPlayerId],
            },
            () => prisonService.rescueFactionMember(request.playerId!, request.params.targetPlayerId),
          );
          return reply.send(result);
        } catch (error) {
          return sendPrisonError(reply, error);
        }
      },
    );
  };
}

function sendPrisonError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar a prisao.');
}
