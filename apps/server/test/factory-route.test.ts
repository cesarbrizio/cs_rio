import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  REGION_SPAWN_POINTS,
  VOCATION_BASE_ATTRIBUTES,
  type DrugFactoryCreateInput,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { FactoryService, type FactoryRepository } from '../src/services/factory.js';
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

const COMPONENT_DEFINITIONS: Record<string, InventoryDefinitionRecord> = {
  'component:component-1': {
    durabilityMax: null,
    itemId: 'component-1',
    itemName: 'Precursor base',
    itemType: 'component',
    levelRequired: null,
    stackable: true,
    unitWeight: 1,
  },
  'component:component-2': {
    durabilityMax: null,
    itemId: 'component-2',
    itemName: 'Embalagem zip',
    itemType: 'component',
    levelRequired: null,
    stackable: true,
    unitWeight: 1,
  },
  'drug:drug-1': {
    durabilityMax: null,
    itemId: 'drug-1',
    itemName: 'Maconha',
    itemType: 'drug',
    levelRequired: 2,
    stackable: true,
    unitWeight: 1,
  },
} as const;

interface TestFactoryRecord {
  createdAt: Date;
  drugId: string;
  id: string;
  impulseMultiplier: number;
  lastCycleAt: Date;
  lastMaintenanceAt: Date;
  regionId: RegionId;
  requirements: Array<{
    componentId: string;
    componentName: string;
    quantityPerCycle: number;
  }>;
  storedOutput: number;
  suspended: boolean;
}

interface TestState {
  factories: Map<string, TestFactoryRecord>;
  inventoryByPlayerId: Map<string, PlayerProfileRecord['inventory']>;
  players: Map<string, AuthPlayerRecord>;
  propertiesByPlayerId: Map<string, PlayerProfileRecord['properties']>;
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
    return {
      addictionRate: 1,
      code: drugId,
      drugId,
      moralBoost: 2,
      name: 'Maconha',
      nerveBoost: 0,
      productionLevel: 2,
      staminaRecovery: 1,
      type: 'maconha' as const,
    };
  }

  async getInventoryDefinition(itemType: InventoryItemType, itemId: string): Promise<InventoryDefinitionRecord | null> {
    return COMPONENT_DEFINITIONS[`${itemType}:${itemId}`] ?? null;
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

  setPlayerMoney(playerId: string, money: number): void {
    const player = this.state.players.get(playerId);

    if (player) {
      player.money = money.toFixed(2);
    }
  }
}

class InMemoryFactoryRepository implements FactoryRepository {
  constructor(private readonly state: TestState) {}

  async applyFactoryState(playerId: string, input: {
    componentQuantities: Array<{ componentId: string; quantity: number }>;
    factoryId: string;
    lastCycleAt: Date;
    lastMaintenanceAt: Date;
    moneySpent: number;
    storedOutput: number;
    suspended: boolean;
  }): Promise<boolean> {
    const player = this.state.players.get(playerId);
    const factory = this.state.factories.get(input.factoryId);

    if (!player || !factory) {
      return false;
    }

    player.money = (Number.parseFloat(player.money) - input.moneySpent).toFixed(2);
    factory.lastCycleAt = input.lastCycleAt;
    factory.lastMaintenanceAt = input.lastMaintenanceAt;
    factory.storedOutput = input.storedOutput;
    factory.suspended = input.suspended;
    factory.requirements = factory.requirements.map((requirement) => ({
      ...requirement,
      availableQuantity:
        input.componentQuantities.find((entry) => entry.componentId === requirement.componentId)?.quantity ?? 0,
    }));
    this.state.factories.set(factory.id, factory);
    return true;
  }

  async collectFactoryOutput(playerId: string, factoryId: string, quantity: number): Promise<boolean> {
    const factory = this.state.factories.get(factoryId);
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];

    if (!factory || factory.storedOutput < quantity) {
      return false;
    }

    factory.storedOutput -= quantity;
    this.state.factories.set(factory.id, factory);

    const existingIndex = inventory.findIndex((item) => item.itemType === 'drug' && item.itemId === factory.drugId);

