import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  REGION_SPAWN_POINTS,
  VOCATION_BASE_ATTRIBUTES,
  type DrugSaleInput,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { DrugSaleService, type DrugSaleRepository } from '../src/services/drug-sale.js';
import type { AuthPlayerRecord, AuthRepository, KeyValueStore } from '../src/services/auth.js';
import type {
  InventoryDefinitionRecord,
  PlayerDrugConsumptionInput,
  type PlayerOverdosePenaltyInput,
  type PlayerOverdosePenaltyResult,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
} from '../src/services/player.js';

const DRUG_DEFINITIONS: Record<string, InventoryDefinitionRecord> = {
  'drug:drug-1': {
    durabilityMax: null,
    itemId: 'drug-1',
    itemName: 'Maconha',
    itemType: 'drug',
    levelRequired: 2,
    stackable: true,
    unitWeight: 1,
  },
  'drug:drug-2': {
    durabilityMax: null,
    itemId: 'drug-2',
    itemName: 'Bala',
    itemType: 'drug',
    levelRequired: 4,
    stackable: true,
    unitWeight: 1,
  },
} as const;

interface TestSalePropertyRecord {
  createdAt: string;
  favelaPopulation: number | null;
  id: string;
  level: number;
  regionId: RegionId;
  type: 'boca' | 'rave';
}

interface TestDrugInventoryRecord {
  code: string;
  drugId: string;
  name: string;
  price: number;
  productionLevel: number;
}

interface TestSaleEventRecord {
  endsAt: Date;
  eventType: 'ano_novo_copa' | 'baile_cidade' | 'carnaval' | 'navio_docas' | 'seca_drogas';
  regionId: RegionId | null;
  startedAt: Date;
}

interface TestRegionRecord {
  densityIndex: number;
  id: RegionId;
  policePressure: number;
  wealthIndex: number;
}

interface TestState {
  drugCatalog: Map<string, TestDrugInventoryRecord>;
  events: TestSaleEventRecord[];
  inventoryByPlayerId: Map<string, PlayerProfileRecord['inventory']>;
  players: Map<string, AuthPlayerRecord>;
  propertiesById: Map<string, TestSalePropertyRecord>;
  propertiesByPlayerId: Map<string, PlayerProfileRecord['properties']>;
  regions: Map<RegionId, TestRegionRecord>;
}

class InMemoryPlayerRepository implements AuthRepository, PlayerRepository {
  constructor(private readonly state: TestState) {}

  async applyDrugOverdosePenalties(
    playerId: string,
    input: PlayerOverdosePenaltyInput,
  ): Promise<PlayerOverdosePenaltyResult | null> {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    player.addiction = input.addiction;
    player.conceito = input.conceito;
    player.morale = input.morale;

    return {
      knownContactsLost: 0,
    };
  }

  async clearInventoryEquipSlot(playerId: string, equipSlot: InventoryEquipSlot): Promise<void> {
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    this.state.inventoryByPlayerId.set(
      playerId,
      inventory.map((item) =>
        item.equipSlot === equipSlot
          ? {
              ...item,
              equipSlot: null,
              isEquipped: false,
            }
          : item,
      ),
    );
  }

