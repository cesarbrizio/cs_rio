import {
  type FactionWarPrepareInput,
  type FavelaBaileOrganizeInput,
  type FavelaConquestInput,
  type FavelaServiceInstallInput,
  type FavelaServiceType,
  type FavelaStateTransitionInput,
} from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import {
  TerritoryError,
  type TerritoryServiceContract,
} from '../../services/territory.js';

interface TerritoryRouteDependencies {
  territoryService: TerritoryServiceContract;
}

export function createTerritoryRoutes({
  territoryService,
}: TerritoryRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/territory/favelas', async (request, reply) => {
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
    });

    fastify.post<{ Body: FavelaStateTransitionInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/transition',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.transitionFavelaState(
            request.playerId,
            request.params.favelaId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FavelaConquestInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/conquer',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.conquerFavela(
            request.playerId,
            request.params.favelaId,
            request.body ?? {},
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/services',
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
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.installFavelaService(
            request.playerId,
            request.params.favelaId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string; serviceType: FavelaServiceType } }>(
      '/territory/favelas/:favelaId/services/:serviceType/upgrade',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.upgradeFavelaService(
            request.playerId,
            request.params.favelaId,
            request.params.serviceType,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war',
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
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.declareFactionWar(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Body: FactionWarPrepareInput; Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war/prepare',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.prepareFactionWar(
            request.playerId,
            request.params.favelaId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/war/round',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.advanceFactionWarRound(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/baile',
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
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.organizeFavelaBaile(
            request.playerId,
            request.params.favelaId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/territory/favelas/:favelaId/propina/negotiate',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.negotiatePropina(
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
      '/territory/favelas/:favelaId/x9/desenrolo',
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await territoryService.attemptX9Desenrolo(
            request.playerId,
            request.params.favelaId,
          );
          return reply.send(result);
        } catch (error) {
          return sendTerritoryError(reply, error);
        }
      },
    );
  };
}

function sendTerritoryError(reply: FastifyReply, error: unknown) {
  if (error instanceof TerritoryError) {
    const statusCode =
      error.code === 'validation' || error.code === 'invalid_transition'
        ? 400
        : error.code === 'forbidden'
          ? 403
          : error.code === 'conflict'
            ? 409
          : error.code === 'not_found'
            ? 404
            : error.code === 'character_not_ready'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no sistema territorial.',
  });
}
