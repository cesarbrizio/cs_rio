import type {
  FactionRank,
  FavelaControlState,
  FavelaServiceType,
  PlayerResources,
  PlayerSummary,
  RegionId,
  TribunalCaseSeverity,
  TribunalCaseSide,
  TribunalCaseType,
  TribunalPunishment,
} from '../types.js';

export interface Faction {
  id: string;
  name: string;
  abbreviation: string;
  isFixed: boolean;
  regionBonuses: Partial<Record<RegionId, number>>;
}

export interface Favela {
  id: string;
  name: string;
  regionId: RegionId;
  population: number;
  difficulty: number;
  satisfaction: number;
}

export interface FavelaFactionSummary {
  abbreviation: string;
  id: string;
  name: string;
}

export type FavelaSatisfactionTier =
  | 'happy'
  | 'stable'
  | 'restless'
  | 'critical'
  | 'collapsed';

export type FavelaSatisfactionFactorCode =
  | 'services'
  | 'security'
  | 'peace'
  | 'war'
  | 'police_pressure'
  | 'state_control'
  | 'baile';

export interface FavelaSatisfactionFactorSummary {
  code: FavelaSatisfactionFactorCode;
  dailyDelta: number;
  label: string;
}

export interface FavelaSatisfactionProfile {
  dailyDeltaEstimate: number;
  dailyX9RiskPercent: number;
  factors: FavelaSatisfactionFactorSummary[];
  populationPressurePercentPerDay: number;
  revenueMultiplier: number;
  tier: FavelaSatisfactionTier;
}

export interface FavelaSoldierForceSummary {
  active: number;
  max: number;
  occupancyPercent: number;
}

export interface FavelaBanditForceSummary {
  active: number;
  arrested: number;
  deadRecent: number;
  nextReturnAt: string | null;
  scheduledReturnBatches: number;
  syncedAt: string;
  targetActive: number;
}

export interface TerritoryFavelaSummary {
  bandits: FavelaBanditForceSummary;
  code: string;
  contestingFaction: FavelaFactionSummary | null;
  controllingFaction: FavelaFactionSummary | null;
  difficulty: number;
  id: string;
  name: string;
  population: number;
  propina: FavelaPropinaSummary | null;
  propinaValue: number;
  regionId: RegionId;
  satisfaction: number;
  satisfactionProfile: FavelaSatisfactionProfile;
  soldiers: FavelaSoldierForceSummary;
  stabilizationEndsAt: string | null;
  state: FavelaControlState;
  stateControlledUntil: string | null;
  war: FactionWarSummary | null;
  warDeclaredAt: string | null;
  x9: FavelaX9Summary | null;
}

export interface FavelaServiceDefinitionSummary {
  baseDailyRevenuePerResident: number;
  installCost: number;
  label: string;
  maxLevel: number;
  satisfactionGainOnUpgrade: number;
  type: FavelaServiceType;
  upgradeRevenueStepMultiplier: number;
}

export interface FavelaServiceRevenueBreakdown {
  factionBonusMultiplier: number;
  propinaPenaltyMultiplier: number;
  regionalMultiplier: number;
  satisfactionMultiplier: number;
  stabilizationMultiplier: number;
  territoryDominationMultiplier: number;
  totalMultiplier: number;
}

export type FavelaPropinaStatus = 'scheduled' | 'warning' | 'severe' | 'state_takeover';
export type FactionWarStatus =
  | 'declared'
  | 'preparing'
  | 'active'
  | 'attacker_won'
  | 'defender_won'
  | 'draw'
  | 'cancelled';
export type FactionWarSide = 'attacker' | 'defender';
export type FactionWarRoundOutcome = 'attacker' | 'defender' | 'draw';

export interface FavelaPropinaSummary {
  baseAmount: number;
  canNegotiate: boolean;
  currentAmount: number;
  daysOverdue: number;
  discountRate: number;
  dueAt: string | null;
  lastPaidAt: string | null;
  negotiatedAt: string | null;
  negotiatedByPlayerId: string | null;
  revenuePenaltyMultiplier: number;
  status: FavelaPropinaStatus;
}

