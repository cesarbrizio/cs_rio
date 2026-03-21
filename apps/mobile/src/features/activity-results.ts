import {
  type UniversityCenterResponse,
  type UniversityCourseSummary,
} from '@cs-rio/shared';

import {
  formatUniversityCurrency,
  formatUniversityDurationHours,
  formatUniversityVocation,
} from './university';

const ASYNC_ACTIVITY_RESULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

export type AsyncActivityCue = UniversityCompletionCue;

export function buildPendingActivityCues(input: {
  nowMs?: number;
  seenKeys: ReadonlySet<string>;
  universityCenter: UniversityCenterResponse | null;
}): AsyncActivityCue[] {
  return buildPendingUniversityCompletionCues({
    center: input.universityCenter,
    nowMs: input.nowMs,
    seenKeys: input.seenKeys,
  });
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
