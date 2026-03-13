import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  type SlotMachineConfigureInput,
  type SlotMachineInstallInput,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createSlotMachineRoutes } from '../src/api/routes/slot-machines.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  SlotMachineService,
  type SlotMachineRepository,
} from '../src/services/slot-machine.js';

interface InMemorySlotMachinePropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  suspended: boolean;
}

interface InMemorySlotMachineOperationRecord {
  cashBalance: number;
  factionCommissionTotal: number;
  grossRevenueTotal: number;
  houseEdge: number;
  installedMachines: number;
  jackpotChance: number;
  lastCollectedAt: Date | null;
  lastPlayAt: Date;
  maxBet: number;
  minBet: number;
}

interface InMemoryEventRecord {
  endsAt: Date;
  eventType: 'ano_novo_copa' | 'baile_cidade' | 'blitz_pm' | 'carnaval' | 'operacao_policial';
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
  propertiesByPlayerId: Map<string, InMemorySlotMachinePropertyRecord[]>;
  regions: Array<{
    densityIndex: number;
    id: RegionId;
    operationCostMultiplier: number;
    policePressure: number;
    wealthIndex: number;
  }>;
  slotMachineOperationsByPropertyId: Map<string, InMemorySlotMachineOperationRecord>;
}

class InMemoryAuthSlotMachineRepository implements AuthRepository, SlotMachineRepository {
  constructor(private readonly state: TestState) {}

  async applySlotMachineState(
    playerId: string,
    input: {
      cashBalance: number;
      factionCommissionDelta: number;
      factionCommissionTotal: number;
      factionId: string | null;
      grossRevenueTotal: number;
      houseEdge: number;
      installedMachines: number;
      jackpotChance: number;
      lastPlayAt: Date;
      maxBet: number;
      minBet: number;
      playerMoneySpentOnMaintenance: number;
      propertyId: string;
      propertyLastMaintenanceAt: Date;
      propertySuspended: boolean;
    },
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, input.propertyId);

    if (!player || !property) {
      return false;
    }

    player.money = String(roundMoney(Number.parseFloat(player.money) - input.playerMoneySpentOnMaintenance));
    property.lastMaintenanceAt = input.propertyLastMaintenanceAt;
    property.suspended = input.propertySuspended;

    if (input.factionCommissionDelta > 0 && input.factionId) {
      const current = this.state.factionBankMoney.get(input.factionId) ?? 0;
      this.state.factionBankMoney.set(input.factionId, roundMoney(current + input.factionCommissionDelta));
    }

