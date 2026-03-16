import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  hospitalStatPurchaseBodySchema,
  hospitalSurgeryBodySchema,
} from '../schemas.js';
import { type HospitalServiceContract } from '../../services/hospital.js';
import { type HospitalStatPurchaseInput, type HospitalSurgeryInput } from '@cs-rio/shared';

interface HospitalRouteDependencies {
  actionIdempotency: ActionIdempotency;
  hospitalService: HospitalServiceContract;
}

export function createHospitalRoutes({
  actionIdempotency,
  hospitalService,
}: HospitalRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/hospital',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );

    fastify.post(
      '/hospital/treatment',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'hospital.treatment',
          },
          () => hospitalService.applyTreatment(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );

    fastify.post(
      '/hospital/detox',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'hospital.detox',
          },
          () => hospitalService.detox(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );

    fastify.post(
      '/hospital/health-plan',
      {
        schema: {
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'hospital.health-plan',
          },
          () => hospitalService.purchaseHealthPlan(request.playerId!),
        );
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );

    fastify.post<{ Body: HospitalSurgeryInput }>(
      '/hospital/surgery',
      {
        schema: {
          body: hospitalSurgeryBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await actionIdempotency.run(
          request,
          {
            action: 'hospital.surgery',
            keyParts: [request.body ?? {}],
          },
          () => hospitalService.performSurgery(request.playerId!, request.body ?? {}),
        );
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );

    fastify.post<{ Body: HospitalStatPurchaseInput }>(
      '/hospital/stat-items',
      {
        schema: {
          body: hospitalStatPurchaseBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.purchaseStatItem(request.playerId, request.body);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
      },
    );
  };
}

function sendHospitalError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada ao processar o hospital.');
}
