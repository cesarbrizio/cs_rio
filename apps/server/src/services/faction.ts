import {
  FACTION_EMPTY_UPGRADE_EFFECTS,
  FACTION_UPGRADE_DEFINITIONS,
  type FactionBankDepositInput,
  type FactionBankEntryType,
  type FactionBankOriginType,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
  type FactionLeadershipCenterResponse,
  type FactionLeadershipChallengeResponse,
  type FactionLeadershipChallengeResult,
  type FactionLeadershipElectionStatus,
  type FactionLeadershipElectionSupportResponse,
  type FactionLeadershipElectionSummary,
  type FactionLeadershipVoteInput,
  type FactionLeadershipVoteResponse,
  type FactionLeaderSummary,
  type FactionCreateInput,
  type FactionDissolveResponse,
  type FactionUpgradeCenterResponse,
  type FactionUpgradeEffectsProfile,
  type FactionUpgradeSummary,
  type FactionUpgradeType,
  type FactionUpgradeUnlockResponse,
  type FactionLeaveResponse,
  type FactionListResponse,
  type FactionMemberSummary,
  type FactionMembersResponse,
  type FactionMutationResponse,
  type FactionRank,
  type FactionRecruitInput,
  type FactionSummary,
  type FactionUpdateInput,
  type VocationType,
} from '@cs-rio/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionBankLedger,
  factionLeadershipChallenges,
  factionLeadershipElections,
  factionLeadershipElectionSupports,
  factionLeadershipElectionVotes,
  factionMembers,
  factionUpgrades,
  factions,
  players,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import {
  applyFactionInternalSatisfactionDelta,
  type FactionRobberyPolicy,
  type FactionRobberyPolicyMode,
  resolveFactionRobberyPolicySatisfactionDelta,
} from './faction-internal-satisfaction.js';
import { GameConfigService } from './game-config.js';
import { resolveDefaultFactionRobberyPolicy } from './gameplay-config.js';
import { buildPlayerProfileCacheKey } from './player.js';

const FACTION_ABBREVIATION_MAX_LENGTH = 12;
const FACTION_ABBREVIATION_MIN_LENGTH = 2;
const FACTION_LEADERSHIP_CHALLENGE_CONCEITO_LOSS = 80;
const FACTION_LEADERSHIP_CHALLENGE_CONCEITO_REWARD = 120;
const FACTION_LEADERSHIP_CHALLENGE_COOLDOWN_HOURS = 24;
const FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_FAIL = 10;
const FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_SUCCESS = 26;
const FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_FAIL = 22;
const FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_SUCCESS = 12;
const FACTION_LEADERSHIP_CHALLENGE_MIN_LEVEL = 9;
const FACTION_LEADERSHIP_CHALLENGE_STAMINA_COST = 30;
const FACTION_LEADERSHIP_ELECTION_COOLDOWN_HOURS = 24;
const FACTION_LEADERSHIP_ELECTION_DURATION_HOURS = 12;
const FACTION_LEADERSHIP_MIN_CANDIDATE_LEVEL = 5;
const FACTION_DESCRIPTION_MAX_LENGTH = 500;
const FACTION_NAME_MAX_LENGTH = 120;
const FACTION_NAME_MIN_LENGTH = 3;
const FIXED_FACTION_SELF_JOIN_SLOT_CAP = 20;
const FACTION_RANK_ORDER: FactionRank[] = ['patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria'];
const FACTION_RANK_LIMITS: Partial<Record<FactionRank, number>> = {
  general: 2,
  gerente: 5,
  patrao: 1,
  vapor: 10,
};
const gameConfigService = new GameConfigService();

type DatabaseClient = typeof db;

interface FactionPlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
  nickname: string;
}

interface FactionMemberRecord {
  factionId: string;
  joinedAt: Date;
  level: number;
  nickname: string;
  playerId: string;
  rank: FactionRank;
  vocation: VocationType;
}

interface FactionRecord {
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

interface FactionConflictRecord {
  abbreviation: boolean;
  name: boolean;
}

interface FactionRecruitTargetRecord extends FactionPlayerRecord {
  level: number;
  nickname: string;
  vocation: VocationType;
}

interface FactionMembershipSnapshot {
  actor: FactionMemberSummary;
  faction: FactionSummary & {
    robberyPolicy: FactionRobberyPolicy;
  };
  members: FactionMemberSummary[];
}

interface FactionLeadershipElectionRecord {
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

interface FactionLeadershipSupportRecord {
  electionId: string;
  playerId: string;
  supportedAt: Date;
}

interface FactionLeadershipVoteRecord {
  candidatePlayerId: string;
  electionId: string;
  votedAt: Date;
  voterPlayerId: string;
}

interface FactionLeadershipChallengeRecord {
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

interface FactionLeadershipPlayerRecord extends FactionPlayerRecord {
  carisma: number;
  conceito: number;
  forca: number;
  hp: number;
  inteligencia: number;
  level: number;
  resistencia: number;
  stamina: number;
  vocation: VocationType;
}

interface FactionUpgradeRecord {
  level: number;
  type: FactionUpgradeType;
  unlockedAt: Date;
}

interface FactionBankLedgerRecord {
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

interface FactionBankLedgerInsertInput {
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

interface FactionRobberyPolicyUpdateInput {
  global?: FactionRobberyPolicyMode;
  regions?: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

interface FactionRobberyPolicyResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

type RegionId = 'zona_sul' | 'zona_norte' | 'centro' | 'zona_oeste' | 'zona_sudoeste' | 'baixada';

const DEFAULT_FACTION_ROBBERY_POLICY: FactionRobberyPolicy = {
  global: 'allowed',
  regions: {},
};

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
    staminaCost: number;
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
    factionId: string,
    upgradeType: FactionUpgradeType,
    pointsCost: number,
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

export class FactionError extends Error {
  constructor(
    public readonly code: FactionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FactionError';
  }
}

export async function insertFactionBankLedgerEntry(
  executor: DatabaseClient,
  input: FactionBankLedgerInsertInput,
): Promise<void> {
  await executor.insert(factionBankLedger).values({
    balanceAfter: input.balanceAfter.toFixed(2),
    commissionAmount: input.commissionAmount.toFixed(2),
    createdAt: input.createdAt,
    description: input.description,
    entryType: input.entryType,
    factionId: input.factionId,
    grossAmount: input.grossAmount.toFixed(2),
    netAmount: input.netAmount.toFixed(2),
    originType: input.originType,
    playerId: input.playerId ?? null,
    propertyId: input.propertyId ?? null,
  });
}

export function calculateFactionPointsDelta(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(amount));
}

export class DatabaseFactionRepository implements FactionRepository {
  async addMember(
    factionId: string,
    playerId: string,
    rank: FactionRank,
    now: Date,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          factionId: players.factionId,
          id: players.id,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player || player.factionId) {
        return false;
      }

      await tx.insert(factionMembers).values({
        factionId,
        joinedAt: now,
        playerId,
        rank,
      });

      await tx
        .update(players)
        .set({
          factionId,
        })
        .where(eq(players.id, playerId));

      return true;
    });
  }

  async addFactionLeadershipSupport(
    electionId: string,
    playerId: string,
    now: Date,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          electionId: factionLeadershipElectionSupports.electionId,
        })
        .from(factionLeadershipElectionSupports)
        .where(
          and(
            eq(factionLeadershipElectionSupports.electionId, electionId),
            eq(factionLeadershipElectionSupports.playerId, playerId),
          ),
        )
        .limit(1);

      if (existing) {
        return false;
      }

      await tx.insert(factionLeadershipElectionSupports).values({
        electionId,
        playerId,
        supportedAt: now,
      });

