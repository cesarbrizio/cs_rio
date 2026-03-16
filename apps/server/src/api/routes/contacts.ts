import { type PlayerContactCreateInput } from '@cs-rio/shared';
import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  playerContactCreateBodySchema,
  playerContactParamsSchema,
} from '../schemas.js';
import { type ContactService } from '../../services/contact.js';

interface ContactRouteDependencies {
  contactService: ContactService;
}

export function createContactRoutes({
  contactService,
}: ContactRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/contacts',
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
          const contacts = await contactService.listContacts(request.playerId);
          return reply.send(contacts);
        } catch (error) {
          return sendContactError(reply, error);
        }
      },
    );

    fastify.post<{ Body: PlayerContactCreateInput }>(
      '/contacts',
      {
        schema: {
          body: playerContactCreateBodySchema,
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
          const result = await contactService.addContact(request.playerId, request.body);
          return reply.send(result);
        } catch (error) {
          return sendContactError(reply, error);
        }
      },
    );

    fastify.delete<{ Params: { contactId: string } }>(
      '/contacts/:contactId',
      {
        schema: {
          params: playerContactParamsSchema,
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
          const result = await contactService.removeContact(request.playerId, request.params.contactId);
          return reply.send(result);
        } catch (error) {
          return sendContactError(reply, error);
        }
      },
    );
  };
}

function sendContactError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada na gestao de contatos.');
}
