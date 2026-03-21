import type {
  CharacterAppearance,
  FactionRobberyPolicy,
  HospitalStatItemCode,
  HospitalizationReason,
  InventoryEquipSlot,
  InventoryItemType,
  LevelTitle,
  OverdoseTrigger,
  PlayerAttributes,
  PlayerBankEntryType,
  PlayerContactOrigin,
  PlayerContactType,
  PlayerFactionSummary,
  PlayerLocation,
  PlayerPoliceHeatTier,
  PlayerSummary,
  RegionId,
  RobberyExecutorType,
  RobberyFailureOutcome,
  RobberyType,
  RoundStatus,
  VehicleRobberyRoute,
  VocationType,
} from '../types.js';

export interface PlayerInventoryItem {
  equipSlot: InventoryEquipSlot | null;
  equipment?: PlayerInventoryEquipmentSummary | null;
  id: string;
  isEquipped: boolean;
  itemId: string | null;
  itemName: string | null;
  durability: number | null;
  maxDurability: number | null;
  itemType: InventoryItemType;
  levelRequired: number | null;
  proficiency: number;
  quantity: number;
  stackable: boolean;
  totalWeight: number;
  unitWeight: number;
}

export interface PlayerInventoryEquipmentSummary {
  defense: number | null;
  power: number | null;
  slot: InventoryEquipSlot;
}

export interface InventoryCapacity {
  availableSlots: number;
  availableWeight: number;
  currentWeight: number;
  maxSlots: number;
  maxWeight: number;
  usedSlots: number;
}

export interface PlayerPropertySummary {
  id: string;
  type: string;
  regionId: RegionId;
  favelaId: string | null;
  level: number;
  soldiersCount: number;
  createdAt: string;
}

export type NpcInflationAffectedService = 'black_market' | 'hospital' | 'university';

export type NpcInflationTier = 'high' | 'low' | 'peak' | 'rising';

export interface NpcInflationScheduleEntry {
  gameDay: number;
  multiplier: number;
  surchargePercent: number;
}

export interface NpcInflationSummary {
  affectedServices: NpcInflationAffectedService[];
  currentGameDay: number;
  currentMultiplier: number;
  currentSurchargePercent: number;
  gameDayDurationHours: number;
  maxMultiplier: number;
  nextIncreaseGameDay: number | null;
  nextIncreaseInDays: number | null;
  nextMultiplier: number | null;
  nextSurchargePercent: number | null;
  resetsOnNewRound: boolean;
  roundActive: boolean;
  schedule: NpcInflationScheduleEntry[];
  tier: NpcInflationTier;
  totalGameDays: number;
}

export interface RoundSummary {
  currentGameDay: number;
  endsAt: string;
  id: string;
  number: number;
  remainingSeconds: number;
  startedAt: string;
  status: RoundStatus;
  totalGameDays: number;
}

export interface RoundLeaderboardEntry {
  conceito: number;
  factionAbbreviation: string | null;
  level: number;
  nickname: string;
  playerId: string;
  rank: number;
}

export interface RoundCenterResponse {
  leaderboard: RoundLeaderboardEntry[];
  npcInflation: NpcInflationSummary;
  round: RoundSummary;
  topTenCreditReward: number;
}

export interface HallOfFamePlayerEntry {
  conceito: number;
  nickname: string;
  playerId: string;
  rank: number;
}

export interface HallOfFameRoundEntry {
  endedAt: string;
  roundId: string;
  roundNumber: number;
  startedAt: string;
  topThree: HallOfFamePlayerEntry[];
  winnerConceito: number;
  winnerNickname: string;
  winnerPlayerId: string;
}

export interface HallOfFameResponse {
  rounds: HallOfFameRoundEntry[];
  totalFinishedRounds: number;
}

export interface PlayerHospitalizationStatus {
  endsAt: string | null;
  isHospitalized: boolean;
  reason: HospitalizationReason | null;
  remainingSeconds: number;
  startedAt: string | null;
  trigger: OverdoseTrigger | null;
}

export interface PlayerPrisonStatus {
  endsAt: string | null;
  heatScore: number;
  heatTier: PlayerPoliceHeatTier;
  isImprisoned: boolean;
  reason: string | null;
  remainingSeconds: number;
  sentencedAt: string | null;
}

