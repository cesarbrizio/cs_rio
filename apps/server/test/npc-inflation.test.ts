import { describe, expect, it } from 'vitest';

import {
  buildNpcInflationSummary,
  inflateNpcMoney,
  type NpcInflationProfile,
} from '../src/services/npc-inflation.js';

describe('npc inflation', () => {
  it('builds a player-facing summary with next increase and schedule', () => {
    const profile: NpcInflationProfile = {
      currentRoundDay: 12,
      moneyMultiplier: 1.12,
      roundId: 'round-1',
    };

    const summary = buildNpcInflationSummary(profile);

    expect(summary.currentGameDay).toBe(12);
    expect(summary.currentMultiplier).toBe(1.12);
    expect(summary.currentSurchargePercent).toBe(12);
    expect(summary.nextIncreaseGameDay).toBeGreaterThan(summary.currentGameDay);
    expect(summary.nextMultiplier).toBeGreaterThan(summary.currentMultiplier);
    expect(summary.schedule[0]).toMatchObject({
      gameDay: 1,
      multiplier: 1,
      surchargePercent: 0,
    });
    expect(summary.schedule.at(-1)).toMatchObject({
      gameDay: 156,
      multiplier: 1.65,
      surchargePercent: 65,
    });
  });

  it('keeps inflation neutral without an active round', () => {
    const profile: NpcInflationProfile = {
      currentRoundDay: 1,
      moneyMultiplier: 1,
      roundId: null,
    };

    const summary = buildNpcInflationSummary(profile);

    expect(summary.roundActive).toBe(false);
    expect(summary.nextIncreaseGameDay).toBeNull();
    expect(summary.nextMultiplier).toBeNull();
    expect(inflateNpcMoney(1000, profile)).toBe(1000);
  });
});
