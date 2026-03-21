import type {
  CrimeType,
  DrugType,
  FactionRank,
  InventoryItemType,
  MarketAuctionNotificationType,
  MarketAuctionStatus,
  MarketOrderSide,
  MarketOrderStatus,
  NpcInflationSummary,
  OverdoseTrigger,
  PlayerAttributes,
  PlayerHospitalizationStatus,
  PlayerProfile,
  PlayerResources,
  PlayerSummary,
  UniversityCourseCode,
  VocationType,
} from '../types.js';

export interface UniversityPassiveProfile {
  business: {
    bocaDemandMultiplier: number;
    gpRevenueMultiplier: number;
    launderingReturnMultiplier: number;
    passiveRevenueMultiplier: number;
    propertyMaintenanceMultiplier: number;
  };
  crime: {
    arrestChanceMultiplier: number;
    lowLevelSoloRewardMultiplier: number;
    revealsTargetValue: boolean;
    soloSuccessMultiplier: number;
  };
  factory: {
    extraDrugSlots: number;
    productionMultiplier: number;
  };
  faction: {
    factionCharismaAura: number;
  };
  market: {
    feeRate: number;
  };
  police: {
    bribeCostMultiplier: number;
    negotiationSuccessMultiplier: number;
  };
  social: {
    communityInfluenceMultiplier: number;
  };
}

export interface UniversityCourseDefinitionSummary {
  attributeRequirements: Partial<PlayerAttributes>;
  code: UniversityCourseCode;
  durationHours: number;
  effectSummary: string;
  label: string;
  moneyCost: number;
  prerequisiteCourseCodes: UniversityCourseCode[];
  unlockLevel: number;
  vocation: VocationType;
}

export interface UniversityCourseSummary extends UniversityCourseDefinitionSummary {
  completedAt: string | null;
  endsAt: string | null;
  isCompleted: boolean;
  isInProgress: boolean;
  isLocked: boolean;
  isUnlocked: boolean;
  lockReason: string | null;
  startedAt: string | null;
}

export type UniversityPerkStatus = 'available' | 'completed' | 'in_progress' | 'locked';

export type UniversityVocationProgressionStage = 'developing' | 'mastered' | 'starting';

export interface UniversityVocationPerkSummary extends UniversityCourseSummary {
  isMasteryPerk: boolean;
  perkSlot: number;
  status: UniversityPerkStatus;
}

export interface UniversityVocationProgressionSummary {
  completedPerks: number;
  completionRatio: number;
  currentPerkCode: UniversityCourseCode | null;
  masteryUnlocked: boolean;
  nextPerk: UniversityVocationPerkSummary | null;
  passiveProfile: UniversityPassiveProfile;
  perks: UniversityVocationPerkSummary[];
  stage: UniversityVocationProgressionStage;
  totalPerks: number;
  trackLabel: string;
  vocation: VocationType;
}

export interface UniversityCenterResponse {
  activeCourse: UniversityCourseSummary | null;
  completedCourseCodes: UniversityCourseCode[];
  courses: UniversityCourseSummary[];
  npcInflation: NpcInflationSummary;
  passiveProfile: UniversityPassiveProfile;
  player: PlayerSummary;
  progression: UniversityVocationProgressionSummary;
}

export interface UniversityEnrollInput {
  courseCode: UniversityCourseCode;
}

export interface UniversityEnrollResponse {
  course: UniversityCourseSummary;
  player: PlayerSummary;
}

export interface DrugToleranceSummary {
  current: number;
  decayedBy: number;
  drugId: string;
  effectiveTolerance: number;
  effectivenessMultiplier: number;
  increasedBy: number;
}

export interface DrugConsumeEffectSummary {
  addictionGained: number;
  brisaRecovered: number;
  disposicaoRecovered: number;
  cansacoRecovered: number;
}

export interface DrugOverdoseSummary {
  hospitalization: PlayerHospitalizationStatus;
  knownContactsLost: number;
  penalties: {
    addictionResetTo: number;
    conceitoLost: number;
    brisaResetTo: number;
  };
  recentDrugTypes: DrugType[];
  trigger: OverdoseTrigger;
}

export interface DrugConsumeResponse {
  consumedInventoryItemId: string;
  drug: {
    code: string;
    id: string;
    name: string;
    remainingQuantity: number;
    type: DrugType;
  };
  effects: DrugConsumeEffectSummary;
  overdose: DrugOverdoseSummary | null;
  player: PlayerProfile;
  tolerance: DrugToleranceSummary;
}

export interface MarketOrderSummary {
  createdAt: string;
  expiresAt: string;
  id: string;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  playerId: string;
  pricePerUnit: number;
  quantity: number;
  remainingQuantity: number;
  side: MarketOrderSide;
  sourceLabel?: string | null;
  sourceType?: 'player' | 'system';
  status: MarketOrderStatus;
  systemOfferId?: string | null;
}

export interface MarketTradeSummary {
  buyerId: string;
  feeTotal: number;
  grossTotal: number;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  pricePerUnit: number;
  quantity: number;
  sellerId: string;
  sellerNetTotal: number;
}

export interface MarketOrderCreateInput {
  inventoryItemId?: string | null;
  itemId: string;
  itemType: InventoryItemType;
  pricePerUnit: number;
  quantity: number;
  side: MarketOrderSide;
  systemOfferId?: string | null;
}

