import { VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildAmbushParticipantOptions,
  buildCombatResultHighlights,
  buildCombatTargets,
  canLeadAmbush,
  resolveCombatTierLabel,
} from '../src/features/combat';

describe('combat helpers', () => {
  it('filters the current player and pushes same-faction targets to the end', () => {
    const targets = buildCombatTargets({
      currentPlayerId: 'player-1',
      ownFactionMemberIds: ['player-3'],
      realtimePlayers: [
        {
          animation: 'idle_s',
          nickname: 'Zulu',
          playerId: 'player-3',
          regionId: 'zona_norte',
          sessionId: 's3',
          title: 'Soldado',
          vocation: 'soldado',
          x: 10,
          y: 12,
        },
        {
          animation: 'idle_s',
          nickname: 'Bravo',
          playerId: 'player-2',
          regionId: 'zona_norte',
          sessionId: 's2',
          title: 'Vapor',
          vocation: 'gerente',
          x: 8,
          y: 4,
        },
        {
          animation: 'idle_s',
          nickname: 'Alpha',
          playerId: 'player-1',
          regionId: 'zona_norte',
          sessionId: 's1',
          title: 'Cria',
          vocation: 'cria',
          x: 1,
          y: 1,
        },
      ],
    });

    expect(targets.map((target) => target.id)).toEqual(['player-2', 'player-3']);
    expect(targets[1]?.disabledReason).toBe('Mesmo bonde');
  });

  it('marks only soldado or higher as eligible for ambush', () => {
    const members = buildAmbushParticipantOptions({
      currentPlayerId: 'leader',
      members: [
        {
          id: 'leader',
          isLeader: true,
          isNpc: false,
          joinedAt: '2026-03-11T10:00:00.000Z',
          level: 12,
          nickname: 'Chefe',
          rank: 'gerente',
          vocation: VocationType.Politico,
        },
        {
          id: 'street-kid',
          isLeader: false,
          isNpc: false,
          joinedAt: '2026-03-11T10:00:00.000Z',
          level: 6,
          nickname: 'Novato',
          rank: 'cria',
          vocation: VocationType.Cria,
        },
        {
          id: 'soldado-1',
          isLeader: false,
          isNpc: false,
          joinedAt: '2026-03-11T10:00:00.000Z',
          level: 11,
          nickname: 'Blindado',
          rank: 'soldado',
          vocation: VocationType.Soldado,
        },
      ],
    });

    expect(members.map((member) => member.id)).toEqual(['soldado-1', 'street-kid']);
    expect(members[0]?.isEligible).toBe(true);
    expect(members[1]?.disabledReason).toContain('soldado ou superior');
    expect(canLeadAmbush('gerente')).toBe(true);
    expect(canLeadAmbush('soldado')).toBe(false);
  });

  it('builds readable combat highlights for the result card', () => {
    const highlights = buildCombatResultHighlights({
      attacker: {
        conceitoDelta: 3,
        heatAfter: 42,
        heatBefore: 30,
        heatDelta: 12,
        hospitalization: {
          durationMinutes: 0,
          recommended: false,
          severity: 'none',
        },
        hpAfter: 81,
        hpBefore: 100,
        hpDelta: -19,
        id: 'attacker',
        moneyAfter: 2800,
        moneyBefore: 2400,
        moneyDelta: 400,
        nickname: 'Atacante',
        staminaAfter: 52,
        staminaBefore: 70,
        staminaDelta: -18,
      },
      attributeSteal: {
        amount: 2,
        attribute: 'forca',
        percentage: 4,
      },
      defender: {
        hospitalization: {
          durationMinutes: 45,
          recommended: true,
          severity: 'standard',
        },
        hpAfter: 12,
        hpBefore: 100,
        hpDelta: -88,
        id: 'defender',
        moneyAfter: 600,
        moneyBefore: 1000,
        moneyDelta: -400,
        nickname: 'Defensor',
        prisonFollowUpChance: 0.25,
      },
      fatality: {
        chance: 0.15,
        defenderDied: false,
        eligible: true,
      },
      loot: {
        amount: 400,
        percentage: 40,
      },
      message: 'O alvo caiu para trás e perdeu a mochila.',
      mode: 'assault',
      powerRatio: 1.46,
      success: true,
      targetCooldownSeconds: 7200,
      tier: 'clear_victory',
    });

    expect(highlights).toContain('O alvo caiu para trás e perdeu a mochila.');
    expect(highlights.some((line) => line.includes('Espólio puxado'))).toBe(true);
    expect(highlights.some((line) => line.includes('força'))).toBe(true);
    expect(highlights.some((line) => line.includes('Cooldown do alvo'))).toBe(true);
    expect(resolveCombatTierLabel('clear_victory')).toBe('Vitória limpa');
  });
});
