import { randomUUID } from 'node:crypto';

import {
  CrimeType,
  DEFAULT_CHARACTER_APPEARANCE,
  DrugType,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogResponse,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  RegionId,
  VocationType,
  type CrimeAttemptResponse,
  type CrimeCatalogResponse,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { AuthPlayerRecord, AuthRepository, KeyValueStore } from '../src/services/auth.js';
import type { CrimeServiceContract } from '../src/services/crime.js';
import type {
  PlayerDrugConsumptionInput,
  type PlayerOverdosePenaltyInput,
  type PlayerOverdosePenaltyResult,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
} from '../src/services/player.js';

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
    player.morale = input.morale;

    return {
      knownContactsLost: 0,
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
      characterCreatedAt: new Date('2026-03-10T10:00:00.000Z'),
      conceito: 500,
      createdAt: new Date(),
      email: input.email,
      factionId: null,
      forca: 25,
      hp: 100,
      id: randomUUID(),
      inteligencia: 20,
      lastLogin: input.lastLogin,
      level: 4,
      morale: 100,
      money: '1000',
      nerve: 80,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 0,
      positionY: 0,
      regionId: RegionId.Centro,
      resistencia: 18,
      stamina: 90,
      vocation: VocationType.Cria,
    };

    this.players.set(player.id, player);
    this.inventoryByPlayerId.set(player.id, []);
    return { ...player };
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
    player.morale = input.morale;
    player.nerve = input.nerve;
    player.stamina = input.stamina;
    this.inventoryByPlayerId.set(playerId, inventory);
    return true;
  }

  async createCharacter(): Promise<PlayerProfileRecord | null> {
    return null;
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

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    const player = this.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      faction: null,
      inventory: this.inventoryByPlayerId.get(playerId) ?? [],
      player: { ...player },
      properties: [],
    };
  }

  async getInventoryDefinition(itemType: InventoryItemType, itemId: string) {
    return {
      durabilityMax: itemType === 'drug' ? null : 100,
      itemId,
      itemName: `mock-${itemType}`,
      itemType,
      levelRequired: 1,
      stackable: itemType === 'drug',
      unitWeight: itemType === 'drug' ? 1 : 3,
    };
  }

  async getDrugDefinition(drugId: string) {
    return {
      addictionRate: 1,
      code: drugId,
      drugId,
      moralBoost: 2,
      name: `mock-${drugId}`,
      nerveBoost: 3,
      productionLevel: 1,
      staminaRecovery: 4,
      type: DrugType.Maconha,
    };
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      return;
    }

    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    inventory.push({
      durability: definition.durabilityMax,
      equipSlot: null,
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
    player.morale = input.morale;
    player.nerve = input.nerve;
    player.stamina = input.stamina;
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
    const nextValue = Number(this.values.get(key) ?? '0') + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

class FakeCrimeService implements CrimeServiceContract {
  async attemptCrime(playerId: string, crimeId: string): Promise<CrimeAttemptResponse> {
    return {
      arrestChance: 0,
      arrested: false,
      chance: 0.74,
      crimeId,
      crimeName: 'Roubar celular no sinal',
      cooldownRemainingSeconds: 180,
      conceitoDelta: 12,
      drop: null,
      heatAfter: 4,
      heatBefore: 0,
      hpDelta: 0,
      leveledUp: false,
      level: 4,
      message: `Crime ${crimeId} executado para ${playerId}.`,
      moneyDelta: 1250,
      nextConceitoRequired: 1500,
      nextLevel: 5,
      nerveSpent: 0,
      playerPower: 980,
      resources: {
        addiction: 0,
        conceito: 512,
        hp: 100,
        money: 2250,
        nerve: 80,
        stamina: 75,
      },
      staminaSpent: 15,
      success: true,
    };
  }

  async attemptFactionCrime(
    playerId: string,
    factionId: string,
    crimeId: string,
    input: FactionCrimeAttemptInput,
  ): Promise<FactionCrimeAttemptResponse> {
    return {
      busted: false,
      bustedChance: 0,
      chance: 0.81,
      combinedPower: 4200,
      conceitoRewardPerParticipant: 120,
      cooldownRemainingSeconds: 3600,
      coordinationMultiplier: 1.06,
      crimeId,
      crimeName: 'Roubo a banco central em bonde',
      factionId,
      message: `Bonde coordenado por ${playerId} com ${input.participantIds.length + 1} membros.`,
      minimumPowerRequired: 3000,
      participantCount: input.participantIds.length + 1,
      participants: [
        {
          conceitoDelta: 120,
          hpDelta: 0,
          id: playerId,
          level: 5,
          leveledUp: false,
          moneyDelta: 75000,
          nerveSpent: 20,
          nickname: 'crime_route',
          playerPower: 2100,
          rank: 'patrao',
          resources: {
            conceito: 620,
            hp: 100,
            money: 76000,
            nerve: 60,
            stamina: 60,
          },
          staminaSpent: 30,
        },
      ],
      rewardTotal: 150000,
      success: true,
    };
  }

  async getCatalog(playerId: string): Promise<CrimeCatalogResponse> {
    return {
      crimes: [
        {
          arrestChance: 5,
          cooldownRemainingSeconds: 0,
          estimatedSuccessChance: 74,
          id: 'crime-1',
          isLocked: false,
          isOnCooldown: false,
          isRunnable: true,
          levelRequired: 1,
          lockReason: null,
          minPower: 50,
          name: `Roubar celular no sinal (${playerId})`,
          playerPower: 980,
          nerveCost: 0,
          conceitoReward: 12,
          rewardMax: 2200,
          rewardMin: 1000,
          staminaCost: 15,
          type: CrimeType.Solo,
        },
      ],
    };
  }

  async getFactionCatalog(playerId: string, factionId: string): Promise<FactionCrimeCatalogResponse> {
    return {
      coordinatorCanStart: true,
      crimes: [
        {
          arrestChance: 18,
          conceitoReward: 120,
          cooldownRemainingSeconds: 0,
          id: 'crime-faccao-1',
          isLocked: false,
          isOnCooldown: false,
          isRunnable: true,
          levelRequired: 5,
          lockReason: null,
          maximumCrewSize: 6,
          minimumCrewSize: 2,
          minPower: 15000,
          name: `Roubo a banco central em bonde (${playerId})`,
          nerveCost: 20,
          rewardMax: 1200000,
          rewardMin: 300000,
          staminaCost: 30,
          type: CrimeType.Faccao,
        },
      ],
      factionId,
      members: [
        {
          id: playerId,
          isCoordinatorEligible: true,
          level: 5,
          lockReason: null,
          nickname: 'crime_route',
          playerPower: 2100,
          rank: 'patrao',
          resources: {
            hp: 100,
            nerve: 80,
            stamina: 90,
          },
        },
      ],
      playerFactionId: factionId,
    };
  }
}

describe('crime routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    const repository = new InMemoryPlayerRepository();

    app = await createApp({
      authRepository: repository,
      crimeService: new FakeCrimeService(),
      keyValueStore: new InMemoryKeyValueStore(),
      playerRepository: repository,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists crimes and attempts one with the authenticated player', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'crime.route@example.com',
        nickname: 'crime_route',
        password: 'supersegura123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();
    const authorization = `Bearer ${session.accessToken}`;

    const catalogResponse = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/api/crimes',
    });

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json()).toMatchObject({
      crimes: [
        {
          id: 'crime-1',
          isRunnable: true,
        },
      ],
    });

    const attemptResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: '/api/crimes/crime-1/attempt',
    });

    expect(attemptResponse.statusCode).toBe(200);
    expect(attemptResponse.json()).toMatchObject({
      crimeId: 'crime-1',
      moneyDelta: 1250,
      success: true,
    });
  });

  it('lists faction crimes and starts a coordinated faction attempt', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'crime.route.faction@example.com',
        nickname: 'crimefaccao',
        password: 'supersegura123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();
    const authorization = `Bearer ${session.accessToken}`;

    const catalogResponse = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/api/crimes/faction/faction-1',
    });

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json()).toMatchObject({
      coordinatorCanStart: true,
      crimes: [
        {
          id: 'crime-faccao-1',
          isRunnable: true,
          minimumCrewSize: 2,
        },
      ],
      factionId: 'faction-1',
    });

    const attemptResponse = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: {
        participantIds: ['membro-2'],
      } satisfies FactionCrimeAttemptInput,
      url: '/api/crimes/faction/faction-1/crime-faccao-1/attempt',
    });

    expect(attemptResponse.statusCode).toBe(200);
    expect(attemptResponse.json()).toMatchObject({
      crimeId: 'crime-faccao-1',
      factionId: 'faction-1',
      participantCount: 2,
      rewardTotal: 150000,
      success: true,
    });
  });
});
