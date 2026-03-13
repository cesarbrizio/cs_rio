import { describe, expect, it } from 'vitest';

import {
  resolveCombatResultSfx,
  resolveCrimeResultSfx,
  shouldPlayWalkSfx,
} from '../src/audio/audioFeedback';

describe('audio feedback rules', () => {
  it('prefers arrest and level-up cues for crime results', () => {
    expect(
      resolveCrimeResultSfx({
        arrested: true,
        leveledUp: false,
        success: false,
      } as never),
    ).toBe('crimeArrest');

    expect(
      resolveCrimeResultSfx({
        arrested: false,
        leveledUp: true,
        success: true,
      } as never),
    ).toBe('levelUp');

    expect(
      resolveCrimeResultSfx({
        arrested: false,
        leveledUp: false,
        success: true,
      } as never),
    ).toBe('crimeSuccess');
  });

  it('uses death only when combat actually kills the defender', () => {
    expect(
      resolveCombatResultSfx({
        fatality: {
          defenderDied: true,
        },
      } as never),
    ).toBe('death');

    expect(
      resolveCombatResultSfx({
        fatality: {
          defenderDied: false,
        },
      } as never),
    ).toBe('combat');
  });

  it('throttles walk cues to avoid spam on repeated taps', () => {
    expect(shouldPlayWalkSfx(0, 300)).toBe(true);
    expect(shouldPlayWalkSfx(100, 250)).toBe(false);
    expect(shouldPlayWalkSfx(100, 400, 250)).toBe(true);
  });
});
