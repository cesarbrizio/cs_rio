import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createHttpRateLimitHook,
  installHttpInputHardening,
  HTTP_BODY_LIMIT_BYTES,
} from '../src/api/http-hardening.js';
import { installGlobalHttpErrorHandler } from '../src/api/http-errors.js';
import {
  buildStandardResponseSchema,
  factionCreateBodySchema,
  loginBodySchema,
} from '../src/api/schemas.js';
import type { KeyValueStore } from '../src/services/auth.js';

const apps: FastifyInstance[] = [];

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<string, { expiresAt: number | null; value: string }>();

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

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('HTTP hardening', () => {
  it('rejects oversized payloads with 413 before reaching the handler', async () => {
    let called = false;
    const app = await createHardeningApp(async (instance) => {
      instance.post(
        '/auth/login',
        {
          schema: {
            body: loginBodySchema,
            response: buildStandardResponseSchema(200),
          },
        },
        async () => {
          called = true;
          return {
            ok: true,
          };
        },
      );
    });

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'test@example.com',
        password: 'x'.repeat(HTTP_BODY_LIMIT_BYTES),
      },
      url: '/auth/login',
    });

    expect(called).toBe(false);
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('normalizes freeform strings before the handler receives the body', async () => {
    let receivedDescription: string | null | undefined;
    const app = await createHardeningApp(async (instance) => {
      instance.post(
        '/factions',
        {
          schema: {
            body: factionCreateBodySchema,
            response: buildStandardResponseSchema(201),
          },
        },
        async (request, reply) => {
          receivedDescription = (request.body as { description?: string | null }).description;
          return reply.code(201).send({
            created: true,
          });
        },
      );
    });

    const response = await app.inject({
      method: 'POST',
      payload: {
        abbreviation: 'CV',
        description: '   Comando \n\r  vermelho\t\t  ',
        name: 'Comando Vermelho',
      },
      url: '/factions',
    });

    expect(response.statusCode).toBe(201);
    expect(receivedDescription).toBe('Comando vermelho');
  });

  it('rate limits repeated public auth hits by IP', async () => {
    const app = await createHardeningApp(async (instance) => {
      instance.addHook('preHandler', createHttpRateLimitHook());
      instance.post(
        '/auth/login',
        {
          schema: {
            body: loginBodySchema,
            response: buildStandardResponseSchema(200),
          },
        },
        async () => ({
          ok: true,
        }),
      );
    });

    for (let index = 0; index < 40; index += 1) {
      const response = await app.inject({
        method: 'POST',
        payload: {
          email: 'test@example.com',
          password: 'correct-horse-battery-staple',
        },
        url: '/auth/login',
      });

      expect(response.statusCode).toBe(200);
    }

    const rateLimitedResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'test@example.com',
        password: 'correct-horse-battery-staple',
      },
      url: '/auth/login',
    });

    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    expect(rateLimitedResponse.json()).toMatchObject({
      category: 'rate_limited',
    });
  });

  it('rate limits repeated protected mutations by authenticated player', async () => {
    const app = await createHardeningApp(async (instance) => {
      instance.addHook('preHandler', async (request) => {
        request.playerId = 'player-1';
      });
      instance.addHook('preHandler', createHttpRateLimitHook());
      instance.post(
        '/actions/hot',
        {
          schema: {
            response: buildStandardResponseSchema(200),
          },
        },
        async () => ({
          ok: true,
        }),
      );
    });

    for (let index = 0; index < 120; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/actions/hot',
      });

      expect(response.statusCode).toBe(200);
    }

    const rateLimitedResponse = await app.inject({
      method: 'POST',
      url: '/actions/hot',
    });

    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.json()).toMatchObject({
      category: 'rate_limited',
    });
  });

  it('shares protected mutation rate limiting across app instances when the store is shared', async () => {
    const sharedStore = new InMemoryKeyValueStore();
    const appA = await createHardeningApp(async (instance) => {
      instance.addHook('preHandler', async (request) => {
        request.playerId = 'player-1';
      });
      instance.addHook('preHandler', createHttpRateLimitHook({ keyValueStore: sharedStore }));
      instance.post(
        '/actions/hot',
        {
          schema: {
            response: buildStandardResponseSchema(200),
          },
        },
        async () => ({
          ok: true,
        }),
      );
    });
    const appB = await createHardeningApp(async (instance) => {
      instance.addHook('preHandler', async (request) => {
        request.playerId = 'player-1';
      });
      instance.addHook('preHandler', createHttpRateLimitHook({ keyValueStore: sharedStore }));
      instance.post(
        '/actions/hot',
        {
          schema: {
            response: buildStandardResponseSchema(200),
          },
        },
        async () => ({
          ok: true,
        }),
      );
    });

    for (let index = 0; index < 60; index += 1) {
      const firstAppResponse = await appA.inject({
        method: 'POST',
        url: '/actions/hot',
      });
      const secondAppResponse = await appB.inject({
        method: 'POST',
        url: '/actions/hot',
      });

      expect(firstAppResponse.statusCode).toBe(200);
      expect(secondAppResponse.statusCode).toBe(200);
    }

    const rateLimitedResponse = await appB.inject({
      method: 'POST',
      url: '/actions/hot',
    });

    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.json()).toMatchObject({
      category: 'rate_limited',
    });
  });

  it('isolates shared rate limiting across vitest workers in test mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPoolId = process.env.VITEST_POOL_ID;
    const sharedStore = new InMemoryKeyValueStore();

    try {
      process.env.NODE_ENV = 'test';
      process.env.VITEST_POOL_ID = 'worker-a';

      const appA = await createHardeningApp(async (instance) => {
        instance.addHook('preHandler', createHttpRateLimitHook({ keyValueStore: sharedStore }));
        instance.post(
          '/auth/login',
          {
            schema: {
              body: loginBodySchema,
              response: buildStandardResponseSchema(200),
            },
          },
          async () => ({
            ok: true,
          }),
        );
      });

      for (let index = 0; index < 40; index += 1) {
        const response = await appA.inject({
          method: 'POST',
          payload: {
            email: 'test@example.com',
            password: 'correct-horse-battery-staple',
          },
          url: '/auth/login',
        });

        expect(response.statusCode).toBe(200);
      }

      const rateLimitedResponse = await appA.inject({
        method: 'POST',
        payload: {
          email: 'test@example.com',
          password: 'correct-horse-battery-staple',
        },
        url: '/auth/login',
      });

      expect(rateLimitedResponse.statusCode).toBe(429);

      process.env.VITEST_POOL_ID = 'worker-b';

      const appB = await createHardeningApp(async (instance) => {
        instance.addHook('preHandler', createHttpRateLimitHook({ keyValueStore: sharedStore }));
        instance.post(
          '/auth/login',
          {
            schema: {
              body: loginBodySchema,
              response: buildStandardResponseSchema(200),
            },
          },
          async () => ({
            ok: true,
          }),
        );
      });

      const response = await appB.inject({
        method: 'POST',
        payload: {
          email: 'test@example.com',
          password: 'correct-horse-battery-staple',
        },
        url: '/auth/login',
      });

      expect(response.statusCode).toBe(200);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalPoolId === undefined) {
        delete process.env.VITEST_POOL_ID;
      } else {
        process.env.VITEST_POOL_ID = originalPoolId;
      }
    }
  });
});

async function createHardeningApp(
  configure: (app: FastifyInstance) => Promise<void> | void,
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: HTTP_BODY_LIMIT_BYTES,
    logger: false,
    requestIdHeader: 'x-request-id',
  });

  installHttpInputHardening(app);
  installGlobalHttpErrorHandler(app);
  await configure(app);
  apps.push(app);
  return app;
}
