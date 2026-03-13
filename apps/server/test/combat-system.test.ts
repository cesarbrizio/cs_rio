import {
  FACTION_EMPTY_UPGRADE_EFFECTS,
  RegionId,
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  VocationType,
  type UniversityPassiveProfile,
} from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  CombatSystem,
  type CombatPlayerContext,
} from '../src/systems/CombatSystem.js';

class StaticFactionUpgradeReader {
  constructor(
    private readonly effects = FACTION_EMPTY_UPGRADE_EFFECTS,
  ) {}

  async getFactionUpgradeEffectsForFaction() {
    return { ...this.effects };
  }
}

class StaticUniversityReader {
  constructor(private readonly profiles: Record<string, UniversityPassiveProfile> = {}) {}

  async getActiveCourse() {
    return null;
  }

  async getPassiveProfile(playerId: string) {
    return {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE,
      ...this.profiles[playerId],
      business: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.business,
        ...this.profiles[playerId]?.business,
      },
      crime: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.crime,
        ...this.profiles[playerId]?.crime,
      },
      factory: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.factory,
        ...this.profiles[playerId]?.factory,
      },
      faction: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.faction,
        ...this.profiles[playerId]?.faction,
      },
      market: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.market,
        ...this.profiles[playerId]?.market,
      },
      police: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.police,
        ...this.profiles[playerId]?.police,
      },
      pvp: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp,
        ...this.profiles[playerId]?.pvp,
      },
      social: {
        ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.social,
        ...this.profiles[playerId]?.social,
      },
    };
  }
}

