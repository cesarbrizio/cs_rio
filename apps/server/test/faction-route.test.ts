import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_FACTION_ROBBERY_POLICY,
  RegionId,
  VocationType,
  type FactionRobberyPolicy,
  type FactionLeadershipElectionStatus,
  type FactionRank,
  type FactionUpgradeType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createFactionRoutes } from '../src/api/routes/factions.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import { FactionService, type FactionRepository } from '../src/services/faction.js';

interface InMemoryFactionMemberRecord {
  factionId: string;
  joinedAt: Date;
  playerId: string;
  rank: FactionRank;
}

interface InMemoryFactionRecord {
  abbreviation: string;
  bankMoney: string;
  createdAt: Date;
  description: string | null;
  id: string;
  internalSatisfaction: number;
  isFixed: boolean;
  leaderId: string | null;
  name: string;
  points: number;
  robberyPolicy: FactionRobberyPolicy;
}

interface InMemoryFactionLedgerRecord {
  balanceAfter: number;
  commissionAmount: number;
  createdAt: Date;
  description: string;
  entryType: 'business_commission' | 'deposit' | 'withdrawal';
  grossAmount: number;
  id: string;
  netAmount: number;
  originType: 'bicho' | 'boca' | 'front_store' | 'manual' | 'puteiro' | 'rave' | 'slot_machine' | 'upgrade';
  playerId: string | null;
  propertyId: string | null;
}

interface InMemoryFactionUpgradeRecord {
  level: number;
  type: FactionUpgradeType;
  unlockedAt: Date;
}

interface InMemoryFactionLeadershipElectionRecord {
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

interface InMemoryFactionLeadershipSupportRecord {
  electionId: string;
  playerId: string;
  supportedAt: Date;
}

interface InMemoryFactionLeadershipVoteRecord {
  candidatePlayerId: string;
  electionId: string;
  votedAt: Date;
  voterPlayerId: string;
}

interface InMemoryFactionLeadershipChallengeRecord {
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

interface TestState {
  factionLedgerByFactionId: Map<string, InMemoryFactionLedgerRecord[]>;
  factionLeadershipChallengesByFactionId: Map<string, InMemoryFactionLeadershipChallengeRecord>;
  factionLeadershipElections: Map<string, InMemoryFactionLeadershipElectionRecord>;
  factionLeadershipElectionSupportsByElectionId: Map<string, InMemoryFactionLeadershipSupportRecord[]>;
  factionLeadershipElectionVotesByElectionId: Map<string, InMemoryFactionLeadershipVoteRecord[]>;
  factionMembers: InMemoryFactionMemberRecord[];
  factionUpgradesByFactionId: Map<string, InMemoryFactionUpgradeRecord[]>;
  factions: Map<string, InMemoryFactionRecord>;
  players: Map<string, AuthPlayerRecord>;
}

class InMemoryAuthFactionRepository implements AuthRepository, FactionRepository {
  constructor(private readonly state: TestState) {}

  async addMember(
    factionId: string,
    playerId: string,
    rank: FactionRank,
    now: Date,
  ): Promise<boolean> {
    const player = this.state.players.get(playerId);

    if (!player || player.factionId) {
      return false;
    }

    this.state.factionMembers.push({
      factionId,
      joinedAt: now,
      playerId,
      rank,
    });
    player.factionId = factionId;
    return true;
  }

  async addFactionLeadershipSupport(
    electionId: string,
    playerId: string,
    now: Date,
  ): Promise<boolean> {
    const supports = this.state.factionLeadershipElectionSupportsByElectionId.get(electionId) ?? [];

    if (supports.some((entry) => entry.playerId === playerId)) {
      return false;
    }

    supports.push({
      electionId,
      playerId,
      supportedAt: now,
    });
    this.state.factionLeadershipElectionSupportsByElectionId.set(electionId, supports);
    return true;
  }

  async activateFactionLeadershipElection(electionId: string, startsAt: Date, endsAt: Date): Promise<void> {
    const election = this.state.factionLeadershipElections.get(electionId);

    if (!election) {
      return;
    }

    election.status = 'active';
    election.startedAt = startsAt;
    election.endsAt = endsAt;
  }

  async createFaction(
    playerId: string,
    input: {
      abbreviation: string;
      description: string | null;
      name: string;
    },
    now: Date,
  ) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    const faction: InMemoryFactionRecord = {
      abbreviation: input.abbreviation,
      bankMoney: '0',
      createdAt: now,
      description: input.description,
      id: randomUUID(),
      internalSatisfaction: 60,
      isFixed: false,
      leaderId: playerId,
      name: input.name,
      points: 0,
      robberyPolicy: {
        ...DEFAULT_FACTION_ROBBERY_POLICY,
        regions: { ...DEFAULT_FACTION_ROBBERY_POLICY.regions },
      },
    };

    this.state.factions.set(faction.id, faction);
    this.state.factionMembers.push({
      factionId: faction.id,
      joinedAt: now,
      playerId,
      rank: 'patrao',
    });
    player.factionId = faction.id;

    return this.findFactionById(playerId, faction.id);
  }

  async createFactionLeadershipElection(
    factionId: string,
    requestedByPlayerId: string,
    supportThreshold: number,
    now: Date,
  ) {
    const election: InMemoryFactionLeadershipElectionRecord = {
      cooldownEndsAt: null,
      createdAt: now,
      endsAt: null,
      factionId,
      id: randomUUID(),
      requestedByPlayerId,
      resolvedAt: null,
      startedAt: null,
      status: 'petitioning',
      supportThreshold,
      winnerPlayerId: null,
    };

    this.state.factionLeadershipElections.set(election.id, election);
    this.state.factionLeadershipElectionSupportsByElectionId.set(election.id, []);
    this.state.factionLeadershipElectionVotesByElectionId.set(election.id, []);
    return { ...election };
  }

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player: AuthPlayerRecord = {
      addiction: 0,
      appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
      bankMoney: '0',
      carisma: 10,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 0,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 10,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 5,
      brisa: 100,
      money: '10000.00',
      disposicao: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 100,
      positionY: 100,
      regionId: RegionId.Centro,
      resistencia: 10,
      cansaco: 100,
      vocation: VocationType.Cria,
    };

    this.state.players.set(player.id, player);
    return { ...player };
  }

