import {
  FACTION_EMPTY_UPGRADE_EFFECTS,
  type FactionAutoPromotionResult,
  type FactionBankDepositInput,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
  type FactionCreateInput,
  type FactionDissolveResponse,
  type FactionLeadershipCenterResponse,
  type FactionLeadershipChallengeResponse,
  type FactionLeadershipElectionSupportResponse,
  type FactionLeadershipVoteInput,
  type FactionLeadershipVoteResponse,
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
import { FactionBankService } from './faction-bank.js';
import {
  buildNpcFactionAutoPromotionResult,
  buildNpcFactionProgressionStatus,
  resolveEligibleNpcFactionPromotionRanks,
} from './faction/npc-progression.js';
import { FactionLeadershipService } from './faction-leadership.js';
import {
  applyFactionInternalSatisfactionDelta,
  type FactionRobberyPolicy,
  resolveFactionRobberyPolicySatisfactionDelta,
} from './faction-internal-satisfaction.js';
import {
  buildFactionMemberSummaries,
  buildFactionUpgradeEffects,
  buildFactionUpgradeSummaries,
  canDemote,
  canExpel,
  canPromote,
  canRecruit,
  canViewFactionBank,
  DatabaseFactionRepository,
  formatRankLabel,
  getDemotedRank,
  getFactionUpgradeDefinition,
  getPromotedRank,
  mergeFactionRobberyPolicy,
  normalizeCreateInput,
  normalizeFactionAbbreviation,
  normalizeFactionName,
  normalizeUpdateInput,
  validateRecruitNickname,
} from './faction/repository.js';
import {
  FactionError,
  type FactionMembershipSnapshot,
  type FactionPlayerRecord,
  type FactionRepository,
  type FactionRobberyPolicyResponse,
  type FactionRobberyPolicyUpdateInput,
  type FactionServiceContract,
  type FactionServiceOptions,
} from './faction/types.js';
import { invalidatePlayerProfileCaches } from './player-cache.js';

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
  private readonly bankService: FactionBankService;

  private readonly contactSync: FactionContactSyncContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly leadershipService: FactionLeadershipService;

  private readonly now: () => Date;

  private readonly random: () => number;

  private readonly repository: FactionRepository;

  constructor(options: FactionServiceOptions = {}) {
    this.contactSync = options.contactSync ?? new NoopFactionContactSync();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseFactionRepository();
    this.bankService = new FactionBankService({
      getFactionSnapshot: (playerId, factionId) => this.getFactionSnapshot(playerId, factionId),
      getReadyPlayer: (playerId) => this.getReadyPlayer(playerId),
      invalidatePlayerProfiles: (playerIds) => this.invalidatePlayerProfiles(playerIds),
      now: this.now,
      repository: this.repository,
    });
    this.leadershipService = new FactionLeadershipService({
      getFactionSnapshot: (playerId, factionId, snapshotOptions) =>
        this.getFactionSnapshot(playerId, factionId, snapshotOptions),
      getReadyPlayer: (playerId) => this.getReadyPlayer(playerId),
      invalidatePlayerProfiles: (playerIds) => this.invalidatePlayerProfiles(playerIds),
      now: this.now,
      random: this.random,
      repository: this.repository,
    });
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
    return this.bankService.depositToFactionBank(playerId, factionId, input);
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
    return this.bankService.getFactionBank(playerId, factionId);
  }

  async getFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipCenterResponse> {
    return this.leadershipService.getFactionLeadership(playerId, factionId);
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
    return this.leadershipService.supportFactionLeadershipElection(playerId, factionId);
  }

  async challengeFactionLeadership(
    playerId: string,
    factionId: string,
  ): Promise<FactionLeadershipChallengeResponse> {
    return this.leadershipService.challengeFactionLeadership(playerId, factionId);
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
    return this.bankService.withdrawFromFactionBank(playerId, factionId, input);
  }

  async voteFactionLeadership(
    playerId: string,
    factionId: string,
    input: FactionLeadershipVoteInput,
  ): Promise<FactionLeadershipVoteResponse> {
    return this.leadershipService.voteFactionLeadership(playerId, factionId, input);
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
