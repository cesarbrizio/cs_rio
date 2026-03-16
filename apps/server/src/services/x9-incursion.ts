import {
  VocationType,
  type FavelaX9DesenroloResponse,
  type FavelaX9Summary,
  type FactionRank,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import type { GameConfigService } from './game-config.js';
import { resolveTerritoryConquestPolicy } from './gameplay-config.js';
import { roundCurrency } from './territory/shared.js';
import {
  TerritoryError,
  type TerritoryFavelaPropertyStatsRecord,
  type TerritoryFavelaRecord,
  type TerritoryFavelaSatisfactionContext,
  type TerritoryFavelaX9Exposure,
  type TerritoryFavelaX9RollSyncUpdate,
  type TerritoryPlayerRecord,
  type TerritorySatisfactionProfile,
  type TerritoryX9DomainRepository,
  type TerritoryX9EventRecord,
  type TerritoryX9SoldierImpactRecord,
  type TerritoryX9SoldierTargetRecord,
} from './territory/types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface X9IncursionServiceOptions {
  assertPlayerReady(playerId: string): Promise<TerritoryPlayerRecord>;
  buildEmptyFavelaPropertyStats(favelaId: string): TerritoryFavelaPropertyStatsRecord;
  buildFavelaSatisfactionProfile(input: {
    activeEvents: TerritoryFavelaSatisfactionContext['events'];
    now: Date;
    propertyStats: TerritoryFavelaPropertyStatsRecord;
    satisfaction: number;
    services: TerritoryFavelaSatisfactionContext['services'];
    state: TerritoryFavelaRecord['state'];
  }): TerritorySatisfactionProfile;
  buildTerritoryOverview(
    playerFactionId: string | null,
    favelasList: TerritoryFavelaSummary[],
  ): TerritoryOverviewResponse;
  gameConfigService: GameConfigService;
  now: () => Date;
  random: () => number;
  repository: TerritoryX9DomainRepository;
  syncAndListFavelas(): Promise<TerritoryFavelaSummary[]>;
}

export class X9IncursionService {
  constructor(private readonly options: X9IncursionServiceOptions) {}

  async attemptX9Desenrolo(
    playerId: string,
    favelaId: string,
  ): Promise<FavelaX9DesenroloResponse> {
    const player = await this.options.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.options.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para negociar desenrolo.');
    }

    if (!canPlayerAttemptX9Desenrolo(player, conquestPolicy.commandRanks)) {
      throw new TerritoryError(
        'forbidden',
        'Apenas patrao, general ou um politico da faccao podem negociar o desenrolo.',
      );
    }

