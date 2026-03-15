import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FastifyRequest } from 'fastify';

import {
  ActionIdempotency,
  DUPLICATE_ACTION_MESSAGE,
} from '../src/api/action-idempotency.js';
import type { KeyValueStore } from '../src/services/auth.js';

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<string, { expiresAt: number | null; value: string }>();

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired(key);
    return this.entries.get(key)?.value ?? null;
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    this.purgeExpired(key);
    const currentValue = Number(this.entries.get(key)?.value ?? '0') + 1;
    this.entries.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value: String(currentValue),
    });
    return currentValue;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, {
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      value,
    });
  }

  private purgeExpired(key: string): void {
    const entry = this.entries.get(key);

    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
    }
  }
}

describe('ActionIdempotency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bloqueia retry imediato depois de uma acao concluida', async () => {
    const guard = new ActionIdempotency(new InMemoryKeyValueStore());
    const request = buildRequest();

    const firstResult = await guard.run(
      request,
      {
        action: 'hospital.treatment',
      },
      async () => ({ ok: true }),
    );

    expect(firstResult).toEqual({ ok: true });

    await expect(
      guard.run(
        request,
        {
          action: 'hospital.treatment',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({
      message: DUPLICATE_ACTION_MESSAGE,
      statusCode: 409,
    });
  });

  it('bloqueia request concorrente enquanto a primeira ainda esta em andamento', async () => {
    const guard = new ActionIdempotency(new InMemoryKeyValueStore());
    const request = buildRequest();
    let release: (() => void) | null = null;

    const firstExecution = guard.run(
      request,
      {
        action: 'market.order.create',
      },
      () =>
        new Promise<{ ok: true }>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );

    await Promise.resolve();

    await expect(
      guard.run(
        request,
        {
          action: 'market.order.create',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({
      message: DUPLICATE_ACTION_MESSAGE,
      statusCode: 409,
    });

    release?.();
    await expect(firstExecution).resolves.toEqual({ ok: true });
  });

  it('aceita mesma rota com idempotency key diferente', async () => {
    const guard = new ActionIdempotency(new InMemoryKeyValueStore());

    const firstRequest = buildRequest({
      headers: {
        'idempotency-key': 'first',
      },
    });
    const secondRequest = buildRequest({
      headers: {
        'idempotency-key': 'second',
      },
    });

    await expect(
      guard.run(
        firstRequest,
        {
          action: 'territory.war.declare',
        },
        async () => ({ ok: true }),
      ),
    ).resolves.toEqual({ ok: true });

    await expect(
      guard.run(
        secondRequest,
        {
          action: 'territory.war.declare',
        },
        async () => ({ ok: true }),
      ),
    ).resolves.toEqual({ ok: true });
  });

  it('compartilha o lock entre guardas diferentes quando o store e compartilhado', async () => {
    const sharedStore = new InMemoryKeyValueStore();
    const firstGuard = new ActionIdempotency(sharedStore);
    const secondGuard = new ActionIdempotency(sharedStore);
    const request = buildRequest({
      headers: {
        'idempotency-key': 'shared-lock',
      },
    });
    let release: (() => void) | null = null;

    const firstExecution = firstGuard.run(
      request,
      {
        action: 'market.order.create',
      },
      () =>
        new Promise<{ ok: true }>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );

    await Promise.resolve();

    await expect(
      secondGuard.run(
        request,
        {
          action: 'market.order.create',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({
      message: DUPLICATE_ACTION_MESSAGE,
      statusCode: 409,
    });

    release?.();
    await expect(firstExecution).resolves.toEqual({ ok: true });
  });
});

function buildRequest(input: {
  body?: unknown;
  headers?: Record<string, string>;
  params?: unknown;
  playerId?: string;
  query?: unknown;
} = {}): FastifyRequest {
  return {
    body: input.body ?? null,
    headers: input.headers ?? {},
    id: 'request-1',
    method: 'POST',
    params: input.params ?? {},
    playerId: input.playerId ?? 'player-1',
    query: input.query ?? {},
  } as FastifyRequest;
}
