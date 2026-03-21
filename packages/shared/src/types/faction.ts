import type {
  FactionBankEntryType,
  FactionBankOriginType,
  FactionLeadershipElectionStatus,
  FactionRank,
  FactionRobberyPolicyMode,
  FactionUpgradeType,
  GameConfigScope,
  GameConfigStatus,
  LevelTitle,
  RegionId,
  VocationType,
} from '../types.js';

export interface PlayerAttributes {
  forca: number;
  inteligencia: number;
  resistencia: number;
  carisma: number;
}

export interface PlayerResources {
  conceito: number;
  cansaco: number;
  disposicao: number;
  brisa: number;
  hp: number;
  addiction: number;
  money: number;
  bankMoney: number;
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  vocation: VocationType;
  level: number;
  title: LevelTitle;
  regionId: RegionId;
  attributes: PlayerAttributes;
  resources: PlayerResources;
}

export interface GameConfigSetSummary {
  code: string;
  description: string | null;
  id: string;
  isDefault: boolean;
  name: string;
  notes: string | null;
  status: GameConfigStatus;
}

export interface GameConfigEntrySummary {
  effectiveFrom: string;
  effectiveUntil: string | null;
  id: string;
  key: string;
  notes: string | null;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
  valueJson: Record<string, unknown>;
}

export interface RoundConfigOverrideSummary extends GameConfigEntrySummary {
  roundId: string;
}

export interface FeatureFlagSummary {
  effectiveFrom: string;
  effectiveUntil: string | null;
  id: string;
  key: string;
  notes: string | null;
  payloadJson: Record<string, unknown>;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
}

export interface ResolvedGameConfigEntrySummary {
  key: string;
  scope: GameConfigScope;
  source: 'fallback' | 'round_override' | 'set_entry';
  targetKey: string;
  valueJson: Record<string, unknown>;
}

export interface ResolvedGameConfigCatalog {
  activeRoundId: string | null;
  activeSet: GameConfigSetSummary | null;
  entries: ResolvedGameConfigEntrySummary[];
  featureFlags: FeatureFlagSummary[];
  resolvedAt: string;
}

export interface CharacterAppearance {
  skin: string;
  hair: string;
  outfit: string;
}

export interface PlayerLocation {
  regionId: RegionId;
  positionX: number;
  positionY: number;
}

export interface PlayerFactionSummary {
  id: string;
  name: string;
  abbreviation: string;
  rank: FactionRank | null;
}