    const overviewBefore = await this.options.syncAndListFavelas();
    const favelaBefore = overviewBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favelaBefore.controllingFaction?.id !== player.factionId) {
      throw new TerritoryError('forbidden', 'Sua faccao precisa controlar a favela para negociar o desenrolo.');
    }

    const latestEvent = await this.requireLatestX9EventForFavela(favelaId);

    if (latestEvent.status !== 'pending_desenrolo') {
      throw new TerritoryError('conflict', 'Nao existe desenrolo pendente para essa favela.');
    }

    const faction = await this.options.repository.getFaction(player.factionId);

    if (!faction) {
      throw new TerritoryError('not_found', 'Faccao nao encontrada.');
    }

    const attemptedAt = this.options.now();
    const discountMultiplier = resolveX9DesenroloDiscountMultiplier(player.carisma);
    const moneySpent = roundCurrency(latestEvent.desenroloBaseMoneyCost * discountMultiplier);
    const pointsSpent = Math.max(
      1,
      Math.round(latestEvent.desenroloBasePointsCost * discountMultiplier),
    );

    if (faction.bankMoney < moneySpent) {
      throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para pagar o desenrolo.');
    }

    if (faction.points < pointsSpent) {
      throw new TerritoryError('conflict', 'A faccao nao tem pontos suficientes para o desenrolo.');
    }

    const successChance = resolveX9DesenroloSuccessChance(player, latestEvent);
    const success = this.options.random() <= successChance;
    const releaseAt = success
      ? attemptedAt
      : new Date(attemptedAt.getTime() + resolveX9FailedDesenroloDays(this.options.random) * ONE_DAY_MS);

    const updatedEvent = await this.options.repository.resolveX9Desenrolo({
      actorPlayerId: player.id,
      attemptedAt,
      eventId: latestEvent.id,
      factionId: player.factionId,
      moneySpent,
      pointsSpent,
      releaseAt,
      success,
    });

    if (!updatedEvent) {
      throw new TerritoryError('not_found', 'Evento de X9 nao encontrado para desenrolo.');
    }

    const syncedAfter = await this.options.syncAndListFavelas();
    const overview = this.options.buildTerritoryOverview(player.factionId, syncedAfter);
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela || !favela.x9) {
      throw new TerritoryError('not_found', 'Favela nao encontrada apos o desenrolo.');
    }

    return {
      ...overview,
      attemptedAt: attemptedAt.toISOString(),
      discountMultiplier,
      event: favela.x9,
      favela,
      message: success
        ? `Desenrolo bem-sucedido em ${favela.name}; os soldados foram liberados.`
        : `O desenrolo falhou em ${favela.name}; os soldados seguem presos por mais tempo.`,
      moneySpent,
      pointsSpent,
      releaseAt: updatedEvent.soldiersReleaseAt?.toISOString() ?? null,
      success,
      successChance,
    };
  }

  async syncFavelaX9(
    favelasList: TerritoryFavelaRecord[],
    satisfactionContexts: Map<string, TerritoryFavelaSatisfactionContext>,
    now: Date,
  ): Promise<Map<string, TerritoryX9EventRecord | null>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const eventsByFavela = new Map<string, TerritoryX9EventRecord | null>(
      selectLatestX9EventByFavela(
        await this.options.repository.listX9Events(favelasList.map((favela) => favela.id)),
      ),
    );
    const rollUpdates: TerritoryFavelaX9RollSyncUpdate[] = [];

    for (const favela of favelasList) {
      let latestEvent = eventsByFavela.get(favela.id) ?? null;

      if (latestEvent?.status === 'warning' && latestEvent.warningEndsAt && latestEvent.warningEndsAt <= now) {
        const exposure = await this.options.repository.getFavelaX9Exposure(favela.id);
        const incursionAt = latestEvent.warningEndsAt;
        const impacts = buildTerritoryX9IncursionImpacts({
          exposure,
          favela,
          random: this.options.random,
        });
        const nextSatisfaction = clamp(favela.satisfaction - 10, 0, 100);

        latestEvent = await this.options.repository.applyX9Incursion({
          baseMoneyCost: impacts.baseMoneyCost,
          basePointsCost: impacts.basePointsCost,
          cashImpacts: impacts.cashImpacts,
          drugsLost: impacts.drugsLost,
          drugImpacts: impacts.drugImpacts,
          eventId: latestEvent.id,
          favelaId: favela.id,
          incursionAt,
          moneyLost: impacts.moneyLost,
          nextSatisfaction,
          soldierImpacts: impacts.soldierImpacts,
          soldiersArrested: impacts.soldiersArrested,
          soldiersReleaseAt: new Date(incursionAt.getTime() + 5 * ONE_DAY_MS),
          weaponsLost: impacts.weaponsLost,
        });

        favela.satisfaction = nextSatisfaction;
        favela.satisfactionSyncedAt = incursionAt;
      }

      if (
        latestEvent &&
        (latestEvent.status === 'pending_desenrolo' || latestEvent.status === 'jailed') &&
        latestEvent.soldiersReleaseAt &&
        latestEvent.soldiersReleaseAt <= now
      ) {
        latestEvent = await this.options.repository.releaseX9Soldiers(
          latestEvent.id,
          latestEvent.soldiersReleaseAt,
        );
      }

      eventsByFavela.set(favela.id, latestEvent);

      const hasActiveX9 =
        latestEvent !== null &&
        latestEvent.status !== 'resolved' &&
        (!latestEvent.resolvedAt || latestEvent.resolvedAt.getTime() > now.getTime());

      const stabilizationActive =
        favela.stabilizationEndsAt !== null && favela.stabilizationEndsAt.getTime() > now.getTime();

      if (
        hasActiveX9 ||
        stabilizationActive ||
        favela.state !== 'controlled' ||
        !favela.controllingFactionId
      ) {
        continue;
      }

      const elapsedMs = Math.max(0, now.getTime() - favela.lastX9RollAt.getTime());
      const daysElapsed = Math.floor(elapsedMs / ONE_DAY_MS);

      if (daysElapsed < 1) {
        continue;
      }

      const currentContext = satisfactionContexts.get(favela.id);
      const riskPercent = this.options.buildFavelaSatisfactionProfile({
        activeEvents: currentContext?.events ?? [],
        now,
        propertyStats:
          currentContext?.propertyStats ?? this.options.buildEmptyFavelaPropertyStats(favela.id),
        satisfaction: favela.satisfaction,
        services: currentContext?.services ?? [],
        state: favela.state,
      }).dailyX9RiskPercent;

      let nextLastRollAt = favela.lastX9RollAt;

      for (let dayIndex = 0; dayIndex < daysElapsed; dayIndex += 1) {
        const rollAt = new Date(favela.lastX9RollAt.getTime() + (dayIndex + 1) * ONE_DAY_MS);
        nextLastRollAt = rollAt;

        if (this.options.random() > riskPercent / 100) {
          continue;
        }

        latestEvent = await this.options.repository.createX9Warning({
          favelaId: favela.id,
          status: 'warning',
          triggeredAt: rollAt,
          warningEndsAt: new Date(
            rollAt.getTime() + resolveX9WarningHours(this.options.random) * 60 * 60 * 1000,
          ),
        });

        if (latestEvent.warningEndsAt && latestEvent.warningEndsAt <= now) {
          const exposure = await this.options.repository.getFavelaX9Exposure(favela.id);
          const incursionAt = latestEvent.warningEndsAt;
          const impacts = buildTerritoryX9IncursionImpacts({
            exposure,
            favela,
            random: this.options.random,
          });
          const nextSatisfaction = clamp(favela.satisfaction - 10, 0, 100);

          latestEvent = await this.options.repository.applyX9Incursion({
            baseMoneyCost: impacts.baseMoneyCost,
            basePointsCost: impacts.basePointsCost,
            cashImpacts: impacts.cashImpacts,
            drugsLost: impacts.drugsLost,
            drugImpacts: impacts.drugImpacts,
            eventId: latestEvent.id,
            favelaId: favela.id,
            incursionAt,
            moneyLost: impacts.moneyLost,
            nextSatisfaction,
            soldierImpacts: impacts.soldierImpacts,
            soldiersArrested: impacts.soldiersArrested,
            soldiersReleaseAt: new Date(incursionAt.getTime() + 5 * ONE_DAY_MS),
            weaponsLost: impacts.weaponsLost,
          });

          favela.satisfaction = nextSatisfaction;
          favela.satisfactionSyncedAt = incursionAt;
        }

        eventsByFavela.set(favela.id, latestEvent);
        break;
      }

      favela.lastX9RollAt = nextLastRollAt;
      rollUpdates.push({
        favelaId: favela.id,
        nextLastRollAt,
      });
    }

    if (rollUpdates.length > 0) {
      await this.options.repository.persistFavelaX9RollSync(rollUpdates);
    }

    return eventsByFavela;
  }

  private async requireLatestX9EventForFavela(favelaId: string): Promise<TerritoryX9EventRecord> {
    const latestEvent = selectLatestX9EventByFavela(
      await this.options.repository.listX9Events([favelaId]),
    ).get(favelaId);

    if (!latestEvent) {
      throw new TerritoryError('not_found', 'Nao existe evento de X9 registrado para essa favela.');
    }

    return latestEvent;
  }
}

