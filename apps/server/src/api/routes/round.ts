import { type FastifyPluginAsync } from 'fastify';

import { buildStandardResponseSchema } from '../schemas.js';
import { type RoundServiceContract } from '../../services/round.js';

interface RoundRouteDependencies {
  roundService: RoundServiceContract;
}

export function createRoundRoutes({ roundService }: RoundRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/round',
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

      const response = await roundService.getCenter();
      return reply.send(response);
      },
    );

    fastify.get(
      '/round/hall-of-fame',
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

      const response = await roundService.getHallOfFame();
      return reply.send(response);
      },
    );
  };
}
