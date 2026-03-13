import { type TrainingStartInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError } from '../../services/auth.js';
import { TrainingError, type TrainingServiceContract } from '../../services/training.js';

interface TrainingRouteDependencies {
  trainingService: TrainingServiceContract;
}

export function createTrainingRoutes({
  trainingService,
}: TrainingRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/training-center', async (request, reply) => {
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
    });

    fastify.post<{ Body: TrainingStartInput }>('/training-center/sessions', async (request, reply) => {
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
    });

    fastify.post<{ Params: { sessionId: string } }>(
      '/training-center/sessions/:sessionId/claim',
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

function sendTrainingError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    return reply.code(401).send({
      message: error.message,
    });
  }

  if (error instanceof TrainingError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'not_found'
          ? 404
          : error.code === 'character_not_ready'
            ? 409
            : error.code === 'insufficient_resources' ||
                error.code === 'training_in_progress' ||
                error.code === 'training_locked' ||
                error.code === 'training_ready_to_claim' ||
                error.code === 'too_early_claim' ||
                error.code === 'action_locked'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no centro de treino.',
  });
}
