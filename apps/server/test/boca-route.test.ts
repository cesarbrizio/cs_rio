import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type BocaStockInput,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createBocaRoutes } from '../src/api/routes/bocas.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  BocaService,
  type BocaRepository,
} from '../src/services/boca.js';

interface InMemoryBocaPropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  suspended: boolean;
}

interface InMemoryBocaOperationRecord {
  cashBalance: number;
  factionCommissionTotal: number;
  grossRevenueTotal: number;
  lastCollectedAt: Date | null;
  lastSaleAt: Date;
}

interface InMemoryDrugRecord {
  code: string;
  id: string;
  name: string;
  price: number;
  productionLevel: number;
}

interface InMemoryInventoryRecord {
  id: string;
  itemId: string;
  itemType: 'drug';
  quantity: number;
}

interface InMemoryEventRecord {
  endsAt: Date;
  eventType: 'blitz_pm' | 'operacao_policial' | 'seca_drogas';
  regionId: RegionId | null;
  startedAt: Date;
}

interface TestState {
  bocaOperationsByPropertyId: Map<string, InMemoryBocaOperationRecord>;
  defaultFactionId: string | null;
  drugs: Map<string, InMemoryDrugRecord>;
  events: InMemoryEventRecord[];
  factionBankMoney: Map<string, number>;
  favelas: Array<{
    id: string;
    population: number;
    regionId: RegionId;
  }>;
  inventoryByPlayerId: Map<string, InMemoryInventoryRecord[]>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, InMemoryBocaPropertyRecord[]>;
  regions: Array<{
    densityIndex: number;
    id: RegionId;
    operationCostMultiplier: number;
    policePressure: number;
    wealthIndex: number;
  }>;
  stocksByPropertyId: Map<string, Map<string, number>>;
}

class InMemoryAuthBocaRepository implements AuthRepository, BocaRepository {
  constructor(private readonly state: TestState) {}

  async applyBocaState(
    playerId: string,
    input: {
      cashBalance: number;
      factionCommissionDelta: number;
      factionCommissionTotal: number;
      factionId: string | null;
      grossRevenueTotal: number;
      lastSaleAt: Date;
      playerMoneySpentOnMaintenance: number;
      propertyId: string;
      propertyLastMaintenanceAt: Date;
      propertySuspended: boolean;
      stockQuantities: Array<{
        drugId: string;
        quantity: number;
      }>;
    },
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, input.propertyId);

    if (!player || !property) {
      return false;
    }

    player.money = String(
      Number.parseFloat(player.money) - input.playerMoneySpentOnMaintenance,
    );
    property.lastMaintenanceAt = input.propertyLastMaintenanceAt;
    property.suspended = input.propertySuspended;

    if (input.factionCommissionDelta > 0 && input.factionId) {
      const current = this.state.factionBankMoney.get(input.factionId) ?? 0;
      this.state.factionBankMoney.set(
        input.factionId,
        roundMoney(current + input.factionCommissionDelta),
      );
    }

    this.state.bocaOperationsByPropertyId.set(input.propertyId, {
      cashBalance: input.cashBalance,
      factionCommissionTotal: input.factionCommissionTotal,
      grossRevenueTotal: input.grossRevenueTotal,
      lastCollectedAt: this.state.bocaOperationsByPropertyId.get(input.propertyId)?.lastCollectedAt ?? null,
      lastSaleAt: input.lastSaleAt,
    });

    const stockMap = new Map<string, number>();

    for (const stock of input.stockQuantities) {
      if (stock.quantity > 0) {
        stockMap.set(stock.drugId, stock.quantity);
      }
    }

