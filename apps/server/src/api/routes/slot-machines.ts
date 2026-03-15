import {
  type SlotMachineConfigureInput,
  type SlotMachineInstallInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  slotMachineConfigureBodySchema,
  slotMachineInstallBodySchema,
} from '../schemas.js';
import { type SlotMachineServiceContract } from '../../services/slot-machine.js';

interface SlotMachineRouteDependencies {
  slotMachineService: SlotMachineServiceContract;
}

export function createSlotMachineRoutes({
  slotMachineService,
}: SlotMachineRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const propertyIdParamsSchema = buildIdParamsSchema('propertyId');

    fastify.get(
      '/slot-machines',
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
        const result = await slotMachineService.listSlotMachines(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendSlotMachineError(reply, error);
      }
      },
    );

    fastify.post<{ Body: SlotMachineInstallInput; Params: { propertyId: string } }>(
      '/slot-machines/:propertyId/install',
      {
        schema: {
          body: slotMachineInstallBodySchema,
          params: propertyIdParamsSchema,
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
      {
        schema: {
          body: slotMachineConfigureBodySchema,
          params: propertyIdParamsSchema,
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
      {
        schema: {
          params: propertyIdParamsSchema,
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

function sendSlotMachineError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de maquininhas.');
}
