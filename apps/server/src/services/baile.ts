import type {
  FavelaBaileMcTier,
  FavelaBaileOrganizeInput,
  FavelaBaileOrganizeResponse,
  FavelaBaileResultTier,
  FavelaBaileStatus,
  FavelaBaileStatusResponse,
  FavelaBaileSummary,
  TerritoryFavelaSummary,
  TerritoryOverviewResponse,
} from '@cs-rio/shared';

import { roundCurrency } from './territory/shared.js';
import {
  TerritoryError,
  type TerritoryBaileDomainRepository,
  type TerritoryFavelaBaileRecord,
  type TerritoryPlayerRecord,
} from './territory/types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BAILE_COOLDOWN_MS = 3 * ONE_DAY_MS;
const BAILE_MIN_BUDGET = 10000;
const BAILE_MAX_BUDGET = 100000;

export interface BaileServiceOptions {
  assertFavelaManagementRank(rank: TerritoryPlayerRecord['rank']): Promise<void>;
  assertPlayerReady(playerId: string): Promise<TerritoryPlayerRecord>;
  buildTerritoryOverview(
    playerFactionId: string | null,
    favelasList: TerritoryFavelaSummary[],
  ): TerritoryOverviewResponse;
  now: () => Date;
  random: () => number;
  repository: TerritoryBaileDomainRepository;
  syncAndListFavelas(): Promise<TerritoryFavelaSummary[]>;
}

export class BaileService {
  constructor(private readonly options: BaileServiceOptions) {}

  async getFavelaBaile(playerId: string, favelaId: string): Promise<FavelaBaileStatusResponse> {
    const player = await this.options.assertPlayerReady(playerId);
    const overview = this.options.buildTerritoryOverview(
      player.factionId,
      await this.options.syncAndListFavelas(),
    );
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    return {
      ...overview,
      baile: buildFavelaBaileSummary(
        selectLatestBaileByFavela(await this.options.repository.listLatestBailes([favelaId])).get(favelaId) ??
          null,
        this.options.now(),
      ),
      favela,
    };
  }

  async organizeFavelaBaile(
    playerId: string,
    favelaId: string,
    input: FavelaBaileOrganizeInput,
  ): Promise<FavelaBaileOrganizeResponse> {
    const player = await this.options.assertPlayerReady(playerId);

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para organizar baile.');
    }

    await this.options.assertFavelaManagementRank(player.rank);

    if (player.level < 8) {
      throw new TerritoryError('forbidden', 'Nivel 8 ou superior e obrigatorio para organizar baile.');
    }

    const budget = roundCurrency(Number(input.budget));
    const entryPrice = roundCurrency(Number(input.entryPrice));
    const mcTier = requireFavelaBaileMcTier(input.mcTier);

    if (!Number.isFinite(budget) || budget < BAILE_MIN_BUDGET || budget > BAILE_MAX_BUDGET) {
      throw new TerritoryError(
        'validation',
        `O budget do baile deve ficar entre ${BAILE_MIN_BUDGET} e ${BAILE_MAX_BUDGET}.`,
      );
    }

    if (!Number.isFinite(entryPrice) || entryPrice < 0 || entryPrice > 10000) {
      throw new TerritoryError('validation', 'O preco de entrada do baile e invalido.');
    }

    const overviewBefore = this.options.buildTerritoryOverview(
      player.factionId,
      await this.options.syncAndListFavelas(),
    );
    const favelaBefore = overviewBefore.favelas.find((entry) => entry.id === favelaId);

