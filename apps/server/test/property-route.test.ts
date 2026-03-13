import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type PropertyPurchaseInput,
  PROPERTY_DEFINITIONS,
  RegionId,
  SOLDIER_TEMPLATES,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createPropertyRoutes } from '../src/api/routes/properties.js';
import { AuthService, type AuthPlayerRecord, type AuthRepository, type KeyValueStore } from '../src/services/auth.js';
import { type FactionUpgradeEffectReaderContract } from '../src/services/faction.js';
import {
  PropertyService,
  type PropertyRepository,
} from '../src/services/property.js';

interface InMemoryPropertyRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  soldierRoster: Array<{
    count: number;
    dailyCost: number;
    label: string;
    power: number;
    type: (typeof SOLDIER_TEMPLATES)[number]['type'];
  }>;
  suspended: boolean;
  type: (typeof PROPERTY_DEFINITIONS)[number]['type'];
}

interface TestState {
  defaultFactionId: string | null;
  favelas: Array<{
    controllingFactionId: string | null;
    id: string;
    maxSoldiers: number;
    regionId: RegionId;
  }>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, InMemoryPropertyRecord[]>;
  regions: Array<{
    id: RegionId;
    operationCostMultiplier: number;
  }>;
}

class InMemoryAuthPropertyRepository implements AuthRepository, PropertyRepository {
  constructor(private readonly state: TestState) {}

  async applyMaintenanceState(
    playerId: string,
    input: {
      lastMaintenanceAt: Date;
      moneySpent: number;
      propertyId: string;
      suspended: boolean;
    },
  ): Promise<boolean> {
    const property = await this.getProperty(playerId, input.propertyId);
    const player = this.state.players.get(playerId);

    if (!property || !player) {
      return false;
    }

    property.lastMaintenanceAt = input.lastMaintenanceAt;
    property.suspended = input.suspended;
    player.money = String(Number.parseFloat(player.money) - input.moneySpent);
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
      carisma: 30,
      characterCreatedAt: new Date('2026-03-10T13:00:00.000Z'),
      conceito: 15000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: this.state.defaultFactionId,
      forca: 20,
      hp: 100,
      id: randomUUID(),
      inteligencia: 28,
      lastLogin: input.lastLogin,
      level: 7,
      morale: 100,
      money: this.state.defaultFactionId ? '150000' : '6000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 100,
      positionY: 100,
      regionId: RegionId.Centro,
      resistencia: 22,
      stamina: 100,
      vocation: VocationType.Gerente,
    };

