import type {
  FavelaControlState,
  FavelaFactionSummary,
  RegionId,
  TerritoryBossSummary,
  TerritoryFavelaSummary,
  TerritoryLossCause,
  TerritoryLossCueSummary,
  TerritoryOverviewResponse,
  TerritoryRegionSummary,
} from '@cs-rio/shared';

import { buildStabilizationEndsAt } from './combat.js';
import {
  TerritoryError,
  type TerritoryFactionRecord,
  type TerritoryFavelaRecord,
  type TerritoryFavelaStateUpdateInput,
} from './types.js';

export type TerritoryResolvedFavela = TerritoryFavelaSummary;

export interface TerritoryLossSnapshot {
  controllingFactionId: string | null;
  favelaId: string;
  favelaName: string;
  regionId: RegionId;
  state: FavelaControlState;
}

export interface TerritoryLossEmissionInput {
  after: TerritoryLossSnapshot[];
  before: TerritoryLossSnapshot[];
  causeByFavelaId: Map<string, TerritoryLossCause>;
  factionRecordsById: Map<string, TerritoryFactionRecord>;
  occurredAt: Date;
}

export function buildTerritoryLossStoreKey(
  prefix: string,
  factionId: string,
): string {
  return `${prefix}${factionId}`;
}

export function parseTerritoryLossCueSummaries(raw: string | null): TerritoryLossCueSummary[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTerritoryLossCueSummary);
  } catch {
    return [];
  }
}

export function toTerritoryLossSnapshot(favela: TerritoryResolvedFavela): TerritoryLossSnapshot {
  return {
    controllingFactionId: favela.controllingFaction?.id ?? null,
    favelaId: favela.id,
    favelaName: favela.name,
    regionId: favela.regionId,
    state: favela.state,
  };
}

export function toTerritoryLossSnapshotFromRecord(
  favela: TerritoryFavelaRecord,
): TerritoryLossSnapshot {
  return {
    controllingFactionId: favela.controllingFactionId,
    favelaId: favela.id,
    favelaName: favela.name,
    regionId: favela.regionId,
    state: favela.state,
  };
}

export function collectTerritoryLossFactionIds(
  before: TerritoryLossSnapshot[],
  after: TerritoryLossSnapshot[],
): Set<string> {
  const factionIds = new Set<string>();

  for (const snapshot of [...before, ...after]) {
    if (snapshot.controllingFactionId) {
      factionIds.add(snapshot.controllingFactionId);
    }
  }

  return factionIds;
}

