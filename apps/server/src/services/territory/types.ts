import type {
  FactionWarDeclareResponse,
  FactionWarPrepareInput,
  FactionWarPrepareResponse,
  FactionWarRoundOutcome,
  FactionWarRoundResponse,
  FactionWarSide,
  FactionWarStatus,
  FactionWarStatusResponse,
  FavelaBaileMcTier,
  FavelaBaileOrganizeInput,
  FavelaBaileOrganizeResponse,
  FavelaBaileResultTier,
  FavelaBaileStatusResponse,
  FavelaConquestInput,
  FavelaConquestResponse,
  FavelaControlState,
  FavelaPropinaNegotiationResponse,
  FavelaServiceInstallInput,
  FavelaServiceMutationResponse,
  FavelaServicesResponse,
  FavelaServiceType,
  FavelaStateTransitionInput,
  FavelaStateTransitionResponse,
  FavelaX9DesenroloResponse,
  FavelaX9Status,
  FactionRank,
  PlayerResources,
  RegionId,
  TerritoryFavelaSummary,
  TerritoryLossFeedResponse,
  TerritoryOverviewResponse,
  VocationType,
} from '@cs-rio/shared';

import type { LevelSystem } from '../../systems/LevelSystem.js';
import { DomainError, inferDomainErrorCategory } from '../../errors/domain-error.js';
import { type BanditReturnFlavor } from '../favela-force.js';
import { type FactionUpgradeEffectReaderContract } from '../faction.js';
import type { GameConfigService } from '../game-config.js';
import type { KeyValueWriter } from '../key-value-store.js';

export type TerritorySatisfactionProfile = TerritoryFavelaSummary['satisfactionProfile'];
export type TerritorySatisfactionFactorSummary = TerritorySatisfactionProfile['factors'][number];
export type TerritorySatisfactionTier = TerritorySatisfactionProfile['tier'];