export interface MarketOrderBookResponse {
  buyOrders: MarketOrderSummary[];
  marketFeeRate: number;
  myOrders: MarketOrderSummary[];
  npcInflation: NpcInflationSummary;
  sellOrders: MarketOrderSummary[];
}

export interface MarketOrderMutationResponse {
  feeTotal: number;
  matchedTrades: MarketTradeSummary[];
  order: MarketOrderSummary;
  refundedAmount: number;
  returnedQuantity: number;
}

export interface MarketAuctionSummary {
  buyoutPrice: number | null;
  createdAt: string;
  currentBid: number | null;
  endsAt: string;
  id: string;
  itemId: string;
  itemName: string;
  itemType: 'weapon' | 'vest';
  leadingBidderId: string | null;
  minNextBid: number;
  playerId: string;
  quantity: number;
  startingBid: number;
  status: MarketAuctionStatus;
}

export interface MarketAuctionNotification {
  auctionId: string;
  createdAt: string;
  id: string;
  message: string;
  title: string;
  type: MarketAuctionNotificationType;
}

export interface MarketAuctionSettlementSummary {
  feeTotal: number;
  grossTotal: number;
  returnedToSeller: boolean;
  sellerNetTotal: number;
  winnerPlayerId: string | null;
}

export interface MarketAuctionCreateInput {
  buyoutPrice?: number | null;
  durationMinutes: number;
  inventoryItemId: string;
  itemId: string;
  itemType: 'weapon' | 'vest';
  startingBid: number;
}

export interface MarketAuctionBidInput {
  amount: number;
}

export interface MarketAuctionBookResponse {
  auctions: MarketAuctionSummary[];
  marketFeeRate: number;
  myAuctions: MarketAuctionSummary[];
  notifications: MarketAuctionNotification[];
}

export interface MarketAuctionMutationResponse {
  auction: MarketAuctionSummary;
  notifications: MarketAuctionNotification[];
  settlement: MarketAuctionSettlementSummary | null;
}

export interface CrimeDefinition {
  id: string;
  name: string;
  type: CrimeType;
  levelRequired: number;
  cansacoCost: number;
  disposicaoCost: number;
  minPower: number;
  rewardMin: number;
  rewardMax: number;
  conceitoReward: number;
  arrestChance: number;
}

export type CrimeRewardRead = 'approximate' | 'exact';

export interface CrimeCatalogItem extends CrimeDefinition {
  cooldownRemainingSeconds: number;
  estimatedSuccessChance: number;
  isLocked: boolean;
  isOnCooldown: boolean;
  isRunnable: boolean;
  lockReason: string | null;
  playerPower: number;
  rewardRead: CrimeRewardRead;
}

export interface CrimeCatalogResponse {
  crimes: CrimeCatalogItem[];
}

export interface CrimeAttemptDrop {
  itemId: string;
  itemName: string;
  itemType: 'drug';
  quantity: number;
}

export interface CrimeAttemptResponse {
  arrestChance: number;
  arrested: boolean;
  chance: number;
  crimeId: string;
  crimeName: string;
  cooldownRemainingSeconds: number;
  conceitoDelta: number;
  drop: CrimeAttemptDrop | null;
  heatAfter: number;
  heatBefore: number;
  hpDelta: number;
  leveledUp: boolean;
  level: number;
  message: string;
  moneyDelta: number;
  nextConceitoRequired: number | null;
  nextLevel: number | null;
  disposicaoSpent: number;
  playerPower: number;
  resources: Pick<PlayerResources, 'addiction' | 'conceito' | 'hp' | 'money' | 'disposicao' | 'cansaco'>;
  cansacoSpent: number;
  success: boolean;
}

export interface FactionCrimeCrewMemberSummary {
  id: string;
  isCoordinatorEligible: boolean;
  level: number;
  lockReason: string | null;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  resources: Pick<PlayerResources, 'hp' | 'disposicao' | 'cansaco'>;
}

export interface FactionCrimeCatalogItem extends CrimeDefinition {
  cooldownRemainingSeconds: number;
  isLocked: boolean;
  isOnCooldown: boolean;
  isRunnable: boolean;
  lockReason: string | null;
  maximumCrewSize: number;
  minimumCrewSize: number;
}

export interface FactionCrimeCatalogResponse {
  coordinatorCanStart: boolean;
  crimes: FactionCrimeCatalogItem[];
  factionId: string;
  members: FactionCrimeCrewMemberSummary[];
  playerFactionId: string | null;
}

export interface FactionCrimeAttemptInput {
  participantIds: string[];
}

export interface FactionCrimeParticipantOutcome {
  conceitoDelta: number;
  hpDelta: number;
  id: string;
  level: number;
  leveledUp: boolean;
  moneyDelta: number;
  disposicaoSpent: number;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  resources: Pick<PlayerResources, 'conceito' | 'hp' | 'money' | 'disposicao' | 'cansaco'>;
  cansacoSpent: number;
}

export interface FactionCrimeAttemptResponse {
  busted: boolean;
  bustedChance: number;
  chance: number;
  combinedPower: number;
  conceitoRewardPerParticipant: number;
  cooldownRemainingSeconds: number;
  coordinationMultiplier: number;
  crimeId: string;
  crimeName: string;
  factionId: string;
  message: string;
  minimumPowerRequired: number;
  participantCount: number;
  participants: FactionCrimeParticipantOutcome[];
  rewardTotal: number;
  success: boolean;
}