export function buildTerritoryLossCueSummary(input: {
  after: TerritoryLossSnapshot[];
  afterFavela: TerritoryLossSnapshot;
  before: TerritoryLossSnapshot[];
  beforeFavela: TerritoryLossSnapshot;
  cause: TerritoryLossCause;
  factionRecordsById: Map<string, TerritoryFactionRecord>;
  occurredAt: Date;
}): TerritoryLossCueSummary {
  const lostByFactionId = input.beforeFavela.controllingFactionId as string;
  const lostByFactionAbbreviation =
    input.factionRecordsById.get(lostByFactionId)?.abbreviation ?? null;
  const newControllerFactionId = input.afterFavela.controllingFactionId;
  const newControllerFactionAbbreviation = resolveTerritoryLossControllerAbbreviation(
    input.afterFavela,
    input.factionRecordsById,
  );
  const newControllerLabel = newControllerFactionAbbreviation ?? 'sem facção';
  const beforeControlledCount = countFactionControlledFavelas(input.before, lostByFactionId);
  const afterControlledCount = countFactionControlledFavelas(input.after, lostByFactionId);
  const beforeRegionCount = countFactionControlledFavelasInRegion(
    input.before,
    lostByFactionId,
    input.beforeFavela.regionId,
  );
  const afterRegionCount = countFactionControlledFavelasInRegion(
    input.after,
    lostByFactionId,
    input.beforeFavela.regionId,
  );

  return {
    body: resolveTerritoryLossBody({
      cause: input.cause,
      favelaName: input.beforeFavela.favelaName,
      lostByFactionAbbreviation,
      newControllerLabel,
    }),
    cause: input.cause,
    economicImpact: resolveTerritoryLossEconomicImpact({
      cause: input.cause,
      favelaName: input.beforeFavela.favelaName,
    }),
    favelaId: input.beforeFavela.favelaId,
    favelaName: input.beforeFavela.favelaName,
    key: [
      'territory-loss',
      input.cause,
      input.beforeFavela.favelaId,
      lostByFactionId,
      newControllerFactionId ?? input.afterFavela.state,
      input.occurredAt.toISOString(),
    ].join(':'),
    lostByFactionAbbreviation,
    lostByFactionId,
    newControllerFactionAbbreviation,
    newControllerFactionId,
    occurredAt: input.occurredAt.toISOString(),
    politicalImpact: resolveTerritoryLossPoliticalImpact({
      afterControlledCount,
      beforeControlledCount,
      cause: input.cause,
      lostByFactionAbbreviation,
    }),
    regionId: input.beforeFavela.regionId,
    territorialImpact: resolveTerritoryLossTerritorialImpact({
      afterControlledCount,
      afterRegionCount,
      beforeControlledCount,
      beforeRegionCount,
      favelaName: input.beforeFavela.favelaName,
      newControllerLabel,
    }),
    title: resolveTerritoryLossTitle(input.cause, input.beforeFavela.favelaName),
  };
}

export function assertFavelaCanBeConquered(
  favela: TerritoryResolvedFavela,
  actorFactionId: string,
): void {
  if (favela.state === 'state') {
    throw new TerritoryError(
      'invalid_transition',
      'A favela esta sob controle do Estado e precisa voltar ao estado neutro antes de nova conquista.',
    );
  }

  if (favela.state === 'at_war') {
    throw new TerritoryError('invalid_transition', 'A favela ja esta em guerra e nao aceita conquista neutra.');
  }

  if (favela.controllingFaction?.id === actorFactionId) {
    throw new TerritoryError('invalid_transition', 'Sua faccao ja controla essa favela.');
  }

  if (favela.controllingFaction) {
    throw new TerritoryError(
      'invalid_transition',
      'Favela controlada por rival exige guerra de faccao; use a declaracao de guerra.',
    );
  }

  if (favela.state !== 'neutral') {
    throw new TerritoryError('invalid_transition', 'Somente favelas neutras podem ser conquistadas neste fluxo.');
  }
}