    this.state.players.set(player.id, player);
    this.state.propertiesByPlayerId.set(player.id, []);
    return { ...player };
  }

  async createProperty(input: {
    favelaId: string | null;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
    type: (typeof PROPERTY_DEFINITIONS)[number]['type'];
  }): Promise<InMemoryPropertyRecord | null> {
    const player = this.state.players.get(input.playerId);
    const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === input.type);

    if (!player || !definition) {
      return null;
    }

    player.money = String(Number.parseFloat(player.money) - definition.basePrice);
    const property: InMemoryPropertyRecord = {
      createdAt: input.startedAt,
      favelaId: input.favelaId,
      id: randomUUID(),
      lastMaintenanceAt: input.startedAt,
      level: 1,
      regionId: input.regionId,
      soldierRoster: [],
      suspended: false,
      type: input.type,
    };
    const properties = this.state.propertiesByPlayerId.get(input.playerId) ?? [];
    properties.push(property);
    this.state.propertiesByPlayerId.set(input.playerId, properties);
    return property;
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
      level: player.level,
      money: Number.parseFloat(player.money),
    };
  }

  async getProperty(playerId: string, propertyId: string): Promise<InMemoryPropertyRecord | null> {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];
    return properties.find((property) => property.id === propertyId) ?? null;
  }

  async getFavelaForceState(favelaId: string) {
    const favela = this.state.favelas.find((entry) => entry.id === favelaId);

    if (!favela) {
      return null;
    }

    const soldiersCount = [...this.state.propertiesByPlayerId.values()]
      .flat()
      .filter((property) => property.favelaId === favelaId && property.suspended === false)
      .reduce(
        (total, property) =>
          total + property.soldierRoster.reduce((sum, rosterEntry) => sum + rosterEntry.count, 0),
        0,
      );

    return {
      id: favela.id,
      maxSoldiers: favela.maxSoldiers,
      soldiersCount,
    };
  }

  async hireSoldiers(
    playerId: string,
    propertyId: string,
    template: (typeof SOLDIER_TEMPLATES)[number],
    quantity: number,
    totalCost: number,
  ) {
    const player = this.state.players.get(playerId);
    const property = await this.getProperty(playerId, propertyId);

    if (!player || !property) {
      return null;
    }

    player.money = String(Number.parseFloat(player.money) - totalCost);
    const existing = property.soldierRoster.find((entry) => entry.type === template.type);

    if (existing) {
      existing.count += quantity;
      existing.power += template.power * quantity;
      existing.dailyCost += template.dailyCost * quantity;
    } else {
      property.soldierRoster.push({
        count: quantity,
        dailyCost: template.dailyCost * quantity,
        label: template.label,
        power: template.power * quantity,
        type: template.type,
      });
    }

    return {
      hiredQuantity: quantity,
      totalDailyCostAdded: template.dailyCost * quantity,
    };
  }

  async listFavelas() {
    return this.state.favelas;
  }

  async listProperties(playerId: string): Promise<InMemoryPropertyRecord[]> {
    return [...(this.state.propertiesByPlayerId.get(playerId) ?? [])].map((property) => ({
      ...property,
      soldierRoster: property.soldierRoster.map((entry) => ({ ...entry })),
    }));
  }

  async listRegions() {
    return this.state.regions;
  }

  async listSoldierTemplates() {
    return [...SOLDIER_TEMPLATES];
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  async upgradeProperty(
    playerId: string,
    propertyId: string,
    nextLevel: number,
    upgradeCost: number,
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const property = await this.getProperty(playerId, propertyId);

    if (!player || !property) {
      return false;
    }

    player.money = String(Number.parseFloat(player.money) - upgradeCost);
    property.level = nextLevel;
    return true;
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

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

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('property routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T15:00:00.000Z');
    state = buildState();
    app = await buildTestApp({
      now: () => now,
      state,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('buys, upgrades and protects a profitable property with faction context', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const listBefore = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/properties',
    });

    expect(listBefore.statusCode).toBe(200);
    expect(listBefore.json().ownedProperties).toHaveLength(0);

    const purchaseResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        favelaId: 'favela-centro-1',
        regionId: RegionId.Centro,
        type: 'boca',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(purchaseResponse.statusCode).toBe(201);
    expect(purchaseResponse.json().property.type).toBe('boca');
    expect(purchaseResponse.json().property.protection.factionProtectionActive).toBe(true);
    expect(purchaseResponse.json().property.protection.territoryTier).toBe('absolute');
    expect(purchaseResponse.json().property.economics.effectiveFactionCommissionRate).toBe(0.12);

    const propertyId = purchaseResponse.json().property.id as string;
    const upgradeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: `/api/properties/${propertyId}/upgrade`,
    });

    expect(upgradeResponse.statusCode).toBe(200);
    expect(upgradeResponse.json().property.level).toBe(2);

    const soldiersResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 1,
        type: 'soldado_rua',
      },
      url: `/api/properties/${propertyId}/soldiers`,
    });

    expect(soldiersResponse.statusCode).toBe(200);
    expect(soldiersResponse.json().hiredQuantity).toBe(1);
    expect(soldiersResponse.json().property.soldiersCount).toBe(1);
    expect(soldiersResponse.json().property.protection.soldiersPower).toBe(2000);
  });

  it('blocks property operation when maintenance outruns available money', async () => {
    state.defaultFactionId = null;
    await app.close();
    app = await buildTestApp({
      now: () => now,
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const purchaseResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        regionId: RegionId.Centro,
        type: 'house',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(purchaseResponse.statusCode).toBe(201);

    now = new Date('2026-03-18T15:00:00.000Z');
    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/properties',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().ownedProperties[0].maintenanceStatus.blocked).toBe(true);
    expect(listResponse.json().ownedProperties[0].maintenanceStatus.overdueDays).toBeGreaterThan(0);
    expect(listResponse.json().ownedProperties[0].status).toBe('maintenance_blocked');
  });

  it('buys patrimonial assets with prestige and utility while blocking guards on unsecured vehicles', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const beachHousePurchase = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        regionId: RegionId.ZonaSudoeste,
        type: 'beach_house',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(beachHousePurchase.statusCode).toBe(201);
    expect(beachHousePurchase.json().property.definition.assetClass).toBe('real_estate');
    expect(beachHousePurchase.json().property.economics.profitable).toBe(false);
    expect(beachHousePurchase.json().property.economics.effectiveFactionCommissionRate).toBe(0);
    expect(beachHousePurchase.json().property.economics.effectivePrestigeScore).toBeGreaterThanOrEqual(95);
    expect(beachHousePurchase.json().property.definition.utility.inventorySlotsBonus).toBe(8);
    expect(beachHousePurchase.json().property.definition.utility.staminaRecoveryPerHourBonus).toBe(3);
    expect(beachHousePurchase.json().property.protection.takeoverRisk).toBe(0);

    const carPurchase = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        regionId: RegionId.Centro,
        type: 'car',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(carPurchase.statusCode).toBe(201);
    expect(carPurchase.json().property.definition.assetClass).toBe('vehicle');
    expect(carPurchase.json().property.definition.utility.travelMode).toBe('ground');
    expect(carPurchase.json().property.economics.profitable).toBe(false);

    const carPropertyId = carPurchase.json().property.id as string;
    const hireForCarResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 1,
        type: 'olheiro',
      },
      url: `/api/properties/${carPropertyId}/soldiers`,
    });

    expect(hireForCarResponse.statusCode).toBe(409);
    expect(hireForCarResponse.json().message).toContain('Capacidade maxima');
  });

  it('expands soldier capacity when the faction unlocks exercito_expandido', async () => {
    await app.close();
    app = await buildTestApp({
      factionUpgradeReader: {
        async getFactionUpgradeEffectsForFaction() {
          return {
            attributeBonusMultiplier: 1,
            canAccessExclusiveArsenal: false,
            hasFortifiedHeadquarters: false,
            muleDeliveryTier: 0,
            soldierCapacityMultiplier: 1.5,
          };
        },
      },
      now: () => now,
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const purchaseResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        favelaId: 'favela-centro-1',
        regionId: RegionId.Centro,
        type: 'boca',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(purchaseResponse.statusCode).toBe(201);

    const propertyId = purchaseResponse.json().property.id as string;
    const soldiersResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 11,
        type: 'olheiro',
      },
      url: `/api/properties/${propertyId}/soldiers`,
    });

    expect(soldiersResponse.statusCode).toBe(200);
    expect(soldiersResponse.json().hiredQuantity).toBe(11);
    expect(soldiersResponse.json().property.soldiersCount).toBe(11);
  });

  it('blocks hiring when the favela reaches its territorial soldier cap', async () => {
    state.favelas[0]!.maxSoldiers = 2;

    const accessToken = await registerAndExtractToken(app.server);
    const purchaseResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        favelaId: 'favela-centro-1',
        regionId: RegionId.Centro,
        type: 'boca',
      } satisfies PropertyPurchaseInput,
      url: '/api/properties',
    });

    expect(purchaseResponse.statusCode).toBe(201);

    const propertyId = purchaseResponse.json().property.id as string;
    const firstHire = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 2,
        type: 'olheiro',
      },
      url: `/api/properties/${propertyId}/soldiers`,
    });

    expect(firstHire.statusCode).toBe(200);

    const secondHire = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        quantity: 1,
        type: 'olheiro',
      },
      url: `/api/properties/${propertyId}/soldiers`,
    });

    expect(secondHire.statusCode).toBe(409);
    expect(secondHire.json().message).toContain('Teto maximo de soldados desta favela');
  });
});

async function buildTestApp(input: {
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  now: () => Date;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthPropertyRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const propertyService = new PropertyService({
    factionUpgradeReader: input.factionUpgradeReader,
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
        await protectedRoutes.register(createPropertyRoutes({ propertyService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await propertyService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    defaultFactionId: 'faction-cv',
    favelas: [
      {
        controllingFactionId: 'faction-cv',
        id: 'favela-centro-1',
        maxSoldiers: 20,
        regionId: RegionId.Centro,
      },
      {
        controllingFactionId: 'faction-cv',
        id: 'favela-centro-2',
        maxSoldiers: 20,
        regionId: RegionId.Centro,
      },
    ],
    players: new Map(),
    propertiesByPlayerId: new Map(),
    regions: [
      {
        id: RegionId.Centro,
        operationCostMultiplier: 1,
      },
      {
        id: RegionId.ZonaNorte,
        operationCostMultiplier: 1.15,
      },
      {
        id: RegionId.ZonaSudoeste,
        operationCostMultiplier: 1.2,
      },
    ],
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
