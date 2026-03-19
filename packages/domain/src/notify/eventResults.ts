import {
  type EventResultListResponse,
  type GameEventResultSummary,
} from '@cs-rio/shared';

export interface EventResultCue extends GameEventResultSummary {
  key: string;
}

export function buildPendingEventResultCues(input: {
  results: EventResultListResponse;
  seenKeys: ReadonlySet<string>;
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
