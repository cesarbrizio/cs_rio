import {
  type AssassinationContractNotificationType,
  type AssassinationContractStatus,
  type PvpContractExecutionResponse,
} from '@cs-rio/shared';

import { formatCombatCurrency, resolveCombatTierLabel } from './combatHelpers';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
});

export interface ContractTargetOption {
  id: string;
  nickname: string;
  subtitle: string;
  title: string;
}

export function buildContractTargets(input: {
  currentPlayerId: string | null | undefined;
  realtimePlayers: Array<{
    nickname: string;
    playerId: string;
    title: string;
    vocation: string;
  }>;
}): ContractTargetOption[] {
  return input.realtimePlayers
    .filter((player) => player.playerId !== input.currentPlayerId)
    .map((player) => ({
      id: player.playerId,
      nickname: player.nickname,
      subtitle: `${player.title} · ${player.vocation}`,
      title: player.title,
    }))
    .sort((left, right) => left.nickname.localeCompare(right.nickname, 'pt-BR'));
}

export function formatContractTimestamp(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatContractCountdown(expiresAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - nowMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);

  if (totalSeconds <= 0) {
    return 'Expirando';
  }

  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }

  if (totalSeconds >= 60) {
    return `${Math.ceil(totalSeconds / 60)} min`;
  }

  return `${totalSeconds}s`;
}

export function resolveContractStatusLabel(status: AssassinationContractStatus): string {
  switch (status) {
    case 'accepted':
      return 'Aceito';
    case 'cancelled':
      return 'Cancelado';
    case 'completed':
      return 'Executado';
    case 'expired':
      return 'Expirado';
    case 'failed':
      return 'Falhou';
    case 'open':
      return 'Aberto';
    default:
      return status;
  }
}

export function resolveContractNotificationLabel(type: AssassinationContractNotificationType): string {
  switch (type) {
    case 'accepted':
      return 'Contrato aceito';
    case 'completed':
      return 'Contrato concluido';
    case 'expired':
      return 'Contrato expirado';
    case 'target_warned':
      return 'Alvo avisado';
    default:
      return type;
  }
}

export function buildContractExecutionHighlights(result: PvpContractExecutionResponse): string[] {
  const lines = [
    result.message,
    `Tier: ${resolveCombatTierLabel(result.tier)}.`,
  ];

  if (result.loot?.amount) {
    lines.push(`Espolio puxado: ${formatCombatCurrency(result.loot.amount)}.`);
  }

  if (result.defender.hospitalization.recommended) {
    lines.push(
      `Alvo cai no hospital por ${result.defender.hospitalization.durationMinutes} min.`,
    );
  }

  if (result.fatality.eligible) {
    lines.push(`Chance de letalidade: ${Math.round(result.fatality.chance * 100)}%.`);
  }

  lines.push(result.targetNotified ? 'O alvo ficou avisado apos a tentativa.' : 'O alvo nao foi alertado antes do fim.');

  return lines;
}