  async consumeDrugInventoryItem(
    playerId: string,
    inventoryItemId: string,
    input: PlayerDrugConsumptionInput,
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const index = inventory.findIndex((item) => item.id === inventoryItemId && item.itemType === 'drug');

    if (!player || index < 0) {
      return false;
    }

    const current = inventory[index];

    if (!current) {
      return false;
    }

    if (current.quantity <= 1) {
      inventory.splice(index, 1);
    } else {
      inventory[index] = {
        ...current,
        quantity: current.quantity - 1,
        totalWeight: current.unitWeight * (current.quantity - 1),
      };
    }

    player.addiction = input.addiction;
    player.morale = input.morale;
    player.nerve = input.nerve;
    player.stamina = input.stamina;
    this.state.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async createCharacter(
    playerId: string,
    input: {
      appearance: AuthPlayerRecord['appearanceJson'];
      vocation: VocationType;
    },
  ): Promise<PlayerProfileRecord | null> {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    const attributes = VOCATION_BASE_ATTRIBUTES[input.vocation];
    const spawnPoint = REGION_SPAWN_POINTS[player.regionId as RegionId] ?? REGION_SPAWN_POINTS[RegionId.Centro];

    player.appearanceJson = input.appearance;
    player.carisma = attributes.carisma;
    player.characterCreatedAt = new Date('2026-03-10T14:00:00.000Z');
    player.conceito = 5000;
    player.forca = attributes.forca;
    player.hp = 100;
    player.inteligencia = attributes.inteligencia;
    player.level = 6;
    player.morale = 100;
    player.nerve = 100;
    player.positionX = spawnPoint.positionX;
    player.positionY = spawnPoint.positionY;
    player.resistencia = attributes.resistencia;
    player.stamina = 100;
    player.vocation = input.vocation;

    return this.getPlayerProfile(playerId);
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
      characterCreatedAt: null,
      conceito: 0,
      createdAt: new Date('2026-03-10T13:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 10,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 1,
      morale: 100,
      money: '3000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 0,
      positionY: 0,
      regionId: RegionId.Centro,
      resistencia: 10,
      stamina: 100,
      vocation: VocationType.Cria,
    };

    this.state.players.set(player.id, player);
    this.state.inventoryByPlayerId.set(player.id, []);
    this.state.propertiesByPlayerId.set(player.id, []);
    return { ...player };
  }

  async deleteInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean> {
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const nextInventory = inventory.filter((item) => item.id !== inventoryItemId);

    if (nextInventory.length === inventory.length) {
      return false;
    }

    this.state.inventoryByPlayerId.set(playerId, nextInventory);
    return true;
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

  async getDrugDefinition(drugId: string) {
    const record = this.state.drugCatalog.get(drugId);

    if (!record) {
      return null;
    }

    return {
      addictionRate: record.productionLevel,
      code: record.code,
      drugId: record.drugId,
      moralBoost: record.productionLevel,
      name: record.name,
      nerveBoost: record.productionLevel - 1,
      productionLevel: record.productionLevel,
      staminaRecovery: record.productionLevel,
      type: record.code as 'maconha' | 'bala',
    };
  }

  async getInventoryDefinition(itemType: InventoryItemType, itemId: string): Promise<InventoryDefinitionRecord | null> {
    return DRUG_DEFINITIONS[`${itemType}:${itemId}`] ?? null;
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      faction: null,
      inventory: [...(this.state.inventoryByPlayerId.get(playerId) ?? [])],
      player: { ...player },
      properties: [...(this.state.propertiesByPlayerId.get(playerId) ?? [])],
    };
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      return;
    }

    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const existingIndex = inventory.findIndex(
      (item) => item.itemId === input.itemId && item.itemType === input.itemType,
    );

    if (existingIndex >= 0) {
      const current = inventory[existingIndex];

      if (current) {
        inventory[existingIndex] = {
          ...current,
          quantity: current.quantity + input.quantity,
          totalWeight: current.unitWeight * (current.quantity + input.quantity),
        };
        this.state.inventoryByPlayerId.set(playerId, inventory);
        return;
      }
    }

    inventory.push({
      durability: null,
      equipSlot: null,
      id: randomUUID(),
      isEquipped: false,
      itemId: input.itemId,
      itemName: definition.itemName,
      itemType: input.itemType,
      levelRequired: definition.levelRequired,
      maxDurability: null,
      proficiency: 0,
      quantity: input.quantity,
      stackable: true,
      totalWeight: definition.unitWeight * input.quantity,
      unitWeight: definition.unitWeight,
    });
    this.state.inventoryByPlayerId.set(playerId, inventory);
  }

  async repairInventoryItem(): Promise<boolean> {
    return false;
  }

