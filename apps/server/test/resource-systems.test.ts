import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  DrugType,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from '../src/services/auth.js';
import { type AuthPlayerRecord } from '../src/services/auth.js';
import {
  type PlayerDrugConsumptionInput,
  PlayerService,
  type PlayerOverdosePenaltyInput,
  type PlayerOverdosePenaltyResult,
  type PlayerProfileRecord,
  type PlayerRepository,
  type PlayerRuntimeStateInput,
} from '../src/services/player.js';
import { AddictionSystem } from '../src/systems/AddictionSystem.js';
import { DrugToleranceSystem } from '../src/systems/DrugToleranceSystem.js';
import { LevelSystem } from '../src/systems/LevelSystem.js';
import { DisposicaoSystem } from '../src/systems/DisposicaoSystem.js';
import { OverdoseSystem } from '../src/systems/OverdoseSystem.js';
import { CansacoSystem } from '../src/systems/CansacoSystem.js';

class ClockKeyValueStore implements KeyValueStore {
  private readonly values = new Map<
    string,
    {
      expiresAt: number | null;
      value: string;
    }
  >();

  constructor(private readonly now: () => number) {}

  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    return this.values.get(key)?.value ?? null;
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    this.cleanup(key);
    const current = Number(this.values.get(key)?.value ?? '0') + 1;
    this.values.set(key, {
      expiresAt: this.now() + ttlSeconds * 1000,
      value: String(current),
    });
    return current;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      expiresAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : null,
      value,
    });
  }

  private cleanup(key: string): void {
    const entry = this.values.get(key);

    if (entry?.expiresAt && entry.expiresAt <= this.now()) {
      this.values.delete(key);
    }
  }
}

class InMemoryPlayerRepository implements PlayerRepository {
  constructor(
    private readonly record: PlayerProfileRecord,
    private knownContacts = 0,
  ) {}

  async applyDrugOverdosePenalties(
    playerId: string,
    input: PlayerOverdosePenaltyInput,
  ): Promise<PlayerOverdosePenaltyResult | null> {
    if (this.record.player.id !== playerId) {
      return null;
    }

    const lostContacts = this.knownContacts;
    this.knownContacts = 0;
    this.record.player.addiction = input.addiction;
    this.record.player.conceito = input.conceito;
    this.record.player.brisa = input.brisa;

    return {
      knownContactsLost: lostContacts,
    };
  }

  async clearInventoryEquipSlot(): Promise<void> {
    return;
  }

  async consumeDrugInventoryItem(
    playerId: string,
    inventoryItemId: string,
    input: PlayerDrugConsumptionInput,
  ): Promise<boolean> {
    if (this.record.player.id !== playerId) {
      return false;
    }

    const index = this.record.inventory.findIndex(
      (item) => item.id === inventoryItemId && item.itemType === 'drug',
    );

    if (index < 0) {
      return false;
    }

    const current = this.record.inventory[index];

    if (!current) {
      return false;
    }

    if (current.quantity <= 1) {
      this.record.inventory.splice(index, 1);
    } else {
      this.record.inventory[index] = {
        ...current,
        quantity: current.quantity - 1,
        totalWeight: current.unitWeight * (current.quantity - 1),
      };
    }

    this.record.player.addiction = input.addiction;
    this.record.player.brisa = input.brisa;
    this.record.player.disposicao = input.disposicao;
    this.record.player.cansaco = input.cansaco;
    return true;
  }

  async createCharacter(): Promise<PlayerProfileRecord | null> {
    return this.record;
  }

  async deleteInventoryItem(): Promise<boolean> {
    return false;
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

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    return this.record.player.id === playerId
      ? {
          faction: this.record.faction,
          inventory: [...this.record.inventory],
          player: { ...this.record.player },
          properties: [...this.record.properties],
        }
      : null;
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    void playerId;
    void input;
    return;
  }

  async repairInventoryItem(): Promise<boolean> {
    return false;
  }

  async setInventoryEquipSlot(
    playerId: string,
    inventoryItemId: string,
    equipSlot: InventoryEquipSlot | null,
  ): Promise<boolean> {
    void playerId;
    void inventoryItemId;
    void equipSlot;
    return false;
  }

  async updateInventoryItemQuantity(): Promise<boolean> {
    return false;
  }

  async updateRuntimeState(playerId: string, input: PlayerRuntimeStateInput): Promise<void> {
    if (this.record.player.id !== playerId) {
      return;
    }

    this.record.player.addiction = input.addiction;
    this.record.player.level = input.level;
    this.record.player.brisa = input.brisa;
    this.record.player.disposicao = input.disposicao;
    this.record.player.cansaco = input.cansaco;
  }

  getKnownContactsCount(): number {
    return this.knownContacts;
  }
}

