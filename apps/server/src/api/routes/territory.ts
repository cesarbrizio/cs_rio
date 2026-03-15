import {
  type FactionWarPrepareInput,
  type FavelaBaileOrganizeInput,
  type FavelaConquestInput,
  type FavelaServiceInstallInput,
  type FavelaServiceType,
  type FavelaStateTransitionInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  factionWarPrepareBodySchema,
  favelaBaileOrganizeBodySchema,
  favelaConquestBodySchema,
  favelaServiceInstallBodySchema,
  favelaServiceTypeSchema,
  favelaStateTransitionBodySchema,
  idSchema,
} from '../schemas.js';
import { type TerritoryServiceContract } from '../../services/territory.js';

interface TerritoryRouteDependencies {
  actionIdempotency: ActionIdempotency;
  territoryService: TerritoryServiceContract;
}

export function createTerritoryRoutes({
  actionIdempotency,
  territoryService,
}: TerritoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const favelaIdParamsSchema = buildIdParamsSchema('favelaId');
    const favelaServiceUpgradeParamsSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['favelaId', 'serviceType'],
      properties: {
        favelaId: idSchema,
        serviceType: favelaServiceTypeSchema,
      },
    };

    fastify.get(
      '/territory/favelas',
      {
        schema: {
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
        const result = await territoryService.listTerritory(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendTerritoryError(reply, error);
      }
      },
    );

    fastify.post<{ Body: FavelaStateTransitionInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/transition',
      {
        schema: {
          body: favelaStateTransitionBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.transition',
              keyParts: [request.params.favelaId, request.body],
            },
            () =>
              territoryService.transitionFavelaState(
                request.playerId!,
                request.params.favelaId,
                request.body,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FavelaConquestInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/conquer',
      {
        schema: {
          body: favelaConquestBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.conquer',
              keyParts: [request.params.favelaId, request.body ?? {}],
            },
            () =>
              territoryService.conquerFavela(
                request.playerId!,
                request.params.favelaId,
                request.body ?? {},
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/services',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await territoryService.listFavelaServices(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FavelaServiceInstallInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/services',
      {
        schema: {
          body: favelaServiceInstallBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.service.install',
              keyParts: [request.params.favelaId, request.body],
            },
            () =>
              territoryService.installFavelaService(
                request.playerId!,
                request.params.favelaId,
                request.body,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string; serviceType: FavelaServiceType } }>(
      '/territory/favelas/:favelaId/services/:serviceType/upgrade',
      {
        schema: {
          params: favelaServiceUpgradeParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.service.upgrade',
              keyParts: [request.params.favelaId, request.params.serviceType],
            },
            () =>
              territoryService.upgradeFavelaService(
                request.playerId!,
                request.params.favelaId,
                request.params.serviceType,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await territoryService.getFactionWar(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war/declare',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.war.declare',
              keyParts: [request.params.favelaId],
            },
            () =>
              territoryService.declareFactionWar(
                request.playerId!,
                request.params.favelaId,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionWarPrepareInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war/prepare',
      {
        schema: {
          body: factionWarPrepareBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.war.prepare',
              keyParts: [request.params.favelaId, request.body],
            },
            () =>
              territoryService.prepareFactionWar(
                request.playerId!,
                request.params.favelaId,
                request.body,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war/round',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.war.round',
              completionTtlSeconds: 0,
              keyParts: [request.params.favelaId],
            },
            () =>
              territoryService.advanceFactionWarRound(
                request.playerId!,
                request.params.favelaId,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/baile',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await territoryService.getFavelaBaile(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FavelaBaileOrganizeInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/baile',
      {
        schema: {
          body: favelaBaileOrganizeBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.baile.organize',
              keyParts: [request.params.favelaId, request.body],
            },
            () =>
              territoryService.organizeFavelaBaile(
                request.playerId!,
                request.params.favelaId,
                request.body,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/propina/negotiate',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.propina.negotiate',
              keyParts: [request.params.favelaId],
            },
            () =>
              territoryService.negotiatePropina(
                request.playerId!,
                request.params.favelaId,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/x9/desenrolo',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await actionIdempotency.run(
            request,
            {
              action: 'territory.x9.desenrolo',
              keyParts: [request.params.favelaId],
            },
            () =>
              territoryService.attemptX9Desenrolo(
                request.playerId!,
                request.params.favelaId,
              ),
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );
  };
}

function sendTerritoryError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no sistema territorial.');
}