    this.state.stocksByPropertyId.set(input.propertyId, stockMap);
    return true;
  }

  async collectCash(playerId: string, propertyId: string) {
    const player = this.state.players.get(playerId);
    const property = await this.getPropertyRecord(playerId, propertyId);
    const operation = this.state.bocaOperationsByPropertyId.get(propertyId);

    if (!player || !property || !operation || operation.cashBalance <= 0) {
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
      carisma: 25,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 12000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 20,
      hp: 100,
      id: randomUUID(),
      inteligencia: 22,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: '50000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 10,
      positionY: 10,
      regionId: RegionId.Centro,
      resistencia: 20,
      stamina: 100,
      vocation: VocationType.Gerente,
    };

    this.state.players.set(player.id, player);
    this.state.inventoryByPlayerId.set(player.id, []);
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

  async getBoca(playerId: string, propertyId: string) {
    const bocas = await this.listBocas(playerId);
    return bocas.find((boca) => boca.id === propertyId) ?? null;
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

  async listBocas(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties.flatMap((property) => {
      const operation = this.state.bocaOperationsByPropertyId.get(property.id);
      const region = this.state.regions.find((entry) => entry.id === property.regionId);

      if (!region) {
        return [];
      }

      const favela = this.state.favelas.find((entry) => entry.id === property.favelaId) ?? null;
      const stockMap = this.state.stocksByPropertyId.get(property.id) ?? new Map<string, number>();
      const stock = [...stockMap.entries()].flatMap(([drugId, quantity]) => {
        const drug = this.state.drugs.get(drugId);

        if (!drug) {
          return [];
        }

        return [
          {
            baseUnitPrice: drug.price,
            code: drug.code,
            drugId: drug.id,
            drugName: drug.name,
            productionLevel: drug.productionLevel,
            quantity,
          },
        ];
      });

      return [
        {
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
          lastSaleAt: operation?.lastSaleAt ?? property.createdAt,
          level: property.level,
          operationCostMultiplier: region.operationCostMultiplier,
          policePressure: region.policePressure,
          regionId: property.regionId,
          soldierRoster: [],
          stock,
          suspended: property.suspended,
          wealthIndex: region.wealthIndex,
        },
      ];
    });
  }

  async stockDrug(
    playerId: string,
    propertyId: string,
    inventoryItemId: string,
    quantity: number,
  ) {
    const property = await this.getPropertyRecord(playerId, propertyId);
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const index = inventory.findIndex((item) => item.id === inventoryItemId && item.itemType === 'drug');

    if (!property || index < 0) {
      return null;
    }

    const inventoryItem = inventory[index];

    if (!inventoryItem || inventoryItem.quantity < quantity) {
      return null;
    }

    const drug = this.state.drugs.get(inventoryItem.itemId);

    if (!drug) {
      return null;
    }

    if (inventoryItem.quantity === quantity) {
      inventory.splice(index, 1);
    } else {
      inventory[index] = {
        ...inventoryItem,
        quantity: inventoryItem.quantity - quantity,
      };
    }

    this.state.inventoryByPlayerId.set(playerId, inventory);
    const currentStock = this.state.stocksByPropertyId.get(propertyId) ?? new Map<string, number>();
    currentStock.set(drug.id, (currentStock.get(drug.id) ?? 0) + quantity);
    this.state.stocksByPropertyId.set(propertyId, currentStock);

    if (!this.state.bocaOperationsByPropertyId.has(propertyId)) {
      this.state.bocaOperationsByPropertyId.set(propertyId, {
        cashBalance: 0,
        factionCommissionTotal: 0,
        grossRevenueTotal: 0,
        lastCollectedAt: null,
        lastSaleAt: property.createdAt,
      });
    }

    return {
      drugId: drug.id,
      drugName: drug.name,
      transferredQuantity: quantity,
    };
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

describe('boca routes', () => {
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

  it('stocks drugs, sells automatically to NPCs by location and credits faction commission', async () => {
    const high = await registerPlayer(app.server);
    const low = await registerPlayer(app.server);

    const highPropertyId = grantBocaProperty(state, high.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });
    const lowPropertyId = grantBocaProperty(state, low.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-baixada',
      regionId: RegionId.Baixada,
    });
    const highInventoryId = grantDrugInventory(state, high.playerId, 'drug-bala', 100);
    const lowInventoryId = grantDrugInventory(state, low.playerId, 'drug-bala', 100);

    const stockHigh = await app.server.inject({
      headers: {
        authorization: `Bearer ${high.accessToken}`,
      },
      method: 'POST',
      payload: {
        inventoryItemId: highInventoryId,
        quantity: 100,
      } satisfies BocaStockInput,
      url: `/api/bocas/${highPropertyId}/stock`,
    });
    const stockLow = await app.server.inject({
      headers: {
        authorization: `Bearer ${low.accessToken}`,
      },
      method: 'POST',
      payload: {
        inventoryItemId: lowInventoryId,
        quantity: 100,
      } satisfies BocaStockInput,
      url: `/api/bocas/${lowPropertyId}/stock`,
    });

    expect(stockHigh.statusCode).toBe(200);
    expect(stockLow.statusCode).toBe(200);

    now = new Date('2026-03-10T14:00:00.000Z');

    const highList = await app.server.inject({
      headers: {
        authorization: `Bearer ${high.accessToken}`,
      },
      method: 'GET',
      url: '/api/bocas',
    });
    const lowList = await app.server.inject({
      headers: {
        authorization: `Bearer ${low.accessToken}`,
      },
      method: 'GET',
      url: '/api/bocas',
    });

    expect(highList.statusCode).toBe(200);
    expect(lowList.statusCode).toBe(200);
    expect(highList.json().bocas).toHaveLength(1);
    expect(lowList.json().bocas).toHaveLength(1);
    expect(highList.json().bocas[0].cashbox.availableToCollect).toBeGreaterThan(
      lowList.json().bocas[0].cashbox.availableToCollect,
    );
    expect(highList.json().bocas[0].stockUnits).toBeLessThan(100);
    expect(highList.json().bocas[0].economics.locationMultiplier).toBeGreaterThan(
      lowList.json().bocas[0].economics.locationMultiplier,
    );
    expect(state.factionBankMoney.get('faction-cv') ?? 0).toBeGreaterThan(0);

    const collectResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${high.accessToken}`,
      },
      method: 'POST',
      url: `/api/bocas/${highPropertyId}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json().collectedAmount).toBeGreaterThan(0);
    expect(collectResponse.json().playerMoneyAfterCollect).toBeGreaterThan(50000);
    expect(collectResponse.json().boca.cashbox.availableToCollect).toBe(0);
  });

  it('blocks sales when property maintenance is overdue and player cannot pay upkeep', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantBocaProperty(state, player.playerId, {
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      favelaId: 'favela-centro',
      lastMaintenanceAt: new Date('2026-03-01T12:00:00.000Z'),
      regionId: RegionId.Centro,
    });

    grantDrugInventory(state, player.playerId, 'drug-bala', 60);
    state.players.get(player.playerId)!.money = '100';

    const inventoryId = state.inventoryByPlayerId.get(player.playerId)?.[0]?.id;
    expect(inventoryId).toBeTruthy();

    const stockResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        inventoryItemId: inventoryId,
        quantity: 60,
      } satisfies BocaStockInput,
      url: `/api/bocas/${propertyId}/stock`,
    });

    expect(stockResponse.statusCode).toBe(200);

    now = new Date('2026-03-10T14:00:00.000Z');
    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/bocas',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().bocas[0].status).toBe('maintenance_blocked');
    expect(listResponse.json().bocas[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().bocas[0].cashbox.availableToCollect).toBe(0);
    expect(listResponse.json().bocas[0].stockUnits).toBe(60);
  });
});

