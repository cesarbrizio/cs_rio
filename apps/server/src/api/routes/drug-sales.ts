import { type DrugSaleInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import { buildStandardResponseSchema, drugSaleBodySchema } from '../schemas.js';
import { type DrugSaleServiceContract } from '../../services/drug-sale.js';

interface DrugSaleRouteDependencies {
  drugSaleService: DrugSaleServiceContract;
}

export function createDrugSaleRoutes({
  drugSaleService,
}: DrugSaleRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.post<{ Body: DrugSaleInput }>(
      '/drug-sales/quote',
      {
        schema: {
          body: drugSaleBodySchema,
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
        const response = await drugSaleService.quoteSale(request.playerId, request.body);
        return reply.send(response);
      } catch (error) {
        return sendDrugSaleError(reply, error);
      }
      },
    );

    fastify.post<{ Body: DrugSaleInput }>(
      '/drug-sales/sell',
      {
        schema: {
          body: drugSaleBodySchema,
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
        const response = await drugSaleService.sell(request.playerId, request.body);
        return reply.send(response);
      } catch (error) {
        return sendDrugSaleError(reply, error);
      }
      },
    );
  };
}

function sendDrugSaleError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar venda de drogas.');
}