export interface PlayerProfile extends PlayerSummary {
  appearance: CharacterAppearance;
  faction: PlayerFactionSummary | null;
  hasCharacter: boolean;
  hospitalization: PlayerHospitalizationStatus;
  inventory: PlayerInventoryItem[];
  location: PlayerLocation;
  prison: PlayerPrisonStatus;
  properties: PlayerPropertySummary[];
}

export interface PlayerPublicProfileRanking {
  currentRank: number;
  totalPlayers: number;
}

export interface PlayerPublicProfileVisibility {
  inventoryItemCount: number;
  propertyCount: number;
  preciseLocationVisible: boolean;
}

export interface PlayerPublicProfile {
  conceito: number;
  faction: PlayerFactionSummary | null;
  id: string;
  level: number;
  location: PlayerLocation;
  nickname: string;
  ranking: PlayerPublicProfileRanking;
  regionId: RegionId;
  title: LevelTitle;
  visibility: PlayerPublicProfileVisibility;
  vocation: VocationType;
}

export interface PlayerContactLimitSummary {
  max: number;
  remaining: number;
  used: number;
}

export interface PlayerContactSummary {
  contactId: string;
  faction: PlayerFactionSummary | null;
  level: number;
  nickname: string;
  origin: PlayerContactOrigin;
  since: string;
  title: LevelTitle;
  type: PlayerContactType;
  vocation: VocationType;
}

export interface PlayerContactsResponse {
  contacts: PlayerContactSummary[];
  limits: {
    known: PlayerContactLimitSummary;
    partner: PlayerContactLimitSummary;
  };
}

export interface PlayerContactCreateInput {
  nickname: string;
  type: PlayerContactType;
}

export interface PlayerContactMutationResponse extends PlayerContactsResponse {
  contact: PlayerContactSummary;
  message: string;
}

export interface PlayerContactRemovalResponse extends PlayerContactsResponse {
  message: string;
  removedContactId: string;
  removedType: PlayerContactType;
}

export interface PlayerContactFactionSyncResult {
  nextFactionId: string | null;
  playerId: string;
  removedContactIds: string[];
  removedPartners: number;
}

export interface PrivateMessageSummary {
  id: string;
  message: string;
  senderId: string;
  senderNickname: string;
  sentAt: string;
}

export interface PrivateMessageThreadSummary {
  contact: PlayerContactSummary;
  lastMessage: PrivateMessageSummary | null;
  messageCount: number;
  threadId: string;
  updatedAt: string | null;
}

export interface PrivateMessageThreadListResponse {
  generatedAt: string;
  threads: PrivateMessageThreadSummary[];
}

export interface PrivateMessageThreadResponse {
  contact: PlayerContactSummary;
  generatedAt: string;
  messages: PrivateMessageSummary[];
  threadId: string;
}

export interface PrivateMessageSendInput {
  message: string;
}

export interface PrivateMessageSendResponse extends PrivateMessageThreadResponse {
  message: string;
  sentMessage: PrivateMessageSummary;
}

export interface PrisonActionAvailability {
  available: boolean;
  creditsCost: number | null;
  factionBankCost: number | null;
  moneyCost: number | null;
  reason: string | null;
  successChancePercent: number | null;
}

export interface PrisonCenterResponse {
  actions: {
    bail: PrisonActionAvailability;
    bribe: PrisonActionAvailability;
    escape: PrisonActionAvailability & {
      alreadyAttempted: boolean;
    };
    factionRescue: PrisonActionAvailability & {
      eligibleTarget: boolean;
    };
  };
  prison: PlayerPrisonStatus;
}

export type PrisonReleaseMethod = 'bail' | 'bribe' | 'escape' | 'faction_rescue';

export interface PrisonActionResponse {
  creditsRemaining: number | null;
  factionBankMoneyRemaining: number | null;
  message: string;
  method: PrisonReleaseMethod;
  moneyRemaining: number | null;
  prison: PlayerPrisonStatus;
  success: boolean;
}

export interface PlayerBankLedgerEntry {
  balanceAfter: number;
  createdAt: string;
  description: string;
  entryType: PlayerBankEntryType;
  feeAmount: number;
  grossAmount: number;
  id: string;
  netAmount: number;
}

