import { AsyncLocalStorage } from 'node:async_hooks';

import { type FastifyRequest } from 'fastify';

export interface RequestLogContext {
  ip?: string;
  method: string;
  path: string;
  playerId?: string;
  regionId?: string;
  route: string;
  requestId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestLogContext>();

declare module 'fastify' {
  interface FastifyRequest {
    contextLog?: FastifyRequest['log'];
    playerId?: string;
    requestContext?: RequestLogContext;
  }
}

export function bindRequestContext(request: FastifyRequest): RequestLogContext {
  const context = buildRequestContext(request);
  requestContextStorage.enterWith(context);
  request.requestContext = context;
  request.contextLog = request.log.child(buildRequestLogBindings(context));
  return context;
}

export function refreshRequestContext(request: FastifyRequest): RequestLogContext {
  const nextContext = buildRequestContext(request, request.requestContext);
  requestContextStorage.enterWith(nextContext);
  request.requestContext = nextContext;
  request.contextLog = request.log.child(buildRequestLogBindings(nextContext));
  return nextContext;
}

export function getRequestContext(): RequestLogContext | null {
  return requestContextStorage.getStore() ?? null;
}

export function buildRequestLogBindings(context: RequestLogContext): Record<string, string> {
  const bindings: Record<string, string> = {
    method: context.method,
    path: context.path,
    requestId: context.requestId,
    route: context.route,
  };

  if (context.ip) {
    bindings.ip = context.ip;
  }

  if (context.playerId) {
    bindings.playerId = context.playerId;
  }

  if (context.regionId) {
    bindings.regionId = context.regionId;
  }

  return bindings;
}

function buildRequestContext(
  request: FastifyRequest,
  previous?: RequestLogContext,
): RequestLogContext {
  return {
    ip: request.ip || previous?.ip,
    method: request.method,
    path: request.url,
    playerId: request.playerId ?? previous?.playerId,
    regionId: extractRegionId(request) ?? previous?.regionId,
    route: request.routeOptions.url || previous?.route || request.url,
    requestId: request.id,
  };
}

function extractRegionId(request: FastifyRequest): string | undefined {
  const candidates = [
    request.params,
    request.query,
    request.body,
  ] as Array<Record<string, unknown> | undefined>;

  for (const candidate of candidates) {
    const regionId = resolveRegionId(candidate);

    if (regionId) {
      return regionId;
    }
  }

  return undefined;
}

function resolveRegionId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const maybeRegion = (value as Record<string, unknown>).regionId;

  return typeof maybeRegion === 'string' && maybeRegion.trim() ? maybeRegion.trim() : undefined;
}
