import {
  type FavelaBaileMcTier,
  type FactionWarPrepareInput,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import { colors } from '../theme/colors';

export const BAILE_TIERS: FavelaBaileMcTier[] = ['local', 'regional', 'estelar'];

export function extractResponseMessage(result: unknown): string | null {
  if (
    typeof result === 'object' &&
    result !== null &&
    'message' in result &&
    typeof result.message === 'string'
  ) {
    return result.message;
  }

  return null;
}

export function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseWarPreparationInput(
  budgetValue: string,
  soldierCommitmentValue: string,
): FactionWarPrepareInput | null {
  const budget = parsePositiveInteger(budgetValue);
  const soldierCommitment = parsePositiveInteger(soldierCommitmentValue);

  if (budget === null || soldierCommitment === null) {
    return null;
  }

  return {
    budget,
    soldierCommitment,
  };
}

export function resolveBaileTierLabel(tier: FavelaBaileMcTier): string {
  switch (tier) {
    case 'local':
      return 'Local';
    case 'regional':
      return 'Regional';
    case 'estelar':
      return 'Estelar';
  }
}

export function resolvePreferredFavelaId(
  overview: TerritoryOverviewResponse,
  regionId: string | null,
  preferredFavelaId: string | null,
  routeFavelaId: string | null,
): string | null {
  const candidates = [preferredFavelaId, routeFavelaId].filter((value): value is string =>
    Boolean(value),
  );

  for (const candidate of candidates) {
    if (overview.favelas.some((favela) => favela.id === candidate)) {
      return candidate;
    }
  }

  if (regionId) {
    const regionalFavela = overview.favelas.find((favela) => favela.regionId === regionId);

    if (regionalFavela) {
      return regionalFavela.id;
    }
  }

  return overview.favelas[0]?.id ?? null;
}

export function resolvePreferredRegionId(
  overview: TerritoryOverviewResponse,
  preferredRegionId: string | null,
  preferredFavelaId: string | null,
  fallbackPlayerRegionId: string | null,
): string | null {
  if (preferredFavelaId) {
    const focusedFavela = overview.favelas.find((favela) => favela.id === preferredFavelaId);

    if (focusedFavela) {
      return focusedFavela.regionId;
    }
  }

  if (
    preferredRegionId &&
    overview.regions.some((region) => region.regionId === preferredRegionId)
  ) {
    return preferredRegionId;
  }

  if (
    fallbackPlayerRegionId &&
    overview.regions.some((region) => region.regionId === fallbackPlayerRegionId)
  ) {
    return fallbackPlayerRegionId;
  }

  return overview.regions[0]?.regionId ?? null;
}

export function resolveSatisfactionColor(
  tier: TerritoryFavelaSummary['satisfactionProfile']['tier'],
): string {
  switch (tier) {
    case 'happy':
      return colors.success;
    case 'stable':
      return colors.info;
    case 'restless':
      return colors.warning;
    case 'critical':
    case 'collapsed':
      return colors.danger;
  }
}

export function resolveStateColor(state: TerritoryFavelaSummary['state']): string {
  switch (state) {
    case 'controlled':
      return colors.success;
    case 'neutral':
      return colors.info;
    case 'state':
      return colors.warning;
    case 'at_war':
      return colors.danger;
  }
}

export function resolveStateTone(
  state: TerritoryFavelaSummary['state'],
): 'danger' | 'neutral' | 'success' | 'warning' {
  switch (state) {
    case 'controlled':
      return 'success';
    case 'neutral':
      return 'neutral';
    case 'state':
      return 'warning';
    case 'at_war':
      return 'danger';
  }
}
