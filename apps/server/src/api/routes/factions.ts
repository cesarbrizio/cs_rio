import {
  type FactionBankDepositInput,
  type FactionBankWithdrawInput,
  type FactionCreateInput,
  type FactionLeadershipVoteInput,
  type FactionRobberyPolicyUpdateInput,
  type FactionUpgradeType,
  type FactionRecruitInput,
  type FactionUpdateInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  factionBankMovementBodySchema,
  factionCreateBodySchema,
  factionLeadershipVoteBodySchema,
  factionRecruitBodySchema,
  factionRobberyPolicyUpdateBodySchema,
  factionUpdateBodySchema,
  factionUpgradeTypeSchema,
  idSchema,
} from '../schemas.js';
import { type FactionServiceContract } from '../../services/faction.js';

interface FactionRouteDependencies {
  factionService: FactionServiceContract;
}

export function createFactionRoutes({
  factionService,
}: FactionRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const factionIdParamsSchema = buildIdParamsSchema('factionId');
    const factionMemberParamsSchema = buildIdParamsSchema('factionId', 'memberPlayerId');
    const factionUpgradeParamsSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['factionId', 'upgradeType'],
      properties: {
        factionId: idSchema,
        upgradeType: factionUpgradeTypeSchema,
      },
    };

    fastify.get(
      '/factions',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factionService.listFactions(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/members',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factionService.getFactionMembers(request.playerId, request.params.factionId);
        return reply.send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/bank',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factionService.getFactionBank(request.playerId, request.params.factionId);
        return reply.send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/upgrades',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factionService.getFactionUpgrades(request.playerId, request.params.factionId);
        return reply.send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/robbery-policy',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.getFactionRobberyPolicy(request.playerId, request.params.factionId);
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/leadership',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.getFactionLeadership(
            request.playerId,
            request.params.factionId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionCreateInput }>(
      '/factions',
      {
        schema: {
          body: factionCreateBodySchema,
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
        const result = await factionService.createFaction(request.playerId, request.body);
        return reply.code(201).send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.post<{ Body: FactionRecruitInput; Params: { factionId: string } }>(
      '/factions/:factionId/members',
      {
        schema: {
          body: factionRecruitBodySchema,
          params: factionIdParamsSchema,
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
          const result = await factionService.recruitMember(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.code(201).send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string } }>(
      '/factions/:factionId/join',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.joinFixedFaction(request.playerId, request.params.factionId);
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionBankDepositInput; Params: { factionId: string } }>(
      '/factions/:factionId/bank/deposit',
      {
        schema: {
          body: factionBankMovementBodySchema,
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.depositToFactionBank(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionBankWithdrawInput; Params: { factionId: string } }>(
      '/factions/:factionId/bank/withdraw',
      {
        schema: {
          body: factionBankMovementBodySchema,
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.withdrawFromFactionBank(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string } }>(
      '/factions/:factionId/leadership/election/support',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.supportFactionLeadershipElection(
            request.playerId,
            request.params.factionId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionLeadershipVoteInput; Params: { factionId: string } }>(
      '/factions/:factionId/leadership/election/vote',
      {
        schema: {
          body: factionLeadershipVoteBodySchema,
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.voteFactionLeadership(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string } }>(
      '/factions/:factionId/leadership/challenge',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.challengeFactionLeadership(
            request.playerId,
            request.params.factionId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string; upgradeType: FactionUpgradeType } }>(
      '/factions/:factionId/upgrades/:upgradeType/unlock',
      {
        schema: {
          params: factionUpgradeParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.unlockFactionUpgrade(
            request.playerId,
            request.params.factionId,
            request.params.upgradeType,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string; memberPlayerId: string } }>(
      '/factions/:factionId/members/:memberPlayerId/promote',
      {
        schema: {
          params: factionMemberParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.promoteMember(
            request.playerId,
            request.params.factionId,
            request.params.memberPlayerId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string; memberPlayerId: string } }>(
      '/factions/:factionId/members/:memberPlayerId/demote',
      {
        schema: {
          params: factionMemberParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.demoteMember(
            request.playerId,
            request.params.factionId,
            request.params.memberPlayerId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.patch<{ Body: FactionUpdateInput; Params: { factionId: string } }>(
      '/factions/:factionId',
      {
        schema: {
          body: factionUpdateBodySchema,
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.updateFaction(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.patch<{ Body: FactionRobberyPolicyUpdateInput; Params: { factionId: string } }>(
      '/factions/:factionId/robbery-policy',
      {
        schema: {
          body: factionRobberyPolicyUpdateBodySchema,
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.updateFactionRobberyPolicy(
            request.playerId,
            request.params.factionId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { factionId: string } }>(
      '/factions/:factionId/leave',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await factionService.leaveFaction(request.playerId, request.params.factionId);
        return reply.send(result);
      } catch (error) {
        return sendFactionError(reply, error);
      }
      },
    );

    fastify.delete<{ Params: { factionId: string; memberPlayerId: string } }>(
      '/factions/:factionId/members/:memberPlayerId',
      {
        schema: {
          params: factionMemberParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.expelMember(
            request.playerId,
            request.params.factionId,
            request.params.memberPlayerId,
          );
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );

    fastify.delete<{ Params: { factionId: string } }>(
      '/factions/:factionId',
      {
        schema: {
          params: factionIdParamsSchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await factionService.dissolveFaction(request.playerId, request.params.factionId);
          return reply.send(result);
        } catch (error) {
          return sendFactionError(reply, error);
        }
      },
    );
  };
}

function sendFactionError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de faccoes.');
}
