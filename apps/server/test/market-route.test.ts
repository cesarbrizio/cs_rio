import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  DrugType,
  REGION_SPAWN_POINTS,
  VOCATION_BASE_ATTRIBUTES,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  type MarketAuctionBookResponse,
  type MarketOrderBookResponse,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { AuthPlayerRecord, AuthRepository, KeyValueStore } from '../src/services/auth.js';
import { MarketService, type MarketRepository } from '../src/services/market.js';
import type {
  InventoryDefinitionRecord,
  PlayerDrugConsumptionInput,
  type PlayerOverdosePenaltyInput,
  type PlayerOverdosePenaltyResult,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
} from '../src/services/player.js';

const ITEM_DEFINITIONS: Record<string, InventoryDefinitionRecord> = {
  'drug:drug-1': {
    durabilityMax: null,
    itemId: 'drug-1',
    itemName: 'Maconha',
    itemType: 'drug',
    levelRequired: 2,
    stackable: true,
    unitWeight: 1,
  },
  'weapon:weapon-1': {
    durabilityMax: 120,
    itemId: 'weapon-1',
    itemName: 'Pistola de treino',
    itemType: 'weapon',
    levelRequired: 2,
    stackable: false,
    unitWeight: 3,
  },
} as const;

const DRUG_DEFINITIONS = {
  'drug-1': {
    addictionRate: 1,
    code: 'drug-1',
    drugId: 'drug-1',
    moralBoost: 2,
    name: 'Maconha',
    nerveBoost: 3,
    productionLevel: 2,
    staminaRecovery: 4,
    type: DrugType.Maconha,
  },
} as const;

type OrderRecord = {
  createdAt: Date;
  durabilitySnapshot: number | null;
  expiresAt: Date;
  id: string;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  playerId: string;
  pricePerUnit: number;
  proficiencySnapshot: number;
  quantity: number;
  remainingQuantity: number;
  side: 'buy' | 'sell';
  sourceLabel: string | null;
  sourceType: 'player' | 'system';
  status: 'cancelled' | 'filled' | 'open';
  systemOfferId: string | null;
};

type SystemOfferRecord = {
  code: string;
  createdAt: Date;
  id: string;
  isActive: boolean;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  label: string;
  lastRestockedGameDay: number;
  lastRestockedRoundId: string | null;
  pricePerUnit: number;
  restockAmount: number;
  restockIntervalGameDays: number;
  sortOrder: number;
  stockAvailable: number;
  stockMax: number;
  updatedAt: Date;
};

type AuctionRecord = {
  buyoutPrice: number | null;
  createdAt: Date;
  currentBid: number | null;
  durabilitySnapshot: number | null;
  endsAt: Date;
  id: string;
  itemId: string;
  itemName: string;
  itemType: 'vest' | 'weapon';
  leadingBidderId: string | null;
  playerId: string;
  proficiencySnapshot: number;
  quantity: number;
  settledAt: Date | null;
  startingBid: number;
  status: 'expired' | 'open' | 'settled';
};

type AuctionNotificationRecord = {
  auctionId: string;
  createdAt: Date;
  id: string;
  message: string;
  playerId: string;
  title: string;
  type: 'outbid' | 'returned' | 'sold' | 'won';
};

class InMemoryGameRepository implements AuthRepository, PlayerRepository, MarketRepository {
  private readonly auctionBids = new Map<string, Array<{ amount: number; bidderPlayerId: string }>>();

  private readonly auctionNotifications: AuctionNotificationRecord[] = [];

  private readonly auctions = new Map<string, AuctionRecord>();

  private readonly inventoryByPlayerId = new Map<string, PlayerProfileRecord['inventory']>();

  private readonly orders = new Map<string, OrderRecord>();

  private readonly systemOffers = new Map<string, SystemOfferRecord>();

  private readonly players = new Map<string, AuthPlayerRecord>();

  private readonly transactions: Array<{
    amount: number;
    description: string;
    playerId: string;
    type: string;
  }> = [];

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

  async addInventoryItem(input: {
    durability: number | null;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    proficiency: number;
    quantity: number;
  }): Promise<void> {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      return;
    }

    const inventory = this.inventoryByPlayerId.get(input.playerId) ?? [];

