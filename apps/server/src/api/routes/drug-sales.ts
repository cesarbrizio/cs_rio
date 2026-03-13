import { type DrugSaleInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { DrugSaleError, type DrugSaleServiceContract } from '../../services/drug-sale.js';

interface DrugSaleRouteDependencies {
  drugSaleService: DrugSaleServiceContract;
}

export function createDrugSaleRoutes({
  drugSaleService,
}: DrugSaleRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.post<{ Body: DrugSaleInput }>('/drug-sales/quote', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await drugSaleService.quoteSale(request.playerId, request.body);
        return reply.send(response);
      } catch (error) {
        return sendDrugSaleError(reply, error);
      }
    });

    fastify.post<{ Body: DrugSaleInput }>('/drug-sales/sell', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await drugSaleService.sell(request.playerId, request.body);
        return reply.send(response);
      } catch (error) {
        return sendDrugSaleError(reply, error);
      }
    });
  };
}

function sendDrugSaleError(reply: FastifyReply, error: unknown) {
  if (error instanceof DrugSaleError) {
    const statusCode =
      error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  throw error;
}
