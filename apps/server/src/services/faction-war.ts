import {
  type FactionWarDeclareResponse,
  type FactionWarPrepareInput,
  type FactionWarPreparationSummary,
  type FactionWarPrepareResponse,
  type FactionWarRoundOutcome,
  type FactionWarRoundResponse,
  type FactionWarRoundSummary,
  type FactionWarSide,
  type FactionWarStatus,
  type FactionWarStatusResponse,
  type FactionWarSummary,
  type FavelaControlState,
  type FavelaFactionSummary,
  type RegionId,
  type TerritoryFavelaSummary,
  type TerritoryLossCause,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import type { LevelSystem } from '../systems/LevelSystem.js';
import type { GameConfigService } from './game-config.js';
import { resolveTerritoryConquestPolicy } from './gameplay-config.js';
import {
  buildStabilizationEndsAt,
  calculateTerritoryPlayerPower,
  clamp,
  resolveCoordinationMultiplier,
  resolveFactionWarPreparationPowerBonus,
  resolveFactionWarRoundOutcome,
  roundMultiplier,
} from './territory/combat.js';
import { roundCurrency } from './territory/shared.js';
import {
  TerritoryError,
  type TerritoryFactionRecord,
  type TerritoryFactionWarRepository,
  type TerritoryFactionWarParticipantPersistenceUpdate,
  type TerritoryFactionWarPreparationRecord,
  type TerritoryFactionWarRecord,
  type TerritoryFactionWarRoundRecord,
  type TerritoryParticipantRecord,
  type TerritoryPlayerRecord,
  type TerritoryFavelaStateUpdateInput,
} from './territory/types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FACTION_WAR_PREPARATION_MS = 90 * 60 * 1000;
const FACTION_WAR_COOLDOWN_MS = 7 * ONE_DAY_MS;
const FACTION_WAR_ROUND_INTERVAL_MS = 30 * 60 * 1000;
const FACTION_WAR_MAX_PREPARATION_BUDGET = 100000;
const FACTION_WAR_MAX_SOLDIER_COMMITMENT = 20;
const FACTION_WAR_DEFENDER_TERRAIN_MULTIPLIER = 1.12;

interface TerritoryLossSnapshot {
  controllingFactionId: string | null;
  favelaId: string;
  favelaName: string;
  regionId: RegionId;
  state: FavelaControlState;
}

interface TerritoryLossEmissionInput {
  after: TerritoryLossSnapshot[];
  before: TerritoryLossSnapshot[];
  causeByFavelaId: Map<string, TerritoryLossCause>;
  factionRecordsById: Map<string, TerritoryFactionRecord>;
  occurredAt: Date;
}

export interface FactionWarServiceOptions {
  applyFactionUpgradeEffects(
    participant: TerritoryParticipantRecord,
  ): Promise<TerritoryParticipantRecord>;
  assertPlayerReady(playerId: string): Promise<TerritoryPlayerRecord>;
  buildTerritoryOverview(
    playerFactionId: string | null,
    favelasList: TerritoryFavelaSummary[],
  ): TerritoryOverviewResponse;
  collectTerritoryLossFactionIds(
    before: TerritoryLossSnapshot[],
    after: TerritoryLossSnapshot[],
  ): Set<string>;
  emitTerritoryLosses(input: TerritoryLossEmissionInput): Promise<void>;
  gameConfigService: GameConfigService;
  levelSystem: LevelSystem;
  now: () => Date;
  random: () => number;
  repository: TerritoryFactionWarRepository;
  syncAndListFavelas(): Promise<TerritoryFavelaSummary[]>;
  toTerritoryLossSnapshot(favela: TerritoryFavelaSummary): TerritoryLossSnapshot;
}

export class FactionWarService {
  constructor(private readonly options: FactionWarServiceOptions) {}

  async getFactionWar(playerId: string, favelaId: string): Promise<FactionWarStatusResponse> {
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
      favela,
      war: favela.war,
    };
  }

  async declareFactionWar(playerId: string, favelaId: string): Promise<FactionWarDeclareResponse> {
    const player = await this.options.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.options.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para declarar guerra.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem declarar guerra.');
    }

    const overviewBefore = await this.options.syncAndListFavelas();
    const favelaBefore = overviewBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favelaBefore.state === 'neutral') {
      throw new TerritoryError('conflict', 'Favela neutra usa o fluxo de conquista, nao declaracao de guerra.');
    }

    if (favelaBefore.state === 'state') {
      throw new TerritoryError('conflict', 'Favela sob controle do Estado nao pode receber guerra agora.');
    }

    if (
      favelaBefore.state === 'at_war' ||
      (favelaBefore.war &&
        (favelaBefore.war.status === 'declared' ||
          favelaBefore.war.status === 'preparing' ||
          favelaBefore.war.status === 'active'))
    ) {
      throw new TerritoryError('conflict', 'Ja existe guerra em andamento nessa favela.');
    }

    if (!favelaBefore.controllingFaction || favelaBefore.controllingFaction.id === player.factionId) {
      throw new TerritoryError('conflict', 'A declaracao de guerra exige uma favela controlada por faccao rival.');
    }

    const latestWarBetweenFactions = await this.options.repository.findLatestFactionWarBetweenFactions(
      player.factionId,
      favelaBefore.controllingFaction.id,
    );

    if (
      latestWarBetweenFactions?.cooldownEndsAt &&
      latestWarBetweenFactions.cooldownEndsAt.getTime() > this.options.now().getTime()
    ) {
      throw new TerritoryError('conflict', 'Essa rivalidade ainda esta em cooldown para uma nova guerra.');
    }

    const declaredAt = this.options.now();
    const preparationEndsAt = new Date(declaredAt.getTime() + FACTION_WAR_PREPARATION_MS);

    await this.options.repository.createFactionWar({
      attackerFactionId: player.factionId,
      declaredAt,
      declaredByPlayerId: player.id,
      defenderFactionId: favelaBefore.controllingFaction.id,
      favelaId,
      favelaName: favelaBefore.name,
      preparationEndsAt,
      startsAt: preparationEndsAt,
    });

    const overview = this.options.buildTerritoryOverview(
      player.factionId,
      await this.options.syncAndListFavelas(),
    );
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela?.war) {
      throw new TerritoryError('not_found', 'Guerra nao encontrada apos a declaracao.');
    }

    return {
      ...overview,
      favela,
      message: `Guerra declarada por ${favela.name}. A favela entra em preparacao ate ${favela.war.preparationEndsAt}.`,
      war: favela.war,
    };
  }

  async prepareFactionWar(
    playerId: string,
    favelaId: string,
    input: FactionWarPrepareInput,
  ): Promise<FactionWarPrepareResponse> {
    const player = await this.options.assertPlayerReady(playerId);

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para preparar a guerra.');
    }

    const budget = roundCurrency(Number(input.budget));
    const soldierCommitment = Math.round(Number(input.soldierCommitment));

    if (!Number.isFinite(budget) || budget < 0 || budget > FACTION_WAR_MAX_PREPARATION_BUDGET) {
      throw new TerritoryError(
        'validation',
        `O budget de preparacao deve ficar entre 0 e ${FACTION_WAR_MAX_PREPARATION_BUDGET}.`,
      );
    }

    if (
      !Number.isFinite(soldierCommitment) ||
      soldierCommitment < 0 ||
      soldierCommitment > FACTION_WAR_MAX_SOLDIER_COMMITMENT
    ) {
      throw new TerritoryError(
        'validation',
        `O compromisso de soldados deve ficar entre 0 e ${FACTION_WAR_MAX_SOLDIER_COMMITMENT}.`,
      );
    }

    const overviewBefore = await this.options.syncAndListFavelas();
    const favelaBefore = overviewBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore?.war) {
      throw new TerritoryError('not_found', 'Nao existe guerra registrada para essa favela.');
    }

    const warBefore = favelaBefore.war;
    const side = resolveFactionWarSideForPlayer(player.factionId, warBefore);

    if (!side) {
      throw new TerritoryError('forbidden', 'Sua faccao nao faz parte desta guerra.');
    }

    if (warBefore.status !== 'declared' && warBefore.status !== 'preparing') {
      throw new TerritoryError('conflict', 'A guerra ja passou da fase de preparacao.');
    }

    if (warBefore.startsAt && new Date(warBefore.startsAt).getTime() <= this.options.now().getTime()) {
      throw new TerritoryError('conflict', 'A fase de preparacao da guerra ja terminou.');
    }

    const alreadyPrepared =
      side === 'attacker' ? warBefore.attackerPreparation : warBefore.defenderPreparation;

    if (alreadyPrepared) {
      throw new TerritoryError('conflict', 'Esse lado da guerra ja concluiu a preparacao.');
    }

    const participants = await this.options.repository.listFactionParticipants(player.factionId);
    const readyInRegion = participants.filter(
      (participant) =>
        participant.player.characterCreatedAt &&
        participant.regionId === favelaBefore.regionId &&
        participant.player.resources.hp > 0,
    );

    if (readyInRegion.length === 0) {
      throw new TerritoryError('conflict', 'A faccao precisa ter pelo menos um membro presente na regiao para preparar a guerra.');
    }

    const powerBonus = resolveFactionWarPreparationPowerBonus({
      budget,
      regionPresenceCount: readyInRegion.length,
      soldierCommitment,
    });

    const persisted = await this.options.repository.prepareFactionWar({
      budget,
      factionId: player.factionId,
      favelaName: favelaBefore.name,
      playerId: player.id,
      powerBonus,
      preparedAt: this.options.now(),
      regionPresenceCount: readyInRegion.length,
      side,
      soldierCommitment,
      warId: warBefore.id,
    });

    if (!persisted) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar a preparacao da guerra.');
    }

    const overview = this.options.buildTerritoryOverview(
      player.factionId,
      await this.options.syncAndListFavelas(),
    );
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela?.war) {
      throw new TerritoryError('not_found', 'Guerra nao encontrada apos a preparacao.');
    }

    return {
      ...overview,
      favela,
      message:
        side === 'attacker'
          ? `Ataque preparado para ${favela.name} com bonus de poder ${powerBonus}.`
          : `Defesa preparada para ${favela.name} com bonus de poder ${powerBonus}.`,
      side,
      war: favela.war,
    };
  }

  async advanceFactionWarRound(playerId: string, favelaId: string): Promise<FactionWarRoundResponse> {
    const player = await this.options.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.options.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para comandar a guerra.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem comandar rounds de guerra.');
    }

    const syncedBefore = await this.options.syncAndListFavelas();
    const favelaBefore = syncedBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore?.war) {
      throw new TerritoryError('not_found', 'Nao existe guerra ativa para essa favela.');
    }

    let warBefore = favelaBefore.war;
    const side = resolveFactionWarSideForPlayer(player.factionId, warBefore);

    if (!side) {
      throw new TerritoryError('forbidden', 'Sua faccao nao participa desta guerra.');
    }

    const now = this.options.now();

    if ((warBefore.status === 'declared' || warBefore.status === 'preparing') && warBefore.startsAt) {
      const startsAt = new Date(warBefore.startsAt);

      if (startsAt.getTime() > now.getTime()) {
        throw new TerritoryError('conflict', 'A guerra ainda esta em fase de preparacao.');
      }

      const activated = await this.options.repository.updateFactionWarStatus(
        warBefore.id,
        'active',
        warBefore.nextRoundAt ? new Date(warBefore.nextRoundAt) : now,
      );

      if (!activated) {
        throw new TerritoryError('conflict', 'Nao foi possivel ativar a guerra.');
      }

      warBefore = buildFactionWarSummary(
        activated,
        new Map([
          [activated.attackerFactionId, favelaBefore.war.attackerFaction],
          [activated.defenderFactionId, favelaBefore.war.defenderFaction],
        ]),
      ) as FactionWarSummary;
    }

    if (warBefore.status !== 'active') {
      throw new TerritoryError('conflict', 'Essa guerra ja foi encerrada.');
    }

    if (warBefore.nextRoundAt && new Date(warBefore.nextRoundAt).getTime() > now.getTime()) {
      throw new TerritoryError('conflict', 'O proximo round da guerra ainda nao esta disponivel.');
    }

    const [attackerParticipantsRaw, defenderParticipantsRaw] = await Promise.all([
      this.options.repository.listFactionParticipants(warBefore.attackerFaction.id),
      this.options.repository.listFactionParticipants(warBefore.defenderFaction.id),
    ]);
    const [attackerParticipants, defenderParticipants] = await Promise.all([
      Promise.all(
        attackerParticipantsRaw
          .filter((participant) => participant.regionId === favelaBefore.regionId)
          .map((participant) => this.options.applyFactionUpgradeEffects(participant)),
      ),
      Promise.all(
        defenderParticipantsRaw
          .filter((participant) => participant.regionId === favelaBefore.regionId)
          .map((participant) => this.options.applyFactionUpgradeEffects(participant)),
      ),
    ]);

    const attackerForce = resolveFactionWarSideForce({
      favela: favelaBefore,
      maxCrewSize: conquestPolicy.maxCrewSize,
      participants: attackerParticipants,
      preparation: warBefore.attackerPreparation,
      random: this.options.random,
      side: 'attacker',
    });
    const defenderForce = resolveFactionWarSideForce({
      favela: favelaBefore,
      maxCrewSize: conquestPolicy.maxCrewSize,
      participants: defenderParticipants,
      preparation: warBefore.defenderPreparation,
      random: this.options.random,
      side: 'defender',
    });
    const roundOutcome = resolveFactionWarRoundOutcome(attackerForce.power, defenderForce.power);
    const roundNumber = warBefore.roundsResolved + 1;
    const round = buildFactionWarRoundRecord({
      attackerPower: attackerForce.power,
      defenderPower: defenderForce.power,
      outcome: roundOutcome,
      resolvedAt: now,
      roundNumber,
    });
    const nextRounds = [...warBefore.rounds, round].map((entry) => ({
      attackerHpLoss: entry.attackerHpLoss,
      attackerDisposicaoLoss: entry.attackerDisposicaoLoss,
      attackerPower: entry.attackerPower,
      attackerCansacoLoss: entry.attackerCansacoLoss,
      defenderHpLoss: entry.defenderHpLoss,
      defenderDisposicaoLoss: entry.defenderDisposicaoLoss,
      defenderPower: entry.defenderPower,
      defenderCansacoLoss: entry.defenderCansacoLoss,
      message: entry.message,
      outcome: entry.outcome,
      resolvedAt: new Date(entry.resolvedAt),
      roundNumber: entry.roundNumber,
    }));
    const nextAttackerScore = warBefore.attackerScore + (roundOutcome === 'attacker' ? 1 : 0);
    const nextDefenderScore = warBefore.defenderScore + (roundOutcome === 'defender' ? 1 : 0);
    const warEnded = roundNumber >= warBefore.roundsTotal;
    const participantUpdates = buildFactionWarParticipantUpdates({
      attackerConceitoDelta: warEnded
        ? resolveFactionWarConceitoDelta({
            finalStatus: resolveFactionWarFinalStatus(nextAttackerScore, nextDefenderScore),
            side: 'attacker',
          })
        : 0,
      attackerLosses: round,
      attackerParticipants,
      defenderConceitoDelta: warEnded
        ? resolveFactionWarConceitoDelta({
            finalStatus: resolveFactionWarFinalStatus(nextAttackerScore, nextDefenderScore),
            side: 'defender',
          })
        : 0,
      defenderLosses: round,
      defenderParticipants,
      levelSystem: this.options.levelSystem,
    });

    const resolvedFinalStatus = warEnded
      ? resolveFactionWarFinalStatus(nextAttackerScore, nextDefenderScore)
      : null;
    const finalStatus: FactionWarStatus = resolvedFinalStatus ?? 'active';
    const nextNextRoundAt = warEnded ? null : new Date(now.getTime() + FACTION_WAR_ROUND_INTERVAL_MS);
    const attackerRewardMoney =
      finalStatus === 'attacker_won'
        ? resolveFactionWarLootMoney({
            attackerPreparation: warBefore.attackerPreparation,
            defenderPreparation: warBefore.defenderPreparation,
            favela: favelaBefore,
          })
        : 0;
    const attackerPointsDelta = resolveFactionWarPointsDelta(finalStatus, 'attacker');
    const defenderPointsDelta = resolveFactionWarPointsDelta(finalStatus, 'defender');
    const satisfactionAfter = warEnded
      ? clamp(
          favelaBefore.satisfaction + resolveFactionWarSatisfactionDelta(finalStatus),
          0,
          100,
        )
      : null;
    const nextFavelaState = warEnded
      ? buildFactionWarFavelaResolutionState({
          attackerFactionId: warBefore.attackerFaction.id,
          defenderFactionId: warBefore.defenderFaction.id,
          finalStatus: resolvedFinalStatus as Extract<FactionWarStatus, 'attacker_won' | 'defender_won' | 'draw'>,
          now,
          stabilizationHours: conquestPolicy.stabilizationHours,
        })
      : null;

    const persisted = await this.options.repository.persistFactionWarRound({
      attackerFactionId: warBefore.attackerFaction.id,
      attackerPointsDelta,
      attackerRewardMoney,
      defenderFactionId: warBefore.defenderFaction.id,
      defenderPointsDelta,
      endedAt: warEnded ? now : null,
      favelaId,
      favelaName: favelaBefore.name,
      nextAttackerScore,
      nextCooldownEndsAt: warEnded ? new Date(now.getTime() + FACTION_WAR_COOLDOWN_MS) : null,
      nextDefenderScore,
      nextFavelaState,
      nextNextRoundAt,
      nextRounds,
      nextRoundsResolved: roundNumber,
      nextStatus: finalStatus,
      nextWinnerFactionId:
        finalStatus === 'attacker_won'
          ? warBefore.attackerFaction.id
          : finalStatus === 'defender_won'
            ? warBefore.defenderFaction.id
            : null,
      now,
      participantUpdates,
      satisfactionAfter,
      satisfactionSyncedAt: warEnded ? now : null,
      warId: warBefore.id,
      winnerFactionId:
        finalStatus === 'attacker_won'
          ? warBefore.attackerFaction.id
          : finalStatus === 'defender_won'
            ? warBefore.defenderFaction.id
            : null,
    });

    if (!persisted) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar o round da guerra.');
    }

    const syncedAfter = await this.options.syncAndListFavelas();

    if (warEnded && finalStatus === 'attacker_won') {
      const beforeSnapshots = syncedBefore.map(this.options.toTerritoryLossSnapshot);
      const afterSnapshots = syncedAfter.map(this.options.toTerritoryLossSnapshot);
      const factionIds = this.options.collectTerritoryLossFactionIds(beforeSnapshots, afterSnapshots);
      const factionRecords = await this.options.repository.listFactionsByIds([...factionIds]);

      await this.options.emitTerritoryLosses({
        after: afterSnapshots,
        before: beforeSnapshots,
        causeByFavelaId: new Map([[favelaId, 'war_defeat' satisfies TerritoryLossCause]]),
        factionRecordsById: new Map(factionRecords.map((faction) => [faction.id, faction])),
        occurredAt: now,
      });
    }

    const overview = this.options.buildTerritoryOverview(player.factionId, syncedAfter);
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela?.war) {
      throw new TerritoryError('not_found', 'Guerra nao encontrada apos o round.');
    }

    return {
      ...overview,
      favela,
      message: round.message,
      round: buildFactionWarRoundSummary(round),
      war: favela.war,
    };
  }

  async syncFactionWars(
    favelasList: Array<Pick<TerritoryFavelaSummary, 'id'>>,
    now: Date,
  ): Promise<Map<string, TerritoryFactionWarRecord | null>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const latestWarsByFavela = selectLatestFactionWarByFavela(
      await this.options.repository.listFactionWars(favelasList.map((favela) => favela.id)),
    );
    const result = new Map<string, TerritoryFactionWarRecord | null>();

    for (const favela of favelasList) {
      let latestWar = latestWarsByFavela.get(favela.id) ?? null;

      if (
        latestWar &&
        (latestWar.status === 'declared' || latestWar.status === 'preparing') &&
        latestWar.startsAt &&
        latestWar.startsAt.getTime() <= now.getTime()
      ) {
        latestWar = await this.options.repository.updateFactionWarStatus(
          latestWar.id,
          'active',
          latestWar.nextRoundAt ?? latestWar.startsAt,
        );
      }

      result.set(favela.id, latestWar);
    }

    return result;
  }
}

