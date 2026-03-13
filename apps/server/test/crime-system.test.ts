import { randomUUID } from 'node:crypto';

import { CrimeType, VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from '../src/services/auth.js';
import {
  CrimeSystem,
  type CrimeDefinitionRecord,
  type CrimeDropCandidate,
  type CrimePersistedState,
  type CrimePersistenceInput,
  type CrimePlayerContext,
  type CrimeRepository,
  type CrimeResourcesSnapshot,
} from '../src/systems/CrimeSystem.js';
import { CooldownSystem } from '../src/systems/CooldownSystem.js';
import { PoliceHeatSystem } from '../src/systems/PoliceHeatSystem.js';

class InMemoryKeyValueStore implements KeyValueStore {
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

class InMemoryCrimeRepository implements CrimeRepository {
  public lastPersistInput: CrimePersistenceInput | null = null;

  constructor(
    private readonly crime: CrimeDefinitionRecord,
    private readonly playerContext: CrimePlayerContext,
    private readonly dropCandidates: CrimeDropCandidate[] = [],
  ) {}

  async getCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null> {
    return this.crime.id === crimeId ? this.crime : null;
  }

  async getDropCandidatesForCrimeLevel(levelRequired: number): Promise<CrimeDropCandidate[]> {
    void levelRequired;
    return this.dropCandidates;
  }

  async listCrimes(): Promise<CrimeDefinitionRecord[]> {
    return [this.crime];
  }

  async getPlayerContext(playerId: string): Promise<CrimePlayerContext | null> {
    return this.playerContext.player.id === playerId ? structuredClone(this.playerContext) : null;
  }

  async persistCrimeAttempt(input: CrimePersistenceInput): Promise<CrimePersistedState> {
    this.lastPersistInput = input;
    this.playerContext.player.level = input.nextLevel;
    this.playerContext.player.resources = {
      ...input.nextResources,
    };
    for (const durabilityUpdate of input.durabilityUpdates) {
      if (this.playerContext.equipment.weapon?.inventoryItemId === durabilityUpdate.inventoryItemId) {
        this.playerContext.equipment.weapon.durability = durabilityUpdate.nextDurability;
      }

      if (this.playerContext.equipment.vest?.inventoryItemId === durabilityUpdate.inventoryItemId) {
        this.playerContext.equipment.vest.durability = durabilityUpdate.nextDurability;
      }
    }

    for (const proficiencyUpdate of input.proficiencyUpdates) {
      if (this.playerContext.equipment.weapon?.inventoryItemId === proficiencyUpdate.inventoryItemId) {
        this.playerContext.equipment.weapon.proficiency = proficiencyUpdate.nextProficiency;
      }
    }

    return {
      drop: input.drop,
      level: input.nextLevel,
      resources: {
        ...input.nextResources,
      },
    };
  }
}

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index];

    if (value === undefined) {
      return 0.999;
    }

    index += 1;
    return value;
  };
}

function createPlayerContext(resources: Partial<CrimeResourcesSnapshot> = {}): CrimePlayerContext {
  return {
    attributes: {
      carisma: 10,
      forca: 30,
      inteligencia: 12,
      resistencia: 20,
    },
    equipment: {
      vest: {
        defense: 12,
        durability: 10,
        inventoryItemId: 'vest-entry-1',
      },
      weapon: {
        durability: 12,
        inventoryItemId: 'weapon-entry-1',
        power: 150,
        proficiency: 0,
      },
    },
    factionId: null,
    player: {
      characterCreatedAt: new Date('2026-03-10T10:00:00.000Z'),
      id: randomUUID(),
      level: 4,
      nickname: 'crime_tester',
      resources: {
        addiction: 0,
        conceito: 800,
        hp: 100,
        money: 1000,
        nerve: 40,
        stamina: 80,
        ...resources,
      },
      vocation: VocationType.Cria,
    },
  };
}

describe('cooldown system', () => {
  it('tracks active cooldowns and lets them expire', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const system = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });

    const activeCooldown = await system.activateCrimeCooldown('player-1', 'crime-1', 120);

    expect(activeCooldown.active).toBe(true);
    expect(activeCooldown.remainingSeconds).toBe(120);

    now += 60_000;

    const cooldownMidway = await system.getCrimeCooldown('player-1', 'crime-1');

    expect(cooldownMidway.active).toBe(true);
    expect(cooldownMidway.remainingSeconds).toBe(60);

    now += 61_000;

    const cooldownExpired = await system.getCrimeCooldown('player-1', 'crime-1');

    expect(cooldownExpired.active).toBe(false);
    expect(cooldownExpired.remainingSeconds).toBe(0);
  });
});