export function resolveFavelaTransition(input: {
  action: 'attacker_win' | 'declare_war' | 'defender_hold';
  actorFactionId: string;
  favela: TerritoryResolvedFavela;
  now: Date;
  stabilizationHours: number;
}): TerritoryFavelaStateUpdateInput {
  const { action, actorFactionId, favela, now } = input;

  if (action === 'declare_war') {
    if (favela.state === 'state') {
      throw new TerritoryError('invalid_transition', 'A favela esta sob controle do Estado e nao pode entrar em guerra agora.');
    }

    if (favela.state === 'at_war') {
      throw new TerritoryError('invalid_transition', 'A favela ja esta em guerra.');
    }

    if (favela.controllingFaction?.id === actorFactionId) {
      throw new TerritoryError('invalid_transition', 'Sua faccao ja controla essa favela.');
    }

    return {
      contestingFactionId: actorFactionId,
      controllingFactionId: favela.controllingFaction?.id ?? null,
      stabilizationEndsAt: null,
      state: 'at_war',
      stateControlledUntil: null,
      warDeclaredAt: now,
    };
  }

  if (action === 'attacker_win') {
    if (favela.state !== 'at_war' || !favela.contestingFaction) {
      throw new TerritoryError('invalid_transition', 'Nao existe guerra ativa para resolver com vitoria do atacante.');
    }

    if (favela.contestingFaction.id !== actorFactionId) {
      throw new TerritoryError('forbidden', 'Somente a faccao atacante pode confirmar a propria vitoria.');
    }

    return {
      contestingFactionId: null,
      controllingFactionId: actorFactionId,
      stabilizationEndsAt: buildStabilizationEndsAt(now, input.stabilizationHours),
      state: 'controlled',
      stateControlledUntil: null,
      warDeclaredAt: null,
    };
  }

  if (action === 'defender_hold') {
    if (favela.state !== 'at_war' || !favela.contestingFaction) {
      throw new TerritoryError('invalid_transition', 'Nao existe guerra ativa para encerrar com defesa bem-sucedida.');
    }

    const canResolve =
      favela.controllingFaction?.id === actorFactionId ||
      (favela.controllingFaction === null && favela.contestingFaction.id === actorFactionId);

    if (!canResolve) {
      throw new TerritoryError('forbidden', 'Sua faccao nao pode encerrar essa guerra como defesa bem-sucedida.');
    }

    return {
      contestingFactionId: null,
      controllingFactionId: favela.controllingFaction?.id ?? null,
      stabilizationEndsAt: null,
      state: favela.controllingFaction ? 'controlled' : 'neutral',
      stateControlledUntil: null,
      warDeclaredAt: null,
    };
  }

  throw new TerritoryError('validation', 'Acao de state machine desconhecida.');
}

export function syncFavelaState(
  favela: TerritoryFavelaRecord,
  now: Date,
): {
  changed: boolean;
  nextState: TerritoryFavelaStateUpdateInput;
} {
  if (favela.state === 'state' && favela.stateControlledUntil && favela.stateControlledUntil <= now) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: null,
        controllingFactionId: null,
        stabilizationEndsAt: null,
        state: 'neutral',
        stateControlledUntil: null,
        warDeclaredAt: null,
      },
    };
  }

  if (favela.state === 'controlled' && !favela.controllingFactionId) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: null,
        controllingFactionId: null,
        stabilizationEndsAt: null,
        state: 'neutral',
        stateControlledUntil: null,
        warDeclaredAt: null,
      },
    };
  }

  if (favela.state === 'neutral' && favela.controllingFactionId) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: null,
        controllingFactionId: favela.controllingFactionId,
        stabilizationEndsAt: favela.stabilizationEndsAt,
        state: 'controlled',
        stateControlledUntil: null,
        warDeclaredAt: null,
      },
    };
  }

  if (favela.state === 'at_war' && !favela.contestingFactionId) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: null,
        controllingFactionId: favela.controllingFactionId,
        stabilizationEndsAt: null,
        state: favela.controllingFactionId ? 'controlled' : 'neutral',
        stateControlledUntil: null,
        warDeclaredAt: null,
      },
    };
  }

  if (favela.state !== 'controlled' && favela.stabilizationEndsAt) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: favela.contestingFactionId,
        controllingFactionId: favela.controllingFactionId,
        stabilizationEndsAt: null,
        state: favela.state,
        stateControlledUntil: favela.stateControlledUntil,
        warDeclaredAt: favela.warDeclaredAt,
      },
    };
  }

  if (favela.state === 'controlled' && favela.stabilizationEndsAt && favela.stabilizationEndsAt <= now) {
    return {
      changed: true,
      nextState: {
        contestingFactionId: favela.contestingFactionId,
        controllingFactionId: favela.controllingFactionId,
        stabilizationEndsAt: null,
        state: 'controlled',
        stateControlledUntil: favela.stateControlledUntil,
        warDeclaredAt: favela.warDeclaredAt,
      },
    };
  }

  return {
    changed: false,
    nextState: {
      contestingFactionId: favela.contestingFactionId,
      controllingFactionId: favela.controllingFactionId,
      stabilizationEndsAt: favela.stabilizationEndsAt,
      state: favela.state,
      stateControlledUntil: favela.stateControlledUntil,
      warDeclaredAt: favela.warDeclaredAt,
    },
  };
}