    const currentOperation = this.state.slotMachineOperationsByPropertyId.get(input.propertyId);
    this.state.slotMachineOperationsByPropertyId.set(input.propertyId, {
      cashBalance: input.cashBalance,
      factionCommissionTotal: input.factionCommissionTotal,
      grossRevenueTotal: input.grossRevenueTotal,
      houseEdge: input.houseEdge,
      installedMachines: input.installedMachines,
      jackpotChance: input.jackpotChance,
      lastCollectedAt: currentOperation?.lastCollectedAt ?? null,
      lastPlayAt: input.lastPlayAt,
      maxBet: input.maxBet,
      minBet: input.minBet,
    });
    return true;
  }

  async collectCash(playerId: string, propertyId: string) {
    const player = this.state.players.get(playerId);
    const operation = this.state.slotMachineOperationsByPropertyId.get(propertyId);

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

  async configureOdds(
    playerId: string,
    propertyId: string,
    input: {
      houseEdge: number;
      jackpotChance: number;
      lastPlayAt: Date;
      maxBet: number;
      minBet: number;
    },
  ): Promise<boolean> {
    const property = await this.getPropertyRecord(playerId, propertyId);

    if (!property) {
      return false;
    }

    const current = this.state.slotMachineOperationsByPropertyId.get(propertyId);
    this.state.slotMachineOperationsByPropertyId.set(propertyId, {
      cashBalance: current?.cashBalance ?? 0,
      factionCommissionTotal: current?.factionCommissionTotal ?? 0,
      grossRevenueTotal: current?.grossRevenueTotal ?? 0,
      houseEdge: input.houseEdge,
      installedMachines: current?.installedMachines ?? 0,
      jackpotChance: input.jackpotChance,
      lastCollectedAt: current?.lastCollectedAt ?? null,
      lastPlayAt: current?.lastPlayAt ?? input.lastPlayAt,
      maxBet: input.maxBet,
      minBet: input.minBet,
    });

    return true;
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
      carisma: 42,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 14000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 16,
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
      positionX: 9,
      positionY: 12,
      regionId: RegionId.Centro,
      resistencia: 20,
      stamina: 100,
      vocation: VocationType.Empreendedor,
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
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: Number.parseFloat(player.money),
    };
  }

  async getSlotMachine(playerId: string, propertyId: string) {
    const slotMachines = await this.listSlotMachines(playerId);
    return slotMachines.find((slotMachine) => slotMachine.id === propertyId) ?? null;
  }

  async installMachines(
    playerId: string,
    propertyId: string,
    input: {
      installedAt: Date;
      quantity: number;
      totalInstallCost: number;
    },
  ) {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, propertyId);

    if (!player || !property) {
      return null;
    }

    const playerMoneyAfterInstall = roundMoney(Number.parseFloat(player.money) - input.totalInstallCost);
    player.money = String(playerMoneyAfterInstall);

    const current = this.state.slotMachineOperationsByPropertyId.get(propertyId);
    this.state.slotMachineOperationsByPropertyId.set(propertyId, {
      cashBalance: current?.cashBalance ?? 0,
      factionCommissionTotal: current?.factionCommissionTotal ?? 0,
      grossRevenueTotal: current?.grossRevenueTotal ?? 0,
      houseEdge: current?.houseEdge ?? SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
      installedMachines: (current?.installedMachines ?? 0) + input.quantity,
      jackpotChance: current?.jackpotChance ?? SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
      lastCollectedAt: current?.lastCollectedAt ?? null,
      lastPlayAt: current?.lastPlayAt ?? input.installedAt,
      maxBet: current?.maxBet ?? SLOT_MACHINE_DEFAULT_MAX_BET,
      minBet: current?.minBet ?? SLOT_MACHINE_DEFAULT_MIN_BET,
    });

    return {
      installedQuantity: input.quantity,
      playerMoneyAfterInstall,
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

  async listSlotMachines(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties.flatMap((property) => {
      const region = this.state.regions.find((entry) => entry.id === property.regionId);

      if (!region) {
        return [];
      }

      const favela = this.state.favelas.find((entry) => entry.id === property.favelaId) ?? null;
      const operation = this.state.slotMachineOperationsByPropertyId.get(property.id);

      return [
        {
          cashBalance: operation?.cashBalance ?? 0,
          createdAt: property.createdAt,
          densityIndex: region.densityIndex,
          factionCommissionTotal: operation?.factionCommissionTotal ?? 0,
          favelaId: property.favelaId,
          favelaPopulation: favela?.population ?? null,
          grossRevenueTotal: operation?.grossRevenueTotal ?? 0,
          houseEdge: operation?.houseEdge ?? SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
          id: property.id,
          installedMachines: operation?.installedMachines ?? 0,
          jackpotChance: operation?.jackpotChance ?? SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
          lastCollectedAt: operation?.lastCollectedAt ?? null,
          lastMaintenanceAt: property.lastMaintenanceAt,
          lastPlayAt: operation?.lastPlayAt ?? property.createdAt,
          level: property.level,
          maxBet: operation?.maxBet ?? SLOT_MACHINE_DEFAULT_MAX_BET,
          minBet: operation?.minBet ?? SLOT_MACHINE_DEFAULT_MIN_BET,
          operationCostMultiplier: region.operationCostMultiplier,
          policePressure: region.policePressure,
          regionId: property.regionId,
          soldierRoster: [],
          suspended: property.suspended,
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

describe('slot-machine routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T12:00:00.000Z');
    state = buildState();
    app = await buildTestApp({
      now: () => now,
      state,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('installs machines, configures odds, generates passive revenue and credits faction commission', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantSlotMachineProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-centro',
      regionId: RegionId.Centro,
    });

    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 3,
      } satisfies SlotMachineInstallInput,
      url: `/api/slot-machines/${propertyId}/install`,
    });

    expect(installResponse.statusCode).toBe(200);
    expect(installResponse.json().installedQuantity).toBe(3);
    expect(installResponse.json().totalInstallCost).toBe(15000);
    expect(installResponse.json().playerMoneyAfterInstall).toBe(105000);

    const configureResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        houseEdge: 0.18,
        jackpotChance: 0.015,
        maxBet: 5000,
        minBet: 500,
      } satisfies SlotMachineConfigureInput,
      url: `/api/slot-machines/${propertyId}/configure`,
    });

    expect(configureResponse.statusCode).toBe(200);
    expect(configureResponse.json().slotMachine.config.houseEdge).toBe(0.18);
    expect(configureResponse.json().slotMachine.economics.installedMachines).toBe(3);

    now = new Date('2026-03-10T20:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/slot-machines',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().slotMachines).toHaveLength(1);
    expect(listResponse.json().slotMachines[0].cashbox.availableToCollect).toBeGreaterThan(0);
    expect(listResponse.json().slotMachines[0].economics.locationMultiplier).toBeGreaterThan(1.3);
    expect(listResponse.json().slotMachines[0].economics.playerTrafficMultiplier).toBeGreaterThan(1);
    expect(state.factionBankMoney.get('faction-cv') ?? 0).toBeGreaterThan(0);

    const collectResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: `/api/slot-machines/${propertyId}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json().collectedAmount).toBeGreaterThan(0);
    expect(collectResponse.json().playerMoneyAfterCollect).toBeGreaterThan(105000);
    expect(collectResponse.json().slotMachine.cashbox.availableToCollect).toBe(0);
  });

  it('enforces machine capacity and rejects invalid odds configuration', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantSlotMachineProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });

    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 6,
      } satisfies SlotMachineInstallInput,
      url: `/api/slot-machines/${propertyId}/install`,
    });

    expect(installResponse.statusCode).toBe(409);
    expect(installResponse.json().message).toContain('Capacidade excedida');

    const configureResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        houseEdge: 0.4,
        jackpotChance: 0.03,
        maxBet: 50,
        minBet: 100,
      } satisfies SlotMachineConfigureInput,
      url: `/api/slot-machines/${propertyId}/configure`,
    });

    expect(configureResponse.statusCode).toBe(400);
    expect(configureResponse.json().message).toContain('margem da casa');
  });

  it('blocks passive operation when maintenance is overdue and the player cannot cover upkeep', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantSlotMachineProperty(state, player.playerId, {
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      favelaId: 'favela-centro',
      lastMaintenanceAt: new Date('2026-03-01T12:00:00.000Z'),
      regionId: RegionId.Centro,
    });
    state.slotMachineOperationsByPropertyId.set(propertyId, {
      cashBalance: 0,
      factionCommissionTotal: 0,
      grossRevenueTotal: 0,
      houseEdge: SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
      installedMachines: 2,
      jackpotChance: SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
      lastCollectedAt: null,
      lastPlayAt: new Date('2026-03-01T12:00:00.000Z'),
      maxBet: SLOT_MACHINE_DEFAULT_MAX_BET,
      minBet: SLOT_MACHINE_DEFAULT_MIN_BET,
    });

    const playerRecord = state.players.get(player.playerId);

    if (!playerRecord) {
      throw new Error('Jogador de teste nao encontrado.');
    }

    playerRecord.money = '100';
    now = new Date('2026-03-10T18:00:00.000Z');

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/slot-machines',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().slotMachines[0].status).toBe('maintenance_blocked');
    expect(listResponse.json().slotMachines[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().slotMachines[0].cashbox.availableToCollect).toBe(0);

    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 1,
      } satisfies SlotMachineInstallInput,
      url: `/api/slot-machines/${propertyId}/install`,
    });

    expect(installResponse.statusCode).toBe(409);
    expect(installResponse.json().message).toContain('Regularize a manutencao');
  });
});

async function buildTestApp(input: {
  now: () => Date;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthSlotMachineRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const slotMachineService = new SlotMachineService({
    keyValueStore,
    now: input.now,
    repository,
  });
  const server = Fastify();

  await server.register(
    async (api) => {
      await api.register(createAuthRoutes({ authService }));
      await api.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
        await protectedRoutes.register(createSlotMachineRoutes({ slotMachineService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await slotMachineService.close?.();
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
        regionId: RegionId.Centro,
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
    ],
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
    slotMachineOperationsByPropertyId: new Map(),
  };
}

function grantSlotMachineProperty(
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