export interface FactionWarPreparationSummary {
  budget: number;
  powerBonus: number;
  preparedAt: string;
  preparedByPlayerId: string;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
}

export interface FactionWarRoundSummary {
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
  resolvedAt: string;
  roundNumber: number;
}

export interface FactionWarSummary {
  attackerFaction: FavelaFactionSummary;
  attackerPreparation: FactionWarPreparationSummary | null;
  attackerScore: number;
  cooldownEndsAt: string | null;
  declaredAt: string;
  declaredByPlayerId: string | null;
  defenderFaction: FavelaFactionSummary;
  defenderPreparation: FactionWarPreparationSummary | null;
  defenderScore: number;
  endedAt: string | null;
  favelaId: string;
  id: string;
  lootMoney: number;
  nextRoundAt: string | null;
  preparationEndsAt: string | null;
  rounds: FactionWarRoundSummary[];
  roundsResolved: number;
  roundsTotal: number;
  startsAt: string | null;
  status: FactionWarStatus;
  winnerFactionId: string | null;
}

export type FavelaX9Status = 'warning' | 'pending_desenrolo' | 'jailed' | 'resolved';

export interface FavelaX9Summary {
  canAttemptDesenrolo: boolean;
  currentRiskPercent: number;
  desenroloAttemptedAt: string | null;
  desenroloBaseMoneyCost: number | null;
  desenroloBasePointsCost: number | null;
  desenroloMoneySpent: number;
  desenroloPointsSpent: number;
  desenroloSucceeded: boolean | null;
  drugsLost: number;
  id: string;
  incursionAt: string | null;
  moneyLost: number;
  pendingSoldiersReturn: number;
  resolvedAt: string | null;
  soldiersArrested: number;
  soldiersReleaseAt: string | null;
  status: FavelaX9Status;
  triggeredAt: string;
  warningEndsAt: string | null;
  weaponsLost: number;
}

export interface FavelaServiceSummary {
  active: boolean;
  currentDailyRevenue: number;
  definition: FavelaServiceDefinitionSummary;
  grossRevenueTotal: number;
  id: string | null;
  installed: boolean;
  installedAt: string | null;
  isUpgradeable: boolean;
  lastRevenueAt: string | null;
  level: number;
  lockReason: string | null;
  nextUpgradeCost: number | null;
  revenueBreakdown: FavelaServiceRevenueBreakdown;
}

export interface TerritoryRegionSummary {
  atWarFavelas: number;
  controlledFavelas: number;
  dominantFaction: FavelaFactionSummary | null;
  neutralFavelas: number;
  playerFactionControlledFavelas: number;
  regionId: RegionId;
  stateControlledFavelas: number;
  totalFavelas: number;
}

export interface TerritoryOverviewResponse {
  favelas: TerritoryFavelaSummary[];
  playerFactionId: string | null;
  regions: TerritoryRegionSummary[];
}

export type TerritoryLossCause = 'war_defeat' | 'state_takeover' | 'control_removed';

export interface TerritoryLossCueSummary {
  body: string;
  cause: TerritoryLossCause;
  economicImpact: string;
  favelaId: string;
  favelaName: string;
  key: string;
  lostByFactionAbbreviation: string | null;
  lostByFactionId: string;
  newControllerFactionAbbreviation: string | null;
  newControllerFactionId: string | null;
  occurredAt: string;
  politicalImpact: string;
  regionId: RegionId;
  territorialImpact: string;
  title: string;
}

export interface TerritoryLossFeedResponse {
  cues: TerritoryLossCueSummary[];
  generatedAt: string;
}

export interface FavelaStateTransitionInput {
  action: 'declare_war' | 'attacker_win' | 'defender_hold';
}

export interface FavelaStateTransitionResponse extends TerritoryOverviewResponse {
  favela: TerritoryFavelaSummary;
}

