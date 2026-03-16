import type {
  FavelaServiceDefinitionSummary,
  FavelaServiceType,
  FavelaX9Status,
  FactionWarRoundOutcome,
  FactionWarSide,
  FactionWarStatus,
} from '@cs-rio/shared';

import { resolveCachedFavelaServiceDefinition } from '../economy-config.js';
import {
  TerritoryError,
  type TerritoryConquestParticipantPersistenceUpdate,
  type TerritoryFactionWarPreparationRecord,
  type TerritoryFactionWarRecord,
  type TerritoryFactionWarRoundRecord,
  type TerritoryX9EventRecord,
  type TerritoryX9SoldierImpactRecord,
} from './types.js';

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function requireFavelaServiceDefinition(
  serviceType: FavelaServiceType,
): FavelaServiceDefinitionSummary {
  try {
    return resolveCachedFavelaServiceDefinition(serviceType);
  } catch {
    throw new TerritoryError('validation', 'Tipo de servico de favela invalido.');
  }
}

export function resolveFavelaServiceUpgradeCost(
  definition: FavelaServiceDefinitionSummary,
  currentLevel: number,
): number {
  return roundCurrency(definition.installCost * (0.7 + currentLevel * 0.3));
}

export function mapTerritoryX9EventRow(row: {
  desenroloAttemptedAt: Date | null;
  desenroloBaseMoneyCost: string | number;
  desenroloBasePointsCost: number;
  desenroloMoneySpent: string | number;
  desenroloNegotiatorPlayerId: string | null;
  desenroloPointsSpent: number;
  desenroloSucceeded: boolean | null;
  drugsLost: number;
  favelaId: string;
  id: string;
  incursionAt: Date | null;
  moneyLost: string | number;
  resolvedAt: Date | null;
  soldierImpactJson: unknown;
  soldiersArrested: number;
  soldiersReleaseAt: Date | null;
  status: string;
  triggeredAt: Date;
  warningEndsAt: Date | null;
  weaponsLost: number;
}): TerritoryX9EventRecord {
  return {
    desenroloAttemptedAt: row.desenroloAttemptedAt,
    desenroloBaseMoneyCost: roundCurrency(Number.parseFloat(String(row.desenroloBaseMoneyCost ?? 0))),
    desenroloBasePointsCost: row.desenroloBasePointsCost,
    desenroloMoneySpent: roundCurrency(Number.parseFloat(String(row.desenroloMoneySpent ?? 0))),
    desenroloNegotiatorPlayerId: row.desenroloNegotiatorPlayerId,
    desenroloPointsSpent: row.desenroloPointsSpent,
    desenroloSucceeded: row.desenroloSucceeded,
    drugsLost: row.drugsLost,
    favelaId: row.favelaId,
    id: row.id,
    incursionAt: row.incursionAt,
    moneyLost: roundCurrency(Number.parseFloat(String(row.moneyLost ?? 0))),
    resolvedAt: row.resolvedAt,
    soldierImpacts: parseTerritoryX9SoldierImpactJson(row.soldierImpactJson),
    soldiersArrested: row.soldiersArrested,
    soldiersReleaseAt: row.soldiersReleaseAt,
    status: row.status as FavelaX9Status,
    triggeredAt: row.triggeredAt,
    warningEndsAt: row.warningEndsAt,
    weaponsLost: row.weaponsLost,
  };
}

export function parseTerritoryX9SoldierImpactJson(
  value: unknown,
): TerritoryX9SoldierImpactRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    const propertyId = typeof candidate.propertyId === 'string' ? candidate.propertyId : null;
    const count =
      typeof candidate.count === 'number'
        ? candidate.count
        : Number.parseInt(String(candidate.count ?? 0), 10);

    if (!propertyId || !Number.isFinite(count) || count <= 0) {
      return [];
    }

    return [
      {
        count,
        propertyId,
      } satisfies TerritoryX9SoldierImpactRecord,
    ];
  });
}

