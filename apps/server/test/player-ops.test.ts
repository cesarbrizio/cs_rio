import { randomUUID } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RegionId, VocationType } from '@cs-rio/shared';

import { db } from '../src/db/client.js';
import {
  playerInventory,
  playerOperationLogs,
  players,
  prisonRecords,
  vests,
  weapons,
} from '../src/db/schema.js';
import { PlayerOpsService } from '../src/services/player-ops.js';

class InMemoryKeyValueStore {
  private readonly storage = new Map<string, string>();

  async close(): Promise<void> {}

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }
}

const FIXED_NOW = new Date('2026-03-13T12:00:00.000Z');
let createdWeaponIds: string[] = [];
let createdVestIds: string[] = [];

describe('PlayerOpsService', () => {
  let createdPlayerIds: string[];
  let keyValueStore: InMemoryKeyValueStore;
  let service: PlayerOpsService;

  beforeEach(() => {
    createdPlayerIds = [];
    createdWeaponIds = [];
    createdVestIds = [];
    keyValueStore = new InMemoryKeyValueStore();
    service = new PlayerOpsService({
      keyValueStore,
      now: () => FIXED_NOW,
    });
  });

  afterEach(async () => {
    if (createdPlayerIds.length > 0) {
      await db.delete(playerOperationLogs).where(inArray(playerOperationLogs.playerId, createdPlayerIds));
      await db.delete(playerInventory).where(inArray(playerInventory.playerId, createdPlayerIds));
      await db.delete(prisonRecords).where(inArray(prisonRecords.playerId, createdPlayerIds));
      await db.delete(players).where(inArray(players.id, createdPlayerIds));
    }

    if (createdWeaponIds.length > 0) {
      await db.delete(weapons).where(inArray(weapons.id, createdWeaponIds));
    }

    if (createdVestIds.length > 0) {
      await db.delete(vests).where(inArray(vests.id, createdVestIds));
    }

    await service.close();
  });

  it('updates money, resources, progression and region with audit trail', async () => {
    const player = await createTestPlayer();

    const result = await service.applyCommands(
      { nickname: player.nickname },
      [
        {
          actor: 'vitest',
          operation: { type: 'set-money', value: 500_000 },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'set-bank-money', value: 250_000 },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'full-resources' },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'set-conceito', value: 1_500 },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'set-level', value: 5 },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'set-region', value: RegionId.ZonaNorte },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'move-to-region-spawn' },
          origin: 'test',
        },
      ],
    );

    expect(result.applied).toHaveLength(7);
    expect(result.player.money).toBe(500_000);
    expect(result.player.bankMoney).toBe(250_000);
    expect(result.player.hp).toBe(100);
    expect(result.player.stamina).toBe(100);
    expect(result.player.nerve).toBe(100);
    expect(result.player.morale).toBe(100);
    expect(result.player.addiction).toBe(0);
    expect(result.player.level).toBe(5);
    expect(result.player.conceito).toBeGreaterThanOrEqual(1_500);
    expect(result.player.position.regionId).toBe(RegionId.ZonaNorte);

    const logs = await db
      .select({
        operationType: playerOperationLogs.operationType,
      })
      .from(playerOperationLogs)
      .where(eq(playerOperationLogs.playerId, player.id));

    expect(logs).toHaveLength(7);
  });

  it('supports grant, equip, quantity change, repair and remove inventory operations', async () => {
    const player = await createTestPlayer();
    const weapon = await createTestWeapon();
    const vest = await createTestVest();

    await service.applyCommands(
      { playerId: player.id },
      [
        {
          actor: 'vitest',
          operation: { codeOrId: weapon.code, itemType: 'weapon', quantity: 1, type: 'grant-item' },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { codeOrId: vest.code, itemType: 'vest', quantity: 1, type: 'grant-item' },
          origin: 'test',
        },
      ],
    );

    let inventoryRows = await db
      .select({
        durability: playerInventory.durability,
        equippedSlot: playerInventory.equippedSlot,
        id: playerInventory.id,
        itemType: playerInventory.itemType,
        quantity: playerInventory.quantity,
      })
      .from(playerInventory)
      .where(eq(playerInventory.playerId, player.id));

    const weaponEntry = inventoryRows.find((entry) => entry.itemType === 'weapon');
    const vestEntry = inventoryRows.find((entry) => entry.itemType === 'vest');
    expect(weaponEntry).toBeDefined();
    expect(vestEntry).toBeDefined();

    if (!weaponEntry || !vestEntry) {
      return;
    }

    await db
      .update(playerInventory)
      .set({
        durability: 10,
      })
      .where(eq(playerInventory.id, weaponEntry.id));

    const result = await service.applyCommands(
      { player: player.nickname },
      [
        {
          actor: 'vitest',
          operation: { type: 'equip-item', value: { inventoryItemId: weaponEntry.id } },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'equip-item', value: { inventoryItemId: vestEntry.id } },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'repair-all' },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'unequip-item', value: { slot: 'weapon' } },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'remove-item', value: { inventoryItemId: vestEntry.id } },
          origin: 'test',
        },
      ],
    );

    expect(result.player.inventory.find((entry) => entry.id === vestEntry.id)).toBeUndefined();
    const repairedWeapon = result.player.inventory.find((entry) => entry.id === weaponEntry.id);
    expect(repairedWeapon?.durability).toBe(weapon.durabilityMax);
    expect(repairedWeapon?.equippedSlot).toBeNull();

    inventoryRows = await db
      .select({
        durability: playerInventory.durability,
        equippedSlot: playerInventory.equippedSlot,
        id: playerInventory.id,
        itemType: playerInventory.itemType,
        quantity: playerInventory.quantity,
      })
      .from(playerInventory)
      .where(eq(playerInventory.playerId, player.id));

    expect(inventoryRows).toHaveLength(1);
    expect(inventoryRows[0]?.itemType).toBe('weapon');
  });

  it('can force and clear prison and hospitalization', async () => {
    const player = await createTestPlayer();

    let result = await service.applyCommands(
      { email: player.email },
      [
        {
          actor: 'vitest',
          operation: { type: 'set-prison-minutes', value: 15 },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'set-hospital-minutes', value: 20 },
          origin: 'test',
        },
      ],
    );

    expect(result.player.prison.isImprisoned).toBe(true);
    expect(result.player.hospital.isHospitalized).toBe(true);

    result = await service.applyCommands(
      { playerId: player.id },
      [
        {
          actor: 'vitest',
          operation: { type: 'clear-prison' },
          origin: 'test',
        },
        {
          actor: 'vitest',
          operation: { type: 'clear-hospital' },
          origin: 'test',
        },
      ],
    );

    expect(result.player.prison.isImprisoned).toBe(false);
    expect(result.player.hospital.isHospitalized).toBe(false);
  });
});