      return true;
    });
  }

  async activateFactionLeadershipElection(electionId: string, startsAt: Date, endsAt: Date): Promise<void> {
    await db
      .update(factionLeadershipElections)
      .set({
        endsAt,
        startedAt: startsAt,
        status: 'active',
      })
      .where(eq(factionLeadershipElections.id, electionId));
  }

  async createFaction(
    playerId: string,
    input: {
      abbreviation: string;
      description: string | null;
      name: string;
    },
    now: Date,
  ): Promise<FactionSummary | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          id: players.id,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player) {
        return null;
      }

      const defaultRobberyPolicy = resolveDefaultFactionRobberyPolicy(
        await gameConfigService.getResolvedCatalog({ now }),
      );
      const [createdFaction] = await tx
        .insert(factions)
        .values({
          abbreviation: input.abbreviation,
          createdAt: now,
          description: input.description,
          isFixed: false,
          leaderId: playerId,
          name: input.name,
          robberyPolicyJson: defaultRobberyPolicy,
        })
        .returning();

      if (!createdFaction) {
        return null;
      }

      await tx.insert(factionMembers).values({
        factionId: createdFaction.id,
        joinedAt: now,
        playerId,
        rank: 'patrao',
      });

      await tx
        .update(players)
        .set({
          factionId: createdFaction.id,
        })
        .where(eq(players.id, playerId));

      return this.findFactionSummary(tx as unknown as DatabaseClient, playerId, createdFaction.id);
    });
  }

  async createFactionLeadershipElection(
    factionId: string,
    requestedByPlayerId: string,
    supportThreshold: number,
    now: Date,
  ): Promise<FactionLeadershipElectionRecord> {
    const [createdElection] = await db
      .insert(factionLeadershipElections)
      .values({
        createdAt: now,
        factionId,
        requestedByPlayerId,
        status: 'petitioning',
        supportThreshold,
      })
      .returning();

    if (!createdElection) {
      throw new Error('Falha ao criar eleicao de lideranca.');
    }

    return createdElection;
  }

  async getLatestFactionLeadershipChallenge(
    factionId: string,
  ): Promise<FactionLeadershipChallengeRecord | null> {
    const [challenge] = await db
      .select()
      .from(factionLeadershipChallenges)
      .where(eq(factionLeadershipChallenges.factionId, factionId))
      .orderBy(desc(factionLeadershipChallenges.createdAt), desc(factionLeadershipChallenges.id))
      .limit(1);

    return challenge ?? null;
  }

  async getLatestFactionLeadershipElection(
    factionId: string,
  ): Promise<FactionLeadershipElectionRecord | null> {
    const [election] = await db
      .select()
      .from(factionLeadershipElections)
      .where(eq(factionLeadershipElections.factionId, factionId))
      .orderBy(desc(factionLeadershipElections.createdAt), desc(factionLeadershipElections.id))
      .limit(1);

    return election ?? null;
  }

  async getLeadershipPlayer(playerId: string): Promise<FactionLeadershipPlayerRecord | null> {
    const [player] = await db
      .select({
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        factionId: players.factionId,
        forca: players.forca,
        hp: players.hp,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        money: players.money,
        nickname: players.nickname,
        resistencia: players.resistencia,
        stamina: players.stamina,
        vocation: players.vocation,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      conceito: player.conceito,
      factionId: player.factionId,
      forca: player.forca,
      hp: player.hp,
      id: player.id,
      inteligencia: player.inteligencia,
      level: player.level,
      money: roundCurrency(Number.parseFloat(String(player.money))),
      nickname: player.nickname,
      resistencia: player.resistencia,
      stamina: player.stamina,
      vocation: player.vocation as VocationType,
    };
  }

  async dissolveFaction(factionId: string): Promise<string[]> {
    return db.transaction(async (tx) => {
      const memberRows = await tx
        .select({
          playerId: factionMembers.playerId,
        })
        .from(factionMembers)
        .where(eq(factionMembers.factionId, factionId));
      const electionRows = await tx
        .select({
          id: factionLeadershipElections.id,
        })
        .from(factionLeadershipElections)
        .where(eq(factionLeadershipElections.factionId, factionId));
      const electionIds = electionRows.map((entry) => entry.id);

      await tx.delete(factionUpgrades).where(eq(factionUpgrades.factionId, factionId));
      await tx.delete(factionBankLedger).where(eq(factionBankLedger.factionId, factionId));
      await tx.delete(factionLeadershipChallenges).where(eq(factionLeadershipChallenges.factionId, factionId));
      if (electionIds.length > 0) {
        await tx
          .delete(factionLeadershipElectionVotes)
          .where(inArray(factionLeadershipElectionVotes.electionId, electionIds));
        await tx
          .delete(factionLeadershipElectionSupports)
          .where(inArray(factionLeadershipElectionSupports.electionId, electionIds));
      }
      await tx.delete(factionLeadershipElections).where(eq(factionLeadershipElections.factionId, factionId));
      await tx.delete(factionMembers).where(eq(factionMembers.factionId, factionId));
      await tx
        .update(players)
        .set({
          factionId: null,
        })
        .where(eq(players.factionId, factionId));
      await tx.delete(factions).where(eq(factions.id, factionId));

      return memberRows.map((entry) => entry.playerId);
    });
  }

  async findFactionById(playerId: string, factionId: string): Promise<FactionSummary | null> {
    return this.findFactionSummary(db, playerId, factionId);
  }

  async findFactionConflict(
    normalizedName: string,
    normalizedAbbreviation: string,
    excludeFactionId?: string,
  ): Promise<FactionConflictRecord | null> {
    const factionRows = await db
      .select({
        abbreviation: factions.abbreviation,
        id: factions.id,
        name: factions.name,
      })
      .from(factions);

    let hasNameConflict = false;
    let hasAbbreviationConflict = false;

    for (const faction of factionRows) {
      if (excludeFactionId && faction.id === excludeFactionId) {
        continue;
      }

      if (normalizeFactionName(faction.name) === normalizedName) {
        hasNameConflict = true;
      }

      if (normalizeFactionAbbreviation(faction.abbreviation) === normalizedAbbreviation) {
        hasAbbreviationConflict = true;
      }
    }

    if (!hasNameConflict && !hasAbbreviationConflict) {
      return null;
    }

    return {
      abbreviation: hasAbbreviationConflict,
      name: hasNameConflict,
    };
  }

  async findRecruitTargetByNickname(nickname: string): Promise<FactionRecruitTargetRecord | null> {
    const normalizedNickname = nickname.trim();

    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        level: players.level,
        money: players.money,
        nickname: players.nickname,
        vocation: players.vocation,
      })
      .from(players)
      .where(eq(players.nickname, normalizedNickname))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      level: player.level,
      money: Number.parseFloat(String(player.money ?? '0')),
      nickname: player.nickname,
      vocation: player.vocation as VocationType,
    };
  }

  async getPlayer(playerId: string): Promise<FactionPlayerRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        money: players.money,
        nickname: players.nickname,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: roundCurrency(Number.parseFloat(String(player.money))),
      nickname: player.nickname,
    };
  }

  async depositToFactionBank(
    playerId: string,
    factionId: string,
    input: {
      amount: number;
      description: string;
      now: Date;
    },
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          factionId: players.factionId,
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, factionId))
        .limit(1);

      if (!player || !faction || player.factionId !== factionId) {
        return false;
      }

      const nextPlayerMoney = roundCurrency(Number.parseFloat(String(player.money)) - input.amount);
      const nextFactionBankMoney = roundCurrency(Number.parseFloat(String(faction.bankMoney)) + input.amount);
      const pointsDelta = calculateFactionPointsDelta(input.amount);

      await tx
        .update(players)
        .set({
          money: nextPlayerMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(factions)
        .set({
          bankMoney: nextFactionBankMoney.toFixed(2),
          points: sql`${factions.points} + ${pointsDelta}`,
        })
        .where(eq(factions.id, factionId));

      await insertFactionBankLedgerEntry(tx as unknown as DatabaseClient, {
        balanceAfter: nextFactionBankMoney,
        commissionAmount: 0,
        createdAt: input.now,
        description: input.description,
        entryType: 'deposit',
        factionId,
        grossAmount: input.amount,
        netAmount: input.amount,
        originType: 'manual',
        playerId,
      });

      return true;
    });
  }

  async listFactionBankLedger(factionId: string, limit: number): Promise<FactionBankLedgerRecord[]> {
    const entryRows = await db
      .select({
        balanceAfter: factionBankLedger.balanceAfter,
        commissionAmount: factionBankLedger.commissionAmount,
        createdAt: factionBankLedger.createdAt,
        description: factionBankLedger.description,
        entryType: factionBankLedger.entryType,
        grossAmount: factionBankLedger.grossAmount,
        id: factionBankLedger.id,
        netAmount: factionBankLedger.netAmount,
        originType: factionBankLedger.originType,
        playerId: factionBankLedger.playerId,
        playerNickname: players.nickname,
        propertyId: factionBankLedger.propertyId,
      })
      .from(factionBankLedger)
      .leftJoin(players, eq(players.id, factionBankLedger.playerId))
      .where(eq(factionBankLedger.factionId, factionId))
      .orderBy(desc(factionBankLedger.createdAt), desc(factionBankLedger.id))
      .limit(limit);

    return entryRows.map((entry) => ({
      balanceAfter: roundCurrency(Number.parseFloat(String(entry.balanceAfter))),
      commissionAmount: roundCurrency(Number.parseFloat(String(entry.commissionAmount))),
      createdAt: entry.createdAt,
      description: entry.description,
      entryType: entry.entryType,
      grossAmount: roundCurrency(Number.parseFloat(String(entry.grossAmount))),
      id: entry.id,
      netAmount: roundCurrency(Number.parseFloat(String(entry.netAmount))),
      originType: entry.originType,
      playerId: entry.playerId,
      playerNickname: entry.playerNickname,
      propertyId: entry.propertyId,
    }));
  }

  async listFactionLeadershipSupports(
    electionId: string,
  ): Promise<FactionLeadershipSupportRecord[]> {
    return db
      .select({
        electionId: factionLeadershipElectionSupports.electionId,
        playerId: factionLeadershipElectionSupports.playerId,
        supportedAt: factionLeadershipElectionSupports.supportedAt,
      })
      .from(factionLeadershipElectionSupports)
      .where(eq(factionLeadershipElectionSupports.electionId, electionId));
  }

  async listFactionLeadershipVotes(electionId: string): Promise<FactionLeadershipVoteRecord[]> {
    return db
      .select({
        candidatePlayerId: factionLeadershipElectionVotes.candidatePlayerId,
        electionId: factionLeadershipElectionVotes.electionId,
        votedAt: factionLeadershipElectionVotes.votedAt,
        voterPlayerId: factionLeadershipElectionVotes.voterPlayerId,
      })
      .from(factionLeadershipElectionVotes)
      .where(eq(factionLeadershipElectionVotes.electionId, electionId));
  }

  async listFactionUpgrades(factionId: string): Promise<FactionUpgradeRecord[]> {
    const rows = await db
      .select({
        level: factionUpgrades.level,
        type: factionUpgrades.upgradeType,
        unlockedAt: factionUpgrades.unlockedAt,
      })
      .from(factionUpgrades)
      .where(eq(factionUpgrades.factionId, factionId));

    return rows.map((row) => ({
      level: row.level,
      type: row.type,
      unlockedAt: row.unlockedAt,
    }));
  }

  async listFactionMemberIds(factionId: string): Promise<string[]> {
    const memberRows = await db
      .select({
        playerId: factionMembers.playerId,
      })
      .from(factionMembers)
      .where(eq(factionMembers.factionId, factionId));

    return memberRows.map((entry) => entry.playerId);
  }

  async listFactionMembers(factionId: string): Promise<FactionMemberRecord[]> {
    const memberRows = await db
      .select({
        factionId: factionMembers.factionId,
        joinedAt: factionMembers.joinedAt,
        playerId: factionMembers.playerId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(eq(factionMembers.factionId, factionId));

    if (memberRows.length === 0) {
      return [];
    }

    const playerRows = await db
      .select({
        id: players.id,
        level: players.level,
        nickname: players.nickname,
        vocation: players.vocation,
      })
      .from(players)
      .where(
        inArray(
          players.id,
          memberRows.map((entry) => entry.playerId),
        ),
      );

    const playersById = new Map(
      playerRows.map((player) => [
        player.id,
        {
          level: player.level,
          nickname: player.nickname,
          vocation: player.vocation as VocationType,
        },
      ]),
    );

    return memberRows
      .map((member) => {
        const player = playersById.get(member.playerId);

        if (!player) {
          return null;
        }

        return {
          factionId: member.factionId,
          joinedAt: member.joinedAt,
          level: player.level,
          nickname: player.nickname,
          playerId: member.playerId,
          rank: member.rank,
          vocation: player.vocation,
        } satisfies FactionMemberRecord;
      })
      .filter((member): member is FactionMemberRecord => member !== null)
      .sort(compareFactionMemberRecords);
  }

  async listFactions(playerId: string): Promise<FactionSummary[]> {
    const factionRows = await db
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        createdAt: factions.createdAt,
        description: factions.description,
        id: factions.id,
        isActive: factions.isActive,
        internalSatisfaction: factions.internalSatisfaction,
        isFixed: factions.isFixed,
        leaderId: factions.leaderId,
        name: factions.name,
        points: factions.points,
        robberyPolicyJson: factions.robberyPolicyJson,
        sortOrder: factions.sortOrder,
      })
      .from(factions);

    const memberRows = await db
      .select({
        factionId: factionMembers.factionId,
        joinedAt: factionMembers.joinedAt,
        playerId: factionMembers.playerId,
        rank: factionMembers.rank,
      })
      .from(factionMembers);

    return buildFactionSummaries(playerId, factionRows, memberRows);
  }

  async removeMember(factionId: string, playerId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [member] = await tx
        .select({
          playerId: factionMembers.playerId,
        })
        .from(factionMembers)
        .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.playerId, playerId)))
        .limit(1);

      if (!member) {
        return false;
      }

      await tx
        .delete(factionMembers)
        .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.playerId, playerId)));

      await tx
        .update(players)
        .set({
          factionId: null,
        })
        .where(eq(players.id, playerId));

      return true;
    });
  }

  async recordFactionLeadershipChallenge(input: {
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
    staminaCost: number;
    successChancePercent: number;
  }): Promise<FactionLeadershipChallengeRecord> {
    return db.transaction(async (tx) => {
      const [challenger] = await tx
        .select({
          conceito: players.conceito,
          hp: players.hp,
          stamina: players.stamina,
        })
        .from(players)
        .where(eq(players.id, input.challengerPlayerId))
        .limit(1);

      if (!challenger) {
        throw new Error('Desafiante nao encontrado para registrar desafio de lideranca.');
      }

      await tx
        .update(players)
        .set({
          conceito: Math.max(0, challenger.conceito + input.challengerConceitoDelta),
          hp: Math.max(1, challenger.hp + input.challengerHpDelta),
          stamina: Math.max(0, challenger.stamina - input.staminaCost),
        })
        .where(eq(players.id, input.challengerPlayerId));

      if (input.defenderPlayerId) {
        const [defender] = await tx
          .select({
            conceito: players.conceito,
            hp: players.hp,
          })
          .from(players)
          .where(eq(players.id, input.defenderPlayerId))
          .limit(1);

        if (defender) {
          await tx
            .update(players)
            .set({
              conceito: Math.max(0, defender.conceito + input.defenderConceitoDelta),
              hp: Math.max(1, defender.hp + input.defenderHpDelta),
            })
            .where(eq(players.id, input.defenderPlayerId));
        }
      }

      const [createdChallenge] = await tx
        .insert(factionLeadershipChallenges)
        .values({
          challengerConceitoDelta: input.challengerConceitoDelta,
          challengerHpDelta: input.challengerHpDelta,
          challengerPlayerId: input.challengerPlayerId,
          challengerPower: input.challengerPower,
          challengerWon: input.challengerWon,
          cooldownEndsAt: input.cooldownEndsAt,
          createdAt: input.createdAt,
          defenderConceitoDelta: input.defenderConceitoDelta,
          defenderHpDelta: input.defenderHpDelta,
          defenderPlayerId: input.defenderPlayerId,
          defenderPower: input.defenderPower,
          defenderWasNpc: input.defenderWasNpc,
          factionId: input.factionId,
          resolvedAt: input.resolvedAt,
          successChancePercent: input.successChancePercent,
        })
        .returning();

      if (!createdChallenge) {
        throw new Error('Falha ao registrar desafio de lideranca.');
      }

      return createdChallenge;
    });
  }

  async recordFactionLeadershipVote(
    electionId: string,
    voterPlayerId: string,
    candidatePlayerId: string,
    now: Date,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          electionId: factionLeadershipElectionVotes.electionId,
        })
        .from(factionLeadershipElectionVotes)
        .where(
          and(
            eq(factionLeadershipElectionVotes.electionId, electionId),
            eq(factionLeadershipElectionVotes.voterPlayerId, voterPlayerId),
          ),
        )
        .limit(1);

      if (existing) {
        return false;
      }

      await tx.insert(factionLeadershipElectionVotes).values({
        candidatePlayerId,
        electionId,
        votedAt: now,
        voterPlayerId,
      });

      return true;
    });
  }

  async resolveFactionLeadershipElection(
    electionId: string,
    winnerPlayerId: string | null,
    resolvedAt: Date,
    cooldownEndsAt: Date,
  ): Promise<void> {
    await db
      .update(factionLeadershipElections)
      .set({
        cooldownEndsAt,
        resolvedAt,
        status: 'resolved',
        winnerPlayerId,
      })
      .where(eq(factionLeadershipElections.id, electionId));
  }

  async transferFactionLeadership(
    factionId: string,
    newLeaderPlayerId: string,
    previousLeaderPlayerId: string | null,
  ): Promise<string[]> {
    return db.transaction(async (tx) => {
      await tx
        .update(factions)
        .set({
          leaderId: newLeaderPlayerId,
        })
        .where(eq(factions.id, factionId));

      await tx
        .update(factionMembers)
        .set({
          rank: 'patrao',
        })
        .where(
          and(eq(factionMembers.factionId, factionId), eq(factionMembers.playerId, newLeaderPlayerId)),
        );

      if (previousLeaderPlayerId && previousLeaderPlayerId !== newLeaderPlayerId) {
        await tx
          .update(factionMembers)
          .set({
            rank: 'general',
          })
          .where(
            and(
              eq(factionMembers.factionId, factionId),
              eq(factionMembers.playerId, previousLeaderPlayerId),
            ),
          );
      }

      return [newLeaderPlayerId, previousLeaderPlayerId]
        .filter((playerId): playerId is string => Boolean(playerId));
    });
  }

  async updateFaction(
    factionId: string,
    input: {
      abbreviation?: string;
      description?: string | null;
      name?: string;
    },
  ): Promise<FactionSummary | null> {
    const values: {
      abbreviation?: string;
      description?: string | null;
      name?: string;
    } = {};

    if (input.name !== undefined) {
      values.name = input.name;
    }

    if (input.abbreviation !== undefined) {
      values.abbreviation = input.abbreviation;
    }

    if (input.description !== undefined) {
      values.description = input.description;
    }

    if (Object.keys(values).length === 0) {
      return null;
    }

    return db.transaction(async (tx) => {
      const [updatedFaction] = await tx
        .update(factions)
        .set(values)
        .where(eq(factions.id, factionId))
        .returning({
          id: factions.id,
        });

      if (!updatedFaction) {
        return null;
      }

      const leaderId = await this.findFactionLeader(tx as unknown as DatabaseClient, factionId);

      if (!leaderId) {
        return null;
      }

      return this.findFactionSummary(tx as unknown as DatabaseClient, leaderId, factionId);
    });
  }

  async updateFactionRobberyPolicy(
    playerId: string,
    factionId: string,
    robberyPolicy: FactionRobberyPolicy,
    internalSatisfaction: number,
  ): Promise<FactionSummary | null> {
    return db.transaction(async (tx) => {
      const [updatedFaction] = await tx
        .update(factions)
        .set({
          internalSatisfaction,
          robberyPolicyJson: robberyPolicy,
        })
        .where(eq(factions.id, factionId))
        .returning({
          id: factions.id,
        });

      if (!updatedFaction) {
        return null;
      }

      return this.findFactionSummary(tx as unknown as DatabaseClient, playerId, factionId);
    });
  }

  async updateMemberRank(
    factionId: string,
    playerId: string,
    rank: FactionRank,
  ): Promise<boolean> {
    const [updatedMember] = await db
      .update(factionMembers)
      .set({
        rank,
      })
      .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.playerId, playerId)))
      .returning({
        factionId: factionMembers.factionId,
      });

    return updatedMember?.factionId === factionId;
  }

  async unlockFactionUpgrade(
    factionId: string,
    upgradeType: FactionUpgradeType,
    pointsCost: number,
    now: Date,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          points: factions.points,
        })
        .from(factions)
        .where(eq(factions.id, factionId))
        .limit(1);

      if (!faction || faction.points < pointsCost) {
        return false;
      }

      const [existing] = await tx
        .select({
          factionId: factionUpgrades.factionId,
        })
        .from(factionUpgrades)
        .where(and(eq(factionUpgrades.factionId, factionId), eq(factionUpgrades.upgradeType, upgradeType)))
        .limit(1);

      if (existing) {
        return false;
      }

      await tx.insert(factionUpgrades).values({
        factionId,
        level: 1,
        unlockedAt: now,
        upgradeType,
      });

      await tx
        .update(factions)
        .set({
          points: faction.points - pointsCost,
        })
        .where(eq(factions.id, factionId));

      return true;
    });
  }

  async withdrawFromFactionBank(
    playerId: string,
    factionId: string,
    input: {
      amount: number;
      description: string;
      now: Date;
    },
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          factionId: players.factionId,
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, factionId))
        .limit(1);

      if (!player || !faction || player.factionId !== factionId) {
        return false;
      }

      const nextPlayerMoney = roundCurrency(Number.parseFloat(String(player.money)) + input.amount);
      const nextFactionBankMoney = roundCurrency(Number.parseFloat(String(faction.bankMoney)) - input.amount);

      await tx
        .update(players)
        .set({
          money: nextPlayerMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(factions)
        .set({
          bankMoney: nextFactionBankMoney.toFixed(2),
        })
        .where(eq(factions.id, factionId));

      await insertFactionBankLedgerEntry(tx as unknown as DatabaseClient, {
        balanceAfter: nextFactionBankMoney,
        commissionAmount: 0,
        createdAt: input.now,
        description: input.description,
        entryType: 'withdrawal',
        factionId,
        grossAmount: input.amount,
        netAmount: input.amount,
        originType: 'manual',
        playerId,
      });

      return true;
    });
  }

  private async findFactionLeader(
    executor: DatabaseClient,
    factionId: string,
  ): Promise<string | null> {
    const [faction] = await executor
      .select({
        leaderId: factions.leaderId,
      })
      .from(factions)
      .where(eq(factions.id, factionId))
      .limit(1);

    return faction?.leaderId ?? null;
  }

  private async findFactionSummary(
    executor: DatabaseClient,
    playerId: string,
    factionId: string,
  ): Promise<FactionSummary | null> {
    const [factionRow] = await executor
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        createdAt: factions.createdAt,
        description: factions.description,
        id: factions.id,
        isActive: factions.isActive,
        internalSatisfaction: factions.internalSatisfaction,
        isFixed: factions.isFixed,
        leaderId: factions.leaderId,
        name: factions.name,
        points: factions.points,
        robberyPolicyJson: factions.robberyPolicyJson,
        sortOrder: factions.sortOrder,
      })
      .from(factions)
      .where(eq(factions.id, factionId))
      .limit(1);

    if (!factionRow) {
      return null;
    }

    const memberRows = await executor
      .select({
        factionId: factionMembers.factionId,
        joinedAt: factionMembers.joinedAt,
        playerId: factionMembers.playerId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(eq(factionMembers.factionId, factionId));

    return (
      buildFactionSummaries(playerId, [factionRow], memberRows).find((entry) => entry.id === factionId) ??
      null
    );
  }
}

