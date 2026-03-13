import { type FavelaControlState } from '@cs-rio/shared';

export const FAVELA_FORCE_GAME_DAY_MS = 6 * 60 * 60 * 1000;
export const FAVELA_BANDIT_RETURN_MIN_DAYS = 5;
export const FAVELA_BANDIT_RETURN_MAX_DAYS = 30;

export type BanditReturnFlavor =
  | 'audiencia_custodia'
  | 'habeas_corpus'
  | 'lili_cantou';

interface FavelaForceSizingInput {
  difficulty: number;
  population: number;
}

interface FavelaBanditTargetInput extends FavelaForceSizingInput {
  baseBanditTarget?: number | null;
  internalSatisfaction: number | null;
  state: FavelaControlState;
}

interface FavelaBanditSyncInput {
  active: number;
  deadRecent: number;
  lastSyncedAt: Date;
  now: Date;
  returnedNow: number;
  targetActive: number;
}

interface BanditReturnScheduleInput {
  now: Date;
  quantity: number;
  random: () => number;
}

export interface BanditReturnSchedule {
  detentionDays: number;
  flavor: BanditReturnFlavor;
  releaseAt: Date;
}

export interface FavelaBanditSyncResult {
  active: number;
  changed: boolean;
  deadRecent: number;
  elapsedGameDays: number;
  syncedAt: Date;
}

export function resolveFavelaSoldierCap(input: FavelaForceSizingInput): number {
  if (input.population >= 80000 || input.difficulty >= 10) {
    return 80;
  }

  if (input.population >= 50000 || input.difficulty >= 9) {
    return 65;
  }

  if (input.population >= 30000 || input.difficulty >= 8) {
    return 50;
  }

  if (input.population >= 15000 || input.difficulty >= 7) {
    return 36;
  }

  if (input.population >= 8000 || input.difficulty >= 6) {
    return 28;
  }

  return 18;
}

export function resolveFavelaBaseBanditTarget(input: FavelaForceSizingInput): number {
  const soldierCap = resolveFavelaSoldierCap(input);

  if (soldierCap >= 80) {
    return 110;
  }

  if (soldierCap >= 65) {
    return 88;
  }

  if (soldierCap >= 50) {
    return 68;
  }

  if (soldierCap >= 36) {
    return 50;
  }

  if (soldierCap >= 28) {
    return 38;
  }

  return 26;
}

export function resolveFavelaBanditTarget(input: FavelaBanditTargetInput): number {
  const baseTarget =
    typeof input.baseBanditTarget === 'number' && Number.isFinite(input.baseBanditTarget)
      ? Math.max(0, Math.round(input.baseBanditTarget))
      : resolveFavelaBaseBanditTarget(input);
  const satisfactionMultiplier = resolveInternalSatisfactionMultiplier(input.internalSatisfaction);
  const stateMultiplier = resolveFavelaBanditStateMultiplier(input.state);

  return Math.max(0, Math.round(baseTarget * satisfactionMultiplier * stateMultiplier));
}

export function buildBanditReturnSchedule(input: BanditReturnScheduleInput): BanditReturnSchedule {
  const detentionDays =
    FAVELA_BANDIT_RETURN_MIN_DAYS +
    Math.floor(
      input.random() * (FAVELA_BANDIT_RETURN_MAX_DAYS - FAVELA_BANDIT_RETURN_MIN_DAYS + 1),
    );

  return {
    detentionDays,
    flavor: resolveBanditReturnFlavor(detentionDays),
    releaseAt: new Date(input.now.getTime() + detentionDays * FAVELA_FORCE_GAME_DAY_MS),
  };
}

export function resolveBanditReturnFlavor(days: number): BanditReturnFlavor {
  if (days <= 10) {
    return 'audiencia_custodia';
  }

  if (days <= 20) {
    return 'habeas_corpus';
  }

  return 'lili_cantou';
}

export function buildBanditReturnHeadline(flavor: BanditReturnFlavor, favelaName: string): string {
  switch (flavor) {
    case 'audiencia_custodia':
      return `Audiência de custódia! Os bandidos presos no assalto foram soltos e voltaram para ${favelaName}.`;
    case 'habeas_corpus':
      return `Habeas Corpus! Os bandidos presos no assalto foram soltos e voltaram para ${favelaName}.`;
    default:
      return `Lili cantou! Os bandidos presos no assalto foram soltos e voltaram para ${favelaName}.`;
  }
}

export function syncFavelaBanditPool(input: FavelaBanditSyncInput): FavelaBanditSyncResult {
  let active = Math.max(0, input.active + input.returnedNow);
  let deadRecent = Math.max(0, input.deadRecent);
  const elapsedGameDays = Math.max(
    0,
    Math.floor((input.now.getTime() - input.lastSyncedAt.getTime()) / FAVELA_FORCE_GAME_DAY_MS),
  );

  if (elapsedGameDays === 0) {
    return {
      active,
      changed: input.returnedNow > 0,
      deadRecent,
      elapsedGameDays: 0,
      syncedAt: input.returnedNow > 0 ? input.now : input.lastSyncedAt,
    };
  }

  for (let index = 0; index < elapsedGameDays; index += 1) {
    if (active < input.targetActive) {
      const growth = Math.min(
        input.targetActive - active,
        Math.max(2, Math.round(input.targetActive * 0.08)),
      );
      active += growth;
      deadRecent = Math.max(0, deadRecent - growth);
      continue;
    }

    if (active > input.targetActive) {
      const decay = Math.min(
        active - input.targetActive,
        Math.max(1, Math.round(active * 0.05)),
      );
      active = Math.max(0, active - decay);
      continue;
    }

    if (deadRecent > 0) {
      deadRecent = Math.max(0, deadRecent - Math.max(1, Math.round(input.targetActive * 0.03)));
    }
  }

  return {
    active,
    changed: active !== input.active || deadRecent !== input.deadRecent || input.returnedNow > 0,
    deadRecent,
    elapsedGameDays,
    syncedAt: new Date(input.lastSyncedAt.getTime() + elapsedGameDays * FAVELA_FORCE_GAME_DAY_MS),
  };
}

function resolveInternalSatisfactionMultiplier(value: number | null): number {
  if (value === null) {
    return 1;
  }

  if (value <= 25) {
    return 0.72;
  }

  if (value <= 40) {
    return 0.86;
  }

  if (value <= 60) {
    return 1;
  }

  if (value <= 80) {
    return 1.08;
  }

  return 1.16;
}

function resolveFavelaBanditStateMultiplier(state: FavelaControlState): number {
  switch (state) {
    case 'controlled':
      return 1;
    case 'at_war':
      return 0.78;
    case 'state':
      return 0.22;
    default:
      return 0.55;
  }
}
