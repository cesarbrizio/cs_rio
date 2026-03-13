import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import {
  HospitalError,
  type HospitalServiceContract,
} from '../../services/hospital.js';
import { type HospitalStatPurchaseInput, type HospitalSurgeryInput } from '@cs-rio/shared';

interface HospitalRouteDependencies {
  hospitalService: HospitalServiceContract;
}

export function createHospitalRoutes({
  hospitalService,
}: HospitalRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/hospital', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.getCenter(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post('/hospital/treatment', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.applyTreatment(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post('/hospital/detox', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.detox(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post('/hospital/dst-treatment', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.applyDstTreatment(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post('/hospital/health-plan', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.purchaseHealthPlan(request.playerId);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post<{ Body: HospitalSurgeryInput }>('/hospital/surgery', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.performSurgery(request.playerId, request.body ?? {});
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });

    fastify.post<{ Body: HospitalStatPurchaseInput }>('/hospital/stat-items', async (request, reply) => {
      if (!request.playerId) {
        return reply.code(401).send({ message: 'Token ausente.' });
      }

      try {
        const result = await hospitalService.purchaseStatItem(request.playerId, request.body);
        return reply.send(result);
      } catch (error) {
        return sendHospitalError(reply, error);
      }
    });
  };
}

function sendHospitalError(reply: FastifyReply, error: unknown) {
  if (error instanceof HospitalError) {
    const statusCode =
      error.code === 'unauthorized'
        ? 401
        : error.code === 'not_found'
          ? 404
          : error.code === 'validation'
            ? 400
            : error.code === 'insufficient_resources'
              ? 402
              : 409;

    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada ao processar o hospital.',
  });
}
