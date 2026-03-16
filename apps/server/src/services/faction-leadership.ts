import {
  type FactionAutoPromotionResult,
  type FactionLeadershipCenterResponse,
  type FactionLeadershipChallengeResponse,
  type FactionLeadershipChallengeResult,
  type FactionLeadershipElectionSummary,
  type FactionLeadershipElectionSupportResponse,
  type FactionLeadershipVoteInput,
  type FactionLeadershipVoteResponse,
  type FactionLeaderSummary,
  type FactionMemberSummary,
} from '@cs-rio/shared';

import {
  addHours,
  buildFactionNpcLeaderSummary,
  calculateFactionLeadershipPower,
  calculateNpcFactionLeadershipPower,
  clampLeadershipSuccessChance,
} from './faction/repository.js';
import {
  FactionError,
  type FactionLeadershipChallengeRecord,
  type FactionLeadershipElectionRecord,
  type FactionLeadershipPlayerRecord,
  type FactionLeadershipSupportRecord,
  type FactionLeadershipVoteRecord,
  type FactionMembershipSnapshot,
  type FactionPlayerRecord,
  type FactionRepository,
} from './faction/types.js';

const FACTION_LEADERSHIP_CHALLENGE_CONCEITO_LOSS = 80;
const FACTION_LEADERSHIP_CHALLENGE_CONCEITO_REWARD = 120;
const FACTION_LEADERSHIP_CHALLENGE_COOLDOWN_HOURS = 24;
const FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_FAIL = 10;
const FACTION_LEADERSHIP_CHALLENGE_DEFENDER_HP_LOSS_ON_SUCCESS = 26;
const FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_FAIL = 22;
const FACTION_LEADERSHIP_CHALLENGE_HP_LOSS_ON_SUCCESS = 12;
const FACTION_LEADERSHIP_CHALLENGE_MIN_LEVEL = 9;
const FACTION_LEADERSHIP_CHALLENGE_CANSACO_COST = 30;
const FACTION_LEADERSHIP_ELECTION_COOLDOWN_HOURS = 24;
const FACTION_LEADERSHIP_ELECTION_DURATION_HOURS = 12;
const FACTION_LEADERSHIP_MIN_CANDIDATE_LEVEL = 5;

export interface FactionLeadershipSnapshotReader {
  (
    playerId: string,
    factionId: string,
    options?: {
      autoPromotionResult?: FactionAutoPromotionResult | null;
      skipAutoPromotion?: boolean;
    },
  ): Promise<FactionMembershipSnapshot>;
}

export interface FactionLeadershipReadyPlayerReader {
  (playerId: string): Promise<FactionPlayerRecord>;
}

export interface FactionLeadershipProfileInvalidator {
  (playerIds: string[]): Promise<void>;
}

export interface FactionLeadershipServiceOptions {
  getFactionSnapshot: FactionLeadershipSnapshotReader;
  getReadyPlayer: FactionLeadershipReadyPlayerReader;
  invalidatePlayerProfiles: FactionLeadershipProfileInvalidator;
  now: () => Date;
  random: () => number;
  repository: FactionRepository;
}

export class FactionLeadershipService {
  constructor(private readonly options: FactionLeadershipServiceOptions) {}

  async getFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipCenterResponse> {
    await this.options.getReadyPlayer(playerId);
    const now = this.options.now();
    let snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    const autoPromotionResult = snapshot.faction.autoPromotionResult ?? null;
    const election = await this.syncFactionLeadershipElection(snapshot, now);
    snapshot = await this.options.getFactionSnapshot(playerId, factionId, {
      autoPromotionResult,
      skipAutoPromotion: true,
    });
    const challenge = await this.options.repository.getLatestFactionLeadershipChallenge(factionId);

    return this.buildFactionLeadershipCenter(snapshot, playerId, election, challenge, now);
  }

