import {
  VocationType,
  type FavelaPropinaNegotiationResponse,
  type FavelaPropinaStatus,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import {
  resolveCachedTerritoryPropinaPolicy,
  resolveCachedTerritoryPropinaRegionProfile,
} from './economy-config.js';
import type { GameConfigService } from './game-config.js';
import { resolveTerritoryConquestPolicy } from './gameplay-config.js';
import { roundCurrency } from './territory/shared.js';
import {
  TerritoryError,
  type TerritoryFavelaPropinaSyncUpdate,
  type TerritoryFavelaRecord,
  type TerritoryPlayerRecord,
  type TerritoryPropinaDomainRepository,
} from './territory/types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface PropinaServiceOptions {
  assertPlayerReady(playerId: string): Promise<TerritoryPlayerRecord>;
  buildTerritoryOverview(
    playerFactionId: string | null,
    favelasList: TerritoryFavelaSummary[],
  ): TerritoryOverviewResponse;
  gameConfigService: GameConfigService;
  now: () => Date;
  random: () => number;
  repository: TerritoryPropinaDomainRepository;
  syncAndListFavelas(): Promise<TerritoryFavelaSummary[]>;
}

export class PropinaService {
  constructor(private readonly options: PropinaServiceOptions) {}

  async negotiatePropina(
    playerId: string,
    favelaId: string,
  ): Promise<FavelaPropinaNegotiationResponse> {
    const player = await this.options.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.options.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para negociar arrego.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem negociar o arrego da favela.');
    }

    const overviewBefore = await this.options.syncAndListFavelas();
    const favelaBefore = overviewBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favelaBefore.state !== 'controlled' || favelaBefore.controllingFaction?.id !== player.factionId) {
      throw new TerritoryError('forbidden', 'Sua faccao precisa controlar a favela para negociar o arrego.');
    }

    if (!favelaBefore.propina) {
      throw new TerritoryError('conflict', 'Ainda nao existe cobranca de propina ativa para essa favela.');
    }

    if (!favelaBefore.propina.canNegotiate) {
      throw new TerritoryError('conflict', 'A propina dessa favela ja foi negociada neste periodo.');
    }

    const successChance = resolveFavelaPropinaNegotiationSuccessChance(player);
    const success = this.options.random() <= successChance;
    const discountRate = success ? resolveFavelaPropinaNegotiationDiscountRate(player) : 0;
    const nextPropinaValue = roundCurrency(favelaBefore.propina.baseAmount * (1 - discountRate));
    const negotiatedAt = this.options.now();

    const persisted = await this.options.repository.negotiateFavelaPropina({
      discountRate,
      favelaId,
      negotiatedAt,
      negotiatedByPlayerId: player.id,
      nextPropinaValue,
    });

    if (!persisted) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar a negociacao da propina.');
    }

    const syncedAfter = await this.options.syncAndListFavelas();
    const overview = this.options.buildTerritoryOverview(player.factionId, syncedAfter);
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela?.propina) {
      throw new TerritoryError('not_found', 'Favela nao encontrada apos a negociacao da propina.');
    }

    return {
      ...overview,
      discountRate,
      favela,
      message: success
        ? `A PM aceitou reduzir o arrego em ${Math.round(discountRate * 100)}% para ${favela.name}.`
        : `A negociacao falhou e o arrego de ${favela.name} permanece integral neste periodo.`,
      propina: favela.propina,
      success,
      successChance,
    };
  }

  async syncFavelaPropina(
    favelasList: TerritoryFavelaRecord[],
    now: Date,
  ): Promise<string[]> {
    if (favelasList.length === 0) {
      return [];
    }

    const propinaPolicy = resolveCachedTerritoryPropinaPolicy();
    const syncUpdates: TerritoryFavelaPropinaSyncUpdate[] = [];
    const takeoverFavelaIds: string[] = [];

    for (const favela of favelasList) {
      if (favela.state !== 'controlled' || !favela.controllingFactionId) {
        if (shouldResetFavelaPropina(favela)) {
          const resetUpdate = buildResetFavelaPropinaSyncUpdate(favela.id);
          syncUpdates.push(resetUpdate);
          applyFavelaPropinaSyncUpdate(favela, resetUpdate);
        }

        continue;
      }

      const baseAmount = calculateFavelaPropinaBaseAmount(favela);

      if (!favela.propinaDueDate) {
        const scheduledUpdate = {
          favelaId: favela.id,
          nextDiscountRate: 0,
          nextDueDate: buildInitialFavelaPropinaDueDate(favela, now),
          nextLastPaidAt: favela.propinaLastPaidAt,
          nextNegotiatedAt: null,
          nextNegotiatedByPlayerId: null,
          nextPropinaValue: baseAmount,
        } satisfies TerritoryFavelaPropinaSyncUpdate;

        syncUpdates.push(scheduledUpdate);
        applyFavelaPropinaSyncUpdate(favela, scheduledUpdate);
        continue;
      }

      const expectedAmount = roundCurrency(baseAmount * (1 - favela.propinaDiscountRate));

      if (favela.propinaValue !== expectedAmount) {
        const normalizedUpdate = {
          favelaId: favela.id,
          nextDiscountRate: favela.propinaDiscountRate,
          nextDueDate: favela.propinaDueDate,
          nextLastPaidAt: favela.propinaLastPaidAt,
          nextNegotiatedAt: favela.propinaNegotiatedAt,
          nextNegotiatedByPlayerId: favela.propinaNegotiatedByPlayerId,
          nextPropinaValue: expectedAmount,
        } satisfies TerritoryFavelaPropinaSyncUpdate;

        syncUpdates.push(normalizedUpdate);
        applyFavelaPropinaSyncUpdate(favela, normalizedUpdate);
      }

      const propinaStatus = resolveFavelaPropinaStatus(favela.propinaDueDate, now);

      if (propinaStatus === 'state_takeover') {
        const takeoverUntil = new Date(
          now.getTime() + resolveFavelaPropinaStateTakeoverDays(this.options.random) * ONE_DAY_MS,
        );

        await this.options.repository.updateFavelaState(favela.id, {
          contestingFactionId: null,
          controllingFactionId: null,
          propinaDiscountRate: 0,
          propinaDueDate: null,
          propinaLastPaidAt: favela.propinaLastPaidAt,
          propinaNegotiatedAt: null,
          propinaNegotiatedByPlayerId: null,
          propinaValue: 0,
          satisfactionSyncedAt: now,
          stabilizationEndsAt: null,
          state: 'state',
          stateControlledUntil: takeoverUntil,
          warDeclaredAt: null,
        });

        favela.contestingFactionId = null;
        favela.controllingFactionId = null;
        favela.propinaDiscountRate = 0;
        favela.propinaDueDate = null;
        favela.propinaNegotiatedAt = null;
        favela.propinaNegotiatedByPlayerId = null;
        favela.propinaValue = 0;
        favela.satisfactionSyncedAt = now;
        favela.stabilizationEndsAt = null;
        favela.state = 'state';
        favela.stateControlledUntil = takeoverUntil;
        favela.warDeclaredAt = null;
        takeoverFavelaIds.push(favela.id);
        continue;
      }

      if (favela.propinaDueDate.getTime() > now.getTime()) {
        continue;
      }

      const paid = await this.options.repository.payFavelaPropina({
        amount: expectedAmount,
        factionId: favela.controllingFactionId,
        favelaId: favela.id,
        nextDueAt: new Date(now.getTime() + propinaPolicy.billingIntervalMs),
        nextPropinaValue: baseAmount,
        now,
        playerId: null,
      });

      if (!paid) {
        continue;
      }

      favela.propinaDiscountRate = 0;
      favela.propinaDueDate = new Date(now.getTime() + propinaPolicy.billingIntervalMs);
      favela.propinaLastPaidAt = now;
      favela.propinaNegotiatedAt = null;
      favela.propinaNegotiatedByPlayerId = null;
      favela.propinaValue = baseAmount;
    }

    if (syncUpdates.length > 0) {
      await this.options.repository.persistFavelaPropinaSync(syncUpdates);
    }

    return takeoverFavelaIds;
  }
}

