import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import { buildStandardResponseSchema, playerBankMovementBodySchema } from '../schemas.js';
import { type BankServiceContract } from '../../services/bank.js';

interface BankRouteDependencies {
  bankService: BankServiceContract;
}

export function createBankRoutes({ bankService }: BankRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/bank',
      {
        schema: {
          response: buildStandardResponseSchema(),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await bankService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendBankError(reply, error);
      }
      },
    );

    fastify.post<{ Body: { amount: number } }>(
      '/bank/deposit',
      {
        schema: {
          body: playerBankMovementBodySchema,
          response: buildStandardResponseSchema(),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await bankService.deposit(request.playerId, {
          amount: request.body.amount,
        });
        return reply.send(result);
      } catch (error) {
        return sendBankError(reply, error);
      }
      },
    );

    fastify.post<{ Body: { amount: number } }>(
      '/bank/withdraw',
      {
        schema: {
          body: playerBankMovementBodySchema,
          response: buildStandardResponseSchema(),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await bankService.withdraw(request.playerId, {
          amount: request.body.amount,
        });
        return reply.send(result);
      } catch (error) {
        return sendBankError(reply, error);
      }
      },
    );
  };
}

function sendBankError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar o banco.');
}
