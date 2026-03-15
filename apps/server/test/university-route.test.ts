import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  RegionId,
  VocationType,
  type UniversityCourseCode,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createUniversityRoutes } from '../src/api/routes/university.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  UniversityService,
  type UniversityRepository,
} from '../src/services/university.js';
import type { PrisonSystemContract } from '../src/systems/PrisonSystem.js';

interface InMemoryTrainingGateRecord {
  claimedAt: Date | null;
  createdAt: Date;
  endsAt: Date;
  id: string;
  playerId: string;
  startedAt: Date;
}

interface InMemoryUniversityEnrollmentRecord {
  completedAt: Date | null;
  courseCode: UniversityCourseCode;
  createdAt: Date;
  endsAt: Date;
  id: string;
  playerId: string;
  startedAt: Date;
}

interface TestState {
  enrollmentsByPlayerId: Map<string, InMemoryUniversityEnrollmentRecord[]>;
  players: Map<string, AuthPlayerRecord>;
  trainingSessionsByPlayerId: Map<string, InMemoryTrainingGateRecord[]>;
}

class InMemoryAuthUniversityRepository implements AuthRepository, UniversityRepository {
  constructor(private readonly state: TestState) {}

  async completeFinishedEnrollments(playerId: string, now: Date): Promise<number> {
    let changed = 0;
    const enrollments = this.state.enrollmentsByPlayerId.get(playerId) ?? [];

    for (const enrollment of enrollments) {
      if (!enrollment.completedAt && enrollment.endsAt.getTime() <= now.getTime()) {
        enrollment.completedAt = enrollment.endsAt;
        changed += 1;
      }
    }

    return changed;
  }

  async createEnrollment(
    playerId: string,
    input: {
      costMoney: number;
      courseCode: UniversityCourseCode;
      endsAt: Date;
      startedAt: Date;
    },
  ) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    player.money = (Number.parseFloat(player.money) - input.costMoney).toFixed(2);

    const enrollment: InMemoryUniversityEnrollmentRecord = {
      completedAt: null,
      courseCode: input.courseCode,
      createdAt: input.startedAt,
      endsAt: input.endsAt,
      id: randomUUID(),
      playerId,
      startedAt: input.startedAt,
    };

    const enrollments = this.state.enrollmentsByPlayerId.get(playerId) ?? [];
    enrollments.push(enrollment);
    this.state.enrollmentsByPlayerId.set(playerId, enrollments);

