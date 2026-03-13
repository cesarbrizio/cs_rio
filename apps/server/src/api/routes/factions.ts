import {
  type FactionBankDepositInput,
  type FactionBankWithdrawInput,
  type FactionCreateInput,
  type FactionLeadershipVoteInput,
  type FactionUpgradeType,
  type FactionRecruitInput,
  type FactionUpdateInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { FactionError, type FactionServiceContract } from '../../services/faction.js';

interface FactionRouteDependencies {
  factionService: FactionServiceContract;
}

interface FactionRobberyPolicyUpdateInput {
  global?: 'allowed' | 'forbidden';
  regions?: Partial<Record<'zona_sul' | 'zona_norte' | 'centro' | 'zona_oeste' | 'zona_sudoeste' | 'baixada', 'allowed' | 'forbidden'>>;
}

export function createFactionRoutes({
  factionService,
}: FactionRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/factions', async (request, reply) => {
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
    });

    fastify.get<{ Params: { factionId: string } }>('/factions/:factionId/members', async (request, reply) => {
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
    });

    fastify.get<{ Params: { factionId: string } }>('/factions/:factionId/bank', async (request, reply) => {
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
    });

    fastify.get<{ Params: { factionId: string } }>('/factions/:factionId/upgrades', async (request, reply) => {
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
    });

    fastify.get<{ Params: { factionId: string } }>(
      '/factions/:factionId/robbery-policy',
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

    fastify.post<{ Body: FactionCreateInput }>('/factions', async (request, reply) => {
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
    });

    fastify.post<{ Body: FactionRecruitInput; Params: { factionId: string } }>(
      '/factions/:factionId/members',
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

    fastify.post<{ Params: { factionId: string } }>('/factions/:factionId/leave', async (request, reply) => {
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
    });

    fastify.delete<{ Params: { factionId: string; memberPlayerId: string } }>(
      '/factions/:factionId/members/:memberPlayerId',
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

function sendFactionError(reply: FastifyReply, error: unknown) {
  if (error instanceof FactionError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'forbidden'
            ? 403
            : error.code === 'not_found'
              ? 404
              : error.code === 'character_not_ready' ||
                  error.code === 'conflict' ||
                  error.code === 'insufficient_funds'
                ? 409
                : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de faccoes.',
  });
}