export class FactionService implements FactionServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly random: () => number;

  private readonly repository: FactionRepository;

  constructor(options: FactionServiceOptions = {}) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseFactionRepository();
  }

  async close(): Promise<void> {
    await this.keyValueStore.close?.();
  }

  async createFaction(playerId: string, input: FactionCreateInput): Promise<FactionMutationResponse> {
    const player = await this.getReadyPlayer(playerId);

    if (player.factionId) {
      throw new FactionError('conflict', 'Jogador ja pertence a uma faccao.');
    }

    const normalized = normalizeCreateInput(input);
    await this.ensureUniqueFaction(
      normalizeFactionName(normalized.name),
      normalizeFactionAbbreviation(normalized.abbreviation),
    );
    const createdFaction = await this.repository.createFaction(playerId, normalized, this.now());

    if (!createdFaction) {
      throw new FactionError('unauthorized', 'Jogador nao encontrado.');
    }

    await this.invalidatePlayerProfiles([playerId]);

    return {
      faction: createdFaction,
      playerFactionId: createdFaction.id,
    };
  }

  async demoteMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse> {
    await this.getReadyPlayer(actorPlayerId);
    const snapshot = await this.getFactionSnapshot(actorPlayerId, factionId);
    const target = this.getTargetMember(snapshot.members, memberPlayerId);
    const nextRank = getDemotedRank(target.rank);

    if (!nextRank) {
      throw new FactionError('conflict', 'Este membro ja esta no cargo mais baixo.');
    }

    if (!canDemote(snapshot.actor.rank, target.rank, nextRank)) {
      throw new FactionError('forbidden', 'Seu cargo nao permite rebaixar este membro.');
    }

    const updated = await this.repository.updateMemberRank(factionId, memberPlayerId, nextRank);

    if (!updated) {
      throw new FactionError('not_found', 'Membro da faccao nao encontrado.');
    }

    await this.invalidatePlayerProfiles([memberPlayerId]);

    return this.getFactionMembers(actorPlayerId, factionId);
  }

  async dissolveFaction(playerId: string, factionId: string): Promise<FactionDissolveResponse> {
    await this.getReadyPlayer(playerId);

    const faction = await this.getConfigurableFaction(playerId, factionId);
    const affectedPlayerIds = await this.repository.dissolveFaction(faction.id);

    await this.invalidatePlayerProfiles(affectedPlayerIds);

    return {
      dissolvedFactionId: faction.id,
      playerFactionId: null,
    };
  }

  async expelMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse> {
    await this.getReadyPlayer(actorPlayerId);
    const snapshot = await this.getFactionSnapshot(actorPlayerId, factionId);
    const target = this.getTargetMember(snapshot.members, memberPlayerId);

    if (target.id === actorPlayerId) {
      throw new FactionError('validation', 'Use a acao de sair da faccao para remover a si mesmo.');
    }

    if (!canExpel(snapshot.actor.rank, target.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao permite expulsar este membro.');
    }

    const removed = await this.repository.removeMember(factionId, memberPlayerId);

    if (!removed) {
      throw new FactionError('not_found', 'Membro da faccao nao encontrado.');
    }

    await this.invalidatePlayerProfiles([memberPlayerId]);

    return this.getFactionMembers(actorPlayerId, factionId);
  }

  async depositToFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankDepositInput,
  ): Promise<FactionBankResponse> {
    const player = await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (!canDepositToFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode depositar no banco da faccao.');
    }

    const amount = validateFactionBankAmount(input.amount);

    if (player.money < amount) {
      throw new FactionError('insufficient_funds', 'Dinheiro em maos insuficiente para realizar o deposito.');
    }

    const deposited = await this.repository.depositToFactionBank(playerId, factionId, {
      amount,
      description: normalizeFactionBankDescription(input.description, `Deposito manual de ${player.nickname}.`),
      now: this.now(),
    });

    if (!deposited) {
      throw new FactionError('not_found', 'Faccao ou jogador nao encontrados para concluir o deposito.');
    }

    await this.invalidatePlayerProfiles([playerId]);

    return this.getFactionBank(playerId, factionId);
  }

  async getFactionMembers(playerId: string, factionId: string): Promise<FactionMembersResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    return {
      faction: snapshot.faction,
      members: snapshot.members,
      playerFactionId: snapshot.faction.id,
    };
  }

  async getFactionBank(playerId: string, factionId: string): Promise<FactionBankResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (!canViewFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode acessar o banco da faccao.');
    }

    return {
      faction: snapshot.faction,
      ledger: buildFactionBankLedgerEntries(await this.repository.listFactionBankLedger(factionId, 50)),
      permissions: {
        canDeposit: canDepositToFactionBank(snapshot.actor.rank),
        canView: true,
        canWithdraw: canWithdrawFromFactionBank(snapshot.actor.rank),
      },
      playerFactionId: snapshot.faction.id,
    };
  }

  async getFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipCenterResponse> {
    await this.getReadyPlayer(playerId);
    const now = this.now();
    let snapshot = await this.getFactionSnapshot(playerId, factionId);
    const election = await this.syncFactionLeadershipElection(snapshot, now);
    snapshot = await this.getFactionSnapshot(playerId, factionId);
    const challenge = await this.repository.getLatestFactionLeadershipChallenge(factionId);

    return this.buildFactionLeadershipCenter(snapshot, playerId, election, challenge, now);
  }

  async getFactionRobberyPolicy(
    playerId: string,
    factionId: string,
  ): Promise<FactionRobberyPolicyResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    return {
      faction: snapshot.faction,
      playerFactionId: snapshot.faction.id,
    };
  }

  async getFactionUpgradeEffectsForFaction(factionId: string | null): Promise<FactionUpgradeEffectsProfile> {
    if (!factionId) {
      return { ...FACTION_EMPTY_UPGRADE_EFFECTS };
    }

    const upgrades = await this.repository.listFactionUpgrades(factionId);
    return buildFactionUpgradeEffects(upgrades.map((upgrade) => upgrade.type));
  }

  async getFactionUpgrades(
    playerId: string,
    factionId: string,
  ): Promise<FactionUpgradeCenterResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (!canViewFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode acessar os upgrades da faccao.');
    }

    const upgrades = await this.repository.listFactionUpgrades(factionId);
    const unlockedTypes = upgrades.map((upgrade) => upgrade.type);

    return {
      availablePoints: snapshot.faction.points,
      effects: buildFactionUpgradeEffects(unlockedTypes),
      faction: snapshot.faction,
      playerFactionId: snapshot.faction.id,
      upgrades: buildFactionUpgradeSummaries(snapshot.actor.rank, snapshot.faction.points, upgrades),
    };
  }

  async joinFixedFaction(playerId: string, factionId: string): Promise<FactionMutationResponse> {
    const player = await this.getReadyPlayer(playerId);

    if (player.factionId) {
      throw new FactionError('conflict', 'Voce ja pertence a uma faccao.');
    }

    const faction = (await this.repository.findFactionById(playerId, factionId)) as
      | (FactionSummary & {
          robberyPolicy: FactionRobberyPolicy;
        })
      | null;

    if (!faction) {
      throw new FactionError('not_found', 'Faccao nao encontrada.');
    }

    if (!faction.isFixed) {
      throw new FactionError('forbidden', 'Entrada direta so esta liberada para faccoes fixas.');
    }

    const canSelfJoin = (faction as typeof faction & {
      availableJoinSlots?: number | null;
      canSelfJoin?: boolean;
    }).canSelfJoin === true;
    const availableJoinSlots = (faction as typeof faction & {
      availableJoinSlots?: number | null;
      canSelfJoin?: boolean;
    }).availableJoinSlots ?? 0;

    if (!canSelfJoin || availableJoinSlots < 1) {
      throw new FactionError('conflict', 'Essa faccao fixa ja preencheu as vagas abertas para novos membros.');
    }

    const added = await this.repository.addMember(factionId, playerId, 'cria', this.now());

    if (!added) {
      throw new FactionError('conflict', 'Nao foi possivel entrar na faccao fixa.');
    }

    await this.invalidatePlayerProfiles([playerId]);

    const joinedFaction = await this.repository.findFactionById(playerId, factionId);

    if (!joinedFaction) {
      throw new FactionError('not_found', 'Faccao nao encontrada apos a entrada.');
    }

    return {
      faction: joinedFaction,
      playerFactionId: joinedFaction.id,
    };
  }

  async leaveFaction(playerId: string, factionId: string): Promise<FactionLeaveResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (snapshot.actor.rank === 'patrao') {
      throw new FactionError(
        'forbidden',
        'O Patrao nao pode sair da faccao nesta fase. Dissolva a faccao ou aguarde transferencia de lideranca.',
      );
    }

    const removed = await this.repository.removeMember(factionId, playerId);

    if (!removed) {
      throw new FactionError('not_found', 'Membro da faccao nao encontrado.');
    }

    await this.invalidatePlayerProfiles([playerId]);

    return {
      factionId,
      playerFactionId: null,
    };
  }

  async listFactions(playerId: string): Promise<FactionListResponse> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new FactionError('unauthorized', 'Jogador nao encontrado.');
    }

    return {
      factions: await this.repository.listFactions(playerId),
      playerFactionId: player.factionId,
    };
  }

  async promoteMember(
    actorPlayerId: string,
    factionId: string,
    memberPlayerId: string,
  ): Promise<FactionMembersResponse> {
    await this.getReadyPlayer(actorPlayerId);
    const snapshot = await this.getFactionSnapshot(actorPlayerId, factionId);
    const target = this.getTargetMember(snapshot.members, memberPlayerId);
    const nextRank = getPromotedRank(target.rank);

    if (!nextRank) {
      throw new FactionError('conflict', 'Este membro ja esta no cargo mais alto permitido.');
    }

    if (!canPromote(snapshot.actor.rank, target.rank, nextRank)) {
      throw new FactionError('forbidden', 'Seu cargo nao permite promover este membro.');
    }

    this.ensureRankLimit(nextRank, snapshot.members, memberPlayerId);

    const updated = await this.repository.updateMemberRank(factionId, memberPlayerId, nextRank);

    if (!updated) {
      throw new FactionError('not_found', 'Membro da faccao nao encontrado.');
    }

    await this.invalidatePlayerProfiles([memberPlayerId]);

    return this.getFactionMembers(actorPlayerId, factionId);
  }

  async recruitMember(
    actorPlayerId: string,
    factionId: string,
    input: FactionRecruitInput,
  ): Promise<FactionMembersResponse> {
    await this.getReadyPlayer(actorPlayerId);
    const snapshot = await this.getFactionSnapshot(actorPlayerId, factionId);

    if (!canRecruit(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao permite recrutar novos membros.');
    }

    const normalizedNickname = validateRecruitNickname(input.nickname);
    const targetPlayer = await this.repository.findRecruitTargetByNickname(normalizedNickname);

    if (!targetPlayer) {
      throw new FactionError('not_found', 'Jogador alvo nao encontrado.');
    }

    if (targetPlayer.id === actorPlayerId) {
      throw new FactionError('validation', 'Voce nao pode recrutar a si mesmo.');
    }

    if (!targetPlayer.characterCreatedAt) {
      throw new FactionError('character_not_ready', 'O jogador alvo ainda nao criou personagem.');
    }

    if (targetPlayer.factionId) {
      throw new FactionError('conflict', 'O jogador alvo ja pertence a uma faccao.');
    }

    const added = await this.repository.addMember(factionId, targetPlayer.id, 'cria', this.now());

    if (!added) {
      throw new FactionError('conflict', 'Nao foi possivel adicionar o jogador a faccao.');
    }

    await this.invalidatePlayerProfiles([actorPlayerId, targetPlayer.id]);

    return this.getFactionMembers(actorPlayerId, factionId);
  }

  async supportFactionLeadershipElection(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipElectionSupportResponse> {
    await this.getReadyPlayer(playerId);
    const now = this.now();
    let snapshot = await this.getFactionSnapshot(playerId, factionId);
    const candidates = this.getEligibleFactionLeadershipCandidates(snapshot.members);

    if (candidates.length === 0) {
      throw new FactionError(
        'conflict',
        `Nenhum membro elegivel para disputar a lideranca. O nivel minimo atual e ${FACTION_LEADERSHIP_MIN_CANDIDATE_LEVEL}.`,
      );
    }

    let election = await this.syncFactionLeadershipElection(snapshot, now);

    if (election?.status === 'active') {
      throw new FactionError('conflict', 'Ja existe uma eleicao de lideranca em andamento.');
    }

    if (election?.status === 'resolved' && this.isFactionLeadershipCooldownActive(election.cooldownEndsAt, now)) {
      throw new FactionError(
        'conflict',
        'A faccao ainda esta em cooldown de lideranca. Aguarde antes de iniciar uma nova eleicao.',
      );
    }

    if (!election || election.status === 'resolved') {
      election = await this.repository.createFactionLeadershipElection(
        factionId,
        playerId,
        this.computeFactionLeadershipSupportThreshold(snapshot.members),
        now,
      );
    }

    const supported = await this.repository.addFactionLeadershipSupport(election.id, playerId, now);

    if (!supported) {
      throw new FactionError('conflict', 'Voce ja apoiou esta eleicao de lideranca.');
    }

    let triggeredElection = false;
    const supports = await this.repository.listFactionLeadershipSupports(election.id);

    if (election.status === 'petitioning' && supports.length >= election.supportThreshold) {
      const endsAt = addHours(now, FACTION_LEADERSHIP_ELECTION_DURATION_HOURS);
      await this.repository.activateFactionLeadershipElection(election.id, now, endsAt);
      election = {
        ...election,
        endsAt,
        startedAt: now,
        status: 'active',
      };
      triggeredElection = true;
    }

    snapshot = await this.getFactionSnapshot(playerId, factionId);
    const challenge = await this.repository.getLatestFactionLeadershipChallenge(factionId);
    const center = await this.buildFactionLeadershipCenter(snapshot, playerId, election, challenge, now);

    return {
      ...center,
      triggeredElection,
    };
  }

  async challengeFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipChallengeResponse> {
    await this.getReadyPlayer(playerId);
    const now = this.now();
    let snapshot = await this.getFactionSnapshot(playerId, factionId);
    const election = await this.syncFactionLeadershipElection(snapshot, now);
    snapshot = await this.getFactionSnapshot(playerId, factionId);
    const challenger = await this.getFactionLeadershipReadyPlayer(playerId);
    const latestChallenge = await this.repository.getLatestFactionLeadershipChallenge(factionId);
    const challengeState = this.getFactionLeadershipChallengeState(
      snapshot,
      challenger,
      election,
      latestChallenge,
      now,
    );

    if (!challengeState.canChallenge || challengeState.lockReason) {
      throw new FactionError('conflict', challengeState.lockReason ?? 'Desafio de lideranca indisponivel.');
    }

    const leader = await this.resolveFactionLeaderSummary(snapshot);
    const defender = leader.id ? await this.repository.getLeadershipPlayer(leader.id) : null;
    const challengerPower = calculateFactionLeadershipPower(challenger);
    const defenderPower = defender
      ? calculateFactionLeadershipPower(defender)
      : calculateNpcFactionLeadershipPower(snapshot.faction, snapshot.members);
    const successChance = clampLeadershipSuccessChance(
      challengerPower / Math.max(1, challengerPower + defenderPower),
    );
    const challengerWon = this.random() < successChance;
    const cooldownEndsAt = addHours(now, FACTION_LEADERSHIP_CHALLENGE_COOLDOWN_HOURS);
    const challengeRecord = await this.repository.recordFactionLeadershipChallenge({
      challengerConceitoDelta: challengerWon
        ? FACTION_LEADERSHIP_CHALLENGE_CONCEITO_REWARD
        : -FACTION_LEADERSHIP_CHALLENGE_CONCEITO_LOSS,
      challengerHpDelta: challengerWon
        ? -FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_SUCCESS
        : -FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_FAIL,
      challengerPlayerId: challenger.id,
      challengerPower,
      challengerWon,
      cooldownEndsAt,
      createdAt: now,
      defenderConceitoDelta: challengerWon ? -FACTION_LEADERSHIP_CHALLENGE_CONCEITO_LOSS : 0,
      defenderHpDelta: challengerWon
        ? -FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_SUCCESS
        : -FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_FAIL,
      defenderPlayerId: defender?.id ?? null,
      defenderPower,
      defenderWasNpc: leader.isNpc,
      factionId,
      resolvedAt: now,
      staminaCost: FACTION_LEADERSHIP_CHALLENGE_STAMINA_COST,
      successChancePercent: Math.round(successChance * 100),
    });

    const affectedPlayerIds = new Set<string>([challenger.id]);

    if (defender?.id) {
      affectedPlayerIds.add(defender.id);
    }

    if (challengerWon && challenger.id !== snapshot.faction.leaderId) {
      const transferredPlayerIds = await this.repository.transferFactionLeadership(
        factionId,
        challenger.id,
        snapshot.faction.leaderId,
      );

      for (const memberId of transferredPlayerIds) {
        affectedPlayerIds.add(memberId);
      }

      for (const memberId of await this.repository.listFactionMemberIds(factionId)) {
        affectedPlayerIds.add(memberId);
      }
    }

    await this.invalidatePlayerProfiles([...affectedPlayerIds]);

    snapshot = await this.getFactionSnapshot(playerId, factionId);
    const center = await this.buildFactionLeadershipCenter(
      snapshot,
      playerId,
      election,
      challengeRecord,
      now,
    );

    return {
      ...center,
      result: await this.buildFactionLeadershipChallengeResult(snapshot, challengeRecord),
    };
  }

  async updateFaction(
    playerId: string,
    factionId: string,
    input: FactionUpdateInput,
  ): Promise<FactionMutationResponse> {
    const player = await this.getReadyPlayer(playerId);
    const faction = await this.getConfigurableFaction(playerId, factionId);
    const normalized = normalizeUpdateInput(input);

    await this.ensureUniqueFaction(
      normalized.name !== undefined ? normalizeFactionName(normalized.name) : normalizeFactionName(faction.name),
      normalized.abbreviation !== undefined
        ? normalizeFactionAbbreviation(normalized.abbreviation)
        : normalizeFactionAbbreviation(faction.abbreviation),
      faction.id,
    );

    const updatedFaction = await this.repository.updateFaction(faction.id, normalized);

    if (!updatedFaction) {
      throw new FactionError('not_found', 'Faccao nao encontrada.');
    }

    const affectedPlayerIds = await this.repository.listFactionMemberIds(faction.id);
    await this.invalidatePlayerProfiles(affectedPlayerIds);

    return {
      faction: updatedFaction,
      playerFactionId: player.factionId,
    };
  }

  async updateFactionRobberyPolicy(
    playerId: string,
    factionId: string,
    input: FactionRobberyPolicyUpdateInput,
  ): Promise<FactionRobberyPolicyResponse> {
    await this.getReadyPlayer(playerId);
    const faction = await this.getRobberyPolicyManageableFaction(playerId, factionId);
    const nextPolicy = mergeFactionRobberyPolicy(faction.robberyPolicy, input);
    const nextInternalSatisfaction = applyFactionInternalSatisfactionDelta(
      faction.internalSatisfaction,
      resolveFactionRobberyPolicySatisfactionDelta(faction.robberyPolicy, nextPolicy),
    );
    const updatedFaction = await this.repository.updateFactionRobberyPolicy(
      playerId,
      factionId,
      nextPolicy,
      nextInternalSatisfaction,
    );

    if (!updatedFaction) {
      throw new FactionError('not_found', 'Faccao nao encontrada.');
    }

    const affectedPlayerIds = await this.repository.listFactionMemberIds(factionId);
    await this.invalidatePlayerProfiles(affectedPlayerIds);

    return {
      faction: updatedFaction,
      playerFactionId: updatedFaction.id,
    };
  }

  async unlockFactionUpgrade(
    playerId: string,
    factionId: string,
    upgradeType: FactionUpgradeType,
  ): Promise<FactionUpgradeUnlockResponse> {
    await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (snapshot.actor.rank !== 'patrao' || snapshot.faction.leaderId !== playerId) {
      throw new FactionError('forbidden', 'Somente o Patrao pode desbloquear upgrades da faccao.');
    }

    const definition = getFactionUpgradeDefinition(upgradeType);

    if (!definition) {
      throw new FactionError('validation', 'Upgrade de faccao invalido.');
    }

    const upgrades = await this.repository.listFactionUpgrades(factionId);
    const unlockedTypes = upgrades.map((upgrade) => upgrade.type);

    if (unlockedTypes.includes(upgradeType)) {
      throw new FactionError('conflict', 'Este upgrade ja foi desbloqueado pela faccao.');
    }

    const missingPrerequisite = definition.prerequisiteUpgradeTypes.find(
      (requiredUpgradeType) => !unlockedTypes.includes(requiredUpgradeType),
    );

    if (missingPrerequisite) {
      throw new FactionError(
        'conflict',
        `Pre-requisito ausente para desbloqueio: ${getFactionUpgradeDefinition(missingPrerequisite)?.label ?? missingPrerequisite}.`,
      );
    }

    if (snapshot.faction.points < definition.pointsCost) {
      throw new FactionError('insufficient_funds', 'Pontos insuficientes para desbloquear este upgrade.');
    }

    const unlocked = await this.repository.unlockFactionUpgrade(
      factionId,
      upgradeType,
      definition.pointsCost,
      this.now(),
    );

    if (!unlocked) {
      throw new FactionError('conflict', 'Nao foi possivel desbloquear este upgrade neste momento.');
    }

    const affectedPlayerIds = await this.repository.listFactionMemberIds(factionId);
    await this.invalidatePlayerProfiles(affectedPlayerIds);

    const center = await this.getFactionUpgrades(playerId, factionId);

    return {
      ...center,
      unlockedUpgradeType: upgradeType,
    };
  }

  async withdrawFromFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankWithdrawInput,
  ): Promise<FactionBankResponse> {
    const player = await this.getReadyPlayer(playerId);
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (!canWithdrawFromFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode sacar do banco da faccao.');
    }

    const amount = validateFactionBankAmount(input.amount);

    if (snapshot.faction.bankMoney < amount) {
      throw new FactionError('insufficient_funds', 'Saldo insuficiente no banco da faccao.');
    }

    const withdrawn = await this.repository.withdrawFromFactionBank(playerId, factionId, {
      amount,
      description: normalizeFactionBankDescription(input.description, `Saque autorizado por ${player.nickname}.`),
      now: this.now(),
    });

    if (!withdrawn) {
      throw new FactionError('not_found', 'Faccao ou jogador nao encontrados para concluir o saque.');
    }

    await this.invalidatePlayerProfiles([playerId]);

    return this.getFactionBank(playerId, factionId);
  }

  async voteFactionLeadership(
    playerId: string,
    factionId: string,
    input: FactionLeadershipVoteInput,
  ): Promise<FactionLeadershipVoteResponse> {
    await this.getReadyPlayer(playerId);
    const now = this.now();
    let snapshot = await this.getFactionSnapshot(playerId, factionId);
    let election = await this.syncFactionLeadershipElection(snapshot, now);

    if (!election || election.status !== 'active') {
      throw new FactionError('conflict', 'Nao existe eleicao de lideranca ativa para votar.');
    }

    const candidates = this.getEligibleFactionLeadershipCandidates(snapshot.members);
    const candidate = candidates.find((entry) => entry.id === input.candidatePlayerId);

    if (!candidate) {
      throw new FactionError('validation', 'Candidato de lideranca invalido.');
    }

    const recorded = await this.repository.recordFactionLeadershipVote(
      election.id,
      playerId,
      candidate.id,
      now,
    );

    if (!recorded) {
      throw new FactionError('conflict', 'Voce ja votou nesta eleicao.');
    }

    const votes = await this.repository.listFactionLeadershipVotes(election.id);
    let electionResolved = false;

    if (
      this.shouldResolveFactionLeadershipElection(
        election,
        votes.length,
        this.getHumanFactionMembers(snapshot.members).length,
        now,
      )
    ) {
      election = await this.resolveFactionLeadershipElection(snapshot, election, votes, now);
      electionResolved = true;
      snapshot = await this.getFactionSnapshot(playerId, factionId);
    }

    const challenge = await this.repository.getLatestFactionLeadershipChallenge(factionId);
    const center = await this.buildFactionLeadershipCenter(snapshot, playerId, election, challenge, now);

    return {
      ...center,
      electionResolved,
    };
  }

  private async buildFactionLeadershipCenter(
    snapshot: FactionMembershipSnapshot,
    playerId: string,
    election: FactionLeadershipElectionRecord | null,
    challenge: FactionLeadershipChallengeRecord | null,
    now: Date,
  ): Promise<FactionLeadershipCenterResponse> {
    const supports = election ? await this.repository.listFactionLeadershipSupports(election.id) : [];
    const votes = election ? await this.repository.listFactionLeadershipVotes(election.id) : [];

    return {
      challenge: await this.buildFactionLeadershipChallengeSummary(
        snapshot,
        playerId,
        election,
        challenge,
        now,
      ),
      election: this.buildFactionLeadershipElectionSummary(snapshot, playerId, election, supports, votes),
      faction: snapshot.faction,
      leader: await this.resolveFactionLeaderSummary(snapshot),
      playerFactionId: snapshot.faction.id,
    };
  }

  private async buildFactionLeadershipChallengeResult(
    snapshot: FactionMembershipSnapshot,
    challenge: FactionLeadershipChallengeRecord,
  ): Promise<FactionLeadershipChallengeResult> {
    const membersById = new Map(snapshot.members.map((member) => [member.id, member]));
    const challengerMember = membersById.get(challenge.challengerPlayerId);
    const challengerPlayer =
      challengerMember?.isNpc === false
        ? null
        : await this.repository.getLeadershipPlayer(challenge.challengerPlayerId);
    const defenderMember = challenge.defenderPlayerId
      ? membersById.get(challenge.defenderPlayerId)
      : null;
    const defenderPlayer =
      challenge.defenderPlayerId && !defenderMember
        ? await this.repository.getLeadershipPlayer(challenge.defenderPlayerId)
        : null;

    return {
      challengerConceitoDelta: challenge.challengerConceitoDelta,
      challengerHpDelta: challenge.challengerHpDelta,
      challengerNickname: challengerMember?.nickname ?? challengerPlayer?.nickname ?? 'Desafiante',
      challengerPlayerId: challenge.challengerPlayerId,
      challengerPower: challenge.challengerPower,
      challengerWon: challenge.challengerWon,
      defenderConceitoDelta: challenge.defenderConceitoDelta,
      defenderHpDelta: challenge.defenderHpDelta,
      defenderNickname:
        (challenge.defenderWasNpc ? `Lideranca NPC do ${snapshot.faction.abbreviation}` : null) ??
        defenderMember?.nickname ??
        defenderPlayer?.nickname ??
        'Lideranca atual',
      defenderPlayerId: challenge.defenderPlayerId,
      defenderPower: challenge.defenderPower,
      defenderWasNpc: challenge.defenderWasNpc,
      resolvedAt: challenge.resolvedAt.toISOString(),
      successChance: challenge.successChancePercent / 100,
    };
  }

  private async buildFactionLeadershipChallengeSummary(
    snapshot: FactionMembershipSnapshot,
    playerId: string,
    election: FactionLeadershipElectionRecord | null,
    challenge: FactionLeadershipChallengeRecord | null,
    now: Date,
  ): Promise<FactionLeadershipCenterResponse['challenge']> {
    const challenger = await this.getFactionLeadershipReadyPlayer(playerId);
    const challengeState = this.getFactionLeadershipChallengeState(
      snapshot,
      challenger,
      election,
      challenge,
      now,
    );

    return {
      canChallenge: challengeState.canChallenge,
      cooldownEndsAt: challengeState.cooldownEndsAt?.toISOString() ?? null,
      cooldownRemainingSeconds: challengeState.cooldownRemainingSeconds,
      lastResult: challenge ? await this.buildFactionLeadershipChallengeResult(snapshot, challenge) : null,
      lockReason: challengeState.lockReason,
      minimumLevel: FACTION_LEADERSHIP_CHALLENGE_MIN_LEVEL,
    };
  }

  private buildFactionLeadershipElectionSummary(
    snapshot: FactionMembershipSnapshot,
    playerId: string,
    election: FactionLeadershipElectionRecord | null,
    supports: FactionLeadershipSupportRecord[],
    votes: FactionLeadershipVoteRecord[],
  ): FactionLeadershipElectionSummary | null {
    if (!election) {
      return null;
    }

    const voteCounts = new Map<string, number>();

    for (const vote of votes) {
      voteCounts.set(vote.candidatePlayerId, (voteCounts.get(vote.candidatePlayerId) ?? 0) + 1);
    }

    const membersById = new Map(snapshot.members.map((member) => [member.id, member]));
    const winnerMember = election.winnerPlayerId ? membersById.get(election.winnerPlayerId) : null;

    return {
      candidates: this.getEligibleFactionLeadershipCandidates(snapshot.members).map((candidate) => ({
        level: candidate.level ?? 0,
        nickname: candidate.nickname,
        playerId: candidate.id,
        rank: candidate.rank,
        votes: voteCounts.get(candidate.id) ?? 0,
      })),
      cooldownEndsAt: election.cooldownEndsAt?.toISOString() ?? null,
      createdAt: election.createdAt.toISOString(),
      endsAt: election.endsAt?.toISOString() ?? null,
      hasPlayerSupported: supports.some((support) => support.playerId === playerId),
      hasPlayerVoted: votes.some((vote) => vote.voterPlayerId === playerId),
      id: election.id,
      resolvedAt: election.resolvedAt?.toISOString() ?? null,
      startedAt: election.startedAt?.toISOString() ?? null,
      status: election.status,
      supportCount: supports.length,
      supportThreshold: election.supportThreshold,
      totalVotes: votes.length,
      winnerNickname: winnerMember?.nickname ?? null,
      winnerPlayerId: election.winnerPlayerId,
    };
  }

  private computeFactionLeadershipSupportThreshold(members: FactionMemberSummary[]): number {
    return Math.max(1, Math.ceil(this.getHumanFactionMembers(members).length * 0.3));
  }

  private async getFactionLeadershipReadyPlayer(
    playerId: string,
  ): Promise<FactionLeadershipPlayerRecord> {
    const player = await this.repository.getLeadershipPlayer(playerId);

    if (!player) {
      throw new FactionError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new FactionError('character_not_ready', 'Crie seu personagem antes de mexer com faccoes.');
    }

    return player;
  }

  private getFactionLeadershipChallengeState(
    snapshot: FactionMembershipSnapshot,
    challenger: FactionLeadershipPlayerRecord,
    election: FactionLeadershipElectionRecord | null,
    challenge: FactionLeadershipChallengeRecord | null,
    now: Date,
  ): {
    canChallenge: boolean;
    cooldownEndsAt: Date | null;
    cooldownRemainingSeconds: number;
    lockReason: string | null;
  } {
    const cooldownEndsAt = challenge?.cooldownEndsAt ?? null;
    const cooldownRemainingSeconds = cooldownEndsAt
      ? Math.max(0, Math.ceil((cooldownEndsAt.getTime() - now.getTime()) / 1000))
      : 0;

    if (snapshot.faction.leaderId === challenger.id) {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: 'O lider atual nao pode desafiar a propria lideranca.',
      };
    }

    if (challenger.level < FACTION_LEADERSHIP_CHALLENGE_MIN_LEVEL) {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: `Somente membros de nivel ${FACTION_LEADERSHIP_CHALLENGE_MIN_LEVEL}+ podem desafiar a lideranca.`,
      };
    }

    if (challenger.stamina < FACTION_LEADERSHIP_CHALLENGE_STAMINA_COST) {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: `Stamina insuficiente para o desafio. Sao necessarios ${FACTION_LEADERSHIP_CHALLENGE_STAMINA_COST} pontos.`,
      };
    }

    if (election && election.status !== 'resolved') {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: 'Nao e possivel desafiar a lideranca enquanto a eleicao estiver em andamento.',
      };
    }

    if (this.isFactionLeadershipCooldownActive(cooldownEndsAt, now)) {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: 'A faccao ainda esta em cooldown de desafio de lideranca.',
      };
    }

    return {
      canChallenge: true,
      cooldownEndsAt,
      cooldownRemainingSeconds,
      lockReason: null,
    };
  }

  private getEligibleFactionLeadershipCandidates(
    members: FactionMemberSummary[],
  ): FactionMemberSummary[] {
    return members.filter(
      (member) => !member.isNpc && member.level !== null && member.level >= FACTION_LEADERSHIP_MIN_CANDIDATE_LEVEL,
    );
  }

  private getHumanFactionMembers(members: FactionMemberSummary[]): FactionMemberSummary[] {
    return members.filter((member) => !member.isNpc);
  }

  private isFactionLeadershipCooldownActive(cooldownEndsAt: Date | null, now: Date): boolean {
    return cooldownEndsAt !== null && cooldownEndsAt.getTime() > now.getTime();
  }

  private async resolveFactionLeadershipElection(
    snapshot: FactionMembershipSnapshot,
    election: FactionLeadershipElectionRecord,
    votes: FactionLeadershipVoteRecord[],
    now: Date,
  ): Promise<FactionLeadershipElectionRecord> {
    const voteCounts = new Map<string, number>();

    for (const vote of votes) {
      voteCounts.set(vote.candidatePlayerId, (voteCounts.get(vote.candidatePlayerId) ?? 0) + 1);
    }

    const standings = [...voteCounts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'pt-BR');
    });
    const topVotes = standings[0]?.[1] ?? 0;
    const winners = standings.filter((entry) => entry[1] === topVotes);
    const winnerPlayerId =
      topVotes > 0 && winners.length === 1 && this.getEligibleFactionLeadershipCandidates(snapshot.members).some(
        (candidate) => candidate.id === winners[0]?.[0],
      )
        ? (winners[0]?.[0] ?? null)
        : null;
    const cooldownEndsAt = addHours(now, FACTION_LEADERSHIP_ELECTION_COOLDOWN_HOURS);

    await this.repository.resolveFactionLeadershipElection(
      election.id,
      winnerPlayerId,
      now,
      cooldownEndsAt,
    );

    if (winnerPlayerId && winnerPlayerId !== snapshot.faction.leaderId) {
      const affectedPlayerIds = await this.repository.transferFactionLeadership(
        snapshot.faction.id,
        winnerPlayerId,
        snapshot.faction.leaderId,
      );

      for (const memberId of await this.repository.listFactionMemberIds(snapshot.faction.id)) {
        affectedPlayerIds.push(memberId);
      }

      await this.invalidatePlayerProfiles(affectedPlayerIds);
    }

    return {
      ...election,
      cooldownEndsAt,
      resolvedAt: now,
      status: 'resolved',
      winnerPlayerId,
    };
  }

  private async resolveFactionLeaderSummary(
    snapshot: FactionMembershipSnapshot,
  ): Promise<FactionLeaderSummary> {
    const npcLeader = buildFactionNpcLeaderSummary(snapshot.faction);

    if (npcLeader) {
      return {
        id: null,
        isNpc: true,
        level: null,
        nickname: npcLeader.nickname,
        rank: npcLeader.rank,
        vocation: null,
      };
    }

    const leaderMember =
      snapshot.members.find((member) => member.id === snapshot.faction.leaderId) ??
      snapshot.members.find((member) => member.isLeader && !member.isNpc);

    if (!leaderMember) {
      throw new FactionError('not_found', 'Lider da faccao nao encontrado.');
    }

    return {
      id: leaderMember.id,
      isNpc: false,
      level: leaderMember.level,
      nickname: leaderMember.nickname,
      rank: leaderMember.rank,
      vocation: leaderMember.vocation,
    };
  }

  private shouldResolveFactionLeadershipElection(
    election: FactionLeadershipElectionRecord,
    totalVotes: number,
    totalHumanMembers: number,
    now: Date,
  ): boolean {
    if (election.status !== 'active') {
      return false;
    }

    if (election.endsAt && election.endsAt.getTime() <= now.getTime()) {
      return true;
    }

    return totalHumanMembers > 0 && totalVotes >= totalHumanMembers;
  }

  private async syncFactionLeadershipElection(
    snapshot: FactionMembershipSnapshot,
    now: Date,
  ): Promise<FactionLeadershipElectionRecord | null> {
    let election = await this.repository.getLatestFactionLeadershipElection(snapshot.faction.id);

    if (!election) {
      return null;
    }

    if (election.status === 'petitioning') {
      const supports = await this.repository.listFactionLeadershipSupports(election.id);

      if (supports.length >= election.supportThreshold) {
        const endsAt = addHours(now, FACTION_LEADERSHIP_ELECTION_DURATION_HOURS);
        await this.repository.activateFactionLeadershipElection(election.id, now, endsAt);
        election = {
          ...election,
          endsAt,
          startedAt: now,
          status: 'active',
        };
      }
    }

    if (election.status !== 'active') {
      return election;
    }

    const votes = await this.repository.listFactionLeadershipVotes(election.id);

    if (
      this.shouldResolveFactionLeadershipElection(
        election,
        votes.length,
        this.getHumanFactionMembers(snapshot.members).length,
        now,
      )
    ) {
      return this.resolveFactionLeadershipElection(snapshot, election, votes, now);
    }

    return election;
  }

  private ensureRankLimit(
    targetRank: FactionRank,
    members: FactionMemberSummary[],
    targetMemberId: string,
  ): void {
    const limit = FACTION_RANK_LIMITS[targetRank];

    if (!limit) {
      return;
    }

    const currentCount = members.filter(
      (member) => member.rank === targetRank && member.id !== targetMemberId,
    ).length;

    if (currentCount >= limit) {
      throw new FactionError('conflict', `A faccao ja atingiu o limite de ${limit} ${formatRankLabel(targetRank)}.`);
    }
  }

  private async ensureUniqueFaction(
    normalizedName: string,
    normalizedAbbreviation: string,
    excludeFactionId?: string,
  ): Promise<void> {
    const conflict = await this.repository.findFactionConflict(
      normalizedName,
      normalizedAbbreviation,
      excludeFactionId,
    );

    if (!conflict) {
      return;
    }

    if (conflict.name && conflict.abbreviation) {
      throw new FactionError('conflict', 'Nome e sigla da faccao ja estao em uso.');
    }

    if (conflict.name) {
      throw new FactionError('conflict', 'Nome da faccao ja esta em uso.');
    }

    throw new FactionError('conflict', 'Sigla da faccao ja esta em uso.');
  }

  private async getConfigurableFaction(playerId: string, factionId: string): Promise<FactionSummary> {
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (snapshot.actor.rank !== 'patrao' || snapshot.faction.leaderId !== playerId) {
      throw new FactionError('forbidden', 'Somente o lider pode gerenciar esta faccao.');
    }

    if (snapshot.faction.isFixed) {
      throw new FactionError('forbidden', 'Faccoes fixas nao podem ser alteradas nesta fase.');
    }

    return snapshot.faction;
  }

  private async getRobberyPolicyManageableFaction(
    playerId: string,
    factionId: string,
  ): Promise<FactionSummary> {
    const snapshot = await this.getFactionSnapshot(playerId, factionId);

    if (snapshot.actor.rank !== 'patrao' || snapshot.faction.leaderId !== playerId) {
      throw new FactionError('forbidden', 'Somente o lider pode definir a politica de roubos da faccao.');
    }

    return snapshot.faction;
  }

  private async getFactionSnapshot(
    playerId: string,
    factionId: string,
  ): Promise<FactionMembershipSnapshot> {
    const faction = (await this.repository.findFactionById(playerId, factionId)) as
      | (FactionSummary & {
          robberyPolicy: FactionRobberyPolicy;
        })
      | null;

    if (!faction) {
      throw new FactionError('not_found', 'Faccao nao encontrada.');
    }

    if (!faction.isPlayerMember) {
      throw new FactionError('forbidden', 'Voce nao faz parte desta faccao.');
    }

    const members = buildFactionMemberSummaries(
      await this.repository.listFactionMembers(factionId),
      faction,
    );
    const actor = members.find((member) => member.id === playerId);

    if (!actor) {
      throw new FactionError('forbidden', 'Voce nao faz parte desta faccao.');
    }

    return {
      actor,
      faction,
      members,
    };
  }

  private getTargetMember(
    members: FactionMemberSummary[],
    memberPlayerId: string,
  ): FactionMemberSummary {
    const target = members.find((member) => member.id === memberPlayerId);

    if (!target) {
      throw new FactionError('not_found', 'Membro da faccao nao encontrado.');
    }

    if (target.isNpc) {
      throw new FactionError('forbidden', 'A lideranca NPC nao pode ser alterada diretamente nesta fase.');
    }

    return target;
  }

  private async getReadyPlayer(playerId: string): Promise<FactionPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new FactionError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new FactionError('character_not_ready', 'Crie seu personagem antes de mexer com faccoes.');
    }

    return player;
  }

  private async invalidatePlayerProfiles(playerIds: string[]): Promise<void> {
    const uniquePlayerIds = [...new Set(playerIds)];

    await Promise.all(
      uniquePlayerIds.map(async (playerId) => {
        await this.keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));
      }),
    );
  }
}

