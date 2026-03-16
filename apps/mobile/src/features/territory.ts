import {
  REGIONS,
  type FavelaBaileStatus,
  type FavelaControlState,
  type FavelaPropinaStatus,
  type FavelaSatisfactionTier,
  type FavelaServiceSummary,
  type FavelaX9Status,
  type FactionWarRoundOutcome,
  type FactionWarSide,
  type FactionWarStatus,
  type FactionWarSummary,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
  type TerritoryRegionSummary,
} from '@cs-rio/shared';

export interface TerritoryHeadlineStats {
  atWarFavelas: number;
  playerControlledFavelas: number;
  totalFavelas: number;
  x9ActiveFavelas: number;
}

export interface TerritoryRegionGroup {
  favelas: TerritoryFavelaSummary[];
  region: TerritoryRegionSummary;
}

export function buildFavelaForceSummaryLines(favela: TerritoryFavelaSummary): string[] {
  const banditTail = [
    favela.bandits.arrested > 0 ? `${favela.bandits.arrested} presos` : null,
    favela.bandits.deadRecent > 0 ? `${favela.bandits.deadRecent} baixas recentes` : null,
    favela.bandits.nextReturnAt ? `retorno ${formatTerritoryTimestamp(favela.bandits.nextReturnAt)}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return [
    `Soldados ${favela.soldiers.active}/${favela.soldiers.max} · ocupação ${Math.round(favela.soldiers.occupancyPercent)}%`,
    [
      `Bandidos ${favela.bandits.active}/${favela.bandits.targetActive}`,
      ...banditTail,
    ].join(' · '),
  ];
}

export function buildFavelaAlertLines(favela: TerritoryFavelaSummary): string[] {
  const lines: string[] = [];

  if (favela.satisfactionProfile.tier === 'collapsed') {
    lines.push('Moradores entraram em colapso e a favela está perto de quebrar.');
  } else if (favela.satisfactionProfile.tier === 'critical') {
    lines.push('Satisfação crítica: a chance de X9 e de perda de receita está alta.');
  }

  if (favela.x9?.status === 'warning') {
    lines.push('Tem X9 soprando e a incursão pode cair a qualquer momento.');
  } else if (favela.x9?.status === 'pending_desenrolo') {
    lines.push('Membros presos aguardam desenrolo ou vão cumprir a janela completa.');
  }

  if (favela.propina?.status === 'severe') {
    lines.push('Arrego atrasado está cortando a receita territorial.');
  } else if (favela.propina?.status === 'state_takeover') {
    lines.push('O Estado já tomou a favela por inadimplência prolongada.');
  }

  if (favela.war?.status === 'preparing' || favela.war?.status === 'active') {
    lines.push('A favela está no ciclo quente de guerra e exige resposta rápida.');
  }

  return lines;
}

export function buildTerritoryHeadlineStats(
  overview: TerritoryOverviewResponse | null,
): TerritoryHeadlineStats {
  const favelas = overview?.favelas ?? [];
  const playerFactionId = overview?.playerFactionId ?? null;

  return {
    atWarFavelas: favelas.filter((favela) => favela.state === 'at_war').length,
    playerControlledFavelas: favelas.filter(
      (favela) => favela.controllingFaction?.id === playerFactionId,
    ).length,
    totalFavelas: favelas.length,
    x9ActiveFavelas: favelas.filter(
      (favela) =>
        favela.x9 !== null &&
        favela.x9.status !== 'resolved',
    ).length,
  };
}

export function formatTerritoryCountdown(
  value: string | null,
  nowMs: number,
): string | null {
  if (!value) {
    return null;
  }

  const remainingMs = new Date(value).getTime() - nowMs;

  if (remainingMs <= 0) {
    return 'agora';
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatTerritoryCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatTerritoryTimestamp(value: string | null): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function groupFavelasByRegion(
  overview: TerritoryOverviewResponse,
): TerritoryRegionGroup[] {
  return overview.regions.map((region) => ({
    favelas: overview.favelas.filter((favela) => favela.regionId === region.regionId),
    region,
  }));
}

export function resolveBaileStatusLabel(status: FavelaBaileStatus): string {
  switch (status) {
    case 'ready':
      return 'Pronto';
    case 'active':
      return 'Ativo';
    case 'hangover':
      return 'Ressaca';
    case 'cooldown':
      return 'Cooldown';
  }
}

export function resolveFavelaStateLabel(state: FavelaControlState): string {
  switch (state) {
    case 'neutral':
      return 'Neutra';
    case 'controlled':
      return 'Controlada';
    case 'at_war':
      return 'Em guerra';
    case 'state':
      return 'Estado';
  }
}

export function resolvePropinaStatusLabel(status: FavelaPropinaStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Em dia';
    case 'warning':
      return 'Cobrança';
    case 'severe':
      return 'Inadimplente';
    case 'state_takeover':
      return 'Tomada';
  }
}

export function resolveRegionLabel(regionId: string): string {
  return REGIONS.find((region) => region.id === regionId)?.label ?? regionId;
}

export function resolveRoundOutcomeLabel(outcome: FactionWarRoundOutcome): string {
  switch (outcome) {
    case 'attacker':
      return 'Atacante';
    case 'defender':
      return 'Defensor';
    case 'draw':
      return 'Empate';
  }
}

export function resolveSatisfactionTierLabel(tier: FavelaSatisfactionTier): string {
  switch (tier) {
    case 'happy':
      return 'Feliz';
    case 'stable':
      return 'Estável';
    case 'restless':
      return 'Inquieta';
    case 'critical':
      return 'Crítica';
    case 'collapsed':
      return 'Colapsada';
  }
}

export function resolveServiceStatusLabel(service: FavelaServiceSummary): string {
  if (!service.installed) {
    return 'Não instalado';
  }

  if (service.active) {
    return `Nível ${service.level}`;
  }

  return 'Instalado';
}

export function resolveWarSideForPlayer(
  playerFactionId: string | null,
  war: FactionWarSummary | null,
): FactionWarSide | null {
  if (!war || !playerFactionId) {
    return null;
  }

  if (war.attackerFaction.id === playerFactionId) {
    return 'attacker';
  }

  if (war.defenderFaction.id === playerFactionId) {
    return 'defender';
  }

  return null;
}

export function resolveWarSideLabel(side: FactionWarSide): string {
  return side === 'attacker' ? 'Atacante' : 'Defensor';
}

export function resolveWarStatusLabel(status: FactionWarStatus): string {
  switch (status) {
    case 'declared':
      return 'Declarada';
    case 'preparing':
      return 'Preparação';
    case 'active':
      return 'Combate';
    case 'attacker_won':
      return 'Atacante venceu';
    case 'defender_won':
      return 'Defensor segurou';
    case 'draw':
      return 'Empate';
    case 'cancelled':
      return 'Cancelada';
  }
}

export function resolveX9StatusLabel(status: FavelaX9Status): string {
  switch (status) {
    case 'warning':
      return 'Aviso';
    case 'pending_desenrolo':
      return 'Desenrolo';
    case 'jailed':
      return 'Presos';
    case 'resolved':
      return 'Resolvido';
  }
}