async function buildTestApp(input: {
  now: () => Date;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthBocaRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const bocaService = new BocaService({
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
        await protectedRoutes.register(createBocaRoutes({ bocaService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await bocaService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    bocaOperationsByPropertyId: new Map(),
    defaultFactionId: 'faction-cv',
    drugs: new Map([
      [
        'drug-bala',
        {
          code: 'bala',
          id: 'drug-bala',
          name: 'Bala',
          price: 400,
          productionLevel: 4,
        },
      ],
    ]),
    events: [],
    factionBankMoney: new Map([['faction-cv', 0]]),
    favelas: [
      {
        id: 'favela-zona-sul',
        population: 70000,
        regionId: RegionId.ZonaSul,
      },
      {
        id: 'favela-centro',
        population: 38000,
        regionId: RegionId.Centro,
      },
      {
        id: 'favela-baixada',
        population: 24000,
        regionId: RegionId.Baixada,
      },
    ],
    inventoryByPlayerId: new Map(),
    players: new Map(),
    propertiesByPlayerId: new Map(),
    regions: [
      {
        densityIndex: 92,
        id: RegionId.ZonaSul,
        operationCostMultiplier: 1.05,
        policePressure: 72,
        wealthIndex: 95,
      },
      {
        densityIndex: 78,
        id: RegionId.Centro,
        operationCostMultiplier: 1,
        policePressure: 60,
        wealthIndex: 62,
      },
      {
        densityIndex: 48,
        id: RegionId.Baixada,
        operationCostMultiplier: 0.95,
        policePressure: 44,
        wealthIndex: 28,
      },
    ],
    stocksByPropertyId: new Map(),
  };
}

function grantBocaProperty(
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

function grantDrugInventory(
  state: TestState,
  playerId: string,
  drugId: string,
  quantity: number,
) {
  const inventory = state.inventoryByPlayerId.get(playerId) ?? [];
  const inventoryId = randomUUID();

  inventory.push({
    id: inventoryId,
    itemId: drugId,
    itemType: 'drug',
    quantity,
  });
  state.inventoryByPlayerId.set(playerId, inventory);
  return inventoryId;
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