export function buildTerritoryBossSummary(
  favela: Pick<TerritoryResolvedFavela, 'difficulty' | 'name' | 'population'>,
): TerritoryBossSummary {
  return {
    difficulty: favela.difficulty,
    label: `Chefe local de ${favela.name}`,
    power: Math.round(2500 + favela.difficulty * 1000 + favela.population * 0.12),
  };
}

export function buildTerritoryConquestMessage(
  favelaName: string,
  success: boolean,
): string {
  if (success) {
    return `O bonde tomou ${favelaName} e iniciou a estabilizacao do territorio.`;
  }

  return `A invasao em ${favelaName} falhou e o bonde recuou.`;
}

export function buildTerritoryOverview(
  playerFactionId: string | null,
  favelasList: TerritoryResolvedFavela[],
): TerritoryOverviewResponse {
  const regionMap = new Map<RegionId, TerritoryRegionSummary & { factionControlCounts: Map<string, number> }>();

  for (const favela of favelasList) {
    const regionEntry = regionMap.get(favela.regionId) ?? {
      atWarFavelas: 0,
      controlledFavelas: 0,
      dominantFaction: null,
      factionControlCounts: new Map<string, number>(),
      neutralFavelas: 0,
      playerFactionControlledFavelas: 0,
      regionId: favela.regionId,
      stateControlledFavelas: 0,
      totalFavelas: 0,
    };

    regionEntry.totalFavelas += 1;

    if (favela.state === 'neutral') {
      regionEntry.neutralFavelas += 1;
    }

    if (favela.state === 'at_war') {
      regionEntry.atWarFavelas += 1;
    }

    if (favela.state === 'state') {
      regionEntry.stateControlledFavelas += 1;
    }

    if (favela.controllingFaction) {
      regionEntry.controlledFavelas += 1;
      regionEntry.factionControlCounts.set(
        favela.controllingFaction.id,
        (regionEntry.factionControlCounts.get(favela.controllingFaction.id) ?? 0) + 1,
      );

      if (favela.controllingFaction.id === playerFactionId) {
        regionEntry.playerFactionControlledFavelas += 1;
      }
    }

    regionMap.set(favela.regionId, regionEntry);
  }

  const regions = [...regionMap.values()]
    .map(({ factionControlCounts, ...region }) => {
      let dominantFaction: FavelaFactionSummary | null = null;
      let dominantCount = 0;

      for (const favela of favelasList) {
        if (favela.regionId !== region.regionId || !favela.controllingFaction) {
          continue;
        }

        const controlCount = factionControlCounts.get(favela.controllingFaction.id) ?? 0;

        if (controlCount > dominantCount) {
          dominantCount = controlCount;
          dominantFaction = favela.controllingFaction;
        }
      }

      return {
        ...region,
        dominantFaction,
      };
    })
    .sort((left, right) => left.regionId.localeCompare(right.regionId));

  return {
    favelas: [...favelasList].sort((left, right) => {
      if (left.regionId !== right.regionId) {
        return left.regionId.localeCompare(right.regionId);
      }

      return left.name.localeCompare(right.name, 'pt-BR');
    }),
    playerFactionId,
    regions,
  };
}

function isTerritoryLossCueSummary(value: unknown): value is TerritoryLossCueSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const cue = value as Partial<TerritoryLossCueSummary>;

  return (
    typeof cue.body === 'string' &&
    typeof cue.cause === 'string' &&
    typeof cue.economicImpact === 'string' &&
    typeof cue.favelaId === 'string' &&
    typeof cue.favelaName === 'string' &&
    typeof cue.key === 'string' &&
    typeof cue.lostByFactionId === 'string' &&
    typeof cue.occurredAt === 'string' &&
    typeof cue.politicalImpact === 'string' &&
    typeof cue.regionId === 'string' &&
    typeof cue.territorialImpact === 'string' &&
    typeof cue.title === 'string'
  );
}