  async supportFactionLeadershipElection(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipElectionSupportResponse> {
    await this.options.getReadyPlayer(playerId);
    const now = this.options.now();
    let snapshot = await this.options.getFactionSnapshot(playerId, factionId);
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
      election = await this.options.repository.createFactionLeadershipElection(
        factionId,
        playerId,
        this.computeFactionLeadershipSupportThreshold(snapshot.members),
        now,
      );
    }

    const supported = await this.options.repository.addFactionLeadershipSupport(election.id, playerId, now);

    if (!supported) {
      throw new FactionError('conflict', 'Voce ja apoiou esta eleicao de lideranca.');
    }

    let triggeredElection = false;
    const supports = await this.options.repository.listFactionLeadershipSupports(election.id);

    if (election.status === 'petitioning' && supports.length >= election.supportThreshold) {
      const endsAt = addHours(now, FACTION_LEADERSHIP_ELECTION_DURATION_HOURS);
      await this.options.repository.activateFactionLeadershipElection(election.id, now, endsAt);
      election = {
        ...election,
        endsAt,
        startedAt: now,
        status: 'active',
      };
      triggeredElection = true;
    }

    snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    const challenge = await this.options.repository.getLatestFactionLeadershipChallenge(factionId);
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
    await this.options.getReadyPlayer(playerId);
    const now = this.options.now();
    let snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    const election = await this.syncFactionLeadershipElection(snapshot, now);
    snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    const challenger = await this.getFactionLeadershipReadyPlayer(playerId);
    const latestChallenge = await this.options.repository.getLatestFactionLeadershipChallenge(factionId);
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
    const defender = leader.id ? await this.options.repository.getLeadershipPlayer(leader.id) : null;
    const challengerPower = calculateFactionLeadershipPower(challenger);
    const defenderPower = defender
      ? calculateFactionLeadershipPower(defender)
      : calculateNpcFactionLeadershipPower(snapshot.faction, snapshot.members);
    const successChance = clampLeadershipSuccessChance(
      challengerPower / Math.max(1, challengerPower + defenderPower),
    );
    const challengerWon = this.options.random() < successChance;
    const cooldownEndsAt = addHours(now, FACTION_LEADERSHIP_CHALLENGE_COOLDOWN_HOURS);
    const challengeRecord = await this.options.repository.recordFactionLeadershipChallenge({
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
      cansacoCost: FACTION_LEADERSHIP_CHALLENGE_CANSACO_COST,
      successChancePercent: Math.round(successChance * 100),
    });

    const affectedPlayerIds = new Set<string>([challenger.id]);

    if (defender?.id) {
      affectedPlayerIds.add(defender.id);
    }

    if (challengerWon && challenger.id !== snapshot.faction.leaderId) {
      const transferredPlayerIds = await this.options.repository.transferFactionLeadership(
        factionId,
        challenger.id,
        snapshot.faction.leaderId,
      );

      for (const memberId of transferredPlayerIds) {
        affectedPlayerIds.add(memberId);
      }

      for (const memberId of await this.options.repository.listFactionMemberIds(factionId)) {
        affectedPlayerIds.add(memberId);
      }
    }

    await this.options.invalidatePlayerProfiles([...affectedPlayerIds]);

    snapshot = await this.options.getFactionSnapshot(playerId, factionId);
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

  async voteFactionLeadership(
    playerId: string,
    factionId: string,
    input: FactionLeadershipVoteInput,
  ): Promise<FactionLeadershipVoteResponse> {
    await this.options.getReadyPlayer(playerId);
    const now = this.options.now();
    let snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    let election = await this.syncFactionLeadershipElection(snapshot, now);

    if (!election || election.status !== 'active') {
      throw new FactionError('conflict', 'Nao existe eleicao de lideranca ativa para votar.');
    }

    const candidates = this.getEligibleFactionLeadershipCandidates(snapshot.members);
    const candidate = candidates.find((entry) => entry.id === input.candidatePlayerId);

    if (!candidate) {
      throw new FactionError('validation', 'Candidato de lideranca invalido.');
    }

    const recorded = await this.options.repository.recordFactionLeadershipVote(
      election.id,
      playerId,
      candidate.id,
      now,
    );

    if (!recorded) {
      throw new FactionError('conflict', 'Voce ja votou nesta eleicao.');
    }

    const votes = await this.options.repository.listFactionLeadershipVotes(election.id);
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
      snapshot = await this.options.getFactionSnapshot(playerId, factionId);
    }

    const challenge = await this.options.repository.getLatestFactionLeadershipChallenge(factionId);
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
    const supports = election ? await this.options.repository.listFactionLeadershipSupports(election.id) : [];
    const votes = election ? await this.options.repository.listFactionLeadershipVotes(election.id) : [];

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
        : await this.options.repository.getLeadershipPlayer(challenge.challengerPlayerId);
    const defenderMember = challenge.defenderPlayerId
      ? membersById.get(challenge.defenderPlayerId)
      : null;
    const defenderPlayer =
      challenge.defenderPlayerId && !defenderMember
        ? await this.options.repository.getLeadershipPlayer(challenge.defenderPlayerId)
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
    const player = await this.options.repository.getLeadershipPlayer(playerId);

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

    if (challenger.cansaco < FACTION_LEADERSHIP_CHALLENGE_CANSACO_COST) {
      return {
        canChallenge: false,
        cooldownEndsAt,
        cooldownRemainingSeconds,
        lockReason: `Cansaço insuficiente para o desafio. Sao necessarios ${FACTION_LEADERSHIP_CHALLENGE_CANSACO_COST} pontos.`,
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

    await this.options.repository.resolveFactionLeadershipElection(
      election.id,
      winnerPlayerId,
      now,
      cooldownEndsAt,
    );

    if (winnerPlayerId && winnerPlayerId !== snapshot.faction.leaderId) {
      const affectedPlayerIds = await this.options.repository.transferFactionLeadership(
        snapshot.faction.id,
        winnerPlayerId,
        snapshot.faction.leaderId,
      );

      for (const memberId of await this.options.repository.listFactionMemberIds(snapshot.faction.id)) {
        affectedPlayerIds.push(memberId);
      }

      await this.options.invalidatePlayerProfiles(affectedPlayerIds);
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
    let election = await this.options.repository.getLatestFactionLeadershipElection(snapshot.faction.id);

    if (!election) {
      return null;
    }

    if (election.status === 'petitioning') {
      const supports = await this.options.repository.listFactionLeadershipSupports(election.id);

      if (supports.length >= election.supportThreshold) {
        const endsAt = addHours(now, FACTION_LEADERSHIP_ELECTION_DURATION_HOURS);
        await this.options.repository.activateFactionLeadershipElection(election.id, now, endsAt);
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

    const votes = await this.options.repository.listFactionLeadershipVotes(election.id);

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
}
