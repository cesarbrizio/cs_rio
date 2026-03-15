import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { DUPLICATE_ACTION_MESSAGE } from '../src/api/action-idempotency.js';
import type { KeyValueStore } from '../src/services/auth.js';
import type { CrimeServiceContract } from '../src/services/crime.js';
import type { HospitalServiceContract } from '../src/services/hospital.js';
import type { MarketServiceContract } from '../src/services/market.js';
import type { PrisonServiceContract } from '../src/services/prison.js';
import type { TerritoryServiceContract } from '../src/services/territory.js';

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

describe('route action idempotency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('protege tentativa de crime contra double tap', async () => {
    const attemptCrime = vi.fn(async () => ({ action: 'crime' }));
    const app = await createAppWithToken({
      crimeService: {
        attemptCrime,
      } as unknown as CrimeServiceContract,
    });

    try {
      const first = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/crimes/crime-1/attempt',
      });

      const second = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/crimes/crime-1/attempt',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toBe(DUPLICATE_ACTION_MESSAGE);
      expect(attemptCrime).toHaveBeenCalledTimes(1);
    } finally {
      await app.server.close();
    }
  });

  it('protege criacao de ordem no mercado contra reenvio identico', async () => {
    const createOrder = vi.fn(async () => ({ order: { id: 'order-1' } }));
    const app = await createAppWithToken({
      marketService: {
        createOrder,
      } as unknown as MarketServiceContract,
    });

    try {
      const payload = {
        itemId: 'drug-1',
        itemType: 'drug',
        pricePerUnit: 65,
        quantity: 1,
        side: 'buy',
      };

      const first = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        payload,
        url: '/api/market/orders',
      });

      const second = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        payload,
        url: '/api/market/orders',
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toBe(DUPLICATE_ACTION_MESSAGE);
      expect(createOrder).toHaveBeenCalledTimes(1);
    } finally {
      await app.server.close();
    }
  });

  it('protege tratamento do hospital contra retry imediato', async () => {
    const applyTreatment = vi.fn(async () => ({ action: 'treatment' }));
    const app = await createAppWithToken({
      hospitalService: {
        applyTreatment,
      } as unknown as HospitalServiceContract,
    });

    try {
      const first = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/hospital/treatment',
      });

      const second = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/hospital/treatment',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toBe(DUPLICATE_ACTION_MESSAGE);
      expect(applyTreatment).toHaveBeenCalledTimes(1);
    } finally {
      await app.server.close();
    }
  });

  it('protege suborno da prisao contra double tap', async () => {
    const attemptBribe = vi.fn(async () => ({ method: 'bribe' }));
    const app = await createAppWithToken({
      prisonService: {
        attemptBribe,
      } as unknown as PrisonServiceContract,
    });

    try {
      const first = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/prison/bribe',
      });

      const second = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/prison/bribe',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toBe(DUPLICATE_ACTION_MESSAGE);
      expect(attemptBribe).toHaveBeenCalledTimes(1);
    } finally {
      await app.server.close();
    }
  });

  it('protege declaracao de guerra no territorio contra repeticao imediata', async () => {
    const declareFactionWar = vi.fn(async () => ({ war: { status: 'declared' } }));
    const app = await createAppWithToken({
      territoryService: {
        declareFactionWar,
      } as unknown as TerritoryServiceContract,
    });

    try {
      const first = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/territory/favelas/favela-1/war/declare',
      });

      const second = await app.server.inject({
        headers: {
          authorization: `Bearer ${app.accessToken}`,
        },
        method: 'POST',
        url: '/api/territory/favelas/favela-1/war/declare',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toBe(DUPLICATE_ACTION_MESSAGE);
      expect(declareFactionWar).toHaveBeenCalledTimes(1);
    } finally {
      await app.server.close();
    }
  });
});

async function createAppWithToken(overrides: {
  crimeService?: CrimeServiceContract;
  hospitalService?: HospitalServiceContract;
  marketService?: MarketServiceContract;
  prisonService?: PrisonServiceContract;
  territoryService?: TerritoryServiceContract;
}) {
  const server = await createApp({
    ...overrides,
    keyValueStore: new InMemoryKeyValueStore(),
  });
  await server.ready();

  const accessToken = await registerPlayer(server);

  return {
    accessToken,
    server,
  };
}

async function registerPlayer(app: Awaited<ReturnType<typeof createApp>>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    payload: {
      email: `player-${randomUUID()}@csrio.test`,
      nickname: `P${randomUUID().slice(0, 8)}`,
      password: 'segredo123',
    },
    url: '/api/auth/register',
  });

  expect(response.statusCode).toBe(201);
  return response.json().accessToken;
}
