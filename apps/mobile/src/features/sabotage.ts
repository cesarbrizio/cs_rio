import {
  PROPERTY_DEFINITIONS,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS,
  type OwnedPropertySummary,
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
      targetLabel: 'Operação rival',
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
    targetLabel: 'Sua operação',
    title: `${propertyTypeLabel}: alerta de sabotagem`,
  };
}

export function buildOwnedSabotageRecoveryCards(
  properties: OwnedPropertySummary[],
): OwnedPropertySummary[] {
  return properties
    .filter((property) => property.sabotageStatus.state !== 'normal')
    .sort((left, right) => {
      const leftMs = left.sabotageStatus.resolvedAt
        ? new Date(left.sabotageStatus.resolvedAt).getTime()
        : 0;
      const rightMs = right.sabotageStatus.resolvedAt
        ? new Date(right.sabotageStatus.resolvedAt).getTime()
        : 0;
      return rightMs - leftMs;
    });
}

export function formatSabotageAvailabilityCost(
  availability: PropertySabotageCenterResponse['availability'],
): string {
  return `${availability.cansacoCost} Cansaço · ${availability.disposicaoCost} Disposição`;
}

export function formatSabotageCooldown(seconds: number): string {
  if (seconds <= 0) {
    return 'Livre';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.ceil((seconds % 3600) / 60));

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}min`;
}

export function formatSabotageRecoveryStatus(
  property: Pick<OwnedPropertySummary, 'sabotageStatus'>,
): string {
  const status = property.sabotageStatus;

  if (status.state === 'normal') {
    return 'Sem dano estrutural';
  }

  if (status.recoveryReady) {
    return 'Reparo liberado agora';
  }

  if (status.recoveryReadyAt) {
    return `Libera ${formatSabotageCueTimestamp(status.recoveryReadyAt)}`;
  }

  return 'Recuperação em espera';
}

export function formatSabotageCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatSabotageOperationalImpact(multiplier: number): string {
  if (multiplier <= 0) {
    return '0% do ritmo operacional';
  }

  return `${Math.round(multiplier * 100)}% do ritmo operacional`;
}

export function formatSabotageCueTimestamp(value: string): string {
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

export function resolveSabotageActionLabel(): string {
  return 'Abrir sabotagem';
}

export function resolveSabotageOutcomeLabel(outcome: PropertySabotageOutcome): string {
  switch (outcome) {
    case 'damaged':
      return 'Avaria confirmada';
    case 'destroyed':
      return 'Destruição total';
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
      return `Você destruiu a ${propertyTypeLabel.toLowerCase()} rival. O alvo travou até pagar a reconstrução.`;
    case 'damaged':
      return `A ${propertyTypeLabel.toLowerCase()} rival ficou avariada e caiu para metade do ritmo.`;
    case 'failure_clean':
      return `A tentativa na ${propertyTypeLabel.toLowerCase()} falhou sem dano estrutural, mas o alvo percebeu a movimentação.`;
    case 'failure_hard':
    default:
      return `A sabotagem na ${propertyTypeLabel.toLowerCase()} deu ruim. A pressão subiu e a resposta veio pesada.`;
  }
}

function resolveOwnerBody(
  log: PropertySabotageLogSummary,
  propertyTypeLabel: string,
): string {
  switch (log.outcome) {
    case 'destroyed':
      return `Sua ${propertyTypeLabel.toLowerCase()} foi destruída e ficou parada até a reconstrução.`;
    case 'damaged':
      return `Sua ${propertyTypeLabel.toLowerCase()} foi avariada e opera a 50% até o reparo.`;
    case 'failure_clean':
      return `Tentaram sabotar sua ${propertyTypeLabel.toLowerCase()}, mas sem dano estrutural.`;
    case 'failure_hard':
    default:
      return `Tentaram derrubar sua ${propertyTypeLabel.toLowerCase()}, mas a resposta local segurou o pior cenário.`;
  }
}

function buildSabotageRecoveryHint(
  propertyType: PropertyType,
  outcome: PropertySabotageOutcome,
): string | null {
  if (outcome !== 'damaged' && outcome !== 'destroyed') {
    return null;
  }

  const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === propertyType);
  const basePrice =
    definition && definition.basePrice > 0
      ? definition.basePrice
      : propertyType === 'factory'
        ? FALLBACK_FACTORY_BASE_PRICE
        : 0;

  if (basePrice <= 0) {
    return null;
  }

  if (outcome === 'damaged') {
    return `Reparo: ${formatSabotageCurrency(basePrice * PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE)} · ${PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS}h de jogo`;
  }

  return `Reconstrução: ${formatSabotageCurrency(basePrice * PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE)} · ${PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS}h de jogo`;
}

function resolveSabotagePropertyTypeLabel(type: PropertyType): string {
  return {
    airplane: 'Avião',
    art: 'Arte',
    beach_house: 'Casa de Praia',
    boca: 'Boca',
    boat: 'Barco',
    car: 'Carro',
    factory: 'Fábrica',
    front_store: 'Loja de Fachada',
    helicopter: 'Helicóptero',
    house: 'Casa',
    jet_ski: 'Jet Ski',
    jewelry: 'Joias',
    luxury: 'Luxo',
    mansion: 'Mansão',
    puteiro: 'Puteiro',
    rave: 'Rave',
    slot_machine: 'Maquininha',
    yacht: 'Iate',
  }[type];
}
