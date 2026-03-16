import { type FastifyReply, type FastifyRequest } from 'fastify';

import { refreshRequestContext } from '../../observability/request-context.js';
import { type AuthService } from '../../services/auth.js';

const AUTH_ROUTE_ALLOWLIST = new Set(['/players/public/:nickname']);

export function createAuthMiddleware(authService: AuthService) {
  return async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const routeUrl = request.routeOptions.url ?? request.url;
    const normalizedRouteUrl = routeUrl.startsWith('/api') ? routeUrl.slice(4) : routeUrl;

    if (AUTH_ROUTE_ALLOWLIST.has(normalizedRouteUrl)) {
      return;
    }

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
      refreshRequestContext(request);
    } catch {
      return reply.code(401).send({
        message: 'Token invalido ou expirado.',
      });
    }
  };
}