function countFactionControlledFavelas(
  snapshots: TerritoryLossSnapshot[],
  factionId: string,
): number {
  return snapshots.filter((favela) => favela.controllingFactionId === factionId).length;
}

function countFactionControlledFavelasInRegion(
  snapshots: TerritoryLossSnapshot[],
  factionId: string,
  regionId: RegionId,
): number {
  return snapshots.filter(
    (favela) =>
      favela.regionId === regionId && favela.controllingFactionId === factionId,
  ).length;
}

function resolveTerritoryLossControllerAbbreviation(
  favela: TerritoryLossSnapshot,
  factionRecordsById: Map<string, TerritoryFactionRecord>,
): string | null {
  if (favela.controllingFactionId) {
    return factionRecordsById.get(favela.controllingFactionId)?.abbreviation ?? 'Rival';
  }

  if (favela.state === 'state') {
    return 'Estado';
  }

  return null;
}

function resolveTerritoryLossTitle(
  cause: TerritoryLossCause,
  favelaName: string,
): string {
  if (cause === 'war_defeat') {
    return `${favelaName}: guerra perdida`;
  }

  if (cause === 'state_takeover') {
    return `${favelaName}: tomada estatal`;
  }

  return `${favelaName}: controle perdido`;
}

function resolveTerritoryLossBody(input: {
  cause: TerritoryLossCause;
  favelaName: string;
  lostByFactionAbbreviation: string | null;
  newControllerLabel: string;
}): string {
  const lostByLabel = input.lostByFactionAbbreviation ?? 'Sua facção';

  if (input.cause === 'war_defeat') {
    return `${lostByLabel} perdeu ${input.favelaName} na guerra. Controle agora com ${input.newControllerLabel}.`;
  }

  if (input.cause === 'state_takeover') {
    return `${input.favelaName} foi tomada pelo Estado por inadimplência prolongada. ${lostByLabel} perdeu a área.`;
  }

  return `${lostByLabel} perdeu ${input.favelaName}. Controle atual: ${input.newControllerLabel}.`;
}

function resolveTerritoryLossTerritorialImpact(input: {
  afterControlledCount: number;
  afterRegionCount: number;
  beforeControlledCount: number;
  beforeRegionCount: number;
  favelaName: string;
  newControllerLabel: string;
}): string {
  return `${input.favelaName} saiu do seu domínio e passou para ${input.newControllerLabel}. Controle total da facção caiu de ${input.beforeControlledCount} para ${input.afterControlledCount} favelas; na região, caiu de ${input.beforeRegionCount} para ${input.afterRegionCount}.`;
}

function resolveTerritoryLossEconomicImpact(input: {
  cause: TerritoryLossCause;
  favelaName: string;
}): string {
  if (input.cause === 'state_takeover') {
    return `Receitas, serviços e caixa territorial ligados a ${input.favelaName} ficaram travados sob pressão estatal até nova retomada.`;
  }

  return `Receitas e serviços dependentes do controle de ${input.favelaName} saem da sua mão até a facção recuperar a área.`;
}

function resolveTerritoryLossPoliticalImpact(input: {
  afterControlledCount: number;
  beforeControlledCount: number;
  cause: TerritoryLossCause;
  lostByFactionAbbreviation: string | null;
}): string {
  const lostByLabel = input.lostByFactionAbbreviation ?? 'Sua facção';

  if (input.cause === 'state_takeover') {
    return `A tomada estatal expõe fraqueza administrativa e amplia a pressão política sobre ${lostByLabel}.`;
  }

  if (input.afterControlledCount <= 0) {
    return `${lostByLabel} ficou sem presença territorial ativa. A moral e a capacidade de pressão na rua despencam.`;
  }

  return `${lostByLabel} perdeu presença territorial: ${input.beforeControlledCount} -> ${input.afterControlledCount} favelas sob comando.`;
}
