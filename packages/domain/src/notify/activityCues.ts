import {
  type PlayerAttributes,
  type TrainingCenterResponse,
  type TrainingSessionSummary,
  type UniversityCenterResponse,
  type UniversityCourseSummary,
  VocationType,
} from '@cs-rio/shared';

const ASYNC_ACTIVITY_RESULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface TrainingCompletionCue {
  body: string;
  cansacoLabel: string;
  costLabel: string;
  endedAt: string;
  gainsLabel: string;
  key: string;
  kind: 'training';
  multiplierLabel: string;
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
    body: `${trainingLabel} terminou. O custo ja foi consumido e os ganhos abaixo estao prontos para resgate no Centro de Treino.`,
    cansacoLabel: `${session.costCansaco}`,
    costLabel: formatTrainingCurrency(session.costMoney),
    endedAt: session.endsAt,
    gainsLabel,
    key,
    kind: 'training',
    multiplierLabel: `${session.diminishingMultiplier.toFixed(2)}x`,
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

function resolveCueTimestamp(cue: AsyncActivityCue): number {
  return cue.kind === 'training'
    ? new Date(cue.endedAt).getTime()
    : new Date(cue.completedAt).getTime();
}

function formatTrainingCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatTrainingTypeLabel(type: TrainingSessionSummary['type']): string {
  if (type === 'basic') {
    return 'Basico';
  }

  if (type === 'advanced') {
    return 'Avancado';
  }

  return 'Intensivo';
}

function formatTrainingGains(gains: PlayerAttributes): string {
  const entries = [
    { label: 'Forca', value: gains.forca },
    { label: 'Inteligencia', value: gains.inteligencia },
    { label: 'Resistencia', value: gains.resistencia },
    { label: 'Carisma', value: gains.carisma },
  ].filter((entry) => entry.value > 0);

  if (entries.length === 0) {
    return 'Sem ganho aplicado.';
  }

  return entries.map((entry) => `+${entry.value} ${entry.label}`).join(' · ');
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
