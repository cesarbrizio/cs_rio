import {
  type SlotMachineConfigureInput,
  type SlotMachineInstallInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { SlotMachineError, type SlotMachineServiceContract } from '../../services/slot-machine.js';

interface SlotMachineRouteDependencies {
  slotMachineService: SlotMachineServiceContract;
}

export function createSlotMachineRoutes({
  slotMachineService,
}: SlotMachineRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/slot-machines', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await slotMachineService.listSlotMachines(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendSlotMachineError(reply, error);
      }
    });

    fastify.post<{ Body: SlotMachineInstallInput; Params: { propertyId: string } }>(
      '/slot-machines/:propertyId/install',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await slotMachineService.installMachines(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendSlotMachineError(reply, error);
        }
      },
    );

    fastify.post<{ Body: SlotMachineConfigureInput; Params: { propertyId: string } }>(
      '/slot-machines/:propertyId/configure',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await slotMachineService.configureOdds(
            request.playerId,
            request.params.propertyId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendSlotMachineError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { propertyId: string } }>(
      '/slot-machines/:propertyId/collect',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await slotMachineService.collectCash(
            request.playerId,
            request.params.propertyId,
          );
          return reply.send(result);
        } catch (error) {
          return sendSlotMachineError(reply, error);
        }
      },
    );
  };
}

function sendSlotMachineError(reply: FastifyReply, error: unknown) {
  if (error instanceof SlotMachineError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'unauthorized'
          ? 401
          : error.code === 'not_found'
            ? 404
            : error.code === 'insufficient_funds'
              ? 422
              : error.code === 'capacity' ||
                  error.code === 'conflict' ||
                  error.code === 'character_not_ready'
                ? 409
                : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada na gestao de maquininhas.',
  });
}