    if (!favelaBefore) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favelaBefore.state !== 'controlled' || favelaBefore.controllingFaction?.id !== player.factionId) {
      throw new TerritoryError('conflict', 'Sua faccao precisa controlar a favela para organizar o baile.');
    }

    const latestBaile =
      selectLatestBaileByFavela(await this.options.repository.listLatestBailes([favelaId])).get(favelaId) ??
      null;
    const currentBaileStatus = buildFavelaBaileSummary(latestBaile, this.options.now());

    if (currentBaileStatus.status !== 'ready') {
      throw new TerritoryError('conflict', 'A favela ainda esta em cooldown ou com baile ativo.');
    }

    const outcome = resolveFavelaBaileOutcome({
      budget,
      entryPrice,
      mcTier,
      random: this.options.random,
      satisfaction: favelaBefore.satisfaction,
    });
    const organizedAt = this.options.now();
    const activeEndsAt = resolveFavelaBaileActiveEndsAt(organizedAt, outcome.resultTier, mcTier);
    const hangoverEndsAt = resolveFavelaBaileHangoverEndsAt(activeEndsAt, organizedAt, outcome.resultTier);
    const cooldownEndsAt = new Date(organizedAt.getTime() + BAILE_COOLDOWN_MS);
    const satisfactionAfter = clamp(favelaBefore.satisfaction + outcome.satisfactionDelta, 0, 100);

    const baileRecord = await this.options.repository.organizeFavelaBaile({
      activeEndsAt,
      budget,
      cooldownEndsAt,
      entryPrice,
      factionId: player.factionId,
      factionPointsDelta: outcome.factionPointsDelta,
      favelaId,
      favelaName: favelaBefore.name,
      hangoverEndsAt,
      incidentCode: outcome.incidentCode,
      mcTier,
      organizedAt,
      organizedByPlayerId: player.id,
      regionId: favelaBefore.regionId,
      resultTier: outcome.resultTier,
      satisfactionAfter,
      satisfactionDelta: outcome.satisfactionDelta,
      cansacoBoostPercent: outcome.cansacoBoostPercent,
    });

    const overview = this.options.buildTerritoryOverview(
      player.factionId,
      await this.options.syncAndListFavelas(),
    );
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada apos organizar o baile.');
    }

    return {
      ...overview,
      baile: buildFavelaBaileSummary(baileRecord, organizedAt),
      favela,
      message: buildFavelaBaileMessage(favela.name, outcome.resultTier),
    };
  }
}

export function buildFavelaBaileSummary(
  record: TerritoryFavelaBaileRecord | null,
  now: Date,
): FavelaBaileSummary {
  if (!record) {
    return {
      activeEndsAt: null,
      budget: null,
      cooldownEndsAt: null,
      entryPrice: null,
      factionPointsDelta: null,
      hangoverEndsAt: null,
      incidentCode: null,
      lastOrganizedAt: null,
      mcTier: null,
      resultTier: null,
      satisfactionDelta: null,
      cansacoBoostPercent: null,
      status: 'ready',
    };
  }

  return {
    activeEndsAt: record.activeEndsAt?.toISOString() ?? null,
    budget: record.budget,
    cooldownEndsAt: record.cooldownEndsAt.toISOString(),
    entryPrice: record.entryPrice,
    factionPointsDelta: record.factionPointsDelta,
    hangoverEndsAt: record.hangoverEndsAt?.toISOString() ?? null,
    incidentCode: record.incidentCode,
    lastOrganizedAt: record.organizedAt.toISOString(),
    mcTier: record.mcTier,
    resultTier: record.resultTier,
    satisfactionDelta: record.satisfactionDelta,
    cansacoBoostPercent: record.cansacoBoostPercent,
    status: resolveFavelaBaileStatus(record, now),
  };
}

function requireFavelaBaileMcTier(value: string): FavelaBaileMcTier {
  if (value === 'local' || value === 'regional' || value === 'estelar') {
    return value;
  }

  throw new TerritoryError('validation', 'MC do baile invalido.');
}

function resolveFavelaBaileMcTierMultiplier(mcTier: FavelaBaileMcTier): number {
  switch (mcTier) {
    case 'regional':
      return 1.08;
    case 'estelar':
      return 1.15;
    default:
      return 1;
  }
}

