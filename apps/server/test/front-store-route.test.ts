import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type FrontStoreInvestInput,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createFrontStoreRoutes } from '../src/api/routes/front-stores.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  FrontStoreService,
  type FrontStoreRepository,
} from '../src/services/front-store.js';

interface InMemoryFrontStorePropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  suspended: boolean;
}

interface InMemoryFrontStoreOperationRecord {
  cashBalance: number;
  factionCommissionTotal: number;
  grossRevenueTotal: number;
  investigationActiveUntil: Date | null;
  investigationsTotal: number;
  kind: FrontStoreInvestInput['storeKind'] | null;
  lastCollectedAt: Date | null;
  lastInvestigationAt: Date | null;
  lastRevenueAt: Date;
  totalLaunderedClean: number;
  totalSeizedAmount: number;
}

interface InMemoryFrontStoreBatchRecord {
  completesAt: Date;
  expectedCleanReturn: number;
  id: string;
  investedAmount: number;
  investigationRisk: number;
  resolvedAt: Date | null;
  resolvedCleanAmount: number;
  seizedAmount: number;
  startedAt: Date;
  status: 'pending' | 'completed' | 'seized';
}

interface InMemoryEventRecord {
  endsAt: Date;
  eventType: 'blitz_pm' | 'carnaval' | 'operacao_policial' | 'operacao_verao';
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
  frontStoreBatchesByPropertyId: Map<string, InMemoryFrontStoreBatchRecord[]>;
  frontStoreOperationsByPropertyId: Map<string, InMemoryFrontStoreOperationRecord>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, InMemoryFrontStorePropertyRecord[]>;
  regions: Array<{
    densityIndex: number;
    id: RegionId;
    operationCostMultiplier: number;
    policePressure: number;
    wealthIndex: number;
  }>;
}

class InMemoryAuthFrontStoreRepository implements AuthRepository, FrontStoreRepository {
  constructor(private readonly state: TestState) {}

