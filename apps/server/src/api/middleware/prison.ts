import { type FastifyReply, type FastifyRequest } from 'fastify';

import { type PrisonSystemContract } from '../../systems/PrisonSystem.js';

const PRISON_ROUTE_ALLOWLIST = new Set(['/players/create', '/players/me']);

export function createPrisonActionLockMiddleware(prisonSystem: PrisonSystemContract) {
  return async function prisonActionLockMiddleware(request: FastifyRequest, reply: FastifyReply) {
    if (!request.playerId) {
      return;
    }

    const routeUrl = request.routeOptions.url ?? request.url;
    const normalizedRouteUrl = routeUrl.startsWith('/api') ? routeUrl.slice(4) : routeUrl;

    if (
      PRISON_ROUTE_ALLOWLIST.has(normalizedRouteUrl) ||
      normalizedRouteUrl === '/prison' ||
      normalizedRouteUrl.startsWith('/prison/')
    ) {
      return;
    }

    const prison = await prisonSystem.getStatus(request.playerId);

    if (!prison.isImprisoned) {
      return;
    }

    return reply.code(423).send({
      message: `Jogador preso ate ${prison.endsAt ?? 'data indisponivel'}. Acao bloqueada.`,
      prison,
    });
  };
}