export function buildFavelaX9Summary(
  event: TerritoryX9EventRecord | null,
  currentRiskPercent: number,
): FavelaX9Summary | null {
  if (!event) {
    return null;
  }

  return {
    canAttemptDesenrolo: event.status === 'pending_desenrolo',
    currentRiskPercent,
    desenroloAttemptedAt: event.desenroloAttemptedAt?.toISOString() ?? null,
    desenroloBaseMoneyCost:
      event.incursionAt || event.desenroloBaseMoneyCost > 0 ? event.desenroloBaseMoneyCost : null,
    desenroloBasePointsCost:
      event.incursionAt || event.desenroloBasePointsCost > 0 ? event.desenroloBasePointsCost : null,
    desenroloMoneySpent: event.desenroloMoneySpent,
    desenroloPointsSpent: event.desenroloPointsSpent,
    desenroloSucceeded: event.desenroloSucceeded,
    drugsLost: event.drugsLost,
    id: event.id,
    incursionAt: event.incursionAt?.toISOString() ?? null,
    moneyLost: event.moneyLost,
    pendingSoldiersReturn: event.status === 'resolved' ? 0 : event.soldiersArrested,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
    soldiersArrested: event.soldiersArrested,
    soldiersReleaseAt: event.soldiersReleaseAt?.toISOString() ?? null,
    status: event.status,
    triggeredAt: event.triggeredAt.toISOString(),
    warningEndsAt: event.warningEndsAt?.toISOString() ?? null,
    weaponsLost: event.weaponsLost,
  };
}

