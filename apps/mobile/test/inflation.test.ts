import { describe, expect, it } from 'vitest';

import {
  buildNpcInflationBody,
  buildNpcInflationDecisionHint,
  buildNpcInflationHeadline,
  formatNpcInflationScheduleEntry,
} from '../src/features/inflation';

const inflationSummary = {
  affectedServices: ['hospital', 'training', 'university', 'black_market'] as Array<
    'black_market' | 'hospital' | 'training' | 'university'
  >,
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
    {
      gameDay: 13,
      multiplier: 1.13,
      surchargePercent: 13,
    },
  ],
  tier: 'rising' as const,
  totalGameDays: 156,
};

describe('inflation helpers', () => {
  it('builds clear player-facing copy', () => {
    expect(buildNpcInflationHeadline(inflationSummary)).toContain('Inflação');
    expect(buildNpcInflationBody(inflationSummary)).toContain('x1.12');
    expect(buildNpcInflationDecisionHint(inflationSummary)).toContain('dia 13');
  });

  it('formats schedule rows for the complete table', () => {
    expect(formatNpcInflationScheduleEntry(inflationSummary.schedule[1]!)).toBe(
      'Dia 13 · x1.13 · +13%',
    );
  });
});
