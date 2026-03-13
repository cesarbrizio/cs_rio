import { type FastifyPluginAsync, type FastifyReply } from 'fastify';

import { AuthError, type AuthService } from '../../services/auth.js';

interface AuthRouteDependencies {
  authService: AuthService;
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

export function createAuthRoutes({ authService }: AuthRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.post<{ Body: RegisterBody }>('/auth/register', async (request, reply) => {
      try {
        const session = await authService.register(request.body);
        return reply.code(201).send(session);
      } catch (error) {
        return sendAuthError(reply, error);
      }
    });

    fastify.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
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
    });

    fastify.post<{ Body: RefreshBody }>('/auth/refresh', async (request, reply) => {
      try {
        const session = await authService.refresh(request.body.refreshToken);
        return reply.send(session);
      } catch (error) {
        return sendAuthError(reply, error);
      }
    });
  };
}

function sendAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    const statusCode = mapAuthErrorToStatus(error.code);
    return reply.code(statusCode).send({
      message: error.message,
    });
  }

  return reply.code(500).send({
    message: 'Falha inesperada no fluxo de autenticacao.',
  });
}

function mapAuthErrorToStatus(code: AuthError['code']): number {
  switch (code) {
    case 'validation':
      return 400;
    case 'conflict':
      return 409;
    case 'invalid_credentials':
    case 'unauthorized':
      return 401;
    case 'rate_limited':
      return 429;
    default:
      return 500;
  }
}
