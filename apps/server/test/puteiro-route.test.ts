import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type GpType,
  type PuteiroHireInput,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createPuteiroRoutes } from '../src/api/routes/puteiros.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  PuteiroService,
  type PuteiroRepository,
} from '../src/services/puteiro.js';

interface InMemoryPuteiroPropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  suspended: boolean;
}

interface InMemoryPuteiroOperationRecord {
  cashBalance: number;
  factionCommissionTotal: number;
  grossRevenueTotal: number;
  lastCollectedAt: Date | null;
  lastRevenueAt: Date;
  totalDeaths: number;
  totalDstIncidents: number;
  totalEscapes: number;
}

interface InMemoryPuteiroWorkerRecord {
  dstRecoversAt: Date | null;
  hasDst: boolean;
  id: string;
  lastIncidentAt: Date | null;
  purchasedAt: Date;
  status: 'active' | 'deceased' | 'escaped';
  type: GpType;
}

interface InMemoryEventRecord {
  endsAt: Date;
  eventType:
    | 'ano_novo_copa'
    | 'blitz_pm'
    | 'bonecas_china'
    | 'carnaval'
    | 'operacao_policial'
    | 'ressaca_baile';
  regionId: RegionId | null;
  startedAt: Date;
}

interface TestState {
  defaultFactionId: string | null;
  events: InMemoryEventRecord[];
  factionBankMoney: Map<string, number>;
  favelas: Array<{
    id: string;
    population: number;
    regionId: RegionId;
  }>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, InMemoryPuteiroPropertyRecord[]>;
  puteiroOperationsByPropertyId: Map<string, InMemoryPuteiroOperationRecord>;
  puteiroWorkersByPropertyId: Map<string, InMemoryPuteiroWorkerRecord[]>;
  regions: Array<{
    densityIndex: number;
    id: RegionId;
    operationCostMultiplier: number;
    policePressure: number;
    wealthIndex: number;
  }>;
}

class InMemoryAuthPuteiroRepository implements AuthRepository, PuteiroRepository {
  constructor(private readonly state: TestState) {}

  async applyPuteiroState(
    playerId: string,
    input: {
      cashBalance: number;
      factionCommissionDelta: number;
      factionCommissionTotal: number;
      factionId: string | null;
      grossRevenueTotal: number;
      lastRevenueAt: Date;
      playerMoneySpentOnMaintenance: number;
      propertyId: string;
      propertyLastMaintenanceAt: Date;
      propertySuspended: boolean;
      totalDeaths: number;
      totalDstIncidents: number;
      totalEscapes: number;
      workerStates: Array<{
        dstRecoversAt: Date | null;
        hasDst: boolean;
        id: string;
        lastIncidentAt: Date | null;
        status: 'active' | 'deceased' | 'escaped';
      }>;
    },
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, input.propertyId);

    if (!player || !property) {
      return false;
    }

    player.money = String(
      roundMoney(Number.parseFloat(player.money) - input.playerMoneySpentOnMaintenance),
    );
    property.lastMaintenanceAt = input.propertyLastMaintenanceAt;
    property.suspended = input.propertySuspended;

    if (input.factionCommissionDelta > 0 && input.factionId) {
      const current = this.state.factionBankMoney.get(input.factionId) ?? 0;
      this.state.factionBankMoney.set(input.factionId, roundMoney(current + input.factionCommissionDelta));
    }

    this.state.puteiroOperationsByPropertyId.set(input.propertyId, {
      cashBalance: input.cashBalance,
      factionCommissionTotal: input.factionCommissionTotal,
      grossRevenueTotal: input.grossRevenueTotal,
      lastCollectedAt: this.state.puteiroOperationsByPropertyId.get(input.propertyId)?.lastCollectedAt ?? null,
      lastRevenueAt: input.lastRevenueAt,
      totalDeaths: input.totalDeaths,
      totalDstIncidents: input.totalDstIncidents,
      totalEscapes: input.totalEscapes,
    });

