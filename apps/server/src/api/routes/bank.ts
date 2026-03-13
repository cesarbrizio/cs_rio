import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { BankError, type BankServiceContract } from '../../services/bank.js';

interface BankRouteDependencies {
  bankService: BankServiceContract;
}

export function createBankRoutes({ bankService }: BankRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/bank', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await bankService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendBankError(reply, error);
      }
    });

    fastify.post<{ Body: { amount: number } }>('/bank/deposit', async (request, reply) => {
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
    });

    fastify.post<{ Body: { amount: number } }>('/bank/withdraw', async (request, reply) => {
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
    });
  };
}

function sendBankError(reply: FastifyReply, error: unknown) {
  if (error instanceof BankError) {
    const statusCode =
      error.code === 'unauthorized'
        ? 401
        : error.code === 'not_found'
          ? 404
          : error.code === 'validation'
            ? 400
            : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada ao processar o banco.',
  });
}