  async dissolveFaction(factionId: string): Promise<string[]> {
    const affectedPlayerIds = this.state.factionMembers
      .filter((entry) => entry.factionId === factionId)
      .map((entry) => entry.playerId);

    this.state.factionMembers = this.state.factionMembers.filter((entry) => entry.factionId !== factionId);
    this.state.factionLedgerByFactionId.delete(factionId);
    this.state.factionUpgradesByFactionId.delete(factionId);
    this.state.factionLeadershipChallengesByFactionId.delete(factionId);
    const electionIds = [...this.state.factionLeadershipElections.values()]
      .filter((entry) => entry.factionId === factionId)
      .map((entry) => entry.id);

    for (const electionId of electionIds) {
      this.state.factionLeadershipElections.delete(electionId);
      this.state.factionLeadershipElectionSupportsByElectionId.delete(electionId);
      this.state.factionLeadershipElectionVotesByElectionId.delete(electionId);
    }

    this.state.factions.delete(factionId);

    for (const playerId of affectedPlayerIds) {
      const player = this.state.players.get(playerId);

      if (player) {
        player.factionId = null;
      }
    }

    return affectedPlayerIds;
  }

  async findFactionById(playerId: string, factionId: string) {
    const faction = this.state.factions.get(factionId);

    if (!faction) {
      return null;
    }

    return this.buildFactionSummary(playerId, faction);
  }

  async findFactionConflict(
    normalizedName: string,
    normalizedAbbreviation: string,
    excludeFactionId?: string,
  ) {
    let name = false;
    let abbreviation = false;

    for (const faction of this.state.factions.values()) {
      if (excludeFactionId && faction.id === excludeFactionId) {
        continue;
      }

      if (normalizeName(faction.name) === normalizedName) {
        name = true;
      }

      if (normalizeAbbreviation(faction.abbreviation) === normalizedAbbreviation) {
        abbreviation = true;
      }
    }

    if (!name && !abbreviation) {
      return null;
    }

    return {
      abbreviation,
      name,
    };
  }

  async getLatestFactionLeadershipChallenge(factionId: string) {
    const challenge = this.state.factionLeadershipChallengesByFactionId.get(factionId);
    return challenge ? { ...challenge } : null;
  }

