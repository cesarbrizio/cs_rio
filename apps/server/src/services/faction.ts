import {
  FACTION_EMPTY_UPGRADE_EFFECTS,
  type FactionAutoPromotionResult,
  type FactionBankDepositInput,
  type FactionLeadershipElectionSummary,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
  type FactionCreateInput,
  type FactionDissolveResponse,
  type FactionLeadershipCenterResponse,
  type FactionLeadershipChallengeResponse,
  type FactionLeadershipChallengeResult,
  type FactionLeadershipElectionSupportResponse,
  type FactionLeadershipVoteInput,
  type FactionLeadershipVoteResponse,
  type FactionLeaderSummary,
  type FactionLeaveResponse,
  type FactionListResponse,
  type FactionMemberSummary,
  type FactionMembersResponse,
  type FactionMutationResponse,
  type FactionRank,
  type FactionRecruitInput,
  type FactionSummary,
  type FactionUpdateInput,
  type FactionUpgradeCenterResponse,
  type FactionUpgradeEffectsProfile,
  type FactionUpgradeType,
  type FactionUpgradeUnlockResponse,
} from '@cs-rio/shared';

import { env } from '../config/env.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { NoopFactionContactSync, type FactionContactSyncContract } from './contact.js';
import {
  buildNpcFactionAutoPromotionResult,
  buildNpcFactionProgressionStatus,
  resolveEligibleNpcFactionPromotionRanks,
} from './faction/npc-progression.js';
import {
  applyFactionInternalSatisfactionDelta,
  type FactionRobberyPolicy,
  resolveFactionRobberyPolicySatisfactionDelta,
} from './faction-internal-satisfaction.js';
import {
  addHours,
  buildFactionBankLedgerEntries,
  buildFactionMemberSummaries,
  buildFactionNpcLeaderSummary,
  buildFactionUpgradeEffects,
  buildFactionUpgradeSummaries,
  calculateFactionLeadershipPower,
  calculateNpcFactionLeadershipPower,
  canDemote,
  canDepositToFactionBank,
  canExpel,
  canPromote,
  canRecruit,
  canViewFactionBank,
  canWithdrawFromFactionBank,
  clampLeadershipSuccessChance,
  DatabaseFactionRepository,
  formatRankLabel,
  getDemotedRank,
  getFactionUpgradeDefinition,
  getPromotedRank,
  mergeFactionRobberyPolicy,
  normalizeCreateInput,
  normalizeFactionAbbreviation,
  normalizeFactionBankDescription,
  normalizeFactionName,
  normalizeUpdateInput,
  validateFactionBankAmount,
  validateRecruitNickname,
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
  type FactionRobberyPolicyResponse,
  type FactionRobberyPolicyUpdateInput,
  type FactionServiceContract,
  type FactionServiceOptions,
} from './faction/types.js';
import { invalidatePlayerProfileCaches } from './player-cache.js';

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
const FACTION_RANK_LIMITS: Partial<Record<FactionRank, number>> = {
  general: 2,
  gerente: 5,
  patrao: 1,
  vapor: 10,
};

export {
  calculateFactionPointsDelta,
  DatabaseFactionRepository,
  insertFactionBankLedgerEntry,
  NoopFactionUpgradeEffectReader,
} from './faction/repository.js';
export { FactionError } from './faction/types.js';
export type {
  FactionRepository,
  FactionRobberyPolicyResponse,
  FactionRobberyPolicyUpdateInput,
  FactionServiceContract,
  FactionServiceOptions,
  FactionUpgradeEffectReaderContract,
} from './faction/types.js';

export class FactionService implements FactionServiceContract {
  private readonly contactSync: FactionContactSyncContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly random: () => number;

  private readonly repository: FactionRepository;