function createPlayerRecord(): PlayerProfileRecord {
  const player: AuthPlayerRecord = {
    addiction: 5,
    appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
    bankMoney: '0',
    carisma: 10,
    characterCreatedAt: new Date('2026-03-10T10:00:00.000Z'),
    conceito: 520,
    createdAt: new Date('2026-03-10T10:00:00.000Z'),
    email: 'tester@example.com',
    factionId: null,
    forca: 20,
    hp: 100,
    id: randomUUID(),
    inteligencia: 18,
    lastLogin: new Date('2026-03-10T12:00:00.000Z'),
    level: 1,
    brisa: 100,
    money: '1000',
    disposicao: 60,
    nickname: 'runtime_tester',
    passwordHash: 'hash',
    positionX: 10,
    positionY: 10,
    regionId: RegionId.Centro,
    resistencia: 15,
    cansaco: 70,
    vocation: VocationType.Cria,
  };

  return {
    faction: null,
    inventory: [],
    player,
    properties: [],
  };
}

describe('resource systems', () => {
  it('recovers cansaco from elapsed time', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new CansacoSystem({
      keyValueStore: store,
      now: () => now,
    });

    const result = await system.sync('player-1', 40, {
      baselineAt: new Date('2026-03-10T11:30:00.000Z'),
      recoveryPerHour: 12,
    });

    expect(result.nextValue).toBe(46);
    expect(result.recoveredPoints).toBe(6);
  });

  it('recovers disposicao one point every five minutes', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new DisposicaoSystem({
      keyValueStore: store,
      now: () => now,
    });

    const result = await system.sync('player-1', 60, {
      baselineAt: new Date('2026-03-10T11:40:00.000Z'),
    });

    expect(result.nextValue).toBe(64);
    expect(result.recoveredPoints).toBe(4);
  });

  it('decays addiction and resets the decay timer after drug use', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new AddictionSystem({
      keyValueStore: store,
      now: () => now,
    });

    const firstSync = await system.sync('player-1', 10, {
      baselineAt: new Date('2026-03-10T08:00:00.000Z'),
    });

    expect(firstSync.nextValue).toBe(6);
    expect(firstSync.decayedPoints).toBe(4);

    await system.recordDrugUse('player-1');
    now += 2 * 60 * 60 * 1000;

    const secondSync = await system.sync('player-1', 6);

    expect(secondSync.nextValue).toBe(4);
    expect(secondSync.decayedPoints).toBe(2);
  });

  it('tracks tolerance separately for each drug', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new DrugToleranceSystem({
      keyValueStore: store,
      now: () => now,
    });

    const firstUse = await system.recordUse('player-1', 'drug-1', 2);
    const secondUse = await system.recordUse('player-1', 'drug-1', 3);
    const otherDrug = await system.recordUse('player-1', 'drug-2', 1);

    expect(firstUse.current).toBe(2);
    expect(secondUse.current).toBe(5);
    expect(otherDrug.current).toBe(1);
    expect(await system.getCurrent('player-1', 'drug-1')).toBe(5);
  });

  it('decays drug tolerance one point per hour without use', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new DrugToleranceSystem({
      keyValueStore: store,
      now: () => now,
    });

    await system.recordUse('player-1', 'drug-1', 6);
    now += 3 * 60 * 60 * 1000;

    const synced = await system.sync('player-1', 'drug-1');

    expect(synced.current).toBe(3);
    expect(synced.decayedBy).toBe(3);
  });

  it('tracks distinct drug types used in the last hour', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const system = new OverdoseSystem({
      keyValueStore: store,
      now: () => now,
    });

    await system.recordDrugUse('player-1', DrugType.Maconha);
    await system.recordDrugUse('player-1', DrugType.Bala);
    now += 30 * 60 * 1000;

    const recentMix = await system.recordDrugUse('player-1', DrugType.Lanca);

    expect(recentMix.distinctTypes).toEqual([DrugType.Maconha, DrugType.Bala, DrugType.Lanca]);

    now += 61 * 60 * 1000;

    const expiredMix = await system.recordDrugUse('player-1', DrugType.Maconha);

    expect(expiredMix.distinctTypes).toEqual([DrugType.Maconha]);
  });

  it('resolves level progression from conceito thresholds', () => {
    const progression = new LevelSystem().resolve(5_500, 5);

    expect(progression.level).toBe(6);
    expect(progression.leveledUp).toBe(true);
    expect(progression.nextLevel).toBe(7);
    expect(progression.nextConceitoRequired).toBe(15_000);
  });
});

