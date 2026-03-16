import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { createHttpRateLimitHook } from '../http-hardening.js';
import { throwRouteHttpError } from '../http-errors.js';
import {
  buildStandardResponseSchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from '../schemas.js';
import { type AuthService } from '../../services/auth.js';
import type { KeyValueAtomic } from '../../services/key-value-store.js';

interface AuthRouteDependencies {
  authService: AuthService;
  keyValueStore: KeyValueAtomic;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface RegisterBody {
  email: string;
  nickname: string;
  password: string;
}

export function createAuthRoutes({ authService, keyValueStore }: AuthRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.addHook('preHandler', createHttpRateLimitHook({ keyValueStore }));

    fastify.post<{ Body: RegisterBody }>(
      '/auth/register',
      {
        schema: {
          body: registerBodySchema,
          response: buildStandardResponseSchema(201),
        },
      },
      async (request, reply) => {
      try {
        const session = await authService.register(request.body);
        return reply.code(201).send(session);
      } catch (error) {
        return sendAuthError(reply, error);
      }
      },
    );

    fastify.post<{ Body: LoginBody }>(
      '/auth/login',
      {
        schema: {
          body: loginBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      try {
        const session = await authService.login({
          email: request.body.email,
          ipAddress: request.ip,
          password: request.body.password,
        });
        return reply.send(session);
      } catch (error) {
        return sendAuthError(reply, error);
      }
      },
    );

    fastify.post<{ Body: RefreshBody }>(
      '/auth/refresh',
      {
        schema: {
          body: refreshBodySchema,
          response: buildStandardResponseSchema(200),
        },
      },
      async (request, reply) => {
      try {
        const session = await authService.refresh(request.body.refreshToken);
        return reply.send(session);
      } catch (error) {
        return sendAuthError(reply, error);
      }
      },
    );
  };
}

function sendAuthError(_reply: FastifyReply, error: unknown): never {
  throwRouteHttpError(error, 'Falha inesperada no fluxo de autenticacao.');
}