export interface PlayerBankProtectionProfile {
  fromDeathLoss: boolean;
  fromPoliceSeizure: boolean;
  fromPvpLoot: boolean;
}

export interface PlayerBankCenterResponse {
  bankMoney: number;
  dailyDepositLimit: number;
  dailyInterestRatePercent: number;
  depositedToday: number;
  ledger: PlayerBankLedgerEntry[];
  pocketMoney: number;
  protection: PlayerBankProtectionProfile;
  remainingDepositLimit: number;
  syncedAt: string;
  withdrawFeeRatePercent: number;
}

export interface PlayerBankDepositInput {
  amount: number;
}

export interface PlayerBankWithdrawInput {
  amount: number;
}

export interface PlayerBankActionResponse {
  bank: PlayerBankCenterResponse;
  bankMoneyDelta: number;
  feePaid: number;
  interestApplied: number;
  message: string;
  pocketMoneyDelta: number;
}

export interface RobberyDefinitionSummary {
  baseCooldownSeconds: number;
  baseFactionCommissionRate: number;
  baseHeatDeltaRange: {
    max: number;
    min: number;
  };
  baseRewardRange: {
    max: number;
    min: number;
  };
  defaultBanditsCommitted: number;
  executorTypes: RobberyExecutorType[];
  id: RobberyType;
  label: string;
  maxBanditsCommitted: number;
  minimumLevel: number;
  riskLabel: 'alto' | 'baixo_medio' | 'medio' | 'medio_alto';
}

export interface VehicleRobberyRouteDefinitionSummary {
  baseFactionCommissionRate: number;
  baseHeatDeltaRange: {
    max: number;
    min: number;
  };
  baseRewardRange: {
    max: number;
    min: number;
  };
  description: string;
  id: VehicleRobberyRoute;
  label: string;
  riskLabel: 'alto' | 'baixo_medio' | 'medio' | 'medio_alto';
}

export interface RobberyCatalogBanditFavelaSummary {
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  id: string;
  name: string;
  nextReturnAt: string | null;
  regionId: RegionId;
}

export interface RobberyCatalogResponse {
  banditFavelas: RobberyCatalogBanditFavelaSummary[];
  factionRobberyPolicy: FactionRobberyPolicy | null;
  playerRegion: {
    densityIndex: number;
    name: string;
    policePressure: number;
    regionId: RegionId;
    wealthIndex: number;
  };
  robberies: RobberyDefinitionSummary[];
  vehicleRoutes: VehicleRobberyRouteDefinitionSummary[];
}

export interface RobberyAttemptInput {
  banditsCommitted?: number;
  executorType: RobberyExecutorType;
  favelaId?: string;
  vehicleRoute?: VehicleRobberyRoute;
}

export interface RobberyBanditImpactSummary {
  activeAfter: number;
  arrestedAfter: number;
  arrestedNow: number;
  committed: number;
  deadRecentAfter: number;
  killedNow: number;
  nextReturnAt: string | null;
  returnBatchesCreated: number;
}

export interface RobberyPlayerImpactSummary {
  heatAfter: number;
  heatBefore: number;
  heatDelta: number;
  heatTierAfter: PlayerPoliceHeatTier;
  heatTierBefore: PlayerPoliceHeatTier;
  hospitalization: PlayerHospitalizationStatus;
  hpAfter: number;
  hpBefore: number;
  hpDelta: number;
  moneyAfter: number;
  moneyBefore: number;
  moneyDelta: number;
  disposicaoAfter: number;
  disposicaoBefore: number;
  disposicaoDelta: number;
  prison: PlayerPrisonStatus;
  cansacoAfter: number;
  cansacoBefore: number;
  cansacoDelta: number;
}

export interface RobberyAttemptResponse {
  bandits: RobberyBanditImpactSummary | null;
  executorType: RobberyExecutorType;
  factionCommissionAmount: number;
  factionCommissionRatePercent: number;
  grossAmount: number;
  message: string;
  netAmount: number;
  outcome: RobberyFailureOutcome | 'success';
  player: RobberyPlayerImpactSummary | null;
  policyDisplacedFromRegionId: RegionId | null;
  regionId: RegionId;
  regionName: string;
  regionPolicePressureAfter: number;
  regionPolicePressureBefore: number;
  regionPolicePressureDelta: number;
  robberyType: RobberyType;
  success: boolean;
  vehicleRoute: VehicleRobberyRoute | null;
}