  async setInventoryEquipSlot(): Promise<boolean> {
    return false;
  }

  async updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean> {
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const index = inventory.findIndex((item) => item.id === inventoryItemId);

    if (index < 0) {
      return false;
    }

    const current = inventory[index];

    if (!current) {
      return false;
    }

    inventory[index] = {
      ...current,
      quantity,
      totalWeight: current.unitWeight * quantity,
    };
    this.state.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  async updateRuntimeState(playerId: string, input: PlayerRuntimeStateInput): Promise<void> {
    const player = this.state.players.get(playerId);

    if (!player) {
      return;
    }

    player.addiction = input.addiction;
    player.level = input.level;
    player.morale = input.morale;
    player.nerve = input.nerve;
    player.stamina = input.stamina;
  }
}

class InMemoryDrugSaleRepository implements DrugSaleRepository {
  constructor(private readonly state: TestState) {}

  async commitSale(input: {
    channel: DrugSaleInput['channel'];
    commissionAmount: number;
    drugName: string;
    grossRevenue: number;
    inventoryItemId: string;
    netRevenue: number;
    playerId: string;
    quantitySold: number;
    staminaCost: number;
  }) {
    const player = this.state.players.get(input.playerId);
    const inventory = this.state.inventoryByPlayerId.get(input.playerId) ?? [];
    const inventoryIndex = inventory.findIndex((item) => item.id === input.inventoryItemId);

    if (!player || inventoryIndex < 0) {
      return null;
    }

    const inventoryItem = inventory[inventoryIndex];

    if (!inventoryItem || inventoryItem.quantity < input.quantitySold || player.stamina < input.staminaCost) {
      return null;
    }

    const remainingQuantity = inventoryItem.quantity - input.quantitySold;

    if (remainingQuantity <= 0) {
      inventory.splice(inventoryIndex, 1);
    } else {
      inventory[inventoryIndex] = {
        ...inventoryItem,
        quantity: remainingQuantity,
        totalWeight: inventoryItem.unitWeight * remainingQuantity,
      };
    }

    player.money = (Number.parseFloat(player.money) + input.netRevenue).toFixed(2);
    player.stamina -= input.staminaCost;
    this.state.inventoryByPlayerId.set(input.playerId, inventory);

    return {
      playerMoneyAfterSale: Number.parseFloat(player.money),
      playerStaminaAfterSale: player.stamina,
      remainingQuantity,
      soldAt: new Date('2026-03-10T19:55:00.000Z'),
    };
  }

  async getDrugInventory(playerId: string, inventoryItemId: string) {
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const inventoryItem = inventory.find((item) => item.id === inventoryItemId && item.itemType === 'drug');

    if (!inventoryItem?.itemId) {
      return null;
    }

    const record = this.state.drugCatalog.get(inventoryItem.itemId);

    if (!record) {
      return null;
    }

    return {
      code: record.code,
      id: record.drugId,
      inventoryItemId: inventoryItem.id,
      name: record.name,
      price: record.price,
      productionLevel: record.productionLevel,
      quantity: inventoryItem.quantity,
    };
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      carisma: player.carisma,
      id: player.id,
      inteligencia: player.inteligencia,
      level: player.level,
      money: Number.parseFloat(player.money),
      regionId: player.regionId as RegionId,
      stamina: player.stamina,
    };
  }

  async getProperty(playerId: string, propertyId: string) {
    const property = this.state.propertiesById.get(propertyId);

    if (!property) {
      return null;
    }

    const ownsProperty = (this.state.propertiesByPlayerId.get(playerId) ?? []).some((entry) => entry.id === propertyId);

    if (!ownsProperty) {
      return null;
    }

    return {
      favelaPopulation: property.favelaPopulation,
      id: property.id,
      level: property.level,
      regionId: property.regionId,
      type: property.type,
    };
  }

