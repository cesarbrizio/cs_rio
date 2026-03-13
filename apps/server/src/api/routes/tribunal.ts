import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError } from '../../services/auth.js';
import { TribunalError, type TribunalServiceContract } from '../../services/tribunal.js';

interface TribunalRouteDependencies {
  tribunalService: TribunalServiceContract;
}

export function createTribunalRoutes({
  tribunalService,
}: TribunalRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Params: { favelaId: string } }>('/tribunal/favelas/:favelaId/case', async (request, reply) => {
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
    });

    fastify.post<{ Params: { favelaId: string } }>(
      '/tribunal/favelas/:favelaId/case',
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
      async (request, reply) => {
        if (!request.playerId) {
          return reply.code(401).send({
            message: 'Token ausente.',
          });
        }

        if (!request.body?.punishment) {
          return reply.code(400).send({
            message: 'Punicao obrigatoria.',
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

function sendTribunalError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    return reply.code(401).send({
      message: error.message,
    });
  }

  if (error instanceof TribunalError) {
    const statusCode =
      error.code === 'validation'
        ? 400
        : error.code === 'not_found'
          ? 404
          : error.code === 'forbidden'
            ? 403
            : error.code === 'character_not_ready'
              ? 409
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no tribunal do trafico.',
  });
}