describe('police heat system', () => {
  it('adds heat and decays one point every five minutes of inactivity', async () => {
    let now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const system = new PoliceHeatSystem({
      keyValueStore: store,
      now: () => now,
    });

    const firstState = await system.addHeat('player-1', 4);

    expect(firstState.score).toBe(4);

    now += 11 * 60 * 1000;

    const decayedState = await system.getHeat('player-1');

    expect(decayedState.score).toBe(2);
    expect(decayedState.decayedPoints).toBe(2);

    now += 10 * 60 * 1000;

    const zeroedState = await system.getHeat('player-1');

    expect(zeroedState.score).toBe(0);
    expect(zeroedState.nextDecayAt).toBeNull();
  });
});

describe('crime system', () => {
  it('resolves a successful crime, persists rewards and enforces cooldown', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const cooldownSystem = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });
    const policeHeatSystem = new PoliceHeatSystem({
      keyValueStore: store,
      now: () => now,
    });
    const crime: CrimeDefinitionRecord = {
      arrestChance: 8,
      code: 'furtar_turista',
      conceitoReward: 10,
      cooldownSeconds: 120,
      id: 'crime-1',
      levelRequired: 2,
      minPower: 150,
      name: 'Furtar turista',
      nerveCost: 0,
      rewardMax: 300,
      rewardMin: 100,
      staminaCost: 10,
      type: CrimeType.Solo,
    };
    const playerContext = createPlayerContext();
    const repository = new InMemoryCrimeRepository(crime, playerContext, [
      {
        itemId: 'drug-1',
        itemName: 'Maconha',
        itemType: 'drug',
        quantity: 1,
      },
    ]);
    const playerId = playerContext.player.id;
    const system = new CrimeSystem({
      cooldownSystem,
      now: () => new Date(now),
      policeHeatSystem,
      random: createRandomSequence([0.2, 0.5, 0.01, 0]),
      repository,
    });

    const result = await system.attemptCrime(playerId, crime.id);

    expect(result.success).toBe(true);
    expect(result.moneyDelta).toBe(200);
    expect(result.conceitoDelta).toBe(10);
    expect(result.drop).toMatchObject({
      itemId: 'drug-1',
      itemType: 'drug',
    });
    expect(result.resources).toMatchObject({
      conceito: 810,
      money: 1200,
      stamina: 70,
    });
    expect(result.cooldownRemainingSeconds).toBe(120);
    expect(result.heatBefore).toBe(0);
    expect(result.heatAfter).toBeGreaterThan(0);
    expect(result.level).toBe(4);
    expect(result.leveledUp).toBe(false);
    expect(repository.lastPersistInput?.logType).toBe('crime_success');
    expect(repository.lastPersistInput?.durabilityUpdates).toEqual([
      {
        inventoryItemId: 'weapon-entry-1',
        nextDurability: 11,
        unequip: false,
      },
    ]);
    expect(repository.lastPersistInput?.proficiencyUpdates).toEqual([
      {
        inventoryItemId: 'weapon-entry-1',
        nextProficiency: 2,
      },
    ]);
    expect(playerContext.equipment.weapon?.proficiency).toBe(2);

    await expect(system.attemptCrime(playerId, crime.id)).rejects.toMatchObject({
      code: 'cooldown_active',
    });
  });

  it('applies arrest penalties when the crime fails under high police heat', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const cooldownSystem = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });
    const policeHeatSystem = new PoliceHeatSystem({
      keyValueStore: store,
      now: () => now,
    });
    const playerContext = createPlayerContext();
    const repository = new InMemoryCrimeRepository(
      {
        arrestChance: 20,
        code: 'roubar_joalheria',
        conceitoReward: 28,
        cooldownSeconds: 600,
        id: 'crime-2',
        levelRequired: 4,
        minPower: 2500,
        name: 'Roubar joalheria',
        nerveCost: 10,
        rewardMax: 1000,
        rewardMin: 400,
        staminaCost: 20,
        type: CrimeType.Solo,
      },
      playerContext,
    );
    const system = new CrimeSystem({
      cooldownSystem,
      now: () => new Date(now),
      policeHeatSystem,
      random: createRandomSequence([0.99, 0.1]),
      repository,
    });

    await policeHeatSystem.addHeat(playerContext.player.id, 20);

    const result = await system.attemptCrime(playerContext.player.id, 'crime-2');

    expect(result.success).toBe(false);
    expect(result.arrested).toBe(true);
    expect(result.arrestChance).toBeCloseTo(0.4, 5);
    expect(result.hpDelta).toBeLessThan(0);
    expect(result.conceitoDelta).toBeLessThan(0);
    expect(result.leveledUp).toBe(false);
    expect(result.resources).toMatchObject({
      conceito: 779,
      hp: 74,
      nerve: 30,
      stamina: 60,
    });
    expect(repository.lastPersistInput?.logType).toBe('crime_arrested');
    expect(repository.lastPersistInput?.prisonReleaseAt).toBeInstanceOf(Date);
    expect(repository.lastPersistInput?.durabilityUpdates).toEqual([
      {
        inventoryItemId: 'weapon-entry-1',
        nextDurability: 9,
        unequip: false,
      },
      {
        inventoryItemId: 'vest-entry-1',
        nextDurability: 7,
        unequip: false,
      },
    ]);
    expect(repository.lastPersistInput?.proficiencyUpdates).toEqual([
      {
        inventoryItemId: 'weapon-entry-1',
        nextProficiency: 1,
      },
    ]);
    expect(playerContext.equipment.weapon?.proficiency).toBe(1);
  });

  it('adds a tiered proficiency bonus to weapon power', () => {
    const playerContext = createPlayerContext();
    const crime: CrimeDefinitionRecord = {
      arrestChance: 8,
      code: 'furtar_turista',
      conceitoReward: 10,
      cooldownSeconds: 120,
      id: 'crime-1',
      levelRequired: 2,
      minPower: 150,
      name: 'Furtar turista',
      nerveCost: 0,
      rewardMax: 300,
      rewardMin: 100,
      staminaCost: 10,
      type: CrimeType.Solo,
    };
    const repository = new InMemoryCrimeRepository(crime, playerContext);
    const system = new CrimeSystem({
      repository,
    });

    const basePower = system.calculatePlayerPower(playerContext, CrimeType.Solo);
    playerContext.equipment.weapon!.proficiency = 30;
    const boostedPower = system.calculatePlayerPower(playerContext, CrimeType.Solo);

    expect(basePower).toBe(779);
    expect(boostedPower).toBe(788);
  });

  it('applies faction attribute upgrades to crime catalog power', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const cooldownSystem = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });
    const crime: CrimeDefinitionRecord = {
      arrestChance: 8,
      code: 'furtar_turista',
      conceitoReward: 10,
      cooldownSeconds: 120,
      id: 'crime-faction-1',
      levelRequired: 2,
      minPower: 500,
      name: 'Furtar turista',
      nerveCost: 0,
      rewardMax: 300,
      rewardMin: 100,
      staminaCost: 10,
      type: CrimeType.Solo,
    };
    const baselinePlayerContext = createPlayerContext();
    baselinePlayerContext.factionId = 'faction-1';
    const boostedPlayerContext = createPlayerContext();
    boostedPlayerContext.factionId = 'faction-1';

    const baselineSystem = new CrimeSystem({
      cooldownSystem,
      repository: new InMemoryCrimeRepository(crime, baselinePlayerContext),
    });
    const boostedSystem = new CrimeSystem({
      cooldownSystem,
      factionUpgradeReader: {
        async getFactionUpgradeEffectsForFaction() {
          return {
            attributeBonusMultiplier: 1.1,
            canAccessExclusiveArsenal: false,
            hasFortifiedHeadquarters: false,
            muleDeliveryTier: 0,
            soldierCapacityMultiplier: 1,
          };
        },
      },
      repository: new InMemoryCrimeRepository(crime, boostedPlayerContext),
    });

    const [baselineCatalogItem] = await baselineSystem.getCrimeCatalog(baselinePlayerContext.player.id);
    const [boostedCatalogItem] = await boostedSystem.getCrimeCatalog(boostedPlayerContext.player.id);

    expect(baselineCatalogItem?.playerPower).toBe(779);
    expect(boostedCatalogItem?.playerPower).toBeGreaterThan(baselineCatalogItem?.playerPower ?? 0);
    expect(boostedCatalogItem?.estimatedSuccessChance).toBeGreaterThan(
      baselineCatalogItem?.estimatedSuccessChance ?? 0,
    );
  });

  it('caps weapon proficiency gain at 100', async () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const cooldownSystem = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });
    const policeHeatSystem = new PoliceHeatSystem({
      keyValueStore: store,
      now: () => now,
    });
    const crime: CrimeDefinitionRecord = {
      arrestChance: 12,
      code: 'assaltar_carga',
      conceitoReward: 30,
      cooldownSeconds: 180,
      id: 'crime-3',
      levelRequired: 5,
      minPower: 300,
      name: 'Assaltar carga',
      nerveCost: 8,
      rewardMax: 600,
      rewardMin: 250,
      staminaCost: 15,
      type: CrimeType.Solo,
    };
    const playerContext = createPlayerContext();
    playerContext.player.level = 5;
    playerContext.equipment.weapon!.proficiency = 99;
    const repository = new InMemoryCrimeRepository(crime, playerContext);
    const system = new CrimeSystem({
      cooldownSystem,
      policeHeatSystem,
      random: createRandomSequence([0.1, 0.9]),
      repository,
    });

    await system.attemptCrime(playerContext.player.id, crime.id);

    expect(repository.lastPersistInput?.proficiencyUpdates).toEqual([
      {
        inventoryItemId: 'weapon-entry-1',
        nextProficiency: 100,
      },
    ]);
    expect(playerContext.equipment.weapon?.proficiency).toBe(100);
  });
});
