import { CrimeType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  formatCrimeChance,
  formatCrimeCooldown,
  getCrimeLevelLabel,
  groupCrimesByLevel,
  resolveCrimeResultHeadline,
  resolveCrimeResultTone,
} from '../src/features/crimes';

describe('crime helpers', () => {
  it('groups crimes by level in ascending order', () => {
    const groups = groupCrimesByLevel([
      {
        arrestChance: 8,
        cooldownRemainingSeconds: 0,
        estimatedSuccessChance: 74,
        id: 'crime-2',
        isLocked: false,
        isOnCooldown: false,
        isRunnable: true,
        levelRequired: 2,
        lockReason: null,
        minPower: 150,
        name: 'Golpe do falso delivery',
        playerPower: 400,
        nerveCost: 0,
        conceitoReward: 10,
        rewardMax: 5000,
        rewardMin: 2000,
        staminaCost: 12,
        type: CrimeType.Solo,
      },
      {
        arrestChance: 5,
        cooldownRemainingSeconds: 120,
        estimatedSuccessChance: 66,
        id: 'crime-1',
        isLocked: false,
        isOnCooldown: true,
        isRunnable: false,
        levelRequired: 1,
        lockReason: 'Cooldown ativo: 120s restantes.',
        minPower: 50,
        name: 'Roubar celular no sinal',
        playerPower: 160,
        nerveCost: 0,
        conceitoReward: 6,
        rewardMax: 1800,
        rewardMin: 500,
        staminaCost: 8,
        type: CrimeType.Solo,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.level).toBe(1);
    expect(groups[1]?.level).toBe(2);
  });

  it('formats percentages and cooldowns for UI', () => {
    expect(formatCrimeChance(73.6)).toBe('74%');
    expect(formatCrimeCooldown(0)).toBe('Disponível');
    expect(formatCrimeCooldown(75)).toBe('1m 15s');
    expect(getCrimeLevelLabel(4)).toContain('Nível 4');
  });

  it('resolves tone and headline for success, failure and arrest', () => {
    expect(
      resolveCrimeResultHeadline({
        arrestChance: 0,
        arrested: false,
        chance: 0.8,
        crimeId: 'crime-1',
        crimeName: 'Roubar',
        cooldownRemainingSeconds: 10,
        conceitoDelta: 5,
        drop: null,
        heatAfter: 1,
        heatBefore: 0,
        hpDelta: 0,
        leveledUp: false,
        level: 1,
        message: 'ok',
        moneyDelta: 100,
        nextConceitoRequired: 50,
        nextLevel: 2,
        nerveSpent: 0,
        playerPower: 100,
        resources: {
          addiction: 0,
          conceito: 5,
          hp: 100,
          money: 100,
          nerve: 100,
          stamina: 90,
        },
        staminaSpent: 10,
        success: true,
      }),
    ).toBe('Crime concluído');

    expect(
      resolveCrimeResultTone({
        arrestChance: 0.4,
        arrested: true,
        chance: 0.2,
        crimeId: 'crime-2',
        crimeName: 'Roubar',
        cooldownRemainingSeconds: 10,
        conceitoDelta: -4,
        drop: null,
        heatAfter: 10,
        heatBefore: 2,
        hpDelta: -20,
        leveledUp: false,
        level: 1,
        message: 'preso',
        moneyDelta: 0,
        nextConceitoRequired: 50,
        nextLevel: 2,
        nerveSpent: 5,
        playerPower: 90,
        resources: {
          addiction: 0,
          conceito: 1,
          hp: 80,
          money: 100,
          nerve: 95,
          stamina: 85,
        },
        staminaSpent: 10,
        success: false,
      }),
    ).toBe('danger');
  });
});
