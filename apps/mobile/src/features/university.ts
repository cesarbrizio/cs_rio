import {
  type PlayerAttributes,
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  type UniversityCourseSummary,
  type UniversityPassiveProfile,
  VocationType,
} from '@cs-rio/shared';

export interface LiveUniversityCourseState {
  progressRatio: number;
  remainingSeconds: number;
}

export function formatUniversityCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatUniversityDurationHours(durationHours: number): string {
  if (durationHours % 24 === 0) {
    const days = durationHours / 24;
    return `${days}d`;
  }

  return `${durationHours}h`;
}

export function formatUniversityRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return 'Concluindo agora';
  }

  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${remainingSeconds}s`;
}

export function formatUniversityRequirements(
  requirements: Partial<PlayerAttributes>,
): string {
  const entries = [
    { label: 'Forca', value: requirements.forca ?? 0 },
    { label: 'Inteligencia', value: requirements.inteligencia ?? 0 },
    { label: 'Resistencia', value: requirements.resistencia ?? 0 },
    { label: 'Carisma', value: requirements.carisma ?? 0 },
  ].filter((entry) => entry.value > 0);

  if (entries.length === 0) {
    return 'Sem requisito adicional de atributo.';
  }

  return entries.map((entry) => `${entry.label} ${entry.value}`).join(' · ');
}

export function formatUniversityVocation(vocation: VocationType): string {
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

export function getLiveUniversityCourseState(
  course: UniversityCourseSummary,
  nowMs: number,
): LiveUniversityCourseState {
  if (!course.startedAt || !course.endsAt) {
    return {
      progressRatio: 0,
      remainingSeconds: 0,
    };
  }

  const startedAtMs = new Date(course.startedAt).getTime();
  const endsAtMs = new Date(course.endsAt).getTime();
  const totalDurationMs = Math.max(endsAtMs - startedAtMs, 1);
  const elapsedMs = Math.max(0, nowMs - startedAtMs);

  return {
    progressRatio: Math.max(0, Math.min(1, elapsedMs / totalDurationMs)),
    remainingSeconds: Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000)),
  };
}

export function resolveUniversityCourseStateLabel(course: UniversityCourseSummary): string {
  if (course.isCompleted) {
    return 'Concluído';
  }

  if (course.isInProgress) {
    return 'Em andamento';
  }

  if (course.lockReason) {
    return course.isLocked ? 'Travado' : 'Bloqueado';
  }

  return 'Disponível';
}

export function sortUniversityCourses(courses: UniversityCourseSummary[]): UniversityCourseSummary[] {
  return [...courses].sort((left, right) => {
    const levelDifference = left.unlockLevel - right.unlockLevel;

    if (levelDifference !== 0) {
      return levelDifference;
    }

    return left.label.localeCompare(right.label, 'pt-BR');
  });
}

export function summarizeUniversityPassives(profile: UniversityPassiveProfile): string[] {
  const lines: string[] = [];

  if (profile.crime.soloSuccessMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.crime.soloSuccessMultiplier) {
    lines.push(`Sucesso em crimes solo x${profile.crime.soloSuccessMultiplier.toFixed(2)}`);
  }

  if (profile.crime.arrestChanceMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.crime.arrestChanceMultiplier) {
    lines.push(`Chance de prisao x${profile.crime.arrestChanceMultiplier.toFixed(2)}`);
  }

  if (profile.crime.lowLevelSoloRewardMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.crime.lowLevelSoloRewardMultiplier) {
    lines.push(`Recompensa solo baixa x${profile.crime.lowLevelSoloRewardMultiplier.toFixed(2)}`);
  }

  if (profile.crime.revealsTargetValue) {
    lines.push('Valor real dos alvos revelado');
  }

  if (profile.factory.productionMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.factory.productionMultiplier) {
    lines.push(`Produção de fábrica x${profile.factory.productionMultiplier.toFixed(2)}`);
  }

  if (profile.factory.extraDrugSlots !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.factory.extraDrugSlots) {
    lines.push(`Slots extras de producao: +${profile.factory.extraDrugSlots}`);
  }

  if (profile.business.bocaDemandMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.business.bocaDemandMultiplier) {
    lines.push(`Demanda das bocas x${profile.business.bocaDemandMultiplier.toFixed(2)}`);
  }

  if (profile.business.passiveRevenueMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.business.passiveRevenueMultiplier) {
    lines.push(`Renda passiva x${profile.business.passiveRevenueMultiplier.toFixed(2)}`);
  }

  if (profile.business.gpRevenueMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.business.gpRevenueMultiplier) {
    lines.push(`Lucro de GPs x${profile.business.gpRevenueMultiplier.toFixed(2)}`);
  }

  if (
    profile.business.launderingReturnMultiplier !==
    UNIVERSITY_EMPTY_PASSIVE_PROFILE.business.launderingReturnMultiplier
  ) {
    lines.push(`Lavagem x${profile.business.launderingReturnMultiplier.toFixed(2)}`);
  }

  if (
    profile.business.propertyMaintenanceMultiplier !==
    UNIVERSITY_EMPTY_PASSIVE_PROFILE.business.propertyMaintenanceMultiplier
  ) {
    lines.push(`Manutenção de propriedades x${profile.business.propertyMaintenanceMultiplier.toFixed(2)}`);
  }

  if (profile.market.feeRate !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.market.feeRate) {
    lines.push(`Taxa do Mercado Negro ${(profile.market.feeRate * 100).toFixed(0)}%`);
  }

  if (profile.police.negotiationSuccessMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.police.negotiationSuccessMultiplier) {
    lines.push(`Negociação com PM x${profile.police.negotiationSuccessMultiplier.toFixed(2)}`);
  }

  if (profile.police.bribeCostMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.police.bribeCostMultiplier) {
    lines.push(`Custo de suborno x${profile.police.bribeCostMultiplier.toFixed(2)}`);
  }

  if (profile.social.communityInfluenceMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.social.communityInfluenceMultiplier) {
    lines.push(`Influência social x${profile.social.communityInfluenceMultiplier.toFixed(2)}`);
  }

  if (profile.faction.factionCharismaAura !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.faction.factionCharismaAura) {
    lines.push(`Aura de carisma faccional +${Math.round(profile.faction.factionCharismaAura * 100)}%`);
  }

  if (profile.pvp.damageDealtMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp.damageDealtMultiplier) {
    lines.push(`Dano PvP x${profile.pvp.damageDealtMultiplier.toFixed(2)}`);
  }

  if (profile.pvp.ambushPowerMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp.ambushPowerMultiplier) {
    lines.push(`Poder de emboscada x${profile.pvp.ambushPowerMultiplier.toFixed(2)}`);
  }

  if (profile.pvp.assaultPowerMultiplier !== UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp.assaultPowerMultiplier) {
    lines.push(`Poder de assalto x${profile.pvp.assaultPowerMultiplier.toFixed(2)}`);
  }

  if (
    profile.pvp.lowHpDamageTakenMultiplier !==
    UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp.lowHpDamageTakenMultiplier
  ) {
    lines.push(`Dano recebido em baixo HP x${profile.pvp.lowHpDamageTakenMultiplier.toFixed(2)}`);
  }

  return lines;
}
