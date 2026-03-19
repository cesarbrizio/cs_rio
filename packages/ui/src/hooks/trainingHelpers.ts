import {
  type PlayerAttributes,
  type TrainingCatalogItem,
  type TrainingSessionSummary,
  type TrainingType,
} from '@cs-rio/shared';

const TRAINING_TYPE_ORDER: Record<TrainingType, number> = {
  basic: 0,
  advanced: 1,
  intensive: 2,
};

export interface LiveTrainingSessionState {
  progressRatio: number;
  readyToClaim: boolean;
  remainingSeconds: number;
}

export function formatTrainingCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatTrainingDuration(durationMinutes: number): string {
  if (durationMinutes >= 60 && durationMinutes % 60 === 0) {
    return `${durationMinutes / 60}h`;
  }

  if (durationMinutes > 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  return `${durationMinutes} min`;
}

export function formatTrainingRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return 'Pronto para resgatar';
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatTrainingTypeLabel(type: TrainingType): string {
  if (type === 'basic') {
    return 'Basico';
  }

  if (type === 'advanced') {
    return 'Avancado';
  }

  return 'Intensivo';
}

export function formatTrainingGains(gains: PlayerAttributes): string {
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

export function getLiveTrainingSessionState(
  session: TrainingSessionSummary,
  nowMs: number,
): LiveTrainingSessionState {
  const startedAtMs = new Date(session.startedAt).getTime();
  const endsAtMs = new Date(session.endsAt).getTime();
  const totalDurationMs = Math.max(endsAtMs - startedAtMs, 1);
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));

  return {
    progressRatio: Math.max(0, Math.min(1, elapsedMs / totalDurationMs)),
    readyToClaim: remainingSeconds === 0,
    remainingSeconds,
  };
}

export function sortTrainingCatalog(items: TrainingCatalogItem[]): TrainingCatalogItem[] {
  return [...items].sort((left, right) => {
    const orderDifference = TRAINING_TYPE_ORDER[left.type] - TRAINING_TYPE_ORDER[right.type];

    if (orderDifference !== 0) {
      return orderDifference;
    }

    return left.label.localeCompare(right.label, 'pt-BR');
  });
}
