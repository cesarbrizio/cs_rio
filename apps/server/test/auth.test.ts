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
  PlayerDrugConsumptionInput,
  type PlayerOverdosePenaltyInput,
  type PlayerOverdosePenaltyResult,
  PlayerPublicProfileRecord,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
} from '../src/services/player.js';

class InMemoryPlayerRepository implements AuthRepository, PlayerRepository {
  private readonly players = new Map<string, AuthPlayerRecord>();

  private readonly factionByPlayerId = new Map<string, PlayerProfileRecord['faction']>();

  private readonly inventoryByPlayerId = new Map<string, PlayerProfileRecord['inventory']>();

  private readonly propertiesByPlayerId = new Map<string, PlayerProfileRecord['properties']>();

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

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player: AuthPlayerRecord = {
      addiction: 0,
      bankMoney: '0',
      carisma: 10,
      conceito: 0,
      createdAt: new Date(),
      email: input.email,
      factionId: null,
      forca: 10,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 1,
      brisa: 100,
      money: '0',
      disposicao: 100,
      nickname: input.nickname,
      appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
      characterCreatedAt: null,
      passwordHash: input.passwordHash,
      positionX: 0,
      positionY: 0,
      regionId: RegionId.Centro,
      resistencia: 10,
      cansaco: 100,
      vocation: VocationType.Cria,
    };

    this.players.set(player.id, player);
    this.factionByPlayerId.set(player.id, null);
    this.inventoryByPlayerId.set(player.id, []);
    this.propertiesByPlayerId.set(player.id, []);
    return {
      ...player,
    };
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
    player.characterCreatedAt = new Date();
    player.conceito = 0;
    player.forca = attributes.forca;
    player.hp = 100;
    player.inteligencia = attributes.inteligencia;
    player.level = 1;
    player.brisa = 100;
    player.disposicao = 100;
    player.positionX = spawnPoint.positionX;
    player.positionY = spawnPoint.positionY;
    player.resistencia = attributes.resistencia;
    player.cansaco = 100;
    player.vocation = input.vocation;

    return this.getPlayerProfile(playerId);
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
        return {
          ...player,
        };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.players.get(id);
    return player
      ? {
          ...player,
        }
      : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.players.values()) {
      if (player.nickname === nickname) {
        return {
          ...player,
        };
      }
    }

    return null;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    const player = this.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      faction: this.factionByPlayerId.get(playerId) ?? null,
      inventory: this.inventoryByPlayerId.get(playerId) ?? [],
      player: {
        ...player,
      },
      properties: this.propertiesByPlayerId.get(playerId) ?? [],
    };
  }

  async getPublicProfileByNickname(nickname: string): Promise<PlayerPublicProfileRecord | null> {
    const player = [...this.players.values()].find(
      (entry) => entry.nickname === nickname && entry.characterCreatedAt !== null,
    );

    if (!player) {
      return null;
    }

    const rankedPlayers = [...this.players.values()]
      .filter((entry) => entry.characterCreatedAt !== null)
      .sort((left, right) => {
        if (left.conceito !== right.conceito) {
          return right.conceito - left.conceito;
        }

        if (left.level !== right.level) {
          return right.level - left.level;
        }

        const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();

        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }

        return left.nickname.localeCompare(right.nickname, 'pt-BR');
      });
    const currentRank = rankedPlayers.findIndex((entry) => entry.id === player.id) + 1;

    return {
      faction: this.factionByPlayerId.get(player.id) ?? null,
      inventoryItemCount: (this.inventoryByPlayerId.get(player.id) ?? []).length,
      player: {
        ...player,
      },
      propertiesCount: (this.propertiesByPlayerId.get(player.id) ?? []).length,
      ranking: {
        currentRank,
        totalPlayers: rankedPlayers.length,
      },
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
      brisaBoost: 2,
      name: `mock-${drugId}`,
      disposicaoBoost: 3,
      productionLevel: 1,
      cansacoRecovery: 4,
      type: DrugType.Maconha,
    };
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      return;
    }

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