    if (definition.stackable) {
      const existingItem = inventory.find(
        (item) => item.itemType === input.itemType && item.itemId === input.itemId && !item.isEquipped,
      );

      if (existingItem) {
        existingItem.quantity += input.quantity;
        existingItem.totalWeight = existingItem.unitWeight * existingItem.quantity;
        this.inventoryByPlayerId.set(input.playerId, inventory);
        return;
      }
    }

    inventory.push({
      durability: definition.stackable ? null : input.durability,
      equipSlot: null,
      id: randomUUID(),
      isEquipped: false,
      itemId: input.itemId,
      itemName: definition.itemName,
      itemType: input.itemType,
      levelRequired: definition.levelRequired,
      maxDurability: definition.durabilityMax,
      proficiency: definition.stackable ? 0 : input.proficiency,
      quantity: input.quantity,
      stackable: definition.stackable,
      totalWeight: definition.unitWeight * input.quantity,
      unitWeight: definition.unitWeight,
    });
    this.inventoryByPlayerId.set(input.playerId, inventory);
  }

  async addTransaction(input: {
    amount: number;
    description: string;
    playerId: string;
    type: string;
  }): Promise<void> {
    this.transactions.push(input);
  }

  async adjustPlayerMoney(playerId: string, delta: number): Promise<void> {
    const player = this.players.get(playerId);

    if (!player) {
      return;
    }

    player.money = (Number.parseFloat(player.money) + delta).toFixed(2);
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
    player.characterCreatedAt = new Date('2026-03-10T15:00:00.000Z');
    player.conceito = 500;
    player.forca = attributes.forca;
    player.hp = 100;
    player.inteligencia = attributes.inteligencia;
    player.level = 4;
    player.morale = 100;
    player.nerve = 100;
    player.positionX = spawnPoint.positionX;
    player.positionY = spawnPoint.positionY;
    player.resistencia = attributes.resistencia;
    player.stamina = 100;
    player.vocation = input.vocation;

    return this.getPlayerProfile(playerId);
  }

  async createAuction(input: {
    buyoutPrice: number | null;
    durabilitySnapshot: number | null;
    endsAt: Date;
    itemId: string;
    itemType: 'vest' | 'weapon';
    playerId: string;
    proficiencySnapshot: number;
    quantity: number;
    startingBid: number;
    status: 'expired' | 'open' | 'settled';
  }) {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);
    const auction: AuctionRecord = {
      buyoutPrice: input.buyoutPrice,
      createdAt: new Date('2026-03-10T16:00:00.000Z'),
      currentBid: null,
      durabilitySnapshot: input.durabilitySnapshot,
      endsAt: input.endsAt,
      id: randomUUID(),
      itemId: input.itemId,
      itemName: definition?.itemName ?? input.itemId,
      itemType: input.itemType,
      leadingBidderId: null,
      playerId: input.playerId,
      proficiencySnapshot: input.proficiencySnapshot,
      quantity: input.quantity,
      settledAt: null,
      startingBid: input.startingBid,
      status: input.status,
    };

    this.auctions.set(auction.id, auction);
    return { ...auction };
  }

  async createAuctionBid(input: {
    amount: number;
    auctionId: string;
    bidderPlayerId: string;
  }): Promise<void> {
    const currentBids = this.auctionBids.get(input.auctionId) ?? [];
    currentBids.push({
      amount: input.amount,
      bidderPlayerId: input.bidderPlayerId,
    });
    this.auctionBids.set(input.auctionId, currentBids);
  }

  async createAuctionNotification(input: {
    auctionId: string;
    message: string;
    playerId: string;
    title: string;
    type: 'outbid' | 'returned' | 'sold' | 'won';
  }) {
    const notification: AuctionNotificationRecord = {
      auctionId: input.auctionId,
      createdAt: new Date('2026-03-10T16:00:00.000Z'),
      id: randomUUID(),
      message: input.message,
      playerId: input.playerId,
      title: input.title,
      type: input.type,
    };

    this.auctionNotifications.unshift(notification);
    return { ...notification };
  }

  async createOrder(input: {
    durabilitySnapshot: number | null;
    expiresAt: Date;
    itemId: string;
    itemType: InventoryItemType;
    playerId: string;
    pricePerUnit: number;
    proficiencySnapshot: number;
    quantity: number;
    remainingQuantity: number;
    side: 'buy' | 'sell';
    status: 'cancelled' | 'filled' | 'open';
  }) {
    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);
    const order: OrderRecord = {
      createdAt: new Date('2026-03-10T16:00:00.000Z'),
      durabilitySnapshot: input.durabilitySnapshot,
      expiresAt: input.expiresAt,
      id: randomUUID(),
      itemId: input.itemId,
      itemName: definition?.itemName ?? input.itemId,
      itemType: input.itemType,
      playerId: input.playerId,
      pricePerUnit: input.pricePerUnit,
      proficiencySnapshot: input.proficiencySnapshot,
      quantity: input.quantity,
      remainingQuantity: input.remainingQuantity,
      side: input.side,
      sourceLabel: null,
      sourceType: 'player',
      status: input.status,
      systemOfferId: null,
    };

    this.orders.set(order.id, order);
    return { ...order };
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
      createdAt: new Date('2026-03-10T14:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 10,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 1,
      morale: 100,
      money: '10000.00',
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

  async getInventoryDefinition(
    itemType: InventoryItemType,
    itemId: string,
  ): Promise<InventoryDefinitionRecord | null> {
    return ITEM_DEFINITIONS[`${itemType}:${itemId}`] ?? null;
  }

  async getDrugDefinition(drugId: string) {
    return DRUG_DEFINITIONS[drugId as keyof typeof DRUG_DEFINITIONS] ?? null;
  }

  async getItemDefinition(
    itemType: InventoryItemType,
    itemId: string,
  ): Promise<InventoryDefinitionRecord | null> {
    return this.getInventoryDefinition(itemType, itemId);
  }

  async getInventoryItem(playerId: string, inventoryItemId: string) {
    const inventory = this.inventoryByPlayerId.get(playerId) ?? [];
    const item = inventory.find((entry) => entry.id === inventoryItemId);

    return item ? { ...item } : null;
  }

  async getAuctionById(auctionId: string) {
    const auction = this.auctions.get(auctionId);
    return auction ? { ...auction } : null;
  }

  async getOrderById(orderId: string) {
    const order = this.orders.get(orderId);
    return order ? { ...order } : null;
  }

  async getSystemOfferById(offerId: string) {
    const offer = this.systemOffers.get(offerId);
    return offer ? { ...offer } : null;
  }

  async getPlayer(playerId: string) {
    const player = this.players.get(playerId);

    return player
      ? {
          characterCreatedAt: player.characterCreatedAt,
          id: player.id,
          level: player.level,
          money: Number.parseFloat(player.money),
        }
      : null;
  }

  async listAuctionNotifications(playerId: string, limit: number) {
    return this.auctionNotifications
      .filter((notification) => notification.playerId === playerId)
      .slice(0, limit)
      .map((notification) => ({ ...notification }));
  }

  async listAuctions(query: {
    excludePlayerId?: string;
    itemId?: string;
    itemType?: 'vest' | 'weapon';
    playerId?: string;
    status?: 'expired' | 'open' | 'settled';
  }) {
    const auctions = [...this.auctions.values()].filter((auction) => {
      if (query.excludePlayerId && auction.playerId === query.excludePlayerId) {
        return false;
      }

      if (query.itemId && auction.itemId !== query.itemId) {
        return false;
      }

      if (query.itemType && auction.itemType !== query.itemType) {
        return false;
      }

      if (query.playerId && auction.playerId !== query.playerId) {
        return false;
      }

      if (query.status && auction.status !== query.status) {
        return false;
      }

      return true;
    });

    auctions.sort((left, right) => {
      const endsAtDiff = left.endsAt.getTime() - right.endsAt.getTime();

      if (endsAtDiff !== 0) {
        return endsAtDiff;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

    return auctions.map((auction) => ({ ...auction }));
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

    await this.addInventoryItem({
      durability: definition?.durabilityMax ?? null,
      itemId: input.itemId,
      itemType: input.itemType,
      playerId,
      proficiency: 0,
      quantity: input.quantity,
    });
  }

  async listOrders(query: {
    excludePlayerId?: string;
    itemId?: string;
    itemType?: InventoryItemType;
    ownerPlayerId?: string;
    side?: 'buy' | 'sell';
    status?: 'cancelled' | 'filled' | 'open';
  }) {
    const orders = [...this.orders.values()].filter((order) => {
      if (query.excludePlayerId && order.playerId === query.excludePlayerId) {
        return false;
      }

      if (query.itemId && order.itemId !== query.itemId) {
        return false;
      }

      if (query.itemType && order.itemType !== query.itemType) {
        return false;
      }

      if (query.ownerPlayerId && order.playerId !== query.ownerPlayerId) {
        return false;
      }

      if (query.side && order.side !== query.side) {
        return false;
      }

      if (query.status && order.status !== query.status) {
        return false;
      }

      return true;
    });

    orders.sort((left, right) => {
      if (query.side === 'buy') {
        if (right.pricePerUnit !== left.pricePerUnit) {
          return right.pricePerUnit - left.pricePerUnit;
        }
      }

      if (query.side === 'sell') {
        if (left.pricePerUnit !== right.pricePerUnit) {
          return left.pricePerUnit - right.pricePerUnit;
        }
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    return orders.map((order) => ({ ...order }));
  }

  async listSystemOffers(query: {
    isActive?: boolean;
    itemId?: string;
    itemType?: InventoryItemType;
  }) {
    const offers = [...this.systemOffers.values()].filter((offer) => {
      if (typeof query.isActive === 'boolean' && offer.isActive !== query.isActive) {
        return false;
      }
      if (query.itemId && offer.itemId !== query.itemId) {
        return false;
      }
      if (query.itemType && offer.itemType !== query.itemType) {
        return false;
      }
      return true;
    });

    offers.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      if (left.pricePerUnit !== right.pricePerUnit) {
        return left.pricePerUnit - right.pricePerUnit;
      }
      return left.code.localeCompare(right.code);
    });

    return offers.map((offer) => ({ ...offer }));
  }

  async removeInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean> {
    return this.deleteInventoryItem(playerId, inventoryItemId);
  }

  async saveOrder(order: OrderRecord): Promise<void> {
    this.orders.set(order.id, { ...order });
  }

  async saveSystemOffer(offer: SystemOfferRecord): Promise<void> {
    this.systemOffers.set(offer.id, { ...offer });
  }

  async saveAuction(auction: AuctionRecord): Promise<void> {
    this.auctions.set(auction.id, { ...auction });
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

  async withTransaction<T>(run: (repository: InMemoryGameRepository) => Promise<T>): Promise<T> {
    return run(this);
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

describe('market routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let currentNow = Date.parse('2026-03-10T16:00:00.000Z');

  beforeEach(async () => {
    const repository = new InMemoryGameRepository();
    const keyValueStore = new InMemoryKeyValueStore();
    currentNow = Date.parse('2026-03-10T16:00:00.000Z');

    app = await createApp({
      authRepository: repository,
      keyValueStore,
      marketService: new MarketService({
        keyValueStore,
        now: () => new Date(currentNow),
        repository,
      }),
      playerRepository: repository,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates buy/sell orders, matches trades with a 5% fee and allows cancellation', async () => {
    const sellerSession = await registerAndCreateCharacter(app, {
      email: 'seller@market.test',
      nickname: 'seller_market',
      vocation: VocationType.Soldado,
    });
    const buyerSession = await registerAndCreateCharacter(app, {
      email: 'buyer@market.test',
      nickname: 'buyer_market',
      vocation: VocationType.Gerente,
    });

    const sellerAuthorization = `Bearer ${sellerSession.accessToken}`;
    const buyerAuthorization = `Bearer ${buyerSession.accessToken}`;

    const inventorySeedResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-1',
        itemType: 'weapon',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });
    const inventorySeed = inventorySeedResponse.json();
    const weaponItem = inventorySeed.items.find((item: { itemId: string }) => item.itemId === 'weapon-1');

    expect(inventorySeedResponse.statusCode).toBe(201);

    const sellOrderResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'POST',
      payload: {
        inventoryItemId: weaponItem.id,
        itemId: 'weapon-1',
        itemType: 'weapon',
        pricePerUnit: 1000,
        quantity: 1,
        side: 'sell',
      },
      url: '/api/market/orders',
    });

    expect(sellOrderResponse.statusCode).toBe(201);
    expect(sellOrderResponse.json()).toMatchObject({
      feeTotal: 0,
      matchedTrades: [],
      order: {
        remainingQuantity: 1,
        side: 'sell',
        status: 'open',
      },
    });

    const buyOrderResponse = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-1',
        itemType: 'weapon',
        pricePerUnit: 1000,
        quantity: 1,
        side: 'buy',
      },
      url: '/api/market/orders',
    });
    const buyOrderPayload = buyOrderResponse.json();

    expect(buyOrderResponse.statusCode).toBe(201);
    expect(buyOrderPayload).toMatchObject({
      feeTotal: 50,
      matchedTrades: [
        {
          feeTotal: 50,
          grossTotal: 1000,
          pricePerUnit: 1000,
          quantity: 1,
          sellerNetTotal: 950,
        },
      ],
      order: {
        remainingQuantity: 0,
        side: 'buy',
        status: 'filled',
      },
    });

    const sellerProfileResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });
    const buyerProfileResponse = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(sellerProfileResponse.json()).toMatchObject({
      resources: {
        money: 10950,
      },
    });
    expect(buyerProfileResponse.json()).toMatchObject({
      resources: {
        money: 9000,
      },
    });
    expect(
      buyerProfileResponse.json().inventory.find((item: { itemId: string }) => item.itemId === 'weapon-1'),
    ).toMatchObject({
      itemName: 'Pistola de treino',
      quantity: 1,
    });

    const unmatchedBuyResponse = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'POST',
      payload: {
        itemId: 'drug-1',
        itemType: 'drug',
        pricePerUnit: 50,
        quantity: 2,
        side: 'buy',
      },
      url: '/api/market/orders',
    });
    const unmatchedOrderId = unmatchedBuyResponse.json().order.id as string;

    expect(unmatchedBuyResponse.statusCode).toBe(201);
    expect(unmatchedBuyResponse.json()).toMatchObject({
      order: {
        remainingQuantity: 2,
        status: 'open',
      },
    });

    const bookResponse = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'GET',
      url: '/api/market/orders?itemId=drug-1&itemType=drug',
    });
    const bookPayload = bookResponse.json() as MarketOrderBookResponse;

    expect(bookResponse.statusCode).toBe(200);
    expect(bookPayload.buyOrders).toHaveLength(0);
    expect(bookPayload.sellOrders).toHaveLength(0);
    expect(bookPayload.myOrders).toHaveLength(1);
    expect(bookPayload.myOrders[0]).toMatchObject({
      itemId: 'drug-1',
      remainingQuantity: 2,
      side: 'buy',
    });

    const cancelResponse = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'POST',
      url: `/api/market/orders/${unmatchedOrderId}/cancel`,
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json()).toMatchObject({
      refundedAmount: 100,
      order: {
        status: 'cancelled',
      },
    });

    const buyerProfileAfterCancel = await app.inject({
      headers: { authorization: buyerAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(buyerProfileAfterCancel.json()).toMatchObject({
      resources: {
        money: 9000,
      },
    });
  });

  it('creates auctions, refunds outbid players and settles the winner after the timer expires', async () => {
    const sellerSession = await registerAndCreateCharacter(app, {
      email: 'seller-auction@market.test',
      nickname: 'seller_auction',
      vocation: VocationType.Soldado,
    });
    const bidderOneSession = await registerAndCreateCharacter(app, {
      email: 'bidder-one@market.test',
      nickname: 'bidder_one',
      vocation: VocationType.Gerente,
    });
    const bidderTwoSession = await registerAndCreateCharacter(app, {
      email: 'bidder-two@market.test',
      nickname: 'bidder_two',
      vocation: VocationType.Cria,
    });

    const sellerAuthorization = `Bearer ${sellerSession.accessToken}`;
    const bidderOneAuthorization = `Bearer ${bidderOneSession.accessToken}`;
    const bidderTwoAuthorization = `Bearer ${bidderTwoSession.accessToken}`;

    const inventorySeedResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'POST',
      payload: {
        itemId: 'weapon-1',
        itemType: 'weapon',
        quantity: 1,
      },
      url: '/api/inventory/items',
    });
    const auctionWeapon = inventorySeedResponse
      .json()
      .items.find((item: { itemId: string }) => item.itemId === 'weapon-1');

    const createAuctionResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'POST',
      payload: {
        buyoutPrice: 1800,
        durationMinutes: 15,
        inventoryItemId: auctionWeapon.id,
        itemId: 'weapon-1',
        itemType: 'weapon',
        startingBid: 1000,
      },
      url: '/api/market/auctions',
    });
    const auctionId = createAuctionResponse.json().auction.id as string;

    expect(createAuctionResponse.statusCode).toBe(201);
    expect(createAuctionResponse.json()).toMatchObject({
      auction: {
        currentBid: null,
        itemId: 'weapon-1',
        minNextBid: 1000,
        status: 'open',
      },
      settlement: null,
    });

    const firstBidResponse = await app.inject({
      headers: { authorization: bidderOneAuthorization },
      method: 'POST',
      payload: {
        amount: 1200,
      },
      url: `/api/market/auctions/${auctionId}/bid`,
    });

    expect(firstBidResponse.statusCode).toBe(200);
    expect(firstBidResponse.json()).toMatchObject({
      auction: {
        currentBid: 1200,
        leadingBidderId: bidderOneSession.player.id,
        minNextBid: 1260,
        status: 'open',
      },
      settlement: null,
    });

    const secondBidResponse = await app.inject({
      headers: { authorization: bidderTwoAuthorization },
      method: 'POST',
      payload: {
        amount: 1300,
      },
      url: `/api/market/auctions/${auctionId}/bid`,
    });

    expect(secondBidResponse.statusCode).toBe(200);
    expect(secondBidResponse.json()).toMatchObject({
      auction: {
        currentBid: 1300,
        leadingBidderId: bidderTwoSession.player.id,
        minNextBid: 1365,
        status: 'open',
      },
      settlement: null,
    });

    currentNow += 16 * 60 * 1000;

    const winnerAuctionBookResponse = await app.inject({
      headers: { authorization: bidderTwoAuthorization },
      method: 'GET',
      url: '/api/market/auctions',
    });
    const winnerAuctionBook = winnerAuctionBookResponse.json() as MarketAuctionBookResponse;

    expect(winnerAuctionBookResponse.statusCode).toBe(200);
    expect(winnerAuctionBook.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auctionId,
          type: 'won',
        }),
      ]),
    );

    const outbidAuctionBookResponse = await app.inject({
      headers: { authorization: bidderOneAuthorization },
      method: 'GET',
      url: '/api/market/auctions',
    });
    const outbidAuctionBook = outbidAuctionBookResponse.json() as MarketAuctionBookResponse;

    expect(outbidAuctionBook.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auctionId,
          type: 'outbid',
        }),
      ]),
    );

    const sellerAuctionBookResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'GET',
      url: '/api/market/auctions',
    });
    const sellerAuctionBook = sellerAuctionBookResponse.json() as MarketAuctionBookResponse;

    expect(sellerAuctionBook.myAuctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentBid: 1300,
          id: auctionId,
          status: 'settled',
        }),
      ]),
    );
    expect(sellerAuctionBook.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auctionId,
          type: 'sold',
        }),
      ]),
    );

    const sellerProfileResponse = await app.inject({
      headers: { authorization: sellerAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });
    const bidderOneProfileResponse = await app.inject({
      headers: { authorization: bidderOneAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });
    const bidderTwoProfileResponse = await app.inject({
      headers: { authorization: bidderTwoAuthorization },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(sellerProfileResponse.json()).toMatchObject({
      resources: {
        money: 11235,
      },
    });
    expect(bidderOneProfileResponse.json()).toMatchObject({
      resources: {
        money: 10000,
      },
    });
    expect(bidderTwoProfileResponse.json()).toMatchObject({
      resources: {
        money: 8700,
      },
    });
    expect(
      bidderTwoProfileResponse.json().inventory.find((item: { itemId: string }) => item.itemId === 'weapon-1'),
    ).toMatchObject({
      itemName: 'Pistola de treino',
      quantity: 1,
    });
  });
});

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
  const authorization = `Bearer ${session.accessToken}`;

  const createCharacterResponse = await app.inject({
    headers: { authorization },
    method: 'POST',
    payload: {
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      vocation: input.vocation,
    },
    url: '/api/players/create',
  });

  expect(createCharacterResponse.statusCode).toBe(201);
  return session;
}