function selectLatestX9EventByFavela(
  events: TerritoryX9EventRecord[],
): Map<string, TerritoryX9EventRecord> {
  const map = new Map<string, TerritoryX9EventRecord>();

  for (const event of [...events].sort((left, right) => right.triggeredAt.getTime() - left.triggeredAt.getTime())) {
    if (!map.has(event.favelaId)) {
      map.set(event.favelaId, event);
    }
  }

  return map;
}

function buildTerritoryX9IncursionImpacts(input: {
  exposure: TerritoryFavelaX9Exposure;
  favela: Pick<TerritoryFavelaRecord, 'difficulty'>;
  random: () => number;
}): {
  baseMoneyCost: number;
  basePointsCost: number;
  cashImpacts: Array<{
    kind: 'boca' | 'front_store' | 'puteiro' | 'rave' | 'slot_machine';
    lostAmount: number;
    propertyId: string;
  }>;
  drugImpacts: Array<{
    drugId: string;
    kind: 'boca' | 'factory' | 'rave';
    lostQuantity: number;
    propertyId: string;
  }>;
  drugsLost: number;
  moneyLost: number;
  soldierImpacts: TerritoryX9SoldierImpactRecord[];
  soldiersArrested: number;
  weaponsLost: number;
} {
  const moneyLossRate = resolveX9LossRate(input.random, 0.05, 0.15);
  const drugsLossRate = resolveX9LossRate(input.random, 0.2, 0.5);
  const weaponsLossRate = resolveX9LossRate(input.random, 0.1, 0.3);

  const cashImpacts = input.exposure.cashTargets
    .map((target) => ({
      kind: target.kind,
      lostAmount: roundCurrency(target.cashBalance * moneyLossRate),
      propertyId: target.propertyId,
    }))
    .filter((impact) => impact.lostAmount > 0);
  const moneyLost = roundCurrency(cashImpacts.reduce((sum, entry) => sum + entry.lostAmount, 0));

  const drugImpacts = input.exposure.drugTargets
    .map((target) => ({
      drugId: target.drugId,
      kind: target.kind,
      lostQuantity: resolveX9QuantityLoss(target.quantity, drugsLossRate),
      propertyId: target.propertyId,
    }))
    .filter((impact) => impact.lostQuantity > 0);
  const drugsLost = drugImpacts.reduce((sum, entry) => sum + entry.lostQuantity, 0);

  const totalSoldiers = input.exposure.soldierTargets.reduce(
    (sum, target) => sum + target.soldiersCount,
    0,
  );
  const soldiersArrested =
    totalSoldiers > 0 ? Math.min(totalSoldiers, 1 + Math.floor(input.random() * 3)) : 0;
  const soldierImpacts = allocateX9SoldierArrests(
    input.exposure.soldierTargets,
    soldiersArrested,
  );
  const weaponsLost =
    totalSoldiers > 0
      ? Math.max(soldiersArrested, resolveX9QuantityLoss(totalSoldiers, weaponsLossRate))
      : 0;
  const baseMoneyCost = roundCurrency(
    Math.max(
      5000,
      moneyLost * 0.45 + drugsLost * 30 + weaponsLost * 120 + soldiersArrested * 2500,
    ),
  );
  const basePointsCost = Math.max(
    8,
    Math.round(input.favela.difficulty * 3 + soldiersArrested * 6 + weaponsLost * 0.4),
  );

  return {
    baseMoneyCost,
    basePointsCost,
    cashImpacts,
    drugImpacts,
    drugsLost,
    moneyLost,
    soldierImpacts,
    soldiersArrested,
    weaponsLost,
  };
}

