import { randomUUID } from 'node:crypto';

import { CrimeType, VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import type { FactionRank } from '@cs-rio/shared';
import type { KeyValueStore } from '../src/services/auth.js';
import type { CrimeError, CrimeDefinitionRecord } from '../src/systems/CrimeSystem.js';
import {
  FactionCrimeSystem,
  type FactionCrimeRepository,
} from '../src/systems/FactionCrimeSystem.js';
import { CooldownSystem } from '../src/systems/CooldownSystem.js';

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

function createParticipant(input: {
  factionId?: string;
  hp?: number;
  id?: string;
  level?: number;
  money?: number;
  disposicao?: number;
  nickname: string;
  rank: FactionRank;
  cansaco?: number;
}): Awaited<ReturnType<InMemoryFactionCrimeRepository['listFactionParticipants']>>[number] {
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
        inventoryItemId: `${input.nickname}-vest`,
      },
      weapon: {
        durability: 12,
        inventoryItemId: `${input.nickname}-weapon`,
        power: 150,
        proficiency: 0,
      },
    },
    factionId: input.factionId ?? 'faction-1',
    player: {
      characterCreatedAt: new Date('2026-03-10T10:00:00.000Z'),
      id: input.id ?? randomUUID(),
      level: input.level ?? 5,
      nickname: input.nickname,
      resources: {
        addiction: 0,
        conceito: 1500,
        hp: input.hp ?? 100,
        money: input.money ?? 1000,
        disposicao: input.disposicao ?? 100,
        cansaco: input.cansaco ?? 100,
      },
      vocation: VocationType.Soldado,
    },
    rank: input.rank,
  };
}

class InMemoryFactionCrimeRepository implements FactionCrimeRepository {
  public persistedUpdates: Array<{
    conceitoDelta: number;
    crimeName: string;
    hpDelta: number;
    logType: 'faction_crime_failure' | 'faction_crime_success';
    moneyDelta: number;
    nextLevel: number;
    nextResources: {
      conceito: number;
      hp: number;
      money: number;
      disposicao: number;
      cansaco: number;
    };
    playerId: string;
  }> = [];

  constructor(
    private readonly crime: CrimeDefinitionRecord,
    private readonly participants: ReturnType<typeof createParticipant>[],
  ) {}

  async getFactionCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null> {
    return this.crime.id === crimeId ? this.crime : null;
  }

  async listFactionCrimes(): Promise<CrimeDefinitionRecord[]> {
    return [this.crime];
  }

  async listFactionParticipants(factionId: string) {
    return this.participants
      .filter((participant) => participant.factionId === factionId)
      .map((participant) => structuredClone(participant));
  }

  async persistFactionCrimeAttempt(updates: typeof this.persistedUpdates): Promise<void> {
    this.persistedUpdates = updates;

    for (const update of updates) {
      const participant = this.participants.find((entry) => entry.player.id === update.playerId);

      if (!participant) {
        continue;
      }

      participant.player.level = update.nextLevel;
      participant.player.resources = {
        ...participant.player.resources,
        ...update.nextResources,
      };
    }
  }
}

describe('faction crime system', () => {
  it('coordinates a faction crime, sums crew power, splits reward and applies faction cooldown', async () => {
    const now = Date.parse('2026-03-11T04:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const cooldownSystem = new CooldownSystem({
      keyValueStore: store,
      now: () => now,
    });
    const leader = createParticipant({
      nickname: 'lider_bonde',
      rank: 'patrao',
    });
    const general = createParticipant({
      nickname: 'general_bonde',
      rank: 'general',
    });
    const repository = new InMemoryFactionCrimeRepository(
      {
        arrestChance: 18,
        code: 'roubo_banco_bonde',
        conceitoReward: 120,
        cooldownSeconds: 3600,
        id: 'crime-faccao-1',
        levelRequired: 5,
        minPower: 1500,
        name: 'Roubo a banco central em bonde',
        disposicaoCost: 20,
        rewardMax: 200000,
        rewardMin: 100000,
        cansacoCost: 30,
        type: CrimeType.Faccao,
      },
      [leader, general],
    );
    const system = new FactionCrimeSystem({
      cooldownSystem,
      now: () => new Date(now),
      random: () => 0.3,
      repository,
    });

    const result = await system.attemptCrime(leader.player.id, 'faction-1', 'crime-faccao-1', {
      participantIds: [general.player.id],
    });

    expect(result.success).toBe(true);
    expect(result.participantCount).toBe(2);
    expect(result.combinedPower).toBeGreaterThan(result.minimumPowerRequired);
    expect(result.rewardTotal).toBe(130000);
    expect(result.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conceitoDelta: 120,
          moneyDelta: 65000,
          disposicaoSpent: 20,
          cansacoSpent: 30,
        }),
      ]),
    );
    expect(repository.persistedUpdates).toHaveLength(2);
    expect(repository.persistedUpdates[0]?.logType).toBe('faction_crime_success');
    expect(repository.persistedUpdates[1]?.nextResources.cansaco).toBe(70);

    await expect(
      system.attemptCrime(leader.player.id, 'faction-1', 'crime-faccao-1', {
        participantIds: [general.player.id],
      }),
    ).rejects.toMatchObject({
      code: 'cooldown_active',
    });
  });

  it('blocks low ranks from coordinating faction crimes', async () => {
    const now = Date.parse('2026-03-11T04:00:00.000Z');
    const store = new InMemoryKeyValueStore(() => now);
    const soldado = createParticipant({
      nickname: 'soldado_bonde',
      rank: 'soldado',
    });
    const general = createParticipant({
      nickname: 'general_bonde',
      rank: 'general',
    });
    const repository = new InMemoryFactionCrimeRepository(
      {
        arrestChance: 18,
        code: 'roubo_banco_bonde',
        conceitoReward: 120,
        cooldownSeconds: 3600,
        id: 'crime-faccao-1',
        levelRequired: 5,
        minPower: 1500,
        name: 'Roubo a banco central em bonde',
        disposicaoCost: 20,
        rewardMax: 200000,
        rewardMin: 100000,
        cansacoCost: 30,
        type: CrimeType.Faccao,
      },
      [soldado, general],
    );
    const system = new FactionCrimeSystem({
      cooldownSystem: new CooldownSystem({
        keyValueStore: store,
        now: () => now,
      }),
      repository,
    });

    await expect(
      system.attemptCrime(soldado.player.id, 'faction-1', 'crime-faccao-1', {
        participantIds: [general.player.id],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CrimeError>>({
        code: 'forbidden',
      }),
    );
  });
});
