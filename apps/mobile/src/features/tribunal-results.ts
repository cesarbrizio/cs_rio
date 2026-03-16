import {
  type TribunalCueListResponse,
  type TribunalCueSummary,
} from '@cs-rio/shared';

export interface TribunalCue extends TribunalCueSummary {
  key: string;
}

export function buildPendingTribunalCues(input: {
  feed: TribunalCueListResponse;
  seenKeys: Set<string>;
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

export function formatTribunalCueTimestamp(value: string): string {
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

export function resolveTribunalCueTargetLabel(): string {
  return 'Abrir tribunal';
}

export function resolveTribunalCueEyebrow(cue: TribunalCue): string {
  if (cue.kind === 'opened') {
    return 'Tribunal aberto';
  }

  return cue.outcome?.resolutionSource === 'npc'
    ? 'Prazo perdido'
    : 'Resultado do tribunal';
}