export function mapTerritoryFactionWarRow(row: {
  attackerFactionId: string;
  attackerPreparationJson: unknown;
  attackerScore: number;
  cooldownEndsAt: Date | null;
  declaredAt: Date;
  declaredByPlayerId: string | null;
  defenderFactionId: string;
  defenderPreparationJson: unknown;
  defenderScore: number;
  endedAt: Date | null;
  favelaId: string;
  id: string;
  lootMoney: string | number;
  nextRoundAt: Date | null;
  preparationEndsAt: Date | null;
  roundResultsJson: unknown;
  roundsResolved: number;
  roundsTotal: number;
  startsAt: Date | null;
  status: FactionWarStatus;
  winnerFactionId: string | null;
}): TerritoryFactionWarRecord {
  return {
    attackerFactionId: row.attackerFactionId,
    attackerPreparation: parseTerritoryFactionWarPreparationJson(row.attackerPreparationJson),
    attackerScore: row.attackerScore,
    cooldownEndsAt: row.cooldownEndsAt,
    declaredAt: row.declaredAt,
    declaredByPlayerId: row.declaredByPlayerId,
    defenderFactionId: row.defenderFactionId,
    defenderPreparation: parseTerritoryFactionWarPreparationJson(row.defenderPreparationJson),
    defenderScore: row.defenderScore,
    endedAt: row.endedAt,
    favelaId: row.favelaId,
    id: row.id,
    lootMoney: roundCurrency(Number.parseFloat(String(row.lootMoney))),
    nextRoundAt: row.nextRoundAt,
    preparationEndsAt: row.preparationEndsAt,
    rounds: parseTerritoryFactionWarRoundsJson(row.roundResultsJson),
    roundsResolved: row.roundsResolved,
    roundsTotal: row.roundsTotal,
    startsAt: row.startsAt,
    status: row.status,
    winnerFactionId: row.winnerFactionId,
  };
}

export function serializeTerritoryFactionWarPreparation(
  preparation: TerritoryFactionWarPreparationRecord,
): Record<string, unknown> {
  return {
    budget: preparation.budget,
    powerBonus: preparation.powerBonus,
    preparedAt: preparation.preparedAt.toISOString(),
    preparedByPlayerId: preparation.preparedByPlayerId,
    regionPresenceCount: preparation.regionPresenceCount,
    side: preparation.side,
    soldierCommitment: preparation.soldierCommitment,
  };
}

function parseTerritoryFactionWarPreparationJson(
  value: unknown,
): TerritoryFactionWarPreparationRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.preparedAt !== 'string' ||
    typeof record.preparedByPlayerId !== 'string' ||
    typeof record.side !== 'string'
  ) {
    return null;
  }

  return {
    budget: Number(record.budget ?? 0),
    powerBonus: Number(record.powerBonus ?? 0),
    preparedAt: new Date(record.preparedAt),
    preparedByPlayerId: record.preparedByPlayerId,
    regionPresenceCount: Number(record.regionPresenceCount ?? 0),
    side: record.side as FactionWarSide,
    soldierCommitment: Number(record.soldierCommitment ?? 0),
  };
}

export function serializeTerritoryFactionWarRound(
  round: TerritoryFactionWarRoundRecord,
): Record<string, unknown> {
  return {
    attackerHpLoss: round.attackerHpLoss,
    attackerDisposicaoLoss: round.attackerDisposicaoLoss,
    attackerPower: round.attackerPower,
    attackerCansacoLoss: round.attackerCansacoLoss,
    defenderHpLoss: round.defenderHpLoss,
    defenderDisposicaoLoss: round.defenderDisposicaoLoss,
    defenderPower: round.defenderPower,
    defenderCansacoLoss: round.defenderCansacoLoss,
    message: round.message,
    outcome: round.outcome,
    resolvedAt: round.resolvedAt.toISOString(),
    roundNumber: round.roundNumber,
  };
}

function parseTerritoryFactionWarRoundsJson(
  value: unknown,
): TerritoryFactionWarRoundRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .filter(
      (entry) =>
        typeof entry.resolvedAt === 'string' &&
        typeof entry.outcome === 'string' &&
        typeof entry.message === 'string',
    )
    .map((entry) => ({
      attackerHpLoss: Number(entry.attackerHpLoss ?? 0),
      attackerDisposicaoLoss: Number(entry.attackerDisposicaoLoss ?? 0),
      attackerPower: Number(entry.attackerPower ?? 0),
      attackerCansacoLoss: Number(entry.attackerCansacoLoss ?? 0),
      defenderHpLoss: Number(entry.defenderHpLoss ?? 0),
      defenderDisposicaoLoss: Number(entry.defenderDisposicaoLoss ?? 0),
      defenderPower: Number(entry.defenderPower ?? 0),
      defenderCansacoLoss: Number(entry.defenderCansacoLoss ?? 0),
      message: String(entry.message),
      outcome: entry.outcome as FactionWarRoundOutcome,
      resolvedAt: new Date(String(entry.resolvedAt)),
      roundNumber: Number(entry.roundNumber ?? 1),
    }));
}

export function buildTerritoryConquestLogDescription(
  input: TerritoryConquestParticipantPersistenceUpdate,
): string {
  if (input.logType === 'territory_conquest_success') {
    return `Conquista de ${input.favelaName} bem-sucedida. Conceito ${input.conceitoDelta}.`;
  }

  return `Tentativa de conquista em ${input.favelaName} falhou. Impacto de HP ${input.hpDelta}.`;
}
