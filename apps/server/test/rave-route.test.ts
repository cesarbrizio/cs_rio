import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type RavePricingInput,
  type RaveStockInput,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createRaveRoutes } from '../src/api/routes/raves.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  RaveService,
  type RaveRepository,
} from '../src/services/rave.js';

interface InMemoryRavePropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  suspended: boolean;
}

interface InMemoryRaveOperationRecord {
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

interface InMemoryLineupRecord {
  priceMultiplier: number;
  quantity: number;
}

interface InMemoryInventoryRecord {
  id: string;
  itemId: string;
  itemType: 'drug';
  quantity: number;
}

interface InMemoryEventRecord {
  endsAt: Date;
  eventType: 'ano_novo_copa' | 'baile_cidade' | 'blitz_pm' | 'carnaval' | 'operacao_policial';
  regionId: RegionId | null;
  startedAt: Date;
}

interface TestState {
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
  lineupsByPropertyId: Map<string, Map<string, InMemoryLineupRecord>>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, InMemoryRavePropertyRecord[]>;
  raveOperationsByPropertyId: Map<string, InMemoryRaveOperationRecord>;
  regions: Array<{
    densityIndex: number;
    id: RegionId;
    operationCostMultiplier: number;
    policePressure: number;
    wealthIndex: number;
  }>;
}

class InMemoryAuthRaveRepository implements AuthRepository, RaveRepository {
  constructor(private readonly state: TestState) {}