    if (existingIndex >= 0) {
      const current = inventory[existingIndex];

      if (current) {
        inventory[existingIndex] = {
          ...current,
          quantity: current.quantity + quantity,
          totalWeight: current.unitWeight * (current.quantity + quantity),
        };
      }
    } else {
      inventory.push({
        durability: null,
        equipSlot: null,
        id: randomUUID(),
        isEquipped: false,
        itemId: factory.drugId,
        itemName: 'Maconha',
        itemType: 'drug',
        levelRequired: 2,
        maxDurability: null,
        proficiency: 0,
        quantity,
        stackable: true,
        totalWeight: quantity,
        unitWeight: 1,
      });
    }

    this.state.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async createFactory(input: {
    drugId: string;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
  }) {
    const factoryId = randomUUID();

    this.state.factories.set(factoryId, {
      createdAt: input.startedAt,
      drugId: input.drugId,
      id: factoryId,
      impulseMultiplier: 1,
      lastCycleAt: input.startedAt,
      lastMaintenanceAt: input.startedAt,
      regionId: input.regionId,
      requirements: [
        {
          availableQuantity: 0,
          componentId: 'component-1',
          componentName: 'Precursor base',
          quantityPerCycle: 2,
        },
        {
          availableQuantity: 0,
          componentId: 'component-2',
          componentName: 'Embalagem zip',
          quantityPerCycle: 1,
        },
      ],
      storedOutput: 0,
      suspended: false,
    });

    const properties = this.state.propertiesByPlayerId.get(input.playerId) ?? [];
    properties.push({
      createdAt: input.startedAt.toISOString(),
      favelaId: null,
      id: factoryId,
      level: 1,
      regionId: input.regionId,
      soldiersCount: 0,
      type: 'factory',
    });
    this.state.propertiesByPlayerId.set(input.playerId, properties);

    return this.getFactory(input.playerId, factoryId);
  }

  async getFactory(playerId: string, factoryId: string) {
    const playerProperties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    if (!playerProperties.some((property) => property.id === factoryId)) {
      return null;
    }

    const factory = this.state.factories.get(factoryId);

    if (!factory) {
      return null;
    }

    return {
      baseProduction: 10,
      createdAt: factory.createdAt,
      cycleMinutes: 60,
      dailyMaintenanceCost: 1000,
      drugId: factory.drugId,
      drugName: 'Maconha',
      id: factory.id,
      impulseMultiplier: factory.impulseMultiplier,
      lastCycleAt: factory.lastCycleAt,
      lastMaintenanceAt: factory.lastMaintenanceAt,
      levelRequired: 2,
      regionId: factory.regionId,
      requirements: factory.requirements.map((requirement) => ({ ...requirement })),
      storedOutput: factory.storedOutput,
      suspended: factory.suspended,
    };
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    return player
      ? {
          characterCreatedAt: player.characterCreatedAt,
          id: player.id,
          inteligencia: player.inteligencia,
          level: player.level,
          money: Number.parseFloat(player.money),
          regionId: player.regionId as RegionId,
          vocation: player.vocation as VocationType,
        }
      : null;
  }

  async getRecipe(drugId: string) {
    if (drugId !== 'drug-1') {
      return null;
    }

    return {
      baseProduction: 10,
      cycleMinutes: 60,
      dailyMaintenanceCost: 1000,
      drugId: 'drug-1',
      drugName: 'Maconha',
      levelRequired: 2,
      requirements: [
        {
          availableQuantity: 0,
          componentId: 'component-1',
          componentName: 'Precursor base',
          quantityPerCycle: 2,
        },
        {
          availableQuantity: 0,
          componentId: 'component-2',
          componentName: 'Embalagem zip',
          quantityPerCycle: 1,
        },
      ],
    };
  }

