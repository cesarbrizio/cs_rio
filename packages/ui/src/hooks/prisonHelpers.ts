import {
  type PlayerPrisonStatus,
  type PrisonActionAvailability,
  type PrisonCenterResponse,
} from '@cs-rio/shared';

export function formatPrisonRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return 'Soltura imediata';
  }

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatPrisonHeatTier(tier: PlayerPrisonStatus['heatTier']): string {
  switch (tier) {
    case 'frio':
      return 'Frio';
    case 'observado':
      return 'Observado';
    case 'marcado':
      return 'Marcado';
    case 'quente':
      return 'Quente';
    case 'cacado':
      return 'Cacado';
    default:
      return tier;
  }
}

export function buildPrisonActionCopy(
  actionId: 'bail' | 'bribe' | 'escape' | 'factionRescue',
  availability: PrisonActionAvailability,
): string {
  if (availability.reason) {
    return availability.reason;
  }

  if (!availability.available) {
    return 'Indisponivel agora.';
  }

  if (actionId === 'bail') {
    return `Sai na hora por ${availability.creditsCost ?? 0} creditos.`;
  }

  if (actionId === 'bribe') {
    return `Tenta comprar a soltura por R$ ${Math.round(availability.moneyCost ?? 0)}.`;
  }

  if (actionId === 'escape') {
    return `Uma tentativa nesta pena. Chance atual: ${availability.successChancePercent ?? 0}%.`;
  }

  return 'Outro membro autorizado pode tirar voce usando o caixa da faccao.';
}

export function getLivePrisonStatus(
  prison: PlayerPrisonStatus,
  nowMs: number,
): PlayerPrisonStatus {
  if (!prison.isImprisoned || !prison.endsAt) {
    return prison;
  }

  const endsAtMs = new Date(prison.endsAt).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));

  return {
    ...prison,
    isImprisoned: remainingSeconds > 0,
    remainingSeconds,
  };
}

export function hasImmediatePrisonEscapeOptions(center: PrisonCenterResponse | null): boolean {
  if (!center) {
    return false;
  }

  return (
    center.actions.bail.available ||
    center.actions.bribe.available ||
    center.actions.escape.available
  );
}
