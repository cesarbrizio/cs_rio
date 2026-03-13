import { type FactionCrimeAttemptInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { CrimeError, type CrimeServiceContract } from '../../services/crime.js';

interface CrimeRouteDependencies {
  crimeService: CrimeServiceContract;
}

export function createCrimeRoutes({
  crimeService,
}: CrimeRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/crimes', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const catalog = await crimeService.getCatalog(request.playerId);
        return reply.send(catalog);
      } catch (error) {
        return sendCrimeError(reply, error);
      }
    });

    fastify.post<{ Params: { crimeId: string } }>('/crimes/:crimeId/attempt', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await crimeService.attemptCrime(request.playerId, request.params.crimeId);
        return reply.send(result);
      } catch (error) {
        return sendCrimeError(reply, error);
      }
    });

    fastify.get<{ Params: { factionId: string } }>('/crimes/faction/:factionId', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const catalog = await crimeService.getFactionCatalog(request.playerId, request.params.factionId);
        return reply.send(catalog);
      } catch (error) {
        return sendCrimeError(reply, error);
      }
    });

    fastify.post<{ Body: FactionCrimeAttemptInput; Params: { crimeId: string; factionId: string } }>(
      '/crimes/faction/:factionId/:crimeId/attempt',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await crimeService.attemptFactionCrime(
            request.playerId,
            request.params.factionId,
            request.params.crimeId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendCrimeError(reply, error);
        }
      },
    );
  };
}

function sendCrimeError(reply: FastifyReply, error: unknown) {
  if (error instanceof CrimeError) {
    const statusCode =
      error.code === 'not_found'
        ? 404
        : error.code === 'forbidden'
          ? 403
          : error.code === 'validation'
            ? 400
            : error.code === 'character_not_ready' || error.code === 'conflict'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada ao processar crimes.',
  });
}