function buildFactionMemberSummaries(
  memberRows: FactionMemberRecord[],
  faction: Pick<FactionSummary, 'abbreviation' | 'createdAt' | 'id' | 'isFixed' | 'leaderId' | 'name'>,
): FactionMemberSummary[] {
  const playerMembers = [...memberRows].sort(compareFactionMemberRecords).map((member) => ({
    id: member.playerId,
    isLeader: faction.leaderId === member.playerId,
    isNpc: false,
    joinedAt: member.joinedAt.toISOString(),
    level: member.level,
    nickname: member.nickname,
    rank: member.rank,
    vocation: member.vocation,
  }));

  const npcLeaderSummary = buildFactionNpcLeaderSummary(faction);

  if (!npcLeaderSummary) {
    return playerMembers;
  }

  return [npcLeaderSummary, ...playerMembers];
}

function buildFactionBankLedgerEntries(
  ledgerRows: FactionBankLedgerRecord[],
): FactionBankResponse['ledger'] {
  return ledgerRows.map((entry) => ({
    balanceAfter: entry.balanceAfter,
    commissionAmount: entry.commissionAmount,
    createdAt: entry.createdAt.toISOString(),
    description: entry.description,
    entryType: entry.entryType,
    grossAmount: entry.grossAmount,
    id: entry.id,
    netAmount: entry.netAmount,
    originType: entry.originType,
    playerId: entry.playerId,
    playerNickname: entry.playerNickname,
    propertyId: entry.propertyId,
  }));
}