    return {
      enrollment: { ...enrollment },
      player: { ...player },
    };
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
    this.state.trainingSessionsByPlayerId.set(player.id, []);
    this.state.enrollmentsByPlayerId.set(player.id, []);
    return { ...player };
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

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(playerId);
    return player ? { ...player } : null;
  }

  async getUnclaimedTrainingSession(playerId: string): Promise<InMemoryTrainingGateRecord | null> {
    const session = [...(this.state.trainingSessionsByPlayerId.get(playerId) ?? [])]
      .filter((entry) => entry.claimedAt === null)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];

    return session ? { ...session } : null;
  }

  async listEnrollments(playerId: string): Promise<InMemoryUniversityEnrollmentRecord[]> {
    return [...(this.state.enrollmentsByPlayerId.get(playerId) ?? [])]
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
      .map((entry) => ({ ...entry }));
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

class SequencedHospitalizationReader {
  constructor(private readonly statuses: boolean[]) {}

  async getHospitalizationStatus() {
    const isHospitalized = this.statuses.shift() ?? false;

    return {
      endsAt: isHospitalized ? new Date('2026-03-10T15:45:00.000Z').toISOString() : null,
      isHospitalized,
      reason: isHospitalized ? 'overdose' : null,
      remainingSeconds: isHospitalized ? 1800 : 0,
      startedAt: isHospitalized ? new Date('2026-03-10T15:15:00.000Z').toISOString() : null,
      trigger: isHospitalized ? 'max_addiction' : null,
    };
  }
}

class StaticPrisonSystem implements PrisonSystemContract {
  constructor(private readonly imprisoned: boolean) {}

  async getStatus() {
    return {
      endsAt: this.imprisoned ? new Date('2026-03-10T15:45:00.000Z').toISOString() : null,
      heatScore: 0,
      heatTier: 'frio' as const,
      isImprisoned: this.imprisoned,
      reason: this.imprisoned ? 'Teste' : null,
      remainingSeconds: this.imprisoned ? 1800 : 0,
      sentencedAt: this.imprisoned ? new Date('2026-03-10T15:00:00.000Z').toISOString() : null,
    };
  }
}

describe('university routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T15:00:00.000Z');
    state = {
      enrollmentsByPlayerId: new Map(),
      players: new Map(),
      trainingSessionsByPlayerId: new Map(),
    };
    app = await buildTestApp({
      now: () => now,
      state,
    });
  });

  afterEach(async () => {
    await app.server.close();
  });

  it('lists only the player vocation tree and starts the first course', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/university',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().courses).toHaveLength(4);
    expect(centerResponse.json().courses.map((entry: { code: string }) => entry.code)).toEqual([
      'mao_leve',
      'corrida_de_fuga',
      'olho_clinico',
      'rei_da_rua',
    ]);

    const enrollResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    expect(enrollResponse.statusCode).toBe(201);
    expect(enrollResponse.json().course).toMatchObject({
      code: 'mao_leve',
      isInProgress: true,
      isUnlocked: true,
    });
    expect(enrollResponse.json().player.resources.money).toBe(95000);
  });

  it('inflates university tuition by round day in the center and on enrollment', async () => {
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
      url: '/api/university',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().courses[0].moneyCost).toBe(35000);

    const enrollResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    expect(enrollResponse.statusCode).toBe(201);
    expect(enrollResponse.json().course.moneyCost).toBe(35000);
    expect(enrollResponse.json().player.resources.money).toBe(85000);
  });

  it('blocks enrollment when attribute requirements are unmet', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'corrida_de_fuga',
      },
      url: '/api/university/enrollments',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('forca 500');
  });

  it('blocks enrollment while there is an unclaimed training session', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = Array.from(state.players.keys())[0] as string;

    state.trainingSessionsByPlayerId.set(playerId, [
      {
        claimedAt: null,
        createdAt: now,
        endsAt: new Date(now.getTime() + 30 * 60 * 1000),
        id: randomUUID(),
        playerId,
        startedAt: now,
      },
    ]);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('treino');
  });

  it('auto-completes finished courses and exposes passive profile', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const enrollResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    expect(enrollResponse.statusCode).toBe(201);

    now = new Date('2026-03-11T16:00:00.000Z');

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/university',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().activeCourse).toBeNull();
    expect(centerResponse.json().completedCourseCodes).toContain('mao_leve');
    expect(centerResponse.json().passiveProfile.crime.soloSuccessMultiplier).toBe(1.1);
    expect(
      centerResponse.json().courses.find((entry: { code: string }) => entry.code === 'mao_leve'),
    ).toMatchObject({
      completedAt: '2026-03-11T15:00:00.000Z',
      isCompleted: true,
      isInProgress: false,
    });
  });

  it('revalidates hospitalization immediately before enrolling in a course', async () => {
    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      overdoseSystem: new SequencedHospitalizationReader([false, true]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    const playerId = Array.from(state.players.keys())[0] as string;

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('hospitalizado');
    expect(state.enrollmentsByPlayerId.get(playerId) ?? []).toHaveLength(0);
  });

  it('blocks enrollment when the player is imprisoned', async () => {
    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      prisonSystem: new StaticPrisonSystem(true),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        courseCode: 'mao_leve',
      },
      url: '/api/university/enrollments',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('preso');
  });
});

async function buildTestApp(input: {
  inflationMultiplier?: number;
  now: () => Date;
  overdoseSystem?: ConstructorParameters<typeof UniversityService>[0]['overdoseSystem'];
  prisonSystem?: ConstructorParameters<typeof UniversityService>[0]['prisonSystem'];
  state: TestState;
}) {
  const server = Fastify();
  const repository = new InMemoryAuthUniversityRepository(input.state);
  const keyValueStore = new InMemoryKeyValueStore();
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const universityService = new UniversityService({
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
    overdoseSystem: input.overdoseSystem,
    prisonSystem: input.prisonSystem,
    repository,
  });

  await server.register(async (api) => {
    await api.register(createAuthRoutes({ authService }), {
      prefix: '/api',
    });

    await api.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      await protectedRoutes.register(createUniversityRoutes({ universityService }), {
        prefix: '/api',
      });
    });
  });

  await server.ready();

  return {
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
