import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';

import { type KeyValueStore } from '../services/auth.js';
import { RouteHttpError } from './http-errors.js';

const DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_HTTP_MUTATION_RATE_LIMIT_MAX_REQUESTS = 120;
const FREEFORM_SANITIZE_COMMENT = 'cs_rio:sanitize:freeform';

export const HTTP_BODY_LIMIT_BYTES = 16 * 1024;

type JsonSchema = Record<string, unknown>;

type RateLimitActorScope = 'ip' | 'player_or_ip';

interface HttpRateLimitPolicy {
  maxRequests: number;
  scope: RateLimitActorScope;
  windowMs: number;
}

interface HttpRateLimitStore {
  consume(key: string, maxRequests: number, windowMs: number): Promise<{
    count: number;
    exceeded: boolean;
    retryAfterMs: number;
  }>;
}

interface RateLimitWindowState {
  count: number;
  expiresAt: number;
}

interface CreateHttpRateLimitHookOptions {
  keyValueStore?: KeyValueStore;
}

class InMemoryHttpRateLimitStore implements HttpRateLimitStore {
  private readonly windows = new Map<string, RateLimitWindowState>();

  private operations = 0;

  async consume(key: string, maxRequests: number, windowMs: number, now = Date.now()) {
    this.operations += 1;

    if (this.operations % 100 === 0) {
      this.pruneExpired(now);
    }

    const current = this.windows.get(key);

    if (!current || current.expiresAt <= now) {
      const expiresAt = now + windowMs;
      this.windows.set(key, {
        count: 1,
        expiresAt,
      });

      return {
        count: 1,
        exceeded: false,
        retryAfterMs: windowMs,
      };
    }

    current.count += 1;

    return {
      count: current.count,
      exceeded: current.count > maxRequests,
      retryAfterMs: Math.max(1, current.expiresAt - now),
    };
  }

  reset(): void {
    this.operations = 0;
    this.windows.clear();
  }