function buildFactionUpgradeEffects(
  unlockedTypes: FactionUpgradeType[],
): FactionUpgradeEffectsProfile {
  const unlocked = new Set(unlockedTypes);
  const highestAttributeBonus =
    unlocked.has('bonus_atributos_10') ? 0.1 : unlocked.has('bonus_atributos_5') ? 0.05 : 0;

  let muleDeliveryTier: FactionUpgradeEffectsProfile['muleDeliveryTier'] = 0;

  if (unlocked.has('mula_max')) {
    muleDeliveryTier = 4;
  } else if (unlocked.has('mula_nivel_3')) {
    muleDeliveryTier = 3;
  } else if (unlocked.has('mula_nivel_2')) {
    muleDeliveryTier = 2;
  } else if (unlocked.has('mula_nivel_1')) {
    muleDeliveryTier = 1;
  }

  return {
    attributeBonusMultiplier: 1 + highestAttributeBonus,
    canAccessExclusiveArsenal: unlocked.has('arsenal_exclusivo'),
    hasFortifiedHeadquarters: unlocked.has('qg_fortificado'),
    muleDeliveryTier,
    soldierCapacityMultiplier: unlocked.has('exercito_expandido') ? 1.5 : 1,
  };
}

function buildFactionUpgradeSummaries(
  actorRank: FactionRank,
  availablePoints: number,
  upgrades: FactionUpgradeRecord[],
): FactionUpgradeSummary[] {
  const unlockedByType = new Map(upgrades.map((upgrade) => [upgrade.type, upgrade]));

  return FACTION_UPGRADE_DEFINITIONS.map((definition) => {
    const unlocked = unlockedByType.get(definition.type);
    const missingPrerequisite = definition.prerequisiteUpgradeTypes.find(
      (requiredUpgradeType) => !unlockedByType.has(requiredUpgradeType),
    );
    const canUnlock =
      actorRank === 'patrao' &&
      !unlocked &&
      missingPrerequisite === undefined &&
      availablePoints >= definition.pointsCost;

    let lockReason: string | null = null;

    if (unlocked) {
      lockReason = null;
    } else if (actorRank !== 'patrao') {
      lockReason = 'Somente o Patrao pode desbloquear upgrades.';
    } else if (missingPrerequisite) {
      lockReason = `Requer ${getFactionUpgradeDefinition(missingPrerequisite)?.label ?? missingPrerequisite}.`;
    } else if (availablePoints < definition.pointsCost) {
      lockReason = 'Pontos insuficientes.';
    }

    return {
      ...definition,
      canUnlock,
      isUnlocked: unlocked !== undefined,
      lockReason,
      unlockedAt: unlocked?.unlockedAt.toISOString() ?? null,
    };
  });
}