describe('player runtime sync', () => {
  it('updates level immediately and recovers resources on profile reads after cache expiry', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const playerRecord = createPlayerRecord();
    const repository = new InMemoryPlayerRepository(playerRecord);
    const playerId = playerRecord.player.id;
    const service = new PlayerService({
      addictionSystem: new AddictionSystem({ keyValueStore: store, now: () => now }),
      keyValueStore: store,
      levelSystem: new LevelSystem(),
      disposicaoSystem: new DisposicaoSystem({ keyValueStore: store, now: () => now }),
      repository,
      cansacoSystem: new CansacoSystem({ keyValueStore: store, now: () => now }),
    });

    const firstProfile = await service.getPlayerProfile(playerId);

    expect(firstProfile.level).toBe(4);
    expect(firstProfile.resources.cansaco).toBe(70);
    expect(firstProfile.resources.disposicao).toBe(60);

    now += 10 * 60 * 1000;

    const secondProfile = await service.getPlayerProfile(playerId);

    expect(secondProfile.level).toBe(4);
    expect(secondProfile.resources.cansaco).toBe(72);
    expect(secondProfile.resources.disposicao).toBe(62);
    expect(secondProfile.resources.addiction).toBe(5);

    await service.close();
  });

  it('reduces drug recovery efficiency when tolerance for that drug is high', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const playerRecord = createPlayerRecord();
    playerRecord.player.addiction = 4;
    playerRecord.player.brisa = 70;
    playerRecord.player.disposicao = 60;
    playerRecord.player.cansaco = 50;
    playerRecord.inventory.push({
      durability: null,
      equipSlot: null,
      id: 'drug-stack-1',
      isEquipped: false,
      itemId: 'drug-1',
      itemName: 'mock-drug-1',
      itemType: 'drug',
      levelRequired: 1,
      maxDurability: null,
      proficiency: 0,
      quantity: 2,
      stackable: true,
      totalWeight: 2,
      unitWeight: 1,
    });
    const repository = new InMemoryPlayerRepository(playerRecord);
    const toleranceSystem = new DrugToleranceSystem({ keyValueStore: store, now: () => now });
    const playerId = playerRecord.player.id;
    const service = new PlayerService({
      addictionSystem: new AddictionSystem({ keyValueStore: store, now: () => now }),
      drugToleranceSystem: toleranceSystem,
      keyValueStore: store,
      levelSystem: new LevelSystem(),
      disposicaoSystem: new DisposicaoSystem({ keyValueStore: store, now: () => now }),
      repository,
      cansacoSystem: new CansacoSystem({ keyValueStore: store, now: () => now }),
    });

    await toleranceSystem.recordUse(playerId, 'drug-1', 50);

    const result = await service.consumeDrugInventoryItem(playerId, 'drug-stack-1');

    expect(result.effects).toMatchObject({
      addictionGained: 1,
      brisaRecovered: 1,
      disposicaoRecovered: 2,
      cansacoRecovered: 2,
    });
    expect(result.tolerance).toMatchObject({
      current: 52,
      decayedBy: 0,
      drugId: 'drug-1',
      effectiveTolerance: 50,
      increasedBy: 2,
    });
    expect(result.tolerance.effectivenessMultiplier).toBeCloseTo(0.5111, 4);
    expect(result.player.resources).toMatchObject({
      addiction: 5,
      brisa: 71,
      disposicao: 62,
      cansaco: 52,
    });
    expect(result.player.inventory.find((item) => item.id === 'drug-stack-1')).toMatchObject({
      quantity: 1,
    });

    await service.close();
  });

  it('hospitalizes the player and applies overdose penalties when addiction reaches 100', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new ClockKeyValueStore(() => now);
    const playerRecord = createPlayerRecord();
    playerRecord.player.addiction = 99;
    playerRecord.player.brisa = 90;
    playerRecord.player.disposicao = 70;
    playerRecord.player.cansaco = 60;
    playerRecord.inventory.push({
      durability: null,
      equipSlot: null,
      id: 'drug-stack-overdose',
      isEquipped: false,
      itemId: 'drug-1',
      itemName: 'mock-drug-1',
      itemType: 'drug',
      levelRequired: 1,
      maxDurability: null,
      proficiency: 0,
      quantity: 2,
      stackable: true,
      totalWeight: 2,
      unitWeight: 1,
    });
    const repository = new InMemoryPlayerRepository(playerRecord, 3);
    const playerId = playerRecord.player.id;
    const service = new PlayerService({
      addictionSystem: new AddictionSystem({ keyValueStore: store, now: () => now }),
      drugToleranceSystem: new DrugToleranceSystem({ keyValueStore: store, now: () => now }),
      keyValueStore: store,
      levelSystem: new LevelSystem(),
      disposicaoSystem: new DisposicaoSystem({ keyValueStore: store, now: () => now }),
      overdoseSystem: new OverdoseSystem({ keyValueStore: store, now: () => now }),
      repository,
      cansacoSystem: new CansacoSystem({ keyValueStore: store, now: () => now }),
    });

    const result = await service.consumeDrugInventoryItem(playerId, 'drug-stack-overdose');

    expect(result.overdose).toMatchObject({
      knownContactsLost: 3,
      penalties: {
        addictionResetTo: 50,
        conceitoLost: 26,
        brisaResetTo: 0,
      },
      recentDrugTypes: [DrugType.Maconha],
      trigger: 'max_addiction',
    });
    expect(result.player.hospitalization).toMatchObject({
      isHospitalized: true,
      reason: 'overdose',
      trigger: 'max_addiction',
    });
    expect(result.player.resources).toMatchObject({
      addiction: 50,
      conceito: 494,
      brisa: 0,
      disposicao: 73,
      cansaco: 64,
    });
    expect(repository.getKnownContactsCount()).toBe(0);

    await expect(service.consumeDrugInventoryItem(playerId, 'drug-stack-overdose')).rejects.toThrow(
      /Personagem hospitalizado ate/,
    );

    await service.close();
  });
});