export interface AuthPlayerIdentity {
  id: string;
  nickname: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  player: AuthPlayerIdentity;
  refreshExpiresIn: number;
  refreshToken: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface AuthRegisterInput {
  email: string;
  nickname: string;
  password: string;
}

export interface AuthRefreshInput {
  refreshToken: string;
}

export interface ApiErrorResponse {
  message: string;
}

export interface PlayerCreationInput {
  vocation: VocationType;
  appearance: CharacterAppearance;
}

export interface PlayerTravelInput {
  regionId: RegionId;
}

export type PlayerVocationState = 'ready' | 'cooldown' | 'transition';

export interface PlayerVocationStatus {
  changedAt: string | null;
  cooldownEndsAt: string | null;
  cooldownRemainingSeconds: number;
  currentVocation: VocationType;
  nextChangeAvailableAt: string | null;
  pendingVocation: VocationType | null;
  state: PlayerVocationState;
  transitionEndsAt: string | null;
}

export interface PlayerVocationAvailability {
  available: boolean;
  creditsCost: number;
  reason: string | null;
}

export interface PlayerVocationOptionSummary {
  baseAttributes: PlayerAttributes;
  id: VocationType;
  isCurrent: boolean;
  label: string;
  primaryAttribute: keyof PlayerAttributes;
  secondaryAttribute: keyof PlayerAttributes;
}

export interface PlayerVocationCenterPlayerState {
  credits: number;
  level: number;
  nickname: string;
  vocation: VocationType;
}

export interface PlayerVocationCenterResponse {
  availability: PlayerVocationAvailability;
  cooldownHours: number;
  options: PlayerVocationOptionSummary[];
  player: PlayerVocationCenterPlayerState;
  status: PlayerVocationStatus;
}

export interface PlayerVocationChangeInput {
  vocation: VocationType;
}

export interface PlayerVocationChangeResponse {
  center: PlayerVocationCenterResponse;
  message: string;
  player: PlayerProfile;
}

export interface InventoryGrantInput {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
}

export interface InventoryListResponse {
  capacity: InventoryCapacity;
  items: PlayerInventoryItem[];
}

export interface InventoryQuantityUpdateInput {
  quantity: number;
}

export interface InventoryRepairResponse extends InventoryListResponse {
  repairCost: number;
  repairedItem: PlayerInventoryItem;
}

export interface HospitalServiceAvailability {
  available: boolean;
  creditsCost: number | null;
  moneyCost: number | null;
  reason: string | null;
}

export interface HospitalStatItemOffer {
  available: boolean;
  costMoney: number;
  description: string;
  itemCode: HospitalStatItemCode;
  label: string;
  limitPerCycle: number;
  purchasesInCurrentCycle: number;
  reason: string | null;
  remainingInCurrentCycle: number;
}

export interface HospitalCenterPlayerState {
  addiction: number;
  appearance: CharacterAppearance;
  credits: number;
  healthPlanActive: boolean;
  healthPlanCycleKey: string | null;
  hp: number;
  money: number;
  nickname: string;
}

export interface HospitalCenterResponse {
  currentCycleKey: string;
  hospitalization: PlayerHospitalizationStatus;
  npcInflation: NpcInflationSummary;
  player: HospitalCenterPlayerState;
  services: {
    detox: HospitalServiceAvailability;
    healthPlan: HospitalServiceAvailability;
    surgery: HospitalServiceAvailability;
    treatment: HospitalServiceAvailability;
  };
  statItems: HospitalStatItemOffer[];
}

export interface HospitalSurgeryInput {
  appearance?: CharacterAppearance;
  nickname?: string;
}

export interface HospitalStatPurchaseInput {
  itemCode: HospitalStatItemCode;
}

export type HospitalActionType =
  | 'detox'
  | 'health_plan'
  | 'stat_item'
  | 'surgery'
  | 'treatment';

export interface HospitalActionResponse extends HospitalCenterResponse {
  action: HospitalActionType;
  message: string;
  purchasedItemCode: HospitalStatItemCode | null;
}
