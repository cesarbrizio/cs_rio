import {
  type FactionWarStatus,
  type PlayerProfile,
  type RegionId,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

export type TerritoryAlertCueKind =
  | 'war_declared'
  | 'war_preparing'
  | 'war_active'
  | 'x9_warning'
  | 'x9_pending_desenrolo'
  | 'x9_jailed';

export interface TerritoryAlertCue {
  body: string;
  favelaId: string;
  favelaName: string;
  key: string;
  kind: TerritoryAlertCueKind;
  occurredAt: string;
  regionId: RegionId;
  title: string;
  tone: 'danger' | 'warning';
}

export function buildPendingTerritoryAlertCues(input: {
  overview: TerritoryOverviewResponse;
  player: Pick<PlayerProfile, 'faction'> | null | undefined;
  seenKeys: ReadonlySet<string>;
}): TerritoryAlertCue[] {
  const playerFactionId = input.player?.faction?.id ?? null;

  if (!playerFactionId) {
    return [];
  }

  return input.overview.favelas
    .flatMap((favela) => buildTerritoryAlertCuesForFavela(favela, playerFactionId))
    .filter((cue) => !input.seenKeys.has(cue.key))
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
}

function buildTerritoryAlertCuesForFavela(
  favela: TerritoryFavelaSummary,
  playerFactionId: string,
): TerritoryAlertCue[] {
  const cues: TerritoryAlertCue[] = [];
  const warCue = buildWarTerritoryAlertCue(favela, playerFactionId);

  if (warCue) {
    cues.push(warCue);
  }

  const x9Cue = buildX9TerritoryAlertCue(favela, playerFactionId);

  if (x9Cue) {
    cues.push(x9Cue);
  }

  return cues;
}

function buildWarTerritoryAlertCue(
  favela: TerritoryFavelaSummary,
  playerFactionId: string,
): TerritoryAlertCue | null {
  const war = favela.war;

  if (!war || !ACTIVE_WAR_STATUSES.has(war.status)) {
    return null;
  }

  const playerSide = resolveWarSide(playerFactionId, war);

  if (!playerSide) {
    return null;
  }

  const enemyFaction =
    playerSide === 'attacker' ? war.defenderFaction : war.attackerFaction;
  const keyTimestamp =
    war.nextRoundAt ??
    war.startsAt ??
    war.preparationEndsAt ??
    war.declaredAt;

  switch (war.status) {
    case 'declared':
      return {
        body: `${enemyFaction.abbreviation} entrou na disputa por ${favela.name}. Sua faccao ja precisa preparar a guerra.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:war:${war.id}:declared:${war.declaredAt}`,
        kind: 'war_declared',
        occurredAt: war.declaredAt,
        regionId: favela.regionId,
        title: `${favela.name}: guerra declarada`,
        tone: 'warning',
      };
    case 'preparing':
      return {
        body: `A guerra por ${favela.name} entrou em preparacao. O conflito com ${enemyFaction.abbreviation} vai abrir rodada em breve.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:war:${war.id}:preparing:${keyTimestamp}`,
        kind: 'war_preparing',
        occurredAt: war.preparationEndsAt ?? war.declaredAt,
        regionId: favela.regionId,
        title: `${favela.name}: guerra em preparacao`,
        tone: 'warning',
      };
    case 'active':
      return {
        body: `A guerra por ${favela.name} entrou em combate. Placar atual ${war.attackerScore} x ${war.defenderScore} contra ${enemyFaction.abbreviation}.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:war:${war.id}:active:${keyTimestamp}`,
        kind: 'war_active',
        occurredAt: war.startsAt ?? war.nextRoundAt ?? war.declaredAt,
        regionId: favela.regionId,
        title: `${favela.name}: guerra em andamento`,
        tone: 'danger',
      };
    default:
      return null;
  }
}

function buildX9TerritoryAlertCue(
  favela: TerritoryFavelaSummary,
  playerFactionId: string,
): TerritoryAlertCue | null {
  if (favela.controllingFaction?.id !== playerFactionId || !favela.x9) {
    return null;
  }

  const x9 = favela.x9;
  const keyTimestamp =
    x9.incursionAt ??
    x9.desenroloAttemptedAt ??
    x9.soldiersReleaseAt ??
    x9.warningEndsAt ??
    x9.triggeredAt;

  switch (x9.status) {
    case 'warning':
      return {
        body: `Tem X9 soprando em ${favela.name}. A janela de resposta ja abriu e a favela precisa de desenrolo rapido.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:x9:${x9.id}:warning:${keyTimestamp}`,
        kind: 'x9_warning',
        occurredAt: x9.triggeredAt,
        regionId: favela.regionId,
        title: `${favela.name}: X9 ativo`,
        tone: 'warning',
      };
    case 'pending_desenrolo':
      return {
        body: `O desenrolo do X9 em ${favela.name} ficou pendente. A favela segue exposta ate a resposta fechar.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:x9:${x9.id}:pending_desenrolo:${keyTimestamp}`,
        kind: 'x9_pending_desenrolo',
        occurredAt: x9.desenroloAttemptedAt ?? x9.triggeredAt,
        regionId: favela.regionId,
        title: `${favela.name}: desenrolo pendente`,
        tone: 'warning',
      };
    case 'jailed':
      return {
        body: `O X9 em ${favela.name} derrubou a favela e deixou membros presos. O impacto ja bateu no territorio.`,
        favelaId: favela.id,
        favelaName: favela.name,
        key: `territory-alert:x9:${x9.id}:jailed:${keyTimestamp}`,
        kind: 'x9_jailed',
        occurredAt: x9.incursionAt ?? x9.triggeredAt,
        regionId: favela.regionId,
        title: `${favela.name}: X9 estourou`,
        tone: 'danger',
      };
    case 'resolved':
    default:
      return null;
  }
}

const ACTIVE_WAR_STATUSES = new Set<FactionWarStatus>([
  'declared',
  'preparing',
  'active',
]);

function resolveWarSide(
  playerFactionId: string | null,
  war: TerritoryFavelaSummary['war'],
): 'attacker' | 'defender' | null {
  if (!war || !playerFactionId) {
    return null;
  }

  if (war.attackerFaction.id === playerFactionId) {
    return 'attacker';
  }

  if (war.defenderFaction.id === playerFactionId) {
    return 'defender';
  }

  return null;
}
