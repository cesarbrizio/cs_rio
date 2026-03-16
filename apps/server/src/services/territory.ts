import {
  FAVELA_SERVICE_OPERATION_CYCLE_MINUTES,
  type FavelaControlState,
  type FavelaConquestInput,
  type FavelaConquestResponse,
  type FavelaFactionSummary,
  type FavelaServiceDefinitionSummary,
  type FavelaServiceInstallInput,
  type FavelaServiceMutationResponse,
  type FavelaServiceSummary,
  type FavelaServicesResponse,
  type FavelaServiceType,
  type FavelaStateTransitionInput,
  type FavelaStateTransitionResponse,
  type FactionRank,
  RegionId,
  type TerritoryConquestParticipantOutcome,
  type TerritoryFavelaSummary,
  type TerritoryLossCause,
  type TerritoryLossCueSummary,
  type TerritoryLossFeedResponse,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';

import { LevelSystem } from '../systems/LevelSystem.js';
import {
  resolveCachedAllFavelaServiceDefinitions,
  resolveCachedFavelaServiceDefinition,
} from './economy-config.js';
import {
  resolveFavelaBanditTarget,
  syncFavelaBanditPool,
} from './favela-force.js';
import {
  NoopFactionUpgradeEffectReader,
  type FactionUpgradeEffectReaderContract,
} from './faction.js';
import { GameConfigService } from './game-config.js';
import { resolveTerritoryConquestPolicy } from './gameplay-config.js';
import {
  buildFactionRegionalDominationByRegion,
  buildInactiveRegionalDominationBonus,
  type RegionalDominationBonus,
} from './regional-domination.js';
import { BaileService } from './baile.js';
import {
  buildFactionWarSummary,
  FactionWarService,
} from './faction-war.js';
import { buildFavelaPropinaSummary, PropinaService } from './propina.js';
import type { KeyValueWriter } from './key-value-store.js';
import {
  buildStabilizationEndsAt,
  calculateTerritoryPlayerPower,
  resolveCoordinationMultiplier,
} from './territory/combat.js';
import { DatabaseTerritoryRepository } from './territory/repository.js';
import {
  assertFavelaCanBeConquered,
  buildTerritoryBossSummary,
  buildTerritoryConquestMessage,
  buildTerritoryLossCueSummary,
  buildTerritoryLossStoreKey,
  buildTerritoryOverview,
  collectTerritoryLossFactionIds,
  parseTerritoryLossCueSummaries,
  resolveFavelaTransition,
  syncFavelaState,
  toTerritoryLossSnapshot,
  toTerritoryLossSnapshotFromRecord,
  type TerritoryLossEmissionInput,
  type TerritoryResolvedFavela,
} from './territory/overview.js';
import {
  TerritoryError,
  type TerritoryFactionRecord,
  type TerritoryFavelaBanditReturnRecord,
  type TerritoryFavelaBanditSyncUpdate,
  type TerritoryFavelaPropertyStatsRecord,
  type TerritoryFavelaRecord,
  type TerritoryFavelaSatisfactionContext,
  type TerritoryFavelaSatisfactionSyncUpdate,
  type TerritoryFavelaServiceRecord,
  type TerritoryFavelaServiceSyncUpdate,
  type TerritoryParticipantRecord,
  type TerritoryPlayerRecord,
  type TerritoryRegionRecord,
  type TerritoryRepository,
  type TerritorySatisfactionEventRecord,
  type TerritorySatisfactionEventType,
  type TerritorySatisfactionFactorSummary,
  type TerritorySatisfactionProfile,
  type TerritorySatisfactionTier,
  type TerritoryServiceContract,
  type TerritoryServiceOptions,
} from './territory/types.js';
import { buildFavelaX9Summary, X9IncursionService } from './x9-incursion.js';

const FAVELA_SERVICE_CYCLE_MS = FAVELA_SERVICE_OPERATION_CYCLE_MINUTES * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_TERRITORY_LOSS_CUES = 30;
const TERRITORY_LOSS_REPLAY_WINDOW_MS = 72 * 60 * 60 * 1000;
const TERRITORY_LOSS_STORE_PREFIX = 'cs_rio_recent_territory_losses:';
export { TerritoryError };
export type { TerritoryServiceContract, TerritoryServiceOptions };

export class TerritoryService implements TerritoryServiceContract {
  private readonly baileService: BaileService;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly factionWarService: FactionWarService;

  private readonly gameConfigService: GameConfigService;

  private readonly x9IncursionService: X9IncursionService;

  private readonly keyValueStore: KeyValueWriter | null;

  private readonly levelSystem: LevelSystem;

  private readonly now: () => Date;

  private readonly propinaService: PropinaService;

  private readonly random: () => number;

  private readonly repository: TerritoryRepository;

  constructor(options: TerritoryServiceOptions = {}) {
    this.factionUpgradeReader = options.factionUpgradeReader ?? new NoopFactionUpgradeEffectReader();
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? null;
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseTerritoryRepository();
    this.factionWarService = new FactionWarService({
      applyFactionUpgradeEffects: this.applyFactionUpgradeEffects.bind(this),
      assertPlayerReady: this.assertPlayerReady.bind(this),
      buildTerritoryOverview,
      collectTerritoryLossFactionIds,
      emitTerritoryLosses: this.emitTerritoryLosses.bind(this),
      gameConfigService: this.gameConfigService,
      levelSystem: this.levelSystem,
      now: this.now,
      random: this.random,
      repository: this.repository,
      syncAndListFavelas: this.syncAndListFavelas.bind(this),
      toTerritoryLossSnapshot,
    });
    this.propinaService = new PropinaService({
      assertPlayerReady: this.assertPlayerReady.bind(this),
      buildTerritoryOverview,
      gameConfigService: this.gameConfigService,
      now: this.now,
      random: this.random,
      repository: this.repository,
      syncAndListFavelas: this.syncAndListFavelas.bind(this),
    });
    this.x9IncursionService = new X9IncursionService({
      assertPlayerReady: this.assertPlayerReady.bind(this),
      buildEmptyFavelaPropertyStats,
      buildFavelaSatisfactionProfile,
      buildTerritoryOverview,
      gameConfigService: this.gameConfigService,
      now: this.now,
      random: this.random,
      repository: this.repository,
      syncAndListFavelas: this.syncAndListFavelas.bind(this),
    });
    this.baileService = new BaileService({
      assertFavelaManagementRank: this.assertFavelaManagementRank.bind(this),
      assertPlayerReady: this.assertPlayerReady.bind(this),
      buildTerritoryOverview,
      now: this.now,
      random: this.random,
      repository: this.repository,
      syncAndListFavelas: this.syncAndListFavelas.bind(this),
    });
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  async forceStateControlForDurationHours(favelaId: string, durationHours: number): Promise<void> {
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      throw new TerritoryError('validation', 'Duracao de controle estatal invalida.');
    }

    const favela = await this.repository.getFavela(favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    const now = this.now();
    const until = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    await this.repository.updateFavelaState(favelaId, {
      contestingFactionId: null,
      controllingFactionId: null,
      satisfactionSyncedAt: now,
      stabilizationEndsAt: null,
      state: 'state',
      stateControlledUntil: until,
      warDeclaredAt: null,
    });
  }

  async conquerFavela(
    playerId: string,
    favelaId: string,
    input: FavelaConquestInput,
  ): Promise<FavelaConquestResponse> {
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para conquistar territorio.');
    }

    const overviewBefore = await this.syncAndListFavelas();
    const favela = overviewBefore.find((entry) => entry.id === favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    const canLeadNeutralFavela = favela.state === 'neutral';

    if (!conquestPolicy.commandRanks.includes(player.rank) && !canLeadNeutralFavela) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem comandar uma invasao de favela.');
    }

    assertFavelaCanBeConquered(favela, player.factionId);

    const selectedParticipantIds = [...new Set([playerId, ...(input.participantIds ?? [])])];

    const minimumCrewSize = favela.state === 'neutral' ? 1 : conquestPolicy.minCrewSize;

    if (selectedParticipantIds.length < minimumCrewSize) {
      throw new TerritoryError(
        'validation',
        `A invasao exige ao menos ${minimumCrewSize} membro(s) presente(s).`,
      );
    }

    if (selectedParticipantIds.length > conquestPolicy.maxCrewSize) {
      throw new TerritoryError(
        'validation',
        `A invasao permite no maximo ${conquestPolicy.maxCrewSize} membros no bonde.`,
      );
    }

    const memberContexts = await this.repository.listFactionParticipants(player.factionId);
    const selectedParticipants = selectedParticipantIds.map((participantId) =>
      memberContexts.find((member) => member.player.id === participantId) ?? null,
    );

    if (selectedParticipants.some((participant) => participant === null)) {
      throw new TerritoryError('validation', 'Todos os participantes precisam pertencer a esta faccao.');
    }

    const effectiveParticipants = await Promise.all(
      selectedParticipants.map(async (participant) =>
        this.applyFactionUpgradeEffects(participant as TerritoryParticipantRecord),
      ),
    );
    const cansacoCost = resolveTerritoryConquestCansacoCost(favela.difficulty);
    const disposicaoCost = resolveTerritoryConquestDisposicaoCost(favela.difficulty);

    for (const participant of effectiveParticipants) {
      const lockReason = resolveTerritoryConquestLockReason(
        participant,
        favela.regionId,
        cansacoCost,
        disposicaoCost,
      );

      if (lockReason) {
        throw new TerritoryError(
          'conflict',
          `${participant.player.nickname} nao pode entrar na invasao: ${lockReason}`,
        );
      }
    }

    const boss = buildTerritoryBossSummary(favela);
    const participantPowers = effectiveParticipants.map((participant) =>
      calculateTerritoryPlayerPower(participant),
    );
    const combinedBasePower = participantPowers.reduce((sum, power) => sum + power, 0);
    const coordinationMultiplier = resolveCoordinationMultiplier(
      effectiveParticipants.length,
      conquestPolicy.coordinationBonusPerExtraMember,
    );
    const combinedPower = Math.round(combinedBasePower * coordinationMultiplier);
    const chance = estimateSuccessChance(combinedPower, boss.power);
    const success = this.random() <= chance;
    const conceitoRewardPerParticipant = success
      ? resolveTerritoryConceitoReward(favela.difficulty, favela.population)
      : -Math.max(6, Math.round(resolveTerritoryConceitoReward(favela.difficulty, favela.population) * 0.25));
    const hpDelta = success ? 0 : -calculateTerritoryHpLoss(favela.difficulty, combinedPower, boss.power);
    const now = this.now();
    const stabilizationEndsAt = success
      ? buildStabilizationEndsAt(now, conquestPolicy.stabilizationHours)
      : null;

    const participantOutcomes: TerritoryConquestParticipantOutcome[] = effectiveParticipants.map(
      (participant, index) => {
        const nextResources = {
          conceito: Math.max(0, participant.player.resources.conceito + conceitoRewardPerParticipant),
          hp: clamp(participant.player.resources.hp + hpDelta, 0, 100),
          disposicao: clamp(participant.player.resources.disposicao - disposicaoCost, 0, 100),
          cansaco: clamp(participant.player.resources.cansaco - cansacoCost, 0, 100),
        };
        const levelProgression = this.levelSystem.resolve(nextResources.conceito, participant.player.level);

        return {
          conceitoDelta: conceitoRewardPerParticipant,
          hpDelta,
          id: participant.player.id,
          level: levelProgression.level,
          leveledUp: levelProgression.leveledUp,
          nickname: participant.player.nickname,
          playerPower: participantPowers[index] ?? 0,
          rank: participant.rank,
          regionId: participant.regionId,
          resources: nextResources,
          disposicaoSpent: disposicaoCost,
          cansacoSpent: cansacoCost,
        };
      },
    );

    await this.repository.persistConquestAttempt({
      favelaId,
      nextFavelaState: success
        ? {
            contestingFactionId: null,
            controllingFactionId: player.factionId,
            lastX9RollAt: now,
            stabilizationEndsAt,
            state: 'controlled',
            stateControlledUntil: null,
            warDeclaredAt: null,
          }
        : null,
      nextSatisfaction: success ? 50 : null,
      nextSatisfactionSyncedAt: success ? now : null,
      participantUpdates: participantOutcomes.map((outcome) => ({
        cansacoDelta: -outcome.cansacoSpent,
        conceitoDelta: outcome.conceitoDelta,
        disposicaoDelta: -outcome.disposicaoSpent,
        favelaName: favela.name,
        hpDelta: outcome.hpDelta,
        logType: success ? 'territory_conquest_success' : 'territory_conquest_failure',
        nextLevel: outcome.level,
        nextResources: outcome.resources,
        playerId: outcome.id,
      })),
    });

    const syncedAfterAttempt = await this.syncAndListFavelas();
    const overview = buildTerritoryOverview(player.factionId, syncedAfterAttempt);
    const conqueredFavela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!conqueredFavela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada apos a tentativa de conquista.');
    }

    return {
      ...overview,
      boss,
      chance,
      combinedPower,
      coordinationMultiplier,
      favela: conqueredFavela,
      message: buildTerritoryConquestMessage(favela.name, success),
      minimumPowerRequired: boss.power,
      participantCount: participantOutcomes.length,
      participants: participantOutcomes,
      success,
    };
  }

  async installFavelaService(
    playerId: string,
    favelaId: string,
    input: FavelaServiceInstallInput,
  ): Promise<FavelaServiceMutationResponse> {
    if (!input.serviceType) {
      throw new TerritoryError('validation', 'Informe um tipo de servico valido.');
    }

    const player = await this.assertPlayerReady(playerId);
    const context = await this.resolveFavelaServiceContext(player, favelaId);
    await this.assertFavelaManagementRank(player.rank);

    if (context.services.some((service) => service.serviceType === input.serviceType)) {
      throw new TerritoryError('conflict', 'Esse servico ja esta instalado na favela.');
    }

    const synced = await this.syncFavelaServices(context);

    if (synced.factionBankMoney < requireFavelaServiceDefinition(input.serviceType).installCost) {
      throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para instalar esse servico.');
    }

    await this.repository.installFavelaService({
      factionId: context.faction.id,
      favelaId,
      favelaName: context.favela.name,
      installedAt: this.now(),
      playerId,
      serviceType: input.serviceType,
    });

    const response = await this.listFavelaServices(playerId, favelaId);
    const service = response.services.find((entry) => entry.definition.type === input.serviceType);

    if (!service) {
      throw new TerritoryError('not_found', 'Servico nao encontrado apos a instalacao.');
    }

    return {
      ...response,
      service,
    };
  }

  async listFavelaServices(playerId: string, favelaId: string): Promise<FavelaServicesResponse> {
    const player = await this.assertPlayerReady(playerId);
    const context = await this.resolveFavelaServiceContext(player, favelaId);
    const synced = await this.syncFavelaServices(context);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    return buildFavelaServicesResponse({
      canManage: player.rank ? conquestPolicy.managementRanks.includes(player.rank) : false,
      factionBankMoney: synced.factionBankMoney,
      faction: context.faction,
      favela: context.favela,
      now: this.now(),
      playerFactionId: player.factionId,
      regionalDominationBonus: context.regionalDominationBonus,
      region: context.region,
      services: synced.services,
    });
  }

  async listTerritory(playerId: string): Promise<TerritoryOverviewResponse> {
    const player = await this.assertPlayerReady(playerId);
    const syncedFavelas = await this.syncAndListFavelas();

    return buildTerritoryOverview(player.factionId, syncedFavelas);
  }

  async listTerritoryLosses(playerId: string): Promise<TerritoryLossFeedResponse> {
    const player = await this.assertPlayerReady(playerId);
    const now = this.now();

    if (!player.factionId) {
      return {
        cues: [],
        generatedAt: now.toISOString(),
      };
    }

    return {
      cues: await this.readTerritoryLossFeed(player.factionId, now),
      generatedAt: now.toISOString(),
    };
  }

  async getFactionWar(playerId: string, favelaId: string) {
    return this.factionWarService.getFactionWar(playerId, favelaId);
  }

  async declareFactionWar(playerId: string, favelaId: string) {
    return this.factionWarService.declareFactionWar(playerId, favelaId);
  }

  async prepareFactionWar(playerId: string, favelaId: string, input: unknown) {
    return this.factionWarService.prepareFactionWar(
      playerId,
      favelaId,
      input as Parameters<FactionWarService['prepareFactionWar']>[2],
    );
  }

  async advanceFactionWarRound(playerId: string, favelaId: string) {
    return this.factionWarService.advanceFactionWarRound(playerId, favelaId);
  }

  async getFavelaBaile(playerId: string, favelaId: string) {
    return this.baileService.getFavelaBaile(playerId, favelaId);
  }

  async organizeFavelaBaile(playerId: string, favelaId: string, input: unknown) {
    return this.baileService.organizeFavelaBaile(
      playerId,
      favelaId,
      input as Parameters<BaileService['organizeFavelaBaile']>[2],
    );
  }

  async negotiatePropina(playerId: string, favelaId: string) {
    return this.propinaService.negotiatePropina(playerId, favelaId);
  }

  async attemptX9Desenrolo(playerId: string, favelaId: string) {
    return this.x9IncursionService.attemptX9Desenrolo(playerId, favelaId);
  }

  async transitionFavelaState(
    playerId: string,
    favelaId: string,
    input: FavelaStateTransitionInput,
  ): Promise<FavelaStateTransitionResponse> {
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para mexer no territorio.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem comandar transicoes territoriais.');
    }

    if (!input.action) {
      throw new TerritoryError('validation', 'Informe uma acao valida para a state machine da favela.');
    }

    const syncedBeforeTransition = await this.syncAndListFavelas();
    const favela = syncedBeforeTransition.find((entry) => entry.id === favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    const now = this.now();
    const nextState = resolveFavelaTransition({
      action: input.action,
      actorFactionId: player.factionId,
      favela,
      now,
      stabilizationHours: conquestPolicy.stabilizationHours,
    });

    await this.repository.updateFavelaState(favelaId, {
      ...nextState,
      lastX9RollAt: nextState.state === 'controlled' ? now : undefined,
      satisfactionSyncedAt: now,
    });

    const syncedAfterTransition = await this.syncAndListFavelas();
    const transitionCause =
      input.action === 'attacker_win'
        ? ('war_defeat' satisfies TerritoryLossCause)
        : ('control_removed' satisfies TerritoryLossCause);
    const beforeSnapshots = syncedBeforeTransition.map(toTerritoryLossSnapshot);
    const afterSnapshots = syncedAfterTransition.map(toTerritoryLossSnapshot);
    const factionIds = collectTerritoryLossFactionIds(beforeSnapshots, afterSnapshots);
    const factionRecords = await this.repository.listFactionsByIds([...factionIds]);

    await this.emitTerritoryLosses({
      after: afterSnapshots,
      before: beforeSnapshots,
      causeByFavelaId: new Map([[favelaId, transitionCause]]),
      factionRecordsById: new Map(factionRecords.map((faction) => [faction.id, faction])),
      occurredAt: now,
    });

    const overview = buildTerritoryOverview(player.factionId, syncedAfterTransition);
    const transitionedFavela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!transitionedFavela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada apos a transicao.');
    }

    return {
      ...overview,
      favela: transitionedFavela,
    };
  }

  async upgradeFavelaService(
    playerId: string,
    favelaId: string,
    serviceType: FavelaServiceType,
  ): Promise<FavelaServiceMutationResponse> {
    const player = await this.assertPlayerReady(playerId);
    const context = await this.resolveFavelaServiceContext(player, favelaId);
    await this.assertFavelaManagementRank(player.rank);

    const service = context.services.find((entry) => entry.serviceType === serviceType);

    if (!service) {
      throw new TerritoryError('not_found', 'Servico nao encontrado nessa favela.');
    }

    const definition = requireFavelaServiceDefinition(serviceType);

    if (service.level >= definition.maxLevel) {
      throw new TerritoryError('conflict', 'Esse servico ja esta no nivel maximo.');
    }

    const synced = await this.syncFavelaServices(context);
    const syncedService = synced.services.find((entry) => entry.serviceType === serviceType);

    if (!syncedService) {
      throw new TerritoryError('not_found', 'Servico nao encontrado apos sincronizacao.');
    }

    const upgradeCost = resolveFavelaServiceUpgradeCost(definition, syncedService.level);

    if (synced.factionBankMoney < upgradeCost) {
      throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para melhorar esse servico.');
    }

    await this.repository.upgradeFavelaService({
      factionId: context.faction.id,
      favelaId,
      favelaName: context.favela.name,
      nextLevel: syncedService.level + 1,
      now: this.now(),
      playerId,
      satisfactionAfter: Math.min(100, context.favela.satisfaction + definition.satisfactionGainOnUpgrade),
      serviceType,
    });

    const response = await this.listFavelaServices(playerId, favelaId);
    const upgradedService = response.services.find((entry) => entry.definition.type === serviceType);

    if (!upgradedService) {
      throw new TerritoryError('not_found', 'Servico nao encontrado apos o upgrade.');
    }

    return {
      ...response,
      service: upgradedService,
    };
  }

  private async readTerritoryLossFeed(
    factionId: string,
    now: Date,
  ): Promise<TerritoryLossCueSummary[]> {
    if (!this.keyValueStore) {
      return [];
    }

    const raw = await this.keyValueStore.get(
      buildTerritoryLossStoreKey(TERRITORY_LOSS_STORE_PREFIX, factionId),
    );
    const parsed = parseTerritoryLossCueSummaries(raw);
    const fresh = parsed
      .filter((cue) => now.getTime() - new Date(cue.occurredAt).getTime() <= TERRITORY_LOSS_REPLAY_WINDOW_MS)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, MAX_STORED_TERRITORY_LOSS_CUES);

    if (fresh.length !== parsed.length) {
      await this.keyValueStore.set(
        buildTerritoryLossStoreKey(TERRITORY_LOSS_STORE_PREFIX, factionId),
        JSON.stringify(fresh),
        Math.ceil(TERRITORY_LOSS_REPLAY_WINDOW_MS / 1000),
      );
    }

    return fresh;
  }

  private async appendTerritoryLossCue(cue: TerritoryLossCueSummary): Promise<void> {
    if (!this.keyValueStore) {
      return;
    }

    const current = await this.readTerritoryLossFeed(
      cue.lostByFactionId,
      new Date(cue.occurredAt),
    );

    if (current.some((entry) => entry.key === cue.key)) {
      return;
    }

    const next = [cue, ...current]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, MAX_STORED_TERRITORY_LOSS_CUES);

    await this.keyValueStore.set(
      buildTerritoryLossStoreKey(TERRITORY_LOSS_STORE_PREFIX, cue.lostByFactionId),
      JSON.stringify(next),
      Math.ceil(TERRITORY_LOSS_REPLAY_WINDOW_MS / 1000),
    );
  }

  private async emitTerritoryLosses(input: TerritoryLossEmissionInput): Promise<void> {
    const beforeById = new Map(input.before.map((favela) => [favela.favelaId, favela]));
    const afterById = new Map(input.after.map((favela) => [favela.favelaId, favela]));

    for (const [favelaId, cause] of input.causeByFavelaId.entries()) {
      const beforeFavela = beforeById.get(favelaId);
      const afterFavela = afterById.get(favelaId);

      if (!beforeFavela?.controllingFactionId || !afterFavela) {
        continue;
      }

      if (afterFavela.controllingFactionId === beforeFavela.controllingFactionId) {
        continue;
      }

      await this.appendTerritoryLossCue(
        buildTerritoryLossCueSummary({
          after: input.after,
          afterFavela,
          before: input.before,
          beforeFavela,
          cause,
          factionRecordsById: input.factionRecordsById,
          occurredAt: input.occurredAt,
        }),
      );
    }
  }

  private async assertPlayerReady(playerId: string): Promise<TerritoryPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new TerritoryError('not_found', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new TerritoryError('character_not_ready', 'Crie seu personagem antes de mexer com territorio.');
    }

    return player;
  }

  private async assertFavelaManagementRank(rank: FactionRank | null): Promise<void> {
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!rank || !conquestPolicy.managementRanks.includes(rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao, general ou gerente podem administrar servicos da favela.');
    }
  }

  private async applyFactionUpgradeEffects(
    participant: TerritoryParticipantRecord,
  ): Promise<TerritoryParticipantRecord> {
    const effects = await this.factionUpgradeReader.getFactionUpgradeEffectsForFaction(participant.factionId);

    if (effects.attributeBonusMultiplier === 1) {
      return participant;
    }

    return {
      ...participant,
      attributes: {
        carisma: Math.round(participant.attributes.carisma * effects.attributeBonusMultiplier),
        forca: Math.round(participant.attributes.forca * effects.attributeBonusMultiplier),
        inteligencia: Math.round(participant.attributes.inteligencia * effects.attributeBonusMultiplier),
        resistencia: Math.round(participant.attributes.resistencia * effects.attributeBonusMultiplier),
      },
    };
  }

  private async syncAndListFavelas(): Promise<TerritoryResolvedFavela[]> {
    await this.gameConfigService.getResolvedCatalog();
    const now = this.now();
    const favelasList = await this.repository.listFavelas();
    const beforeSnapshots = favelasList.map(toTerritoryLossSnapshotFromRecord);
    const causeByFavelaId = new Map<string, TerritoryLossCause>();

    for (const favela of favelasList) {
      const synced = syncFavelaState(favela, now);

      if (!synced.changed) {
        continue;
      }

      if (
        favela.controllingFactionId &&
        synced.nextState.controllingFactionId !== favela.controllingFactionId
      ) {
        causeByFavelaId.set(favela.id, 'control_removed');
      }

      await this.repository.updateFavelaState(favela.id, {
        ...synced.nextState,
        satisfactionSyncedAt: now,
      });
      favela.contestingFactionId = synced.nextState.contestingFactionId;
      favela.controllingFactionId = synced.nextState.controllingFactionId;
      favela.satisfactionSyncedAt = now;
      favela.stabilizationEndsAt = synced.nextState.stabilizationEndsAt;
      favela.state = synced.nextState.state;
      favela.stateControlledUntil = synced.nextState.stateControlledUntil;
      favela.warDeclaredAt = synced.nextState.warDeclaredAt;
    }

    const propinaLosses = await this.propinaService.syncFavelaPropina(favelasList, now);

    for (const favelaId of propinaLosses) {
      causeByFavelaId.set(favelaId, 'state_takeover');
    }

    const satisfactionContexts = await this.syncFavelaSatisfaction(favelasList, now);
    const x9EventsByFavelaId = await this.x9IncursionService.syncFavelaX9(
      favelasList,
      satisfactionContexts,
      now,
    );
    const warsByFavelaId = await this.factionWarService.syncFactionWars(favelasList, now);

    const factionIds = new Set<string>();

    for (const favela of favelasList) {
      if (favela.controllingFactionId) {
        factionIds.add(favela.controllingFactionId);
      }

      if (favela.contestingFactionId) {
        factionIds.add(favela.contestingFactionId);
      }

      const war = warsByFavelaId.get(favela.id);

      if (war?.attackerFactionId) {
        factionIds.add(war.attackerFactionId);
      }

      if (war?.defenderFactionId) {
        factionIds.add(war.defenderFactionId);
      }
    }

    const afterSnapshots = favelasList.map(toTerritoryLossSnapshotFromRecord);

    for (const factionId of collectTerritoryLossFactionIds(beforeSnapshots, afterSnapshots)) {
      factionIds.add(factionId);
    }

    const factionRecords = await this.repository.listFactionsByIds([...factionIds]);
    const factionRecordsById = new Map(factionRecords.map((faction) => [faction.id, faction]));
    const factionsById = new Map(
      factionRecords.map((faction) => [
        faction.id,
        {
          abbreviation: faction.abbreviation,
          id: faction.id,
          name: faction.name,
        } satisfies FavelaFactionSummary,
      ]),
    );

    if (causeByFavelaId.size > 0) {
      await this.emitTerritoryLosses({
        after: afterSnapshots,
        before: beforeSnapshots,
        causeByFavelaId,
        factionRecordsById,
        occurredAt: now,
      });
    }

    const banditReturnStatsByFavelaId = await this.syncFavelaBandits(
      favelasList,
      factionRecordsById,
      now,
    );

    return favelasList.map((favela) => {
      const propertyStats =
        satisfactionContexts.get(favela.id)?.propertyStats ?? buildEmptyFavelaPropertyStats(favela.id);
      const satisfactionProfile = buildFavelaSatisfactionProfile({
        activeEvents: satisfactionContexts.get(favela.id)?.events ?? [],
        now,
        propertyStats,
        satisfaction: favela.satisfaction,
        services: satisfactionContexts.get(favela.id)?.services ?? [],
        state: favela.state,
      });
      const banditStats = banditReturnStatsByFavelaId.get(favela.id) ?? {
        nextReturnAt: null,
        scheduledReturnBatches: 0,
      };

      return {
        bandits: {
          active: favela.banditsActive,
          arrested: favela.banditsArrested,
          deadRecent: favela.banditsDeadRecent,
          nextReturnAt: banditStats.nextReturnAt,
          scheduledReturnBatches: banditStats.scheduledReturnBatches,
          syncedAt: favela.banditsSyncedAt.toISOString(),
          targetActive: resolveFavelaBanditTarget({
            baseBanditTarget: favela.baseBanditTarget,
            difficulty: favela.difficulty,
            internalSatisfaction:
              favela.controllingFactionId
                ? factionRecordsById.get(favela.controllingFactionId)?.internalSatisfaction ?? null
                : null,
            population: favela.population,
            state: favela.state,
          }),
        },
        code: favela.code,
        contestingFaction: favela.contestingFactionId
          ? factionsById.get(favela.contestingFactionId) ?? null
          : null,
        controllingFaction: favela.controllingFactionId
          ? factionsById.get(favela.controllingFactionId) ?? null
          : null,
        difficulty: favela.difficulty,
        id: favela.id,
        name: favela.name,
        population: favela.population,
        propina: buildFavelaPropinaSummary(favela, now),
        propinaValue: favela.propinaValue,
        regionId: favela.regionId,
        satisfaction: favela.satisfaction,
        satisfactionProfile,
        soldiers: {
          active: propertyStats.soldiersCount,
          max: favela.maxSoldiers,
          occupancyPercent:
            favela.maxSoldiers <= 0 ? 0 : roundCurrency((propertyStats.soldiersCount / favela.maxSoldiers) * 100),
        },
        stabilizationEndsAt: favela.stabilizationEndsAt?.toISOString() ?? null,
        state: favela.state,
        stateControlledUntil: favela.stateControlledUntil?.toISOString() ?? null,
        war: buildFactionWarSummary(warsByFavelaId.get(favela.id) ?? null, factionsById),
        warDeclaredAt: favela.warDeclaredAt?.toISOString() ?? null,
        x9: buildFavelaX9Summary(
          x9EventsByFavelaId.get(favela.id) ?? null,
          satisfactionProfile.dailyX9RiskPercent,
        ),
      };
    });
  }

  private async syncFavelaBandits(
    favelasList: TerritoryFavelaRecord[],
    factionRecordsById: Map<string, TerritoryFactionRecord>,
    now: Date,
  ): Promise<Map<string, { nextReturnAt: string | null; scheduledReturnBatches: number }>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const banditReturns = await this.repository.listFavelaBanditReturns(favelasList.map((favela) => favela.id));
    const returnsByFavelaId = new Map<string, TerritoryFavelaBanditReturnRecord[]>();

    for (const entry of banditReturns) {
      const current = returnsByFavelaId.get(entry.favelaId) ?? [];
      current.push(entry);
      returnsByFavelaId.set(entry.favelaId, current);
    }

    const updates: TerritoryFavelaBanditSyncUpdate[] = [];
    const releasedReturnIds: string[] = [];
    const summaryByFavelaId = new Map<string, { nextReturnAt: string | null; scheduledReturnBatches: number }>();

    for (const favela of favelasList) {
      const returnRows = returnsByFavelaId.get(favela.id) ?? [];
      const dueReturns = returnRows.filter((entry) => entry.releaseAt.getTime() <= now.getTime());
      const pendingReturns = returnRows
        .filter((entry) => entry.releaseAt.getTime() > now.getTime())
        .sort((left, right) => left.releaseAt.getTime() - right.releaseAt.getTime());
      const returnedNow = dueReturns.reduce((sum, entry) => sum + entry.quantity, 0);
      const targetActive = resolveFavelaBanditTarget({
        baseBanditTarget: favela.baseBanditTarget,
        difficulty: favela.difficulty,
        internalSatisfaction:
          favela.controllingFactionId
            ? factionRecordsById.get(favela.controllingFactionId)?.internalSatisfaction ?? null
            : null,
        population: favela.population,
        state: favela.state,
      });
      const synced = syncFavelaBanditPool({
        active: favela.banditsActive,
        deadRecent: favela.banditsDeadRecent,
        lastSyncedAt: favela.banditsSyncedAt,
        now,
        returnedNow,
        targetActive,
      });
      const nextArrested = Math.max(0, favela.banditsArrested - returnedNow);

      summaryByFavelaId.set(favela.id, {
        nextReturnAt: pendingReturns[0]?.releaseAt.toISOString() ?? null,
        scheduledReturnBatches: pendingReturns.length,
      });

      if (dueReturns.length > 0) {
        releasedReturnIds.push(...dueReturns.map((entry) => entry.id));
      }

      if (!synced.changed && nextArrested === favela.banditsArrested) {
        continue;
      }

      updates.push({
        banditsActive: synced.active,
        banditsArrested: nextArrested,
        banditsDeadRecent: synced.deadRecent,
        banditsSyncedAt: synced.syncedAt,
        favelaId: favela.id,
      });
      favela.banditsActive = synced.active;
      favela.banditsArrested = nextArrested;
      favela.banditsDeadRecent = synced.deadRecent;
      favela.banditsSyncedAt = synced.syncedAt;
    }

    await this.repository.persistFavelaBanditSync({
      releasedReturnIds,
      updates,
    });

    return summaryByFavelaId;
  }

  private async resolveFavelaServiceContext(
    player: TerritoryPlayerRecord,
    favelaId: string,
  ): Promise<{
    faction: TerritoryFactionRecord;
    favela: TerritoryFavelaSummary;
    regionalDominationBonus: RegionalDominationBonus;
    region: TerritoryRegionRecord;
    services: TerritoryFavelaServiceRecord[];
  }> {
    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para administrar servicos de favela.');
    }

    const syncedFavelas = await this.syncAndListFavelas();
    const favela = syncedFavelas.find((entry) => entry.id === favelaId);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      syncedFavelas.map((entry) => ({
        controllingFactionId: entry.controllingFaction?.id ?? null,
        regionId: entry.regionId,
      })),
    );

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favela.state !== 'controlled' || favela.controllingFaction?.id !== player.factionId) {
      throw new TerritoryError(
        'conflict',
        'Sua faccao precisa controlar a favela para operar servicos territoriais.',
      );
    }

    const [faction, region, services] = await Promise.all([
      this.repository.getFaction(player.factionId),
      this.repository.getRegion(favela.regionId),
      this.repository.listFavelaServices(favelaId),
    ]);

    if (!faction) {
      throw new TerritoryError('not_found', 'Faccao nao encontrada.');
    }

    if (!region) {
      throw new TerritoryError('not_found', 'Regiao da favela nao encontrada.');
    }

    return {
      faction,
      favela,
      regionalDominationBonus:
        regionalDominationByRegion.get(favela.regionId) ??
        buildInactiveRegionalDominationBonus(favela.regionId),
      region,
      services,
    };
  }

  private async syncFavelaServices(input: {
    faction: TerritoryFactionRecord;
    favela: TerritoryFavelaSummary;
    regionalDominationBonus: RegionalDominationBonus;
    region: TerritoryRegionRecord;
    services: TerritoryFavelaServiceRecord[];
  }): Promise<{
    factionBankMoney: number;
    services: TerritoryFavelaServiceRecord[];
  }> {
    const now = this.now();
    const serviceUpdates: TerritoryFavelaServiceSyncUpdate[] = [];
    let revenueDelta = 0;

    const services = input.services.map((service) => {
      const elapsedMs = Math.max(0, now.getTime() - service.lastRevenueAt.getTime());
      const cyclesElapsed = Math.floor(elapsedMs / FAVELA_SERVICE_CYCLE_MS);

      if (cyclesElapsed < 1) {
        return service;
      }

      const nextLastRevenueAt = new Date(
        service.lastRevenueAt.getTime() + cyclesElapsed * FAVELA_SERVICE_CYCLE_MS,
      );
      let nextGrossRevenueTotal = service.grossRevenueTotal;

      if (service.active) {
        const dailyRevenue = calculateFavelaServiceDailyRevenue({
          definition: requireFavelaServiceDefinition(service.serviceType),
          faction: input.faction,
          favela: input.favela,
          level: service.level,
          region: input.region,
          regionalDominationBonus: input.regionalDominationBonus,
          now,
        });
        const cycleRevenue = roundCurrency(dailyRevenue * (FAVELA_SERVICE_CYCLE_MS / ONE_DAY_MS));
        const serviceRevenueDelta = roundCurrency(cycleRevenue * cyclesElapsed);
        nextGrossRevenueTotal = roundCurrency(nextGrossRevenueTotal + serviceRevenueDelta);
        revenueDelta = roundCurrency(revenueDelta + serviceRevenueDelta);
      }

      serviceUpdates.push({
        grossRevenueTotal: nextGrossRevenueTotal,
        id: service.id,
        lastRevenueAt: nextLastRevenueAt,
      });

      return {
        ...service,
        grossRevenueTotal: nextGrossRevenueTotal,
        lastRevenueAt: nextLastRevenueAt,
      };
    });

    if (serviceUpdates.length > 0 || revenueDelta > 0) {
      await this.repository.persistFavelaServiceSync({
        factionId: input.faction.id,
        favelaName: input.favela.name,
        now,
        revenueDelta,
        serviceUpdates,
      });
    }

    return {
      factionBankMoney: roundCurrency(input.faction.bankMoney + revenueDelta),
      services,
    };
  }

  private async syncFavelaSatisfaction(
    favelasList: TerritoryFavelaRecord[],
    now: Date,
  ): Promise<Map<string, TerritoryFavelaSatisfactionContext>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const favelaIds = favelasList.map((favela) => favela.id);
    const regionIds = [...new Set(favelasList.map((favela) => favela.regionId))];
    const [serviceRows, propertyStatsRows, eventRows] = await Promise.all([
      this.repository.listAllFavelaServices(favelaIds),
      this.repository.listFavelaPropertyStats(favelaIds),
      this.repository.listActiveSatisfactionEvents(regionIds, favelaIds, now),
    ]);

    const servicesByFavelaId = new Map<string, TerritoryFavelaServiceRecord[]>();

    for (const service of serviceRows) {
      const current = servicesByFavelaId.get(service.favelaId) ?? [];
      current.push(service);
      servicesByFavelaId.set(service.favelaId, current);
    }

    const propertyStatsByFavelaId = new Map(
      propertyStatsRows.map((entry) => [entry.favelaId, entry] satisfies [string, TerritoryFavelaPropertyStatsRecord]),
    );

    const eventsByFavelaId = new Map<string, TerritorySatisfactionEventRecord[]>();

    for (const event of eventRows) {
      if (event.favelaId) {
        const current = eventsByFavelaId.get(event.favelaId) ?? [];
        current.push(event);
        eventsByFavelaId.set(event.favelaId, current);
      }
    }

    const updates: TerritoryFavelaSatisfactionSyncUpdate[] = [];
    const contexts = new Map<string, TerritoryFavelaSatisfactionContext>();

    for (const favela of favelasList) {
      const services = servicesByFavelaId.get(favela.id) ?? [];
      const propertyStats =
        propertyStatsByFavelaId.get(favela.id) ?? buildEmptyFavelaPropertyStats(favela.id);
      const activeEvents = [
        ...(eventsByFavelaId.get(favela.id) ?? []),
        ...eventRows.filter((event) => event.favelaId === null && event.regionId === favela.regionId),
      ];
      const elapsedMs = Math.max(0, now.getTime() - favela.satisfactionSyncedAt.getTime());
      const daysElapsed = Math.floor(elapsedMs / ONE_DAY_MS);

      if (daysElapsed >= 1) {
        const profileBeforeSync = buildFavelaSatisfactionProfile({
          activeEvents,
          now,
          propertyStats,
          satisfaction: favela.satisfaction,
          services,
          state: favela.state,
        });
        const nextSatisfaction = clamp(
          Math.round(favela.satisfaction + profileBeforeSync.dailyDeltaEstimate * daysElapsed),
          0,
          100,
        );
        const nextSyncedAt = new Date(favela.satisfactionSyncedAt.getTime() + daysElapsed * ONE_DAY_MS);

        updates.push({
          favelaId: favela.id,
          nextSatisfaction,
          nextSyncedAt,
        });
        favela.satisfaction = nextSatisfaction;
        favela.satisfactionSyncedAt = nextSyncedAt;
      }

      contexts.set(favela.id, {
        events: activeEvents,
        propertyStats,
        services,
      });
    }

    if (updates.length > 0) {
      await this.repository.persistFavelaSatisfactionSync(updates);
    }

    return contexts;
  }
}


