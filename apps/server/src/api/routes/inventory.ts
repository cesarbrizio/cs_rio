import {
  type InventoryGrantInput,
  type InventoryQuantityUpdateInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError } from '../../services/auth.js';
import { PlayerError, type PlayerService } from '../../services/player.js';

interface InventoryRouteDependencies {
  playerService: PlayerService;
}

export function createInventoryRoutes({
  playerService,
}: InventoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/inventory', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const inventory = await playerService.getInventory(request.playerId);
        return reply.send(inventory);
      } catch (error) {
        return sendInventoryError(reply, error);
      }
    });

    fastify.post<{ Body: InventoryGrantInput }>('/inventory/items', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const inventory = await playerService.grantInventoryItem(request.playerId, request.body);
        return reply.code(201).send(inventory);
      } catch (error) {
        return sendInventoryError(reply, error);
      }
    });

    fastify.patch<{ Body: InventoryQuantityUpdateInput; Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const inventory = await playerService.updateInventoryItemQuantity(
            request.playerId,
            request.params.inventoryItemId,
            request.body.quantity,
          );
          return reply.send(inventory);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );

    fastify.delete<{ Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const inventory = await playerService.deleteInventoryItem(
            request.playerId,
            request.params.inventoryItemId,
          );
          return reply.send(inventory);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId/equip',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const inventory = await playerService.equipInventoryItem(
            request.playerId,
            request.params.inventoryItemId,
          );
          return reply.send(inventory);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId/unequip',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const inventory = await playerService.unequipInventoryItem(
            request.playerId,
            request.params.inventoryItemId,
          );
          return reply.send(inventory);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId/repair',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const inventory = await playerService.repairInventoryItem(
            request.playerId,
            request.params.inventoryItemId,
          );
          return reply.send(inventory);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId/consume',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await playerService.consumeDrugInventoryItem(
            request.playerId,
            request.params.inventoryItemId,
          );
          return reply.send(result);
        } catch (error) {
          return sendInventoryError(reply, error);
        }
      },
    );
  };
}

function sendInventoryError(reply: FastifyReply, error: unknown) {
  if (error instanceof PlayerError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'not_found'
          ? 404
          : error.code === 'conflict'
            ? 409
            : 401;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  if (error instanceof AuthError) {
    const statusCode =
      error.code === 'validation' ? 400 : error.code === 'conflict' ? 409 : 401;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao do inventario.',
  });
}