  async getLatestFactionLeadershipElection(factionId: string) {
    const elections = [...this.state.factionLeadershipElections.values()]
      .filter((entry) => entry.factionId === factionId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return elections[0] ? { ...elections[0] } : null;
  }

  async getLeadershipPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

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
      money: Number.parseFloat(player.money),
      nickname: player.nickname,
      resistencia: player.resistencia,
      cansaco: player.cansaco,
      vocation: player.vocation,
    };
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async findRecruitTargetByNickname(nickname: string) {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return {
          characterCreatedAt: player.characterCreatedAt,
          factionId: player.factionId,
          id: player.id,
          level: player.level,
          money: Number.parseFloat(player.money),
          nickname: player.nickname,
          vocation: player.vocation,
        };
      }
    }

    return null;
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: Number.parseFloat(player.money),
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
    const player = this.state.players.get(playerId);
    const faction = this.state.factions.get(factionId);

    if (!player || !faction || player.factionId !== factionId) {
      return false;
    }

    player.money = (Number.parseFloat(player.money) - input.amount).toFixed(2);
    faction.bankMoney = (Number.parseFloat(faction.bankMoney) + input.amount).toFixed(2);
    faction.points += Math.max(1, Math.round(input.amount));
    this.pushLedgerEntry(factionId, {
      balanceAfter: Number.parseFloat(faction.bankMoney),
      commissionAmount: 0,
      createdAt: input.now,
      description: input.description,
      entryType: 'deposit',
      grossAmount: input.amount,
      netAmount: input.amount,
      originType: 'manual',
      playerId,
      propertyId: null,
    });
    return true;
  }

  async listFactionBankLedger(factionId: string, limit: number) {
    return [...(this.state.factionLedgerByFactionId.get(factionId) ?? [])]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit)
      .map((entry) => {
        const player = entry.playerId ? this.state.players.get(entry.playerId) : null;

        return {
          balanceAfter: entry.balanceAfter,
          commissionAmount: entry.commissionAmount,
          createdAt: entry.createdAt,
          description: entry.description,
          entryType: entry.entryType,
          grossAmount: entry.grossAmount,
          id: entry.id,
          netAmount: entry.netAmount,
          originType: entry.originType,
          playerId: entry.playerId,
          playerNickname: player?.nickname ?? null,
          propertyId: entry.propertyId,
        };
      });
  }

  async listFactionLeadershipSupports(electionId: string) {
    return [...(this.state.factionLeadershipElectionSupportsByElectionId.get(electionId) ?? [])];
  }

  async listFactionLeadershipVotes(electionId: string) {
    return [...(this.state.factionLeadershipElectionVotesByElectionId.get(electionId) ?? [])];
  }

  async listFactionMemberIds(factionId: string): Promise<string[]> {
    return this.state.factionMembers
      .filter((entry) => entry.factionId === factionId)
      .map((entry) => entry.playerId);
  }

  async listFactionUpgrades(factionId: string) {
    return [...(this.state.factionUpgradesByFactionId.get(factionId) ?? [])];
  }

  async listFactionMembers(factionId: string) {
    return this.state.factionMembers
      .filter((entry) => entry.factionId === factionId)
      .map((entry) => {
        const player = this.state.players.get(entry.playerId);

        if (!player) {
          return null;
        }

        return {
          factionId,
          joinedAt: entry.joinedAt,
          level: player.level,
          nickname: player.nickname,
          playerId: entry.playerId,
          rank: entry.rank,
          vocation: player.vocation,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  async listFactions(playerId: string) {
    return [...this.state.factions.values()]
      .sort((left, right) => {
        if (left.isFixed !== right.isFixed) {
          return left.isFixed ? -1 : 1;
        }

        return left.name.localeCompare(right.name, 'pt-BR');
      })
      .map((faction) => this.buildFactionSummary(playerId, faction));
  }

  async removeMember(factionId: string, playerId: string): Promise<boolean> {
    const before = this.state.factionMembers.length;
    this.state.factionMembers = this.state.factionMembers.filter(
      (entry) => !(entry.factionId === factionId && entry.playerId === playerId),
    );

    const player = this.state.players.get(playerId);

    if (player && player.factionId === factionId) {
      player.factionId = null;
    }

    return this.state.factionMembers.length !== before;
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
  }) {
    const challenger = this.state.players.get(input.challengerPlayerId);

    if (!challenger) {
      throw new Error('Desafiante nao encontrado no estado de teste.');
    }

    challenger.conceito = Math.max(0, challenger.conceito + input.challengerConceitoDelta);
    challenger.hp = Math.max(1, challenger.hp + input.challengerHpDelta);
    challenger.cansaco = Math.max(0, challenger.cansaco - input.cansacoCost);

    if (input.defenderPlayerId) {
      const defender = this.state.players.get(input.defenderPlayerId);

      if (defender) {
        defender.conceito = Math.max(0, defender.conceito + input.defenderConceitoDelta);
        defender.hp = Math.max(1, defender.hp + input.defenderHpDelta);
      }
    }

    const challenge: InMemoryFactionLeadershipChallengeRecord = {
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
      id: randomUUID(),
      resolvedAt: input.resolvedAt,
      successChancePercent: input.successChancePercent,
    };

    this.state.factionLeadershipChallengesByFactionId.set(input.factionId, challenge);
    return { ...challenge };
  }

  async recordFactionLeadershipVote(
    electionId: string,
    voterPlayerId: string,
    candidatePlayerId: string,
    now: Date,
  ): Promise<boolean> {
    const votes = this.state.factionLeadershipElectionVotesByElectionId.get(electionId) ?? [];

    if (votes.some((entry) => entry.voterPlayerId === voterPlayerId)) {
      return false;
    }

    votes.push({
      candidatePlayerId,
      electionId,
      votedAt: now,
      voterPlayerId,
    });
    this.state.factionLeadershipElectionVotesByElectionId.set(electionId, votes);
    return true;
  }

  async resolveFactionLeadershipElection(
    electionId: string,
    winnerPlayerId: string | null,
    resolvedAt: Date,
    cooldownEndsAt: Date,
  ): Promise<void> {
    const election = this.state.factionLeadershipElections.get(electionId);

    if (!election) {
      return;
    }

    election.status = 'resolved';
    election.resolvedAt = resolvedAt;
    election.cooldownEndsAt = cooldownEndsAt;
    election.winnerPlayerId = winnerPlayerId;
  }

  async transferFactionLeadership(
    factionId: string,
    newLeaderPlayerId: string,
    previousLeaderPlayerId: string | null,
  ): Promise<string[]> {
    const faction = this.state.factions.get(factionId);

    if (!faction) {
      return [];
    }

    faction.leaderId = newLeaderPlayerId;

    const newLeaderMembership = this.state.factionMembers.find(
      (entry) => entry.factionId === factionId && entry.playerId === newLeaderPlayerId,
    );

    if (newLeaderMembership) {
      newLeaderMembership.rank = 'patrao';
    }

    if (previousLeaderPlayerId && previousLeaderPlayerId !== newLeaderPlayerId) {
      const previousLeaderMembership = this.state.factionMembers.find(
        (entry) => entry.factionId === factionId && entry.playerId === previousLeaderPlayerId,
      );

      if (previousLeaderMembership) {
        previousLeaderMembership.rank = 'general';
      }
    }

    return [newLeaderPlayerId, previousLeaderPlayerId].filter(
      (entry): entry is string => Boolean(entry),
    );
  }

  async updateFaction(
    factionId: string,
    input: {
      abbreviation?: string;
      description?: string | null;
      name?: string;
    },
  ) {
    const faction = this.state.factions.get(factionId);

    if (!faction) {
      return null;
    }

    if (input.name !== undefined) {
      faction.name = input.name;
    }

    if (input.abbreviation !== undefined) {
      faction.abbreviation = input.abbreviation;
    }

    if (input.description !== undefined) {
      faction.description = input.description;
    }

    return this.buildFactionSummary(faction.leaderId ?? '', faction);
  }

  async updateFactionRobberyPolicy(
    playerId: string,
    factionId: string,
    robberyPolicy: FactionRobberyPolicy,
    internalSatisfaction: number,
  ) {
    const faction = this.state.factions.get(factionId);

    if (!faction) {
      return null;
    }

    faction.robberyPolicy = {
      global: robberyPolicy.global,
      regions: { ...robberyPolicy.regions },
    };
    faction.internalSatisfaction = internalSatisfaction;

    return this.buildFactionSummary(playerId, faction);
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }

  async updateMemberRank(
    factionId: string,
    playerId: string,
    rank: FactionRank,
  ): Promise<boolean> {
    const member = this.state.factionMembers.find(
      (entry) => entry.factionId === factionId && entry.playerId === playerId,
    );

    if (!member) {
      return false;
    }

    member.rank = rank;
    return true;
  }

  async unlockFactionUpgrade(
    playerId: string,
    factionId: string,
    upgradeType: FactionUpgradeType,
    bankMoneyCost: number,
    now: Date,
  ): Promise<boolean> {
    const faction = this.state.factions.get(factionId);

    if (!faction || Number.parseFloat(faction.bankMoney) < bankMoneyCost) {
      return false;
    }

    const upgrades = this.state.factionUpgradesByFactionId.get(factionId) ?? [];

    if (upgrades.some((entry) => entry.type === upgradeType)) {
      return false;
    }

    upgrades.push({
      level: 1,
      type: upgradeType,
      unlockedAt: now,
    });
    this.state.factionUpgradesByFactionId.set(factionId, upgrades);
    faction.bankMoney = (Number.parseFloat(faction.bankMoney) - bankMoneyCost).toFixed(2);
    this.pushLedgerEntry(factionId, {
      balanceAfter: Number.parseFloat(faction.bankMoney),
      commissionAmount: 0,
      createdAt: now,
      description: `Desbloqueio do upgrade ${upgradeType}.`,
      entryType: 'withdrawal',
      grossAmount: bankMoneyCost,
      netAmount: bankMoneyCost,
      originType: 'upgrade',
      playerId,
      propertyId: null,
    });
    return true;
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
    const player = this.state.players.get(playerId);
    const faction = this.state.factions.get(factionId);

    if (!player || !faction || player.factionId !== factionId) {
      return false;
    }

    player.money = (Number.parseFloat(player.money) + input.amount).toFixed(2);
    faction.bankMoney = (Number.parseFloat(faction.bankMoney) - input.amount).toFixed(2);
    this.pushLedgerEntry(factionId, {
      balanceAfter: Number.parseFloat(faction.bankMoney),
      commissionAmount: 0,
      createdAt: input.now,
      description: input.description,
      entryType: 'withdrawal',
      grossAmount: input.amount,
      netAmount: input.amount,
      originType: 'manual',
      playerId,
      propertyId: null,
    });
    return true;
  }

  private buildFactionSummary(playerId: string, faction: InMemoryFactionRecord) {
    const members = this.state.factionMembers.filter((entry) => entry.factionId === faction.id);
    const myMembership = members.find((entry) => entry.playerId === playerId);
    const canManage =
      faction.leaderId === playerId && myMembership?.rank === 'patrao' && faction.isFixed === false;
    const npcLeaderName = resolveNpcLeaderName(faction);

    return {
      abbreviation: faction.abbreviation,
      bankMoney: Number.parseFloat(faction.bankMoney),
      canConfigure: canManage,
      canDissolve: canManage,
      createdAt: faction.createdAt.toISOString(),
      description: faction.description,
      id: faction.id,
      internalSatisfaction: faction.internalSatisfaction,
      isFixed: faction.isFixed,
      isNpcControlled: npcLeaderName !== null,
      isPlayerMember: Boolean(myMembership),
      leaderId: faction.leaderId,
      memberCount: members.length,
      myRank: myMembership?.rank ?? null,
      name: faction.name,
      npcLeaderName,
      points: faction.points,
      robberyPolicy: {
        global: faction.robberyPolicy.global,
        regions: { ...faction.robberyPolicy.regions },
      },
    };
  }

  private pushLedgerEntry(
    factionId: string,
    input: Omit<InMemoryFactionLedgerRecord, 'id'>,
  ) {
    const entries = this.state.factionLedgerByFactionId.get(factionId) ?? [];
    entries.push({
      id: randomUUID(),
      ...input,
    });
    this.state.factionLedgerByFactionId.set(factionId, entries);
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async increment(key: string): Promise<number> {
    const nextValue = Number.parseInt(this.values.get(key) ?? '0', 10) + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('faction routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let state: TestState;

  beforeEach(async () => {
    state = {
      factionLedgerByFactionId: new Map(),
      factionLeadershipChallengesByFactionId: new Map(),
      factionLeadershipElections: new Map(),
      factionLeadershipElectionSupportsByElectionId: new Map(),
      factionLeadershipElectionVotesByElectionId: new Map(),
      factionMembers: [],
      factionUpgradesByFactionId: new Map(),
      factions: new Map([
        [
          'fixed-faction',
          {
            abbreviation: 'CV',
            bankMoney: '50000.00',
            createdAt: new Date('2026-03-10T08:00:00.000Z'),
            description: 'Faccao fixa do seed.',
            id: 'fixed-faction',
            internalSatisfaction: 62,
            isFixed: true,
            leaderId: null,
            name: 'Comando Vermelho',
            points: 450,
            robberyPolicy: {
              ...DEFAULT_FACTION_ROBBERY_POLICY,
              regions: { ...DEFAULT_FACTION_ROBBERY_POLICY.regions },
            },
          },
        ],
      ]),
      players: new Map(),
    };
    app = await buildTestApp(state);
  });

  afterEach(async () => {
    await app.server.close();
  });

  it('creates a custom faction and lists player membership context', async () => {
    const session = await registerAndExtractSession(app.server, 'lider1');

    const createResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: ' nz ',
        description: '  Controle da Zona Norte  ',
        name: '  Nova Zona  ',
      },
      url: '/api/factions',
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      faction: {
        abbreviation: 'NZ',
        canConfigure: true,
        canDissolve: true,
        description: 'Controle da Zona Norte',
        isPlayerMember: true,
        memberCount: 1,
        myRank: 'patrao',
        name: 'Nova Zona',
      },
    });

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().playerFactionId).toBe(createResponse.json().faction.id);
    expect(listResponse.json().factions).toHaveLength(2);
  });

  it('updates the faction robbery policy for the leader', async () => {
    const session = await registerAndExtractSession(app.server, 'liderpolitica');
    const factionId = await createFaction(app.server, session.accessToken, {
      abbreviation: 'PP',
      name: 'Politica do Papo',
    });

    const updateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'PATCH',
      payload: {
        global: 'allowed',
        regions: {
          [RegionId.ZonaNorte]: 'forbidden',
        },
      },
      url: `/api/factions/${factionId}/robbery-policy`,
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      faction: {
        id: factionId,
        internalSatisfaction: 57,
        robberyPolicy: {
          global: 'allowed',
          regions: {
            [RegionId.ZonaNorte]: 'forbidden',
          },
        },
      },
      playerFactionId: factionId,
    });

    const readResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/robbery-policy`,
    });

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json().faction.internalSatisfaction).toBe(57);
    expect(readResponse.json().faction.robberyPolicy).toEqual({
      global: 'allowed',
      regions: {
        [RegionId.ZonaNorte]: 'forbidden',
      },
    });
  });

  it('exposes fixed factions with NPC leadership when no player leader exists', async () => {
    const member = await registerAndExtractSession(app.server, 'fixomembro');
    const fixedPlayer = state.players.get(member.player.id);

    if (!fixedPlayer) {
      throw new Error('Jogador fixo nao encontrado no estado de teste.');
    }

    fixedPlayer.factionId = 'fixed-faction';
    state.factionMembers.push({
      factionId: 'fixed-faction',
      joinedAt: new Date('2026-03-10T12:30:00.000Z'),
      playerId: fixedPlayer.id,
      rank: 'general',
    });

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${member.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().factions[0]).toMatchObject({
      id: 'fixed-faction',
      isFixed: true,
      isNpcControlled: true,
      leaderId: null,
      npcLeaderName: 'Lideranca NPC do CV',
    });

    const rosterResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${member.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions/fixed-faction/members',
    });

    expect(rosterResponse.statusCode).toBe(200);
    expect(rosterResponse.json()).toMatchObject({
      faction: {
        id: 'fixed-faction',
        isNpcControlled: true,
        npcLeaderName: 'Lideranca NPC do CV',
      },
      members: [
        {
          id: 'npc:fixed-faction',
          isLeader: true,
          isNpc: true,
          level: null,
          nickname: 'Lideranca NPC do CV',
          rank: 'patrao',
          vocation: null,
        },
        {
          id: fixedPlayer.id,
          isLeader: false,
          isNpc: false,
          nickname: 'fixomembro',
          rank: 'general',
        },
      ],
      playerFactionId: 'fixed-faction',
    });
  });

  it('auto promotes members in npc-led fixed factions when time, level and conceito thresholds are met', async () => {
    const member = await registerAndExtractSession(app.server, 'autonpc1');
    const scenarioNow = new Date('2026-03-11T15:00:00.000Z');
    const fixedPlayer = state.players.get(member.player.id);

    if (!fixedPlayer) {
      throw new Error('Jogador de promoção automática não encontrado no estado de teste.');
    }

    fixedPlayer.conceito = 6200;
    fixedPlayer.factionId = 'fixed-faction';
    fixedPlayer.level = 6;
    state.factionMembers.push({
      factionId: 'fixed-faction',
      joinedAt: new Date(scenarioNow.getTime() - 10 * 6 * 60 * 60 * 1000),
      playerId: fixedPlayer.id,
      rank: 'cria',
    });

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${member.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().factions[0]).toMatchObject({
      autoPromotionResult: {
        factionAbbreviation: 'CV',
        newRank: 'gerente',
        previousRank: 'cria',
      },
      id: 'fixed-faction',
      myRank: 'gerente',
      npcProgression: {
        currentRank: 'gerente',
        eligibleNow: false,
        nextRank: 'general',
      },
    });
    expect(findStoredMemberRank(state.factionMembers, fixedPlayer.id)).toBe('gerente');
  });

  it('blocks npc auto promotion when the member has just entered the fixed faction', async () => {
    const member = await registerAndExtractSession(app.server, 'autonpc2');
    const scenarioNow = new Date('2026-03-11T15:00:00.000Z');
    const fixedPlayer = state.players.get(member.player.id);

    if (!fixedPlayer) {
      throw new Error('Jogador recém-ingresso não encontrado no estado de teste.');
    }

    fixedPlayer.conceito = 99999;
    fixedPlayer.factionId = 'fixed-faction';
    fixedPlayer.level = 10;
    state.factionMembers.push({
      factionId: 'fixed-faction',
      joinedAt: scenarioNow,
      playerId: fixedPlayer.id,
      rank: 'cria',
    });

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${member.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().factions[0]).toMatchObject({
      id: 'fixed-faction',
      myRank: 'cria',
      npcProgression: {
        blockedReason: expect.stringContaining('faltam 2 dias na facção'),
        currentRank: 'cria',
        eligibleNow: false,
        nextRank: 'soldado',
        remainingDaysInFaction: 2,
      },
    });
    expect(findStoredMemberRank(state.factionMembers, fixedPlayer.id)).toBe('cria');
  });

  it('surfaces slot blockage when npc progression reaches a capped rank', async () => {
    const member = await registerAndExtractSession(app.server, 'autonpc3');
    const scenarioNow = new Date('2026-03-11T15:00:00.000Z');
    const fixedPlayer = state.players.get(member.player.id);

    if (!fixedPlayer) {
      throw new Error('Jogador de bloqueio por vaga não encontrado no estado de teste.');
    }

    fixedPlayer.conceito = 120000;
    fixedPlayer.factionId = 'fixed-faction';
    fixedPlayer.level = 10;
    state.factionMembers.push(
      {
        factionId: 'fixed-faction',
        joinedAt: new Date(scenarioNow.getTime() - 20 * 6 * 60 * 60 * 1000),
        playerId: fixedPlayer.id,
        rank: 'gerente',
      },
      {
        factionId: 'fixed-faction',
        joinedAt: new Date('2026-03-01T12:00:00.000Z'),
        playerId: 'ocupante-general-1',
        rank: 'general',
      },
      {
        factionId: 'fixed-faction',
        joinedAt: new Date('2026-03-02T12:00:00.000Z'),
        playerId: 'ocupante-general-2',
        rank: 'general',
      },
    );
    state.players.set('ocupante-general-1', {
      ...(fixedPlayer),
      id: 'ocupante-general-1',
      nickname: 'ocupante-general-1',
    });
    state.players.set('ocupante-general-2', {
      ...(fixedPlayer),
      id: 'ocupante-general-2',
      nickname: 'ocupante-general-2',
    });

    const listResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${member.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().factions[0]).toMatchObject({
      id: 'fixed-faction',
      myRank: 'gerente',
      npcProgression: {
        blockedReason: expect.stringContaining('não há vaga para General'),
        currentRank: 'gerente',
        eligibleNow: false,
        nextRank: 'general',
        occupiedSlotsForNextRank: 2,
        slotAvailable: false,
        slotLimitForNextRank: 2,
      },
    });
    expect(findStoredMemberRank(state.factionMembers, fixedPlayer.id)).toBe('gerente');
  });

  it('rejects duplicate config and prevents creating a second faction for the same player', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider2');

    const createResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: 'ZN',
        name: 'Zona Norte Elite',
      },
      url: '/api/factions',
    });

    expect(createResponse.statusCode).toBe(201);

    const secondCreateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: 'ZN2',
        name: 'Outra Faccao',
      },
      url: '/api/factions',
    });

    expect(secondCreateResponse.statusCode).toBe(409);
    expect(secondCreateResponse.json().message).toContain('ja pertence');

    const rival = await registerAndExtractSession(app.server, 'lider3');
    const duplicateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${rival.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: 'zn',
        name: 'zona norte elite',
      },
      url: '/api/factions',
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json().message).toContain('Nome e sigla');
  });

  it('updates and dissolves custom factions while blocking edits on fixed factions', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider4');

    const createResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        abbreviation: 'ZO',
        name: 'Zona Oeste Forte',
      },
      url: '/api/factions',
    });

    const factionId = createResponse.json().faction.id as string;
    const updateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'PATCH',
      payload: {
        description: 'Base operacional reforcada',
        name: 'Zona Oeste Suprema',
      },
      url: `/api/factions/${factionId}`,
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().faction).toMatchObject({
      description: 'Base operacional reforcada',
      name: 'Zona Oeste Suprema',
    });

    const fixedLeader = await registerAndExtractSession(app.server, 'lider5');
    const fixedPlayer = state.players.get(fixedLeader.player.id);

    if (!fixedPlayer) {
      throw new Error('Jogador fixo nao encontrado no estado de teste.');
    }

    fixedPlayer.factionId = 'fixed-faction';
    state.factionMembers.push({
      factionId: 'fixed-faction',
      joinedAt: new Date('2026-03-10T12:00:00.000Z'),
      playerId: fixedPlayer.id,
      rank: 'patrao',
    });
    state.factions.get('fixed-faction')!.leaderId = fixedPlayer.id;

    const fixedDeleteResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${fixedLeader.accessToken}`,
      },
      method: 'DELETE',
      url: '/api/factions/fixed-faction',
    });

    expect(fixedDeleteResponse.statusCode).toBe(403);
    expect(fixedDeleteResponse.json().message).toContain('fixas');

    const deleteResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'DELETE',
      url: `/api/factions/${factionId}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({
      dissolvedFactionId: factionId,
      playerFactionId: null,
    });
  });

  it('recruits a member, lists the roster and allows the member to leave', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider6');
    const recruited = await registerAndExtractSession(app.server, 'cria1');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'BAI',
      name: 'Baile Squad',
    });

    const recruitResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        nickname: recruited.player.nickname,
      },
      url: `/api/factions/${factionId}/members`,
    });

    expect(recruitResponse.statusCode).toBe(201);
    expect(recruitResponse.json().members).toHaveLength(2);
    expect(recruitResponse.json().members[1]).toMatchObject({
      nickname: 'cria1',
      rank: 'cria',
    });

    const rosterResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/members`,
    });

    expect(rosterResponse.statusCode).toBe(200);
    expect(rosterResponse.json().members.map((entry: { nickname: string }) => entry.nickname)).toEqual([
      'lider6',
      'cria1',
    ]);

    const leaveResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${recruited.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/leave`,
    });

    expect(leaveResponse.statusCode).toBe(200);
    expect(leaveResponse.json()).toEqual({
      factionId,
      playerFactionId: null,
    });
  });

  it('applies hierarchy rules for promotion and enforces general cap', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider7');
    const general1 = await registerAndExtractSession(app.server, 'general1');
    const general2 = await registerAndExtractSession(app.server, 'general2');
    const member = await registerAndExtractSession(app.server, 'membro1');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'HRC',
      name: 'Hierarquia Central',
    });

    await recruitMember(app.server, leader.accessToken, factionId, general1.player.nickname);
    await recruitMember(app.server, leader.accessToken, factionId, general2.player.nickname);
    await recruitMember(app.server, leader.accessToken, factionId, member.player.nickname);

    await promoteMember(app.server, leader.accessToken, factionId, general1.player.id, 4);
    await promoteMember(app.server, leader.accessToken, factionId, general2.player.id, 4);
    await promoteMember(app.server, leader.accessToken, factionId, member.player.id, 1);

    const generalPromoteSoldado = await app.server.inject({
      headers: {
        authorization: `Bearer ${general1.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${member.player.id}/promote`,
    });

    expect(generalPromoteSoldado.statusCode).toBe(200);
    expect(findMemberRank(generalPromoteSoldado.json().members, member.player.id)).toBe('vapor');

    const generalPromoteVapor = await app.server.inject({
      headers: {
        authorization: `Bearer ${general1.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${member.player.id}/promote`,
    });

    expect(generalPromoteVapor.statusCode).toBe(200);
    expect(findMemberRank(generalPromoteVapor.json().members, member.player.id)).toBe('gerente');

    const invalidGeneralPromotion = await app.server.inject({
      headers: {
        authorization: `Bearer ${general1.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${member.player.id}/promote`,
    });

    expect(invalidGeneralPromotion.statusCode).toBe(403);

    const leaderPromoteToGeneral = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${member.player.id}/promote`,
    });

    expect(leaderPromoteToGeneral.statusCode).toBe(409);
    expect(leaderPromoteToGeneral.json().message).toContain('generais');
  });

  it('demotes and expels with rank restrictions and blocks patron leave', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider8');
    const general = await registerAndExtractSession(app.server, 'general3');
    const soldier = await registerAndExtractSession(app.server, 'soldado1');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'ORD',
      name: 'Ordem Interna',
    });

    await recruitMember(app.server, leader.accessToken, factionId, general.player.nickname);
    await recruitMember(app.server, leader.accessToken, factionId, soldier.player.nickname);
    await promoteMember(app.server, leader.accessToken, factionId, general.player.id, 4);
    await promoteMember(app.server, leader.accessToken, factionId, soldier.player.id, 1);

    const demoteResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${general.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${soldier.player.id}/demote`,
    });

    expect(demoteResponse.statusCode).toBe(200);
    expect(findMemberRank(demoteResponse.json().members, soldier.player.id)).toBe('cria');

    const expelResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${general.accessToken}`,
      },
      method: 'DELETE',
      url: `/api/factions/${factionId}/members/${soldier.player.id}`,
    });

    expect(expelResponse.statusCode).toBe(200);
    expect(expelResponse.json().members.map((entry: { id: string }) => entry.id)).not.toContain(
      soldier.player.id,
    );

    const invalidExpelLeader = await app.server.inject({
      headers: {
        authorization: `Bearer ${general.accessToken}`,
      },
      method: 'DELETE',
      url: `/api/factions/${factionId}/members/${leader.player.id}`,
    });

    expect(invalidExpelLeader.statusCode).toBe(403);

    const patronLeaveResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/leave`,
    });

    expect(patronLeaveResponse.statusCode).toBe(403);
    expect(patronLeaveResponse.json().message).toContain('Patrao');
  });

  it('allows vapor deposits, general withdrawals and returns bank ledger history', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider9');
    const general = await registerAndExtractSession(app.server, 'general9');
    const vapor = await registerAndExtractSession(app.server, 'vapor9');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'BNK',
      name: 'Banco Central',
    });

    await recruitMember(app.server, leader.accessToken, factionId, general.player.nickname);
    await recruitMember(app.server, leader.accessToken, factionId, vapor.player.nickname);
    await promoteMember(app.server, leader.accessToken, factionId, general.player.id, 4);
    await promoteMember(app.server, leader.accessToken, factionId, vapor.player.id, 2);

    const depositResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${vapor.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 750,
        description: 'Caixinha do turno',
      },
      url: `/api/factions/${factionId}/bank/deposit`,
    });

    expect(depositResponse.statusCode).toBe(200);
    expect(depositResponse.json()).toMatchObject({
      faction: {
        bankMoney: 750,
      },
      ledger: [
        {
          description: 'Caixinha do turno',
          entryType: 'deposit',
          grossAmount: 750,
          originType: 'manual',
          playerNickname: 'vapor9',
        },
      ],
      permissions: {
        canDeposit: true,
        canView: true,
        canWithdraw: false,
      },
    });

    const withdrawResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${general.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 250,
        description: 'Compra de armamento',
      },
      url: `/api/factions/${factionId}/bank/withdraw`,
    });

    expect(withdrawResponse.statusCode).toBe(200);
    expect(withdrawResponse.json().faction.bankMoney).toBe(500);
    expect(withdrawResponse.json().ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Compra de armamento',
          entryType: 'withdrawal',
          grossAmount: 250,
          originType: 'manual',
          playerNickname: 'general9',
        }),
        expect.objectContaining({
          description: 'Caixinha do turno',
          entryType: 'deposit',
          grossAmount: 750,
          originType: 'manual',
          playerNickname: 'vapor9',
        }),
      ]),
    );
    expect(Number.parseFloat(state.players.get(general.player.id)?.money ?? '0')).toBe(10250);
    expect(Number.parseFloat(state.players.get(vapor.player.id)?.money ?? '0')).toBe(9250);

    const bankResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/bank`,
    });

    expect(bankResponse.statusCode).toBe(200);
    expect(bankResponse.json().ledger).toHaveLength(2);
  });

  it('blocks low ranks from finance actions and rejects insufficient funds', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider10');
    const vapor = await registerAndExtractSession(app.server, 'vapor10');
    const soldado = await registerAndExtractSession(app.server, 'soldado10');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'TRV',
      name: 'Travados',
    });

    await recruitMember(app.server, leader.accessToken, factionId, vapor.player.nickname);
    await recruitMember(app.server, leader.accessToken, factionId, soldado.player.nickname);
    await promoteMember(app.server, leader.accessToken, factionId, vapor.player.id, 2);
    await promoteMember(app.server, leader.accessToken, factionId, soldado.player.id, 1);

    const soldadoBankResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${soldado.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/bank`,
    });

    expect(soldadoBankResponse.statusCode).toBe(403);

    const overdraftDepositResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${vapor.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 20000,
      },
      url: `/api/factions/${factionId}/bank/deposit`,
    });

    expect(overdraftDepositResponse.statusCode).toBe(409);
    expect(overdraftDepositResponse.json().message).toContain('insuficiente');

    const vaporWithdrawResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${vapor.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 50,
      },
      url: `/api/factions/${factionId}/bank/withdraw`,
    });

    expect(vaporWithdrawResponse.statusCode).toBe(403);

    const emptyBankWithdrawResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 10,
      },
      url: `/api/factions/${factionId}/bank/withdraw`,
    });

    expect(emptyBankWithdrawResponse.statusCode).toBe(409);
    expect(emptyBankWithdrawResponse.json().message).toContain('Saldo insuficiente');
  });

  it('uses faction bank money for upgrades and records the spend in the ledger', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider11');
    const general = await registerAndExtractSession(app.server, 'general11');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'UPG',
      name: 'Upgrade Squad',
    });

    await recruitMember(app.server, leader.accessToken, factionId, general.player.nickname);
    await promoteMember(app.server, leader.accessToken, factionId, general.player.id, 4);

    const depositResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 10000,
        description: 'Fundo de guerra',
      },
      url: `/api/factions/${factionId}/bank/deposit`,
    });

    expect(depositResponse.statusCode).toBe(200);

    const upgradesResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/upgrades`,
    });

    expect(upgradesResponse.statusCode).toBe(200);
    expect(upgradesResponse.json()).toMatchObject({
      availableBankMoney: 10000,
      availablePoints: 10000,
      effects: {
        attributeBonusMultiplier: 1,
        soldierCapacityMultiplier: 1,
      },
    });
    expect(
      upgradesResponse.json().upgrades.find((entry: { type: string }) => entry.type === 'bonus_atributos_5'),
    ).toMatchObject({
      bankMoneyCost: 10000,
      canUnlock: true,
      isUnlocked: false,
      pointsCost: 10000,
    });

    const generalUnlockResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${general.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/upgrades/bonus_atributos_5/unlock`,
    });

    expect(generalUnlockResponse.statusCode).toBe(403);

    const unlockResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/upgrades/bonus_atributos_5/unlock`,
    });

    expect(unlockResponse.statusCode).toBe(200);
    expect(unlockResponse.json()).toMatchObject({
      availableBankMoney: 0,
      availablePoints: 10000,
      effects: {
        attributeBonusMultiplier: 1.05,
      },
      unlockedUpgradeType: 'bonus_atributos_5',
    });
    expect(
      unlockResponse.json().upgrades.find((entry: { type: string }) => entry.type === 'bonus_atributos_5'),
    ).toMatchObject({
      canUnlock: false,
      isUnlocked: true,
    });

    const bankResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'GET',
      url: `/api/factions/${factionId}/bank`,
    });

    expect(bankResponse.statusCode).toBe(200);
    expect(bankResponse.json().faction.bankMoney).toBe(0);
    expect(bankResponse.json().ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('bonus_atributos_5'),
          entryType: 'withdrawal',
          grossAmount: 10000,
          originType: 'upgrade',
          playerNickname: 'lider11',
        }),
      ]),
    );

    const insufficientBankResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${leader.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/upgrades/bonus_atributos_10/unlock`,
    });

    expect(insufficientBankResponse.statusCode).toBe(409);
    expect(insufficientBankResponse.json().message).toContain('Caixa faccional insuficiente');
  });

  it('supports, votes and resolves a leadership election in a fixed faction', async () => {
    const eleitor1 = await registerAndExtractSession(app.server, 'eleitor1');
    const eleitor2 = await registerAndExtractSession(app.server, 'eleitor2');
    const eleitor3 = await registerAndExtractSession(app.server, 'eleitor3');
    const players = [eleitor1.player.id, eleitor2.player.id, eleitor3.player.id];

    for (const [index, playerId] of players.entries()) {
      const player = state.players.get(playerId);

      if (!player) {
        throw new Error('Jogador eleitor nao encontrado no estado de teste.');
      }

      player.factionId = 'fixed-faction';
      state.factionMembers.push({
        factionId: 'fixed-faction',
        joinedAt: new Date(`2026-03-10T12:0${index}:00.000Z`),
        playerId,
        rank: index === 0 ? 'general' : index === 1 ? 'vapor' : 'soldado',
      });
    }

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${eleitor1.accessToken}`,
      },
      method: 'GET',
      url: '/api/factions/fixed-faction/leadership',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json()).toMatchObject({
      election: null,
      leader: {
        id: null,
        isNpc: true,
        nickname: 'Lideranca NPC do CV',
      },
    });

    const supportResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${eleitor1.accessToken}`,
      },
      method: 'POST',
      url: '/api/factions/fixed-faction/leadership/election/support',
    });

    expect(supportResponse.statusCode).toBe(200);
    expect(supportResponse.json()).toMatchObject({
      triggeredElection: true,
      election: {
        status: 'active',
        supportCount: 1,
        supportThreshold: 1,
      },
    });

    const vote1Response = await app.server.inject({
      headers: {
        authorization: `Bearer ${eleitor1.accessToken}`,
      },
      method: 'POST',
      payload: {
        candidatePlayerId: eleitor1.player.id,
      },
      url: '/api/factions/fixed-faction/leadership/election/vote',
    });

    expect(vote1Response.statusCode).toBe(200);
    expect(vote1Response.json().electionResolved).toBe(false);

    const vote2Response = await app.server.inject({
      headers: {
        authorization: `Bearer ${eleitor2.accessToken}`,
      },
      method: 'POST',
      payload: {
        candidatePlayerId: eleitor1.player.id,
      },
      url: '/api/factions/fixed-faction/leadership/election/vote',
    });

    expect(vote2Response.statusCode).toBe(200);
    expect(vote2Response.json().electionResolved).toBe(false);

    const vote3Response = await app.server.inject({
      headers: {
        authorization: `Bearer ${eleitor3.accessToken}`,
      },
      method: 'POST',
      payload: {
        candidatePlayerId: eleitor2.player.id,
      },
      url: '/api/factions/fixed-faction/leadership/election/vote',
    });

    expect(vote3Response.statusCode).toBe(200);
    expect(vote3Response.json()).toMatchObject({
      electionResolved: true,
      faction: {
        id: 'fixed-faction',
        isNpcControlled: false,
        leaderId: eleitor1.player.id,
      },
      leader: {
        id: eleitor1.player.id,
        isNpc: false,
        nickname: 'eleitor1',
      },
    });
    expect(state.factions.get('fixed-faction')?.leaderId).toBe(eleitor1.player.id);
    expect(findStoredMemberRank(state.factionMembers, eleitor1.player.id)).toBe('patrao');
  });

  it('allows a qualified member to challenge and take faction leadership', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider12');
    const challenger = await registerAndExtractSession(app.server, 'desafiante12');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'DLF',
      name: 'Desafio Final',
    });

    await recruitMember(app.server, leader.accessToken, factionId, challenger.player.nickname);

    const challengerPlayer = state.players.get(challenger.player.id);
    const leaderPlayer = state.players.get(leader.player.id);

    if (!challengerPlayer || !leaderPlayer) {
      throw new Error('Jogadores do desafio nao encontrados no estado de teste.');
    }

    challengerPlayer.level = 12;
    challengerPlayer.forca = 24;
    challengerPlayer.resistencia = 22;
    challengerPlayer.inteligencia = 18;
    challengerPlayer.carisma = 18;
    challengerPlayer.conceito = 220;
    leaderPlayer.level = 5;
    leaderPlayer.forca = 8;
    leaderPlayer.resistencia = 8;
    leaderPlayer.inteligencia = 8;
    leaderPlayer.carisma = 8;

    const challengeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${challenger.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/leadership/challenge`,
    });

    expect(challengeResponse.statusCode).toBe(200);
    expect(challengeResponse.json()).toMatchObject({
      faction: {
        id: factionId,
        leaderId: challenger.player.id,
      },
      leader: {
        id: challenger.player.id,
        nickname: 'desafiante12',
      },
      result: {
        challengerPlayerId: challenger.player.id,
        challengerWon: true,
        defenderPlayerId: leader.player.id,
        defenderWasNpc: false,
      },
    });
    expect(state.factions.get(factionId)?.leaderId).toBe(challenger.player.id);
    expect(findStoredMemberRank(state.factionMembers, challenger.player.id)).toBe('patrao');
    expect(findStoredMemberRank(state.factionMembers, leader.player.id)).toBe('general');
    expect(state.players.get(challenger.player.id)?.cansaco).toBe(70);
  });

  it('blocks leadership challenges from members below level 9', async () => {
    const leader = await registerAndExtractSession(app.server, 'lider13');
    const challenger = await registerAndExtractSession(app.server, 'baixo13');
    const factionId = await createFaction(app.server, leader.accessToken, {
      abbreviation: 'BLQ',
      name: 'Bloqueio',
    });

    await recruitMember(app.server, leader.accessToken, factionId, challenger.player.nickname);

    const challengeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${challenger.accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/leadership/challenge`,
    });

    expect(challengeResponse.statusCode).toBe(409);
    expect(challengeResponse.json().message).toContain('nivel 9+');
  });
});

async function buildTestApp(state: TestState) {
  const repository = new InMemoryAuthFactionRepository(state);
  const keyValueStore = new InMemoryKeyValueStore();
  const fixedNow = new Date('2026-03-11T15:00:00.000Z');
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const factionService = new FactionService({
    keyValueStore,
    now: () => fixedNow,
    random: () => 0.1,
    repository,
  });
  const server = Fastify();

  await server.register(createAuthRoutes({ authService }), {
    prefix: '/api',
  });
  await server.register(
    async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      await protectedRoutes.register(createFactionRoutes({ factionService }));
    },
    {
      prefix: '/api',
    },
  );

  return {
    authService,
    factionService,
    server,
  };
}

async function createFaction(
  server: Awaited<ReturnType<typeof buildTestApp>>['server'],
  accessToken: string,
  input: {
    abbreviation: string;
    name: string;
  },
): Promise<string> {
  const response = await server.inject({
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
    payload: input,
    url: '/api/factions',
  });

  expect(response.statusCode).toBe(201);
  return response.json().faction.id;
}

function findMemberRank(
  members: Array<{ id: string; rank: FactionRank }>,
  playerId: string,
): FactionRank | null {
  return members.find((member) => member.id === playerId)?.rank ?? null;
}

function findStoredMemberRank(
  members: InMemoryFactionMemberRecord[],
  playerId: string,
): FactionRank | null {
  return members.find((member) => member.playerId === playerId)?.rank ?? null;
}

function normalizeAbbreviation(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function resolveNpcLeaderName(faction: Pick<InMemoryFactionRecord, 'abbreviation' | 'isFixed' | 'leaderId'>): string | null {
  if (!faction.isFixed || faction.leaderId !== null) {
    return null;
  }

  return `Lideranca NPC do ${faction.abbreviation}`;
}

async function promoteMember(
  server: Awaited<ReturnType<typeof buildTestApp>>['server'],
  accessToken: string,
  factionId: string,
  memberPlayerId: string,
  times: number,
): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    const response = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: `/api/factions/${factionId}/members/${memberPlayerId}/promote`,
    });

    expect(response.statusCode).toBe(200);
  }
}

async function recruitMember(
  server: Awaited<ReturnType<typeof buildTestApp>>['server'],
  accessToken: string,
  factionId: string,
  nickname: string,
): Promise<void> {
  const response = await server.inject({
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
    payload: {
      nickname,
    },
    url: `/api/factions/${factionId}/members`,
  });

  expect(response.statusCode).toBe(201);
}

async function registerAndExtractSession(
  server: Awaited<ReturnType<typeof buildTestApp>>['server'],
  suffix: string,
) {
  const response = await server.inject({
    method: 'POST',
    payload: {
      email: `${suffix}@csrio.test`,
      nickname: suffix,
      password: 'senha-super-segura',
    },
    url: '/api/auth/register',
  });

  expect(response.statusCode).toBe(201);
  return response.json();
}
