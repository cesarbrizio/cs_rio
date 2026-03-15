import { type NpcInflationSummary, VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildPendingActivityCues,
  buildPendingTrainingCompletionCue,
  buildPendingUniversityCompletionCues,
} from '../src/features/activity-results';

describe('activity result helpers', () => {
  it('builds a training completion cue for ready sessions', () => {
    const cue = buildPendingTrainingCompletionCue({
      center: {
        activeSession: {
          claimedAt: null,
          costMoney: 1200,
          costStamina: 14,
          diminishingMultiplier: 1.2,
          endsAt: '2026-03-14T12:00:00.000Z',
          id: 'training-1',
          progressRatio: 1,
          projectedGains: {
            carisma: 0,
            forca: 3,
            inteligencia: 0,
            resistencia: 2,
          },
          readyToClaim: true,
          remainingSeconds: 0,
          startedAt: '2026-03-14T11:30:00.000Z',
          streakIndex: 1,
          type: 'advanced',
        },
        catalog: [],
        completedBasicSessions: 0,
        nextDiminishingMultiplier: 1,
        npcInflation: buildNpcInflationStub(),
        player: {} as never,
      },
      nowMs: new Date('2026-03-14T12:05:00.000Z').getTime(),
      seenKeys: new Set(),
    });

    expect(cue?.kind).toBe('training');
    expect(cue?.title).toContain('pronto para resgatar');
    expect(cue?.gainsLabel).toContain('+3 Forca');
    expect(cue?.streakLabel).toBe('2');
  });

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
      },
      nowMs: new Date('2026-03-14T12:20:00.000Z').getTime(),
      seenKeys: new Set(),
    });

    expect(cues).toHaveLength(1);
    expect(cues[0]?.kind).toBe('university');
    expect(cues[0]?.passiveLabel).toContain('Sucesso em crimes solo');
  });

  it('combines unseen training and university cues sorted by latest timestamp', () => {
    const cues = buildPendingActivityCues({
      nowMs: new Date('2026-03-14T12:20:00.000Z').getTime(),
      seenKeys: new Set(),
      trainingCenter: {
        activeSession: {
          claimedAt: null,
          costMoney: 1000,
          costStamina: 10,
          diminishingMultiplier: 1.1,
          endsAt: '2026-03-14T12:05:00.000Z',
          id: 'training-2',
          progressRatio: 1,
          projectedGains: {
            carisma: 0,
            forca: 1,
            inteligencia: 0,
            resistencia: 1,
          },
          readyToClaim: true,
          remainingSeconds: 0,
          startedAt: '2026-03-14T11:35:00.000Z',
          streakIndex: 0,
          type: 'basic',
        },
        catalog: [],
        completedBasicSessions: 0,
        nextDiminishingMultiplier: 1,
        npcInflation: buildNpcInflationStub(),
        player: {} as never,
      },
      universityCenter: {
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
      },
    });

    expect(cues).toHaveLength(2);
    expect(cues[0]?.kind).toBe('university');
    expect(cues[1]?.kind).toBe('training');
  });
});

function buildNpcInflationStub(): NpcInflationSummary {
  return {
    affectedServices: ['hospital', 'training', 'university', 'black_market'],
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