export interface FavelaConquestInput {
  participantIds?: string[];
}

export interface TerritoryBossSummary {
  difficulty: number;
  label: string;
  power: number;
}

export interface TerritoryConquestParticipantOutcome {
  conceitoDelta: number;
  hpDelta: number;
  id: string;
  level: number;
  leveledUp: boolean;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  regionId: RegionId;
  resources: Pick<PlayerResources, 'conceito' | 'hp' | 'disposicao' | 'cansaco'>;
  disposicaoSpent: number;
  cansacoSpent: number;
}

export interface FavelaConquestResponse extends TerritoryOverviewResponse {
  boss: TerritoryBossSummary;
  chance: number;
  combinedPower: number;
  coordinationMultiplier: number;
  favela: TerritoryFavelaSummary;
  message: string;
  minimumPowerRequired: number;
  participantCount: number;
  participants: TerritoryConquestParticipantOutcome[];
  success: boolean;
}

export interface FavelaServicesResponse {
  canManage: boolean;
  factionBankMoney: number | null;
  favela: TerritoryFavelaSummary;
  playerFactionId: string | null;
  services: FavelaServiceSummary[];
}

export interface FavelaServiceInstallInput {
  serviceType: FavelaServiceType;
}

export interface FavelaServiceMutationResponse extends FavelaServicesResponse {
  service: FavelaServiceSummary;
}

export interface FavelaX9DesenroloResponse extends TerritoryOverviewResponse {
  attemptedAt: string;
  discountMultiplier: number;
  event: FavelaX9Summary;
  favela: TerritoryFavelaSummary;
  message: string;
  moneySpent: number;
  pointsSpent: number;
  releaseAt: string | null;
  success: boolean;
  successChance: number;
}

export interface FavelaPropinaNegotiationResponse extends TerritoryOverviewResponse {
  discountRate: number;
  favela: TerritoryFavelaSummary;
  message: string;
  propina: FavelaPropinaSummary;
  success: boolean;
  successChance: number;
}

export type FavelaBaileMcTier = 'local' | 'regional' | 'estelar';
export type FavelaBaileResultTier = 'total_success' | 'success' | 'mixed' | 'failure';
export type FavelaBaileStatus = 'ready' | 'active' | 'hangover' | 'cooldown';

export interface FavelaBaileSummary {
  activeEndsAt: string | null;
  budget: number | null;
  cooldownEndsAt: string | null;
  entryPrice: number | null;
  factionPointsDelta: number | null;
  hangoverEndsAt: string | null;
  incidentCode: string | null;
  lastOrganizedAt: string | null;
  mcTier: FavelaBaileMcTier | null;
  resultTier: FavelaBaileResultTier | null;
  satisfactionDelta: number | null;
  cansacoBoostPercent: number | null;
  status: FavelaBaileStatus;
}

export interface FavelaBaileStatusResponse extends TerritoryOverviewResponse {
  baile: FavelaBaileSummary;
  favela: TerritoryFavelaSummary;
}

export interface FavelaBaileOrganizeInput {
  budget: number;
  entryPrice: number;
  mcTier: FavelaBaileMcTier;
}

export interface FavelaBaileOrganizeResponse extends FavelaBaileStatusResponse {
  message: string;
}

export interface FactionWarStatusResponse extends TerritoryOverviewResponse {
  favela: TerritoryFavelaSummary;
  war: FactionWarSummary | null;
}

export interface FactionWarDeclareResponse extends FactionWarStatusResponse {
  message: string;
}

export interface FactionWarPrepareInput {
  budget: number;
  soldierCommitment: number;
}

export interface FactionWarPrepareResponse extends FactionWarStatusResponse {
  message: string;
  side: FactionWarSide;
}

export interface FactionWarRoundResponse extends FactionWarStatusResponse {
  message: string;
  round: FactionWarRoundSummary | null;
}