export function buildFavelaPropinaSummary(
  favela: TerritoryFavelaRecord,
  now: Date,
) {
  if (favela.state !== 'controlled' || !favela.controllingFactionId) {
    return null;
  }

  const baseAmount = calculateFavelaPropinaBaseAmount(favela);
  const status = resolveFavelaPropinaStatus(favela.propinaDueDate, now);
  const currentAmount = roundCurrency(baseAmount * (1 - favela.propinaDiscountRate));
  const daysOverdue = calculateFavelaPropinaDaysOverdue(favela.propinaDueDate, now);

  return {
    baseAmount,
    canNegotiate:
      status !== 'state_takeover' &&
      favela.propinaDueDate !== null &&
      favela.propinaNegotiatedAt === null,
    currentAmount,
    daysOverdue,
    discountRate: favela.propinaDiscountRate,
    dueAt: favela.propinaDueDate?.toISOString() ?? null,
    lastPaidAt: favela.propinaLastPaidAt?.toISOString() ?? null,
    negotiatedAt: favela.propinaNegotiatedAt?.toISOString() ?? null,
    negotiatedByPlayerId: favela.propinaNegotiatedByPlayerId,
    revenuePenaltyMultiplier: resolveFavelaPropinaPenaltyMultiplier(status),
    status,
  };
}

function calculateFavelaPropinaBaseAmount(
  favela: Pick<TerritoryFavelaRecord, 'population' | 'regionId'>,
): number {
  const regionProfile = resolveCachedTerritoryPropinaRegionProfile(favela.regionId);
  return roundCurrency(favela.population * regionProfile.baseRatePerResident);
}

