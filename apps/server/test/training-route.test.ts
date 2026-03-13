import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, RegionId, VocationType } from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createTrainingRoutes } from '../src/api/routes/training.js';
import { AuthService, type AuthPlayerRecord, type AuthRepository, type KeyValueStore } from '../src/services/auth.js';
import {
  TrainingService,
  type TrainingRepository,
} from '../src/services/training.js';
import { buildHospitalizationKey } from '../src/systems/OverdoseSystem.js';

interface InMemoryTrainingSessionRecord {
  carismaGain: number;
  claimedAt: Date | null;
  costMoney: string;
  costStamina: number;
  createdAt: Date;
  diminishingMultiplier: string;
  endsAt: Date;
  forcaGain: number;
  id: string;
  inteligenciaGain: number;
  playerId: string;
  resistenciaGain: number;
  startedAt: Date;
  streakIndex: number;
  type: 'advanced' | 'basic' | 'intensive';
}

interface TestState {
  players: Map<string, AuthPlayerRecord>;
  sessionsByPlayerId: Map<string, InMemoryTrainingSessionRecord[]>;
}

class InMemoryAuthTrainingRepository implements AuthRepository, TrainingRepository {
  constructor(private readonly state: TestState) {}

  async claimTrainingSession(playerId: string, sessionId: string, claimedAt: Date) {
    const player = this.state.players.get(playerId);
    const sessions = this.state.sessionsByPlayerId.get(playerId) ?? [];
    const session = sessions.find((entry) => entry.id === sessionId && entry.claimedAt === null);

    if (!player || !session) {
      return null;
    }

    session.claimedAt = claimedAt;
    player.forca += session.forcaGain;
    player.inteligencia += session.inteligenciaGain;
    player.resistencia += session.resistenciaGain;
    player.carisma += session.carismaGain;

    return {
      player: { ...player },
      session: { ...session },
    };
  }

  async countClaimedSessions(playerId: string, type: 'advanced' | 'basic' | 'intensive'): Promise<number> {
    return (this.state.sessionsByPlayerId.get(playerId) ?? []).filter(
      (session) => session.type === type && session.claimedAt !== null,
    ).length;
  }

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player: AuthPlayerRecord = {
      addiction: 0,
      appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
      bankMoney: '0',
      carisma: 10,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 18000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 30,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: '120000.00',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 100,
      positionY: 100,
      regionId: RegionId.Centro,
      resistencia: 20,
      stamina: 100,
      vocation: VocationType.Cria,
    };