    const workers = this.state.puteiroWorkersByPropertyId.get(input.propertyId) ?? [];
    const stateById = new Map(input.workerStates.map((worker) => [worker.id, worker]));

    for (const worker of workers) {
      const nextState = stateById.get(worker.id);

      if (!nextState) {
        continue;
      }

      worker.dstRecoversAt = nextState.dstRecoversAt;
      worker.hasDst = nextState.hasDst;
      worker.lastIncidentAt = nextState.lastIncidentAt;
      worker.status = nextState.status;
    }

    return true;
  }

  async collectCash(playerId: string, propertyId: string) {
    const player = this.state.players.get(playerId);
    const operation = this.state.puteiroOperationsByPropertyId.get(propertyId);

    if (!player || !operation || operation.cashBalance <= 0) {
      return null;
    }

    const collectedAmount = roundMoney(operation.cashBalance);
    const playerMoneyAfterCollect = roundMoney(Number.parseFloat(player.money) + collectedAmount);

    player.money = String(playerMoneyAfterCollect);
    operation.cashBalance = 0;
    operation.lastCollectedAt = new Date('2026-03-10T00:00:00.000Z');

    return {
      collectedAmount,
      playerMoneyAfterCollect,
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
      carisma: 60,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 15000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 14,
      hp: 100,
      id: randomUUID(),
      inteligencia: 28,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: '350000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 12,
      positionY: 9,
      regionId: RegionId.ZonaSul,
      resistencia: 18,
      stamina: 100,
      vocation: VocationType.Gerente,
    };

    this.state.players.set(player.id, player);
    this.state.propertiesByPlayerId.set(player.id, []);
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

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      factionId: this.state.defaultFactionId,
      id: player.id,
      money: roundMoney(Number.parseFloat(player.money)),
    };
  }

  async getPuteiro(playerId: string, propertyId: string) {
    const puteiros = await this.listPuteiros(playerId);
    return puteiros.find((entry) => entry.id === propertyId) ?? null;
  }

  async hireGps(
    playerId: string,
    propertyId: string,
    template: {
      purchasePrice: number;
      type: GpType;
    },
    quantity: number,
    purchasedAt: Date,
  ) {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, propertyId);

    if (!player || !property) {
      return null;
    }

    const totalPurchaseCost = roundMoney(template.purchasePrice * quantity);
    const playerMoneyAfterPurchase = roundMoney(Number.parseFloat(player.money) - totalPurchaseCost);
    player.money = String(playerMoneyAfterPurchase);

    const workers = this.state.puteiroWorkersByPropertyId.get(propertyId) ?? [];
    const hiredWorkers = Array.from({ length: quantity }, () => ({
      dstRecoversAt: null,
      hasDst: false,
      id: randomUUID(),
      lastIncidentAt: null,
      purchasedAt,
      status: 'active' as const,
      type: template.type,
    }));
    workers.push(...hiredWorkers);
    this.state.puteiroWorkersByPropertyId.set(propertyId, workers);

    return {
      hiredWorkers,
      playerMoneyAfterPurchase,
      totalPurchaseCost,
    };
  }

  async listActiveEvents(regionId: RegionId, now: Date) {
    return this.state.events.filter(
      (event) =>
        event.startedAt.getTime() <= now.getTime() &&
        event.endsAt.getTime() >= now.getTime() &&
        (!event.regionId || event.regionId === regionId),
    );
  }

  async listPuteiros(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties.map((property) => {
      const region = this.state.regions.find((entry) => entry.id === property.regionId);
      const favela = this.state.favelas.find((entry) => entry.id === property.favelaId);
      const operation = this.state.puteiroOperationsByPropertyId.get(property.id);
      const workers = this.state.puteiroWorkersByPropertyId.get(property.id) ?? [];

      if (!region) {
        throw new Error(`Regiao ausente no teste: ${property.regionId}`);
      }

      return {
        cashBalance: operation?.cashBalance ?? 0,
        createdAt: property.createdAt,
        densityIndex: region.densityIndex,
        factionCommissionTotal: operation?.factionCommissionTotal ?? 0,
        favelaId: property.favelaId,
        favelaPopulation: favela?.population ?? null,
        grossRevenueTotal: operation?.grossRevenueTotal ?? 0,
        id: property.id,
        lastCollectedAt: operation?.lastCollectedAt ?? null,
        lastMaintenanceAt: property.lastMaintenanceAt,
        lastRevenueAt: operation?.lastRevenueAt ?? property.createdAt,
        level: property.level,
        operationCostMultiplier: region.operationCostMultiplier,
        policePressure: region.policePressure,
        regionId: property.regionId,
        soldierRoster: [],
        suspended: property.suspended,
        totalDeaths: operation?.totalDeaths ?? 0,
        totalDstIncidents: operation?.totalDstIncidents ?? 0,
        totalEscapes: operation?.totalEscapes ?? 0,
        wealthIndex: region.wealthIndex,
        workers: workers.map((worker) => ({ ...worker })),
      };
    });
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  private async getPropertyRecord(playerId: string, propertyId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];
    return properties.find((property) => property.id === propertyId) ?? null;
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

describe('puteiro routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let randomProvider: () => number;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T12:00:00.000Z');
    randomProvider = () => 0.999;
    state = buildState();
    app = await buildTestApp({
      now: () => now,
      random: () => randomProvider(),
      state,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('hires GPs, generates passive revenue and collects the cashbox', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantPuteiroProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });

    const hireResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 2,
        type: 'premium',
      } satisfies PuteiroHireInput,
      url: `/api/puteiros/${propertyId}/gps`,
    });

    expect(hireResponse.statusCode).toBe(200);
    expect(hireResponse.json().hiredGps).toHaveLength(2);
    expect(hireResponse.json().totalPurchaseCost).toBe(160000);

    now = new Date('2026-03-10T18:00:00.000Z');
    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/puteiros',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().puteiros).toHaveLength(1);
    expect(listResponse.json().puteiros[0].status).toBe('active');
    expect(listResponse.json().puteiros[0].economics.activeGps).toBe(2);
    expect(listResponse.json().puteiros[0].cashbox.availableToCollect).toBeGreaterThan(0);
    expect(listResponse.json().puteiros[0].incidents.totalEscapes).toBe(0);
    expect(listResponse.json().puteiros[0].incidents.totalDeaths).toBe(0);
    expect(state.factionBankMoney.get('faction-cv') ?? 0).toBeGreaterThan(0);

    const collectResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: `/api/puteiros/${propertyId}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json().collectedAmount).toBeGreaterThan(0);
    expect(collectResponse.json().playerMoneyAfterCollect).toBeGreaterThan(190000);
    expect(collectResponse.json().puteiro.cashbox.availableToCollect).toBe(0);
  });

  it('applies deterministic escape, death and DST incidents during passive operation', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantPuteiroProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });

    const hireResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 3,
        type: 'novinha',
      } satisfies PuteiroHireInput,
      url: `/api/puteiros/${propertyId}/gps`,
    });

    expect(hireResponse.statusCode).toBe(200);

    randomProvider = createRandomSequence([
      0.9,
      0.9,
      0.0001,
      0.0001,
      0.9,
      0.0001,
    ]);
    now = new Date('2026-03-10T15:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/puteiros',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().puteiros[0].economics.activeGps).toBe(1);
    expect(listResponse.json().puteiros[0].incidents.totalDstIncidents).toBe(1);
    expect(listResponse.json().puteiros[0].incidents.totalEscapes).toBe(1);
    expect(listResponse.json().puteiros[0].incidents.totalDeaths).toBe(1);
    expect(listResponse.json().puteiros[0].roster.some((worker: { hasDst: boolean; status: string }) => worker.status === 'active' && worker.hasDst)).toBe(true);
    expect(listResponse.json().puteiros[0].roster.some((worker: { status: string }) => worker.status === 'escaped')).toBe(true);
    expect(listResponse.json().puteiros[0].roster.some((worker: { status: string }) => worker.status === 'deceased')).toBe(true);
  });

  it('blocks passive operation when maintenance is overdue and the player cannot pay', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantPuteiroProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-centro',
      regionId: RegionId.Centro,
    });

    const hireResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 1,
        type: 'novinha',
      } satisfies PuteiroHireInput,
      url: `/api/puteiros/${propertyId}/gps`,
    });

    expect(hireResponse.statusCode).toBe(200);
    const playerRecord = state.players.get(player.playerId);

    if (!playerRecord) {
      throw new Error('Jogador de teste nao encontrado.');
    }

    playerRecord.money = '200';
    now = new Date('2026-03-13T12:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/puteiros',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().puteiros[0].status).toBe('maintenance_blocked');
    expect(listResponse.json().puteiros[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().puteiros[0].cashbox.availableToCollect).toBe(0);
  });
});

async function buildTestApp(input: {
  now: () => Date;
  random: () => number;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthPuteiroRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const puteiroService = new PuteiroService({
    keyValueStore,
    now: input.now,
    random: input.random,
    repository,
  });
  const server = Fastify();

  await server.register(
    async (api) => {
      await api.register(createAuthRoutes({ authService }));
      await api.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
        await protectedRoutes.register(createPuteiroRoutes({ puteiroService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await puteiroService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    defaultFactionId: 'faction-cv',
    events: [
      {
        endsAt: new Date('2026-03-10T23:59:59.000Z'),
        eventType: 'carnaval',
        regionId: RegionId.ZonaSul,
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        endsAt: new Date('2026-03-10T23:59:59.000Z'),
        eventType: 'bonecas_china',
        regionId: RegionId.ZonaSul,
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
    ],
    factionBankMoney: new Map([['faction-cv', 0]]),
    favelas: [
      {
        id: 'favela-zona-sul',
        population: 52000,
        regionId: RegionId.ZonaSul,
      },
      {
        id: 'favela-centro',
        population: 36000,
        regionId: RegionId.Centro,
      },
    ],
    players: new Map(),
    propertiesByPlayerId: new Map(),
    puteiroOperationsByPropertyId: new Map(),
    puteiroWorkersByPropertyId: new Map(),
    regions: [
      {
        densityIndex: 88,
        id: RegionId.ZonaSul,
        operationCostMultiplier: 1.08,
        policePressure: 68,
        wealthIndex: 96,
      },
      {
        densityIndex: 72,
        id: RegionId.Centro,
        operationCostMultiplier: 1.12,
        policePressure: 75,
        wealthIndex: 66,
      },
    ],
  };
}

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index];

    if (value === undefined) {
      return 0.999;
    }

    index += 1;
    return value;
  };
}

function grantPuteiroProperty(
  state: TestState,
  playerId: string,
  input: {
    createdAt: Date;
    favelaId: string;
    lastMaintenanceAt?: Date;
    regionId: RegionId;
  },
) {
  const propertyId = randomUUID();
  const properties = state.propertiesByPlayerId.get(playerId) ?? [];

  properties.push({
    createdAt: input.createdAt,
    favelaId: input.favelaId,
    id: propertyId,
    lastMaintenanceAt: input.lastMaintenanceAt ?? input.createdAt,
    level: 1,
    regionId: input.regionId,
    suspended: false,
  });
  state.propertiesByPlayerId.set(playerId, properties);
  return propertyId;
}

async function registerPlayer(server: Awaited<ReturnType<typeof Fastify>>) {
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

  return {
    accessToken: response.json().accessToken as string,
    playerId: response.json().player.id as string,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