function buildInitialFavelaPropinaDueDate(
  favela: Pick<TerritoryFavelaRecord, 'stabilizationEndsAt'>,
  now: Date,
): Date {
  if (favela.stabilizationEndsAt && favela.stabilizationEndsAt.getTime() > now.getTime()) {
    return new Date(favela.stabilizationEndsAt);
  }

  return new Date(now.getTime() + resolveCachedTerritoryPropinaPolicy().initialNoticeMs);
}

function calculateFavelaPropinaDaysOverdue(dueDate: Date | null, now: Date): number {
  if (!dueDate || dueDate.getTime() > now.getTime()) {
    return 0;
  }

  return Math.floor((now.getTime() - dueDate.getTime()) / ONE_DAY_MS) + 1;
}

function resolveFavelaPropinaStatus(
  dueDate: Date | null,
  now: Date,
): FavelaPropinaStatus {
  const daysOverdue = calculateFavelaPropinaDaysOverdue(dueDate, now);

  if (daysOverdue >= 7) {
    return 'state_takeover';
  }

  if (daysOverdue >= 4) {
    return 'severe';
  }

  if (daysOverdue >= 1) {
    return 'warning';
  }

  return 'scheduled';
}

function resolveFavelaPropinaPenaltyMultiplier(status: FavelaPropinaStatus): number {
  const policy = resolveCachedTerritoryPropinaPolicy();
  switch (status) {
    case 'warning':
      return policy.warningRevenueMultiplier;
    case 'severe':
      return policy.severeRevenueMultiplier;
    case 'state_takeover':
      return 0;
    default:
      return 1;
  }
}

function resolveFavelaPropinaNegotiationDiscountRate(
  player: Pick<TerritoryPlayerRecord, 'carisma' | 'conceito' | 'rank' | 'vocation'>,
): number {
  let discountRate = 0.08 + Math.max(0, player.carisma) * 0.008;
  discountRate += Math.min(0.12, Math.max(0, player.conceito) / 120000);

  if (player.rank === 'patrao') {
    discountRate += 0.05;
  } else if (player.rank === 'general') {
    discountRate += 0.03;
  }

  if (player.vocation === VocationType.Politico) {
    discountRate += 0.08;
  }

  return roundMultiplier(clamp(discountRate, 0.05, 0.4));
}

function resolveFavelaPropinaNegotiationSuccessChance(
  player: Pick<TerritoryPlayerRecord, 'carisma' | 'conceito' | 'rank' | 'vocation'>,
): number {
  let chance = 0.28 + Math.max(0, player.carisma) * 0.018;
  chance += Math.min(0.15, Math.max(0, player.conceito) / 100000);

  if (player.rank === 'patrao') {
    chance += 0.12;
  } else if (player.rank === 'general') {
    chance += 0.08;
  }

  if (player.vocation === VocationType.Politico) {
    chance += 0.1;
  }

  return roundMultiplier(clamp(chance, 0.2, 0.95));
}

function resolveFavelaPropinaStateTakeoverDays(random: () => number): number {
  const policy = resolveCachedTerritoryPropinaPolicy();
  return (
    policy.stateTakeoverMinDays +
    Math.floor(
      random() * (policy.stateTakeoverMaxDays - policy.stateTakeoverMinDays + 1),
    )
  );
}

function shouldResetFavelaPropina(
  favela: Pick<
    TerritoryFavelaRecord,
    | 'propinaDiscountRate'
    | 'propinaDueDate'
    | 'propinaLastPaidAt'
    | 'propinaNegotiatedAt'
    | 'propinaNegotiatedByPlayerId'
    | 'propinaValue'
  >,
): boolean {
  return (
    favela.propinaDueDate !== null ||
    favela.propinaLastPaidAt !== null ||
    favela.propinaNegotiatedAt !== null ||
    favela.propinaNegotiatedByPlayerId !== null ||
    favela.propinaDiscountRate !== 0 ||
    favela.propinaValue !== 0
  );
}

function buildResetFavelaPropinaSyncUpdate(favelaId: string): TerritoryFavelaPropinaSyncUpdate {
  return {
    favelaId,
    nextDiscountRate: 0,
    nextDueDate: null,
    nextLastPaidAt: null,
    nextNegotiatedAt: null,
    nextNegotiatedByPlayerId: null,
    nextPropinaValue: 0,
  };
}

function applyFavelaPropinaSyncUpdate(
  favela: TerritoryFavelaRecord,
  update: TerritoryFavelaPropinaSyncUpdate,
): void {
  favela.propinaDiscountRate = update.nextDiscountRate;
  favela.propinaDueDate = update.nextDueDate ? new Date(update.nextDueDate) : null;
  favela.propinaLastPaidAt = update.nextLastPaidAt ? new Date(update.nextLastPaidAt) : null;
  favela.propinaNegotiatedAt = update.nextNegotiatedAt ? new Date(update.nextNegotiatedAt) : null;
  favela.propinaNegotiatedByPlayerId = update.nextNegotiatedByPlayerId;
  favela.propinaValue = update.nextPropinaValue;
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
