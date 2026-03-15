import {
  type InventoryGrantInput,
  type InventoryQuantityUpdateInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  inventoryGrantBodySchema,
  inventoryQuantityUpdateBodySchema,
} from '../schemas.js';
import { type PlayerService } from '../../services/player.js';

interface InventoryRouteDependencies {
  playerService: PlayerService;
}

export function createInventoryRoutes({
  playerService,
}: InventoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const inventoryItemIdParamsSchema = buildIdParamsSchema('inventoryItemId');

    fastify.get(
      '/inventory',
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
        const inventory = await playerService.getInventory(request.playerId);
        return reply.send(inventory);
      } catch (error) {
        return sendInventoryError(reply, error);
      }
      },
    );

    fastify.post<{ Body: InventoryGrantInput }>(
      '/inventory/items',
      {
        schema: {
          body: inventoryGrantBodySchema,
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
        const inventory = await playerService.grantInventoryItem(request.playerId, request.body);
        return reply.code(201).send(inventory);
      } catch (error) {
        return sendInventoryError(reply, error);
      }
      },
    );

    fastify.patch<{ Body: InventoryQuantityUpdateInput; Params: { inventoryItemId: string } }>(
      '/inventory/:inventoryItemId',
      {
        schema: {
          body: inventoryQuantityUpdateBodySchema,
          params: inventoryItemIdParamsSchema,
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
      {
        schema: {
          params: inventoryItemIdParamsSchema,
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
      {
        schema: {
          params: inventoryItemIdParamsSchema,
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
      {
        schema: {
          params: inventoryItemIdParamsSchema,
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
      {
        schema: {
          params: inventoryItemIdParamsSchema,
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
      {
        schema: {
          params: inventoryItemIdParamsSchema,
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

function sendInventoryError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao do inventario.');
}
