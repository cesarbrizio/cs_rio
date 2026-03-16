import {
  FACTION_EMPTY_UPGRADE_EFFECTS,
  FACTION_UPGRADE_DEFINITIONS,
  type FactionBankResponse,
  normalizeCollapsedText,
  normalizePositiveMoney,
  normalizeRoundedMoney,
  normalizeTrimmedText,
  type FactionCreateInput,
  type FactionMemberSummary,
  type FactionRank,
  type FactionSummary,
  type FactionUpdateInput,
  type FactionUpgradeEffectsProfile,
  type FactionUpgradeSummary,
  type FactionUpgradeType,
  type VocationType,
} from '@cs-rio/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
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
} from '../../db/schema.js';
import {
  type FactionRobberyPolicy,
  type FactionRobberyPolicyMode,
} from '../faction-internal-satisfaction.js';
import { GameConfigService } from '../game-config.js';
import { resolveDefaultFactionRobberyPolicy } from '../gameplay-config.js';
import type {
  FactionBankLedgerInsertInput,
  FactionBankLedgerRecord,
  FactionConflictRecord,
  FactionLeadershipChallengeRecord,
  FactionLeadershipElectionRecord,
  FactionLeadershipPlayerRecord,
  FactionLeadershipSupportRecord,
  FactionLeadershipVoteRecord,
  FactionMemberRecord,
  FactionPlayerRecord,
  FactionRecord,
  FactionRecruitTargetRecord,
  FactionRepository,
  FactionRobberyPolicyUpdateInput,
  FactionUpgradeEffectReaderContract,
  FactionUpgradeRecord,
  RegionId,
} from './types.js';
import { FactionError } from './types.js';

const FACTION_ABBREVIATION_MAX_LENGTH = 12;
const FACTION_ABBREVIATION_MIN_LENGTH = 2;
const FACTION_DESCRIPTION_MAX_LENGTH = 500;
const FACTION_NAME_MAX_LENGTH = 120;
const FACTION_NAME_MIN_LENGTH = 3;
const FIXED_FACTION_SELF_JOIN_SLOT_CAP = 20;
const FACTION_RANK_ORDER: FactionRank[] = ['patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria'];
const DEFAULT_FACTION_ROBBERY_POLICY: FactionRobberyPolicy = {
  global: 'allowed',
  regions: {},
};
const gameConfigService = new GameConfigService();