async function createTestPlayer(): Promise<{ email: string; id: string; nickname: string }> {
  const id = randomUUID();
  const email = `ops-player-${randomUUID()}@csrio.test`;
  const nickname = `ops_${randomUUID().slice(0, 8)}`;
  await db.insert(players).values({
    characterCreatedAt: FIXED_NOW,
    email,
    id,
    nickname,
    passwordHash: 'hash',
    regionId: RegionId.Centro,
    vocation: VocationType.Empreendedor,
  });
  return { email, id, nickname };
}

async function createTestWeapon(): Promise<{ code: string; durabilityMax: number; id: string }> {
  const id = randomUUID();
  const code = `ops_weapon_${randomUUID().slice(0, 8)}`;
  const durabilityMax = 120;
  createdWeaponIds.push(id);
  await db.insert(weapons).values({
    code,
    durabilityMax,
    id,
    levelRequired: 1,
    name: `Arma Ops ${code}`,
    power: 12,
    price: '1000.00',
    weight: 1,
  });
  return { code, durabilityMax, id };
}

async function createTestVest(): Promise<{ code: string; id: string }> {
  const id = randomUUID();
  const code = `ops_vest_${randomUUID().slice(0, 8)}`;
  createdVestIds.push(id);
  await db.insert(vests).values({
    code,
    defense: 8,
    durabilityMax: 90,
    id,
    levelRequired: 1,
    name: `Colete Ops ${code}`,
    price: '800.00',
    weight: 1,
  });
  return { code, id };
}