  constructor(options: FactionServiceOptions = {}) {
    this.contactSync = options.contactSync ?? new NoopFactionContactSync();
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

    await this.contactSync.syncContactsAfterFactionChange(playerId, createdFaction.id);
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

    await Promise.all(
      affectedPlayerIds.map(async (affectedPlayerId) => {
        await this.contactSync.syncContactsAfterFactionChange(affectedPlayerId, null);
      }),
    );
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

    await this.contactSync.syncContactsAfterFactionChange(memberPlayerId, null);
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
    const autoPromotionResult = snapshot.faction.autoPromotionResult ?? null;
    const election = await this.syncFactionLeadershipElection(snapshot, now);
    snapshot = await this.getFactionSnapshot(playerId, factionId, {
      autoPromotionResult,
      skipAutoPromotion: true,
    });
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
      availableBankMoney: snapshot.faction.bankMoney,
      availablePoints: snapshot.faction.points,
      effects: buildFactionUpgradeEffects(unlockedTypes),
      faction: snapshot.faction,
      playerFactionId: snapshot.faction.id,
      upgrades: buildFactionUpgradeSummaries(snapshot.actor.rank, snapshot.faction.bankMoney, upgrades),
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

    await this.contactSync.syncContactsAfterFactionChange(playerId, factionId);
    await this.invalidatePlayerProfiles([playerId]);

    const joinedFaction = await this.repository.findFactionById(playerId, factionId);

    if (!joinedFaction) {
      throw new FactionError('not_found', 'Faccao nao encontrada apos a entrada.');
    }

    return {
      faction: await this.enrichFactionSummaryWithNpcProgression(playerId, joinedFaction),
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

    await this.contactSync.syncContactsAfterFactionChange(playerId, null);
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

    const autoPromotionResult = player.factionId
      ? await this.maybeApplyNpcAutoPromotion(playerId, player.factionId)
      : null;

    return {
      factions: await this.enrichFactionListWithNpcProgression(
        playerId,
        await this.repository.listFactions(playerId),
        autoPromotionResult,
      ),
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

    await this.contactSync.syncContactsAfterFactionChange(targetPlayer.id, factionId);
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
      cansacoCost: FACTION_LEADERSHIP_CHALLENGE_CANSACO_COST,
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

    if (snapshot.faction.bankMoney < definition.bankMoneyCost) {
      throw new FactionError('insufficient_funds', 'Caixa faccional insuficiente para desbloquear este upgrade.');
    }

    const unlocked = await this.repository.unlockFactionUpgrade(
      playerId,
      factionId,
      upgradeType,
      definition.bankMoneyCost,
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
    options: {
      autoPromotionResult?: FactionAutoPromotionResult | null;
      skipAutoPromotion?: boolean;
    } = {},
  ): Promise<FactionMembershipSnapshot> {
    const autoPromotionResult =
      options.autoPromotionResult ??
      (options.skipAutoPromotion ? null : await this.maybeApplyNpcAutoPromotion(playerId, factionId));
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
      faction: await this.enrichFactionSummaryWithNpcProgression(
        playerId,
        faction,
        autoPromotionResult,
        members,
        actor,
      ),
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
    await invalidatePlayerProfileCaches(this.keyValueStore, playerIds);
  }

  private async enrichFactionListWithNpcProgression(
    playerId: string,
    factions: FactionSummary[],
    autoPromotionResult: FactionAutoPromotionResult | null,
  ): Promise<FactionSummary[]> {
    const enriched = await Promise.all(
      factions.map(async (faction) => {
        if (!faction.isPlayerMember) {
          return {
            ...faction,
            autoPromotionResult: null,
            npcProgression: null,
          };
        }

        return this.enrichFactionSummaryWithNpcProgression(playerId, faction, autoPromotionResult);
      }),
    );

    return enriched;
  }

  private async enrichFactionSummaryWithNpcProgression(
    playerId: string,
    faction: FactionSummary & {
      robberyPolicy?: FactionRobberyPolicy;
    },
    autoPromotionResult: FactionAutoPromotionResult | null = null,
    membersOverride?: FactionMemberSummary[],
    actorOverride?: FactionMemberSummary | null,
  ): Promise<FactionSummary & {
    robberyPolicy?: FactionRobberyPolicy;
  }> {
    if (!faction.isPlayerMember || !faction.isNpcControlled || !faction.isFixed || faction.leaderId !== null) {
      return {
        ...faction,
        autoPromotionResult,
        npcProgression: null,
      };
    }

    const members =
      membersOverride ??
      buildFactionMemberSummaries(await this.repository.listFactionMembers(faction.id), faction);
    const actor = actorOverride ?? members.find((member) => member.id === playerId) ?? null;

    if (!actor || actor.isNpc) {
      return {
        ...faction,
        autoPromotionResult,
        npcProgression: null,
      };
    }

    const player = await this.repository.getLeadershipPlayer(playerId);

    if (!player) {
      return {
        ...faction,
        autoPromotionResult,
        npcProgression: null,
      };
    }

    return {
      ...faction,
      autoPromotionResult,
      npcProgression: buildNpcFactionProgressionStatus({
        actorId: playerId,
        currentRank: actor.rank,
        faction,
        joinedAt: actor.joinedAt,
        members,
        now: this.now(),
        player,
      }),
    };
  }

  private async maybeApplyNpcAutoPromotion(
    playerId: string,
    factionId: string,
  ): Promise<FactionAutoPromotionResult | null> {
    const faction = (await this.repository.findFactionById(playerId, factionId)) as
      | (FactionSummary & {
          robberyPolicy: FactionRobberyPolicy;
        })
      | null;

    if (!faction || !faction.isPlayerMember || !faction.isNpcControlled || !faction.isFixed || faction.leaderId !== null) {
      return null;
    }

    const members = buildFactionMemberSummaries(await this.repository.listFactionMembers(factionId), faction);
    const actor = members.find((member) => member.id === playerId);

    if (!actor || actor.isNpc) {
      return null;
    }

    const player = await this.repository.getLeadershipPlayer(playerId);

    if (!player) {
      return null;
    }

    const promotedRanks = resolveEligibleNpcFactionPromotionRanks({
      actorId: playerId,
      currentRank: actor.rank,
      faction,
      joinedAt: actor.joinedAt,
      members,
      now: this.now(),
      player,
    });

    if (promotedRanks.length === 0) {
      return null;
    }

    const previousRank = actor.rank;

    for (const rank of promotedRanks) {
      const updated = await this.repository.updateMemberRank(factionId, playerId, rank);

      if (!updated) {
        throw new FactionError('not_found', 'Membro da faccao nao encontrado para promocao automatica.');
      }
    }

    await this.invalidatePlayerProfiles([playerId]);

    return buildNpcFactionAutoPromotionResult({
      faction,
      newRank: promotedRanks[promotedRanks.length - 1] ?? previousRank,
      now: this.now(),
      previousRank,
    });
  }
}