type DatabaseClient = typeof db;

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
        cansaco: players.cansaco,
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
      cansaco: player.cansaco,
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
    cansacoCost: number;
    successChancePercent: number;
  }): Promise<FactionLeadershipChallengeRecord> {
    return db.transaction(async (tx) => {
      const [challenger] = await tx
        .select({
          conceito: players.conceito,
          hp: players.hp,
          cansaco: players.cansaco,
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
          cansaco: Math.max(0, challenger.cansaco - input.cansacoCost),
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
    playerId: string,
    factionId: string,
    upgradeType: FactionUpgradeType,
    bankMoneyCost: number,
    now: Date,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
          points: factions.points,
        })
        .from(factions)
        .where(eq(factions.id, factionId))
        .limit(1);

      if (!faction || Number.parseFloat(String(faction.bankMoney)) < bankMoneyCost) {
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

      const nextBankMoney = roundCurrency(Number.parseFloat(String(faction.bankMoney)) - bankMoneyCost);

      await tx.insert(factionUpgrades).values({
        factionId,
        level: 1,
        unlockedAt: now,
        upgradeType,
      });

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, factionId));

      await insertFactionBankLedgerEntry(tx as unknown as DatabaseClient, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: now,
        description: `Desbloqueio do upgrade ${getFactionUpgradeDefinition(upgradeType)?.label ?? upgradeType}.`,
        entryType: 'withdrawal',
        factionId,
        grossAmount: bankMoneyCost,
        netAmount: bankMoneyCost,
        originType: 'upgrade',
        playerId,
      });

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


export function buildFactionMemberSummaries(
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

export function buildFactionBankLedgerEntries(
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

export function buildFactionUpgradeEffects(
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

export function buildFactionUpgradeSummaries(
  actorRank: FactionRank,
  availableBankMoney: number,
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
      availableBankMoney >= definition.bankMoneyCost;

    let lockReason: string | null = null;

    if (unlocked) {
      lockReason = null;
    } else if (actorRank !== 'patrao') {
      lockReason = 'Somente o Patrao pode desbloquear upgrades.';
    } else if (missingPrerequisite) {
      lockReason = `Requer ${getFactionUpgradeDefinition(missingPrerequisite)?.label ?? missingPrerequisite}.`;
    } else if (availableBankMoney < definition.bankMoneyCost) {
      lockReason = 'Caixa faccional insuficiente.';
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

export function buildFactionSummaries(
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

export function buildFactionNpcLeaderId(factionId: string): string {
  return `npc:${factionId}`;
}

export function buildFactionNpcLeaderSummary(
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

export function resolveFactionNpcLeaderName(
  faction: Pick<FactionSummary, 'abbreviation' | 'isFixed' | 'leaderId' | 'name'>,
): string | null {
  if (!faction.isFixed || faction.leaderId !== null) {
    return null;
  }

  return `Lideranca NPC do ${faction.abbreviation}`;
}

export function canDemote(actorRank: FactionRank, currentRank: FactionRank, nextRank: FactionRank): boolean {
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

export function canExpel(actorRank: FactionRank, targetRank: FactionRank): boolean {
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

export function canPromote(actorRank: FactionRank, currentRank: FactionRank, nextRank: FactionRank): boolean {
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

export function canRecruit(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general' || rank === 'gerente';
}

export function canDepositToFactionBank(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general' || rank === 'gerente' || rank === 'vapor';
}

export function canViewFactionBank(rank: FactionRank): boolean {
  return canDepositToFactionBank(rank);
}

export function canWithdrawFromFactionBank(rank: FactionRank): boolean {
  return rank === 'patrao' || rank === 'general';
}

export function getFactionUpgradeDefinition(
  upgradeType: FactionUpgradeType,
) {
  return FACTION_UPGRADE_DEFINITIONS.find((definition) => definition.type === upgradeType) ?? null;
}

export function compareFactionMemberRecords(left: FactionMemberRecord, right: FactionMemberRecord): number {
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

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function calculateFactionLeadershipPower(player: Pick<
  FactionLeadershipPlayerRecord,
  'carisma' | 'conceito' | 'forca' | 'hp' | 'inteligencia' | 'level' | 'resistencia' | 'cansaco'
>): number {
  return Math.round(
    player.level * 18 +
      player.forca * 4 +
      player.resistencia * 3 +
      player.inteligencia * 2 +
      player.carisma * 2 +
      player.conceito * 0.5 +
      player.hp * 0.2 +
      player.cansaco * 0.2,
  );
}

export function calculateNpcFactionLeadershipPower(
  faction: Pick<FactionSummary, 'memberCount' | 'points'>,
  members: FactionMemberSummary[],
): number {
  const averageLevel =
    members.filter((member) => !member.isNpc && member.level !== null).reduce((sum, member) => sum + (member.level ?? 0), 0) /
    Math.max(1, members.filter((member) => !member.isNpc && member.level !== null).length);

  return Math.round(180 + faction.points * 0.1 + faction.memberCount * 12 + averageLevel * 10);
}

export function clampLeadershipSuccessChance(value: number): number {
  return Math.min(0.8, Math.max(0.2, value));
}

export function formatRankLabel(rank: FactionRank): string {
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

export function getDemotedRank(rank: FactionRank): FactionRank | null {
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

export function getPromotedRank(rank: FactionRank): FactionRank | null {
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

export function normalizeCreateInput(input: FactionCreateInput): {
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

export function normalizeFactionAbbreviation(value: string): string {
  return normalizeCollapsedText(value).replace(/\s+/g, '').toUpperCase();
}

export function normalizeFactionDescription(value?: string | null): string | null {
  const normalized = normalizeCollapsedText(value);

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

export function normalizeFactionName(value: string): string {
  return normalizeCollapsedText(value).toLocaleLowerCase('pt-BR');
}

export function normalizeFactionBankDescription(value: string | undefined, fallback: string): string {
  const normalized = normalizeCollapsedText(value);

  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.length > 240) {
    throw new FactionError('validation', 'A descricao da movimentacao nao pode exceder 240 caracteres.');
  }

  return normalized;
}

export function normalizeUpdateInput(input: FactionUpdateInput): {
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

export function mergeFactionRobberyPolicy(
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

export function roundCurrency(value: number): number {
  return normalizeRoundedMoney(value);
}

export function normalizeFactionRobberyPolicy(policy: unknown): FactionRobberyPolicy {
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

export function validateFactionAbbreviation(value: string): string {
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

export function validateFactionBankAmount(amount: number): number {
  const normalizedAmount = normalizePositiveMoney(amount);

  if (normalizedAmount === null) {
    throw new FactionError('validation', 'O valor da movimentacao deve ser maior que zero.');
  }

  return normalizedAmount;
}

export function validateFactionRobberyPolicyMode(mode: FactionRobberyPolicyMode): FactionRobberyPolicyMode {
  if (mode !== 'allowed' && mode !== 'forbidden') {
    throw new FactionError('validation', 'Modo de politica de roubo invalido.');
  }

  return mode;
}

export function validateFactionRobberyPolicyRegionId(regionId: string): RegionId {
  if (!isRegionId(regionId)) {
    throw new FactionError('validation', 'Regiao invalida na politica de roubos.');
  }

  return regionId;
}

export function isRegionId(value: string): value is RegionId {
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

export function validateFactionName(value: string): string {
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

export function validateRecruitNickname(value: string): string {
  const normalized = normalizeTrimmedText(value);

  if (!normalized) {
    throw new FactionError('validation', 'Informe o nickname do jogador que sera recrutado.');
  }

  if (normalized.length > 32) {
    throw new FactionError('validation', 'Nickname do jogador alvo esta invalido.');
  }

  return normalized;
}
