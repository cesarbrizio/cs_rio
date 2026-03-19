import {
  PROPERTY_DEFINITIONS,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS,
  type PropertySabotageCenterResponse,
  type PropertySabotageLogSummary,
  type PropertySabotageOutcome,
  type PropertyType,
} from '@cs-rio/shared';

const SABOTAGE_MODAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const FALLBACK_FACTORY_BASE_PRICE = 50_000;

export interface SabotageCue {
  body: string;
  createdAt: string;
  createdAtLabel: string;
  eyebrow: string;
  key: string;
  outcome: PropertySabotageOutcome;
  outcomeTone: 'danger' | 'info' | 'success' | 'warning';
  perspective: 'attack' | 'defense';
  propertyId: string;
  propertyTypeLabel: string;
  recoveryHint: string | null;
  resultLabel: string;
  targetLabel: string;
  title: string;
}

export function buildPendingSabotageCues(input: {
  center: PropertySabotageCenterResponse;
  nowMs?: number;
  playerId: string;
  seenKeys: ReadonlySet<string>;
}): SabotageCue[] {
  return input.center.recentLogs
    .map((log) => buildSabotageCue(log, input.playerId, input.nowMs))
    .filter((cue): cue is SabotageCue => cue !== null)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
}

export function buildSabotageCue(
  log: PropertySabotageLogSummary,
  playerId: string,
  nowMs = Date.now(),
): SabotageCue | null {
  const perspective =
    log.attackerPlayerId === playerId
      ? 'attack'
      : log.ownerPlayerId === playerId
        ? 'defense'
        : null;

  if (!perspective) {
    return null;
  }

  const createdAtMs = new Date(log.createdAt).getTime();

  if (Number.isNaN(createdAtMs) || nowMs - createdAtMs > SABOTAGE_MODAL_WINDOW_MS) {
    return null;
  }

  const propertyTypeLabel = resolveSabotagePropertyTypeLabel(log.type);
  const key = `sabotage:${perspective}:${log.id}:${log.createdAt}`;
  const recoveryHint = buildSabotageRecoveryHint(log.type, log.outcome);

  if (perspective === 'attack') {
    return {
      body: resolveAttackerBody(log, propertyTypeLabel),
      createdAt: log.createdAt,
      createdAtLabel: formatSabotageCueTimestamp(log.createdAt),
      eyebrow: 'Seu ataque',
      key,
      outcome: log.outcome,
      outcomeTone: resolveSabotageOutcomeTone(log.outcome, perspective),
      perspective,
      propertyId: log.propertyId,
      propertyTypeLabel,
      recoveryHint,
      resultLabel: resolveSabotageOutcomeLabel(log.outcome),
      targetLabel: 'Operacao rival',
      title: `${propertyTypeLabel}: resultado da sabotagem`,
    };
  }

  return {
    body: resolveOwnerBody(log, propertyTypeLabel),
    createdAt: log.createdAt,
    createdAtLabel: formatSabotageCueTimestamp(log.createdAt),
    eyebrow: 'Sua base',
    key,
    outcome: log.outcome,
    outcomeTone: resolveSabotageOutcomeTone(log.outcome, perspective),
    perspective,
    propertyId: log.propertyId,
    propertyTypeLabel,
    recoveryHint,
    resultLabel: resolveSabotageOutcomeLabel(log.outcome),
    targetLabel: 'Sua operacao',
    title: `${propertyTypeLabel}: alerta de sabotagem`,
  };
}

function formatSabotageCueTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function resolveSabotageOutcomeLabel(outcome: PropertySabotageOutcome): string {
  switch (outcome) {
    case 'damaged':
      return 'Avaria confirmada';
    case 'destroyed':
      return 'Destruicao total';
    case 'failure_clean':
      return 'Falha limpa';
    case 'failure_hard':
    default:
      return 'Falha dura';
  }
}

function resolveSabotageOutcomeTone(
  outcome: PropertySabotageOutcome,
  perspective: 'attack' | 'defense',
): SabotageCue['outcomeTone'] {
  if (outcome === 'destroyed') {
    return perspective === 'attack' ? 'success' : 'danger';
  }

  if (outcome === 'damaged') {
    return perspective === 'attack' ? 'warning' : 'danger';
  }

  if (outcome === 'failure_hard') {
    return 'danger';
  }

  return 'info';
}

function resolveAttackerBody(
  log: PropertySabotageLogSummary,
  propertyTypeLabel: string,
): string {
  switch (log.outcome) {
    case 'destroyed':
      return `${propertyTypeLabel} rival saiu do mapa. Defesa ${Math.round(log.defenseScore)} caiu e a base vai parar por um bom tempo.`;
    case 'damaged':
      return `${propertyTypeLabel} rival sofreu avaria pesada. A operacao perdeu ritmo e a manutencao vai consumir caixa do alvo.`;
    case 'failure_hard':
      return `Sua investida falhou feio no ${propertyTypeLabel.toLowerCase()}. O contra-ataque veio com prisao e calor extra.`;
    case 'failure_clean':
    default:
      return `Tentativa no ${propertyTypeLabel.toLowerCase()} falhou sem deixar estrago. O alvo segurou a base desta vez.`;
  }
}

function resolveOwnerBody(
  log: PropertySabotageLogSummary,
  propertyTypeLabel: string,
): string {
  switch (log.outcome) {
    case 'destroyed':
      return `Seu ${propertyTypeLabel.toLowerCase()} foi destruido. A operacao travou e vai exigir recuperacao completa.`;
    case 'damaged':
      return `Seu ${propertyTypeLabel.toLowerCase()} foi danificado. A producao caiu e a recuperacao vai pedir caixa.`;
    case 'failure_hard':
      return `Tentaram atingir seu ${propertyTypeLabel.toLowerCase()}, mas o ataque explodiu na mao deles.`;
    case 'failure_clean':
    default:
      return `Tentaram atingir seu ${propertyTypeLabel.toLowerCase()}, mas a defesa segurou sem dano estrutural.`;
  }
}

function resolveSabotagePropertyTypeLabel(type: PropertyType): string {
  return PROPERTY_DEFINITIONS.find((entry) => entry.type === type)?.label ?? 'Operacao';
}

function buildSabotageRecoveryHint(
  type: PropertyType,
  outcome: PropertySabotageOutcome,
): string | null {
  if (outcome !== 'damaged' && outcome !== 'destroyed') {
    return null;
  }

  const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === type);
  const basePrice = definition?.basePrice ?? FALLBACK_FACTORY_BASE_PRICE;
  const recoveryHours =
    outcome === 'destroyed'
      ? PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS
      : PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS;
  const costRate =
    outcome === 'destroyed'
      ? PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE
      : PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE;

  return `Recuperacao em ${recoveryHours}h por ${formatCurrency(Math.round(basePrice * costRate))}.`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
