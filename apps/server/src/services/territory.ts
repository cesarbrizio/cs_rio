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
  type FavelaBaileMcTier,
  type FavelaBaileOrganizeInput,
  type FavelaBaileOrganizeResponse,
  type FavelaBaileResultTier,
  type FavelaBaileStatus,
  type FavelaBaileStatusResponse,
  type FavelaBaileSummary,
  FAVELA_SERVICE_OPERATION_CYCLE_MINUTES,
  type FavelaConquestInput,
  type FavelaConquestResponse,
  type FavelaControlState,
  type FavelaPropinaNegotiationResponse,
  type FavelaPropinaStatus,
  type FavelaPropinaSummary,
  type FavelaX9DesenroloResponse,
  type FavelaX9Status,
  type FavelaX9Summary,
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
  type PlayerResources,
  RegionId,
  type TerritoryBossSummary,
  type TerritoryConquestParticipantOutcome,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
  type TerritoryRegionSummary,
  VocationType,
} from '@cs-rio/shared';

import { LevelSystem } from '../systems/LevelSystem.js';
import {
  resolveCachedAllFavelaServiceDefinitions,
  resolveCachedFavelaServiceDefinition,
  resolveCachedTerritoryPropinaPolicy,
  resolveCachedTerritoryPropinaRegionProfile,
} from './economy-config.js';
import {
  resolveFavelaBanditTarget,
  syncFavelaBanditPool,
  type BanditReturnFlavor,
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
import { DatabaseTerritoryRepository } from './territory/repository.js';


const TERRITORY_COORDINATION_BONUS_PER_EXTRA_MEMBER = 0.03;
const FAVELA_SERVICE_CYCLE_MS = FAVELA_SERVICE_OPERATION_CYCLE_MINUTES * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BAILE_COOLDOWN_MS = 3 * ONE_DAY_MS;
const BAILE_MIN_BUDGET = 10000;
const BAILE_MAX_BUDGET = 100000;
const FACTION_WAR_PREPARATION_MS = 90 * 60 * 1000;
const FACTION_WAR_COOLDOWN_MS = 7 * ONE_DAY_MS;
const FACTION_WAR_ROUND_INTERVAL_MS = 30 * 60 * 1000;
const FACTION_WAR_MAX_PREPARATION_BUDGET = 100000;
const FACTION_WAR_MAX_SOLDIER_COMMITMENT = 20;
const FACTION_WAR_DEFENDER_TERRAIN_MULTIPLIER = 1.12;
type TerritorySatisfactionProfile = TerritoryFavelaSummary['satisfactionProfile'];
type TerritorySatisfactionFactorSummary = TerritorySatisfactionProfile['factors'][number];
type TerritorySatisfactionTier = TerritorySatisfactionProfile['tier'];

interface TerritoryPlayerRecord {
  carisma: number;
  characterCreatedAt: Date | null;
  conceito: number;
  factionId: string | null;
  id: string;
  level: number;
  nickname: string;
  rank: FactionRank | null;
  vocation: VocationType;
}

interface TerritoryFactionRecord {
  abbreviation: string;
  bankMoney: number;
  id: string;
  internalSatisfaction: number;
  name: string;
  points: number;
}

interface TerritoryRegionRecord {
  densityIndex: number;
  id: RegionId;
  operationCostMultiplier: number;
  policePressure: number;
  wealthIndex: number;
}

interface TerritoryFavelaRecord {
  baseBanditTarget: number;
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  banditsSyncedAt: Date;
  code: string;
  contestingFactionId: string | null;
  controllingFactionId: string | null;
  difficulty: number;
  id: string;
  maxSoldiers: number;
  name: string;
  population: number;
  propinaDiscountRate: number;
  propinaDueDate: Date | null;
  propinaLastPaidAt: Date | null;
  propinaNegotiatedAt: Date | null;
  propinaNegotiatedByPlayerId: string | null;
  propinaValue: number;
  regionId: RegionId;
  satisfaction: number;
  satisfactionSyncedAt: Date;
  lastX9RollAt: Date;
  stabilizationEndsAt: Date | null;
  state: FavelaControlState;
  stateControlledUntil: Date | null;
  warDeclaredAt: Date | null;
}

interface TerritoryFavelaStateUpdateInput {
  contestingFactionId: string | null;
  controllingFactionId: string | null;
  lastX9RollAt?: Date | null;
  propinaDiscountRate?: number | null;
  propinaDueDate?: Date | null;
  propinaLastPaidAt?: Date | null;
  propinaNegotiatedAt?: Date | null;
  propinaNegotiatedByPlayerId?: string | null;
  propinaValue?: number | null;
  satisfactionSyncedAt?: Date | null;
  stabilizationEndsAt: Date | null;
  state: FavelaControlState;
  stateControlledUntil: Date | null;
  warDeclaredAt: Date | null;
}

interface TerritoryFavelaServiceRecord {
  active: boolean;
  favelaId: string;
  grossRevenueTotal: number;
  id: string;
  installedAt: Date;
  lastRevenueAt: Date;
  level: number;
  serviceType: FavelaServiceType;
}

interface TerritoryFavelaBanditReturnRecord {
  favelaId: string;
  id: string;
  quantity: number;
  releaseAt: Date;
  returnFlavor: BanditReturnFlavor;
}

interface TerritoryFavelaBanditSyncUpdate {
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  banditsSyncedAt: Date;
  favelaId: string;
}

interface TerritoryFavelaBaileRecord {
  activeEndsAt: Date | null;
  budget: number;
  cooldownEndsAt: Date;
  entryPrice: number;
  factionId: string;
  factionPointsDelta: number;
  favelaId: string;
  hangoverEndsAt: Date | null;
  id: string;
  incidentCode: string | null;
  mcTier: FavelaBaileMcTier;
  organizedAt: Date;
  organizedByPlayerId: string;
  resultTier: FavelaBaileResultTier;
  satisfactionDelta: number;
  staminaBoostPercent: number;
}

interface TerritoryFactionWarPreparationRecord {
  budget: number;
  powerBonus: number;
  preparedAt: Date;
  preparedByPlayerId: string;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
}

interface TerritoryFactionWarRoundRecord {
  attackerHpLoss: number;
  attackerNerveLoss: number;
  attackerPower: number;
  attackerStaminaLoss: number;
  defenderHpLoss: number;
  defenderNerveLoss: number;
  defenderPower: number;
  defenderStaminaLoss: number;
  message: string;
  outcome: FactionWarRoundOutcome;
  resolvedAt: Date;
  roundNumber: number;
}

interface TerritoryFactionWarRecord {
  attackerFactionId: string;
  attackerPreparation: TerritoryFactionWarPreparationRecord | null;
  attackerScore: number;
  cooldownEndsAt: Date | null;
  declaredAt: Date;
  declaredByPlayerId: string | null;
  defenderFactionId: string;
  defenderPreparation: TerritoryFactionWarPreparationRecord | null;
  defenderScore: number;
  endedAt: Date | null;
  favelaId: string;
  id: string;
  lootMoney: number;
  nextRoundAt: Date | null;
  preparationEndsAt: Date | null;
  rounds: TerritoryFactionWarRoundRecord[];
  roundsResolved: number;
  roundsTotal: number;
  startsAt: Date | null;
  status: FactionWarStatus;
  winnerFactionId: string | null;
}

interface TerritoryFavelaPropertyStatsRecord {
  activePropertyCount: number;
  favelaId: string;
  soldiersCount: number;
  suspendedPropertyCount: number;
}

type TerritorySatisfactionEventType =
  | 'baile_cidade'
  | 'blitz_pm'
  | 'faca_na_caveira'
  | 'operacao_policial';

interface TerritorySatisfactionEventRecord {
  eventType: TerritorySatisfactionEventType;
  favelaId: string | null;
  regionId: RegionId | null;
}

interface TerritoryParticipantWeapon {
  durability: number | null;
  inventoryItemId: string;
  power: number;
  proficiency: number;
}

interface TerritoryParticipantVest {
  defense: number;
  durability: number | null;
  inventoryItemId: string;
}

interface TerritoryParticipantRecord {
  attributes: {
    carisma: number;
    forca: number;
    inteligencia: number;
    resistencia: number;
  };
  equipment: {
    vest: TerritoryParticipantVest | null;
    weapon: TerritoryParticipantWeapon | null;
  };
  factionId: string;
  player: {
    characterCreatedAt: Date | null;
    id: string;
    level: number;
    nickname: string;
    resources: Pick<PlayerResources, 'conceito' | 'hp' | 'nerve' | 'stamina'>;
    vocation: VocationType;
  };
  rank: FactionRank;
  regionId: RegionId;
}

interface TerritoryConquestParticipantPersistenceUpdate {
  conceitoDelta: number;
  favelaName: string;
  hpDelta: number;
  logType: 'territory_conquest_failure' | 'territory_conquest_success';
  nextLevel: number;
  nextResources: Pick<PlayerResources, 'conceito' | 'hp' | 'nerve' | 'stamina'>;
  playerId: string;
}

interface TerritoryConquestPersistenceInput {
  favelaId: string;
  nextFavelaState: TerritoryFavelaStateUpdateInput | null;
  nextSatisfaction: number | null;
  nextSatisfactionSyncedAt: Date | null;
  participantUpdates: TerritoryConquestParticipantPersistenceUpdate[];
}

interface TerritoryFavelaServiceSyncUpdate {
  grossRevenueTotal: number;
  id: string;
  lastRevenueAt: Date;
}

interface TerritoryFavelaSatisfactionContext {
  events: TerritorySatisfactionEventRecord[];
  propertyStats: TerritoryFavelaPropertyStatsRecord;
  services: TerritoryFavelaServiceRecord[];
}

interface TerritoryFavelaServiceSyncPersistenceInput {
  factionId: string | null;
  favelaName: string;
  now: Date;
  revenueDelta: number;
  serviceUpdates: TerritoryFavelaServiceSyncUpdate[];
}

interface TerritoryFavelaSatisfactionSyncUpdate {
  favelaId: string;
  nextSatisfaction: number;
  nextSyncedAt: Date;
}

interface TerritoryFavelaX9RollSyncUpdate {
  favelaId: string;
  nextLastRollAt: Date;
}

interface TerritoryFavelaPropinaSyncUpdate {
  favelaId: string;
  nextDiscountRate: number;
  nextDueDate: Date | null;
  nextLastPaidAt: Date | null;
  nextNegotiatedAt: Date | null;
  nextNegotiatedByPlayerId: string | null;
  nextPropinaValue: number;
}

interface TerritoryX9SoldierImpactRecord {
  count: number;
  propertyId: string;
}

interface TerritoryX9EventRecord {
  desenroloAttemptedAt: Date | null;
  desenroloBaseMoneyCost: number;
  desenroloBasePointsCost: number;
  desenroloMoneySpent: number;
  desenroloNegotiatorPlayerId: string | null;
  desenroloPointsSpent: number;
  desenroloSucceeded: boolean | null;
  drugsLost: number;
  favelaId: string;
  id: string;
  incursionAt: Date | null;
  moneyLost: number;
  resolvedAt: Date | null;
  soldierImpacts: TerritoryX9SoldierImpactRecord[];
  soldiersArrested: number;
  soldiersReleaseAt: Date | null;
  status: FavelaX9Status;
  triggeredAt: Date;
  warningEndsAt: Date | null;
  weaponsLost: number;
}

type TerritoryBusinessCashTargetKind =
  | 'boca'
  | 'front_store'
  | 'puteiro'
  | 'rave'
  | 'slot_machine';

type TerritoryBusinessDrugTargetKind = 'boca' | 'factory' | 'rave';

interface TerritoryX9CashTargetRecord {
  cashBalance: number;
  kind: TerritoryBusinessCashTargetKind;
  propertyId: string;
}

interface TerritoryX9DrugTargetRecord {
  drugId: string;
  kind: TerritoryBusinessDrugTargetKind;
  propertyId: string;
  quantity: number;
}

interface TerritoryX9SoldierTargetRecord {
  propertyId: string;
  soldiersCount: number;
}

interface TerritoryFavelaX9Exposure {
  cashTargets: TerritoryX9CashTargetRecord[];
  drugTargets: TerritoryX9DrugTargetRecord[];
  soldierTargets: TerritoryX9SoldierTargetRecord[];
}

interface TerritoryCreateX9WarningInput {
  favelaId: string;
  status: FavelaX9Status;
  triggeredAt: Date;
  warningEndsAt: Date;
}

interface TerritoryApplyX9IncursionInput {
  baseMoneyCost: number;
  basePointsCost: number;
  cashImpacts: Array<{
    kind: TerritoryBusinessCashTargetKind;
    lostAmount: number;
    propertyId: string;
  }>;
  drugsLost: number;
  drugImpacts: Array<{
    drugId: string;
    kind: TerritoryBusinessDrugTargetKind;
    lostQuantity: number;
    propertyId: string;
  }>;
  eventId: string;
  favelaId: string;
  incursionAt: Date;
  moneyLost: number;
  nextSatisfaction: number;
  soldierImpacts: TerritoryX9SoldierImpactRecord[];
  soldiersArrested: number;
  soldiersReleaseAt: Date;
  weaponsLost: number;
}

interface TerritoryResolveX9DesenroloInput {
  actorPlayerId: string;
  attemptedAt: Date;
  eventId: string;
  factionId: string;
  moneySpent: number;
  pointsSpent: number;
  releaseAt: Date;
  success: boolean;
}

interface TerritoryFavelaPropinaPaymentInput {
  amount: number;
  factionId: string;
  favelaId: string;
  nextDueAt: Date;
  now: Date;
  playerId: string | null;
  nextPropinaValue: number;
}

interface TerritoryFavelaPropinaNegotiationInput {
  discountRate: number;
  favelaId: string;
  negotiatedAt: Date;
  negotiatedByPlayerId: string;
  nextPropinaValue: number;
}

interface TerritoryFavelaServiceInstallPersistenceInput {
  factionId: string;
  favelaId: string;
  favelaName: string;
  installedAt: Date;
  playerId: string;
  serviceType: FavelaServiceType;
}

interface TerritoryFavelaBailePersistenceInput {
  activeEndsAt: Date | null;
  budget: number;
  cooldownEndsAt: Date;
  entryPrice: number;
  factionId: string;
  factionPointsDelta: number;
  favelaId: string;
  favelaName: string;
  hangoverEndsAt: Date | null;
  incidentCode: string | null;
  mcTier: FavelaBaileMcTier;
  organizedAt: Date;
  organizedByPlayerId: string;
  regionId: RegionId;
  resultTier: FavelaBaileResultTier;
  satisfactionAfter: number;
  satisfactionDelta: number;
  staminaBoostPercent: number;
}

interface TerritoryFactionWarCreateInput {
  attackerFactionId: string;
  declaredAt: Date;
  declaredByPlayerId: string;
  defenderFactionId: string;
  favelaId: string;
  favelaName: string;
  preparationEndsAt: Date;
  startsAt: Date;
}

interface TerritoryFactionWarPreparePersistenceInput {
  budget: number;
  factionId: string;
  favelaName: string;
  playerId: string;
  powerBonus: number;
  preparedAt: Date;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
  warId: string;
}

interface TerritoryFactionWarParticipantPersistenceUpdate {
  conceitoDelta: number;
  nextLevel: number;
  nextResources: Pick<PlayerResources, 'conceito' | 'hp' | 'nerve' | 'stamina'>;
  playerId: string;
}

interface TerritoryFactionWarRoundPersistenceInput {
  attackerFactionId: string;
  attackerPointsDelta: number;
  attackerRewardMoney: number;
  defenderFactionId: string;
  defenderPointsDelta: number;
  endedAt: Date | null;
  favelaId: string;
  favelaName: string;
  nextAttackerScore: number;
  nextCooldownEndsAt: Date | null;
  nextDefenderScore: number;
  nextFavelaState: TerritoryFavelaStateUpdateInput | null;
  nextNextRoundAt: Date | null;
  nextRounds: TerritoryFactionWarRoundRecord[];
  nextRoundsResolved: number;
  nextStatus: FactionWarStatus;
  nextWinnerFactionId: string | null;
  now: Date;
  participantUpdates: TerritoryFactionWarParticipantPersistenceUpdate[];
  satisfactionAfter: number | null;
  satisfactionSyncedAt: Date | null;
  warId: string;
  winnerFactionId: string | null;
}

interface TerritoryFavelaServiceUpgradePersistenceInput {
  factionId: string;
  favelaId: string;
  favelaName: string;
  nextLevel: number;
  now: Date;
  playerId: string;
  satisfactionAfter: number;
  serviceType: FavelaServiceType;
}

export interface TerritoryRepository {
  applyX9Incursion(input: TerritoryApplyX9IncursionInput): Promise<TerritoryX9EventRecord | null>;
  createFactionWar(input: TerritoryFactionWarCreateInput): Promise<TerritoryFactionWarRecord>;
  createX9Warning(input: TerritoryCreateX9WarningInput): Promise<TerritoryX9EventRecord>;
  findLatestFactionWarBetweenFactions(
    attackerFactionId: string,
    defenderFactionId: string,
  ): Promise<TerritoryFactionWarRecord | null>;
  getFavela(favelaId: string): Promise<TerritoryFavelaRecord | null>;
  getFaction(factionId: string): Promise<TerritoryFactionRecord | null>;
  getFavelaX9Exposure(favelaId: string): Promise<TerritoryFavelaX9Exposure>;
  getPlayer(playerId: string): Promise<TerritoryPlayerRecord | null>;
  getRegion(regionId: RegionId): Promise<TerritoryRegionRecord | null>;
  listActiveSatisfactionEvents(
    regionIds: RegionId[],
    favelaIds: string[],
    now: Date,
  ): Promise<TerritorySatisfactionEventRecord[]>;
  listAllFavelaServices(favelaIds: string[]): Promise<TerritoryFavelaServiceRecord[]>;
  listFavelaBanditReturns(favelaIds: string[]): Promise<TerritoryFavelaBanditReturnRecord[]>;
  listFactionWars(favelaIds: string[]): Promise<TerritoryFactionWarRecord[]>;
  listLatestBailes(favelaIds: string[]): Promise<TerritoryFavelaBaileRecord[]>;
  listFactionParticipants(factionId: string): Promise<TerritoryParticipantRecord[]>;
  listFactionsByIds(factionIds: string[]): Promise<TerritoryFactionRecord[]>;
  listFavelaPropertyStats(favelaIds: string[]): Promise<TerritoryFavelaPropertyStatsRecord[]>;
  listFavelaServices(favelaId: string): Promise<TerritoryFavelaServiceRecord[]>;
  listFavelas(): Promise<TerritoryFavelaRecord[]>;
  listX9Events(favelaIds: string[]): Promise<TerritoryX9EventRecord[]>;
  installFavelaService(input: TerritoryFavelaServiceInstallPersistenceInput): Promise<void>;
  organizeFavelaBaile(input: TerritoryFavelaBailePersistenceInput): Promise<TerritoryFavelaBaileRecord>;
  prepareFactionWar(input: TerritoryFactionWarPreparePersistenceInput): Promise<TerritoryFactionWarRecord | null>;
  negotiateFavelaPropina(input: TerritoryFavelaPropinaNegotiationInput): Promise<boolean>;
  payFavelaPropina(input: TerritoryFavelaPropinaPaymentInput): Promise<boolean>;
  persistConquestAttempt(input: TerritoryConquestPersistenceInput): Promise<void>;
  persistFactionWarRound(input: TerritoryFactionWarRoundPersistenceInput): Promise<TerritoryFactionWarRecord | null>;
  persistFavelaBanditSync(input: {
    releasedReturnIds: string[];
    updates: TerritoryFavelaBanditSyncUpdate[];
  }): Promise<void>;
  persistFavelaPropinaSync(updates: TerritoryFavelaPropinaSyncUpdate[]): Promise<void>;
  persistFavelaSatisfactionSync(updates: TerritoryFavelaSatisfactionSyncUpdate[]): Promise<void>;
  persistFavelaServiceSync(input: TerritoryFavelaServiceSyncPersistenceInput): Promise<void>;
  persistFavelaX9RollSync(updates: TerritoryFavelaX9RollSyncUpdate[]): Promise<void>;
  releaseX9Soldiers(eventId: string, releasedAt: Date): Promise<TerritoryX9EventRecord | null>;
  resolveX9Desenrolo(input: TerritoryResolveX9DesenroloInput): Promise<TerritoryX9EventRecord | null>;
  updateFactionWarStatus(
    warId: string,
    nextStatus: FactionWarStatus,
    nextRoundAt: Date | null,
  ): Promise<TerritoryFactionWarRecord | null>;
  upgradeFavelaService(input: TerritoryFavelaServiceUpgradePersistenceInput): Promise<void>;
  updateFavelaState(favelaId: string, input: TerritoryFavelaStateUpdateInput): Promise<boolean>;
}

export interface TerritoryServiceContract {
  advanceFactionWarRound(playerId: string, favelaId: string): Promise<FactionWarRoundResponse>;
  declareFactionWar(playerId: string, favelaId: string): Promise<FactionWarDeclareResponse>;
  getFactionWar(playerId: string, favelaId: string): Promise<FactionWarStatusResponse>;
  getFavelaBaile(playerId: string, favelaId: string): Promise<FavelaBaileStatusResponse>;
  organizeFavelaBaile(
    playerId: string,
    favelaId: string,
    input: FavelaBaileOrganizeInput,
  ): Promise<FavelaBaileOrganizeResponse>;
  prepareFactionWar(
    playerId: string,
    favelaId: string,
    input: FactionWarPrepareInput,
  ): Promise<FactionWarPrepareResponse>;
  negotiatePropina(playerId: string, favelaId: string): Promise<FavelaPropinaNegotiationResponse>;
  attemptX9Desenrolo(playerId: string, favelaId: string): Promise<FavelaX9DesenroloResponse>;
  close?(): Promise<void>;
  conquerFavela(
    playerId: string,
    favelaId: string,
    input: FavelaConquestInput,
  ): Promise<FavelaConquestResponse>;
  installFavelaService(
    playerId: string,
    favelaId: string,
    input: FavelaServiceInstallInput,
  ): Promise<FavelaServiceMutationResponse>;
  listFavelaServices(playerId: string, favelaId: string): Promise<FavelaServicesResponse>;
  listTerritory(playerId: string): Promise<TerritoryOverviewResponse>;
  transitionFavelaState(
    playerId: string,
    favelaId: string,
    input: FavelaStateTransitionInput,
  ): Promise<FavelaStateTransitionResponse>;
  upgradeFavelaService(
    playerId: string,
    favelaId: string,
    serviceType: FavelaServiceType,
  ): Promise<FavelaServiceMutationResponse>;
}

export interface TerritoryServiceOptions {
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  gameConfigService?: GameConfigService;
  levelSystem?: LevelSystem;
  now?: () => Date;
  random?: () => number;
  repository?: TerritoryRepository;
}

type TerritoryErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'forbidden'
  | 'invalid_transition'
  | 'not_found'
  | 'validation';

export class TerritoryError extends Error {
  constructor(
    public readonly code: TerritoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TerritoryError';
  }
}

export class TerritoryService implements TerritoryServiceContract {
  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly gameConfigService: GameConfigService;

  private readonly levelSystem: LevelSystem;

  private readonly now: () => Date;

  private readonly random: () => number;

  private readonly repository: TerritoryRepository;

  constructor(options: TerritoryServiceOptions = {}) {
    this.factionUpgradeReader = options.factionUpgradeReader ?? new NoopFactionUpgradeEffectReader();
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseTerritoryRepository();
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
    const staminaCost = resolveTerritoryConquestStaminaCost(favela.difficulty);
    const nerveCost = resolveTerritoryConquestNerveCost(favela.difficulty);

    for (const participant of effectiveParticipants) {
      const lockReason = resolveTerritoryConquestLockReason(
        participant,
        favela.regionId,
        staminaCost,
        nerveCost,
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
          nerve: clamp(participant.player.resources.nerve - nerveCost, 0, 100),
          stamina: clamp(participant.player.resources.stamina - staminaCost, 0, 100),
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
          nerveSpent: nerveCost,
          staminaSpent: staminaCost,
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
        conceitoDelta: outcome.conceitoDelta,
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

  async getFactionWar(playerId: string, favelaId: string): Promise<FactionWarStatusResponse> {
    const player = await this.assertPlayerReady(playerId);
    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
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
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para declarar guerra.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem declarar guerra.');
    }

    const overviewBefore = await this.syncAndListFavelas();
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

    const latestWarBetweenFactions = await this.repository.findLatestFactionWarBetweenFactions(
      player.factionId,
      favelaBefore.controllingFaction.id,
    );

    if (
      latestWarBetweenFactions?.cooldownEndsAt &&
      latestWarBetweenFactions.cooldownEndsAt.getTime() > this.now().getTime()
    ) {
      throw new TerritoryError('conflict', 'Essa rivalidade ainda esta em cooldown para uma nova guerra.');
    }

    const declaredAt = this.now();
    const preparationEndsAt = new Date(declaredAt.getTime() + FACTION_WAR_PREPARATION_MS);

    await this.repository.createFactionWar({
      attackerFactionId: player.factionId,
      declaredAt,
      declaredByPlayerId: player.id,
      defenderFactionId: favelaBefore.controllingFaction.id,
      favelaId,
      favelaName: favelaBefore.name,
      preparationEndsAt,
      startsAt: preparationEndsAt,
    });

    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
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
    const player = await this.assertPlayerReady(playerId);

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para preparar a guerra.');
    }

    await this.assertFavelaManagementRank(player.rank);

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

    const overviewBefore = await this.syncAndListFavelas();
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

    if (warBefore.startsAt && new Date(warBefore.startsAt).getTime() <= this.now().getTime()) {
      throw new TerritoryError('conflict', 'A fase de preparacao da guerra ja terminou.');
    }

    const alreadyPrepared =
      side === 'attacker' ? warBefore.attackerPreparation : warBefore.defenderPreparation;

    if (alreadyPrepared) {
      throw new TerritoryError('conflict', 'Esse lado da guerra ja concluiu a preparacao.');
    }

    const participants = await this.repository.listFactionParticipants(player.factionId);
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

    const persisted = await this.repository.prepareFactionWar({
      budget,
      factionId: player.factionId,
      favelaName: favelaBefore.name,
      playerId: player.id,
      powerBonus,
      preparedAt: this.now(),
      regionPresenceCount: readyInRegion.length,
      side,
      soldierCommitment,
      warId: warBefore.id,
    });

    if (!persisted) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar a preparacao da guerra.');
    }

    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
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
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para comandar a guerra.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem comandar rounds de guerra.');
    }

    const syncedBefore = await this.syncAndListFavelas();
    const favelaBefore = syncedBefore.find((entry) => entry.id === favelaId);

    if (!favelaBefore?.war) {
      throw new TerritoryError('not_found', 'Nao existe guerra ativa para essa favela.');
    }

    let warBefore = favelaBefore.war;
    const side = resolveFactionWarSideForPlayer(player.factionId, warBefore);

    if (!side) {
      throw new TerritoryError('forbidden', 'Sua faccao nao participa desta guerra.');
    }

    const now = this.now();

    if ((warBefore.status === 'declared' || warBefore.status === 'preparing') && warBefore.startsAt) {
      const startsAt = new Date(warBefore.startsAt);

      if (startsAt.getTime() > now.getTime()) {
        throw new TerritoryError('conflict', 'A guerra ainda esta em fase de preparacao.');
      }

      const activated = await this.repository.updateFactionWarStatus(
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
      this.repository.listFactionParticipants(warBefore.attackerFaction.id),
      this.repository.listFactionParticipants(warBefore.defenderFaction.id),
    ]);
    const [attackerParticipants, defenderParticipants] = await Promise.all([
      Promise.all(
        attackerParticipantsRaw
          .filter((participant) => participant.regionId === favelaBefore.regionId)
          .map((participant) => this.applyFactionUpgradeEffects(participant)),
      ),
      Promise.all(
        defenderParticipantsRaw
          .filter((participant) => participant.regionId === favelaBefore.regionId)
          .map((participant) => this.applyFactionUpgradeEffects(participant)),
      ),
    ]);

    const attackerForce = resolveFactionWarSideForce({
      favela: favelaBefore,
      maxCrewSize: conquestPolicy.maxCrewSize,
      participants: attackerParticipants,
      preparation: warBefore.attackerPreparation,
      random: this.random,
      side: 'attacker',
    });
    const defenderForce = resolveFactionWarSideForce({
      favela: favelaBefore,
      maxCrewSize: conquestPolicy.maxCrewSize,
      participants: defenderParticipants,
      preparation: warBefore.defenderPreparation,
      random: this.random,
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
      attackerNerveLoss: entry.attackerNerveLoss,
      attackerPower: entry.attackerPower,
      attackerStaminaLoss: entry.attackerStaminaLoss,
      defenderHpLoss: entry.defenderHpLoss,
      defenderNerveLoss: entry.defenderNerveLoss,
      defenderPower: entry.defenderPower,
      defenderStaminaLoss: entry.defenderStaminaLoss,
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
      levelSystem: this.levelSystem,
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

    const persisted = await this.repository.persistFactionWarRound({
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

    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
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

  async getFavelaBaile(playerId: string, favelaId: string): Promise<FavelaBaileStatusResponse> {
    const player = await this.assertPlayerReady(playerId);
    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
    const favela = overview.favelas.find((entry) => entry.id === favelaId);

    if (!favela) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    return {
      ...overview,
      baile: buildFavelaBaileSummary(
        selectLatestBaileByFavela(await this.repository.listLatestBailes([favelaId])).get(favelaId) ?? null,
        this.now(),
      ),
      favela,
    };
  }

  async organizeFavelaBaile(
    playerId: string,
    favelaId: string,
    input: FavelaBaileOrganizeInput,
  ): Promise<FavelaBaileOrganizeResponse> {
    const player = await this.assertPlayerReady(playerId);

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para organizar baile.');
    }

    await this.assertFavelaManagementRank(player.rank);

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

    const overviewBefore = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
    const favelaBefore = overviewBefore.favelas.find((entry) => entry.id === favelaId);

    if (!favelaBefore) {
      throw new TerritoryError('not_found', 'Favela nao encontrada.');
    }

    if (favelaBefore.state !== 'controlled' || favelaBefore.controllingFaction?.id !== player.factionId) {
      throw new TerritoryError('conflict', 'Sua faccao precisa controlar a favela para organizar o baile.');
    }

    const latestBaile =
      selectLatestBaileByFavela(await this.repository.listLatestBailes([favelaId])).get(favelaId) ?? null;
    const currentBaileStatus = buildFavelaBaileSummary(latestBaile, this.now());

    if (currentBaileStatus.status !== 'ready') {
      throw new TerritoryError('conflict', 'A favela ainda esta em cooldown ou com baile ativo.');
    }

    const outcome = resolveFavelaBaileOutcome({
      budget,
      entryPrice,
      mcTier,
      random: this.random,
      satisfaction: favelaBefore.satisfaction,
    });
    const organizedAt = this.now();
    const activeEndsAt = resolveFavelaBaileActiveEndsAt(organizedAt, outcome.resultTier, mcTier);
    const hangoverEndsAt = resolveFavelaBaileHangoverEndsAt(activeEndsAt, organizedAt, outcome.resultTier);
    const cooldownEndsAt = new Date(organizedAt.getTime() + BAILE_COOLDOWN_MS);
    const satisfactionAfter = clamp(favelaBefore.satisfaction + outcome.satisfactionDelta, 0, 100);

    const baileRecord = await this.repository.organizeFavelaBaile({
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
      staminaBoostPercent: outcome.staminaBoostPercent,
    });

    const overview = buildTerritoryOverview(player.factionId, await this.syncAndListFavelas());
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

  async negotiatePropina(playerId: string, favelaId: string): Promise<FavelaPropinaNegotiationResponse> {
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
    );

    if (!player.factionId || !player.rank) {
      throw new TerritoryError('forbidden', 'Voce precisa pertencer a uma faccao para negociar arrego.');
    }

    if (!conquestPolicy.commandRanks.includes(player.rank)) {
      throw new TerritoryError('forbidden', 'Apenas patrao ou general podem negociar o arrego da favela.');
    }

    const overviewBefore = await this.syncAndListFavelas();
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
    const success = this.random() <= successChance;
    const discountRate = success ? resolveFavelaPropinaNegotiationDiscountRate(player) : 0;
    const nextPropinaValue = roundCurrency(favelaBefore.propina.baseAmount * (1 - discountRate));
    const negotiatedAt = this.now();

    const persisted = await this.repository.negotiateFavelaPropina({
      discountRate,
      favelaId,
      negotiatedAt,
      negotiatedByPlayerId: player.id,
      nextPropinaValue,
    });

    if (!persisted) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar a negociacao da propina.');
    }

    const syncedAfter = await this.syncAndListFavelas();
    const overview = buildTerritoryOverview(player.factionId, syncedAfter);
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

  async attemptX9Desenrolo(playerId: string, favelaId: string): Promise<FavelaX9DesenroloResponse> {
    const player = await this.assertPlayerReady(playerId);
    const conquestPolicy = resolveTerritoryConquestPolicy(
      await this.gameConfigService.getResolvedCatalog(),
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

    const overviewBefore = await this.syncAndListFavelas();
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

    const faction = await this.repository.getFaction(player.factionId);

    if (!faction) {
      throw new TerritoryError('not_found', 'Faccao nao encontrada.');
    }

    const attemptedAt = this.now();
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
    const success = this.random() <= successChance;
    const releaseAt = success
      ? attemptedAt
      : new Date(attemptedAt.getTime() + resolveX9FailedDesenroloDays(this.random) * ONE_DAY_MS);

    const updatedEvent = await this.repository.resolveX9Desenrolo({
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

    const syncedAfter = await this.syncAndListFavelas();
    const overview = buildTerritoryOverview(player.factionId, syncedAfter);
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

    for (const favela of favelasList) {
      const synced = syncFavelaState(favela, now);

      if (!synced.changed) {
        continue;
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

    await this.syncFavelaPropina(favelasList, now);

    const satisfactionContexts = await this.syncFavelaSatisfaction(favelasList, now);
    const x9EventsByFavelaId = await this.syncFavelaX9(favelasList, satisfactionContexts, now);
    const warsByFavelaId = await this.syncFactionWars(favelasList, now);

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

  private async syncFavelaPropina(
    favelasList: TerritoryFavelaRecord[],
    now: Date,
  ): Promise<void> {
    if (favelasList.length === 0) {
      return;
    }

    const propinaPolicy = resolveCachedTerritoryPropinaPolicy();
    const syncUpdates: TerritoryFavelaPropinaSyncUpdate[] = [];

    for (const favela of favelasList) {
      if (favela.state !== 'controlled' || !favela.controllingFactionId) {
        if (shouldResetFavelaPropina(favela)) {
          syncUpdates.push(buildResetFavelaPropinaSyncUpdate(favela.id));
          applyFavelaPropinaSyncUpdate(favela, buildResetFavelaPropinaSyncUpdate(favela.id));
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
          now.getTime() + resolveFavelaPropinaStateTakeoverDays(this.random) * ONE_DAY_MS,
        );

        await this.repository.updateFavelaState(favela.id, {
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
        continue;
      }

      if (favela.propinaDueDate.getTime() > now.getTime()) {
        continue;
      }

      const paid = await this.repository.payFavelaPropina({
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
      await this.repository.persistFavelaPropinaSync(syncUpdates);
    }
  }

  private async requireLatestX9EventForFavela(favelaId: string): Promise<TerritoryX9EventRecord> {
    const latestEvent = selectLatestX9EventByFavela(
      await this.repository.listX9Events([favelaId]),
    ).get(favelaId);

    if (!latestEvent) {
      throw new TerritoryError('not_found', 'Nao existe evento de X9 registrado para essa favela.');
    }

    return latestEvent;
  }

  private async syncFavelaX9(
    favelasList: TerritoryFavelaRecord[],
    satisfactionContexts: Map<string, TerritoryFavelaSatisfactionContext>,
    now: Date,
  ): Promise<Map<string, TerritoryX9EventRecord | null>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const eventsByFavela = new Map<string, TerritoryX9EventRecord | null>(
      selectLatestX9EventByFavela(
        await this.repository.listX9Events(favelasList.map((favela) => favela.id)),
      ),
    );
    const rollUpdates: TerritoryFavelaX9RollSyncUpdate[] = [];

    for (const favela of favelasList) {
      let latestEvent = eventsByFavela.get(favela.id) ?? null;

      if (latestEvent?.status === 'warning' && latestEvent.warningEndsAt && latestEvent.warningEndsAt <= now) {
        const exposure = await this.repository.getFavelaX9Exposure(favela.id);
        const incursionAt = latestEvent.warningEndsAt;
        const impacts = buildTerritoryX9IncursionImpacts({
          exposure,
          favela,
          random: this.random,
        });
        const nextSatisfaction = clamp(favela.satisfaction - 10, 0, 100);

        latestEvent = await this.repository.applyX9Incursion({
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
        latestEvent = await this.repository.releaseX9Soldiers(latestEvent.id, latestEvent.soldiersReleaseAt);
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
      const riskPercent = buildFavelaSatisfactionProfile({
        activeEvents: currentContext?.events ?? [],
        now,
        propertyStats: currentContext?.propertyStats ?? buildEmptyFavelaPropertyStats(favela.id),
        satisfaction: favela.satisfaction,
        services: currentContext?.services ?? [],
        state: favela.state,
      }).dailyX9RiskPercent;

      let nextLastRollAt = favela.lastX9RollAt;

      for (let dayIndex = 0; dayIndex < daysElapsed; dayIndex += 1) {
        const rollAt = new Date(favela.lastX9RollAt.getTime() + (dayIndex + 1) * ONE_DAY_MS);
        nextLastRollAt = rollAt;

        if (this.random() > riskPercent / 100) {
          continue;
        }

        latestEvent = await this.repository.createX9Warning({
          favelaId: favela.id,
          status: 'warning',
          triggeredAt: rollAt,
          warningEndsAt: new Date(
            rollAt.getTime() + resolveX9WarningHours(this.random) * 60 * 60 * 1000,
          ),
        });

        if (latestEvent.warningEndsAt && latestEvent.warningEndsAt <= now) {
          const exposure = await this.repository.getFavelaX9Exposure(favela.id);
          const incursionAt = latestEvent.warningEndsAt;
          const impacts = buildTerritoryX9IncursionImpacts({
            exposure,
            favela,
            random: this.random,
          });
          const nextSatisfaction = clamp(favela.satisfaction - 10, 0, 100);

          latestEvent = await this.repository.applyX9Incursion({
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
      await this.repository.persistFavelaX9RollSync(rollUpdates);
    }

    return eventsByFavela;
  }

  private async syncFactionWars(
    favelasList: TerritoryFavelaRecord[],
    now: Date,
  ): Promise<Map<string, TerritoryFactionWarRecord | null>> {
    if (favelasList.length === 0) {
      return new Map();
    }

    const latestWarsByFavela = selectLatestFactionWarByFavela(
      await this.repository.listFactionWars(favelasList.map((favela) => favela.id)),
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
        latestWar = await this.repository.updateFactionWarStatus(
          latestWar.id,
          'active',
          latestWar.nextRoundAt ?? latestWar.startsAt,
        );
      }

      result.set(favela.id, latestWar);
    }

    return result;
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

type TerritoryResolvedFavela = TerritoryFavelaSummary;

function assertFavelaCanBeConquered(favela: TerritoryResolvedFavela, actorFactionId: string): void {
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

function resolveFavelaTransition(input: {
  action: FavelaStateTransitionInput['action'];
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

function syncFavelaState(
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

function buildTerritoryBossSummary(favela: Pick<TerritoryResolvedFavela, 'difficulty' | 'name' | 'population'>): TerritoryBossSummary {
  return {
    difficulty: favela.difficulty,
    label: `Chefe local de ${favela.name}`,
    power: Math.round(2500 + favela.difficulty * 1000 + favela.population * 0.12),
  };
}

function buildTerritoryConquestMessage(favelaName: string, success: boolean): string {
  if (success) {
    return `O bonde tomou ${favelaName} e iniciou a estabilizacao do territorio.`;
  }

  return `A invasao em ${favelaName} falhou e o bonde recuou.`;
}

function buildTerritoryOverview(
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

function buildFactionWarSummary(
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

function buildFactionWarRoundSummary(round: TerritoryFactionWarRoundRecord): FactionWarRoundSummary {
  return {
    attackerHpLoss: round.attackerHpLoss,
    attackerNerveLoss: round.attackerNerveLoss,
    attackerPower: round.attackerPower,
    attackerStaminaLoss: round.attackerStaminaLoss,
    defenderHpLoss: round.defenderHpLoss,
    defenderNerveLoss: round.defenderNerveLoss,
    defenderPower: round.defenderPower,
    defenderStaminaLoss: round.defenderStaminaLoss,
    message: round.message,
    outcome: round.outcome,
    resolvedAt: round.resolvedAt.toISOString(),
    roundNumber: round.roundNumber,
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

function resolveFactionWarPreparationPowerBonus(input: {
  budget: number;
  regionPresenceCount: number;
  soldierCommitment: number;
}): number {
  return Math.round(
    input.budget * 0.06 + input.soldierCommitment * 450 + input.regionPresenceCount * 220,
  );
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

function resolveFactionWarRoundOutcome(
  attackerPower: number,
  defenderPower: number,
): FactionWarRoundOutcome {
  if (attackerPower > defenderPower) {
    return 'attacker';
  }

  if (defenderPower > attackerPower) {
    return 'defender';
  }

  return 'draw';
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
      attackerNerveLoss: 6 + Math.round(intensity * 0.3),
      attackerPower: input.attackerPower,
      attackerStaminaLoss: 10 + Math.round(intensity * 0.5),
      defenderHpLoss: 16 + intensity,
      defenderNerveLoss: 10 + Math.round(intensity * 0.5),
      defenderPower: input.defenderPower,
      defenderStaminaLoss: 14 + intensity,
      message: `Round ${input.roundNumber}: o ataque abriu vantagem e empurrou a defesa para tras.`,
      outcome: input.outcome,
      resolvedAt: input.resolvedAt,
      roundNumber: input.roundNumber,
    };
  }

  if (input.outcome === 'defender') {
    return {
      attackerHpLoss: 16 + intensity,
      attackerNerveLoss: 10 + Math.round(intensity * 0.5),
      attackerPower: input.attackerPower,
      attackerStaminaLoss: 14 + intensity,
      defenderHpLoss: 8 + Math.round(intensity * 0.5),
      defenderNerveLoss: 6 + Math.round(intensity * 0.3),
      defenderPower: input.defenderPower,
      defenderStaminaLoss: 10 + Math.round(intensity * 0.5),
      message: `Round ${input.roundNumber}: a defesa segurou a linha e conteve o bonde invasor.`,
      outcome: input.outcome,
      resolvedAt: input.resolvedAt,
      roundNumber: input.roundNumber,
    };
  }

  return {
    attackerHpLoss: 12 + intensity,
    attackerNerveLoss: 8 + Math.round(intensity * 0.4),
    attackerPower: input.attackerPower,
    attackerStaminaLoss: 12 + intensity,
    defenderHpLoss: 12 + intensity,
    defenderNerveLoss: 8 + Math.round(intensity * 0.4),
    defenderPower: input.defenderPower,
    defenderStaminaLoss: 12 + intensity,
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
      nerveLoss: number;
      staminaLoss: number;
    },
    conceitoDelta: number,
  ) => {
    for (const participant of participants) {
      const nextResources = {
        conceito: Math.max(0, participant.player.resources.conceito + conceitoDelta),
        hp: clamp(participant.player.resources.hp - losses.hpLoss, 0, 100),
        nerve: clamp(participant.player.resources.nerve - losses.nerveLoss, 0, 100),
        stamina: clamp(participant.player.resources.stamina - losses.staminaLoss, 0, 100),
      };
      const levelProgression = input.levelSystem.resolve(
        nextResources.conceito,
        participant.player.level,
      );

      updates.push({
        conceitoDelta,
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
      nerveLoss: input.attackerLosses.attackerNerveLoss,
      staminaLoss: input.attackerLosses.attackerStaminaLoss,
    },
    input.attackerConceitoDelta,
  );
  pushUpdates(
    input.defenderParticipants,
    {
      hpLoss: input.defenderLosses.defenderHpLoss,
      nerveLoss: input.defenderLosses.defenderNerveLoss,
      staminaLoss: input.defenderLosses.defenderStaminaLoss,
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

function buildStabilizationEndsAt(now: Date, stabilizationHours: number): Date {
  return new Date(now.getTime() + stabilizationHours * 60 * 60 * 1000);
}

function calculateTerritoryHpLoss(difficulty: number, combinedPower: number, bossPower: number): number {
  const overwhelmed = combinedPower < bossPower * 0.75;
  return Math.max(10, difficulty * 4 + (overwhelmed ? 12 : 0));
}

function calculateTerritoryPlayerPower(participant: TerritoryParticipantRecord): number {
  const weaponPower =
    participant.equipment.weapon && (participant.equipment.weapon.durability ?? 0) > 0
      ? resolveWeaponEffectivePower(
          participant.equipment.weapon.power,
          participant.equipment.weapon.proficiency,
        )
      : 0;
  const vestDefense =
    participant.equipment.vest && (participant.equipment.vest.durability ?? 0) > 0
      ? participant.equipment.vest.defense
      : 0;
  const attributePower =
    participant.attributes.forca * 8 +
    participant.attributes.inteligencia * 6 +
    participant.attributes.resistencia * 7 +
    participant.attributes.carisma * 5;
  const equipmentPower = weaponPower + vestDefense * 6;
  const factionBonus = participant.factionId ? 1.08 : 1;
  const vocationMultiplier = resolveVocationPowerMultiplier(participant.player.vocation);

  return Math.round(
    (attributePower + equipmentPower + participant.player.level * 10) *
      factionBonus *
      vocationMultiplier,
  );
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

function resolveCoordinationMultiplier(
  participantCount: number,
  coordinationBonusPerExtraMember: number = TERRITORY_COORDINATION_BONUS_PER_EXTRA_MEMBER,
): number {
  return roundMultiplier(
    1 + Math.max(0, participantCount - 1) * coordinationBonusPerExtraMember,
  );
}

function resolveTerritoryConceitoReward(difficulty: number, population: number): number {
  return Math.round(difficulty * 18 + population / 3500);
}

function resolveTerritoryConquestLockReason(
  participant: TerritoryParticipantRecord,
  regionId: RegionId,
  staminaCost: number,
  nerveCost: number,
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

  if (participant.player.resources.stamina < staminaCost) {
    return `Estamina insuficiente. Requer ${staminaCost}.`;
  }

  if (participant.player.resources.nerve < nerveCost) {
    return `Nervos insuficientes. Requer ${nerveCost}.`;
  }

  return null;
}

function resolveTerritoryConquestNerveCost(difficulty: number): number {
  return clamp(8 + difficulty, 10, 20);
}

function resolveTerritoryConquestStaminaCost(difficulty: number): number {
  return clamp(12 + difficulty * 2, 16, 36);
}

function resolveVocationPowerMultiplier(vocation: VocationType): number {
  switch (vocation) {
    case VocationType.Cria:
      return 1.02;
    case VocationType.Gerente:
      return 1;
    case VocationType.Soldado:
      return 1.08;
    case VocationType.Politico:
      return 0.96;
    case VocationType.Empreendedor:
      return 1.01;
    default:
      return 1;
  }
}

function resolveWeaponEffectivePower(basePower: number, proficiency: number): number {
  if (proficiency <= 0) {
    return basePower;
  }

  const steps = Math.floor(Math.min(100, proficiency) / 10);

  if (steps < 1) {
    return basePower;
  }

  return Math.round(basePower * (1 + steps * 0.02));
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

function buildFavelaPropinaSummary(
  favela: TerritoryFavelaRecord,
  now: Date,
): FavelaPropinaSummary | null {
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
  staminaBoostPercent: number;
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
      staminaBoostPercent: input.mcTier === 'estelar' ? 35 : 30,
    };
  }

  if (input.satisfaction >= 50) {
    return {
      factionPointsDelta: Math.round(300 * mcMultiplier * budgetMultiplier),
      incidentCode: priceyEntry ? 'fila_cara' : null,
      resultTier: 'success',
      satisfactionDelta: 15,
      staminaBoostPercent: input.mcTier === 'estelar' ? 24 : 20,
    };
  }

  if (input.satisfaction >= 30) {
    return {
      factionPointsDelta: 0,
      incidentCode: priceyEntry ? 'fila_cara' : 'confusao_controlada',
      resultTier: 'mixed',
      satisfactionDelta: 5,
      staminaBoostPercent: 0,
    };
  }

  return {
    factionPointsDelta: -200,
    incidentCode: input.random() < 0.5 ? 'briga_generalizada' : 'pm_na_porta',
    resultTier: 'failure',
    satisfactionDelta: -10,
    staminaBoostPercent: 0,
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

function buildFavelaBaileSummary(
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
      staminaBoostPercent: null,
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
    staminaBoostPercent: record.staminaBoostPercent,
    status: resolveFavelaBaileStatus(record, now),
  };
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

function buildFavelaX9Summary(
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

function buildTerritoryX9IncursionImpacts(input: {
  exposure: TerritoryFavelaX9Exposure;
  favela: Pick<TerritoryFavelaRecord, 'difficulty'>;
  random: () => number;
}): {
  baseMoneyCost: number;
  basePointsCost: number;
  cashImpacts: Array<{
    kind: TerritoryBusinessCashTargetKind;
    lostAmount: number;
    propertyId: string;
  }>;
  drugImpacts: Array<{
    drugId: string;
    kind: TerritoryBusinessDrugTargetKind;
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
