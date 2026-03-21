import type { CrimeAttemptResponse } from '@cs-rio/shared';

import type { AudioSfxKey } from './audioCatalog';

interface CombatLikeResult {
  fatality: {
    defenderDied: boolean;
  };
  success: boolean;
}

export function resolveCrimeResultSfx(result: CrimeAttemptResponse): AudioSfxKey {
  if (result.arrested) {
    return 'crimeArrest';
  }

  if (result.leveledUp) {
    return 'levelUp';
  }

  return result.success ? 'crimeSuccess' : 'crimeFailure';
}

export function resolveCombatResultSfx(result: CombatLikeResult): AudioSfxKey {
  if (result.fatality.defenderDied) {
    return 'death';
  }

  return 'combat';
}

export function shouldPlayWalkSfx(lastPlayedAtMs: number, nowMs: number, cooldownMs = 250): boolean {
  return nowMs - lastPlayedAtMs >= cooldownMs;
}
