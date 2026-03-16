import { createHash } from 'node:crypto';

import { type FastifyRequest } from 'fastify';

import type { ManagedKeyValueAtomic } from '../services/key-value-store.js';
import { RouteHttpError } from './http-errors.js';

const DEFAULT_COMPLETION_TTL_SECONDS = 5;
const DEFAULT_IN_FLIGHT_TTL_SECONDS = 30;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export const DUPLICATE_ACTION_MESSAGE =
  'Acao duplicada em andamento ou recem processada. Aguarde antes de repetir a requisicao.';

export interface ActionIdempotencyOptions {
  action: string;
  completionTtlSeconds?: number;
  inFlightTtlSeconds?: number;
  keyParts?: unknown[];
}

export class ActionIdempotency {
  constructor(private readonly keyValueStore: ManagedKeyValueAtomic) {}

  async run<T>(
    request: FastifyRequest,
    options: ActionIdempotencyOptions,
    handler: () => Promise<T>,
  ): Promise<T> {
    const fingerprint = this.buildFingerprint(request, options);
    const inFlightKey = `action-idempotency:inflight:${fingerprint}`;
    const completedKey = `action-idempotency:completed:${fingerprint}`;

    const completedValue = await this.keyValueStore.get(completedKey);

    if (completedValue !== null) {
      throw createDuplicateActionError();
    }

    const inFlightTtlSeconds = options.inFlightTtlSeconds ?? DEFAULT_IN_FLIGHT_TTL_SECONDS;
    const acquiredLock = this.keyValueStore.setIfAbsent
      ? await this.keyValueStore.setIfAbsent(inFlightKey, request.id, inFlightTtlSeconds)
      : (await this.keyValueStore.increment(inFlightKey, inFlightTtlSeconds)) === 1;

    if (!acquiredLock) {
      throw createDuplicateActionError();
    }

    try {
      const result = await handler();
      const completionTtlSeconds = options.completionTtlSeconds ?? DEFAULT_COMPLETION_TTL_SECONDS;

      if (completionTtlSeconds > 0) {
        await this.keyValueStore.set(
          completedKey,
          request.id,
          completionTtlSeconds,
        );
      }

      return result;
    } finally {
      await this.keyValueStore.delete?.(inFlightKey);
    }
  }

  private buildFingerprint(
    request: FastifyRequest,
    options: ActionIdempotencyOptions,
  ): string {
    const idempotencyKey = resolveHeaderIdempotencyKey(request);
    const payload = idempotencyKey
      ? {
          action: options.action,
          idempotencyKey,
          playerId: request.playerId ?? null,
        }
      : {
          action: options.action,
          body: normalizeValue(request.body),
          keyParts: normalizeValue(options.keyParts ?? null),
          params: normalizeValue(request.params),
          playerId: request.playerId ?? null,
          query: normalizeValue(request.query),
        };

    return createHash('sha256').update(stableSerialize(payload)).digest('hex');
  }
}

function createDuplicateActionError(): RouteHttpError {
  return new RouteHttpError(409, 'domain', DUPLICATE_ACTION_MESSAGE);
}

function resolveHeaderIdempotencyKey(request: FastifyRequest): string | null {
  const rawHeader = request.headers['idempotency-key'] ?? request.headers['x-idempotency-key'];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return null;
  }

  return normalized;
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const nextValue = normalizeValue((value as Record<string, unknown>)[key]);

        if (nextValue !== undefined) {
          accumulator[key] = nextValue;
        }

        return accumulator;
      }, {});
  }

  return value;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}
