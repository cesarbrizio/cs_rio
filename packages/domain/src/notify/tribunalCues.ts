import {
  type TribunalCueListResponse,
  type TribunalCueSummary,
} from '@cs-rio/shared';

export interface TribunalCue extends TribunalCueSummary {
  key: string;
}

export function buildPendingTribunalCues(input: {
  feed: TribunalCueListResponse;
  seenKeys: ReadonlySet<string>;
}): TribunalCue[] {
  return input.feed.cues
    .map(buildTribunalCue)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );
}

export function buildTribunalCue(cue: TribunalCueSummary): TribunalCue {
  return {
    ...cue,
    key: `tribunal:${cue.kind}:${cue.case.id}:${cue.occurredAt}`,
  };
}
