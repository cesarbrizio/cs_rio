import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  DrugType,
  REGION_SPAWN_POINTS,
  VOCATION_BASE_ATTRIBUTES,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
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

const INVENTORY_DEFINITIONS: Record<string, InventoryDefinitionRecord> = {
  'drug:drug-1': {
    durabilityMax: null,
    equipment: null,
    itemId: 'drug-1',
    itemName: 'Maconha',
    itemType: 'drug',
    levelRequired: 2,
    stackable: true,
    unitWeight: 1,
  },
  'vest:vest-1': {
    durabilityMax: 180,
    equipment: {
      defense: 12,
      power: null,
      slot: 'vest',
    },
    itemId: 'vest-1',
    itemName: 'Colete de treino',
    itemType: 'vest',
    levelRequired: 2,
    stackable: false,
    unitWeight: 4,
  },
  'weapon:weapon-1': {
    durabilityMax: 120,
    equipment: {
      defense: null,
      power: 18,
      slot: 'weapon',
    },
    itemId: 'weapon-1',
    itemName: 'Pistola de treino',
    itemType: 'weapon',
    levelRequired: 2,
    stackable: false,
    unitWeight: 3,
  },
  'weapon:weapon-2': {
    durabilityMax: 90,
    equipment: {
      defense: null,
      power: 26,
      slot: 'weapon',
    },
    itemId: 'weapon-2',
    itemName: 'Escopeta curta',
    itemType: 'weapon',
    levelRequired: 2,
    stackable: false,
    unitWeight: 5,
  },
} as const;

class InMemoryPlayerRepository implements AuthRepository, PlayerRepository {
  private readonly players = new Map<string, AuthPlayerRecord>();

  private readonly inventoryByPlayerId = new Map<string, PlayerProfileRecord['inventory']>();

  async applyDrugOverdosePenalties(
    playerId: string,
    input: PlayerOverdosePenaltyInput,
  ): Promise<PlayerOverdosePenaltyResult | null> {
    const player = this.players.get(playerId);

    if (!player) {
      return null;
    }

    player.addiction = input.addiction;
    player.conceito = input.conceito;
    player.brisa = input.brisa;

    return {
      knownContactsLost: 0,
    };
  }

  setPlayerResources(
    playerId: string,
    input: Partial<Pick<AuthPlayerRecord, 'addiction' | 'brisa' | 'disposicao' | 'cansaco'>>,
  ): boolean {
    const player = this.players.get(playerId);

    if (!player) {
      return false;
    }

    if (typeof input.addiction === 'number') {
      player.addiction = input.addiction;
    }

    if (typeof input.brisa === 'number') {
      player.brisa = input.brisa;
    }

    if (typeof input.disposicao === 'number') {
      player.disposicao = input.disposicao;
    }

    if (typeof input.cansaco === 'number') {
      player.cansaco = input.cansaco;
    }

    return true;
  }