    this.state.players.set(player.id, player);
    this.state.sessionsByPlayerId.set(player.id, []);
    return { ...player };
  }

  async createTrainingSession(
    playerId: string,
    input: {
      costMoney: number;
      costStamina: number;
      diminishingMultiplier: number;
      endsAt: Date;
      gains: { carisma: number; forca: number; inteligencia: number; resistencia: number };
      startedAt: Date;
      streakIndex: number;
      type: 'advanced' | 'basic' | 'intensive';
    },
  ) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    player.money = (Number.parseFloat(player.money) - input.costMoney).toFixed(2);
    player.stamina -= input.costStamina;
    const session: InMemoryTrainingSessionRecord = {
      carismaGain: input.gains.carisma,
      claimedAt: null,
      costMoney: input.costMoney.toFixed(2),
      costStamina: input.costStamina,
      createdAt: input.startedAt,
      diminishingMultiplier: input.diminishingMultiplier.toFixed(4),
      endsAt: input.endsAt,
      forcaGain: input.gains.forca,
      id: randomUUID(),
      inteligenciaGain: input.gains.inteligencia,
      playerId,
      resistenciaGain: input.gains.resistencia,
      startedAt: input.startedAt,
      streakIndex: input.streakIndex,
      type: input.type,
    };

    const sessions = this.state.sessionsByPlayerId.get(playerId) ?? [];
    sessions.push(session);
    this.state.sessionsByPlayerId.set(playerId, sessions);

    return {
      player: { ...player },
      session: { ...session },
    };
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async getLatestClaimedTrainingSession(playerId: string): Promise<InMemoryTrainingSessionRecord | null> {
    const claimed = (this.state.sessionsByPlayerId.get(playerId) ?? [])
      .filter((session) => session.claimedAt !== null)
      .sort((left, right) => right.endsAt.getTime() - left.endsAt.getTime());

    return claimed[0] ? { ...claimed[0] } : null;
  }

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(playerId);
    return player ? { ...player } : null;
  }

  async getTrainingSession(
    playerId: string,
    sessionId: string,
  ): Promise<InMemoryTrainingSessionRecord | null> {
    const session = (this.state.sessionsByPlayerId.get(playerId) ?? []).find(
      (entry) => entry.id === sessionId,
    );

    return session ? { ...session } : null;
  }

  async getUnclaimedTrainingSession(playerId: string): Promise<InMemoryTrainingSessionRecord | null> {
    const session = [...(this.state.sessionsByPlayerId.get(playerId) ?? [])]
      .filter((entry) => entry.claimedAt === null)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];

    return session ? { ...session } : null;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async increment(key: string): Promise<number> {
    const nextValue = Number.parseInt(this.values.get(key) ?? '0', 10) + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('training routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T15:00:00.000Z');
    state = {
      players: new Map(),
      sessionsByPlayerId: new Map(),
    };
    app = await buildTestApp({
      now: () => now,
      state,
    });
  });

  afterEach(async () => {
    await app.server.close();
  });

  it('starts and claims a basic training session with real timer and stat gains', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const startResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    expect(startResponse.statusCode).toBe(201);
    expect(startResponse.json().session.projectedGains).toMatchObject({
      carisma: 9,
      forca: 24,
      inteligencia: 9,
      resistencia: 18,
    });
    expect(startResponse.json().player.resources.stamina).toBe(85);
    expect(startResponse.json().player.resources.money).toBe(119000);

    const sessionId = startResponse.json().session.id as string;

    now = new Date('2026-03-10T15:31:00.000Z');

    const claimResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: `/api/training-center/sessions/${sessionId}/claim`,
    });

    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json().appliedGains).toMatchObject({
      carisma: 9,
      forca: 24,
      inteligencia: 9,
      resistencia: 18,
    });
    expect(claimResponse.json().player.attributes).toMatchObject({
      carisma: 19,
      forca: 54,
      inteligencia: 19,
      resistencia: 38,
    });
  });

  it('inflates NPC training prices by round day in the center and at session start', async () => {
    await app.server.close();
    app = await buildTestApp({
      inflationMultiplier: 1.4,
      now: () => now,
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/training-center',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().catalog[0].moneyCost).toBe(1400);

    const startResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    expect(startResponse.statusCode).toBe(201);
    expect(startResponse.json().session.costMoney).toBe(1400);
    expect(startResponse.json().player.resources.money).toBe(118600);
  });

  it('keeps advanced training locked until thirty basic sessions are completed', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'advanced',
      },
      url: '/api/training-center/sessions',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('30 treinos basicos');
  });

  it('applies diminishing returns on consecutive trainings and resets after one hour of rest', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const firstStart = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    const firstSessionId = firstStart.json().session.id as string;
    now = new Date('2026-03-10T15:35:00.000Z');

    await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: `/api/training-center/sessions/${firstSessionId}/claim`,
    });

    now = new Date('2026-03-10T15:40:00.000Z');

    const secondStart = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    expect(secondStart.statusCode).toBe(201);
    expect(secondStart.json().session.diminishingMultiplier).toBe(0.9);
    expect(secondStart.json().session.projectedGains).toMatchObject({
      carisma: 8,
      forca: 22,
      inteligencia: 8,
      resistencia: 16,
    });

    const secondSessionId = secondStart.json().session.id as string;
    now = new Date('2026-03-10T16:15:00.000Z');

    await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: `/api/training-center/sessions/${secondSessionId}/claim`,
    });

    now = new Date('2026-03-10T17:20:00.000Z');

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/training-center',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().nextDiminishingMultiplier).toBe(1);
    expect(centerResponse.json().catalog[0].projectedGains).toMatchObject({
      carisma: 9,
      forca: 24,
      inteligencia: 9,
      resistencia: 18,
    });
  });

  it('blocks training while the player is hospitalized', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = Array.from(state.players.keys())[0] as string;

    await app.keyValueStore.set(
      buildHospitalizationKey(playerId),
      JSON.stringify({
        endsAt: now.getTime() + 30 * 60 * 1000,
        reason: 'overdose',
        startedAt: now.getTime(),
        trigger: 'max_addiction',
      }),
    );

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('hospitalizado');
  });
});

async function buildTestApp(input: {
  inflationMultiplier?: number;
  now: () => Date;
  state: TestState;
}) {
  const server = Fastify();
  const repository = new InMemoryAuthTrainingRepository(input.state);
  const keyValueStore = new InMemoryKeyValueStore();
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const trainingService = new TrainingService({
    inflationReader:
      input.inflationMultiplier !== undefined
        ? {
            getProfile: async () => ({
              currentRoundDay: 120,
              moneyMultiplier: input.inflationMultiplier ?? 1,
              roundId: 'round-pre-alpha',
            }),
          }
        : undefined,
    keyValueStore,
    now: input.now,
    repository,
  });

  await server.register(async (api) => {
    await api.register(createAuthRoutes({ authService }), {
      prefix: '/api',
    });

    await api.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      await protectedRoutes.register(createTrainingRoutes({ trainingService }), {
        prefix: '/api',
      });
    });
  });

  await server.ready();

  return {
    keyValueStore,
    server,
  };
}

async function registerAndExtractToken(server: Awaited<ReturnType<typeof Fastify>>) {
  const response = await server.inject({
    method: 'POST',
    payload: {
      email: `player-${randomUUID()}@csrio.test`,
      nickname: `player_${Math.floor(Math.random() * 100000)}`,
      password: '12345678',
    },
    url: '/api/auth/register',
  });

  expect(response.statusCode).toBe(201);
  return response.json().accessToken as string;
}