function buildFactionSummaries(
  playerId: string,
  factionRows: Array<
    Omit<FactionRecord, 'robberyPolicy'> & {
      robberyPolicyJson?: unknown;
    }
  >,
  memberRows: Array<Pick<FactionMemberRecord, 'factionId' | 'joinedAt' | 'playerId' | 'rank'>>,
): FactionSummary[] {
  const memberCountByFactionId = new Map<string, number>();
  const playerMembershipByFactionId = new Map<
    string,
    {
      joinedAt: Date;
      rank: FactionRank;
    }
  >();

  for (const member of memberRows) {
    memberCountByFactionId.set(member.factionId, (memberCountByFactionId.get(member.factionId) ?? 0) + 1);

    if (member.playerId === playerId) {
      playerMembershipByFactionId.set(member.factionId, {
        joinedAt: member.joinedAt,
        rank: member.rank,
      });
    }
  }

  return [...factionRows]
    .filter((faction) => faction.isActive)
    .sort((left, right) => {
      if (left.isFixed !== right.isFixed) {
        return left.isFixed ? -1 : 1;
      }

      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.name.localeCompare(right.name, 'pt-BR');
    })
    .map((faction) => {
      const membership = playerMembershipByFactionId.get(faction.id);
      const npcLeaderName = resolveFactionNpcLeaderName(faction);
      const canConfigure =
        membership?.rank === 'patrao' && faction.leaderId !== null && faction.leaderId === playerId && !faction.isFixed;
      const robberyPolicy = normalizeFactionRobberyPolicy(faction.robberyPolicyJson ?? null);
      const memberCount = memberCountByFactionId.get(faction.id) ?? 0;
      const availableJoinSlots = faction.isFixed
        ? Math.max(0, FIXED_FACTION_SELF_JOIN_SLOT_CAP - memberCount)
        : null;

      return {
        availableJoinSlots,
        abbreviation: faction.abbreviation,
        bankMoney: roundCurrency(Number.parseFloat(String(faction.bankMoney))),
        canConfigure,
        canDissolve: canConfigure,
        canSelfJoin:
          membership === undefined &&
          faction.isFixed &&
          availableJoinSlots !== null &&
          availableJoinSlots > 0,
        createdAt: faction.createdAt.toISOString(),
        description: faction.description,
        id: faction.id,
        internalSatisfaction: faction.internalSatisfaction,
        isFixed: faction.isFixed,
        isNpcControlled: npcLeaderName !== null,
        isPlayerMember: membership !== undefined,
        leaderId: faction.leaderId,
        memberCount,
        myRank: membership?.rank ?? null,
        name: faction.name,
        npcLeaderName,
        points: faction.points,
        robberyPolicy,
      } as FactionSummary;
    });
}

