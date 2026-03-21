import {
  type UniversityCenterResponse,
  type UniversityCourseSummary,
  VocationType,
} from '@cs-rio/shared';

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
    body: `${course.label} terminou e o passivo ja foi aplicado ao personagem.`,
    completedAt: course.completedAt,
    costLabel: formatUniversityCurrency(course.moneyCost),
    courseLabel: course.label,
    durationLabel: formatUniversityDurationHours(course.durationHours),
    key: buildUniversityCompletionKey(course),
    kind: 'university',
    passiveLabel: course.effectSummary,
    title: `${course.label} concluido`,
    vocationLabel: formatUniversityVocation(course.vocation),
  };
}

function formatUniversityCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatUniversityDurationHours(durationHours: number): string {
  if (durationHours % 24 === 0) {
    const days = durationHours / 24;
    return `${days}d`;
  }

  return `${durationHours}h`;
}

function formatUniversityVocation(vocation: VocationType): string {
  if (vocation === VocationType.Cria) {
    return 'Cria';
  }

  if (vocation === VocationType.Gerente) {
    return 'Gerente';
  }

  if (vocation === VocationType.Soldado) {
    return 'Soldado';
  }

  if (vocation === VocationType.Politico) {
    return 'Politico';
  }

  return 'Empreendedor';
}