export function buildFactionWarSummary(
  war: TerritoryFactionWarRecord | null,
  factionsById: Map<string, FavelaFactionSummary>,
): FactionWarSummary | null {
  if (!war) {
    return null;
  }

  const attackerFaction = factionsById.get(war.attackerFactionId);
  const defenderFaction = factionsById.get(war.defenderFactionId);

  if (!attackerFaction || !defenderFaction) {
    return null;
  }

  return {
    attackerFaction,
    attackerPreparation: buildFactionWarPreparationSummary(war.attackerPreparation),
    attackerScore: war.attackerScore,
    cooldownEndsAt: war.cooldownEndsAt?.toISOString() ?? null,
    declaredAt: war.declaredAt.toISOString(),
    declaredByPlayerId: war.declaredByPlayerId,
    defenderFaction,
    defenderPreparation: buildFactionWarPreparationSummary(war.defenderPreparation),
    defenderScore: war.defenderScore,
    endedAt: war.endedAt?.toISOString() ?? null,
    favelaId: war.favelaId,
    id: war.id,
    lootMoney: war.lootMoney,
    nextRoundAt: war.nextRoundAt?.toISOString() ?? null,
    preparationEndsAt: war.preparationEndsAt?.toISOString() ?? null,
    rounds: war.rounds.map((round) => buildFactionWarRoundSummary(round)),
    roundsResolved: war.roundsResolved,
    roundsTotal: war.roundsTotal,
    startsAt: war.startsAt?.toISOString() ?? null,
    status: war.status,
    winnerFactionId: war.winnerFactionId,
  };
}

