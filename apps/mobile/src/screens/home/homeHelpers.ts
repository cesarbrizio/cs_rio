import {
  type DocksEventStatusResponse,
  type PoliceEventStatusResponse,
  type SeasonalEventStatusResponse,
  type TerritoryFavelaSummary,
  type TerritoryRegionSummary,
} from '@cs-rio/shared';

import { type MapEntityKind, resolveZoneAccentFromRelation } from '../../data/mapRegionVisuals';
import { resolveFavelaStateLabel } from '../../features/territory';
import { colors } from '../../theme/colors';
import { type ProjectedFavela, type RegionClimateSummary } from './homeTypes';

export function orderBookBadge(inventoryCount: number, money: number): number {
  if (money >= 10000) {
    return Math.max(1, Math.min(9, Math.ceil(inventoryCount / 5)));
  }

  return inventoryCount > 0 ? 1 : 0;
}

export function resolveFavelaRelation(
  favela: TerritoryFavelaSummary,
  playerFactionId: string | null | undefined,
): 'ally' | 'enemy' | 'neutral' {
  if (!favela.controllingFaction?.id || !playerFactionId) {
    return 'neutral';
  }

  return favela.controllingFaction.id === playerFactionId ? 'ally' : 'enemy';
}

export function buildFavelaOwnerLabel(favela: TerritoryFavelaSummary): string {
  if (favela.state === 'at_war') {
    const attacker = favela.war?.attackerFaction.abbreviation ?? favela.contestingFaction?.abbreviation ?? '--';
    const defender = favela.war?.defenderFaction.abbreviation ?? favela.controllingFaction?.abbreviation ?? '--';

    return `GUERRA · ${attacker} × ${defender}`;
  }

  if (favela.state === 'controlled' && favela.controllingFaction) {
    return `CONTROLADA · ${favela.controllingFaction.abbreviation}`;
  }

  return resolveFavelaStateLabel(favela.state).toUpperCase();
}

export function resolveLiveZoneAccent(input: {
  favela: TerritoryFavelaSummary;
  policeEventType: DocksEventStatusResponse['phase'] | PoliceEventStatusResponse['events'][number]['eventType'] | null;
  relation: 'ally' | 'enemy' | 'neutral';
}): string {
  if (input.favela.state === 'at_war') {
    return colors.danger;
  }

  if (input.policeEventType === 'faca_na_caveira') {
    return colors.danger;
  }

  if (input.policeEventType === 'operacao_policial' || input.policeEventType === 'blitz_pm') {
    return colors.warning;
  }

  if (input.favela.x9?.status === 'warning' || input.favela.x9?.status === 'pending_desenrolo') {
    return colors.warning;
  }

  return resolveZoneAccentFromRelation(input.relation);
}

export function summarizeRegionClimate(input: {
  activeDocksEvent: DocksEventStatusResponse | null;
  policeEvents: PoliceEventStatusResponse['events'];
  regionSummary: TerritoryRegionSummary | null;
  seasonalEvents: SeasonalEventStatusResponse['events'];
}): RegionClimateSummary {
  if (input.policeEvents.some((event) => event.eventType === 'faca_na_caveira')) {
    return {
      accent: colors.danger,
      detail: 'BOPE entrou pesado. A rua está sob choque e o mapa exige cautela máxima.',
      label: 'Rua em choque',
      pressureLabel: 'Pressão máxima na região',
    };
  }

  if (
    input.policeEvents.length > 0 ||
    (input.regionSummary?.atWarFavelas ?? 0) > 0 ||
    input.seasonalEvents.some((event) => event.eventType === 'operacao_verao')
  ) {
    return {
      accent: colors.warning,
      detail: 'Polícia, guerra ou operação ativa estão aquecendo a região.',
      label: 'Rua quente',
      pressureLabel: 'Pressão alta na região',
    };
  }

  if (input.activeDocksEvent || input.seasonalEvents.length > 0) {
    return {
      accent: colors.accent,
      detail: 'Eventos ativos estão mudando o ritmo da região e abrindo oportunidade.',
      label: 'Rua viva',
      pressureLabel: 'Clima vivo na região',
    };
  }

  return {
    accent: colors.success,
    detail: 'A região está relativamente estável. Dá para rodar o corre com menos ruído.',
    label: 'Rua firme',
    pressureLabel: 'Pressão baixa na região',
  };
}