describe('auth routes', () => {
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

  it('registers a player and allows access to protected routes with the access token', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player01@csrio.test',
        nickname: 'Player_01',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    expect(registerResponse.statusCode).toBe(201);
    const session = registerResponse.json();

    expect(session).toMatchObject({
      expiresIn: 900,
      player: {
        nickname: 'Player_01',
      },
      refreshExpiresIn: 2592000,
    });
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      hasCharacter: false,
      id: session.player.id,
      inventory: [],
      level: 1,
      location: {
        positionX: 0,
        positionY: 0,
        regionId: RegionId.Centro,
      },
      nickname: 'Player_01',
      properties: [],
      regionId: RegionId.Centro,
      vocation: VocationType.Cria,
    });
  });

  it('exposes a public profile by nickname without requiring bearer auth', async () => {
    const firstRegisterResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'public01@csrio.test',
        nickname: 'Public_01',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const secondRegisterResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'public02@csrio.test',
        nickname: 'Public_02',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const firstSession = firstRegisterResponse.json();
    const secondSession = secondRegisterResponse.json();

    await app.inject({
      headers: {
        authorization: `Bearer ${firstSession.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });
    await app.inject({
      headers: {
        authorization: `Bearer ${secondSession.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Gerente,
      },
      url: '/api/players/create',
    });

    const repositoryState = repository as unknown as {
      players: Map<string, AuthPlayerRecord>;
    };
    const firstPlayer = repositoryState.players.get(firstSession.player.id);
    const secondPlayer = repositoryState.players.get(secondSession.player.id);

    if (!firstPlayer || !secondPlayer) {
      throw new Error('test players not found');
    }

    firstPlayer.conceito = 420;
    firstPlayer.level = 9;
    secondPlayer.conceito = 180;
    secondPlayer.level = 5;

    const publicResponse = await app.inject({
      method: 'GET',
      url: '/api/players/public/Public_02',
    });

    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json()).toMatchObject({
      conceito: 180,
      faction: null,
      id: secondSession.player.id,
      level: 5,
      location: {
        positionX: REGION_SPAWN_POINTS[RegionId.Centro].positionX,
        positionY: REGION_SPAWN_POINTS[RegionId.Centro].positionY,
        regionId: RegionId.Centro,
      },
      nickname: 'Public_02',
      ranking: {
        currentRank: 2,
        totalPlayers: 2,
      },
      regionId: RegionId.Centro,
      title: 'soldado',
      visibility: {
        inventoryItemCount: 0,
        preciseLocationVisible: true,
        propertyCount: 0,
      },
      vocation: VocationType.Gerente,
    });
  });

  it('keeps accounts without character creation out of the public profile surface', async () => {
    await app.inject({
      method: 'POST',
      payload: {
        email: 'public03@csrio.test',
        nickname: 'Public_03',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/players/public/Public_03',
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects duplicate register attempts by email or nickname', async () => {
    await app.inject({
      method: 'POST',
      payload: {
        email: 'player02@csrio.test',
        nickname: 'Player_02',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    const duplicateEmailResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player02@csrio.test',
        nickname: 'OutroNick',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    expect(duplicateEmailResponse.statusCode).toBe(409);

    const duplicateNicknameResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player03@csrio.test',
        nickname: 'Player_02',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    expect(duplicateNicknameResponse.statusCode).toBe(409);
  });

  it('logs in with the correct password and rate limits the sixth failed attempt', async () => {
    await app.inject({
      method: 'POST',
      payload: {
        email: 'player04@csrio.test',
        nickname: 'Player_04',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });

    const loginResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player04@csrio.test',
        password: 'segredo123',
      },
      url: '/api/auth/login',
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json().accessToken).toEqual(expect.any(String));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrongPasswordResponse = await app.inject({
        method: 'POST',
        payload: {
          email: 'player04@csrio.test',
          password: 'senha_errada',
        },
        url: '/api/auth/login',
      });

      expect(wrongPasswordResponse.statusCode).toBe(401);
    }

    const rateLimitedResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player04@csrio.test',
        password: 'senha_errada',
      },
      url: '/api/auth/login',
    });

    expect(rateLimitedResponse.statusCode).toBe(429);
  });

  it('rotates refresh tokens and blacklists the previous refresh token', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player05@csrio.test',
        nickname: 'Player_05',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();

    const refreshResponse = await app.inject({
      method: 'POST',
      payload: {
        refreshToken: session.refreshToken,
      },
      url: '/api/auth/refresh',
    });

    expect(refreshResponse.statusCode).toBe(200);
    const rotatedSession = refreshResponse.json();
    expect(rotatedSession.refreshToken).not.toBe(session.refreshToken);

    const replayResponse = await app.inject({
      method: 'POST',
      payload: {
        refreshToken: session.refreshToken,
      },
      url: '/api/auth/refresh',
    });

    expect(replayResponse.statusCode).toBe(401);

    const secondRefreshResponse = await app.inject({
      method: 'POST',
      payload: {
        refreshToken: rotatedSession.refreshToken,
      },
      url: '/api/auth/refresh',
    });

    expect(secondRefreshResponse.statusCode).toBe(200);
  });

  it('rejects protected routes without a bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/players/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('creates the character once and refreshes the cached /players/me profile', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      payload: {
        email: 'player06@csrio.test',
        nickname: 'Player_06',
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();

    const firstProfileResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(firstProfileResponse.statusCode).toBe(200);
    expect(firstProfileResponse.json()).toMatchObject({
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      hasCharacter: false,
      location: {
        positionX: 0,
        positionY: 0,
      },
    });

    const createResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: {
          hair: 'tranca_media',
          outfit: 'camisa_flamengo',
          skin: 'pele_escura',
        },
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      appearance: {
        hair: 'tranca_media',
        outfit: 'camisa_flamengo',
        skin: 'pele_escura',
      },
      attributes: VOCATION_BASE_ATTRIBUTES[VocationType.Soldado],
      hasCharacter: true,
      inventory: [],
      location: {
        positionX: REGION_SPAWN_POINTS[RegionId.Centro].positionX,
        positionY: REGION_SPAWN_POINTS[RegionId.Centro].positionY,
        regionId: RegionId.Centro,
      },
      properties: [],
      vocation: VocationType.Soldado,
    });

    const profileAfterCreateResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(profileAfterCreateResponse.statusCode).toBe(200);
    expect(profileAfterCreateResponse.json()).toMatchObject({
      appearance: {
        hair: 'tranca_media',
        outfit: 'camisa_flamengo',
        skin: 'pele_escura',
      },
      hasCharacter: true,
      vocation: VocationType.Soldado,
    });

    const secondCreateResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: {
          hair: 'buzzcut',
          outfit: 'camisa_branca',
          skin: 'pele_clara',
        },
        vocation: VocationType.Gerente,
      },
      url: '/api/players/create',
    });

    expect(secondCreateResponse.statusCode).toBe(409);
  });
});
