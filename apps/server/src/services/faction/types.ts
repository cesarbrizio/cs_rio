import type {
  FactionBankDepositInput,
  FactionBankEntryType,
  FactionBankOriginType,
  FactionBankResponse,
  FactionBankWithdrawInput,
  FactionCreateInput,
  FactionDissolveResponse,
  FactionLeadershipCenterResponse,
  FactionLeadershipChallengeResponse,
  FactionLeadershipElectionStatus,
  FactionLeadershipElectionSupportResponse,
  FactionLeadershipVoteInput,
  FactionLeadershipVoteResponse,
  FactionLeaveResponse,
  FactionListResponse,
  FactionMemberSummary,
  FactionMembersResponse,
  FactionMutationResponse,
  FactionRank,
  FactionRecruitInput,
  FactionSummary,
  FactionUpdateInput,
  FactionUpgradeCenterResponse,
  FactionUpgradeEffectsProfile,
  FactionUpgradeType,
  FactionUpgradeUnlockResponse,
  VocationType,
} from '@cs-rio/shared';

import type { KeyValueStore } from '../auth.js';
import type { FactionContactSyncContract } from '../contact.js';
import type { FactionRobberyPolicy, FactionRobberyPolicyMode } from '../faction-internal-satisfaction.js';
import { DomainError, inferDomainErrorCategory } from '../../errors/domain-error.js';

export interface FactionPlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
  nickname: string;
}

export interface FactionMemberRecord {
  factionId: string;
  joinedAt: Date;
  level: number;
  nickname: string;
  playerId: string;
  rank: FactionRank;
  vocation: VocationType;
}

export interface FactionRecord {
  abbreviation: string;
  bankMoney: string;
  createdAt: Date;
  description: string | null;
  id: string;
  isActive: boolean;
  internalSatisfaction: number;
  isFixed: boolean;
  leaderId: string | null;
  name: string;
  points: number;
  robberyPolicy: FactionRobberyPolicy;
  sortOrder: number;
}

export interface FactionConflictRecord {
  abbreviation: boolean;
  name: boolean;
}

export interface FactionRecruitTargetRecord extends FactionPlayerRecord {
  level: number;
  nickname: string;
  vocation: VocationType;
}

export interface FactionMembershipSnapshot {
  actor: FactionMemberSummary;
  faction: FactionSummary & {
    robberyPolicy: FactionRobberyPolicy;
  };
  members: FactionMemberSummary[];
}

export interface FactionLeadershipElectionRecord {
  cooldownEndsAt: Date | null;
  createdAt: Date;
  endsAt: Date | null;
  factionId: string;
  id: string;
  requestedByPlayerId: string | null;
  resolvedAt: Date | null;
  startedAt: Date | null;
  status: FactionLeadershipElectionStatus;
  supportThreshold: number;
  winnerPlayerId: string | null;
}

export interface FactionLeadershipSupportRecord {
  electionId: string;
  playerId: string;
  supportedAt: Date;
}

export interface FactionLeadershipVoteRecord {
  candidatePlayerId: string;
  electionId: string;
  votedAt: Date;
  voterPlayerId: string;
}

export interface FactionLeadershipChallengeRecord {
  challengerConceitoDelta: number;
  challengerHpDelta: number;
  challengerPlayerId: string;
  challengerPower: number;
  challengerWon: boolean;
  cooldownEndsAt: Date;
  createdAt: Date;
  defenderConceitoDelta: number;
  defenderHpDelta: number;
  defenderPlayerId: string | null;
  defenderPower: number;
  defenderWasNpc: boolean;
  factionId: string;
  id: string;
  resolvedAt: Date;
  successChancePercent: number;
}

export interface FactionLeadershipPlayerRecord extends FactionPlayerRecord {
  carisma: number;
  conceito: number;
  forca: number;
  hp: number;
  inteligencia: number;
  level: number;
  resistencia: number;
  cansaco: number;
  vocation: VocationType;
}

export interface FactionUpgradeRecord {
  level: number;
  type: FactionUpgradeType;
  unlockedAt: Date;
}