export function buildFactionWarRoundSummary(round: TerritoryFactionWarRoundRecord): FactionWarRoundSummary {
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

function buildFactionWarPreparationSummary(
  preparation: TerritoryFactionWarPreparationRecord | null,
): FactionWarPreparationSummary | null {
  if (!preparation) {
    return null;
  }

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

function resolveFactionWarSideForPlayer(
  factionId: string,
  war: Pick<FactionWarSummary, 'attackerFaction' | 'defenderFaction'>,
): FactionWarSide | null {
  if (war.attackerFaction.id === factionId) {
    return 'attacker';
  }

  if (war.defenderFaction.id === factionId) {
    return 'defender';
  }

  return null;
}

function resolveFactionWarSideForce(input: {
  favela: TerritoryFavelaSummary;
  maxCrewSize: number;
  participants: TerritoryParticipantRecord[];
  preparation: FactionWarPreparationSummary | null;
  random: () => number;
  side: FactionWarSide;
}): { participantCount: number; power: number } {
  const readyParticipants = input.participants.filter(
    (participant) => participant.player.characterCreatedAt && participant.player.resources.hp > 0,
  );
  const basePower = readyParticipants.reduce(
    (total, participant) => total + calculateTerritoryPlayerPower(participant),
    0,
  );
  const coordinationMultiplier = resolveCoordinationMultiplier(
    Math.max(1, Math.min(input.maxCrewSize, readyParticipants.length)),
  );
  const preparationMultiplier = input.preparation ? 1.12 : 0.72;
  const terrainMultiplier = input.side === 'defender' ? FACTION_WAR_DEFENDER_TERRAIN_MULTIPLIER : 1;
  const satisfactionMultiplier =
    input.side === 'defender'
      ? roundMultiplier(clamp(1 + (input.favela.satisfaction - 50) / 200, 0.85, 1.2))
      : 1;
  const volatilityMultiplier = roundMultiplier(0.92 + input.random() * 0.16);
  const power = Math.round(
    (basePower * coordinationMultiplier + (input.preparation?.powerBonus ?? 0)) *
      preparationMultiplier *
      terrainMultiplier *
      satisfactionMultiplier *
      volatilityMultiplier,
  );

  return {
    participantCount: readyParticipants.length,
    power,
  };
}

function buildFactionWarRoundRecord(input: {
  attackerPower: number;
  defenderPower: number;
  outcome: FactionWarRoundOutcome;
  resolvedAt: Date;
  roundNumber: number;
}): TerritoryFactionWarRoundRecord {
  const intensity = Math.max(
    4,
    Math.round(Math.abs(input.attackerPower - input.defenderPower) / 900),
  );

  if (input.outcome === 'attacker') {
    return {
      attackerHpLoss: 8 + Math.round(intensity * 0.5),
      attackerDisposicaoLoss: 6 + Math.round(intensity * 0.3),
      attackerPower: input.attackerPower,
      attackerCansacoLoss: 10 + Math.round(intensity * 0.5),
      defenderHpLoss: 16 + intensity,
      defenderDisposicaoLoss: 10 + Math.round(intensity * 0.5),
      defenderPower: input.defenderPower,
      defenderCansacoLoss: 14 + intensity,
      message: `Round ${input.roundNumber}: o ataque abriu vantagem e empurrou a defesa para tras.`,
      outcome: input.outcome,
      resolvedAt: input.resolvedAt,
      roundNumber: input.roundNumber,
    };
  }

  if (input.outcome === 'defender') {
    return {
      attackerHpLoss: 16 + intensity,
      attackerDisposicaoLoss: 10 + Math.round(intensity * 0.5),
      attackerPower: input.attackerPower,
      attackerCansacoLoss: 14 + intensity,
      defenderHpLoss: 8 + Math.round(intensity * 0.5),
      defenderDisposicaoLoss: 6 + Math.round(intensity * 0.3),
      defenderPower: input.defenderPower,
      defenderCansacoLoss: 10 + Math.round(intensity * 0.5),
      message: `Round ${input.roundNumber}: a defesa segurou a linha e conteve o bonde invasor.`,
      outcome: input.outcome,
      resolvedAt: input.resolvedAt,
      roundNumber: input.roundNumber,
    };
  }

  return {
    attackerHpLoss: 12 + intensity,
    attackerDisposicaoLoss: 8 + Math.round(intensity * 0.4),
    attackerPower: input.attackerPower,
    attackerCansacoLoss: 12 + intensity,
    defenderHpLoss: 12 + intensity,
    defenderDisposicaoLoss: 8 + Math.round(intensity * 0.4),
    defenderPower: input.defenderPower,
    defenderCansacoLoss: 12 + intensity,
    message: `Round ${input.roundNumber}: troca franca de tiro, sem vantagem decisiva para nenhum lado.`,
    outcome: input.outcome,
    resolvedAt: input.resolvedAt,
    roundNumber: input.roundNumber,
  };
}

function resolveFactionWarFinalStatus(
  attackerScore: number,
  defenderScore: number,
): Extract<FactionWarStatus, 'attacker_won' | 'defender_won' | 'draw'> {
  if (attackerScore > defenderScore) {
    return 'attacker_won';
  }

  if (defenderScore > attackerScore) {
    return 'defender_won';
  }

  return 'draw';
}

function resolveFactionWarConceitoDelta(input: {
  finalStatus: Extract<FactionWarStatus, 'attacker_won' | 'defender_won' | 'draw'>;
  side: FactionWarSide;
}): number {
  if (input.finalStatus === 'draw') {
    return -20;
  }

  if (input.finalStatus === 'attacker_won') {
    return input.side === 'attacker' ? 120 : -60;
  }

  return input.side === 'defender' ? 90 : -50;
}

function resolveFactionWarPointsDelta(
  finalStatus: FactionWarStatus,
  side: FactionWarSide,
): number {
  if (finalStatus === 'attacker_won') {
    return side === 'attacker' ? 500 : -220;
  }

  if (finalStatus === 'defender_won') {
    return side === 'defender' ? 320 : -140;
  }

  if (finalStatus === 'draw') {
    return -80;
  }

  return 0;
}

function resolveFactionWarSatisfactionDelta(finalStatus: FactionWarStatus): number {
  if (finalStatus === 'attacker_won') {
    return -15;
  }

  if (finalStatus === 'defender_won') {
    return -10;
  }

  if (finalStatus === 'draw') {
    return -20;
  }

  return 0;
}

function resolveFactionWarLootMoney(input: {
  attackerPreparation: FactionWarPreparationSummary | null;
  defenderPreparation: FactionWarPreparationSummary | null;
  favela: TerritoryFavelaSummary;
}): number {
  return roundCurrency(
    Math.max(
      15000,
      input.favela.population * input.favela.difficulty * 1.2 +
        (input.attackerPreparation?.budget ?? 0) * 0.08 +
        (input.defenderPreparation?.budget ?? 0) * 0.04,
    ),
  );
}

function buildFactionWarFavelaResolutionState(input: {
  attackerFactionId: string;
  defenderFactionId: string;
  finalStatus: Extract<FactionWarStatus, 'attacker_won' | 'defender_won' | 'draw'>;
  now: Date;
  stabilizationHours: number;
}): TerritoryFavelaStateUpdateInput {
  if (input.finalStatus === 'attacker_won') {
    return {
      contestingFactionId: null,
      controllingFactionId: input.attackerFactionId,
      lastX9RollAt: input.now,
      propinaDiscountRate: 0,
      propinaDueDate: null,
      propinaLastPaidAt: null,
      propinaNegotiatedAt: null,
      propinaNegotiatedByPlayerId: null,
      propinaValue: 0,
      satisfactionSyncedAt: input.now,
      stabilizationEndsAt: buildStabilizationEndsAt(input.now, input.stabilizationHours),
      state: 'controlled',
      stateControlledUntil: null,
      warDeclaredAt: null,
    };
  }

  return {
    contestingFactionId: null,
    controllingFactionId: input.defenderFactionId,
    satisfactionSyncedAt: input.now,
    stabilizationEndsAt: null,
    state: 'controlled',
    stateControlledUntil: null,
    warDeclaredAt: null,
  };
}

function buildFactionWarParticipantUpdates(input: {
  attackerConceitoDelta: number;
  attackerLosses: TerritoryFactionWarRoundRecord;
  attackerParticipants: TerritoryParticipantRecord[];
  defenderConceitoDelta: number;
  defenderLosses: TerritoryFactionWarRoundRecord;
  defenderParticipants: TerritoryParticipantRecord[];
  levelSystem: LevelSystem;
}): TerritoryFactionWarParticipantPersistenceUpdate[] {
  const updates: TerritoryFactionWarParticipantPersistenceUpdate[] = [];

  const pushUpdates = (
    participants: TerritoryParticipantRecord[],
    losses: {
      hpLoss: number;
      disposicaoLoss: number;
      cansacoLoss: number;
    },
    conceitoDelta: number,
  ) => {
    for (const participant of participants) {
      const nextResources = {
        conceito: Math.max(0, participant.player.resources.conceito + conceitoDelta),
        hp: clamp(participant.player.resources.hp - losses.hpLoss, 0, 100),
        disposicao: clamp(participant.player.resources.disposicao - losses.disposicaoLoss, 0, 100),
        cansaco: clamp(participant.player.resources.cansaco - losses.cansacoLoss, 0, 100),
      };
      const levelProgression = input.levelSystem.resolve(
        nextResources.conceito,
        participant.player.level,
      );

      updates.push({
        cansacoDelta: -losses.cansacoLoss,
        conceitoDelta,
        disposicaoDelta: -losses.disposicaoLoss,
        hpDelta: -losses.hpLoss,
        nextLevel: levelProgression.level,
        nextResources,
        playerId: participant.player.id,
      });
    }
  };

  pushUpdates(
    input.attackerParticipants,
    {
      hpLoss: input.attackerLosses.attackerHpLoss,
      disposicaoLoss: input.attackerLosses.attackerDisposicaoLoss,
      cansacoLoss: input.attackerLosses.attackerCansacoLoss,
    },
    input.attackerConceitoDelta,
  );
  pushUpdates(
    input.defenderParticipants,
    {
      hpLoss: input.defenderLosses.defenderHpLoss,
      disposicaoLoss: input.defenderLosses.defenderDisposicaoLoss,
      cansacoLoss: input.defenderLosses.defenderCansacoLoss,
    },
    input.defenderConceitoDelta,
  );

  return updates;
}

function selectLatestFactionWarByFavela(
  wars: TerritoryFactionWarRecord[],
): Map<string, TerritoryFactionWarRecord> {
  const map = new Map<string, TerritoryFactionWarRecord>();

  for (const war of wars) {
    if (!map.has(war.favelaId)) {
      map.set(war.favelaId, war);
    }
  }

  return map;
}
