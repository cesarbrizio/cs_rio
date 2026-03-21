import type { CrimeAttemptResponse } from '@cs-rio/shared';

export type VisualEffectVariant = 'combat' | 'danger' | 'level_up' | 'success';

interface CombatLikeResult {
  fatality: {
    defenderDied: boolean;
  };
  success: boolean;
}

export function resolveCrimeVisualEffectVariant(result: CrimeAttemptResponse): VisualEffectVariant {
  if (result.leveledUp) {
    return 'level_up';
  }

  if (result.arrested || !result.success) {
    return 'danger';
  }

  return 'success';
}

export function resolveCombatVisualEffectVariant(result: CombatLikeResult): VisualEffectVariant {
  if (result.fatality.defenderDied || !result.success) {
    return 'danger';
  }

  return 'combat';
}