function allocateX9SoldierArrests(
  soldierTargets: TerritoryX9SoldierTargetRecord[],
  arrestedTotal: number,
): TerritoryX9SoldierImpactRecord[] {
  if (arrestedTotal <= 0) {
    return [];
  }

  let remaining = arrestedTotal;
  const impacts: TerritoryX9SoldierImpactRecord[] = [];

  for (const target of [...soldierTargets].sort(
    (left, right) => right.soldiersCount - left.soldiersCount,
  )) {
    if (remaining <= 0) {
      break;
    }

    const count = Math.min(target.soldiersCount, remaining);

    if (count <= 0) {
      continue;
    }

    impacts.push({
      count,
      propertyId: target.propertyId,
    });
    remaining -= count;
  }

  return impacts;
}

function resolveX9QuantityLoss(quantity: number, rate: number): number {
  if (quantity <= 0) {
    return 0;
  }

  return Math.min(quantity, Math.max(1, Math.floor(quantity * rate)));
}

function resolveX9LossRate(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function resolveX9WarningHours(random: () => number): number {
  return 2 + Math.floor(random() * 3);
}

function resolveX9FailedDesenroloDays(random: () => number): number {
  return 1 + Math.floor(random() * 3);
}

function canPlayerAttemptX9Desenrolo(
  player: TerritoryPlayerRecord,
  commandRanks: FactionRank[],
): boolean {
  return commandRanks.includes(player.rank as FactionRank) || player.vocation === VocationType.Politico;
}

function resolveX9DesenroloDiscountMultiplier(carisma: number): number {
  return roundMultiplier(1 - Math.min(0.5, Math.max(0, carisma) * 0.01));
}

function resolveX9DesenroloSuccessChance(
  player: Pick<TerritoryPlayerRecord, 'carisma' | 'rank' | 'vocation'>,
  event: Pick<TerritoryX9EventRecord, 'soldiersArrested' | 'weaponsLost'>,
): number {
  let chance = 0.32 + player.carisma * 0.015;

  if (player.rank === 'patrao') {
    chance += 0.12;
  } else if (player.rank === 'general') {
    chance += 0.08;
  }

  if (player.vocation === VocationType.Politico) {
    chance += 0.1;
  }

  chance -= event.soldiersArrested * 0.04;
  chance -= Math.min(0.15, event.weaponsLost * 0.005);

  return clamp(chance, 0.15, 0.95);
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