  async listFactories(playerId: string) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];

    return properties
      .filter((property) => property.type === 'factory')
      .flatMap((property) => {
        const factory = this.state.factories.get(property.id);

        if (!factory) {
          return [];
        }

        return [
          {
            baseProduction: 10,
            createdAt: factory.createdAt,
            cycleMinutes: 60,
            dailyMaintenanceCost: 1000,
            drugId: factory.drugId,
            drugName: 'Maconha',
            id: factory.id,
            impulseMultiplier: factory.impulseMultiplier,
            lastCycleAt: factory.lastCycleAt,
            lastMaintenanceAt: factory.lastMaintenanceAt,
            levelRequired: 2,
            regionId: property.regionId,
            requirements: factory.requirements.map((requirement) => ({ ...requirement })),
            storedOutput: factory.storedOutput,
            suspended: factory.suspended,
          },
        ];
      });
  }

  async listRecipes() {
    return [
      {
        baseProduction: 10,
        cycleMinutes: 60,
        dailyMaintenanceCost: 1000,
        drugId: 'drug-1',
        drugName: 'Maconha',
        levelRequired: 2,
        requirements: [
          {
            availableQuantity: 0,
            componentId: 'component-1',
            componentName: 'Precursor base',
            quantityPerCycle: 2,
          },
          {
            availableQuantity: 0,
            componentId: 'component-2',
            componentName: 'Embalagem zip',
            quantityPerCycle: 1,
          },
        ],
      },
    ];
  }

  async stockFactoryComponent(playerId: string, factoryId: string, inventoryItemId: string, quantity: number) {
    const properties = this.state.propertiesByPlayerId.get(playerId) ?? [];
    const inventory = this.state.inventoryByPlayerId.get(playerId) ?? [];
    const factory = this.state.factories.get(factoryId);

    if (!properties.some((property) => property.id === factoryId) || !factory) {
      return null;
    }

    const index = inventory.findIndex((item) => item.id === inventoryItemId && item.itemType === 'component');

    if (index < 0) {
      return null;
    }

    const current = inventory[index];

    if (!current || !current.itemId || current.quantity < quantity) {
      return null;
    }

    const requirement = factory.requirements.find((entry) => entry.componentId === current.itemId);

    if (!requirement) {
      return null;
    }

    if (current.quantity === quantity) {
      inventory.splice(index, 1);
    } else {
      inventory[index] = {
        ...current,
        quantity: current.quantity - quantity,
        totalWeight: current.unitWeight * (current.quantity - quantity),
      };
    }

    requirement.availableQuantity += quantity;
    this.state.inventoryByPlayerId.set(playerId, inventory);
    this.state.factories.set(factoryId, factory);

    return {
      componentId: requirement.componentId,
      componentName: requirement.componentName,
      transferredQuantity: quantity,
    };
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
    const current = Number(this.values.get(key) ?? '0') + 1;
    this.values.set(key, String(current));
    return current;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('factory routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let now: Date;
  let playerRepository: InMemoryPlayerRepository;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T14:00:00.000Z');
    state = {
      factories: new Map(),
      inventoryByPlayerId: new Map(),
      players: new Map(),
      propertiesByPlayerId: new Map(),
    };
    playerRepository = new InMemoryPlayerRepository(state);
    const keyValueStore = new InMemoryKeyValueStore();

    app = await createApp({
      authRepository: playerRepository,
      factoryService: new FactoryService({
        keyValueStore,
        now: () => now,
        repository: new InMemoryFactoryRepository(state),
      }),
      keyValueStore,
      playerRepository,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a factory, stocks components, produces by cycle and collects output', async () => {
    const session = await registerAndCreateCharacter(app, {
      email: 'factory.route@example.com',
      nickname: 'factory_route',
      vocation: VocationType.Gerente,
    });
    const authorization = `Bearer ${session.accessToken}`;

    const precursorInventory = await grantInventoryItem(app, authorization, {
      itemId: 'component-1',
      itemType: 'component',
      quantity: 4,
    });
    const packagingInventory = await grantInventoryItem(app, authorization, {
      itemId: 'component-2',
      itemType: 'component',
      quantity: 2,
    });
    const precursorItem = precursorInventory.items.find((item: { itemId: string | null }) => item.itemId === 'component-1');
    const packagingItem = packagingInventory.items.find((item: { itemId: string | null }) => item.itemId === 'component-2');

    const createFactoryResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        drugId: 'drug-1',
      } satisfies DrugFactoryCreateInput,
      url: '/api/factories',
    });

    expect(createFactoryResponse.statusCode).toBe(201);
    const createdFactory = createFactoryResponse.json().factory;
    expect(createdFactory).toMatchObject({
      cycleMinutes: 60,
      dailyMaintenanceCost: 1000,
      drugId: 'drug-1',
      outputPerCycle: 11,
      regionId: RegionId.Centro,
    });

    const stockPrecursorResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        inventoryItemId: precursorItem.id,
        quantity: 4,
      },
      url: `/api/factories/${createdFactory.id}/components`,
    });

    expect(stockPrecursorResponse.statusCode).toBe(200);

    const stockPackagingResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        inventoryItemId: packagingItem.id,
        quantity: 2,
      },
      url: `/api/factories/${createdFactory.id}/components`,
    });

    expect(stockPackagingResponse.statusCode).toBe(200);

    now = new Date('2026-03-10T16:00:00.000Z');

    const listFactoriesResponse = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/api/factories',
    });

    expect(listFactoriesResponse.statusCode).toBe(200);
    expect(listFactoriesResponse.json()).toMatchObject({
      availableRecipes: expect.arrayContaining([
        expect.objectContaining({
          drugId: 'drug-1',
        }),
      ]),
      factories: [
        expect.objectContaining({
          id: createdFactory.id,
          blockedReason: null,
          maintenanceStatus: {
            blocked: false,
            moneySpentOnSync: 0,
            overdueDays: 0,
          },
          outputPerCycle: 11,
          storedOutput: 22,
        }),
      ],
    });

    const collectResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/factories/${createdFactory.id}/collect`,
    });

    expect(collectResponse.statusCode).toBe(200);
    expect(collectResponse.json()).toMatchObject({
      collectedQuantity: 22,
      drug: {
        id: 'drug-1',
        name: 'Maconha',
      },
      factory: {
        id: createdFactory.id,
        storedOutput: 0,
      },
    });
  });

  it('blocks production when maintenance is overdue and the player has no cash to cover it', async () => {
    const session = await registerAndCreateCharacter(app, {
      email: 'factory.maintenance@example.com',
      nickname: 'factory_maint',
      vocation: VocationType.Cria,
    });
    const authorization = `Bearer ${session.accessToken}`;
    playerRepository.setPlayerMoney(session.player.id, 500);

    const createFactoryResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        drugId: 'drug-1',
      } satisfies DrugFactoryCreateInput,
      url: '/api/factories',
    });
    const createdFactory = createFactoryResponse.json().factory;

    now = new Date('2026-03-12T15:00:00.000Z');

    const listFactoriesResponse = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/api/factories',
    });

    expect(listFactoriesResponse.statusCode).toBe(200);
    expect(listFactoriesResponse.json().factories[0]).toMatchObject({
      id: createdFactory.id,
      blockedReason: 'maintenance',
      maintenanceStatus: {
        blocked: true,
        moneySpentOnSync: 0,
        overdueDays: 2,
      },
      storedOutput: 0,
    });
  });
});

async function grantInventoryItem(
  app: Awaited<ReturnType<typeof createApp>>,
  authorization: string,
  input: InventoryGrantInput,
) {
  const response = await app.inject({
    headers: { authorization },
    method: 'POST',
    payload: input,
    url: '/api/inventory/items',
  });

  expect(response.statusCode).toBe(201);
  return response.json();
}

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
  input: {
    email: string;
    nickname: string;
    vocation: VocationType;
  },
) {
  const registerResponse = await app.inject({
    method: 'POST',
    payload: {
      email: input.email,
      nickname: input.nickname,
      password: 'supersegura123',
    },
    url: '/api/auth/register',
  });
  const session = registerResponse.json();

  const createCharacterResponse = await app.inject({
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
    method: 'POST',
    payload: {
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      vocation: input.vocation,
    },
    url: '/api/players/create',
  });

  expect(registerResponse.statusCode).toBe(201);
  expect(createCharacterResponse.statusCode).toBe(201);
  return session;
}