function resolveFavelaBaileOutcome(input: {
  budget: number;
  entryPrice: number;
  mcTier: FavelaBaileMcTier;
  random: () => number;
  satisfaction: number;
}): {
  factionPointsDelta: number;
  incidentCode: string | null;
  resultTier: FavelaBaileResultTier;
  satisfactionDelta: number;
  cansacoBoostPercent: number;
} {
  const mcMultiplier = resolveFavelaBaileMcTierMultiplier(input.mcTier);
  const budgetMultiplier = clamp(input.budget / 50000, 0.75, 1.2);
  const priceyEntry = input.entryPrice >= 3500;

  if (input.satisfaction > 70) {
    return {
      factionPointsDelta: Math.round(500 * mcMultiplier * budgetMultiplier),
      incidentCode: priceyEntry ? 'fila_cara' : null,
      resultTier: 'total_success',
      satisfactionDelta: 20,
      cansacoBoostPercent: input.mcTier === 'estelar' ? 35 : 30,
    };
  }

  if (input.satisfaction >= 50) {
    return {
      factionPointsDelta: Math.round(300 * mcMultiplier * budgetMultiplier),
      incidentCode: priceyEntry ? 'fila_cara' : null,
      resultTier: 'success',
      satisfactionDelta: 15,
      cansacoBoostPercent: input.mcTier === 'estelar' ? 24 : 20,
    };
  }

  if (input.satisfaction >= 30) {
    return {
      factionPointsDelta: 0,
      incidentCode: priceyEntry ? 'fila_cara' : 'confusao_controlada',
      resultTier: 'mixed',
      satisfactionDelta: 5,
      cansacoBoostPercent: 0,
    };
  }

  return {
    factionPointsDelta: -200,
    incidentCode: input.random() < 0.5 ? 'briga_generalizada' : 'pm_na_porta',
    resultTier: 'failure',
    satisfactionDelta: -10,
    cansacoBoostPercent: 0,
  };
}

function resolveFavelaBaileActiveEndsAt(
  organizedAt: Date,
  resultTier: FavelaBaileResultTier,
  mcTier: FavelaBaileMcTier,
): Date | null {
  let hours = 0;

  if (resultTier === 'total_success') {
    hours = 12;
  } else if (resultTier === 'success') {
    hours = 8;
  }

  if (hours <= 0) {
    return null;
  }

  const multiplier = resolveFavelaBaileMcTierMultiplier(mcTier);
  return new Date(organizedAt.getTime() + Math.round(hours * multiplier) * 60 * 60 * 1000);
}

function resolveFavelaBaileHangoverEndsAt(
  activeEndsAt: Date | null,
  organizedAt: Date,
  resultTier: FavelaBaileResultTier,
): Date | null {
  const baseStart = activeEndsAt ?? organizedAt;

  switch (resultTier) {
    case 'total_success':
      return new Date(baseStart.getTime() + 6 * 60 * 60 * 1000);
    case 'success':
      return new Date(baseStart.getTime() + 4 * 60 * 60 * 1000);
    case 'failure':
      return new Date(baseStart.getTime() + 12 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function resolveFavelaBaileStatus(
  record: TerritoryFavelaBaileRecord | null,
  now: Date,
): FavelaBaileStatus {
  if (!record) {
    return 'ready';
  }

  if (record.activeEndsAt && record.activeEndsAt.getTime() > now.getTime()) {
    return 'active';
  }

  if (record.hangoverEndsAt && record.hangoverEndsAt.getTime() > now.getTime()) {
    return 'hangover';
  }

  if (record.cooldownEndsAt.getTime() > now.getTime()) {
    return 'cooldown';
  }

  return 'ready';
}

function buildFavelaBaileMessage(
  favelaName: string,
  resultTier: FavelaBaileResultTier,
): string {
  switch (resultTier) {
    case 'total_success':
      return `O baile em ${favelaName} foi um sucesso total e incendiou a regiao.`;
    case 'success':
      return `O baile em ${favelaName} foi um sucesso e fortaleceu a moral da favela.`;
    case 'mixed':
      return `O baile em ${favelaName} saiu morno, com retorno limitado e alguma tensao.`;
    default:
      return `O baile em ${favelaName} fracassou e deixou a favela instavel.`;
  }
}

function selectLatestBaileByFavela(
  records: TerritoryFavelaBaileRecord[],
): Map<string, TerritoryFavelaBaileRecord> {
  const map = new Map<string, TerritoryFavelaBaileRecord>();

  for (const record of [...records].sort((left, right) => right.organizedAt.getTime() - left.organizedAt.getTime())) {
    if (!map.has(record.favelaId)) {
      map.set(record.favelaId, record);
    }
  }

  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