  async getRegion(regionId: RegionId) {
    return this.state.regions.get(regionId) ?? null;
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
    this.values.set(key, nextValue.toString());
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function createTestState(): TestState {
  return {
    drugCatalog: new Map([
      [
        'drug-1',
        {
          code: 'maconha',
          drugId: 'drug-1',
          name: 'Maconha',
          price: 50,
          productionLevel: 2,
        },
      ],
      [
        'drug-2',
        {
          code: 'bala',
          drugId: 'drug-2',
          name: 'Bala',
          price: 400,
          productionLevel: 4,
        },
      ],
    ]),
    events: [],
    inventoryByPlayerId: new Map(),
    players: new Map(),
    propertiesById: new Map(),
    propertiesByPlayerId: new Map(),
    regions: new Map([
      [
        RegionId.Centro,
        {
          densityIndex: 60,
          id: RegionId.Centro,
          policePressure: 70,
          wealthIndex: 65,
        },
      ],
      [
        RegionId.ZonaSul,
        {
          densityIndex: 90,
          id: RegionId.ZonaSul,
          policePressure: 85,
          wealthIndex: 95,
        },
      ],
      [
        RegionId.ZonaNorte,
        {
          densityIndex: 92,
          id: RegionId.ZonaNorte,
          policePressure: 65,
          wealthIndex: 45,
        },
      ],
    ]),
  };
}

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
  email: string,
  nickname: string,
) {
  const registerResponse = await app.inject({
    method: 'POST',
    payload: {
      email,
      nickname,
      password: 'secret123',
    },
    url: '/api/auth/register',
  });

  expect(registerResponse.statusCode).toBe(201);

  const registerBody = registerResponse.json();
  const accessToken = registerBody.accessToken as string;
  const playerId = registerBody.player.id as string;

  const createResponse = await app.inject({
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
    payload: {
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      vocation: VocationType.Gerente,
    },
    url: '/api/players/create',
  });

  expect(createResponse.statusCode).toBe(201);

  return {
    accessToken,
    playerId,
  };
}

describe('drug sale routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let keyValueStore: InMemoryKeyValueStore;
  let playerRepository: InMemoryPlayerRepository;
  let saleRepository: InMemoryDrugSaleRepository;
  let state: TestState;

  beforeEach(async () => {
    state = createTestState();
    keyValueStore = new InMemoryKeyValueStore();
    playerRepository = new InMemoryPlayerRepository(state);
    saleRepository = new InMemoryDrugSaleRepository(state);

    app = await createApp({
      authRepository: playerRepository,
      drugSaleService: new DrugSaleService({
        keyValueStore,
        repository: saleRepository,
      }),
      keyValueStore,
      playerRepository: playerRepository,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('quotes and sells drugs via street traffic with stamina cost and commission', async () => {
    const { accessToken, playerId } = await registerAndCreateCharacter(
      app,
      'street@example.com',
      'streetman',
    );

    await playerRepository.grantInventoryItem(playerId, {
      itemId: 'drug-1',
      itemType: 'drug',
      quantity: 18,
    });

    const inventoryItemId = state.inventoryByPlayerId.get(playerId)?.[0]?.id;
    expect(inventoryItemId).toBeTruthy();

    const quoteResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        channel: 'street',
        inventoryItemId,
        quantity: 12,
      } satisfies DrugSaleInput,
      url: '/api/drug-sales/quote',
    });

    expect(quoteResponse.statusCode).toBe(200);
    const quoteBody = quoteResponse.json();

    expect(quoteBody.channel.id).toBe('street');
    expect(quoteBody.channel.staminaCost).toBe(5);
    expect(quoteBody.pricing.commissionAmount).toBeGreaterThan(0);
    expect(quoteBody.quantity.sellable).toBeGreaterThan(0);

    const sellResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        channel: 'street',
        inventoryItemId,
        quantity: 12,
      } satisfies DrugSaleInput,
      url: '/api/drug-sales/sell',
    });

    expect(sellResponse.statusCode).toBe(200);
    const sellBody = sellResponse.json();

    expect(sellBody.playerMoneyAfterSale).toBeGreaterThan(3000);
    expect(sellBody.playerStaminaAfterSale).toBe(95);
    expect(sellBody.quantity.remainingAfterSale).toBe(18 - sellBody.quantity.sellable);
  });

  it('requires a owned boca to sell through boca channel and uses local demand', async () => {
    const { accessToken, playerId } = await registerAndCreateCharacter(app, 'boca@example.com', 'bocador');

    await playerRepository.grantInventoryItem(playerId, {
      itemId: 'drug-1',
      itemType: 'drug',
      quantity: 60,
    });

    const inventoryItemId = state.inventoryByPlayerId.get(playerId)?.[0]?.id;
    expect(inventoryItemId).toBeTruthy();

    const missingPropertyResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        channel: 'boca',
        inventoryItemId,
        quantity: 30,
      } satisfies DrugSaleInput,
      url: '/api/drug-sales/quote',
    });

    expect(missingPropertyResponse.statusCode).toBe(400);

    const propertyId = randomUUID();
    state.propertiesById.set(propertyId, {
      createdAt: '2026-03-10T19:00:00.000Z',
      favelaPopulation: 72000,
      id: propertyId,
      level: 2,
      regionId: RegionId.ZonaNorte,
      type: 'boca',
    });
    state.propertiesByPlayerId.set(playerId, [
      {
        createdAt: '2026-03-10T19:00:00.000Z',
        favelaId: 'favela-1',
        id: propertyId,
        level: 2,
        regionId: RegionId.ZonaNorte,
        soldiersCount: 0,
        type: 'boca',
      },
    ]);

    const sellResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        channel: 'boca',
        inventoryItemId,
        propertyId,
        quantity: 30,
      } satisfies DrugSaleInput,
      url: '/api/drug-sales/sell',
    });

    expect(sellResponse.statusCode).toBe(200);
    const sellBody = sellResponse.json();

    expect(sellBody.channel.commissionRate).toBe(0);
    expect(sellBody.location.propertyType).toBe('boca');
    expect(sellBody.quantity.sellable).toBeGreaterThanOrEqual(30);
    expect(sellBody.pricing.finalUnitPrice).toBeGreaterThan(50);
  });

  it('sells through docks only when navio is active and applies the event multiplier', async () => {
    const { accessToken, playerId } = await registerAndCreateCharacter(
      app,
      'docks@example.com',
      'docksman',
    );
    const now = Date.now();
    const activeEventStart = new Date(now - 60_000);
    const activeEventEnd = new Date(now + 60 * 60 * 1000);

    await playerRepository.grantInventoryItem(playerId, {
      itemId: 'drug-2',
      itemType: 'drug',
      quantity: 1000,
    });

    state.events.push({
      endsAt: activeEventEnd,
      eventType: 'navio_docas',
      regionId: RegionId.Centro,
      startedAt: activeEventStart,
    });
    state.events.push({
      endsAt: activeEventEnd,
      eventType: 'seca_drogas',
      regionId: null,
      startedAt: activeEventStart,
    });

    const inventoryItemId = state.inventoryByPlayerId.get(playerId)?.[0]?.id;
    expect(inventoryItemId).toBeTruthy();

    const sellResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        channel: 'docks',
        inventoryItemId,
        quantity: 1000,
      } satisfies DrugSaleInput,
      url: '/api/drug-sales/sell',
    });

    expect(sellResponse.statusCode).toBe(200);
    const sellBody = sellResponse.json();

    expect(sellBody.channel.id).toBe('docks');
    expect(sellBody.channel.commissionRate).toBe(0);
    expect(sellBody.quantity.sellable).toBe(1000);
    expect(sellBody.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Navio nas docas',
          multiplier: 1.5,
        }),
        expect.objectContaining({
          label: 'Seca de drogas',
          multiplier: 1.5,
        }),
      ]),
    );
    expect(sellBody.pricing.finalUnitPrice).toBeGreaterThan(400);
  });
});