  private pruneExpired(now: number): void {
    for (const [key, state] of this.windows.entries()) {
      if (state.expiresAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}

class KeyValueStoreHttpRateLimitStore implements HttpRateLimitStore {
  constructor(private readonly keyValueStore: KeyValueStore) {}

  async consume(key: string, maxRequests: number, windowMs: number) {
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const count = await this.keyValueStore.increment(`http-rate-limit:${key}`, ttlSeconds);

    return {
      count,
      exceeded: count > maxRequests,
      retryAfterMs: windowMs,
    };
  }
}

const ROUTE_RATE_LIMIT_POLICIES = new Map<string, HttpRateLimitPolicy>([
  [
    'POST /auth/register',
    {
      maxRequests: 40,
      scope: 'ip',
      windowMs: DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
    },
  ],
  [
    'POST /auth/login',
    {
      maxRequests: 40,
      scope: 'ip',
      windowMs: DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
    },
  ],
  [
    'POST /auth/refresh',
    {
      maxRequests: 60,
      scope: 'ip',
      windowMs: DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
    },
  ],
]);

const DEFAULT_PROTECTED_MUTATION_POLICY: HttpRateLimitPolicy = {
  maxRequests: DEFAULT_HTTP_MUTATION_RATE_LIMIT_MAX_REQUESTS,
  scope: 'player_or_ip',
  windowMs: DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
};

export function installHttpInputHardening(app: FastifyInstance): void {
  app.addHook('preValidation', async (request) => {
    sanitizeRequestInputs(request);
  });
}

export function createHttpRateLimitHook(options: CreateHttpRateLimitHookOptions = {}) {
  const store: HttpRateLimitStore = options.keyValueStore
    ? new KeyValueStoreHttpRateLimitStore(options.keyValueStore)
    : new InMemoryHttpRateLimitStore();

  return async function httpRateLimitHook(request: FastifyRequest, reply: FastifyReply) {
    const policy = resolveHttpRateLimitPolicy(request);

    if (!policy) {
      return;
    }

    const routeUrl = normalizeRouteUrl(readRouteUrl(request));
    const actor = resolveRateLimitActor(request, policy.scope);
    const key = `${request.method.toUpperCase()} ${routeUrl} :: ${actor}`;
    const state = await store.consume(key, policy.maxRequests, policy.windowMs);

    if (!state.exceeded) {
      return;
    }

    reply.header('retry-after', Math.ceil(state.retryAfterMs / 1000));
    throw new RouteHttpError(
      429,
      'rate_limited',
      'Muitas requisicoes seguidas nesta rota. Aguarde um pouco antes de tentar novamente.',
    );
  };
}

function sanitizeRequestInputs(request: FastifyRequest): void {
  const schema = readRouteSchema(request);

  if (!schema) {
    return;
  }

  const mutableRequest = request as FastifyRequest & {
    body: unknown;
    params: unknown;
    query: unknown;
  };

  if (schema.body && mutableRequest.body !== undefined) {
    mutableRequest.body = sanitizeValueAgainstSchema(mutableRequest.body, schema.body);
  }

  if (schema.params && mutableRequest.params !== undefined) {
    mutableRequest.params = sanitizeValueAgainstSchema(mutableRequest.params, schema.params);
  }

  if (schema.querystring && mutableRequest.query !== undefined) {
    mutableRequest.query = sanitizeValueAgainstSchema(mutableRequest.query, schema.querystring);
  }
}

function sanitizeValueAgainstSchema(value: unknown, schema: unknown): unknown {
  if (value === undefined || value === null || !isPlainObject(schema)) {
    return value;
  }

  if (schema.type === 'string') {
    return sanitizeStringValue(value, schema);
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    return value.map((entry) => sanitizeValueAgainstSchema(entry, schema.items));
  }

  if (schema.type !== 'object' || !isPlainObject(value)) {
    return value;
  }

  const properties = isPlainObject(schema.properties) ? schema.properties : null;

  if (!properties) {
    return value;
  }

  let changed = false;
  const nextValue: Record<string, unknown> = {
    ...value,
  };

  for (const [key, current] of Object.entries(nextValue)) {
    const sanitized = sanitizeValueAgainstSchema(current, properties[key]);

    if (!Object.is(sanitized, current)) {
      nextValue[key] = sanitized;
      changed = true;
    }
  }

  return changed ? nextValue : value;
}

function sanitizeStringValue(value: unknown, schema: JsonSchema): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (schema.$comment !== FREEFORM_SANITIZE_COMMENT) {
    return value;
  }

  const sanitized = stripControlCharacters(value)
    .replace(/\s+/g, ' ')
    .trim();

  if (schema.nullable === true && sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

function resolveHttpRateLimitPolicy(request: FastifyRequest): HttpRateLimitPolicy | null {
  const method = request.method.toUpperCase();

  if (!isMutationMethod(method)) {
    return null;
  }

  const routeUrl = normalizeRouteUrl(readRouteUrl(request));
  const explicit = ROUTE_RATE_LIMIT_POLICIES.get(`${method} ${routeUrl}`);

  if (explicit) {
    return explicit;
  }

  if (routeUrl.startsWith('/auth/')) {
    return null;
  }

  return DEFAULT_PROTECTED_MUTATION_POLICY;
}

function resolveRateLimitActor(request: FastifyRequest, scope: RateLimitActorScope): string {
  if (scope === 'player_or_ip' && typeof request.playerId === 'string' && request.playerId.trim()) {
    return `player:${request.playerId}`;
  }

  return `ip:${request.ip || 'unknown'}`;
}

function readRouteSchema(request: FastifyRequest): {
  body?: unknown;
  params?: unknown;
  querystring?: unknown;
} | null {
  const schema = request.routeOptions.schema;
  return isPlainObject(schema) ? schema : null;
}

function readRouteUrl(request: FastifyRequest): string {
  const routeUrl = request.routeOptions.url;

  if (typeof routeUrl === 'string' && routeUrl.trim()) {
    return routeUrl;
  }

  return request.url.split('?')[0] ?? request.url;
}

function normalizeRouteUrl(routeUrl: string): string {
  const normalized = routeUrl.startsWith('/api') ? routeUrl.slice(4) : routeUrl;
  return normalized || '/';
}

function isMutationMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function isPlainObject(value: unknown): value is JsonSchema {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripControlCharacters(value: string): string {
  let result = '';

  for (const character of value) {
    const code = character.charCodeAt(0);

    if ((code >= 0 && code <= 31) || code === 127) {
      result += ' ';
      continue;
    }

    result += character;
  }

  return result;
}