function calculateTerritoryHpLoss(difficulty: number, combinedPower: number, bossPower: number): number {
  const overwhelmed = combinedPower < bossPower * 0.75;
  return Math.max(10, difficulty * 4 + (overwhelmed ? 12 : 0));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function estimateSuccessChance(power: number, minimumPower: number): number {
  if (power < minimumPower * 0.5) {
    return 0;
  }

  if (power >= minimumPower * 3) {
    return 0.99;
  }

  return clamp(power / (minimumPower * 2), 0.05, 0.99);
}

function resolveTerritoryConceitoReward(difficulty: number, population: number): number {
  return Math.round(difficulty * 18 + population / 3500);
}

function resolveTerritoryConquestLockReason(
  participant: TerritoryParticipantRecord,
  regionId: RegionId,
  cansacoCost: number,
  disposicaoCost: number,
): string | null {
  if (!participant.player.characterCreatedAt) {
    return 'Personagem ainda nao foi criado.';
  }

  if (participant.regionId !== regionId) {
    return 'Nao esta presente fisicamente na regiao da favela.';
  }

  if (participant.player.resources.hp <= 0) {
    return 'HP esgotado.';
  }

  if (participant.player.resources.cansaco < cansacoCost) {
    return `Cansaço insuficiente. Requer ${cansacoCost}.`;
  }

  if (participant.player.resources.disposicao < disposicaoCost) {
    return `Disposição insuficiente. Requer ${disposicaoCost}.`;
  }

  return null;
}

function resolveTerritoryConquestDisposicaoCost(difficulty: number): number {
  return clamp(8 + difficulty, 10, 20);
}

function resolveTerritoryConquestCansacoCost(difficulty: number): number {
  return clamp(12 + difficulty * 2, 16, 36);
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildEmptyFavelaPropertyStats(favelaId: string): TerritoryFavelaPropertyStatsRecord {
  return {
    activePropertyCount: 0,
    favelaId,
    soldiersCount: 0,
    suspendedPropertyCount: 0,
  };
}

function buildFavelaSatisfactionProfile(input: {
  activeEvents: TerritorySatisfactionEventRecord[];
  now: Date;
  propertyStats: TerritoryFavelaPropertyStatsRecord;
  satisfaction: number;
  services: TerritoryFavelaServiceRecord[];
  state: FavelaControlState;
}): TerritorySatisfactionProfile {
  const factors = buildFavelaSatisfactionFactors(input);
  const dailyDeltaEstimate = roundCurrency(
    factors.reduce((total, factor) => total + factor.dailyDelta, 0),
  );
  const tier = resolveFavelaSatisfactionTier(input.satisfaction);

  return {
    dailyDeltaEstimate,
    dailyX9RiskPercent: resolveFavelaSatisfactionX9RiskPercent(tier),
    factors,
    populationPressurePercentPerDay: resolveFavelaSatisfactionPopulationPressurePercent(tier),
    revenueMultiplier: resolveFavelaSatisfactionRevenueMultiplier(tier),
    tier,
  };
}

function buildFavelaSatisfactionFactors(input: {
  activeEvents: TerritorySatisfactionEventRecord[];
  now: Date;
  propertyStats: TerritoryFavelaPropertyStatsRecord;
  satisfaction: number;
  services: TerritoryFavelaServiceRecord[];
  state: FavelaControlState;
}): TerritorySatisfactionFactorSummary[] {
  const activeServices = input.services.filter((service) => service.active);
  const serviceUpgradeSteps = activeServices.reduce(
    (total, service) => total + Math.max(0, service.level - 1),
    0,
  );
  const hasBope = hasTerritorySatisfactionEvent(input.activeEvents, 'faca_na_caveira');
  const hasPolicePressure =
    hasBope ||
    hasTerritorySatisfactionEvent(input.activeEvents, 'operacao_policial') ||
    hasTerritorySatisfactionEvent(input.activeEvents, 'blitz_pm');
  const hasBaile = hasTerritorySatisfactionEvent(input.activeEvents, 'baile_cidade');
  const factors: TerritorySatisfactionFactorSummary[] = [];

  if (activeServices.length === 0) {
    factors.push({
      code: 'services',
      dailyDelta: -2,
      label: 'Falta de servicos ativos',
    });
  } else {
    factors.push({
      code: 'services',
      dailyDelta: roundCurrency(
        Math.min(3, activeServices.length * 0.3 + serviceUpgradeSteps * 0.4),
      ),
      label: 'Cobertura e infraestrutura de servicos',
    });
  }

  if (input.propertyStats.soldiersCount <= 0) {
    factors.push({
      code: 'security',
      dailyDelta: -1,
      label: 'Ausencia de soldados na favela',
    });
  } else {
    factors.push({
      code: 'security',
      dailyDelta: roundCurrency(Math.min(5, input.propertyStats.soldiersCount * 0.5)),
      label: 'Presenca de soldados protegendo a favela',
    });
  }

  if (input.state === 'at_war') {
    factors.push({
      code: 'war',
      dailyDelta: -10,
      label: 'Guerra ativa na favela',
    });
  }

  if (input.state === 'state') {
    factors.push({
      code: 'state_control',
      dailyDelta: -6,
      label: 'Controle do Estado e medo dos moradores',
    });
  }

  if (hasPolicePressure) {
    factors.push({
      code: 'police_pressure',
      dailyDelta: hasBope ? -12 : -8,
      label: hasBope ? 'Incursao do BOPE devastando a regiao' : 'Pressao policial ativa na regiao',
    });
  }

  if (hasBaile) {
    factors.push({
      code: 'baile',
      dailyDelta: 5,
      label: 'Baile funk fortalecendo o moral da favela',
    });
  }

  if (input.state === 'controlled' && !hasPolicePressure) {
    factors.push({
      code: 'peace',
      dailyDelta: 1,
      label: 'Tempo sem incursao policial',
    });
  }

  return factors;
}

function hasTerritorySatisfactionEvent(
  events: TerritorySatisfactionEventRecord[],
  eventType: TerritorySatisfactionEventType,
): boolean {
  return events.some((event) => event.eventType === eventType);
}

function resolveFavelaSatisfactionPopulationPressurePercent(tier: TerritorySatisfactionTier): number {
  switch (tier) {
    case 'critical':
      return -2;
    case 'collapsed':
      return -5;
    default:
      return 0;
  }
}

function resolveFavelaSatisfactionRevenueMultiplier(tier: TerritorySatisfactionTier): number {
  switch (tier) {
    case 'happy':
      return 1.2;
    case 'stable':
      return 1;
    case 'restless':
      return 0.8;
    case 'critical':
      return 0.5;
    case 'collapsed':
      return 0.2;
    default:
      return 1;
  }
}

function resolveFavelaSatisfactionTier(satisfaction: number): TerritorySatisfactionTier {
  const normalized = clamp(satisfaction, 0, 100);

  if (normalized >= 80) {
    return 'happy';
  }

  if (normalized >= 60) {
    return 'stable';
  }

  if (normalized >= 40) {
    return 'restless';
  }

  if (normalized >= 20) {
    return 'critical';
  }

  return 'collapsed';
}

function resolveFavelaSatisfactionX9RiskPercent(tier: TerritorySatisfactionTier): number {
  switch (tier) {
    case 'happy':
      return 5;
    case 'stable':
      return 15;
    case 'restless':
      return 30;
    case 'critical':
      return 50;
    case 'collapsed':
      return 75;
    default:
      return 15;
  }
}

function buildFavelaServicesResponse(input: {
  canManage: boolean;
  faction: TerritoryFactionRecord;
  factionBankMoney: number;
  favela: TerritoryFavelaSummary;
  now: Date;
  playerFactionId: string | null;
  regionalDominationBonus: RegionalDominationBonus;
  region: TerritoryRegionRecord;
  services: TerritoryFavelaServiceRecord[];
}): FavelaServicesResponse {
  const servicesByType = new Map(input.services.map((service) => [service.serviceType, service]));

  return {
    canManage: input.canManage,
    factionBankMoney: input.factionBankMoney,
    favela: input.favela,
    playerFactionId: input.playerFactionId,
    services: resolveCachedAllFavelaServiceDefinitions().map((definition) => {
      const installedService = servicesByType.get(definition.type) ?? null;
      const breakdown = buildFavelaServiceRevenueBreakdown({
        faction: input.faction,
        favela: input.favela,
        now: input.now,
        regionalDominationBonus: input.regionalDominationBonus,
        region: input.region,
      });
      const currentDailyRevenue =
        installedService && installedService.active
          ? calculateFavelaServiceDailyRevenue({
              definition,
              faction: input.faction,
              favela: input.favela,
              level: installedService.level,
              now: input.now,
              regionalDominationBonus: input.regionalDominationBonus,
              region: input.region,
            })
          : 0;
      const nextUpgradeCost =
        installedService && installedService.level < definition.maxLevel
          ? resolveFavelaServiceUpgradeCost(definition, installedService.level)
          : null;
      const lockReason = resolveFavelaServiceLockReason({
        canManage: input.canManage,
        definition,
        factionBankMoney: input.factionBankMoney,
        installedService,
        nextUpgradeCost,
      });

      return {
        active: installedService?.active ?? false,
        currentDailyRevenue,
        definition,
        grossRevenueTotal: installedService?.grossRevenueTotal ?? 0,
        id: installedService?.id ?? null,
        installed: installedService !== null,
        installedAt: installedService?.installedAt.toISOString() ?? null,
        isUpgradeable:
          installedService !== null &&
          installedService.active &&
          installedService.level < definition.maxLevel &&
          lockReason === null,
        lastRevenueAt: installedService?.lastRevenueAt.toISOString() ?? null,
        level: installedService?.level ?? 0,
        lockReason,
        nextUpgradeCost,
        revenueBreakdown: breakdown,
      } satisfies FavelaServiceSummary;
    }),
  };
}

function buildFavelaServiceRevenueBreakdown(input: {
  faction: TerritoryFactionRecord;
  favela: TerritoryFavelaSummary;
  now: Date;
  regionalDominationBonus: RegionalDominationBonus;
  region: TerritoryRegionRecord;
}): FavelaServiceSummary['revenueBreakdown'] {
  const satisfactionMultiplier = resolveFavelaServiceSatisfactionMultiplier(input.favela.satisfaction);
  const regionalMultiplier = resolveFavelaServiceRegionalMultiplier(input.region);
  const factionBonusMultiplier = resolveFavelaServiceFactionBonusMultiplier(input.faction);
  const propinaPenaltyMultiplier = input.favela.propina?.revenuePenaltyMultiplier ?? 1;
  const territoryDominationMultiplier = resolveTerritoryFavelaServiceDominationMultiplier(
    input.regionalDominationBonus,
  );
  const stabilizationMultiplier = resolveFavelaServiceStabilizationMultiplier(input.favela, input.now);

  return {
    factionBonusMultiplier,
    propinaPenaltyMultiplier,
    regionalMultiplier,
    satisfactionMultiplier,
    stabilizationMultiplier,
    territoryDominationMultiplier,
    totalMultiplier: roundMultiplier(
      satisfactionMultiplier *
        regionalMultiplier *
        factionBonusMultiplier *
        propinaPenaltyMultiplier *
        territoryDominationMultiplier *
        stabilizationMultiplier,
    ),
  };
}

function calculateFavelaServiceDailyRevenue(input: {
  definition: FavelaServiceDefinitionSummary;
  faction: TerritoryFactionRecord;
  favela: TerritoryFavelaSummary;
  level: number;
  now: Date;
  regionalDominationBonus: RegionalDominationBonus;
  region: TerritoryRegionRecord;
}): number {
  const levelMultiplier = roundMultiplier(
    1 + Math.max(0, input.level - 1) * input.definition.upgradeRevenueStepMultiplier,
  );
  const revenueBreakdown = buildFavelaServiceRevenueBreakdown({
    faction: input.faction,
    favela: input.favela,
    now: input.now,
    regionalDominationBonus: input.regionalDominationBonus,
    region: input.region,
  });

  return roundCurrency(
    input.definition.baseDailyRevenuePerResident *
      input.favela.population *
      levelMultiplier *
      revenueBreakdown.totalMultiplier,
  );
}

function requireFavelaServiceDefinition(serviceType: FavelaServiceType): FavelaServiceDefinitionSummary {
  try {
    return resolveCachedFavelaServiceDefinition(serviceType);
  } catch {
    throw new TerritoryError('validation', 'Tipo de servico de favela invalido.');
  }
}

function resolveFavelaServiceFactionBonusMultiplier(faction: TerritoryFactionRecord): number {
  if (faction.abbreviation === 'MIL') {
    return 1.2;
  }

  return 1;
}

function resolveTerritoryFavelaServiceDominationMultiplier(
  regionalDominationBonus: RegionalDominationBonus,
): number {
  if (!regionalDominationBonus.active) {
    return 1;
  }

  return roundMultiplier(
    regionalDominationBonus.revenueMultiplier *
      regionalDominationBonus.favelaServiceRevenueMultiplier,
  );
}

function resolveFavelaServiceLockReason(input: {
  canManage: boolean;
  definition: FavelaServiceDefinitionSummary;
  factionBankMoney: number;
  installedService: TerritoryFavelaServiceRecord | null;
  nextUpgradeCost: number | null;
}): string | null {
  if (!input.canManage) {
    return input.installedService
      ? 'Apenas patrao, general ou gerente podem melhorar esse servico.'
      : 'Apenas patrao, general ou gerente podem instalar esse servico.';
  }

  if (!input.installedService) {
    if (input.factionBankMoney < input.definition.installCost) {
      return 'O banco da faccao nao tem saldo para instalar esse servico.';
    }

    return null;
  }

  if (!input.installedService.active) {
    return 'Servico inativo. Reparo/dano territorial sera tratado nas proximas fases.';
  }

  if (input.installedService.level >= input.definition.maxLevel) {
    return 'Servico ja esta no nivel maximo.';
  }

  if (input.nextUpgradeCost !== null && input.factionBankMoney < input.nextUpgradeCost) {
    return 'O banco da faccao nao tem saldo para melhorar esse servico.';
  }

  return null;
}

function resolveFavelaServiceRegionalMultiplier(region: TerritoryRegionRecord): number {
  let multiplier =
    0.8 +
    region.wealthIndex * 0.0028 +
    region.densityIndex * 0.0018 -
    region.policePressure * 0.0008;

  if (region.id === RegionId.ZonaOeste) {
    multiplier += 0.15;
  }

  return roundMultiplier(clamp(multiplier, 0.85, 1.35));
}

function resolveFavelaServiceSatisfactionMultiplier(satisfaction: number): number {
  return resolveFavelaSatisfactionRevenueMultiplier(resolveFavelaSatisfactionTier(satisfaction));
}

function resolveFavelaServiceStabilizationMultiplier(
  favela: TerritoryFavelaSummary,
  now: Date,
): number {
  if (!favela.stabilizationEndsAt) {
    return 1;
  }

  const stabilizationEndsAt = new Date(favela.stabilizationEndsAt);

  return stabilizationEndsAt.getTime() > now.getTime() ? 0.5 : 1;
}

function resolveFavelaServiceUpgradeCost(
  definition: FavelaServiceDefinitionSummary,
  currentLevel: number,
): number {
  return roundCurrency(definition.installCost * (0.7 + currentLevel * 0.3));
}