export interface TribunalCaseDefinitionSummary {
  allowedPunishments: TribunalPunishment[];
  label: string;
  severity: TribunalCaseSeverity;
  type: TribunalCaseType;
}

export interface TribunalCaseParticipantSummary {
  charismaCommunity: number;
  charismaFaction: number;
  name: string;
  statement: string;
}

export type TribunalPunishmentRead =
  | 'brutal'
  | 'condena_inocente'
  | 'dureza_arriscada'
  | 'leve_demais'
  | 'proporcional'
  | 'prudente';

export interface TribunalPunishmentInsightSummary {
  faccaoImpact: number;
  moradoresImpact: number;
  note: string;
  punishment: TribunalPunishment;
  read: TribunalPunishmentRead;
  recommended: boolean;
}

export interface TribunalAntigaoAdviceSummary {
  balanceWarning: string;
  communityRead: TribunalCaseSide;
  punishmentInsights: TribunalPunishmentInsightSummary[];
  truthRead: TribunalCaseSide;
}

export interface TribunalFavelaSummary {
  id: string;
  name: string;
  regionId: RegionId;
}

export interface TribunalCaseSummary {
  accused: TribunalCaseParticipantSummary;
  accuser: TribunalCaseParticipantSummary;
  antigaoAdvice: TribunalAntigaoAdviceSummary;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  createdAt: string;
  decisionDeadlineAt: string;
  definition: TribunalCaseDefinitionSummary;
  favelaId: string;
  id: string;
  judgedAt: string | null;
  punishmentChosen: TribunalPunishment | null;
  resolutionSource: TribunalResolutionSource | null;
  status: TribunalCaseStatus;
  summary: string;
  truthRead: TribunalCaseSide;
}

export type TribunalCaseStatus = 'open' | 'resolved_by_npc' | 'resolved_by_player';

export type TribunalResolutionSource = 'npc' | 'player';

export interface TribunalCenterResponse {
  activeCase: TribunalCaseSummary | null;
  favela: TribunalFavelaSummary;
  latestResolvedCase: TribunalCaseSummary | null;
  latestResolvedOutcome: TribunalResolutionSummary | null;
  player: PlayerSummary;
}

export interface TribunalCaseGenerateResponse extends TribunalCenterResponse {
  created: boolean;
}

export interface TribunalJudgmentInput {
  punishment: TribunalPunishment;
}

export type TribunalJudgmentRead =
  | 'arriscada'
  | 'brutal_desnecessaria'
  | 'covarde'
  | 'injusta'
  | 'justa';

export interface TribunalJudgmentSummary {
  conceitoAfter: number;
  conceitoDelta: number;
  faccaoImpact: number;
  factionInternalSatisfactionAfter: number;
  factionInternalSatisfactionDelta: number;
  favelaSatisfactionAfter: number;
  favelaSatisfactionDelta: number;
  moradoresImpact: number;
  punishmentChosen: TribunalPunishment;
  read: TribunalJudgmentRead;
  resolvedAt: string;
  resolutionSource: TribunalResolutionSource;
  summary: string;
}

export interface TribunalJudgmentResponse extends TribunalCenterResponse {
  activeCase: TribunalCaseSummary;
  judgment: TribunalJudgmentSummary;
}

export interface TribunalResolutionSummary {
  conceitoDelta: number;
  faccaoImpact: number;
  moradoresImpact: number;
  punishmentChosen: TribunalPunishment;
  read: TribunalJudgmentRead;
  resolvedAt: string;
  resolutionSource: TribunalResolutionSource;
  summary: string;
}

export type TribunalCueKind = 'opened' | 'resolved';

export interface TribunalCueSummary {
  body: string;
  case: TribunalCaseSummary;
  favela: TribunalFavelaSummary;
  headline: string;
  kind: TribunalCueKind;
  occurredAt: string;
  outcome: TribunalResolutionSummary | null;
  title: string;
}

export interface TribunalCueListResponse {
  cues: TribunalCueSummary[];
  generatedAt: string;
}
