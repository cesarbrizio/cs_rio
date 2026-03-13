import { type FastifyPluginAsync } from 'fastify';

import { type GameEventServiceContract } from '../../services/game-event.js';

interface EventRouteDependencies {
  gameEventService: GameEventServiceContract;
}

export function createEventRoutes({
  gameEventService,
}: EventRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/events/docks', async (_request, reply) => {
      const response = await gameEventService.getDocksStatus();
      return reply.send(response);
    });

    fastify.get('/events/police', async (_request, reply) => {
      const response = await gameEventService.getPoliceStatus();
      return reply.send(response);
    });

    fastify.get('/events/seasonal', async (_request, reply) => {
      const response = await gameEventService.getSeasonalStatus();
      return reply.send(response);
    });
  };
}
