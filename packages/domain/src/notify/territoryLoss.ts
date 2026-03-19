import {
  type TerritoryLossCueSummary,
  type TerritoryLossFeedResponse,
} from '@cs-rio/shared';

import { type WarResultCue } from './warResults';

export interface TerritoryLossCue extends TerritoryLossCueSummary {
  causeLabel: string;
  controllerLabel: string;
  occurredAtLabel: string;
  outcomeTone: 'danger' | 'warning';
}

export interface PendingTerritoryLossCue {
  cue: TerritoryLossCue;
  dedupedByWar: boolean;
}

export function buildPendingTerritoryLossCues(input: {
  feed: TerritoryLossFeedResponse;
  seenKeys: ReadonlySet<string>;
  warCues?: ReadonlyArray<Pick<WarResultCue, 'favelaId'>>;
}): PendingTerritoryLossCue[] {
  const warFavelaIds = new Set((input.warCues ?? []).map((cue) => cue.favelaId));

  return input.feed.cues
    .map(buildTerritoryLossCue)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    )
    .map((cue) => ({
      cue,
      dedupedByWar: cue.cause === 'war_defeat' && warFavelaIds.has(cue.favelaId),
    }));
}

export function buildTerritoryLossCue(
  cue: TerritoryLossCueSummary,
): TerritoryLossCue {
  return {
    ...cue,
    causeLabel: resolveTerritoryLossCauseLabel(cue.cause),
    controllerLabel: cue.newControllerFactionAbbreviation ?? 'Sem faccao',
    occurredAtLabel: formatTerritoryLossOccurredLabel(cue.occurredAt),
    outcomeTone: cue.cause === 'control_removed' ? 'warning' : 'danger',
  };
}

function resolveTerritoryLossCauseLabel(
  cause: TerritoryLossCueSummary['cause'],
): string {
  switch (cause) {
    case 'war_defeat':
      return 'Derrota em guerra';
    case 'state_takeover':
      return 'Tomada estatal';
    case 'control_removed':
    default:
      return 'Perda de controle';
  }
}

function formatTerritoryLossOccurredLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}
