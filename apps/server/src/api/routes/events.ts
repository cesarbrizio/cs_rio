import { type FastifyPluginAsync } from 'fastify';

import { buildStandardResponseSchema } from '../schemas.js';
import { type GameEventServiceContract } from '../../services/game-event.js';

interface EventRouteDependencies {
  gameEventService: GameEventServiceContract;
}

export function createEventRoutes({
  gameEventService,
}: EventRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/events/docks', {
      schema: {
        response: buildStandardResponseSchema(),
      },
    }, async (_request, reply) => {
      const response = await gameEventService.getDocksStatus();
      return reply.send(response);
    });

    fastify.get('/events/police', {
      schema: {
        response: buildStandardResponseSchema(),
      },
    }, async (_request, reply) => {
      const response = await gameEventService.getPoliceStatus();
      return reply.send(response);
    });

    fastify.get('/events/seasonal', {
      schema: {
        response: buildStandardResponseSchema(),
      },
    }, async (_request, reply) => {
      const response = await gameEventService.getSeasonalStatus();
      return reply.send(response);
    });

    fastify.get('/events/results', {
      schema: {
        response: buildStandardResponseSchema(),
      },
    }, async (_request, reply) => {
      const response = await gameEventService.getRecentResults();
      return reply.send(response);
    });
  };
}
