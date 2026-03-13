import { describe, expect, it } from 'vitest';

import {
  buildContractExecutionHighlights,
  buildContractTargets,
  formatContractCountdown,
  resolveContractNotificationLabel,
  resolveContractStatusLabel,
} from '../src/features/contracts';

describe('contracts helpers', () => {
  it('builds contract targets from realtime players without the current player', () => {
    const targets = buildContractTargets({
      currentPlayerId: 'player-1',
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

    expect(targets).toHaveLength(1);
    expect(targets[0]?.nickname).toBe('Zulu');
  });

  it('formats contract labels and countdowns for the UI', () => {
    expect(resolveContractStatusLabel('accepted')).toBe('Aceito');
    expect(resolveContractNotificationLabel('target_warned')).toBe('Alvo avisado');
    expect(formatContractCountdown('2026-03-11T14:00:00.000Z', new Date('2026-03-11T13:00:00.000Z').getTime())).toBe('1h 0min');
  });

  it('summarizes contract execution highlights', () => {
    const lines = buildContractExecutionHighlights({
      assassin: {
        conceitoDelta: 4,
        heatAfter: 50,
        heatBefore: 35,
        heatDelta: 15,
        hospitalization: {
          durationMinutes: 0,
          recommended: false,
          severity: 'none',
        },
        hpAfter: 71,
        hpBefore: 100,
        hpDelta: -29,
        id: 'assassin',
        moneyAfter: 12000,
        moneyBefore: 8000,
        moneyDelta: 4000,
        nickname: 'Executor',
        staminaAfter: 38,
        staminaBefore: 60,
        staminaDelta: -22,
      },
      contract: {
        acceptedAt: '2026-03-11T12:00:00.000Z',
        acceptedBy: 'assassin',
        acceptedByNickname: 'Executor',
        canAccept: false,
        createdAt: '2026-03-11T11:00:00.000Z',
        expiresAt: '2026-03-11T17:00:00.000Z',
        fee: 5000,
        id: 'contract-1',
        isTarget: false,
        requesterId: 'req',
        requesterNickname: 'Mandante',
        reward: 25000,
        status: 'completed',
        targetId: 'target',
        targetNickname: 'Alvo',
        totalCost: 30000,
      },
      defender: {
        hospitalization: {
          durationMinutes: 120,
          recommended: true,
          severity: 'heavy',
        },
        hpAfter: 4,
        hpBefore: 100,
        hpDelta: -96,
        id: 'target',
        moneyAfter: 0,
        moneyBefore: 1500,
        moneyDelta: -1500,
        nickname: 'Alvo',
        prisonFollowUpChance: 0.4,
      },
      fatality: {
        chance: 0.55,
        defenderDied: false,
        eligible: true,
      },
      loot: {
        amount: 1500,
        percentage: 100,
      },
      message: 'O contrato virou realidade na esquina.',
      mode: 'contract',
      powerRatio: 1.92,
      success: true,
      targetNotified: true,
      tier: 'total_takedown',
    });

    expect(lines[0]).toBe('O contrato virou realidade na esquina.');
    expect(lines.some((line) => line.includes('Espólio puxado'))).toBe(true);
    expect(lines.some((line) => line.includes('Alvo cai no hospital'))).toBe(true);
    expect(lines.some((line) => line.includes('avisado'))).toBe(true);
  });
});
