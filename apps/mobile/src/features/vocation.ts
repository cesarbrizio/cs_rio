import {
  type PlayerAttributes,
  type PlayerVocationAvailability,
  type PlayerVocationOptionSummary,
  type PlayerVocationStatus,
  type UniversityVocationProgressionSummary,
} from '@cs-rio/shared';

import { formatUniversityRemaining, formatUniversityVocation } from './university';

export function formatVocationAttributeLabel(attribute: keyof PlayerAttributes): string {
  if (attribute === 'forca') {
    return 'Força';
  }

  if (attribute === 'inteligencia') {
    return 'Inteligência';
  }

  if (attribute === 'resistencia') {
    return 'Resistência';
  }

  return 'Carisma';
}

export function formatVocationOptionAttributePair(
  option: PlayerVocationOptionSummary,
): string {
  return `${formatVocationAttributeLabel(option.primaryAttribute)} + ${formatVocationAttributeLabel(option.secondaryAttribute)}`;
}

export function formatVocationStateLabel(status: PlayerVocationStatus): string {
  if (status.state === 'transition') {
    return 'Transição';
  }

  if (status.state === 'cooldown') {
    return 'Cooldown';
  }

  return 'Pronta';
}

export function formatVocationProgressStageLabel(
  progression: UniversityVocationProgressionSummary,
): string {
  if (progression.stage === 'mastered') {
    return 'dominada';
  }

  if (progression.stage === 'developing') {
    return 'em evolução';
  }

  return 'em abertura';
}

export function formatVocationCreditsCost(cost: number): string {
  return `${cost.toLocaleString('pt-BR')} cr`;
}

export function buildVocationAvailabilityCopy(input: {
  availability: PlayerVocationAvailability;
  status: PlayerVocationStatus;
}): string {
  const { availability, status } = input;

  if (availability.available) {
    return `Troca liberada agora por ${formatVocationCreditsCost(availability.creditsCost)} em créditos premium.`;
  }

  if (status.state === 'transition' && status.pendingVocation) {
    return `Transição para ${formatUniversityVocation(status.pendingVocation)} em andamento. ${availability.reason ?? 'Aguarde a conclusão dessa mudança.'}`;
  }

  if (status.cooldownRemainingSeconds > 0) {
    return `${availability.reason ?? 'A troca está em cooldown.'} Falta ${formatUniversityRemaining(status.cooldownRemainingSeconds)}.`;
  }

  return availability.reason ?? 'A troca de vocação não está disponível agora.';
}

export function buildVocationImpactLines(input: {
  passiveLines: string[];
  progression: UniversityVocationProgressionSummary | null;
}): string[] {
  const { passiveLines, progression } = input;

  if (!progression) {
    return passiveLines.length > 0
      ? passiveLines.slice(0, 4)
      : ['Sua build ainda não desbloqueou perks permanentes.'];
  }

  const lines = [
    `Trilha ${formatVocationProgressStageLabel(progression)} · ${progression.completedPerks}/${progression.totalPerks} perks concluídos.`,
  ];

  if (progression.nextPerk) {
    lines.push(`Próxima vantagem: ${progression.nextPerk.label} — ${progression.nextPerk.effectSummary}`);
  } else {
    lines.push('Todas as vantagens exclusivas da sua vocação já foram liberadas.');
  }

  if (passiveLines.length === 0) {
    lines.push('Nenhum bônus permanente ativo ainda.');
  } else {
    lines.push(...passiveLines.slice(0, 3));
  }

  return lines;
}
