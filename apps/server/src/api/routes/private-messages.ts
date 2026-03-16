import { type PrivateMessageSendInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  privateMessageParamsSchema,
  privateMessageSendBodySchema,
} from '../schemas.js';
import { type PrivateMessageService } from '../../services/private-message.js';

interface PrivateMessageRouteDependencies {
  privateMessageService: PrivateMessageService;
}

export function createPrivateMessageRoutes({
  privateMessageService,
}: PrivateMessageRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/private-messages/threads',
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
          const result = await privateMessageService.listThreads(request.playerId);
          return reply.send(result);
        } catch (error) {
          return sendPrivateMessageError(reply, error);
        }
      },
    );

    fastify.get<{ Params: { contactId: string } }>(
      '/private-messages/threads/:contactId',
      {
        schema: {
          params: privateMessageParamsSchema,
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
          const result = await privateMessageService.getThread(request.playerId, request.params.contactId);
          return reply.send(result);
        } catch (error) {
          return sendPrivateMessageError(reply, error);
        }
      },
    );

    fastify.post<{ Body: PrivateMessageSendInput; Params: { contactId: string } }>(
      '/private-messages/threads/:contactId',
      {
        schema: {
          body: privateMessageSendBodySchema,
          params: privateMessageParamsSchema,
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
          const result = await privateMessageService.sendMessage(
            request.playerId,
            request.params.contactId,
            request.body,
          );
          return reply.send(result);
        } catch (error) {
          return sendPrivateMessageError(reply, error);
        }
      },
    );
  };
}

function sendPrivateMessageError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na mensageria privada.');
}
