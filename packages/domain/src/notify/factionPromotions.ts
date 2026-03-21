import {
  type FactionAutoPromotionResult,
  type FactionRank,
  type FactionSummary,
} from '@cs-rio/shared';

export interface FactionPromotionCue {
  body: string;
  factionLabel: string;
  key: string;
  newRankLabel: string;
  previousRankLabel: string;
  promotionReason: string;
  promotedAt: string;
  title: string;
}

export function buildFactionPromotionCue(
  result: FactionAutoPromotionResult | null | undefined,
): FactionPromotionCue | null {
  if (!result) {
    return null;
  }

  const previousRankLabel = resolveFactionRankLabel(result.previousRank);
  const newRankLabel = resolveFactionRankLabel(result.newRank);

  return {
    body: `${previousRankLabel} -> ${newRankLabel}. ${result.promotionReason}`,
    factionLabel: `${result.factionName} · ${result.factionAbbreviation}`,
    key: [
      'faction-promotion',
      result.factionId,
      result.previousRank,
      result.newRank,
      result.promotedAt,
    ].join(':'),
    newRankLabel,
    previousRankLabel,
    promotionReason: result.promotionReason,
    promotedAt: result.promotedAt,
    title: `${newRankLabel} liberado em ${result.factionAbbreviation}`,
  };
}

export function buildFactionPromotionCueFromSummary(
  faction: Pick<FactionSummary, 'autoPromotionResult'> | null | undefined,
): FactionPromotionCue | null {
  return buildFactionPromotionCue(faction?.autoPromotionResult);
}

function resolveFactionRankLabel(rank: FactionRank): string {
  switch (rank) {
    case 'patrao':
      return 'Patrao';
    case 'general':
      return 'General';
    case 'gerente':
      return 'Gerente';
    case 'vapor':
      return 'Vapor';
    case 'soldado':
      return 'Soldado';
    case 'cria':
    default:
      return 'Cria';
  }
}