  damageInventoryItem(playerId: string, inventoryItemId: string, durability: number): boolean {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
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
      durability,
      equipSlot: durability > 0 ? current.equipSlot : null,
      isEquipped: durability > 0 ? current.isEquipped : false,
    };
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async clearInventoryEquipSlot(playerId: string, equipSlot: InventoryEquipSlot): Promise<void> {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    this.inventoryByPlayerId.set(
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
    const player = this.players.get(playerId);
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
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
    player.brisa = input.brisa;
    player.disposicao = input.disposicao;
    player.cansaco = input.cansaco;
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async createCharacter(
    playerId: string,
    input: {
      appearance: AuthPlayerRecord['appearanceJson'];
      vocation: VocationType;
    },
  ): Promise<PlayerProfileRecord | null> {
    const player = this.players.get(playerId);

    if (!player) {
      return null;
    }

    const attributes = VOCATION_BASE_ATTRIBUTES[input.vocation];
    const spawnPoint = REGION_SPAWN_POINTS[player.regionId as RegionId] ?? REGION_SPAWN_POINTS[RegionId.Centro];

    player.appearanceJson = input.appearance;
    player.carisma = attributes.carisma;
    player.characterCreatedAt = new Date('2026-03-10T14:00:00.000Z');
    player.conceito = 500;
    player.forca = attributes.forca;
    player.hp = 100;
    player.inteligencia = attributes.inteligencia;
    player.level = 4;
    player.brisa = 100;
    player.disposicao = 100;
    player.positionX = spawnPoint.positionX;
    player.positionY = spawnPoint.positionY;
    player.resistencia = attributes.resistencia;
    player.cansaco = 100;
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
      brisa: 100,
      money: '3000',
      disposicao: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 0,
      positionY: 0,
      regionId: RegionId.Centro,
      resistencia: 10,
      cansaco: 100,
      vocation: VocationType.Cria,
    };

    this.players.set(player.id, player);
    this.inventoryByPlayerId.set(player.id, []);
    return { ...player };
  }

  async deleteInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean> {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    const nextInventory = inventory.filter((item) => item.id !== inventoryItemId);

    if (nextInventory.length === inventory.length) {
      return false;
    }

    this.inventoryByPlayerId.set(playerId, nextInventory);
    return true;
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async getInventoryDefinition(itemType: InventoryItemType, itemId: string): Promise<InventoryDefinitionRecord | null> {
    return INVENTORY_DEFINITIONS[`${itemType}:${itemId}`] ?? null;
  }

  async getDrugDefinition(drugId: string) {
    return {
      addictionRate: 1,
      code: drugId,
      drugId,
      brisaBoost: 2,
      name: `mock-${drugId}`,
      disposicaoBoost: 3,
      productionLevel: 1,
      cansacoRecovery: 4,
      type: DrugType.Maconha,
    };
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    const player = this.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      faction: null,
      inventory: [...(this.inventoryByPlayerId.get(playerId) ?? [])],
      player: { ...player },
      properties: [],
    };
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      return;
    }

    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];

    if (definition.stackable) {
      const index = inventory.findIndex(
        (item) => item.itemType === input.itemType && item.itemId === input.itemId,
      );

      if (index >= 0) {
        const current = inventory[index];

        if (current) {
          inventory[index] = {
            ...current,
            quantity: current.quantity + input.quantity,
            totalWeight: current.unitWeight * (current.quantity + input.quantity),
          };
          this.inventoryByPlayerId.set(playerId, inventory);
          return;
        }
      }
    }

    inventory.push({
      durability: definition.durabilityMax,
      equipSlot: null,
      equipment: definition.equipment ?? null,
      id: randomUUID(),
      isEquipped: false,
      itemId: input.itemId,
      itemName: definition.itemName,
      itemType: input.itemType,
      levelRequired: definition.levelRequired,
      maxDurability: definition.durabilityMax,
      proficiency: 0,
      quantity: input.quantity,
      stackable: definition.stackable,
      totalWeight: definition.unitWeight * input.quantity,
      unitWeight: definition.unitWeight,
    });
    this.inventoryByPlayerId.set(playerId, inventory);
  }

  async setInventoryEquipSlot(
    playerId: string,
    inventoryItemId: string,
    equipSlot: InventoryEquipSlot | null,
  ): Promise<boolean> {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
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
      equipSlot,
      isEquipped: equipSlot !== null,
    };
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async repairInventoryItem(
    playerId: string,
    inventoryItemId: string,
    nextDurability: number,
    repairCost: number,
  ): Promise<boolean> {
    const player = this.players.get(playerId);
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    const index = inventory.findIndex((item) => item.id === inventoryItemId);

    if (!player || index < 0) {
      return false;
    }

    const current = inventory[index];

    if (!current) {
      return false;
    }

    inventory[index] = {
      ...current,
      durability: nextDurability,
    };
    player.money = (Number.parseFloat(player.money) - repairCost).toFixed(2);
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean> {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
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
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  async updateRuntimeState(playerId: string, input: PlayerRuntimeStateInput): Promise<void> {
    const player = this.players.get(playerId);

    if (!player) {
      return;
    }

    player.addiction = input.addiction;
    player.level = input.level;
    player.brisa = input.brisa;
    player.disposicao = input.disposicao;
    player.cansaco = input.cansaco;
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<
    string,
    {
      expiresAt: number | null;
      value: string;
    }
  >();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    return this.values.get(key)?.value ?? null;
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    this.cleanup(key);
    const current = Number(this.values.get(key)?.value ?? '0') + 1;
    this.values.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value: String(current),
    });
    return current;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      value,
    });
  }

  private cleanup(key: string): void {
    const entry = this.values.get(key);

    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
    }
  }
}