export interface TerritoryPlayerRecord {
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

export interface TerritoryFactionRecord {
  abbreviation: string;
  bankMoney: number;
  id: string;
  internalSatisfaction: number;
  name: string;
  points: number;
}

export interface TerritoryRegionRecord {
  densityIndex: number;
  id: RegionId;
  operationCostMultiplier: number;
  policePressure: number;
  wealthIndex: number;
}

export interface TerritoryFavelaRecord {
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

export interface TerritoryFavelaStateUpdateInput {
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

export interface TerritoryFavelaServiceRecord {
  active: boolean;
  favelaId: string;
  grossRevenueTotal: number;
  id: string;
  installedAt: Date;
  lastRevenueAt: Date;
  level: number;
  serviceType: FavelaServiceType;
}

export interface TerritoryFavelaBanditReturnRecord {
  favelaId: string;
  id: string;
  quantity: number;
  releaseAt: Date;
  returnFlavor: BanditReturnFlavor;
}

export interface TerritoryFavelaBanditSyncUpdate {
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  banditsSyncedAt: Date;
  favelaId: string;
}

export interface TerritoryFavelaBaileRecord {
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
  cansacoBoostPercent: number;
}

export interface TerritoryFactionWarPreparationRecord {
  budget: number;
  powerBonus: number;
  preparedAt: Date;
  preparedByPlayerId: string;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
}

export interface TerritoryFactionWarRoundRecord {
  attackerHpLoss: number;
  attackerDisposicaoLoss: number;
  attackerPower: number;
  attackerCansacoLoss: number;
  defenderHpLoss: number;
  defenderDisposicaoLoss: number;
  defenderPower: number;
  defenderCansacoLoss: number;
  message: string;
  outcome: FactionWarRoundOutcome;
  resolvedAt: Date;
  roundNumber: number;
}

export interface TerritoryFactionWarRecord {
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

export interface TerritoryFavelaPropertyStatsRecord {
  activePropertyCount: number;
  favelaId: string;
  soldiersCount: number;
  suspendedPropertyCount: number;
}

export type TerritorySatisfactionEventType =
  | 'baile_cidade'
  | 'blitz_pm'
  | 'faca_na_caveira'
  | 'operacao_policial';

export interface TerritorySatisfactionEventRecord {
  eventType: TerritorySatisfactionEventType;
  favelaId: string | null;
  regionId: RegionId | null;
}

export interface TerritoryParticipantWeapon {
  durability: number | null;
  inventoryItemId: string;
  power: number;
  proficiency: number;
}

export interface TerritoryParticipantVest {
  defense: number;
  durability: number | null;
  inventoryItemId: string;
}

export interface TerritoryParticipantRecord {
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
    resources: Pick<PlayerResources, 'conceito' | 'hp' | 'disposicao' | 'cansaco'>;
    vocation: VocationType;
  };
  rank: FactionRank;
  regionId: RegionId;
}

export interface TerritoryConquestParticipantPersistenceUpdate {
  cansacoDelta: number;
  conceitoDelta: number;
  disposicaoDelta: number;
  favelaName: string;
  hpDelta: number;
  logType: 'territory_conquest_failure' | 'territory_conquest_success';
  nextLevel: number;
  nextResources: Pick<PlayerResources, 'conceito' | 'hp' | 'disposicao' | 'cansaco'>;
  playerId: string;
}

export interface TerritoryConquestPersistenceInput {
  favelaId: string;
  nextFavelaState: TerritoryFavelaStateUpdateInput | null;
  nextSatisfaction: number | null;
  nextSatisfactionSyncedAt: Date | null;
  participantUpdates: TerritoryConquestParticipantPersistenceUpdate[];
}

export interface TerritoryFavelaServiceSyncUpdate {
  grossRevenueTotal: number;
  id: string;
  lastRevenueAt: Date;
}

export interface TerritoryFavelaSatisfactionContext {
  events: TerritorySatisfactionEventRecord[];
  propertyStats: TerritoryFavelaPropertyStatsRecord;
  services: TerritoryFavelaServiceRecord[];
}

export interface TerritoryFavelaServiceSyncPersistenceInput {
  factionId: string | null;
  favelaName: string;
  now: Date;
  revenueDelta: number;
  serviceUpdates: TerritoryFavelaServiceSyncUpdate[];
}

export interface TerritoryFavelaSatisfactionSyncUpdate {
  favelaId: string;
  nextSatisfaction: number;
  nextSyncedAt: Date;
}

export interface TerritoryFavelaX9RollSyncUpdate {
  favelaId: string;
  nextLastRollAt: Date;
}

export interface TerritoryFavelaPropinaSyncUpdate {
  favelaId: string;
  nextDiscountRate: number;
  nextDueDate: Date | null;
  nextLastPaidAt: Date | null;
  nextNegotiatedAt: Date | null;
  nextNegotiatedByPlayerId: string | null;
  nextPropinaValue: number;
}

export interface TerritoryX9SoldierImpactRecord {
  count: number;
  propertyId: string;
}

export interface TerritoryX9EventRecord {
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

export type TerritoryBusinessCashTargetKind =
  | 'boca'
  | 'front_store'
  | 'puteiro'
  | 'rave'
  | 'slot_machine';

export type TerritoryBusinessDrugTargetKind = 'boca' | 'factory' | 'rave';

export interface TerritoryX9CashTargetRecord {
  cashBalance: number;
  kind: TerritoryBusinessCashTargetKind;
  propertyId: string;
}

export interface TerritoryX9DrugTargetRecord {
  drugId: string;
  kind: TerritoryBusinessDrugTargetKind;
  propertyId: string;
  quantity: number;
}

export interface TerritoryX9SoldierTargetRecord {
  propertyId: string;
  soldiersCount: number;
}

export interface TerritoryFavelaX9Exposure {
  cashTargets: TerritoryX9CashTargetRecord[];
  drugTargets: TerritoryX9DrugTargetRecord[];
  soldierTargets: TerritoryX9SoldierTargetRecord[];
}

export interface TerritoryCreateX9WarningInput {
  favelaId: string;
  status: FavelaX9Status;
  triggeredAt: Date;
  warningEndsAt: Date;
}

export interface TerritoryApplyX9IncursionInput {
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

export interface TerritoryResolveX9DesenroloInput {
  actorPlayerId: string;
  attemptedAt: Date;
  eventId: string;
  factionId: string;
  moneySpent: number;
  pointsSpent: number;
  releaseAt: Date;
  success: boolean;
}

export interface TerritoryFavelaPropinaPaymentInput {
  amount: number;
  factionId: string;
  favelaId: string;
  nextDueAt: Date;
  now: Date;
  playerId: string | null;
  nextPropinaValue: number;
}

export interface TerritoryFavelaPropinaNegotiationInput {
  discountRate: number;
  favelaId: string;
  negotiatedAt: Date;
  negotiatedByPlayerId: string;
  nextPropinaValue: number;
}

export interface TerritoryFavelaServiceInstallPersistenceInput {
  factionId: string;
  favelaId: string;
  favelaName: string;
  installedAt: Date;
  playerId: string;
  serviceType: FavelaServiceType;
}

export interface TerritoryFavelaBailePersistenceInput {
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
  cansacoBoostPercent: number;
}

export interface TerritoryFactionWarCreateInput {
  attackerFactionId: string;
  declaredAt: Date;
  declaredByPlayerId: string;
  defenderFactionId: string;
  favelaId: string;
  favelaName: string;
  preparationEndsAt: Date;
  startsAt: Date;
}

export interface TerritoryFactionWarPreparePersistenceInput {
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

export interface TerritoryFactionWarParticipantPersistenceUpdate {
  cansacoDelta: number;
  conceitoDelta: number;
  disposicaoDelta: number;
  hpDelta: number;
  nextLevel: number;
  nextResources: Pick<PlayerResources, 'conceito' | 'hp' | 'disposicao' | 'cansaco'>;
  playerId: string;
}

export interface TerritoryFactionWarRoundPersistenceInput {
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

export interface TerritoryFavelaServiceUpgradePersistenceInput {
  factionId: string;
  favelaId: string;
  favelaName: string;
  nextLevel: number;
  now: Date;
  playerId: string;
  satisfactionAfter: number;
  serviceType: FavelaServiceType;
}

export interface TerritoryCoreReadRepository {
  getFavela(favelaId: string): Promise<TerritoryFavelaRecord | null>;
  getFaction(factionId: string): Promise<TerritoryFactionRecord | null>;
  getPlayer(playerId: string): Promise<TerritoryPlayerRecord | null>;
  getRegion(regionId: RegionId): Promise<TerritoryRegionRecord | null>;
  listFactionParticipants(factionId: string): Promise<TerritoryParticipantRecord[]>;
  listFactionsByIds(factionIds: string[]): Promise<TerritoryFactionRecord[]>;
  listFavelaServices(favelaId: string): Promise<TerritoryFavelaServiceRecord[]>;
  listFavelas(): Promise<TerritoryFavelaRecord[]>;
}

export interface TerritoryOverviewReadRepository {
  findLatestFactionWarBetweenFactions(
    attackerFactionId: string,
    defenderFactionId: string,
  ): Promise<TerritoryFactionWarRecord | null>;
  getFavelaX9Exposure(favelaId: string): Promise<TerritoryFavelaX9Exposure>;
  listActiveSatisfactionEvents(
    regionIds: RegionId[],
    favelaIds: string[],
    now: Date,
  ): Promise<TerritorySatisfactionEventRecord[]>;
  listAllFavelaServices(favelaIds: string[]): Promise<TerritoryFavelaServiceRecord[]>;
  listFavelaBanditReturns(favelaIds: string[]): Promise<TerritoryFavelaBanditReturnRecord[]>;
  listFactionWars(favelaIds: string[]): Promise<TerritoryFactionWarRecord[]>;
  listFavelaPropertyStats(favelaIds: string[]): Promise<TerritoryFavelaPropertyStatsRecord[]>;
  listLatestBailes(favelaIds: string[]): Promise<TerritoryFavelaBaileRecord[]>;
  listX9Events(favelaIds: string[]): Promise<TerritoryX9EventRecord[]>;
}

export interface TerritoryConquestRepository {
  persistConquestAttempt(input: TerritoryConquestPersistenceInput): Promise<void>;
  persistFavelaBanditSync(input: {
    releasedReturnIds: string[];
    updates: TerritoryFavelaBanditSyncUpdate[];
  }): Promise<void>;
  persistFavelaSatisfactionSync(updates: TerritoryFavelaSatisfactionSyncUpdate[]): Promise<void>;
  updateFavelaState(favelaId: string, input: TerritoryFavelaStateUpdateInput): Promise<boolean>;
}

export interface TerritoryFavelaServiceRepository {
  installFavelaService(input: TerritoryFavelaServiceInstallPersistenceInput): Promise<void>;
  persistFavelaServiceSync(input: TerritoryFavelaServiceSyncPersistenceInput): Promise<void>;
  upgradeFavelaService(input: TerritoryFavelaServiceUpgradePersistenceInput): Promise<void>;
}

export interface TerritoryWarRepository {
  createFactionWar(input: TerritoryFactionWarCreateInput): Promise<TerritoryFactionWarRecord>;
  persistFactionWarRound(input: TerritoryFactionWarRoundPersistenceInput): Promise<TerritoryFactionWarRecord | null>;
  prepareFactionWar(input: TerritoryFactionWarPreparePersistenceInput): Promise<TerritoryFactionWarRecord | null>;
  updateFactionWarStatus(
    warId: string,
    nextStatus: FactionWarStatus,
    nextRoundAt: Date | null,
  ): Promise<TerritoryFactionWarRecord | null>;
}

export interface TerritoryPropinaRepository {
  negotiateFavelaPropina(input: TerritoryFavelaPropinaNegotiationInput): Promise<boolean>;
  payFavelaPropina(input: TerritoryFavelaPropinaPaymentInput): Promise<boolean>;
  persistFavelaPropinaSync(updates: TerritoryFavelaPropinaSyncUpdate[]): Promise<void>;
}

export interface TerritoryX9Repository {
  applyX9Incursion(input: TerritoryApplyX9IncursionInput): Promise<TerritoryX9EventRecord | null>;
  createX9Warning(input: TerritoryCreateX9WarningInput): Promise<TerritoryX9EventRecord>;
  persistFavelaX9RollSync(updates: TerritoryFavelaX9RollSyncUpdate[]): Promise<void>;
  releaseX9Soldiers(eventId: string, releasedAt: Date): Promise<TerritoryX9EventRecord | null>;
  resolveX9Desenrolo(input: TerritoryResolveX9DesenroloInput): Promise<TerritoryX9EventRecord | null>;
}

export interface TerritoryBaileRepository {
  organizeFavelaBaile(input: TerritoryFavelaBailePersistenceInput): Promise<TerritoryFavelaBaileRecord>;
}

export type TerritoryReadRepository = TerritoryCoreReadRepository & TerritoryOverviewReadRepository;
export type TerritoryFactionWarRepository =
  TerritoryCoreReadRepository &
  TerritoryOverviewReadRepository &
  TerritoryWarRepository;
export type TerritoryPropinaDomainRepository = TerritoryConquestRepository & TerritoryPropinaRepository;
export type TerritoryX9DomainRepository =
  TerritoryCoreReadRepository &
  TerritoryOverviewReadRepository &
  TerritoryX9Repository;
export type TerritoryBaileDomainRepository = TerritoryOverviewReadRepository & TerritoryBaileRepository;
export type TerritoryRepository =
  TerritoryCoreReadRepository &
  TerritoryOverviewReadRepository &
  TerritoryConquestRepository &
  TerritoryFavelaServiceRepository &
  TerritoryWarRepository &
  TerritoryPropinaRepository &
  TerritoryX9Repository &
  TerritoryBaileRepository;

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
  listTerritoryLosses(playerId: string): Promise<TerritoryLossFeedResponse>;
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
  keyValueStore?: KeyValueWriter;
  levelSystem?: LevelSystem;
  now?: () => Date;
  random?: () => number;
  repository?: TerritoryRepository;
}

export type TerritoryErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'forbidden'
  | 'invalid_transition'
  | 'not_found'
  | 'validation';

export function territoryError(code: TerritoryErrorCode, message: string): DomainError {
  return new DomainError('territory', code, inferDomainErrorCategory(code), message);
}

export class TerritoryError extends DomainError {
  constructor(
    code: TerritoryErrorCode,
    message: string,
  ) {
    super('territory', code, inferDomainErrorCategory(code), message);
    this.name = 'TerritoryError';
  }
}
