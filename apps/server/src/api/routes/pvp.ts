import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { PvpError, type PvpServiceContract } from '../../services/pvp.js';

interface PvpRouteDependencies {
  pvpService: PvpServiceContract;
}

export function createPvpRoutes({ pvpService }: PvpRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/pvp/contracts', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await pvpService.listAssassinationContracts(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPvpError(reply, error);
      }
    });

    fastify.post<{
      Body: {
        reward: number;
        targetPlayerId: string;
      };
    }>('/pvp/contracts', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await pvpService.createAssassinationContract(
          request.playerId,
          request.body.targetPlayerId,
          request.body.reward,
        );
        return reply.send(result);
      } catch (error) {
        return sendPvpError(reply, error);
      }
    });

    fastify.post<{ Params: { contractId: string } }>(
      '/pvp/contracts/:contractId/accept',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await pvpService.acceptAssassinationContract(
            request.playerId,
            request.params.contractId,
          );
          return reply.send(result);
        } catch (error) {
          return sendPvpError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { contractId: string } }>(
      '/pvp/contracts/:contractId/execute',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await pvpService.executeAssassinationContract(
            request.playerId,
            request.params.contractId,
          );
          return reply.send(result);
        } catch (error) {
          return sendPvpError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { targetPlayerId: string } }>(
      '/pvp/assault/:targetPlayerId',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await pvpService.attemptAssault(request.playerId, request.params.targetPlayerId);
          return reply.send(result);
        } catch (error) {
          return sendPvpError(reply, error);
        }
      },
    );

    fastify.post<{
      Body: {
        participantIds?: string[];
      };
      Params: { targetPlayerId: string };
    }>(
      '/pvp/ambush/:targetPlayerId',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await pvpService.attemptAmbush(
            request.playerId,
            request.params.targetPlayerId,
            request.body?.participantIds ?? [],
          );
          return reply.send(result);
        } catch (error) {
          return sendPvpError(reply, error);
        }
      },
    );
  };
}

function sendPvpError(reply: FastifyReply, error: unknown) {
  if (error instanceof PvpError) {
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
    message: 'Falha inesperada ao processar combate PvP.',
  });
}