function buildFactionNpcLeaderId(factionId: string): string {
  return `npc:${factionId}`;
}

function buildFactionNpcLeaderSummary(
  faction: Pick<FactionSummary, 'abbreviation' | 'createdAt' | 'id' | 'isFixed' | 'leaderId' | 'name'>,
): FactionMemberSummary | null {
  const npcLeaderName = resolveFactionNpcLeaderName(faction);

  if (!npcLeaderName) {
    return null;
  }

  return {
    id: buildFactionNpcLeaderId(faction.id),
    isLeader: true,
    isNpc: true,
    joinedAt: faction.createdAt,
    level: null,
    nickname: npcLeaderName,
    rank: 'patrao',
    vocation: null,
  };
}

function resolveFactionNpcLeaderName(
  faction: Pick<FactionSummary, 'abbreviation' | 'isFixed' | 'leaderId' | 'name'>,
): string | null {
  if (!faction.isFixed || faction.leaderId !== null) {
    return null;
  }

  return `Lideranca NPC do ${faction.abbreviation}`;
}

function canDemote(actorRank: FactionRank, currentRank: FactionRank, nextRank: FactionRank): boolean {
  switch (actorRank) {
    case 'patrao':
      return currentRank !== 'patrao';
    case 'general':
      return (
        (currentRank === 'gerente' && nextRank === 'vapor') ||
        (currentRank === 'vapor' && nextRank === 'soldado') ||
        (currentRank === 'soldado' && nextRank === 'cria')
      );
    case 'gerente':
      return currentRank === 'soldado' && nextRank === 'cria';
    default:
      return false;
  }
}

