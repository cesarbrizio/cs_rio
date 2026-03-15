import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  pvpAmbushBodySchema,
  pvpContractCreateBodySchema,
} from '../schemas.js';
import { type PvpServiceContract } from '../../services/pvp.js';

interface PvpRouteDependencies {
  pvpService: PvpServiceContract;
}

export function createPvpRoutes({ pvpService }: PvpRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const contractIdParamsSchema = buildIdParamsSchema('contractId');
    const targetPlayerIdParamsSchema = buildIdParamsSchema('targetPlayerId');

    fastify.get(
      '/pvp/contracts',
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
        const result = await pvpService.listAssassinationContracts(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendPvpError(reply, error);
      }
      },
    );

    fastify.post<{
      Body: {
        reward: number;
        targetPlayerId: string;
      };
    }>(
      '/pvp/contracts',
      {
        schema: {
          body: pvpContractCreateBodySchema,
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
        const result = await pvpService.createAssassinationContract(
          request.playerId,
          request.body.targetPlayerId,
          request.body.reward,
        );
        return reply.send(result);
      } catch (error) {
        return sendPvpError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { contractId: string } }>(
      '/pvp/contracts/:contractId/accept',
      {
        schema: {
          params: contractIdParamsSchema,
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
      {
        schema: {
          params: contractIdParamsSchema,
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
      {
        schema: {
          params: targetPlayerIdParamsSchema,
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
      {
        schema: {
          body: pvpAmbushBodySchema,
          params: targetPlayerIdParamsSchema,
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

function sendPvpError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar combate PvP.');
}
