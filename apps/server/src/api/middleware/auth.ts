import { type FastifyReply, type FastifyRequest } from 'fastify';

import { type AuthService } from '../../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    playerId?: string;
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({
        message: 'Token ausente.',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();

    if (!token) {
      return reply.code(401).send({
        message: 'Token ausente.',
      });
    }

    try {
      const identity = authService.verifyAccessToken(token);
      request.playerId = identity.playerId;
    } catch {
      return reply.code(401).send({
        message: 'Token invalido ou expirado.',
      });
    }
  };
}
