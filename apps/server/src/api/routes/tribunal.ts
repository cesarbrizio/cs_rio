import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildIdParamsSchema,
  buildStandardResponseSchema,
  genericObjectResponseSchema,
  tribunalJudgmentBodySchema,
} from '../schemas.js';
import { type TribunalServiceContract } from '../../services/tribunal.js';

interface TribunalRouteDependencies {
  tribunalService: TribunalServiceContract;
}

export function createTribunalRoutes({
  tribunalService,
}: TribunalRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    const favelaIdParamsSchema = buildIdParamsSchema('favelaId');

    fastify.get('/tribunal/cues', {
      schema: {
        response: buildStandardResponseSchema(),
      },
    }, async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({
          message: 'Token ausente.',
        });
      }

      try {
        const result = await tribunalService.getTribunalCues(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendTribunalError(reply, error);
      }
    });

    fastify.get<{ Params: { favelaId: string } }>(
      '/tribunal/favelas/:favelaId/case',
      {
        schema: {
          params: favelaIdParamsSchema,
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
          const result = await tribunalService.getTribunalCenter(request.playerId, request.params.favelaId);
          return reply.send(result);
        } catch (error) {
          return sendTribunalError(reply, error);
        }
      },
    );

    fastify.post<{ Params: { favelaId: string } }>(
      '/tribunal/favelas/:favelaId/case',
      {
        schema: {
          params: favelaIdParamsSchema,
          response: {
            ...buildStandardResponseSchema(),
            201: genericObjectResponseSchema,
          },
        },
      },
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        try {
          const result = await tribunalService.generateCase(request.playerId, request.params.favelaId);
          return reply.code(result.created ? 201 : 200).send(result);
        } catch (error) {
          return sendTribunalError(reply, error);
        }
      },
    );

    fastify.post<{ Body: { punishment?: string }; Params: { favelaId: string } }>(
      '/tribunal/favelas/:favelaId/case/judgment',
      {
        schema: {
          body: tribunalJudgmentBodySchema,
          params: favelaIdParamsSchema,
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
          const result = await tribunalService.judgeCase(request.playerId, request.params.favelaId, {
            punishment: request.body.punishment as
              | 'aviso'
              | 'expulsao'
              | 'esquartejar'
              | 'matar'
              | 'queimar_no_pneu'
              | 'surra',
          });
          return reply.send(result);
        } catch (error) {
          return sendTribunalError(reply, error);
        }
      },
    );
  };
}

function sendTribunalError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no tribunal do trafico.');
}
