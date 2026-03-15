import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, VocationType } from '@cs-rio/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import {
  factionMembers,
  factions,
  playerBankDailyDeposits,
  playerBankLedger,
  players,
} from '../src/db/schema.js';
import type { KeyValueStore } from '../src/services/auth.js';
import { HospitalService } from '../src/services/hospital.js';
import {
  buildPlayerProfileCacheKey,
  invalidatePlayerProfileCache,
  invalidatePlayerProfileCaches,
} from '../src/services/player-cache.js';
import { RedisKeyValueStore } from '../src/services/auth.js';

class TrackingKeyValueStore implements Pick<KeyValueStore, 'delete'> {
  readonly deletedKeys: string[] = [];

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }
}

describe('player cache helpers', () => {
  it('invalidates one profile key directly', async () => {
    const store = new TrackingKeyValueStore();

    await invalidatePlayerProfileCache(store, 'player-1');

    expect(store.deletedKeys).toEqual([buildPlayerProfileCacheKey('player-1')]);
  });

  it('invalidates profile keys in batch with deduplication and blank filtering', async () => {
    const store = new TrackingKeyValueStore();

    await invalidatePlayerProfileCaches(store, ['player-1', 'player-2', 'player-1', '', null, undefined]);

    expect(store.deletedKeys).toEqual([
      buildPlayerProfileCacheKey('player-1'),
      buildPlayerProfileCacheKey('player-2'),
    ]);
  });

  it('is a no-op when the store has no delete capability', async () => {
    await expect(
      invalidatePlayerProfileCache(
        {
          get: async () => null,
          increment: async () => 0,
          set: async () => undefined,
        },
        'player-1',
      ),
    ).resolves.toBeUndefined();

    await expect(invalidatePlayerProfileCaches(undefined, ['player-1'])).resolves.toBeUndefined();
  });
});

describe('player profile cache invalidation', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let customHospitalService: HospitalService | null;
  const createdFactionIds: string[] = [];
  const createdPlayerIds: string[] = [];

  beforeEach(async () => {
    customHospitalService = new HospitalService({
      inflationReader: {
        getProfile: async () => ({
          currentRoundDay: 1,
          moneyMultiplier: 1,
          roundId: null,
        }),
      },
    });
    app = await createApp({
      hospitalService: customHospitalService,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();

    if (createdPlayerIds.length > 0) {
      await db.delete(factionMembers).where(inArray(factionMembers.playerId, createdPlayerIds));
      await db.delete(playerBankDailyDeposits).where(inArray(playerBankDailyDeposits.playerId, createdPlayerIds));
      await db.delete(playerBankLedger).where(inArray(playerBankLedger.playerId, createdPlayerIds));
      await db.delete(players).where(inArray(players.id, createdPlayerIds));
      createdPlayerIds.length = 0;
    }

    if (createdFactionIds.length > 0) {
      await db.delete(factions).where(inArray(factions.id, createdFactionIds));
      createdFactionIds.length = 0;
    }

    if (customHospitalService) {
      await customHospitalService.close?.();
      customHospitalService = null;
    }
  });

  it('refreshes /players/me immediately after a bank mutation', async () => {
    const session = await registerAndCreateCharacter(app);
    await updatePlayerState(session.player.id, {
      money: '7000.00',
    });
    await clearProfileCache(session.player.id);

    const firstProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(firstProfileResponse.statusCode).toBe(200);
    expect(firstProfileResponse.json()).toMatchObject({
      resources: {
        bankMoney: 0,
        money: 7000,
      },
    });

    const depositResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 5000,
      },
      url: '/api/bank/deposit',
    });

    expect(depositResponse.statusCode).toBe(200);

    const refreshedProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(refreshedProfileResponse.statusCode).toBe(200);
    expect(refreshedProfileResponse.json()).toMatchObject({
      resources: {
        bankMoney: 5000,
        money: 2000,
      },
    });
  });

  it('refreshes /players/me immediately after faction membership changes', async () => {
    const session = await registerAndCreateCharacter(app);

    const firstProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(firstProfileResponse.statusCode).toBe(200);
    expect(firstProfileResponse.json().faction).toBeNull();

    const createFactionResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: `C${randomUUID().slice(0, 3)}`,
        description: 'Faccao de teste de cache',
        name: `Cache ${randomUUID().slice(0, 6)}`,
      },
      url: '/api/factions',
    });

    expect(createFactionResponse.statusCode).toBe(201);
    createdFactionIds.push(createFactionResponse.json().faction.id);

    const refreshedProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(refreshedProfileResponse.statusCode).toBe(200);
    expect(refreshedProfileResponse.json()).toMatchObject({
      faction: {
        id: createFactionResponse.json().faction.id,
        rank: 'patrao',
      },
    });
  });

  it('refreshes /players/me immediately after hospital treatment', async () => {
    const session = await registerAndCreateCharacter(app);
    await updatePlayerState(session.player.id, {
      hp: 61,
      money: '7000.00',
    });
    await clearProfileCache(session.player.id);

    const firstProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(firstProfileResponse.statusCode).toBe(200);
    expect(firstProfileResponse.json()).toMatchObject({
      resources: {
        hp: 61,
        money: 7000,
      },
    });

    const treatmentResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/treatment',
    });

    expect(treatmentResponse.statusCode).toBe(200);

    const refreshedProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(refreshedProfileResponse.statusCode).toBe(200);
    expect(refreshedProfileResponse.json()).toMatchObject({
      resources: {
        hp: 100,
        money: 5000,
      },
    });
  });

  async function registerAndCreateCharacter(
    fastifyApp: Awaited<ReturnType<typeof createApp>>,
  ): Promise<{ accessToken: string; player: { id: string } }> {
    const registerResponse = await fastifyApp.inject({
      method: 'POST',
      payload: {
        email: `cache-${randomUUID()}@csrio.test`,
        nickname: `C${randomUUID().replace(/-/g, '').slice(0, 10)}`,
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();

    const createResponse = await fastifyApp.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createResponse.statusCode).toBe(201);
    createdPlayerIds.push(session.player.id);

    return session;
  }

  async function updatePlayerState(
    playerId: string,
    input: Partial<{
      hp: number;
      money: string;
    }>,
  ): Promise<void> {
    await db.update(players).set(input).where(eq(players.id, playerId));
  }

  async function clearProfileCache(playerId: string): Promise<void> {
    const keyValueStore = new RedisKeyValueStore(env.redisUrl);

    try {
      await invalidatePlayerProfileCache(keyValueStore, playerId);
    } finally {
      await keyValueStore.close?.();
    }
  }
});
