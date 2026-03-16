import { describe, expect, it } from 'vitest';

import {
  formatTrainingCurrency,
  formatTrainingDuration,
  formatTrainingGains,
  formatTrainingRemaining,
  getLiveTrainingSessionState,
  sortTrainingCatalog,
} from '../src/features/training';

describe('training helpers', () => {
  it('formats money, durations and gains for the training UI', () => {
    expect(formatTrainingCurrency(10000)).toBe('R$\u00a010.000');
    expect(formatTrainingDuration(30)).toBe('30 min');
    expect(formatTrainingDuration(120)).toBe('2h');
    expect(formatTrainingRemaining(75)).toBe('1m 15s');
    expect(
      formatTrainingGains({
        carisma: 1,
        forca: 2,
        inteligencia: 0,
        resistencia: 3,
      }),
    ).toBe('+2 Forca · +3 Resistencia · +1 Carisma');
  });

  it('derives a live progress snapshot from timestamps', () => {
    const session = {
      claimedAt: null,
      costMoney: 1000,
      costCansaco: 15,
      diminishingMultiplier: 1,
      endsAt: '2026-03-11T12:30:00.000Z',
      id: 'session-1',
      progressRatio: 0,
      projectedGains: {
        carisma: 1,
        forca: 1,
        inteligencia: 0,
        resistencia: 1,
      },
      readyToClaim: false,
      remainingSeconds: 1800,
      startedAt: '2026-03-11T12:00:00.000Z',
      streakIndex: 0,
      type: 'basic' as const,
    };

    expect(getLiveTrainingSessionState(session, Date.parse('2026-03-11T12:15:00.000Z'))).toEqual({
      progressRatio: 0.5,
      readyToClaim: false,
      remainingSeconds: 900,
    });

    expect(getLiveTrainingSessionState(session, Date.parse('2026-03-11T12:31:00.000Z'))).toEqual({
      progressRatio: 1,
      readyToClaim: true,
      remainingSeconds: 0,
    });
  });

  it('sorts the catalog by the expected training order', () => {
    const catalog = sortTrainingCatalog([
      {
        basicSessionsCompleted: 0,
        durationMinutes: 120,
        isLocked: false,
        isRunnable: true,
        label: 'Treino Intensivo',
        lockReason: null,
        minimumBasicSessionsCompleted: 0,
        moneyCost: 50000,
        nextDiminishingMultiplier: 1,
        projectedGains: {
          carisma: 3,
          forca: 3,
          inteligencia: 1,
          resistencia: 3,
        },
        rewardMultiplier: 3,
        cansacoCost: 45,
        type: 'intensive' as const,
        unlockLevel: 7,
      },
      {
        basicSessionsCompleted: 0,
        durationMinutes: 30,
        isLocked: false,
        isRunnable: true,
        label: 'Treino Basico',
        lockReason: null,
        minimumBasicSessionsCompleted: 0,
        moneyCost: 1000,
        nextDiminishingMultiplier: 1,
        projectedGains: {
          carisma: 1,
          forca: 1,
          inteligencia: 0,
          resistencia: 1,
        },
        rewardMultiplier: 1,
        cansacoCost: 15,
        type: 'basic' as const,
        unlockLevel: 3,
      },
      {
        basicSessionsCompleted: 0,
        durationMinutes: 60,
        isLocked: false,
        isRunnable: true,
        label: 'Treino Avancado',
        lockReason: null,
        minimumBasicSessionsCompleted: 30,
        moneyCost: 10000,
        nextDiminishingMultiplier: 1,
        projectedGains: {
          carisma: 2,
          forca: 2,
          inteligencia: 1,
          resistencia: 2,
        },
        rewardMultiplier: 2,
        cansacoCost: 30,
        type: 'advanced' as const,
        unlockLevel: 3,
      },
    ]);

    expect(catalog.map((entry) => entry.type)).toEqual(['basic', 'advanced', 'intensive']);
  });
});
