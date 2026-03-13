import { describe, expect, it } from 'vitest';

import {
  resolveCombatVisualEffectVariant,
  resolveCrimeVisualEffectVariant,
} from '../src/features/visualFeedback';

describe('visual feedback rules', () => {
  it('prioritizes level up, arrest and success states for crime bursts', () => {
    expect(
      resolveCrimeVisualEffectVariant({
        arrested: false,
        leveledUp: true,
        success: true,
      } as never),
    ).toBe('level_up');

    expect(
      resolveCrimeVisualEffectVariant({
        arrested: true,
        leveledUp: false,
        success: false,
      } as never),
    ).toBe('danger');

    expect(
      resolveCrimeVisualEffectVariant({
        arrested: false,
        leveledUp: false,
        success: true,
      } as never),
    ).toBe('success');
  });

  it('uses danger for failed or lethal combat and combat for standard victories', () => {
    expect(
      resolveCombatVisualEffectVariant({
        fatality: {
          defenderDied: true,
        },
        success: true,
      } as never),
    ).toBe('danger');

    expect(
      resolveCombatVisualEffectVariant({
        fatality: {
          defenderDied: false,
        },
        success: false,
      } as never),
    ).toBe('danger');

    expect(
      resolveCombatVisualEffectVariant({
        fatality: {
          defenderDied: false,
        },
        success: true,
      } as never),
    ).toBe('combat');
  });
});