describe('inventory routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let repository: InMemoryPlayerRepository;

  beforeEach(async () => {
    repository = new InMemoryPlayerRepository();

    app = await createApp({
      authRepository: repository,
      keyValueStore: new InMemoryKeyValueStore(),
      playerRepository: repository,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('manages inventory acquisition, equip, stack updates and deletion', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'inventory.route@example.com',
        nickname: 'inventory_route',
        password: 'supersegura123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();
    const authorization = `Bearer ${session.accessToken}`;

    const beforeCharacterResponse = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/api/inventory',
    });

    expect(beforeCharacterResponse.statusCode).toBe(409);

    const createCharacterResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createCharacterResponse.statusCode).toBe(201);

    const firstWeaponResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-1',
        itemType: 'weapon',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });

    expect(firstWeaponResponse.statusCode).toBe(201);
    expect(firstWeaponResponse.json()).toMatchObject({
      capacity: {
        currentWeight: 3,
        usedSlots: 1,
      },
      items: [
        expect.objectContaining({
          equipment: {
            defense: null,
            power: 18,
            slot: 'weapon',
          },
        }),
      ],
    });

    const secondWeaponResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-2',
        itemType: 'weapon',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });

    const weaponInventory = secondWeaponResponse.json();
    const firstWeapon = weaponInventory.items.find((item: { itemId: string }) => item.itemId === 'weapon-1');
    const secondWeapon = weaponInventory.items.find((item: { itemId: string }) => item.itemId === 'weapon-2');

    expect(secondWeaponResponse.statusCode).toBe(201);
    expect(weaponInventory.capacity.usedSlots).toBe(2);

    const equipFirstResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${firstWeapon.id}/equip`,
    });

    expect(equipFirstResponse.statusCode).toBe(200);
    expect(equipFirstResponse.json().items.find((item: { id: string }) => item.id === firstWeapon.id)).toMatchObject({
      equipment: {
        defense: null,
        power: 18,
        slot: 'weapon',
      },
      equipSlot: 'weapon',
      isEquipped: true,
    });

    const equipSecondResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${secondWeapon.id}/equip`,
    });
    const equippedInventory = equipSecondResponse.json();

    expect(equipSecondResponse.statusCode).toBe(200);
    expect(equippedInventory.items.find((item: { id: string }) => item.id === firstWeapon.id)).toMatchObject({
      equipSlot: null,
      isEquipped: false,
    });
    expect(equippedInventory.items.find((item: { id: string }) => item.id === secondWeapon.id)).toMatchObject({
      equipment: {
        defense: null,
        power: 26,
        slot: 'weapon',
      },
      equipSlot: 'weapon',
      isEquipped: true,
    });

    expect(repository.damageInventoryItem(session.player.id, secondWeapon.id, 30)).toBe(true);

    const repairResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${secondWeapon.id}/repair`,
    });
    const repairPayload = repairResponse.json();

    expect(repairResponse.statusCode).toBe(200);
    expect(repairPayload).toMatchObject({
      repairCost: 420,
      repairedItem: {
        durability: 90,
        id: secondWeapon.id,
        maxDurability: 90,
      },
    });
    expect(await repository.findPlayerById(session.player.id)).toMatchObject({
      money: '2580.00',
    });

    const drugsResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'drug-1',
        itemType: 'drug',
        quantity: 5,
      },
      url: '/api/inventory/items',
    });

    const drugInventory = drugsResponse.json();
    const drugItem = drugInventory.items.find((item: { itemId: string }) => item.itemId === 'drug-1');

    expect(drugsResponse.statusCode).toBe(201);
    expect(drugInventory.capacity.currentWeight).toBe(13);

    const repairDrugResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${drugItem.id}/repair`,
    });

    expect(repairDrugResponse.statusCode).toBe(400);

    const updateDrugResponse = await app.inject({
      headers: { authorization },
      method: 'PATCH',
      payload: {
        quantity: 8,
      },
      url: `/api/inventory/${drugItem.id}`,
    });

    expect(updateDrugResponse.statusCode).toBe(200);
    expect(updateDrugResponse.json().items.find((item: { id: string }) => item.id === drugItem.id)).toMatchObject({
      quantity: 8,
      totalWeight: 8,
    });

    expect(
      repository.setPlayerResources(session.player.id, {
        addiction: 4,
        brisa: 97,
        disposicao: 95,
        cansaco: 88,
      }),
    ).toBe(true);

    const consumeDrugResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${drugItem.id}/consume`,
    });

    expect(consumeDrugResponse.statusCode).toBe(200);
    expect(consumeDrugResponse.json()).toMatchObject({
      consumedInventoryItemId: drugItem.id,
      drug: {
        id: 'drug-1',
        remainingQuantity: 7,
      },
      effects: {
        addictionGained: 1,
        brisaRecovered: 2,
        disposicaoRecovered: 3,
        cansacoRecovered: 4,
      },
      player: {
        inventory: expect.arrayContaining([
          expect.objectContaining({
            id: drugItem.id,
            quantity: 7,
          }),
        ]),
        resources: expect.objectContaining({
          addiction: 5,
          brisa: 99,
          disposicao: 98,
          cansaco: 92,
        }),
      },
      tolerance: {
        current: 2,
        drugId: 'drug-1',
        increasedBy: 2,
      },
    });

    const overweightResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'drug-1',
        itemType: 'drug',
        quantity: 70,
      },
      url: '/api/inventory/items',
    });

    expect(overweightResponse.statusCode).toBe(409);

    const deleteWeaponResponse = await app.inject({
      headers: { authorization },
      method: 'DELETE',
      url: `/api/inventory/${firstWeapon.id}`,
    });

    expect(deleteWeaponResponse.statusCode).toBe(200);
    expect(deleteWeaponResponse.json()).toMatchObject({
      capacity: {
        usedSlots: 2,
      },
    });
  });

  it('blocks equipping broken gear and allows unequip for armor', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'inventory.b85@example.com',
        nickname: 'inventory_b85',
        password: 'supersegura123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();
    const authorization = `Bearer ${session.accessToken}`;

    const createCharacterResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createCharacterResponse.statusCode).toBe(201);

    const weaponResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-1',
        itemType: 'weapon',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });
    const vestResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        itemId: 'vest-1',
        itemType: 'vest',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });

    const weaponItem = weaponResponse.json().items.find((item: { itemId: string }) => item.itemId === 'weapon-1');
    const vestItem = vestResponse.json().items.find((item: { itemId: string }) => item.itemId === 'vest-1');

    expect(repository.damageInventoryItem(session.player.id, weaponItem.id, 0)).toBe(true);

    const equipBrokenWeaponResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${weaponItem.id}/equip`,
    });

    expect(equipBrokenWeaponResponse.statusCode).toBe(409);
    expect(equipBrokenWeaponResponse.json()).toMatchObject({
      message: 'Pistola de treino esta quebrado e precisa de reparo antes de equipar.',
    });

    const equipVestResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${vestItem.id}/equip`,
    });

    expect(equipVestResponse.statusCode).toBe(200);
    expect(equipVestResponse.json().items.find((item: { id: string }) => item.id === vestItem.id)).toMatchObject({
      equipment: {
        defense: 12,
        power: null,
        slot: 'vest',
      },
      equipSlot: 'vest',
      isEquipped: true,
    });

    const unequipVestResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/api/inventory/${vestItem.id}/unequip`,
    });

    expect(unequipVestResponse.statusCode).toBe(200);
    expect(unequipVestResponse.json().items.find((item: { id: string }) => item.id === vestItem.id)).toMatchObject({
      equipSlot: null,
      isEquipped: false,
    });
  });
});
