import { type NpcInflationSummary, VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildPendingActivityCues,
  buildPendingUniversityCompletionCues,
} from '../src/features/activity-results';

describe('activity result helpers', () => {
  it('builds university completion cues from completed courses', () => {
    const cues = buildPendingUniversityCompletionCues({
      center: {
        activeCourse: null,
        completedCourseCodes: ['mao_leve'],
        courses: [
          {
            attributeRequirements: {},
            code: 'mao_leve',
            completedAt: '2026-03-14T12:10:00.000Z',
            durationHours: 12,
            effectSummary: 'Sucesso em crimes solo aumentado.',
            endsAt: '2026-03-14T12:10:00.000Z',
            isCompleted: true,
            isInProgress: false,
            isLocked: false,
            isUnlocked: true,
            label: 'Mão Leve',
            lockReason: null,
            moneyCost: 4000,
            prerequisiteCourseCodes: [],
            startedAt: '2026-03-14T00:10:00.000Z',
            unlockLevel: 2,
            vocation: VocationType.Cria,
          },
        ],
        npcInflation: buildNpcInflationStub(),
        passiveProfile: {} as never,
        player: {} as never,
        progression: {} as never,
      },
      nowMs: new Date('2026-03-14T12:20:00.000Z').getTime(),
      seenKeys: new Set(),
    });

    expect(cues).toHaveLength(1);
    expect(cues[0]?.kind).toBe('university');
    expect(cues[0]?.passiveLabel).toContain('Sucesso em crimes solo');
  });

  it('returns unseen university cues sorted by latest completion timestamp', () => {
    const cues = buildPendingActivityCues({
      nowMs: new Date('2026-03-14T12:20:00.000Z').getTime(),
      seenKeys: new Set(['university:mao_leve:2026-03-14T12:10:00.000Z']),
      universityCenter: {
        activeCourse: null,
        completedCourseCodes: ['mao_leve', 'mercado_paralelo'],
        courses: [
          {
            attributeRequirements: {},
            code: 'mao_leve',
            completedAt: '2026-03-14T12:10:00.000Z',
            durationHours: 12,
            effectSummary: 'Sucesso em crimes solo aumentado.',
            endsAt: '2026-03-14T12:10:00.000Z',
            isCompleted: true,
            isInProgress: false,
            isLocked: false,
            isUnlocked: true,
            label: 'Mão Leve',
            lockReason: null,
            moneyCost: 4000,
            prerequisiteCourseCodes: [],
            startedAt: '2026-03-14T00:10:00.000Z',
            unlockLevel: 2,
            vocation: VocationType.Cria,
          },
          {
            attributeRequirements: {},
            code: 'mercado_paralelo',
            completedAt: '2026-03-14T12:18:00.000Z',
            durationHours: 16,
            effectSummary: 'Melhora negociações e leitura de preço.',
            endsAt: '2026-03-14T12:18:00.000Z',
            isCompleted: true,
            isInProgress: false,
            isLocked: false,
            isUnlocked: true,
            label: 'Mercado Paralelo',
            lockReason: null,
            moneyCost: 120000,
            prerequisiteCourseCodes: [],
            startedAt: '2026-03-13T20:18:00.000Z',
            unlockLevel: 6,
            vocation: VocationType.Empreendedor,
          },
        ],
        npcInflation: buildNpcInflationStub(),
        passiveProfile: {} as never,
        player: {} as never,
        progression: {} as never,
      },
    });

    expect(cues).toHaveLength(1);
    expect(cues[0]?.kind).toBe('university');
    expect(cues[0]?.courseLabel).toBe('Mercado Paralelo');
  });
});

function buildNpcInflationStub(): NpcInflationSummary {
  return {
    affectedServices: ['hospital', 'university', 'black_market'],
    currentGameDay: 12,
    currentMultiplier: 1.12,
    currentSurchargePercent: 12,
    gameDayDurationHours: 6,
    maxMultiplier: 1.65,
    nextIncreaseGameDay: 13,
    nextIncreaseInDays: 1,
    nextMultiplier: 1.13,
    nextSurchargePercent: 13,
    resetsOnNewRound: true,
    roundActive: true,
    schedule: [
      {
        gameDay: 1,
        multiplier: 1,
        surchargePercent: 0,
      },
    ],
    tier: 'rising' as const,
    totalGameDays: 156,
  };
}