export interface FactionBankLedgerRecord {
  balanceAfter: number;
  commissionAmount: number;
  createdAt: Date;
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

export interface FactionBankLedgerInsertInput {
  balanceAfter: number;
  commissionAmount: number;
  createdAt: Date;
  description: string;
  entryType: FactionBankEntryType;
  factionId: string;
  grossAmount: number;
  netAmount: number;
  originType: FactionBankOriginType;
  playerId?: string | null;
  propertyId?: string | null;
}

export interface FactionRobberyPolicyUpdateInput {
  global?: FactionRobberyPolicyMode;
  regions?: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

export interface FactionRobberyPolicyResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

export type RegionId = 'zona_sul' | 'zona_norte' | 'centro' | 'zona_oeste' | 'zona_sudoeste' | 'baixada';

export interface FactionRepository {
  addMember(factionId: string, playerId: string, rank: FactionRank, now: Date): Promise<boolean>;
  addFactionLeadershipSupport(electionId: string, playerId: string, now: Date): Promise<boolean>;
  activateFactionLeadershipElection(electionId: string, startsAt: Date, endsAt: Date): Promise<void>;
  createFaction(
    playerId: string,
    input: {
      abbreviation: string;
      description: string | null;
      name: string;
    },
    now: Date,
  ): Promise<FactionSummary | null>;
  createFactionLeadershipElection(
    factionId: string,
    requestedByPlayerId: string,
    supportThreshold: number,
    now: Date,
  ): Promise<FactionLeadershipElectionRecord>;
  getLatestFactionLeadershipChallenge(factionId: string): Promise<FactionLeadershipChallengeRecord | null>;
  getLatestFactionLeadershipElection(factionId: string): Promise<FactionLeadershipElectionRecord | null>;
  getLeadershipPlayer(playerId: string): Promise<FactionLeadershipPlayerRecord | null>;
  dissolveFaction(factionId: string): Promise<string[]>;
  findFactionById(playerId: string, factionId: string): Promise<FactionSummary | null>;
  findFactionConflict(
    normalizedName: string,
    normalizedAbbreviation: string,
    excludeFactionId?: string,
  ): Promise<FactionConflictRecord | null>;
  findRecruitTargetByNickname(nickname: string): Promise<FactionRecruitTargetRecord | null>;
  getPlayer(playerId: string): Promise<FactionPlayerRecord | null>;
  depositToFactionBank(
    playerId: string,
    factionId: string,
    input: {
      amount: number;
      description: string;
      now: Date;
    },
  ): Promise<boolean>;
  listFactionLeadershipSupports(electionId: string): Promise<FactionLeadershipSupportRecord[]>;
  listFactionLeadershipVotes(electionId: string): Promise<FactionLeadershipVoteRecord[]>;
  listFactionBankLedger(factionId: string, limit: number): Promise<FactionBankLedgerRecord[]>;
  listFactionMemberIds(factionId: string): Promise<string[]>;
  listFactionMembers(factionId: string): Promise<FactionMemberRecord[]>;
  listFactions(playerId: string): Promise<FactionSummary[]>;
  listFactionUpgrades(factionId: string): Promise<FactionUpgradeRecord[]>;
  removeMember(factionId: string, playerId: string): Promise<boolean>;
  recordFactionLeadershipChallenge(input: {
    challengerConceitoDelta: number;
    challengerHpDelta: number;
    challengerPlayerId: string;
    challengerPower: number;
    challengerWon: boolean;
    cooldownEndsAt: Date;
    createdAt: Date;
    defenderConceitoDelta: number;
    defenderHpDelta: number;
    defenderPlayerId: string | null;
    defenderPower: number;
    defenderWasNpc: boolean;
    factionId: string;
    resolvedAt: Date;
    cansacoCost: number;
    successChancePercent: number;
  }): Promise<FactionLeadershipChallengeRecord>;
  recordFactionLeadershipVote(
    electionId: string,
    voterPlayerId: string,
    candidatePlayerId: string,
    now: Date,
  ): Promise<boolean>;
  resolveFactionLeadershipElection(
    electionId: string,
    winnerPlayerId: string | null,
    resolvedAt: Date,
    cooldownEndsAt: Date,
  ): Promise<void>;
  transferFactionLeadership(
    factionId: string,
    newLeaderPlayerId: string,
    previousLeaderPlayerId: string | null,
  ): Promise<string[]>;
  unlockFactionUpgrade(
    playerId: string,
    factionId: string,
    upgradeType: FactionUpgradeType,
    bankMoneyCost: number,
    now: Date,
  ): Promise<boolean>;
  updateFaction(
    factionId: string,
    input: {
      abbreviation?: string;
      description?: string | null;
      name?: string;
    },
  ): Promise<FactionSummary | null>;
  updateFactionRobberyPolicy(
    playerId: string,
    factionId: string,
    robberyPolicy: FactionRobberyPolicy,
    internalSatisfaction: number,
  ): Promise<FactionSummary | null>;
  updateMemberRank(factionId: string, playerId: string, rank: FactionRank): Promise<boolean>;
  withdrawFromFactionBank(
    playerId: string,
    factionId: string,
    input: {
      amount: number;
      description: string;
      now: Date;
    },
  ): Promise<boolean>;
}

export interface FactionServiceOptions {
  contactSync?: FactionContactSyncContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  random?: () => number;
  repository?: FactionRepository;
}

export interface FactionServiceContract {
  close?(): Promise<void>;
  createFaction(playerId: string, input: FactionCreateInput): Promise<FactionMutationResponse>;
  demoteMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse>;
  dissolveFaction(playerId: string, factionId: string): Promise<FactionDissolveResponse>;
  expelMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse>;
  depositToFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankDepositInput,
  ): Promise<FactionBankResponse>;
  getFactionMembers(playerId: string, factionId: string): Promise<FactionMembersResponse>;
  getFactionBank(playerId: string, factionId: string): Promise<FactionBankResponse>;
  getFactionLeadership(playerId: string, factionId: string): Promise<FactionLeadershipCenterResponse>;
  getFactionRobberyPolicy(playerId: string, factionId: string): Promise<FactionRobberyPolicyResponse>;
  getFactionUpgradeEffectsForFaction(factionId: string | null): Promise<FactionUpgradeEffectsProfile>;
  getFactionUpgrades(playerId: string, factionId: string): Promise<FactionUpgradeCenterResponse>;
  joinFixedFaction(playerId: string, factionId: string): Promise<FactionMutationResponse>;
  leaveFaction(playerId: string, factionId: string): Promise<FactionLeaveResponse>;
  listFactions(playerId: string): Promise<FactionListResponse>;
  promoteMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse>;
  recruitMember(
    actorPlayerId: string,
    factionId: string,
    input: FactionRecruitInput,
  ): Promise<FactionMembersResponse>;
  supportFactionLeadershipElection(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipElectionSupportResponse>;
  challengeFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipChallengeResponse>;
  updateFaction(
    playerId: string,
    factionId: string,
    input: FactionUpdateInput,
  ): Promise<FactionMutationResponse>;
  updateFactionRobberyPolicy(
    playerId: string,
    factionId: string,
    input: FactionRobberyPolicyUpdateInput,
  ): Promise<FactionRobberyPolicyResponse>;
  unlockFactionUpgrade(
    playerId: string,
    factionId: string,
    upgradeType: FactionUpgradeType,
  ): Promise<FactionUpgradeUnlockResponse>;
  withdrawFromFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankWithdrawInput,
  ): Promise<FactionBankResponse>;
  voteFactionLeadership(
    playerId: string,
    factionId: string,
    input: FactionLeadershipVoteInput,
  ): Promise<FactionLeadershipVoteResponse>;
}

export interface FactionUpgradeEffectReaderContract {
  getFactionUpgradeEffectsForFaction(factionId: string | null): Promise<FactionUpgradeEffectsProfile>;
}

type FactionErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'forbidden'
  | 'insufficient_funds'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export function factionError(code: FactionErrorCode, message: string): DomainError {
  return new DomainError('faction', code, inferDomainErrorCategory(code), message);
}

export class FactionError extends DomainError {
  constructor(
    code: FactionErrorCode,
    message: string,
  ) {
    super('faction', code, inferDomainErrorCategory(code), message);
    this.name = 'FactionError';
  }
}
