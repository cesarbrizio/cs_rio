import {
  type MarketAuctionBidInput,
  type MarketAuctionCreateInput,
  type InventoryItemType,
  type MarketOrderCreateInput,
} from '@cs-rio/shared/dist/types.js';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { MarketError, type MarketServiceContract } from '../../services/market.js';

interface MarketRouteDependencies {
  marketService: MarketServiceContract;
}

export function createMarketRoutes({
  marketService,
}: MarketRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Querystring: { itemId?: string; itemType?: InventoryItemType } }>(
      '/market/orders',
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

    fastify.post<{ Body: MarketOrderCreateInput }>('/market/orders', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await marketService.createOrder(request.playerId, request.body);
        return reply.code(201).send(response);
      } catch (error) {
        return sendMarketError(reply, error);
      }
    });

    fastify.post<{ Params: { orderId: string } }>(
      '/market/orders/:orderId/cancel',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const response = await marketService.cancelOrder(request.playerId, request.params.orderId);
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );

    fastify.get<{ Querystring: { itemId?: string; itemType?: 'vest' | 'weapon' } }>(
      '/market/auctions',
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

    fastify.post<{ Body: MarketAuctionCreateInput }>('/market/auctions', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const response = await marketService.createAuction(request.playerId, request.body);
        return reply.code(201).send(response);
      } catch (error) {
        return sendMarketError(reply, error);
      }
    });

    fastify.post<{ Body: MarketAuctionBidInput; Params: { auctionId: string } }>(
      '/market/auctions/:auctionId/bid',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const response = await marketService.bidAuction(
            request.playerId,
            request.params.auctionId,
            request.body,
          );
          return reply.send(response);
        } catch (error) {
          return sendMarketError(reply, error);
        }
      },
    );
  };
}

function sendMarketError(reply: FastifyReply, error: unknown) {
  if (error instanceof MarketError) {
    const statusCode =
      error.code === 'not_found'
        ? 404
        : error.code === 'ownership_required'
          ? 403
          : error.code === 'auction_own_bid'
            ? 403
            : error.code === 'insufficient_funds' ||
                error.code === 'character_not_ready' ||
                error.code === 'auction_closed'
            ? 409
            : error.code === 'bid_too_low'
              ? 409
          : 400;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no mercado negro.',
  });
}