export interface FactionRobberyPolicy {
  global: FactionRobberyPolicyMode;
  regions: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

export interface FactionSummary {
  availableJoinSlots: number | null;
  autoPromotionResult?: FactionAutoPromotionResult | null;
  abbreviation: string;
  bankMoney: number;
  canConfigure: boolean;
  canDissolve: boolean;
  canSelfJoin: boolean;
  createdAt: string;
  description: string | null;
  id: string;
  internalSatisfaction: number;
  isFixed: boolean;
  isNpcControlled: boolean;
  isPlayerMember: boolean;
  leaderId: string | null;
  memberCount: number;
  myRank: FactionRank | null;
  name: string;
  npcProgression?: FactionNpcProgressionStatus | null;
  npcLeaderName: string | null;
  points: number;
  robberyPolicy: FactionRobberyPolicy;
}

export interface FactionAutoPromotionResult {
  factionAbbreviation: string;
  factionId: string;
  factionName: string;
  newRank: FactionRank;
  previousRank: FactionRank;
  promotedAt: string;
  promotionReason: string;
}

export interface FactionNpcProgressionStatus {
  blockedReason: string | null;
  currentRank: FactionRank | null;
  daysInFaction: number;
  eligibleNow: boolean;
  minimumConceitoForNextRank: number | null;
  minimumDaysInFactionForNextRank: number | null;
  minimumLevelForNextRank: number | null;
  nextRank: FactionRank | null;
  occupiedSlotsForNextRank: number | null;
  remainingConceito: number | null;
  remainingDaysInFaction: number | null;
  remainingLevel: number | null;
  slotAvailable: boolean;
  slotLimitForNextRank: number | null;
}

export interface FactionCreateInput {
  abbreviation: string;
  description?: string | null;
  name: string;
}

export interface FactionRecruitInput {
  nickname: string;
}

export interface FactionUpdateInput {
  abbreviation?: string;
  description?: string | null;
  name?: string;
}

export interface FactionRobberyPolicyUpdateInput {
  global?: FactionRobberyPolicyMode;
  regions?: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

export interface FactionMemberSummary {
  id: string;
  isLeader: boolean;
  isNpc: boolean;
  joinedAt: string;
  level: number | null;
  nickname: string;
  rank: FactionRank;
  vocation: VocationType | null;
}

export interface FactionListResponse {
  factions: FactionSummary[];
  playerFactionId: string | null;
}

export interface FactionMembersResponse {
  faction: FactionSummary;
  members: FactionMemberSummary[];
  playerFactionId: string | null;
}

export interface FactionMutationResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

export interface FactionRobberyPolicyResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

export interface FactionDissolveResponse {
  dissolvedFactionId: string;
  playerFactionId: null;
}

export interface FactionLeaveResponse {
  factionId: string;
  playerFactionId: null;
}

export interface FactionBankLedgerEntry {
  balanceAfter: number;
  commissionAmount: number;
  createdAt: string;
  description: string;
  entryType: FactionBankEntryType;
  grossAmount: number;
  id: string;
  netAmount: number;
  originType: FactionBankOriginType;
  playerId: string | null;
  playerNickname: string | null;
  propertyId: string | null;
}

export interface FactionBankPermissions {
  canDeposit: boolean;
  canView: boolean;
  canWithdraw: boolean;
}

export interface FactionBankResponse {
  faction: FactionSummary;
  ledger: FactionBankLedgerEntry[];
  permissions: FactionBankPermissions;
  playerFactionId: string;
}

export interface FactionBankDepositInput {
  amount: number;
  description?: string;
}

export interface FactionBankWithdrawInput {
  amount: number;
  description?: string;
}

export interface FactionUpgradeEffectsProfile {
  attributeBonusMultiplier: number;
  canAccessExclusiveArsenal: boolean;
  hasFortifiedHeadquarters: boolean;
  muleDeliveryTier: 0 | 1 | 2 | 3 | 4;
  soldierCapacityMultiplier: number;
}

export interface FactionUpgradeDefinitionSummary {
  bankMoneyCost: number;
  effectSummary: string;
  label: string;
  pointsCost: number;
  prerequisiteUpgradeTypes: FactionUpgradeType[];
  type: FactionUpgradeType;
}

export interface FactionUpgradeSummary extends FactionUpgradeDefinitionSummary {
  canUnlock: boolean;
  isUnlocked: boolean;
  lockReason: string | null;
  unlockedAt: string | null;
}

export interface FactionUpgradeCenterResponse {
  availableBankMoney: number;
  availablePoints: number;
  effects: FactionUpgradeEffectsProfile;
  faction: FactionSummary;
  playerFactionId: string;
  upgrades: FactionUpgradeSummary[];
}

export interface FactionUpgradeUnlockResponse extends FactionUpgradeCenterResponse {
  unlockedUpgradeType: FactionUpgradeType;
}

export interface FactionLeaderSummary {
  id: string | null;
  isNpc: boolean;
  level: number | null;
  nickname: string;
  rank: FactionRank;
  vocation: VocationType | null;
}

export interface FactionLeadershipElectionCandidateSummary {
  level: number;
  nickname: string;
  playerId: string;
  rank: FactionRank;
  votes: number;
}

export interface FactionLeadershipElectionSummary {
  candidates: FactionLeadershipElectionCandidateSummary[];
  cooldownEndsAt: string | null;
  createdAt: string;
  endsAt: string | null;
  hasPlayerSupported: boolean;
  hasPlayerVoted: boolean;
  id: string;
  resolvedAt: string | null;
  startedAt: string | null;
  status: FactionLeadershipElectionStatus;
  supportCount: number;
  supportThreshold: number;
  totalVotes: number;
  winnerNickname: string | null;
  winnerPlayerId: string | null;
}

export interface FactionLeadershipChallengeResult {
  challengerConceitoDelta: number;
  challengerHpDelta: number;
  challengerNickname: string;
  challengerPlayerId: string;
  challengerPower: number;
  challengerWon: boolean;
  defenderConceitoDelta: number;
  defenderHpDelta: number;
  defenderNickname: string;
  defenderPlayerId: string | null;
  defenderPower: number;
  defenderWasNpc: boolean;
  resolvedAt: string;
  successChance: number;
}

export interface FactionLeadershipChallengeSummary {
  canChallenge: boolean;
  cooldownEndsAt: string | null;
  cooldownRemainingSeconds: number;
  lastResult: FactionLeadershipChallengeResult | null;
  lockReason: string | null;
  minimumLevel: number;
}

export interface FactionLeadershipCenterResponse {
  challenge: FactionLeadershipChallengeSummary;
  election: FactionLeadershipElectionSummary | null;
  faction: FactionSummary;
  leader: FactionLeaderSummary;
  playerFactionId: string;
}

export interface FactionLeadershipVoteInput {
  candidatePlayerId: string;
}

export interface FactionLeadershipElectionSupportResponse extends FactionLeadershipCenterResponse {
  triggeredElection: boolean;
}

export interface FactionLeadershipVoteResponse extends FactionLeadershipCenterResponse {
  electionResolved: boolean;
}

export interface FactionLeadershipChallengeResponse extends FactionLeadershipCenterResponse {
  result: FactionLeadershipChallengeResult;
}
