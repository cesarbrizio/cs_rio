import { type TrainingStartInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  trainingStartBodySchema,
} from '../schemas.js';
import { type TrainingServiceContract } from '../../services/training.js';

interface TrainingRouteDependencies {
  trainingService: TrainingServiceContract;
}

export function createTrainingRoutes({
  trainingService,
}: TrainingRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const sessionIdParamsSchema = buildIdParamsSchema('sessionId');

    fastify.get(
      '/training-center',
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
        const result = await trainingService.getTrainingCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendTrainingError(reply, error);
      }
      },
    );

    fastify.post<{ Body: TrainingStartInput }>(
      '/training-center/sessions',
      {
        schema: {
          body: trainingStartBodySchema,
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
        const result = await trainingService.startTraining(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendTrainingError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { sessionId: string } }>(
      '/training-center/sessions/:sessionId/claim',
      {
        schema: {
          params: sessionIdParamsSchema,
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
          const result = await trainingService.claimTraining(request.playerId, request.params.sessionId);
          return reply.send(result);
        } catch (error) {
          return sendTrainingError(reply, error);
        }
      },
    );
  };
}

function sendTrainingError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no centro de treino.');
}
