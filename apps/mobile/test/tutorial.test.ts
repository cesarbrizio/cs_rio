import { describe, expect, it } from 'vitest';

import {
  getCurrentTutorialStep,
  getTutorialProgress,
  getTutorialRemainingMinutes,
  isTutorialStillActive,
} from '../src/features/tutorial';

describe('tutorial helpers', () => {
  it('returns the next unfinished step and progress', () => {
    expect(getCurrentTutorialStep([])?.id).toBe('move');
    expect(getCurrentTutorialStep(['move', 'crimes'])?.id).toBe('market');
    expect(getTutorialProgress(['move', 'crimes'])).toEqual({
      completed: 2,
      current: 3,
      total: 4,
    });
  });

  it('tracks the 30-minute tutorial window', () => {
    const startedAt = new Date('2026-03-12T10:00:00.000Z').toISOString();

    expect(getTutorialRemainingMinutes(startedAt, new Date('2026-03-12T10:10:00.000Z').getTime())).toBe(20);
    expect(
      isTutorialStillActive(
        startedAt,
        ['move'],
        false,
        new Date('2026-03-12T10:29:30.000Z').getTime(),
      ),
    ).toBe(true);
    expect(
      isTutorialStillActive(
        startedAt,
        ['move', 'crimes', 'market', 'territory'],
        false,
        new Date('2026-03-12T10:05:00.000Z').getTime(),
      ),
    ).toBe(false);
  });
});
