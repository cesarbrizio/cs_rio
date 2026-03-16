import {
  type EventResultListResponse,
  type GameEventResultDestination,
  type GameEventResultSummary,
} from '@cs-rio/shared';

export interface EventResultCue extends GameEventResultSummary {
  key: string;
}

export function buildPendingEventResultCues(input: {
  results: EventResultListResponse;
  seenKeys: Set<string>;
}): EventResultCue[] {
  return input.results.results
    .map(buildEventResultCue)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort(
      (left, right) =>
        new Date(left.resolvedAt).getTime() - new Date(right.resolvedAt).getTime(),
    );
}

export function buildEventResultCue(result: GameEventResultSummary): EventResultCue {
  return {
    ...result,
    key: `event-result:${result.id}:${result.resolvedAt}`,
  };
}

export function resolveEventResultDestinationLabel(
  destination: GameEventResultDestination,
): string {
  switch (destination) {
    case 'territory':
      return 'Abrir território';
    case 'market':
      return 'Abrir mercado';
    case 'map':
      return 'Abrir mapa';
    case 'prison':
      return 'Abrir prisão';
  }
}

export function formatEventResultResolvedLabel(resolvedAt: string): string {
  const date = new Date(resolvedAt);

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