function canExpel(actorRank: FactionRank, targetRank: FactionRank): boolean {
  switch (actorRank) {
    case 'patrao':
      return targetRank !== 'patrao';
    case 'general':
      return targetRank === 'gerente' || targetRank === 'vapor' || targetRank === 'soldado' || targetRank === 'cria';
    case 'gerente':
      return targetRank === 'soldado' || targetRank === 'cria';
    default:
      return false;
  }
}

function canPromote(actorRank: FactionRank, currentRank: FactionRank, nextRank: FactionRank): boolean {
  switch (actorRank) {
    case 'patrao':
      return nextRank !== 'patrao' && currentRank !== 'general' && currentRank !== 'patrao';
    case 'general':
      return (
        (currentRank === 'vapor' && nextRank === 'gerente') ||
        (currentRank === 'soldado' && nextRank === 'vapor') ||
        (currentRank === 'cria' && nextRank === 'soldado')
      );
    case 'gerente':
      return currentRank === 'cria' && nextRank === 'soldado';
    default:
      return false;
  }
}

function canRecruit(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general' || rank === 'gerente';
}

function canDepositToFactionBank(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general' || rank === 'gerente' || rank === 'vapor';
}

function canViewFactionBank(rank: FactionRank): boolean {
  return canDepositToFactionBank(rank);
}

function canWithdrawFromFactionBank(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general';
}

function getFactionUpgradeDefinition(
  upgradeType: FactionUpgradeType,
) {
  return FACTION_UPGRADE_DEFINITIONS.find((definition) => definition.type === upgradeType) ?? null;
}

function compareFactionMemberRecords(left: FactionMemberRecord, right: FactionMemberRecord): number {
  const rankDiff = getFactionRankScore(right.rank) - getFactionRankScore(left.rank);

  if (rankDiff !== 0) {
    return rankDiff;
  }

  const joinedAtDiff = left.joinedAt.getTime() - right.joinedAt.getTime();

  if (joinedAtDiff !== 0) {
    return joinedAtDiff;
  }

  return left.nickname.localeCompare(right.nickname, 'pt-BR');
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function calculateFactionLeadershipPower(player: Pick<
  FactionLeadershipPlayerRecord,
  'carisma' | 'conceito' | 'forca' | 'hp' | 'inteligencia' | 'level' | 'resistencia' | 'stamina'
>): number {
  return Math.round(
    player.level * 18 +
      player.forca * 4 +
      player.resistencia * 3 +
      player.inteligencia * 2 +
      player.carisma * 2 +
      player.conceito * 0.5 +
      player.hp * 0.2 +
      player.stamina * 0.2,
  );
}

function calculateNpcFactionLeadershipPower(
  faction: Pick<FactionSummary, 'memberCount' | 'points'>,
  members: FactionMemberSummary[],
): number {
  const averageLevel =
    members.filter((member) => !member.isNpc && member.level !== null).reduce((sum, member) => sum + (member.level ?? 0), 0) /
    Math.max(1, members.filter((member) => !member.isNpc && member.level !== null).length);

  return Math.round(180 + faction.points * 0.1 + faction.memberCount * 12 + averageLevel * 10);
}

function clampLeadershipSuccessChance(value: number): number {
  return Math.min(0.8, Math.max(0.2, value));
}

function formatRankLabel(rank: FactionRank): string {
  switch (rank) {
    case 'patrao':
      return 'patroes';
    case 'general':
      return 'generais';
    case 'gerente':
      return 'gerentes';
    case 'vapor':
      return 'vapores';
    case 'soldado':
      return 'soldados';
    case 'cria':
      return 'crias';
    default:
      return 'membros';
  }
}

function getDemotedRank(rank: FactionRank): FactionRank | null {
  switch (rank) {
    case 'general':
      return 'gerente';
    case 'gerente':
      return 'vapor';
    case 'vapor':
      return 'soldado';
    case 'soldado':
      return 'cria';
    default:
      return null;
  }
}

function getFactionRankScore(rank: FactionRank): number {
  return FACTION_RANK_ORDER.length - FACTION_RANK_ORDER.indexOf(rank);
}

function getPromotedRank(rank: FactionRank): FactionRank | null {
  switch (rank) {
    case 'cria':
      return 'soldado';
    case 'soldado':
      return 'vapor';
    case 'vapor':
      return 'gerente';
    case 'gerente':
      return 'general';
    default:
      return null;
  }
}

function normalizeCreateInput(input: FactionCreateInput): {
  abbreviation: string;
  description: string | null;
  name: string;
} {
  return {
    abbreviation: validateFactionAbbreviation(input.abbreviation),
    description: normalizeFactionDescription(input.description),
    name: validateFactionName(input.name),
  };
}

function normalizeFactionAbbreviation(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeFactionDescription(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > FACTION_DESCRIPTION_MAX_LENGTH) {
    throw new FactionError(
      'validation',
      `Descricao da faccao deve ter no maximo ${FACTION_DESCRIPTION_MAX_LENGTH} caracteres.`,
    );
  }

  return normalized;
}

function normalizeFactionName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function normalizeFactionBankDescription(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.length > 240) {
    throw new FactionError('validation', 'A descricao da movimentacao nao pode exceder 240 caracteres.');
  }

  return normalized;
}

function normalizeUpdateInput(input: FactionUpdateInput): {
  abbreviation?: string;
  description?: string | null;
  name?: string;
} {
  const values: {
    abbreviation?: string;
    description?: string | null;
    name?: string;
  } = {};

  if (input.name !== undefined) {
    values.name = validateFactionName(input.name);
  }

  if (input.abbreviation !== undefined) {
    values.abbreviation = validateFactionAbbreviation(input.abbreviation);
  }

  if (input.description !== undefined) {
    values.description = normalizeFactionDescription(input.description);
  }

  if (Object.keys(values).length === 0) {
    throw new FactionError('validation', 'Informe ao menos um campo para atualizar a faccao.');
  }

  return values;
}

function mergeFactionRobberyPolicy(
  currentPolicy: FactionRobberyPolicy,
  input: FactionRobberyPolicyUpdateInput,
): FactionRobberyPolicy {
  if (input.global === undefined && input.regions === undefined) {
    throw new FactionError('validation', 'Informe ao menos um ajuste na politica de roubos da faccao.');
  }

  const nextGlobal =
    input.global !== undefined ? validateFactionRobberyPolicyMode(input.global) : currentPolicy.global;
  const nextRegions = { ...currentPolicy.regions };

  if (input.regions !== undefined) {
    for (const [regionId, mode] of Object.entries(input.regions)) {
      const validatedRegionId = validateFactionRobberyPolicyRegionId(regionId);

      if (mode === undefined) {
        delete nextRegions[validatedRegionId];
        continue;
      }

      nextRegions[validatedRegionId] = validateFactionRobberyPolicyMode(mode);
    }
  }

  return {
    global: nextGlobal,
    regions: nextRegions,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeFactionRobberyPolicy(policy: unknown): FactionRobberyPolicy {
  const fallback = {
    ...DEFAULT_FACTION_ROBBERY_POLICY,
    regions: { ...DEFAULT_FACTION_ROBBERY_POLICY.regions },
  };

  if (!policy || typeof policy !== 'object') {
    return fallback;
  }

  const rawPolicy = policy as {
    global?: unknown;
    regions?: Record<string, unknown>;
  };

  const global =
    rawPolicy.global === 'allowed' || rawPolicy.global === 'forbidden'
      ? rawPolicy.global
      : DEFAULT_FACTION_ROBBERY_POLICY.global;
  const regions: Partial<Record<RegionId, FactionRobberyPolicyMode>> = {};

  if (rawPolicy.regions && typeof rawPolicy.regions === 'object') {
    for (const [regionId, mode] of Object.entries(rawPolicy.regions)) {
      if (!isRegionId(regionId) || (mode !== 'allowed' && mode !== 'forbidden')) {
        continue;
      }

      regions[regionId] = mode;
    }
  }

  return {
    global,
    regions,
  };
}

function validateFactionAbbreviation(value: string): string {
  const normalized = normalizeFactionAbbreviation(value);

  if (normalized.length < FACTION_ABBREVIATION_MIN_LENGTH) {
    throw new FactionError(
      'validation',
      `Sigla da faccao deve ter ao menos ${FACTION_ABBREVIATION_MIN_LENGTH} caracteres.`,
    );
  }

  if (normalized.length > FACTION_ABBREVIATION_MAX_LENGTH) {
    throw new FactionError(
      'validation',
      `Sigla da faccao deve ter no maximo ${FACTION_ABBREVIATION_MAX_LENGTH} caracteres.`,
    );
  }

  return normalized;
}

function validateFactionBankAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new FactionError('validation', 'Informe um valor numerico valido para a movimentacao.');
  }

  const normalizedAmount = roundCurrency(amount);

  if (normalizedAmount <= 0) {
    throw new FactionError('validation', 'O valor da movimentacao deve ser maior que zero.');
  }

  return normalizedAmount;
}

function validateFactionRobberyPolicyMode(mode: FactionRobberyPolicyMode): FactionRobberyPolicyMode {
  if (mode !== 'allowed' && mode !== 'forbidden') {
    throw new FactionError('validation', 'Modo de politica de roubo invalido.');
  }

  return mode;
}

function validateFactionRobberyPolicyRegionId(regionId: string): RegionId {
  if (!isRegionId(regionId)) {
    throw new FactionError('validation', 'Regiao invalida na politica de roubos.');
  }

  return regionId;
}

function isRegionId(value: string): value is RegionId {
  return (
    value === 'zona_sul' ||
    value === 'zona_norte' ||
    value === 'centro' ||
    value === 'zona_oeste' ||
    value === 'zona_sudoeste' ||
    value === 'baixada'
  );
}

export class NoopFactionUpgradeEffectReader implements FactionUpgradeEffectReaderContract {
  async getFactionUpgradeEffectsForFaction(): Promise<FactionUpgradeEffectsProfile> {
    return { ...FACTION_EMPTY_UPGRADE_EFFECTS };
  }
}

function validateFactionName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length < FACTION_NAME_MIN_LENGTH) {
    throw new FactionError(
      'validation',
      `Nome da faccao deve ter ao menos ${FACTION_NAME_MIN_LENGTH} caracteres.`,
    );
  }

  if (normalized.length > FACTION_NAME_MAX_LENGTH) {
    throw new FactionError(
      'validation',
      `Nome da faccao deve ter no maximo ${FACTION_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  return normalized;
}

function validateRecruitNickname(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new FactionError('validation', 'Informe o nickname do jogador que sera recrutado.');
  }

  if (normalized.length > 32) {
    throw new FactionError('validation', 'Nickname do jogador alvo esta invalido.');
  }

  return normalized;
}
