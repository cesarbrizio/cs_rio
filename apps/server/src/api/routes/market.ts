import {
  type MarketAuctionBidInput,
  type MarketAuctionCreateInput,
  type InventoryItemType,
  type MarketOrderCreateInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  marketAuctionBidBodySchema,
  marketAuctionCreateBodySchema,
  marketAuctionQuerySchema,
  marketOrderCreateBodySchema,
  marketOrderQuerySchema,
} from '../schemas.js';
import { type MarketServiceContract } from '../../services/market.js';

interface MarketRouteDependencies {
  actionIdempotency: ActionIdempotency;
  marketService: MarketServiceContract;
}

export function createMarketRoutes({
  actionIdempotency,
  marketService,
}: MarketRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Querystring: { itemId?: string; itemType?: InventoryItemType } }>(
      '/market/orders',
      {
        schema: {
          querystring: marketOrderQuerySchema,
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
          const response = await marketService.getOrderBook(request.playerId, request.query);
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );

    fastify.post<{ Body: MarketOrderCreateInput }>(
      '/market/orders',
      {
        schema: {
          body: marketOrderCreateBodySchema,
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
        const response = await actionIdempotency.run(
          request,
          {
            action: 'market.order.create',
            keyParts: [request.body],
          },
          () => marketService.createOrder(request.playerId!, request.body),
        );
        return reply.code(201).send(response);
      } catch (error) {
        return sendMarketError(reply, error);
      }
      },
    );

    fastify.post<{ Params: { orderId: string } }>(
      '/market/orders/:orderId/cancel',
      {
        schema: {
          params: buildIdParamsSchema('orderId'),
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
          const response = await actionIdempotency.run(
            request,
            {
              action: 'market.order.cancel',
              keyParts: [request.params.orderId],
            },
            () => marketService.cancelOrder(request.playerId!, request.params.orderId),
          );
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );

    fastify.get<{ Querystring: { itemId?: string; itemType?: 'vest' | 'weapon' } }>(
      '/market/auctions',
      {
        schema: {
          querystring: marketAuctionQuerySchema,
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
          const response = await marketService.getAuctionBook(request.playerId, request.query);
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );

    fastify.post<{ Body: MarketAuctionCreateInput }>(
      '/market/auctions',
      {
        schema: {
          body: marketAuctionCreateBodySchema,
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
        const response = await actionIdempotency.run(
          request,
          {
            action: 'market.auction.create',
            keyParts: [request.body],
          },
          () => marketService.createAuction(request.playerId!, request.body),
        );
        return reply.code(201).send(response);
      } catch (error) {
        return sendMarketError(reply, error);
      }
      },
    );

    fastify.post<{ Body: MarketAuctionBidInput; Params: { auctionId: string } }>(
      '/market/auctions/:auctionId/bid',
      {
        schema: {
          body: marketAuctionBidBodySchema,
          params: buildIdParamsSchema('auctionId'),
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
          const response = await actionIdempotency.run(
            request,
            {
              action: 'market.auction.bid',
              keyParts: [request.params.auctionId, request.body],
            },
            () =>
              marketService.bidAuction(
                request.playerId!,
                request.params.auctionId,
                request.body,
              ),
          );
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );
  };
}

function sendMarketError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no mercado negro.');
}
