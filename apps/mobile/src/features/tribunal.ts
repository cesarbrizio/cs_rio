import {
  REGIONS,
  TRIBUNAL_PUNISHMENT_LABELS,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
  type TribunalCaseSeverity,
  type TribunalCaseSide,
  type TribunalJudgmentRead,
  type TribunalPunishment,
  type TribunalPunishmentRead,
} from '@cs-rio/shared';

export function buildControlledTribunalFavelas(
  overview: TerritoryOverviewResponse | null,
): TerritoryFavelaSummary[] {
  if (!overview?.playerFactionId) {
    return [];
  }

  return overview.favelas
    .filter((favela) => favela.controllingFaction?.id === overview.playerFactionId)
    .sort((left, right) => {
      const regionCompare = resolveTribunalRegionLabel(left.regionId).localeCompare(
        resolveTribunalRegionLabel(right.regionId),
        'pt-BR',
      );

      if (regionCompare !== 0) {
        return regionCompare;
      }

      return left.name.localeCompare(right.name, 'pt-BR');
    });
}

export function formatTribunalTimestamp(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function pickInitialTribunalFavelaId(
  favelas: TerritoryFavelaSummary[],
  preferredFavelaId?: string | null,
): string | null {
  if (preferredFavelaId && favelas.some((favela) => favela.id === preferredFavelaId)) {
    return preferredFavelaId;
  }

  return favelas[0]?.id ?? null;
}

export function resolveTribunalJudgmentReadLabel(read: TribunalJudgmentRead): string {
  switch (read) {
    case 'justa':
      return 'Justa';
    case 'arriscada':
      return 'Arriscada';
    case 'covarde':
      return 'Covarde';
    case 'injusta':
      return 'Injusta';
    case 'brutal_desnecessaria':
      return 'Brutal desnecessária';
  }
}

export function resolveTribunalPunishmentLabel(punishment: TribunalPunishment): string {
  return TRIBUNAL_PUNISHMENT_LABELS[punishment];
}

export function resolveTribunalPunishmentReadLabel(read: TribunalPunishmentRead): string {
  switch (read) {
    case 'proporcional':
      return 'Proporcional';
    case 'prudente':
      return 'Prudente';
    case 'dureza_arriscada':
      return 'Dureza arriscada';
    case 'leve_demais':
      return 'Leve demais';
    case 'condena_inocente':
      return 'Condena inocente';
    case 'brutal':
      return 'Brutal';
  }
}

export function resolveTribunalRegionLabel(regionId: string): string {
  return REGIONS.find((region) => region.id === regionId)?.label ?? regionId;
}

export function resolveTribunalSeverityLabel(severity: TribunalCaseSeverity): string {
  switch (severity) {
    case 'baixa_media':
      return 'Baixa / média';
    case 'media':
      return 'Média';
    case 'media_alta':
      return 'Média / alta';
    case 'muito_alta':
      return 'Muito alta';
  }
}

export function resolveTribunalSideLabel(side: TribunalCaseSide): string {
  return side === 'accuser' ? 'Acusador' : 'Acusado';
}
