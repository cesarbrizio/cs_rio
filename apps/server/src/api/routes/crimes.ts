import { type FactionCrimeAttemptInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  factionCrimeAttemptBodySchema,
} from '../schemas.js';
import { type CrimeServiceContract } from '../../services/crime.js';

interface CrimeRouteDependencies {
  actionIdempotency: ActionIdempotency;
  crimeService: CrimeServiceContract;
}

export function createCrimeRoutes({
  actionIdempotency,
  crimeService,
}: CrimeRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const crimeIdParamsSchema = buildIdParamsSchema('crimeId');
    const factionCrimeParamsSchema = buildIdParamsSchema('factionId', 'crimeId');
    const factionIdParamsSchema = buildIdParamsSchema('factionId');

    fastify.get(
      '/crimes',
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
        const catalog = await crimeService.getCatalog(request.playerId);
        return reply.send(catalog);
      } catch (error) {
        return sendCrimeError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { crimeId: string } }>(
      '/crimes/:crimeId/attempt',
      {
        schema: {
          params: crimeIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'crime.attempt',
              keyParts: [request.params.crimeId],
            },
            () => crimeService.attemptCrime(request.playerId!, request.params.crimeId),
          );
          return reply.send(result);
        } catch (error) {
          return sendCrimeError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/crimes/faction/:factionId',
      {
        schema: {
          params: factionIdParamsSchema,
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
          const catalog = await crimeService.getFactionCatalog(request.playerId, request.params.factionId);
          return reply.send(catalog);
        } catch (error) {
          return sendCrimeError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionCrimeAttemptInput; Params: { crimeId: string; factionId: string } }>(
      '/crimes/faction/:factionId/:crimeId/attempt',
      {
        schema: {
          body: factionCrimeAttemptBodySchema,
          params: factionCrimeParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'crime.faction-attempt',
              keyParts: [request.params.factionId, request.params.crimeId, request.body],
            },
            () =>
              crimeService.attemptFactionCrime(
                request.playerId!,
                request.params.factionId,
                request.params.crimeId,
                request.body,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendCrimeError(reply, error);
        }
      },
    );
  };
}

function sendCrimeError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar crimes.');
}