export function buildLiveEntity(input: {
  activeDocksEvent: DocksEventStatusResponse | null;
  entity: {
    color?: string;
    id: string;
    kind: MapEntityKind;
    label?: string;
    position: {
      x: number;
      y: number;
    };
  };
  playerFactionId: string | null;
  projectedFavelas: ProjectedFavela[];
  regionalSeasonalEvents: SeasonalEventStatusResponse['events'];
}): {
  color?: string;
  id: string;
  kind: MapEntityKind;
  label?: string;
  position: {
    x: number;
    y: number;
  };
} {
  const nearestFavela = findProjectedFavelaForPoint(input.projectedFavelas, input.entity.position);
  const nearestRelation = nearestFavela
    ? resolveFavelaRelation(nearestFavela.favela, input.playerFactionId)
    : 'neutral';
  const nearestAccent = nearestFavela
    ? resolveLiveZoneAccent({
        favela: nearestFavela.favela,
        policeEventType: null,
        relation: nearestRelation,
      })
    : input.entity.color ?? colors.accent;

  if (input.entity.kind === 'docks') {
    return {
      ...input.entity,
      color: input.activeDocksEvent ? colors.info : input.entity.color,
      label: input.activeDocksEvent ? 'Docas · Navio ativo' : 'Docas',
    };
  }

  if (input.entity.kind === 'party') {
    const activeSeasonalParty = input.regionalSeasonalEvents.find(
      (event) => event.eventType === 'carnaval' || event.eventType === 'ano_novo_copa',
    );

    if (activeSeasonalParty) {
      return {
        ...input.entity,
        color: colors.accent,
        label: 'Baile · Lado cheio',
      };
    }
  }

  if (input.entity.kind === 'boca') {
    return {
      ...input.entity,
      color: nearestAccent,
      label: nearestFavela ? `Boca · ${buildPoiStateLabel(nearestFavela.favela)}` : 'Boca',
    };
  }

  if (input.entity.kind === 'factory') {
    return {
      ...input.entity,
      color: nearestAccent,
      label: nearestFavela ? `Fábrica · ${buildPoiStateLabel(nearestFavela.favela)}` : 'Fábrica',
    };
  }

  if (input.entity.kind === 'scrapyard') {
    return {
      ...input.entity,
      label: 'Desmanche · discreto',
    };
  }

  if (input.entity.kind === 'market') {
    return {
      ...input.entity,
      label: 'Mercado Negro · aberto',
    };
  }

  if (input.entity.kind === 'hospital') {
    return {
      ...input.entity,
      label: 'Hospital · suporte',
    };
  }

  if (input.entity.kind === 'university') {
    return {
      ...input.entity,
      label: 'Universidade · aberta',
    };
  }

  return input.entity;
}

export function buildPoiStateLabel(favela: TerritoryFavelaSummary): string {
  if (favela.state === 'at_war') {
    return 'em disputa';
  }

  if (favela.controllingFaction) {
    return favela.controllingFaction.abbreviation;
  }

  return 'neutra';
}

export function findProjectedFavelaForPoint(
  projectedFavelas: ProjectedFavela[],
  point: {
    x: number;
    y: number;
  },
): ProjectedFavela | null {
  let bestMatch: ProjectedFavela | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const projectedFavela of projectedFavelas) {
    const distance =
      Math.abs(projectedFavela.center.x - point.x) +
      Math.abs(projectedFavela.center.y - point.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = projectedFavela;
    }
  }

  return bestMatch;
}

export function shortenPulseValue(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 15)}...`;
}

export function describeFavelaContext(
  favela: TerritoryFavelaSummary,
  playerFactionId: string | null,
): string {
  const relation =
    favela.controllingFaction?.id && playerFactionId
      ? favela.controllingFaction.id === playerFactionId
        ? 'Sua facção controla essa área.'
        : `Área sob ${favela.controllingFaction.abbreviation}.`
      : 'Favela ainda sem facção dominante.';
  const war =
    favela.state === 'at_war'
      ? 'Guerra declarada. O confronto já está quente aqui.'
      : null;
  const x9 =
    favela.x9?.status === 'warning' || favela.x9?.status === 'pending_desenrolo'
      ? 'X9 ativo nessa favela.'
      : null;

  return [
    relation,
    `Dificuldade ${favela.difficulty} · Pop. ${favela.population.toLocaleString('pt-BR')}.`,
    `Soldados ${favela.soldiers.active}/${favela.soldiers.max} · Bandidos ${favela.bandits.active}.`,
    `Satisfação ${favela.satisfaction} · ${favela.satisfactionProfile.tier}.`,
    war,
    x9,
  ]
    .filter(Boolean)
    .join(' ');
}
