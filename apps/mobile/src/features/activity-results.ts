import {
  type TrainingCenterResponse,
  type TrainingSessionSummary,
  type UniversityCenterResponse,
  type UniversityCourseSummary,
} from '@cs-rio/shared';

import {
  formatTrainingCurrency,
  formatTrainingGains,
  formatTrainingTypeLabel,
} from './training';
import {
  formatUniversityCurrency,
  formatUniversityDurationHours,
  formatUniversityVocation,
} from './university';

const ASYNC_ACTIVITY_RESULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface TrainingCompletionCue {
  body: string;
  costLabel: string;
  endedAt: string;
  gainsLabel: string;
  key: string;
  kind: 'training';
  multiplierLabel: string;
  cansacoLabel: string;
  streakLabel: string;
  title: string;
  trainingLabel: string;
}

export interface UniversityCompletionCue {
  body: string;
  completedAt: string;
  costLabel: string;
  courseLabel: string;
  durationLabel: string;
  key: string;
  kind: 'university';
  passiveLabel: string;
  title: string;
  vocationLabel: string;
}

export type AsyncActivityCue = TrainingCompletionCue | UniversityCompletionCue;

export function buildPendingActivityCues(input: {
  nowMs?: number;
  seenKeys: ReadonlySet<string>;
  trainingCenter: TrainingCenterResponse | null;
  universityCenter: UniversityCenterResponse | null;
}): AsyncActivityCue[] {
  const trainingCue = buildPendingTrainingCompletionCue({
    center: input.trainingCenter,
    nowMs: input.nowMs,
    seenKeys: input.seenKeys,
  });
  const universityCues = buildPendingUniversityCompletionCues({
    center: input.universityCenter,
    nowMs: input.nowMs,
    seenKeys: input.seenKeys,
  });

  return [...(trainingCue ? [trainingCue] : []), ...universityCues].sort((left, right) => {
    const leftMs = resolveCueTimestamp(left);
    const rightMs = resolveCueTimestamp(right);
    return rightMs - leftMs;
  });
}

export function buildPendingTrainingCompletionCue(input: {
  center: TrainingCenterResponse | null;
  nowMs?: number;
  seenKeys: ReadonlySet<string>;
}): TrainingCompletionCue | null {
  const session = input.center?.activeSession;

  if (!session || !session.readyToClaim) {
    return null;
  }

  const endedAtMs = new Date(session.endsAt).getTime();
  const nowMs = input.nowMs ?? Date.now();

  if (!Number.isFinite(endedAtMs) || nowMs - endedAtMs > ASYNC_ACTIVITY_RESULT_WINDOW_MS) {
    return null;
  }

  const key = buildTrainingCompletionKey(session);

  if (input.seenKeys.has(key)) {
    return null;
  }

  const trainingLabel = formatTrainingTypeLabel(session.type);
  const gainsLabel = formatTrainingGains(session.projectedGains);

  return {
    body: `${trainingLabel} terminou. O custo já foi consumido e os ganhos abaixo estão prontos para resgate no Centro de Treino.`,
    costLabel: formatTrainingCurrency(session.costMoney),
    endedAt: session.endsAt,
    gainsLabel,
    key,
    kind: 'training',
    multiplierLabel: `${session.diminishingMultiplier.toFixed(2)}x`,
    cansacoLabel: `${session.costCansaco}`,
    streakLabel: `${session.streakIndex + 1}`,
    title: `${trainingLabel} pronto para resgatar`,
    trainingLabel,
  };
}

export function buildPendingUniversityCompletionCues(input: {
  center: UniversityCenterResponse | null;
  nowMs?: number;
  seenKeys: ReadonlySet<string>;
}): UniversityCompletionCue[] {
  const nowMs = input.nowMs ?? Date.now();

  return (input.center?.courses ?? [])
    .filter((course) => course.isCompleted && Boolean(course.completedAt))
    .filter((course) => {
      const completedAtMs = course.completedAt ? new Date(course.completedAt).getTime() : 0;
      return Number.isFinite(completedAtMs) && nowMs - completedAtMs <= ASYNC_ACTIVITY_RESULT_WINDOW_MS;
    })
    .map((course) => buildUniversityCompletionCue(course))
    .filter((cue): cue is UniversityCompletionCue => cue !== null)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
}

export function buildTrainingCompletionKey(session: TrainingSessionSummary): string {
  return ['training', session.id, session.endsAt].join(':');
}

export function buildUniversityCompletionKey(course: UniversityCourseSummary): string {
  return ['university', course.code, course.completedAt ?? course.endsAt ?? 'unknown'].join(':');
}

function buildUniversityCompletionCue(course: UniversityCourseSummary): UniversityCompletionCue | null {
  if (!course.completedAt) {
    return null;
  }

  return {
    body: `${course.label} terminou e o passivo já foi aplicado ao personagem.`,
    completedAt: course.completedAt,
    costLabel: formatUniversityCurrency(course.moneyCost),
    courseLabel: course.label,
    durationLabel: formatUniversityDurationHours(course.durationHours),
    key: buildUniversityCompletionKey(course),
    kind: 'university',
    passiveLabel: course.effectSummary,
    title: `${course.label} concluído`,
    vocationLabel: formatUniversityVocation(course.vocation),
  };
}

function resolveCueTimestamp(cue: AsyncActivityCue): number {
  return cue.kind === 'training'
    ? new Date(cue.endedAt).getTime()
    : new Date(cue.completedAt).getTime();
}