function createCombatContext(
  playerId: string,
  overrides: Partial<CombatPlayerContext> = {},
): CombatPlayerContext {
  return {
    attributes: {
      carisma: 14,
      forca: 24,
      inteligencia: 12,
      resistencia: 18,
      ...(overrides.attributes ?? {}),
    },
    equipment: {
      vest: {
        defense: 12,
        durability: 100,
        inventoryItemId: `${playerId}-vest`,
      },
      weapon: {
        durability: 100,
        inventoryItemId: `${playerId}-weapon`,
        power: 20,
        proficiency: 30,
      },
      ...(overrides.equipment ?? {}),
    },
    factionId: 'faction-1',
    player: {
      characterCreatedAt: new Date('2026-03-11T10:00:00.000Z'),
      id: playerId,
      level: 6,
      nickname: playerId,
      regionId: RegionId.ZonaNorte,
      resources: {
        conceito: 20000,
        heat: 0,
        hp: 100,
        money: 1000,
        stamina: 100,
      },
      vocation: VocationType.Cria,
      ...(overrides.player ?? {}),
    },
    ...overrides,
  };
}

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('CombatSystem', () => {
  it('aplica arma, colete, vocacao, faccao e universidade no calculo de poder', async () => {
    const system = new CombatSystem({
      factionUpgradeReader: new StaticFactionUpgradeReader({
        ...FACTION_EMPTY_UPGRADE_EFFECTS,
        attributeBonusMultiplier: 1.1,
      }),
      universityReader: new StaticUniversityReader({
        soldado: {
          ...UNIVERSITY_EMPTY_PASSIVE_PROFILE,
          pvp: {
            ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp,
            assaultPowerMultiplier: 1.25,
          },
        },
      }),
    });
    const player = createCombatContext('soldado', {
      attributes: {
        carisma: 10,
        forca: 40,
        inteligencia: 25,
        resistencia: 20,
      },
      equipment: {
        vest: {
          defense: 20,
          durability: 100,
          inventoryItemId: 'vest-1',
        },
        weapon: {
          durability: 100,
          inventoryItemId: 'weapon-1',
          power: 30,
          proficiency: 50,
        },
      },
      player: {
        ...createCombatContext('soldado').player,
        id: 'soldado',
        vocation: VocationType.Soldado,
      },
    });

    const result = await system.calculatePlayerPower(player, 'assault');

    expect(result.power).toBe(160);
    expect(result.breakdown.attributePower).toBe(63.65);
    expect(result.breakdown.equipmentPower).toBe(53);
    expect(result.breakdown.factionMultiplier).toBe(1.1);
    expect(result.breakdown.universityMultiplier).toBe(1.25);
    expect(result.breakdown.vocationMultiplier).toBe(1.1);
  });

  it('resolve falha dura com perda de hp e calor imediato', async () => {
    const system = new CombatSystem();
    const attacker = createCombatContext('attacker');
    const defender = createCombatContext('defender');

    const result = await system.resolveCombat({
      attacker,
      attackerPower: 70,
      defender,
      defenderPower: 100,
      mode: 'assault',
    });

    expect(result.tier).toBe('hard_fail');
    expect(result.success).toBe(false);
    expect(result.attacker.hpDelta).toBe(-20);
    expect(result.attacker.heatDelta).toBe(10);
    expect(result.loot).toBeNull();
    expect(result.defender.hospitalization.recommended).toBe(false);
  });

  it('resolve vitoria apertada sem loot financeiro', async () => {
    const system = new CombatSystem();
    const attacker = createCombatContext('attacker');
    const defender = createCombatContext('defender');

    const result = await system.resolveCombat({
      attacker,
      attackerPower: 105,
      defender,
      defenderPower: 100,
      mode: 'assault',
    });

    expect(result.tier).toBe('narrow_victory');
    expect(result.loot).toBeNull();
    expect(result.attributeSteal).toBeNull();
    expect(result.defender.hospitalization.recommended).toBe(true);
    expect(result.defender.hospitalization.severity).toBe('standard');
  });

  it('resolve vitoria clara com loot e roubo de atributo', async () => {
    const system = new CombatSystem({
      random: createRandomSequence([0.4, 0.3, 0.5]),
    });
    const attacker = createCombatContext('attacker');
    const defender = createCombatContext('defender', {
      attributes: {
        carisma: 16,
        forca: 80,
        inteligencia: 18,
        resistencia: 30,
      },
      player: {
        ...createCombatContext('defender').player,
        money: 1000,
      },
    });

    const result = await system.resolveCombat({
      attacker,
      attackerPower: 150,
      defender,
      defenderPower: 100,
      mode: 'assault',
    });

    expect(result.tier).toBe('clear_victory');
    expect(result.loot).toEqual({
      amount: 160,
      percentage: 0.16,
    });
    expect(result.attributeSteal).toEqual({
      amount: 2,
      attribute: 'forca',
      percentage: 0.03,
    });
    expect(result.defender.hospitalization.durationMinutes).toBe(240);
  });

  it('resolve abate total de contrato com morte e chance alta de cadeia em alvo quente', async () => {
    const system = new CombatSystem({
      random: createRandomSequence([0.5, 0.8, 1]),
    });
    const attacker = createCombatContext('attacker');
    const defender = createCombatContext('defender', {
      player: {
        ...createCombatContext('defender').player,
        resources: {
          ...createCombatContext('defender').player.resources,
          heat: 85,
          money: 1000,
        },
      },
    });

    const result = await system.resolveCombat({
      attacker,
      attackerPower: 220,
      defender,
      defenderPower: 100,
      mode: 'contract',
    });

    expect(result.tier).toBe('total_takedown');
    expect(result.fatality).toEqual({
      chance: 1,
      defenderDied: true,
      eligible: true,
    });
    expect(result.defender.prisonFollowUpChance).toBe(0.45);
    expect(result.attacker.heatDelta).toBe(25);
    expect(result.message).toContain('Contrato executado');
  });

  it('calcula poder de emboscada com bonus de coordenacao por grupo', async () => {
    const system = new CombatSystem();
    const one = createCombatContext('one');
    const two = createCombatContext('two');
    const three = createCombatContext('three');

    const singlePower = await system.calculatePlayerPower(one, 'ambush');
    const ambushPower = await system.calculateAmbushPower([one, two, three]);

    expect(ambushPower).toBe(Math.round(singlePower.power * 3 * 1.1));
  });
});
