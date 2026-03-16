import {
  type FactionWarSide,
  type FactionWarStatus,
  type PlayerProfile,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import { formatTerritoryCurrency, resolveWarSideForPlayer } from './territory';

const RESOLVED_WAR_STATUSES = new Set<FactionWarStatus>([
  'attacker_won',
  'defender_won',
  'draw',
  'cancelled',
]);
const WAR_RESULT_MODAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WarResultPersonalImpact {
  conceitoDelta: number;
  directParticipation: boolean;
  hpLoss: number;
  label: string;
  disposicaoLoss: number;
  cansacoLoss: number;
}

export interface WarResultCue {
  body: string;
  endedAt: string | null;
  favelaId: string;
  favelaName: string;
  key: string;
  lootLabel: string;
  outcomeTone: 'danger' | 'info' | 'success' | 'warning';
  personalImpact: WarResultPersonalImpact;
  roundsLabel: string;
  scoreLabel: string;
  territorialImpact: string;
  title: string;
  winnerLabel: string;
}

export function buildPendingWarResultCues(input: {
  nowMs?: number;
  overview: TerritoryOverviewResponse;
  player: Pick<PlayerProfile, 'faction' | 'regionId'> | null | undefined;
  seenKeys: ReadonlySet<string>;
}): WarResultCue[] {
  if (!input.player?.faction?.id) {
    return [];
  }

  return input.overview.favelas
    .map((favela) => buildWarResultCue(favela, input.player, input.nowMs))
    .filter((cue): cue is WarResultCue => cue !== null)
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort((left, right) => {
      const leftMs = left.endedAt ? new Date(left.endedAt).getTime() : 0;
      const rightMs = right.endedAt ? new Date(right.endedAt).getTime() : 0;
      return rightMs - leftMs;
    });
}

export function buildWarResultCue(
  favela: TerritoryFavelaSummary,
  player: Pick<PlayerProfile, 'faction' | 'regionId'> | null | undefined,
  nowMs = Date.now(),
): WarResultCue | null {
  const war = favela.war;

  if (!war || !isResolvedWarStatus(war.status)) {
    return null;
  }

  if (!player?.faction?.id) {
    return null;
  }

  const side = resolveWarSideForPlayer(player.faction.id, war);

  if (!side) {
    return null;
  }

  if (!shouldSurfaceResolvedWar(war, nowMs)) {
    return null;
  }

  const winnerLabel = resolveWarWinnerLabel(favela);
  const territorialImpact = resolveTerritorialImpact(favela);
  const personalImpact = resolvePersonalImpact({
    favela,
    playerRegionId: player.regionId,
    side,
  });

  return {
    body: `${winnerLabel}. ${territorialImpact}`,
    endedAt: war.endedAt,
    favelaId: favela.id,
    favelaName: favela.name,
    key: buildWarResultSignature(favela),
    lootLabel: formatTerritoryCurrency(war.lootMoney),
    outcomeTone: resolveOutcomeTone(side, war.status),
    personalImpact,
    roundsLabel: `${war.roundsResolved}/${war.roundsTotal} rounds`,
    scoreLabel: `${war.attackerScore} x ${war.defenderScore}`,
    territorialImpact,
    title: `${favela.name}: ${winnerLabel}`,
    winnerLabel,
  };
}

export function buildWarResultSignature(favela: TerritoryFavelaSummary): string {
  const war = favela.war;

  if (!war) {
    return `war:none:${favela.id}`;
  }

  return [
    'war',
    war.id,
    war.status,
    war.endedAt ?? war.cooldownEndsAt ?? war.declaredAt,
  ].join(':');
}

export function isResolvedWarStatus(status: FactionWarStatus): boolean {
  return RESOLVED_WAR_STATUSES.has(status);
}

function shouldSurfaceResolvedWar(
  war: NonNullable<TerritoryFavelaSummary['war']>,
  nowMs: number,
): boolean {
  if (war.cooldownEndsAt && new Date(war.cooldownEndsAt).getTime() > nowMs) {
    return true;
  }

  if (!war.endedAt) {
    return true;
  }

  return nowMs - new Date(war.endedAt).getTime() <= WAR_RESULT_MODAL_WINDOW_MS;
}

function resolveWarWinnerLabel(favela: TerritoryFavelaSummary): string {
  const war = favela.war;

  if (!war) {
    return 'Sem guerra';
  }

  if (war.status === 'cancelled') {
    return 'Guerra cancelada';
  }

  if (war.status === 'draw') {
    return 'Empate';
  }

  if (war.status === 'attacker_won') {
    return `${war.attackerFaction.abbreviation} venceu`;
  }

  if (war.status === 'defender_won') {
    return `${war.defenderFaction.abbreviation} segurou`;
  }

  return 'Guerra em aberto';
}

function resolveTerritorialImpact(favela: TerritoryFavelaSummary): string {
  const war = favela.war;

  if (!war) {
    return 'Sem impacto territorial.';
  }

  if (war.status === 'attacker_won') {
    return `${war.attackerFaction.abbreviation} tomou ${favela.name} e o controle territorial mudou de mãos.`;
  }

  if (war.status === 'defender_won') {
    return `${war.defenderFaction.abbreviation} manteve ${favela.name} sob controle e conteve a invasão.`;
  }

  if (war.status === 'draw') {
    return `${war.defenderFaction.abbreviation} segurou ${favela.name} no empate, sem troca de controle.`;
  }

  return `A guerra por ${favela.name} foi encerrada antes do desfecho final.`;
}

function resolvePersonalImpact(input: {
  favela: TerritoryFavelaSummary;
  playerRegionId: PlayerProfile['regionId'];
  side: FactionWarSide;
}): WarResultPersonalImpact {
  const war = input.favela.war;

  if (!war) {
    return {
      conceitoDelta: 0,
      directParticipation: false,
      hpLoss: 0,
      label: 'Sem impacto pessoal registrado.',
      disposicaoLoss: 0,
      cansacoLoss: 0,
    };
  }

  const directParticipation = input.playerRegionId === input.favela.regionId;

  if (!directParticipation) {
    return {
      conceitoDelta: 0,
      directParticipation: false,
      hpLoss: 0,
      label: 'Sua facção entrou no conflito, mas você estava fora da região no fechamento da guerra.',
      disposicaoLoss: 0,
      cansacoLoss: 0,
    };
  }

  const aggregatedLosses = war.rounds.reduce(
    (accumulator, round) => {
      if (input.side === 'attacker') {
        accumulator.hpLoss += round.attackerHpLoss;
        accumulator.disposicaoLoss += round.attackerDisposicaoLoss;
        accumulator.cansacoLoss += round.attackerCansacoLoss;
        return accumulator;
      }

      accumulator.hpLoss += round.defenderHpLoss;
      accumulator.disposicaoLoss += round.defenderDisposicaoLoss;
      accumulator.cansacoLoss += round.defenderCansacoLoss;
      return accumulator;
    },
    { hpLoss: 0, disposicaoLoss: 0, cansacoLoss: 0 },
  );

  return {
    conceitoDelta: resolveFactionWarConceitoDelta(war.status, input.side),
    directParticipation: true,
    hpLoss: aggregatedLosses.hpLoss,
    label: 'Você estava na região da guerra e entrou diretamente no conflito.',
    disposicaoLoss: aggregatedLosses.disposicaoLoss,
    cansacoLoss: aggregatedLosses.cansacoLoss,
  };
}

function resolveFactionWarConceitoDelta(
  status: FactionWarStatus,
  side: FactionWarSide,
): number {
  if (status === 'draw') {
    return -20;
  }

  if (status === 'attacker_won') {
    return side === 'attacker' ? 120 : -60;
  }

  if (status === 'defender_won') {
    return side === 'defender' ? 90 : -50;
  }

  return 0;
}

function resolveOutcomeTone(
  side: FactionWarSide,
  status: FactionWarStatus,
): WarResultCue['outcomeTone'] {
  if (status === 'cancelled') {
    return 'warning';
  }

  if (status === 'draw') {
    return 'info';
  }

  if (
    (status === 'attacker_won' && side === 'attacker') ||
    (status === 'defender_won' && side === 'defender')
  ) {
    return 'success';
  }

  return 'danger';
}