  async applyRaveState(
    playerId: string,
    input: {
      cashBalance: number;
      factionCommissionDelta: number;
      factionCommissionTotal: number;
      factionId: string | null;
      grossRevenueTotal: number;
      lastSaleAt: Date;
      lineupStates: Array<{
        drugId: string;
        priceMultiplier: number;
        quantity: number;
      }>;
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

    player.money = String(
      Number.parseFloat(player.money) - input.playerMoneySpentOnMaintenance,
    );
    property.lastMaintenanceAt = input.propertyLastMaintenanceAt;
    property.suspended = input.propertySuspended;

    if (input.factionCommissionDelta > 0 && input.factionId) {
      const current = this.state.factionBankMoney.get(input.factionId) ?? 0;
      this.state.factionBankMoney.set(input.factionId, roundMoney(current + input.factionCommissionDelta));
    }

    this.state.raveOperationsByPropertyId.set(input.propertyId, {
      cashBalance: input.cashBalance,
      factionCommissionTotal: input.factionCommissionTotal,
      grossRevenueTotal: input.grossRevenueTotal,
      lastCollectedAt: this.state.raveOperationsByPropertyId.get(input.propertyId)?.lastCollectedAt ?? null,
      lastSaleAt: input.lastSaleAt,
    });

    const nextLineup = new Map<string, InMemoryLineupRecord>();

    for (const lineup of input.lineupStates) {
      if (lineup.quantity > 0) {
        nextLineup.set(lineup.drugId, {
          priceMultiplier: lineup.priceMultiplier,
          quantity: lineup.quantity,
        });
      }
    }

    this.state.lineupsByPropertyId.set(input.propertyId, nextLineup);
    return true;
  }

  async collectCash(playerId: string, propertyId: string) {
    const player = this.state.players.get(playerId);
    const operation = this.state.raveOperationsByPropertyId.get(propertyId);

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

  async configurePricing(
    playerId: string,
    propertyId: string,
    drugId: string,
    priceMultiplier: number,
  ): Promise<boolean> {
    const property = await this.getPropertyRecord(playerId, propertyId);
    const lineup = this.state.lineupsByPropertyId.get(propertyId);
    const entry = lineup?.get(drugId);

    if (!property || !lineup || !entry) {
      return false;
    }

    lineup.set(drugId, {
      ...entry,
      priceMultiplier,
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
      carisma: 24,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 14000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 18,
      hp: 100,
      id: randomUUID(),
      inteligencia: 24,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: '60000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 10,
      positionY: 10,
      regionId: RegionId.ZonaSul,
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

  async getRave(playerId: string, propertyId: string) {
    const raves = await this.listRaves(playerId);
    return raves.find((rave) => rave.id === propertyId) ?? null;
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

  async listRaves(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties.flatMap((property) => {
      const region = this.state.regions.find((entry) => entry.id === property.regionId);

      if (!region) {
        return [];
      }

      const favela = this.state.favelas.find((entry) => entry.id === property.favelaId) ?? null;
      const operation = this.state.raveOperationsByPropertyId.get(property.id);
      const lineupMap = this.state.lineupsByPropertyId.get(property.id) ?? new Map<string, InMemoryLineupRecord>();
      const lineup = [...lineupMap.entries()].flatMap(([drugId, record]) => {
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
            priceMultiplier: record.priceMultiplier,
            productionLevel: drug.productionLevel,
            quantity: record.quantity,
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
          lineup,
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
    const lineup = this.state.lineupsByPropertyId.get(propertyId) ?? new Map<string, InMemoryLineupRecord>();
    const existing = lineup.get(drug.id);
    lineup.set(drug.id, {
      priceMultiplier: existing?.priceMultiplier ?? 1.55,
      quantity: (existing?.quantity ?? 0) + quantity,
    });
    this.state.lineupsByPropertyId.set(propertyId, lineup);

    if (!this.state.raveOperationsByPropertyId.has(propertyId)) {
      this.state.raveOperationsByPropertyId.set(propertyId, {
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

describe('rave routes', () => {
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

  it('stocks drugs, configures price and earns passive revenue from visitor flow', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantRaveProperty(state, player.playerId, {
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      favelaId: 'favela-zona-sul',
      regionId: RegionId.ZonaSul,
    });
    const inventoryId = grantDrugInventory(state, player.playerId, 'drug-md', 600);

    const stockResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        inventoryItemId: inventoryId,
        quantity: 600,
      } satisfies RaveStockInput,
      url: `/api/raves/${propertyId}/stock`,
    });

    expect(stockResponse.statusCode).toBe(200);
    expect(stockResponse.json().rave.lineup[0].configuredPriceMultiplier).toBe(1.55);

    const pricingResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        drugId: 'drug-md',
        priceMultiplier: 1.9,
      } satisfies RavePricingInput,
      url: `/api/raves/${propertyId}/pricing`,
    });

    expect(pricingResponse.statusCode).toBe(200);
    expect(pricingResponse.json().priceMultiplier).toBe(1.9);
    expect(pricingResponse.json().rave.lineup[0].configuredPriceMultiplier).toBe(1.9);

    now = new Date('2026-03-10T15:00:00.000Z');
    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/raves',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().raves).toHaveLength(1);
    expect(listResponse.json().raves[0].status).toBe('active');
    expect(listResponse.json().raves[0].lineup[0].configuredUnitPrice).toBeGreaterThan(
      listResponse.json().raves[0].lineup[0].baseUnitPrice,
    );
    expect(listResponse.json().raves[0].lineup[0].estimatedVisitorsPerCycle).toBeGreaterThan(0);
    expect(listResponse.json().raves[0].cashbox.availableToCollect).toBeGreaterThan(0);
    expect(state.factionBankMoney.get('faction-cv') ?? 0).toBeGreaterThan(0);

    const collectResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: `/api/raves/${propertyId}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json().collectedAmount).toBeGreaterThan(0);
    expect(collectResponse.json().playerMoneyAfterCollect).toBeGreaterThan(60000);
    expect(collectResponse.json().rave.cashbox.availableToCollect).toBe(0);
  });

  it('blocks passive sales when rave maintenance is overdue and the player cannot pay', async () => {
    const player = await registerPlayer(app.server);
    const propertyId = grantRaveProperty(state, player.playerId, {
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      favelaId: 'favela-centro',
      lastMaintenanceAt: new Date('2026-03-01T12:00:00.000Z'),
      regionId: RegionId.Centro,
    });
    const inventoryId = grantDrugInventory(state, player.playerId, 'drug-md', 80);
    state.players.get(player.playerId)!.money = '200';

    const stockResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        inventoryItemId: inventoryId,
        quantity: 80,
      } satisfies RaveStockInput,
      url: `/api/raves/${propertyId}/stock`,
    });

    expect(stockResponse.statusCode).toBe(200);

    now = new Date('2026-03-10T15:00:00.000Z');
    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/raves',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().raves[0].status).toBe('maintenance_blocked');
    expect(listResponse.json().raves[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().raves[0].cashbox.availableToCollect).toBe(0);
    expect(listResponse.json().raves[0].lineup[0].quantity).toBe(80);
  });
});

async function buildTestApp(input: {
  now: () => Date;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthRaveRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const raveService = new RaveService({
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
        await protectedRoutes.register(createRaveRoutes({ raveService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await raveService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    defaultFactionId: 'faction-cv',
    drugs: new Map([
      [
        'drug-md',
        {
          code: 'md',
          id: 'drug-md',
          name: 'MD',
          price: 650,
          productionLevel: 5,
        },
      ],
    ]),
    events: [
      {
        endsAt: new Date('2026-03-10T23:59:59.000Z'),
        eventType: 'carnaval',
        regionId: RegionId.ZonaSul,
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        endsAt: new Date('2026-03-10T23:59:59.000Z'),
        eventType: 'baile_cidade',
        regionId: RegionId.ZonaSul,
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
    ],
    factionBankMoney: new Map([['faction-cv', 0]]),
    favelas: [
      {
        id: 'favela-zona-sul',
        population: 54000,
        regionId: RegionId.ZonaSul,
      },
      {
        id: 'favela-centro',
        population: 34000,
        regionId: RegionId.Centro,
      },
    ],
    inventoryByPlayerId: new Map(),
    lineupsByPropertyId: new Map(),
    players: new Map(),
    propertiesByPlayerId: new Map(),
    raveOperationsByPropertyId: new Map(),
    regions: [
      {
        densityIndex: 88,
        id: RegionId.ZonaSul,
        operationCostMultiplier: 1.08,
        policePressure: 70,
        wealthIndex: 96,
      },
      {
        densityIndex: 70,
        id: RegionId.Centro,
        operationCostMultiplier: 1,
        policePressure: 62,
        wealthIndex: 64,
      },
    ],
  };
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

function grantRaveProperty(
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
