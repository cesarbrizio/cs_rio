import { type RegionId, type RobberyExecutorType, type RobberyFailureOutcome, type RobberyType, type VehicleRobberyRoute } from '@cs-rio/shared';

export type FactionRobberyPolicyMode = 'allowed' | 'forbidden';

export interface FactionRobberyPolicy {
  global: FactionRobberyPolicyMode;
  regions: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

interface FactionRobberyOutcomeSatisfactionDeltaInput {
  executorType: RobberyExecutorType;
  outcome: RobberyFailureOutcome | 'success';
  robberyType: RobberyType;
  success: boolean;
  vehicleRoute: VehicleRobberyRoute | null;
}

const GLOBAL_POLICY_RESTRICTIVENESS = 6;
const REGIONAL_POLICY_RESTRICTIVENESS = 2;

export function applyFactionInternalSatisfactionDelta(currentValue: number, delta: number): number {
  return clampFactionInternalSatisfaction(currentValue + delta);
}

export function clampFactionInternalSatisfaction(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function resolveFactionRobberyOutcomeSatisfactionDelta(
  input: FactionRobberyOutcomeSatisfactionDeltaInput,
): number {
  let delta = input.executorType === 'bandits' ? (input.success ? 2 : -3) : input.success ? 1 : -1;

  if (input.success) {
    if (input.robberyType === 'truck') {
      delta += 1;
    }

    if (input.robberyType === 'vehicle' && input.vehicleRoute === 'ransom') {
      delta += 1;
    }
  }

  if (!input.success && input.executorType === 'bandits' && input.robberyType === 'truck') {
    delta -= 1;
  }

  return delta;
}

export function resolveFactionRobberyPolicySatisfactionDelta(
  previousPolicy: FactionRobberyPolicy,
  nextPolicy: FactionRobberyPolicy,
): number {
  const previousScore = calculateFactionRobberyPolicyRestrictiveness(previousPolicy);
  const nextScore = calculateFactionRobberyPolicyRestrictiveness(nextPolicy);
  const scoreDelta = nextScore - previousScore;

  if (scoreDelta === 0) {
    return 0;
  }

  return clampSigned(-Math.round(scoreDelta * 1.5), -10, 8);
}

function calculateFactionRobberyPolicyRestrictiveness(policy: FactionRobberyPolicy): number {
  const regionalRestrictions = Object.values(policy.regions).filter((value) => value === 'forbidden').length;

  return (
    (policy.global === 'forbidden' ? GLOBAL_POLICY_RESTRICTIVENESS : 0) +
    regionalRestrictions * REGIONAL_POLICY_RESTRICTIVENESS
  );
}

function clampSigned(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
