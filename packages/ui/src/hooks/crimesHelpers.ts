import { LEVELS, type CrimeAttemptResponse, type CrimeCatalogItem } from '@cs-rio/shared';

export interface CrimeLevelGroup {
  crimes: CrimeCatalogItem[];
  label: string;
  level: number;
}

export function formatCrimeChance(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function formatCrimeCooldown(seconds: number): string {
  if (seconds <= 0) {
    return 'Disponivel';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

export function formatCrimeCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatCrimeRewardReadLabel(read: CrimeCatalogItem['rewardRead']): string {
  return read === 'exact' ? 'valor real' : 'faixa estimada';
}

export function groupCrimesByLevel(crimes: CrimeCatalogItem[]): CrimeLevelGroup[] {
  const groups = new Map<number, CrimeCatalogItem[]>();

  for (const crime of crimes) {
    const currentGroup = groups.get(crime.levelRequired) ?? [];
    currentGroup.push(crime);
    groups.set(crime.levelRequired, currentGroup);
  }

  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([level, entries]) => ({
      crimes: [...entries].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
      label: resolveCrimeLevelLabel(level),
      level,
    }));
}

export function resolveCrimeResultHeadline(result: CrimeAttemptResponse): string {
  if (result.arrested) {
    return 'Preso';
  }

  return result.success ? 'Crime concluido' : 'Crime falhou';
}

export function resolveCrimeResultTone(
  result: CrimeAttemptResponse,
): 'danger' | 'success' | 'warning' {
  if (result.arrested) {
    return 'danger';
  }

  return result.success ? 'success' : 'warning';
}

function resolveCrimeLevelLabel(level: number): string {
  const matchedLevel = LEVELS.find((entry) => entry.level === level);
  return matchedLevel ? `Nivel ${level} · ${matchedLevel.title}` : `Nivel ${level}`;
}