  async applyFrontStoreState(
    playerId: string,
    input: {
      batchStates: Array<{
        id: string;
        resolvedAt: Date | null;
        resolvedCleanAmount: number;
        seizedAmount: number;
        status: 'pending' | 'completed' | 'seized';
      }>;
      cashBalance: number;
      factionCommissionDelta: number;
      factionCommissionTotal: number;
      factionId: string | null;
      grossRevenueTotal: number;
      investigationActiveUntil: Date | null;
      investigationsTotal: number;
      lastInvestigationAt: Date | null;
      lastRevenueAt: Date;
      playerMoneySpentOnMaintenance: number;
      propertyId: string;
      propertyLastMaintenanceAt: Date;
      propertySuspended: boolean;
      storeKind: FrontStoreInvestInput['storeKind'] | null;
      totalLaunderedClean: number;
      totalSeizedAmount: number;
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

    const currentOperation = this.state.frontStoreOperationsByPropertyId.get(input.propertyId);
    this.state.frontStoreOperationsByPropertyId.set(input.propertyId, {
      cashBalance: input.cashBalance,
      factionCommissionTotal: input.factionCommissionTotal,
      grossRevenueTotal: input.grossRevenueTotal,
      investigationActiveUntil: input.investigationActiveUntil,
      investigationsTotal: input.investigationsTotal,
      kind: input.storeKind ?? null,
      lastCollectedAt: currentOperation?.lastCollectedAt ?? null,
      lastInvestigationAt: input.lastInvestigationAt,
      lastRevenueAt: input.lastRevenueAt,
      totalLaunderedClean: input.totalLaunderedClean,
      totalSeizedAmount: input.totalSeizedAmount,
    });

    const batches = this.state.frontStoreBatchesByPropertyId.get(input.propertyId) ?? [];
    const batchStates = new Map(input.batchStates.map((batch) => [batch.id, batch]));

    for (const batch of batches) {
      const nextState = batchStates.get(batch.id);

      if (!nextState) {
        continue;
      }

      batch.resolvedAt = nextState.resolvedAt;
      batch.resolvedCleanAmount = nextState.resolvedCleanAmount;
      batch.seizedAmount = nextState.seizedAmount;
      batch.status = nextState.status;
    }

    return true;
  }

  async collectCash(playerId: string, propertyId: string) {
    const player = this.state.players.get(playerId);
    const operation = this.state.frontStoreOperationsByPropertyId.get(propertyId);

    if (!player || !operation || operation.cashBalance <= 0) {
      return null;
    }

    const collectedAmount = roundMoney(operation.cashBalance);
    const playerBankMoneyAfterCollect = roundMoney(Number.parseFloat(player.bankMoney) + collectedAmount);

    player.bankMoney = String(playerBankMoneyAfterCollect);
    operation.cashBalance = 0;
    operation.lastCollectedAt = new Date('2026-03-10T00:00:00.000Z');

    return {
      collectedAmount,
      playerBankMoneyAfterCollect,
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
      carisma: 55,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 16000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 18,
      hp: 100,
      id: randomUUID(),
      inteligencia: 26,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: '120000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 11,
      positionY: 9,
      regionId: RegionId.Centro,
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

  async getFrontStore(playerId: string, propertyId: string) {
    const frontStores = await this.listFrontStores(playerId);
    return frontStores.find((frontStore) => frontStore.id === propertyId) ?? null;
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      bankMoney: Number.parseFloat(player.bankMoney),
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: Number.parseFloat(player.money),
    };
  }

  async investDirtyMoney(
    playerId: string,
    propertyId: string,
    input: {
      completesAt: Date;
      dirtyAmount: number;
      expectedCleanReturn: number;
      investigationRisk: number;
      startedAt: Date;
      storeKind: NonNullable<FrontStoreInvestInput['storeKind']>;
    },
  ) {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, propertyId);

    if (!player || !property) {
      return null;
    }

    const playerMoneyAfterInvest = roundMoney(Number.parseFloat(player.money) - input.dirtyAmount);
    player.money = String(playerMoneyAfterInvest);

    const currentOperation = this.state.frontStoreOperationsByPropertyId.get(propertyId);
    this.state.frontStoreOperationsByPropertyId.set(propertyId, {
      cashBalance: currentOperation?.cashBalance ?? 0,
      factionCommissionTotal: currentOperation?.factionCommissionTotal ?? 0,
      grossRevenueTotal: currentOperation?.grossRevenueTotal ?? 0,
      investigationActiveUntil: currentOperation?.investigationActiveUntil ?? null,
      investigationsTotal: currentOperation?.investigationsTotal ?? 0,
      kind: currentOperation?.kind ?? input.storeKind,
      lastCollectedAt: currentOperation?.lastCollectedAt ?? null,
      lastInvestigationAt: currentOperation?.lastInvestigationAt ?? null,
      lastRevenueAt: currentOperation?.lastRevenueAt ?? input.startedAt,
      totalLaunderedClean: currentOperation?.totalLaunderedClean ?? 0,
      totalSeizedAmount: currentOperation?.totalSeizedAmount ?? 0,
    });

    const batchId = randomUUID();
    const batches = this.state.frontStoreBatchesByPropertyId.get(propertyId) ?? [];
    batches.push({
      completesAt: input.completesAt,
      expectedCleanReturn: input.expectedCleanReturn,
      id: batchId,
      investedAmount: input.dirtyAmount,
      investigationRisk: input.investigationRisk,
      resolvedAt: null,
      resolvedCleanAmount: 0,
      seizedAmount: 0,
      startedAt: input.startedAt,
      status: 'pending',
    });
    this.state.frontStoreBatchesByPropertyId.set(propertyId, batches);

    return {
      batchId,
      playerMoneyAfterInvest,
    };
  }

  async listActiveEvents(regionId: RegionId, now: Date) {
    return this.state.events
      .filter(
        (event) =>
          event.startedAt <= now &&
          event.endsAt >= now &&
          (event.regionId === null || event.regionId === regionId),
      )
      .map((event) => ({
        eventType: event.eventType,
        regionId: event.regionId,
      }));
  }

  async listFrontStores(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties.flatMap((property) => {
      const region = this.state.regions.find((entry) => entry.id === property.regionId);

      if (!region) {
        return [];
      }

      const favela = this.state.favelas.find((entry) => entry.id === property.favelaId) ?? null;
      const operation = this.state.frontStoreOperationsByPropertyId.get(property.id);
      const batches = this.state.frontStoreBatchesByPropertyId.get(property.id) ?? [];

      return [
        {
          batches: [...batches].sort(
            (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
          ),
          cashBalance: operation?.cashBalance ?? 0,
          createdAt: property.createdAt,
          densityIndex: region.densityIndex,
          factionCommissionTotal: operation?.factionCommissionTotal ?? 0,
          favelaId: property.favelaId,
          favelaPopulation: favela?.population ?? null,
          grossRevenueTotal: operation?.grossRevenueTotal ?? 0,
          id: property.id,
          investigationActiveUntil: operation?.investigationActiveUntil ?? null,
          investigationsTotal: operation?.investigationsTotal ?? 0,
          kind: operation?.kind ?? null,
          lastCollectedAt: operation?.lastCollectedAt ?? null,
          lastInvestigationAt: operation?.lastInvestigationAt ?? null,
          lastMaintenanceAt: property.lastMaintenanceAt,
          lastRevenueAt: operation?.lastRevenueAt ?? property.createdAt,
          level: property.level,
          operationCostMultiplier: region.operationCostMultiplier,
          policePressure: region.policePressure,
          regionId: property.regionId,
          soldierRoster: [],
          suspended: property.suspended,
          totalLaunderedClean: operation?.totalLaunderedClean ?? 0,
          totalSeizedAmount: operation?.totalSeizedAmount ?? 0,
          wealthIndex: region.wealthIndex,
        },
      ];
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

describe('front-store routes', () => {
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

  it('launders cash, credits faction commission and collects clean money into the bank account', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantFrontStoreProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-centro',
      regionId: RegionId.Centro,
    });

    const investResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        dirtyAmount: 10000,
        storeKind: 'lava_rapido',
      } satisfies FrontStoreInvestInput,
      url: `/api/front-stores/${propertyId}/invest`,
    });

    expect(investResponse.statusCode).toBe(200);
    expect(investResponse.json().batch.status).toBe('pending');
    expect(investResponse.json().playerMoneyAfterInvest).toBe(110000);

    now = new Date('2026-03-10T19:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/front-stores',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().frontStores).toHaveLength(1);
    expect(listResponse.json().frontStores[0].kind).toBe('lava_rapido');
    expect(listResponse.json().frontStores[0].batches[0].status).toBe('completed');
    expect(listResponse.json().frontStores[0].cashbox.availableToCollect).toBeGreaterThan(11500);
    expect(listResponse.json().frontStores[0].economics.cleanReturnMultiplier).toBe(1.23);
    expect(state.factionBankMoney.get('faction-cv')).toBeGreaterThan(700);

    const collectResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: `/api/front-stores/${propertyId}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json().collectedAmount).toBeGreaterThan(11500);
    expect(collectResponse.json().playerBankMoneyAfterCollect).toBeGreaterThan(11500);
    expect(collectResponse.json().frontStore.cashbox.availableToCollect).toBe(0);
  });

  it('seizes laundering batches under investigation and blocks reinvestment during the investigation window', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantFrontStoreProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });

    const investResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        dirtyAmount: 5000,
        storeKind: 'igreja',
      } satisfies FrontStoreInvestInput,
      url: `/api/front-stores/${propertyId}/invest`,
    });

    expect(investResponse.statusCode).toBe(200);

    randomProvider = createRandomSequence([0]);
    now = new Date('2026-03-10T19:30:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/front-stores',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().frontStores[0].batches[0].status).toBe('seized');
    expect(listResponse.json().frontStores[0].cashbox.totalSeizedAmount).toBe(5000);
    expect(listResponse.json().frontStores[0].investigation.isUnderInvestigation).toBe(true);
    expect(listResponse.json().frontStores[0].status).toBe('investigation_blocked');

    const reinvestResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        dirtyAmount: 1000,
      } satisfies FrontStoreInvestInput,
      url: `/api/front-stores/${propertyId}/invest`,
    });

    expect(reinvestResponse.statusCode).toBe(409);
    expect(reinvestResponse.json().message).toContain('sob investigacao');
  });

  it('blocks laundering when property maintenance is overdue and the player cannot cover upkeep', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantFrontStoreProperty(state, player.playerId, {
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      favelaId: 'favela-centro',
      lastMaintenanceAt: new Date('2026-03-01T12:00:00.000Z'),
      regionId: RegionId.Centro,
    });

    const playerRecord = state.players.get(player.playerId);

    if (!playerRecord) {
      throw new Error('Jogador de teste nao encontrado.');
    }

    playerRecord.money = '200';
    now = new Date('2026-03-10T18:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/front-stores',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().frontStores[0].status).toBe('maintenance_blocked');
    expect(listResponse.json().frontStores[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().frontStores[0].economics.launderingCapacityRemaining).toBe(0);

    const investResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        dirtyAmount: 1000,
        storeKind: 'acai',
      } satisfies FrontStoreInvestInput,
      url: `/api/front-stores/${propertyId}/invest`,
    });

    expect(investResponse.statusCode).toBe(409);
    expect(investResponse.json().message).toContain('Regularize a manutencao');
  });
});

async function buildTestApp(input: {
  now: () => Date;
  random: () => number;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthFrontStoreRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const frontStoreService = new FrontStoreService({
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
        await protectedRoutes.register(createFrontStoreRoutes({ frontStoreService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await frontStoreService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    defaultFactionId: 'faction-cv',
    events: [],
    factionBankMoney: new Map([['faction-cv', 0]]),
    favelas: [
      {
        id: 'favela-centro',
        population: 38000,
        regionId: RegionId.Centro,
      },
      {
        id: 'favela-zona-sul',
        population: 62000,
        regionId: RegionId.ZonaSul,
      },
    ],
    frontStoreBatchesByPropertyId: new Map(),
    frontStoreOperationsByPropertyId: new Map(),
    players: new Map(),
    propertiesByPlayerId: new Map(),
    regions: [
      {
        densityIndex: 76,
        id: RegionId.Centro,
        operationCostMultiplier: 1,
        policePressure: 58,
        wealthIndex: 62,
      },
      {
        densityIndex: 90,
        id: RegionId.ZonaSul,
        operationCostMultiplier: 1.08,
        policePressure: 70,
        wealthIndex: 96,
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

function grantFrontStoreProperty(
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
