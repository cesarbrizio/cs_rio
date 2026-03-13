import {
  type AssassinationContractNotification,
  type AssassinationContractNotificationType,
  type AssassinationContractStatus,
  type AssassinationContractSummary,
  type FactionRank,
  type PvpAmbushResponse,
  type PvpAssaultResponse,
  type PvpAssassinationContractsResponse,
  type PvpContractAcceptResponse,
  type PvpContractCreateResponse,
  type PvpContractExecutionResponse,
} from '@cs-rio/shared';
import { and, desc, eq, gt, inArray, lt, or } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  assassinationContractNotifications,
  assassinationContracts,
  factionMembers,
  players,
  prisonRecords,
} from '../db/schema.js';
import { CooldownSystem } from '../systems/CooldownSystem.js';
import {
  CombatSystem,
  type CombatPlayerContext,
  type CombatPowerProfile,
} from '../systems/CombatSystem.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { PoliceHeatSystem } from '../systems/PoliceHeatSystem.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { type FactionUpgradeEffectReaderContract } from './faction.js';
import { buildPlayerProfileCacheKey } from './player.js';
import { type UniversityEffectReaderContract } from './university.js';

const AMBUSH_COOLDOWN_SECONDS = 12 * 60 * 60;
const AMBUSH_MAX_ATTACKERS = 5;
const AMBUSH_MIN_ATTACKERS = 2;
const AMBUSH_STAMINA_COST = 15;
const ASSAULT_COOLDOWN_SECONDS = 6 * 60 * 60;
const ASSAULT_STAMINA_COST = 20;
const ASSASSINATION_CONTRACT_DURATION_HOURS = 72;
const ASSASSINATION_CONTRACT_FEE_RATE = 0.1;
const ASSASSINATION_STAMINA_COST = 20;
const LIGHT_HOSPITALIZATION_HP_FLOOR = 1;
const MIN_ASSAULT_LEVEL = 3;
const MIN_ASSASSINATION_ACCEPT_LEVEL = 5;
const MIN_ASSASSINATION_REQUEST_LEVEL = 7;
const NOVICE_PROTECTION_DURATION_HOURS = 72;
const PVP_RANK_ORDER: FactionRank[] = ['patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria'];
type DatabaseClient = typeof db;

export interface PvpServiceContract {
  acceptAssassinationContract(
    playerId: string,
    contractId: string,
  ): Promise<PvpContractAcceptResponse>;
  attemptAmbush(
    initiatorId: string,
    targetPlayerId: string,
    participantIds: string[],
  ): Promise<PvpAmbushResponse>;
  attemptAssault(attackerId: string, targetPlayerId: string): Promise<PvpAssaultResponse>;
  createAssassinationContract(
    requesterId: string,
    targetPlayerId: string,
    reward: number,
  ): Promise<PvpContractCreateResponse>;
  executeAssassinationContract(
    assassinId: string,
    contractId: string,
  ): Promise<PvpContractExecutionResponse>;
  listAssassinationContracts(playerId: string): Promise<PvpAssassinationContractsResponse>;
  close?(): Promise<void>;
}

interface PvpServiceOptions {
  combatSystem?: CombatSystem;
  cooldownSystem?: CooldownSystem;
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  hospitalizationSystem?: OverdoseSystem;
  keyValueStore?: KeyValueStore;
  levelSystem?: LevelSystem;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
  random?: () => number;
  repository?: PvpRepository;
  universityReader?: UniversityEffectReaderContract;
}

interface PvpFactionMembershipRecord {
  factionId: string;
  playerId: string;
  rank: FactionRank;
}

interface AssassinationContractRecord {
  acceptedAt: Date | null;
  acceptedBy: string | null;
  acceptedByNickname: string | null;
  createdAt: Date;
  id: string;
  requesterId: string;
  requesterNickname: string;
  resolvedAt: Date | null;
  reward: number;
  status: AssassinationContractStatus;
  targetId: string;
  targetNickname: string;
}

interface AssassinationContractNotificationRecord {
  contractId: string;
  createdAt: Date;
  id: string;
  message: string;
  playerId: string;
  title: string;
  type: AssassinationContractNotificationType;
}

export interface PvpRepository {
  acceptAssassinationContract(
    contractId: string,
    assassinId: string,
    acceptedAt: Date,
  ): Promise<AssassinationContractRecord>;
  createAssassinationContract(input: PvpCreateAssassinationContractInput): Promise<AssassinationContractRecord>;
  expireAssassinationContracts(expiredAt: Date, expiresBefore: Date): Promise<void>;
  findActiveAssassinationContractForTarget(
    targetId: string,
    expiresBefore: Date,
  ): Promise<AssassinationContractRecord | null>;
  findAssassinationContractById(contractId: string): Promise<AssassinationContractRecord | null>;
  getActivePrisonReleaseAt(playerId: string, now: Date): Promise<Date | null>;
  getFactionCombatMemberships(playerIds: string[]): Promise<Map<string, PvpFactionMembershipRecord>>;
  listAssassinationContracts(playerId: string): Promise<{
    contracts: AssassinationContractRecord[];
    notifications: AssassinationContractNotificationRecord[];
  }>;
  persistAssassinationExecution(input: PvpPersistAssassinationExecutionInput): Promise<void>;
  persistAmbush(input: PvpPersistAmbushInput): Promise<void>;
  persistAssault(input: PvpPersistAssaultInput): Promise<void>;
}

interface PvpCreateAssassinationContractInput {
  createdAt: Date;
  requesterId: string;
  requesterMoneyAfter: number;
  reward: number;
  targetId: string;
}

interface PvpPersistAssaultInput {
  attacker: {
    attributes: CombatPlayerContext['attributes'];
    conceitoAfter: number;
    hpAfter: number;
    id: string;
    levelAfter: number;
    moneyAfter: number;
    staminaAfter: number;
  };
  defender: {
    attributes: CombatPlayerContext['attributes'];
    hpAfter: number;
    id: string;
    moneyAfter: number;
  };
}

interface PvpPersistAmbushInput {
  attackers: Array<{
    conceitoAfter: number;
    hpAfter: number;
    id: string;
    levelAfter: number;
    moneyAfter: number;
    staminaAfter: number;
  }>;
  defender: {
    hpAfter: number;
    id: string;
    moneyAfter: number;
  };
}

interface PvpPersistAssassinationExecutionInput {
  assassin: {
    conceitoAfter: number;
    hpAfter: number;
    id: string;
    levelAfter: number;
    moneyAfter: number;
    staminaAfter: number;
  };
  contract: {
    acceptedAt: Date | null;
    acceptedBy: string | null;
    id: string;
    resolvedAt: Date | null;
    status: AssassinationContractStatus;
  };
  notifications: Array<{
    contractId: string;
    createdAt: Date;
    message: string;
    playerId: string;
    title: string;
    type: AssassinationContractNotificationType;
  }>;
  target: {
    hpAfter: number;
    id: string;
    moneyAfter: number;
  };
}

interface PreparedAmbushAttacker {
  context: CombatPlayerContext;
  isInitiator: boolean;
  membership: PvpFactionMembershipRecord;
  powerProfile: CombatPowerProfile;
}

type PvpErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'cooldown_active'
  | 'forbidden'
  | 'insufficient_resources'
  | 'not_found'
  | 'validation';

export class PvpError extends Error {
  constructor(
    public readonly code: PvpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PvpError';
  }
}

export class DatabasePvpRepository implements PvpRepository {
  async acceptAssassinationContract(
    contractId: string,
    assassinId: string,
    acceptedAt: Date,
  ): Promise<AssassinationContractRecord> {
    return db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      await executor
        .update(assassinationContracts)
        .set({
          acceptedAt,
          acceptedBy: assassinId,
          status: 'accepted',
        })
        .where(eq(assassinationContracts.id, contractId));

      const contract = await this.findAssassinationContractById(contractId);

      if (!contract) {
        throw new Error('Contrato nao encontrado apos aceite.');
      }

      await executor.insert(assassinationContractNotifications).values({
        contractId,
        createdAt: acceptedAt,
        message: `O contrato contra ${contract.targetNickname} foi aceito e ja esta na rua.`,
        playerId: contract.requesterId,
        title: 'Contrato aceito',
        type: 'accepted',
      });

      return contract;
    });
  }

  async createAssassinationContract(
    input: PvpCreateAssassinationContractInput,
  ): Promise<AssassinationContractRecord> {
    return db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      await executor
        .update(players)
        .set({
          money: formatMoney(input.requesterMoneyAfter),
        })
        .where(eq(players.id, input.requesterId));

      const [inserted] = await executor
        .insert(assassinationContracts)
        .values({
          createdAt: input.createdAt,
          requesterId: input.requesterId,
          reward: formatMoney(input.reward),
          targetId: input.targetId,
        })
        .returning({
          id: assassinationContracts.id,
        });

      if (!inserted) {
        throw new Error('Falha ao criar contrato de assassinato.');
      }

      const contract = await this.findAssassinationContractById(inserted.id);

      if (!contract) {
        throw new Error('Contrato nao encontrado apos criacao.');
      }

      return contract;
    });
  }

  async expireAssassinationContracts(expiredAt: Date, expiresBefore: Date): Promise<void> {
    const expiredContracts = await db
      .select({
        id: assassinationContracts.id,
        requesterId: assassinationContracts.requesterId,
        reward: assassinationContracts.reward,
        status: assassinationContracts.status,
        targetNickname: players.nickname,
      })
      .from(assassinationContracts)
      .innerJoin(players, eq(assassinationContracts.targetId, players.id))
      .where(
        and(
          inArray(assassinationContracts.status, ['open', 'accepted', 'failed']),
          lt(assassinationContracts.createdAt, expiresBefore),
        ),
      );

    if (expiredContracts.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      for (const contract of expiredContracts) {
        const reward = Number(contract.reward);
        const [requester] = await executor
          .select({
            money: players.money,
          })
          .from(players)
          .where(eq(players.id, contract.requesterId))
          .limit(1);
        const requesterMoney = Number(requester?.money ?? '0');

        await executor
          .update(players)
          .set({
            money: formatMoney(reward + requesterMoney),
          })
          .where(eq(players.id, contract.requesterId));

        await executor
          .update(assassinationContracts)
          .set({
            resolvedAt: expiredAt,
            status: 'expired',
          })
          .where(eq(assassinationContracts.id, contract.id));

        await executor.insert(assassinationContractNotifications).values({
          contractId: contract.id,
          createdAt: expiredAt,
          message: `Ninguem executou o contrato contra ${contract.targetNickname}. A recompensa voltou para o caixa e a taxa foi perdida.`,
          playerId: contract.requesterId,
          title: 'Contrato expirado',
          type: 'expired',
        });
      }
    });
  }

  async findActiveAssassinationContractForTarget(
    targetId: string,
    expiresBefore: Date,
  ): Promise<AssassinationContractRecord | null> {
    const [row] = await db
      .select({
        id: assassinationContracts.id,
      })
      .from(assassinationContracts)
      .where(
        and(
          eq(assassinationContracts.targetId, targetId),
          inArray(assassinationContracts.status, ['open', 'accepted', 'failed']),
          gt(assassinationContracts.createdAt, expiresBefore),
        ),
      )
      .orderBy(desc(assassinationContracts.createdAt))
      .limit(1);

    return row ? await this.findAssassinationContractById(row.id) : null;
  }

  async findAssassinationContractById(contractId: string): Promise<AssassinationContractRecord | null> {
    const [contract] = await db
      .select()
      .from(assassinationContracts)
      .where(eq(assassinationContracts.id, contractId))
      .limit(1);

    if (!contract) {
      return null;
    }

    const playerIds = [
      contract.requesterId,
      contract.targetId,
      ...(contract.acceptedBy ? [contract.acceptedBy] : []),
    ];
    const playerRows = await db
      .select({
        id: players.id,
        nickname: players.nickname,
      })
      .from(players)
      .where(inArray(players.id, playerIds));
    const nicknames = new Map(playerRows.map((row) => [row.id, row.nickname]));

    return {
      acceptedAt: contract.acceptedAt,
      acceptedBy: contract.acceptedBy,
      acceptedByNickname: contract.acceptedBy ? nicknames.get(contract.acceptedBy) ?? null : null,
      createdAt: contract.createdAt,
      id: contract.id,
      requesterId: contract.requesterId,
      requesterNickname: nicknames.get(contract.requesterId) ?? 'Desconhecido',
      resolvedAt: contract.resolvedAt,
      reward: Number(contract.reward),
      status: contract.status,
      targetId: contract.targetId,
      targetNickname: nicknames.get(contract.targetId) ?? 'Desconhecido',
    };
  }

  async getActivePrisonReleaseAt(playerId: string, now: Date): Promise<Date | null> {
    const [record] = await db
      .select({
        releaseAt: prisonRecords.releaseAt,
      })
      .from(prisonRecords)
      .where(and(eq(prisonRecords.playerId, playerId), gt(prisonRecords.releaseAt, now)))
      .orderBy(desc(prisonRecords.releaseAt))
      .limit(1);

    return record?.releaseAt ?? null;
  }

  async getFactionCombatMemberships(playerIds: string[]): Promise<Map<string, PvpFactionMembershipRecord>> {
    if (playerIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        factionId: factionMembers.factionId,
        playerId: factionMembers.playerId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(inArray(factionMembers.playerId, playerIds));

    return new Map(
      rows.map((row) => [
        row.playerId,
        {
          factionId: row.factionId,
          playerId: row.playerId,
          rank: row.rank,
        } satisfies PvpFactionMembershipRecord,
      ]),
    );
  }

  async listAssassinationContracts(playerId: string): Promise<{
    contracts: AssassinationContractRecord[];
    notifications: AssassinationContractNotificationRecord[];
  }> {
    const [contractRows, notificationRows] = await Promise.all([
      db
        .select()
        .from(assassinationContracts)
        .where(
          or(
            eq(assassinationContracts.requesterId, playerId),
            eq(assassinationContracts.targetId, playerId),
            eq(assassinationContracts.acceptedBy, playerId),
            inArray(assassinationContracts.status, ['open', 'failed']),
          ),
        )
        .orderBy(desc(assassinationContracts.createdAt)),
      db
        .select()
        .from(assassinationContractNotifications)
        .where(eq(assassinationContractNotifications.playerId, playerId))
        .orderBy(desc(assassinationContractNotifications.createdAt))
        .limit(20),
    ]);

    const playerIds = Array.from(
      new Set(
        contractRows.flatMap((contract) => [
          contract.requesterId,
          contract.targetId,
          ...(contract.acceptedBy ? [contract.acceptedBy] : []),
        ]),
      ),
    );
    const playerRows =
      playerIds.length === 0
        ? []
        : await db
            .select({
              id: players.id,
              nickname: players.nickname,
            })
            .from(players)
            .where(inArray(players.id, playerIds));
    const nicknames = new Map(playerRows.map((row) => [row.id, row.nickname]));

    return {
      contracts: contractRows.map((row) => ({
        acceptedAt: row.acceptedAt,
        acceptedBy: row.acceptedBy,
        acceptedByNickname: row.acceptedBy ? nicknames.get(row.acceptedBy) ?? null : null,
        createdAt: row.createdAt,
        id: row.id,
        requesterId: row.requesterId,
        requesterNickname: nicknames.get(row.requesterId) ?? 'Desconhecido',
        resolvedAt: row.resolvedAt,
        reward: Number(row.reward),
        status: row.status,
        targetId: row.targetId,
        targetNickname: nicknames.get(row.targetId) ?? 'Desconhecido',
      })),
      notifications: notificationRows.map((notification) => ({
        contractId: notification.contractId,
        createdAt: notification.createdAt,
        id: notification.id,
        message: notification.message,
        playerId: notification.playerId,
        title: notification.title,
        type: notification.type,
      })),
    };
  }

  async persistAssassinationExecution(input: PvpPersistAssassinationExecutionInput): Promise<void> {
    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      await executor
        .update(players)
        .set({
          conceito: input.assassin.conceitoAfter,
          hp: input.assassin.hpAfter,
          level: input.assassin.levelAfter,
          money: formatMoney(input.assassin.moneyAfter),
          stamina: input.assassin.staminaAfter,
        })
        .where(eq(players.id, input.assassin.id));

      await executor
        .update(players)
        .set({
          hp: input.target.hpAfter,
          money: formatMoney(input.target.moneyAfter),
        })
        .where(eq(players.id, input.target.id));

      await executor
        .update(assassinationContracts)
        .set({
          acceptedAt: input.contract.acceptedAt,
          acceptedBy: input.contract.acceptedBy,
          resolvedAt: input.contract.resolvedAt,
          status: input.contract.status,
        })
        .where(eq(assassinationContracts.id, input.contract.id));

      if (input.notifications.length > 0) {
        await executor.insert(assassinationContractNotifications).values(input.notifications);
      }
    });
  }

  async persistAssault(input: PvpPersistAssaultInput): Promise<void> {
    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      await executor
        .update(players)
        .set({
          carisma: input.attacker.attributes.carisma,
          conceito: input.attacker.conceitoAfter,
          forca: input.attacker.attributes.forca,
          hp: input.attacker.hpAfter,
          inteligencia: input.attacker.attributes.inteligencia,
          level: input.attacker.levelAfter,
          money: formatMoney(input.attacker.moneyAfter),
          resistencia: input.attacker.attributes.resistencia,
          stamina: input.attacker.staminaAfter,
        })
        .where(eq(players.id, input.attacker.id));

      await executor
        .update(players)
        .set({
          carisma: input.defender.attributes.carisma,
          forca: input.defender.attributes.forca,
          hp: input.defender.hpAfter,
          inteligencia: input.defender.attributes.inteligencia,
          money: formatMoney(input.defender.moneyAfter),
          resistencia: input.defender.attributes.resistencia,
        })
        .where(eq(players.id, input.defender.id));
    });
  }

  async persistAmbush(input: PvpPersistAmbushInput): Promise<void> {
    await db.transaction(async (tx) => {
      const executor = tx as unknown as DatabaseClient;

      for (const attacker of input.attackers) {
        await executor
          .update(players)
          .set({
            conceito: attacker.conceitoAfter,
            hp: attacker.hpAfter,
            level: attacker.levelAfter,
            money: formatMoney(attacker.moneyAfter),
            stamina: attacker.staminaAfter,
          })
          .where(eq(players.id, attacker.id));
      }

      await executor
        .update(players)
        .set({
          hp: input.defender.hpAfter,
          money: formatMoney(input.defender.moneyAfter),
        })
        .where(eq(players.id, input.defender.id));
    });
  }
}

export class PvpService implements PvpServiceContract {
  private readonly combatSystem: CombatSystem;

  private readonly cooldownSystem: CooldownSystem;

  private readonly hospitalizationSystem: OverdoseSystem;

  private readonly keyValueStore: KeyValueStore;

  private readonly levelSystem: LevelSystem;

  private readonly now: () => Date;

  private readonly ownsCooldownSystem: boolean;

  private readonly ownsHospitalizationSystem: boolean;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly policeHeatSystem: PoliceHeatSystem;

  private readonly random: () => number;

  private readonly repository: PvpRepository;

  constructor(options: PvpServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.policeHeatSystem =
      options.policeHeatSystem ??
      new PoliceHeatSystem({
        keyValueStore: this.keyValueStore,
      });
    this.combatSystem =
      options.combatSystem ??
      new CombatSystem({
        factionUpgradeReader: options.factionUpgradeReader,
        policeHeatSystem: this.policeHeatSystem,
        universityReader: options.universityReader,
      });
    this.ownsCooldownSystem = !options.cooldownSystem;
    this.cooldownSystem =
      options.cooldownSystem ??
      new CooldownSystem({
        keyValueStore: this.keyValueStore,
      });
    this.ownsHospitalizationSystem = !options.hospitalizationSystem;
    this.hospitalizationSystem =
      options.hospitalizationSystem ??
      new OverdoseSystem({
        keyValueStore: this.keyValueStore,
      });
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabasePvpRepository();
  }

  async close(): Promise<void> {
    if (this.ownsCooldownSystem) {
      await this.cooldownSystem.close?.();
    }

    if (this.ownsHospitalizationSystem) {
      await this.hospitalizationSystem.close?.();
    }

    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close?.();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async createAssassinationContract(
    requesterId: string,
    targetPlayerId: string,
    reward: number,
  ): Promise<PvpContractCreateResponse> {
    if (requesterId === targetPlayerId) {
      throw new PvpError('validation', 'Nao e permitido colocar contrato em si mesmo.');
    }

    const currentTime = this.now();
    await this.syncExpiredAssassinationContracts(currentTime);

    const normalizedReward = roundMoney(reward);

    if (normalizedReward <= 0) {
      throw new PvpError('validation', 'A recompensa precisa ser maior que zero.');
    }

    const [requester, target, activeContract] = await Promise.all([
      this.combatSystem.getPlayerContext(requesterId),
      this.combatSystem.getPlayerContext(targetPlayerId),
      this.repository.findActiveAssassinationContractForTarget(
        targetPlayerId,
        buildAssassinationExpiryCutoff(currentTime),
      ),
    ]);

    if (!requester || !target) {
      throw new PvpError('not_found', 'Mandante ou alvo nao encontrado.');
    }

    ensureCharacterReady(requester);
    ensureCharacterReady(target);
    ensurePvpInitiationAllowed(requester, currentTime, 'O mandante');
    ensurePvpTargetAllowed(target, currentTime, 'O alvo');

    if (requester.player.level < MIN_ASSASSINATION_REQUEST_LEVEL) {
      throw new PvpError(
        'forbidden',
        `Contratos liberam apenas a partir do nivel ${MIN_ASSASSINATION_REQUEST_LEVEL}.`,
      );
    }

    if (activeContract) {
      throw new PvpError('conflict', 'Esse alvo ja possui um contrato ativo na rua.');
    }

    const fee = resolveAssassinationFee(normalizedReward);
    const totalCost = roundMoney(normalizedReward + fee);

    if (requester.player.resources.money < totalCost) {
      throw new PvpError(
        'insufficient_resources',
        'Dinheiro insuficiente para cobrir recompensa e taxa do contrato.',
      );
    }

    const contract = await this.repository.createAssassinationContract({
      createdAt: currentTime,
      requesterId,
      requesterMoneyAfter: requester.player.resources.money - totalCost,
      reward: normalizedReward,
      targetId: targetPlayerId,
    });

    await this.keyValueStore.delete?.(buildPlayerProfileCacheKey(requesterId));

    return {
      contract: serializeAssassinationContract(
        contract,
        requesterId,
        requester.player.level,
        Boolean(requester.player.characterCreatedAt),
      ),
    };
  }

  async listAssassinationContracts(playerId: string): Promise<PvpAssassinationContractsResponse> {
    const currentTime = this.now();
    await this.syncExpiredAssassinationContracts(currentTime);

    const [viewer, snapshot] = await Promise.all([
      this.combatSystem.getPlayerContext(playerId),
      this.repository.listAssassinationContracts(playerId),
    ]);

    if (!viewer) {
      throw new PvpError('not_found', 'Jogador nao encontrado.');
    }

    const viewerReady = Boolean(viewer.player.characterCreatedAt);
    const contracts = snapshot.contracts.map((contract) =>
      serializeAssassinationContract(contract, playerId, viewer.player.level, viewerReady),
    );

    return {
      acceptedContracts: contracts.filter(
        (contract) => contract.acceptedBy === playerId && contract.status === 'accepted',
      ),
      availableContracts: contracts.filter((contract) => contract.canAccept),
      notifications: snapshot.notifications.map(serializeAssassinationNotification),
      requestedContracts: contracts.filter((contract) => contract.requesterId === playerId),
    };
  }

  async acceptAssassinationContract(
    playerId: string,
    contractId: string,
  ): Promise<PvpContractAcceptResponse> {
    const currentTime = this.now();
    await this.syncExpiredAssassinationContracts(currentTime);

    const [assassin, contract] = await Promise.all([
      this.combatSystem.getPlayerContext(playerId),
      this.repository.findAssassinationContractById(contractId),
    ]);

    if (!assassin) {
      throw new PvpError('not_found', 'Assassino nao encontrado.');
    }

    ensureCharacterReady(assassin);
    ensurePvpInitiationAllowed(assassin, currentTime, 'O assassino');

    if (!contract) {
      throw new PvpError('not_found', 'Contrato nao encontrado.');
    }

    if (assassin.player.level < MIN_ASSASSINATION_ACCEPT_LEVEL) {
      throw new PvpError(
        'forbidden',
        `Aceitar contrato exige nivel ${MIN_ASSASSINATION_ACCEPT_LEVEL} ou superior.`,
      );
    }

    if (contract.requesterId === playerId) {
      throw new PvpError('forbidden', 'O mandante nao pode aceitar o proprio contrato.');
    }

    if (contract.targetId === playerId) {
      throw new PvpError('forbidden', 'O alvo nao pode aceitar o contrato colocado na sua cabeca.');
    }

    if (contract.status === 'completed' || contract.status === 'cancelled' || contract.status === 'expired') {
      throw new PvpError('conflict', 'Esse contrato nao esta mais disponivel.');
    }

    if (contract.status === 'accepted' && contract.acceptedBy && contract.acceptedBy !== playerId) {
      throw new PvpError('conflict', 'Esse contrato ja foi aceito por outro assassino.');
    }

    if (contract.status === 'accepted' && contract.acceptedBy === playerId) {
      throw new PvpError('conflict', 'Esse contrato ja esta aceito por voce.');
    }

    const acceptedContract = await this.repository.acceptAssassinationContract(
      contractId,
      playerId,
      currentTime,
    );

    return {
      contract: serializeAssassinationContract(
        acceptedContract,
        playerId,
        assassin.player.level,
        true,
      ),
    };
  }

  async executeAssassinationContract(
    assassinId: string,
    contractId: string,
  ): Promise<PvpContractExecutionResponse> {
    const currentTime = this.now();
    await this.syncExpiredAssassinationContracts(currentTime);

    const contract = await this.repository.findAssassinationContractById(contractId);

    if (!contract) {
      throw new PvpError('not_found', 'Contrato nao encontrado.');
    }

    if (contract.status !== 'accepted' || contract.acceptedBy !== assassinId) {
      throw new PvpError('forbidden', 'Somente o assassino que aceitou pode executar esse contrato.');
    }

    const [assassin, target] = await Promise.all([
      this.combatSystem.getPlayerContext(assassinId),
      this.combatSystem.getPlayerContext(contract.targetId),
    ]);

    if (!assassin || !target) {
      throw new PvpError('not_found', 'Assassino ou alvo nao encontrado.');
    }

    ensureCharacterReady(assassin);
    ensureCharacterReady(target);
    ensurePvpInitiationAllowed(assassin, currentTime, 'O assassino');
    ensurePvpTargetAllowed(target, currentTime, 'O alvo');

    if (assassin.player.level < MIN_ASSASSINATION_ACCEPT_LEVEL) {
      throw new PvpError(
        'forbidden',
        `Aceitar contrato exige nivel ${MIN_ASSASSINATION_ACCEPT_LEVEL} ou superior.`,
      );
    }

    if (assassin.player.resources.stamina < ASSASSINATION_STAMINA_COST) {
      throw new PvpError(
        'insufficient_resources',
        'Estamina insuficiente para executar o contrato.',
      );
    }

    if (assassin.player.resources.hp <= 0) {
      throw new PvpError('conflict', 'O assassino esta sem HP para a execucao.');
    }

    if (target.player.resources.hp <= 0) {
      throw new PvpError('conflict', 'O alvo ja esta derrubado.');
    }

    if (assassin.player.regionId !== target.player.regionId) {
      throw new PvpError('forbidden', 'Assassino e alvo precisam estar na mesma regiao.');
    }

    const [assassinHospitalization, targetHospitalization, assassinPrisonReleaseAt, targetPrisonReleaseAt] =
      await Promise.all([
        this.hospitalizationSystem.getHospitalizationStatus(assassinId),
        this.hospitalizationSystem.getHospitalizationStatus(target.player.id),
        this.repository.getActivePrisonReleaseAt(assassinId, currentTime),
        this.repository.getActivePrisonReleaseAt(target.player.id, currentTime),
      ]);

    if (assassinHospitalization.isHospitalized) {
      throw new PvpError('conflict', 'Assassino hospitalizado nao pode executar contrato.');
    }

    if (targetHospitalization.isHospitalized) {
      throw new PvpError('conflict', 'O alvo esta hospitalizado.');
    }

    if (assassinPrisonReleaseAt) {
      throw new PvpError('conflict', 'Assassino preso nao pode executar contrato.');
    }

    if (targetPrisonReleaseAt) {
      throw new PvpError('conflict', 'O alvo esta preso.');
    }

    const resolution = await this.combatSystem.resolveCombat({
      attacker: assassin,
      defender: target,
      mode: 'contract',
    });
    const assassinHeatBefore = assassin.player.resources.heat;
    const assassinHeatAfter = await this.policeHeatSystem.addHeat(
      assassinId,
      resolution.attacker.heatDelta,
    );
    const lootAmount = resolution.loot?.amount ?? 0;
    const contractSucceeded = resolution.fatality.defenderDied;
    const rewardPayout = contractSucceeded ? contract.reward : 0;
    const assassinConceitoAfter = Math.max(
      0,
      assassin.player.resources.conceito + resolution.attacker.conceitoDelta,
    );
    const assassinLevelAfter = this.levelSystem.resolve(
      assassinConceitoAfter,
      assassin.player.level,
    ).level;
    const assassinHpAfter = Math.max(LIGHT_HOSPITALIZATION_HP_FLOOR, resolution.attacker.hpAfter);
    const assassinMoneyAfter = roundMoney(
      assassin.player.resources.money + lootAmount + rewardPayout,
    );
    const assassinStaminaAfter = Math.max(
      0,
      assassin.player.resources.stamina - ASSASSINATION_STAMINA_COST,
    );
    const defenderHpAfter =
      resolution.defender.hospitalization.recommended && !contractSucceeded
        ? Math.max(LIGHT_HOSPITALIZATION_HP_FLOOR, resolution.defender.hpAfter)
        : resolution.defender.hpAfter;
    const defenderMoneyAfter = roundMoney(
      Math.max(0, target.player.resources.money - lootAmount),
    );
    const contractStatus: AssassinationContractStatus = contractSucceeded ? 'completed' : 'failed';
    const targetNotified = !contractSucceeded;

    await this.repository.persistAssassinationExecution({
      assassin: {
        conceitoAfter: assassinConceitoAfter,
        hpAfter: assassinHpAfter,
        id: assassinId,
        levelAfter: assassinLevelAfter,
        moneyAfter: assassinMoneyAfter,
        staminaAfter: assassinStaminaAfter,
      },
      contract: {
        acceptedAt: contractSucceeded ? contract.acceptedAt : null,
        acceptedBy: contractSucceeded ? assassinId : null,
        id: contract.id,
        resolvedAt: currentTime,
        status: contractStatus,
      },
      notifications: contractSucceeded
        ? [
            {
              contractId: contract.id,
              createdAt: currentTime,
              message: `O contrato contra ${contract.targetNickname} foi concluido e a recompensa foi paga.`,
              playerId: contract.requesterId,
              title: 'Contrato concluido',
              type: 'completed',
            },
          ]
        : [
            {
              contractId: contract.id,
              createdAt: currentTime,
              message:
                'Uma tentativa de assassinato falhou e a rua confirmou que existe um contrato ativo na sua cabeca.',
              playerId: contract.targetId,
              title: 'Contrato vazado',
              type: 'target_warned',
            },
          ],
      target: {
        hpAfter: defenderHpAfter,
        id: target.player.id,
        moneyAfter: defenderMoneyAfter,
      },
    });

    const hospitalizationTasks: Promise<unknown>[] = [];

    if (resolution.defender.hospitalization.recommended) {
      hospitalizationTasks.push(
        this.hospitalizationSystem.hospitalize(target.player.id, {
          durationMs: resolution.defender.hospitalization.durationMinutes * 60 * 1000,
          reason: 'combat',
        }),
      );
    }

    if (resolution.attacker.hospitalization.recommended) {
      hospitalizationTasks.push(
        this.hospitalizationSystem.hospitalize(assassinId, {
          durationMs: resolution.attacker.hospitalization.durationMinutes * 60 * 1000,
          reason: 'combat',
        }),
      );
    }

    await Promise.all([
      ...hospitalizationTasks,
      this.keyValueStore.delete?.(buildPlayerProfileCacheKey(assassinId)),
      this.keyValueStore.delete?.(buildPlayerProfileCacheKey(target.player.id)),
    ]);

    const serializedContract = serializeAssassinationContract(
      {
        ...contract,
        acceptedAt: contractSucceeded ? contract.acceptedAt : null,
        acceptedBy: contractSucceeded ? assassinId : null,
        acceptedByNickname: contractSucceeded ? assassin.player.nickname : null,
        resolvedAt: currentTime,
        status: contractStatus,
      },
      assassinId,
      assassin.player.level,
      true,
    );

    return {
      assassin: {
        conceitoDelta: resolution.attacker.conceitoDelta,
        heatAfter: assassinHeatAfter.score,
        heatBefore: assassinHeatBefore,
        heatDelta: resolution.attacker.heatDelta,
        hospitalization: resolution.attacker.hospitalization,
        hpAfter: assassinHpAfter,
        hpBefore: assassin.player.resources.hp,
        hpDelta: assassinHpAfter - assassin.player.resources.hp,
        id: assassin.player.id,
        moneyAfter: assassinMoneyAfter,
        moneyBefore: assassin.player.resources.money,
        moneyDelta: roundMoney(lootAmount + rewardPayout),
        nickname: assassin.player.nickname,
        staminaAfter: assassinStaminaAfter,
        staminaBefore: assassin.player.resources.stamina,
        staminaDelta: assassinStaminaAfter - assassin.player.resources.stamina,
      },
      contract: serializedContract,
      defender: {
        hospitalization: resolution.defender.hospitalization,
        hpAfter: defenderHpAfter,
        hpBefore: target.player.resources.hp,
        hpDelta: defenderHpAfter - target.player.resources.hp,
        id: target.player.id,
        moneyAfter: defenderMoneyAfter,
        moneyBefore: target.player.resources.money,
        moneyDelta: defenderMoneyAfter - target.player.resources.money,
        nickname: target.player.nickname,
        prisonFollowUpChance: resolution.defender.prisonFollowUpChance,
      },
      fatality: resolution.fatality,
      loot: resolution.loot,
      message: resolution.message,
      mode: 'contract',
      powerRatio: resolution.powerRatio,
      success: contractSucceeded,
      targetNotified,
      tier: resolution.tier,
    };
  }

  async attemptAssault(attackerId: string, targetPlayerId: string): Promise<PvpAssaultResponse> {
    if (attackerId === targetPlayerId) {
      throw new PvpError('validation', 'Nao e permitido atacar o proprio personagem.');
    }

    const [attacker, defender] = await Promise.all([
      this.combatSystem.getPlayerContext(attackerId),
      this.combatSystem.getPlayerContext(targetPlayerId),
    ]);

    if (!attacker || !defender) {
      throw new PvpError('not_found', 'Atacante ou alvo nao encontrado.');
    }

    ensureCharacterReady(attacker);
    ensureCharacterReady(defender);

    if (attacker.player.level < MIN_ASSAULT_LEVEL) {
      throw new PvpError(
        'forbidden',
        `PvP desbloqueia apenas a partir do nivel ${MIN_ASSAULT_LEVEL}.`,
      );
    }

    if (attacker.player.resources.stamina < ASSAULT_STAMINA_COST) {
      throw new PvpError('insufficient_resources', 'Estamina insuficiente para iniciar a porrada.');
    }

    if (attacker.player.resources.hp <= 0) {
      throw new PvpError('forbidden', 'O atacante esta sem HP para entrar em combate.');
    }

    if (defender.player.resources.hp <= 0) {
      throw new PvpError('conflict', 'Combate indisponivel com personagem derrubado.');
    }

    if (attacker.factionId && defender.factionId && attacker.factionId === defender.factionId) {
      throw new PvpError('forbidden', 'Nao e permitido atacar membro da propria faccao.');
    }

    const currentTime = this.now();
    ensurePvpInitiationAllowed(attacker, currentTime, 'O atacante');
    ensurePvpTargetAllowed(defender, currentTime, 'O alvo');
    const [attackerHospitalization, defenderHospitalization, attackerPrisonReleaseAt, defenderPrisonReleaseAt] =
      await Promise.all([
        this.hospitalizationSystem.getHospitalizationStatus(attackerId),
        this.hospitalizationSystem.getHospitalizationStatus(targetPlayerId),
        this.repository.getActivePrisonReleaseAt(attackerId, currentTime),
        this.repository.getActivePrisonReleaseAt(targetPlayerId, currentTime),
      ]);

    if (attackerHospitalization.isHospitalized) {
      throw new PvpError('conflict', 'Atacante hospitalizado nao pode iniciar combate.');
    }

    if (defenderHospitalization.isHospitalized) {
      throw new PvpError('conflict', 'O alvo esta hospitalizado.');
    }

    if (attackerPrisonReleaseAt) {
      throw new PvpError('conflict', 'Atacante preso nao pode iniciar combate.');
    }

    if (defenderPrisonReleaseAt) {
      throw new PvpError('conflict', 'O alvo esta preso.');
    }

    if (attacker.player.regionId !== defender.player.regionId) {
      throw new PvpError('forbidden', 'Atacante e alvo precisam estar na mesma regiao.');
    }

    const cooldownKey = buildAssaultCooldownId(targetPlayerId);
    const cooldown = await this.cooldownSystem.getCrimeCooldown(attackerId, cooldownKey);

    if (cooldown.active) {
      throw new PvpError(
        'cooldown_active',
        `Esse alvo ja foi atacado recentemente. Aguarde ${cooldown.remainingSeconds}s.`,
      );
    }

    const attackerHeatBefore = attacker.player.resources.heat;
    const resolution = await this.combatSystem.resolveCombat({
      attacker,
      defender,
      mode: 'assault',
    });

    const attackerConceitoAfter = Math.max(
      0,
      attacker.player.resources.conceito + resolution.attacker.conceitoDelta,
    );
    const attackerHeatAfter = await this.policeHeatSystem.addHeat(attackerId, resolution.attacker.heatDelta);
    const attackerLevelAfter = this.levelSystem.resolve(
      attackerConceitoAfter,
      attacker.player.level,
    ).level;
    const lootAmount = resolution.loot?.amount ?? 0;
    const attributeSteal = resolution.attributeSteal;
    const attackerAttributes = { ...attacker.attributes };
    const defenderAttributes = { ...defender.attributes };

    if (attributeSteal) {
      attackerAttributes[attributeSteal.attribute] += attributeSteal.amount;
      defenderAttributes[attributeSteal.attribute] = Math.max(
        0,
        defenderAttributes[attributeSteal.attribute] - attributeSteal.amount,
      );
    }

    const defenderHpAfter =
      resolution.defender.hospitalization.recommended && !resolution.fatality.defenderDied
        ? Math.max(LIGHT_HOSPITALIZATION_HP_FLOOR, resolution.defender.hpAfter)
        : resolution.defender.hpAfter;
    const attackerHpAfter = Math.max(LIGHT_HOSPITALIZATION_HP_FLOOR, resolution.attacker.hpAfter);
    const attackerMoneyAfter = roundMoney(attacker.player.resources.money + lootAmount);
    const defenderMoneyAfter = roundMoney(
      Math.max(0, defender.player.resources.money - lootAmount),
    );
    const attackerStaminaAfter = Math.max(
      0,
      attacker.player.resources.stamina - ASSAULT_STAMINA_COST,
    );

    await this.repository.persistAssault({
      attacker: {
        attributes: attackerAttributes,
        conceitoAfter: attackerConceitoAfter,
        hpAfter: attackerHpAfter,
        id: attackerId,
        levelAfter: attackerLevelAfter,
        moneyAfter: attackerMoneyAfter,
        staminaAfter: attackerStaminaAfter,
      },
      defender: {
        attributes: defenderAttributes,
        hpAfter: defenderHpAfter,
        id: targetPlayerId,
        moneyAfter: defenderMoneyAfter,
      },
    });

    if (resolution.defender.hospitalization.recommended) {
      await this.hospitalizationSystem.hospitalize(targetPlayerId, {
        durationMs: resolution.defender.hospitalization.durationMinutes * 60 * 1000,
        reason: 'combat',
      });
    }

    await Promise.all([
      this.cooldownSystem.activateCrimeCooldown(attackerId, cooldownKey, ASSAULT_COOLDOWN_SECONDS),
      this.keyValueStore.delete?.(buildPlayerProfileCacheKey(attackerId)),
      this.keyValueStore.delete?.(buildPlayerProfileCacheKey(targetPlayerId)),
    ]);

    return {
      attacker: {
        conceitoDelta: resolution.attacker.conceitoDelta,
        heatAfter: attackerHeatAfter.score,
        heatBefore: attackerHeatBefore,
        heatDelta: resolution.attacker.heatDelta,
        hospitalization: resolution.attacker.hospitalization,
        hpAfter: attackerHpAfter,
        hpBefore: attacker.player.resources.hp,
        hpDelta: attackerHpAfter - attacker.player.resources.hp,
        id: attacker.player.id,
        moneyAfter: attackerMoneyAfter,
        moneyBefore: attacker.player.resources.money,
        moneyDelta: lootAmount,
        nickname: attacker.player.nickname,
        staminaAfter: attackerStaminaAfter,
        staminaBefore: attacker.player.resources.stamina,
        staminaDelta: attackerStaminaAfter - attacker.player.resources.stamina,
      },
      attributeSteal,
      defender: {
        hospitalization: resolution.defender.hospitalization,
        hpAfter: defenderHpAfter,
        hpBefore: defender.player.resources.hp,
        hpDelta: defenderHpAfter - defender.player.resources.hp,
        id: defender.player.id,
        moneyAfter: defenderMoneyAfter,
        moneyBefore: defender.player.resources.money,
        moneyDelta: defenderMoneyAfter - defender.player.resources.money,
        nickname: defender.player.nickname,
        prisonFollowUpChance: resolution.defender.prisonFollowUpChance,
      },
      fatality: resolution.fatality,
      loot: resolution.loot,
      message: resolution.message,
      mode: 'assault',
      powerRatio: resolution.powerRatio,
      success: resolution.success,
      targetCooldownSeconds: ASSAULT_COOLDOWN_SECONDS,
      tier: resolution.tier,
    };
  }

  async attemptAmbush(
    initiatorId: string,
    targetPlayerId: string,
    participantIds: string[],
  ): Promise<PvpAmbushResponse> {
    if (initiatorId === targetPlayerId) {
      throw new PvpError('validation', 'Nao e permitido emboscar o proprio personagem.');
    }

    if (!Array.isArray(participantIds)) {
      throw new PvpError('validation', 'Lista de participantes invalida.');
    }

    const normalizedParticipantIds = participantIds.map((participantId) => participantId.trim());

    if (normalizedParticipantIds.some((participantId) => participantId.length === 0)) {
      throw new PvpError('validation', 'Todos os participantes precisam ter um id valido.');
    }

    const uniqueParticipantIds = Array.from(new Set(normalizedParticipantIds));

    if (uniqueParticipantIds.length !== normalizedParticipantIds.length) {
      throw new PvpError('validation', 'Nao e permitido repetir participantes na emboscada.');
    }

    if (uniqueParticipantIds.includes(initiatorId)) {
      throw new PvpError('validation', 'O iniciador ja participa automaticamente da emboscada.');
    }

    if (uniqueParticipantIds.includes(targetPlayerId)) {
      throw new PvpError('validation', 'O alvo nao pode entrar na propria emboscada.');
    }

    const attackerIds = [initiatorId, ...uniqueParticipantIds];

    if (attackerIds.length < AMBUSH_MIN_ATTACKERS || attackerIds.length > AMBUSH_MAX_ATTACKERS) {
      throw new PvpError(
        'validation',
        `Emboscada exige entre ${AMBUSH_MIN_ATTACKERS} e ${AMBUSH_MAX_ATTACKERS} membros.`,
      );
    }

    const [defender, attackerContexts, memberships] = await Promise.all([
      this.combatSystem.getPlayerContext(targetPlayerId),
      Promise.all(attackerIds.map((attackerId) => this.combatSystem.getPlayerContext(attackerId))),
      this.repository.getFactionCombatMemberships(attackerIds),
    ]);

    if (!defender) {
      throw new PvpError('not_found', 'Alvo nao encontrado.');
    }

    if (attackerContexts.some((attacker) => !attacker)) {
      throw new PvpError('not_found', 'Um dos participantes nao foi encontrado.');
    }

    ensureCharacterReady(defender);

    const attackers = attackerContexts.map((attacker, index) => {
      const context = attacker as CombatPlayerContext;
      const membership = memberships.get(context.player.id);

      ensureCharacterReady(context);

      if (!membership) {
        throw new PvpError('forbidden', 'Todos os participantes precisam pertencer a uma faccao.');
      }

      return {
        context,
        isInitiator: index === 0,
        membership,
      };
    });

    const initiator = attackers[0];

    if (!initiator) {
      throw new PvpError('validation', 'Emboscada exige pelo menos dois participantes validos.');
    }

    const currentTime = this.now();
    ensurePvpTargetAllowed(defender, currentTime, 'O alvo');

    if (!isRankAtLeast(initiator.membership.rank, 'gerente')) {
      throw new PvpError(
        'forbidden',
        'Apenas gerente, general ou patrao podem iniciar uma emboscada.',
      );
    }

    for (const attacker of attackers) {
      ensurePvpInitiationAllowed(attacker.context, currentTime, attacker.isInitiator ? 'O iniciador' : attacker.context.player.nickname);

      if (!isRankAtLeast(attacker.membership.rank, 'soldado')) {
        throw new PvpError(
          'forbidden',
          'Somente soldado ou superior podem participar da emboscada.',
        );
      }

      if (attacker.membership.factionId !== initiator.membership.factionId) {
        throw new PvpError(
          'forbidden',
          'Todos os participantes da emboscada precisam estar na mesma faccao.',
        );
      }
    }

    if (defender.factionId && defender.factionId === initiator.membership.factionId) {
      throw new PvpError('forbidden', 'Nao e permitido emboscar membro da propria faccao.');
    }

    if (defender.player.resources.hp <= 0) {
      throw new PvpError('conflict', 'O alvo ja esta derrubado.');
    }

    const hospitalizations = await Promise.all([
      this.hospitalizationSystem.getHospitalizationStatus(targetPlayerId),
      ...attackers.map((attacker) =>
        this.hospitalizationSystem.getHospitalizationStatus(attacker.context.player.id),
      ),
    ]);
    const prisonRecords = await Promise.all([
      this.repository.getActivePrisonReleaseAt(targetPlayerId, currentTime),
      ...attackers.map((attacker) =>
        this.repository.getActivePrisonReleaseAt(attacker.context.player.id, currentTime),
      ),
    ]);

    if (hospitalizations[0].isHospitalized) {
      throw new PvpError('conflict', 'O alvo esta hospitalizado.');
    }

    if (prisonRecords[0]) {
      throw new PvpError('conflict', 'O alvo esta preso.');
    }

    for (const [index, attacker] of attackers.entries()) {
      const hospitalization = hospitalizations[index + 1];
      const prisonReleaseAt = prisonRecords[index + 1];

      if (hospitalization?.isHospitalized) {
        throw new PvpError(
          'conflict',
          `${attacker.context.player.nickname} esta hospitalizado e nao pode participar da emboscada.`,
        );
      }

      if (prisonReleaseAt) {
        throw new PvpError(
          'conflict',
          `${attacker.context.player.nickname} esta preso e nao pode participar da emboscada.`,
        );
      }

      if (attacker.context.player.regionId !== defender.player.regionId) {
        throw new PvpError(
          'forbidden',
          'Todos os participantes precisam estar na mesma regiao do alvo.',
        );
      }

      if (attacker.context.player.resources.hp <= 0) {
        throw new PvpError(
          'conflict',
          `${attacker.context.player.nickname} esta sem HP para participar da emboscada.`,
        );
      }

      if (attacker.context.player.resources.stamina < AMBUSH_STAMINA_COST) {
        throw new PvpError(
          'insufficient_resources',
          `${attacker.context.player.nickname} nao tem estamina para a emboscada.`,
        );
      }
    }

    const cooldownKey = buildAmbushCooldownId();
    const cooldown = await this.cooldownSystem.getCrimeCooldown(targetPlayerId, cooldownKey);

    if (cooldown.active) {
      throw new PvpError(
        'cooldown_active',
        `Esse alvo ja sofreu emboscada recentemente. Aguarde ${cooldown.remainingSeconds}s.`,
      );
    }

    const powerProfiles = await Promise.all(
      attackers.map((attacker) => this.combatSystem.calculatePlayerPower(attacker.context, 'ambush')),
    );
    const preparedAttackers: PreparedAmbushAttacker[] = attackers.map((attacker, index) => ({
      ...attacker,
      powerProfile: powerProfiles[index] ?? {
        breakdown: {
          attributePower: 0,
          equipmentPower: 0,
          factionMultiplier: 1,
          total: 0,
          universityMultiplier: 1,
          vocationMultiplier: 1,
        },
        power: 0,
      },
    }));
    const basePower = preparedAttackers.reduce((total, attacker) => total + attacker.powerProfile.power, 0);
    const groupPower = await this.combatSystem.calculateAmbushPower(
      preparedAttackers.map((attacker) => attacker.context),
    );
    const coordinationMultiplier = basePower > 0 ? roundValue(groupPower / basePower) : 1;
    const resolution = await this.combatSystem.resolveCombat({
      attacker: initiator.context,
      attackerPower: groupPower,
      defender,
      mode: 'ambush',
    });

    const lootAmount = resolution.loot?.amount ?? 0;
    const lootShares = distributeMoneyByWeight(
      lootAmount,
      preparedAttackers.map((attacker) => attacker.powerProfile.power),
    );
    const conceitoShares = distributeIntegerEvenly(
      Math.max(0, resolution.attacker.conceitoDelta),
      preparedAttackers.length,
    );
    const attackerHeatUpdates = await Promise.all(
      preparedAttackers.map((attacker) =>
        this.policeHeatSystem.addHeat(attacker.context.player.id, resolution.attacker.heatDelta),
      ),
    );
    const casualtyIds =
      resolution.tier === 'hard_fail' && resolution.powerRatio < 0.85
        ? selectAmbushCasualties(
            preparedAttackers,
            resolveAmbushCasualtyCount(preparedAttackers.length, this.random()),
            this.random,
          )
        : new Set<string>();

    const persistedAttackers = preparedAttackers.map((attacker, index) => {
      const lootShare = lootShares[index] ?? 0;
      const conceitoShare = conceitoShares[index] ?? 0;
      const isCasualty = casualtyIds.has(attacker.context.player.id);
      const staminaAfter = Math.max(
        0,
        attacker.context.player.resources.stamina - AMBUSH_STAMINA_COST,
      );
      const hpAfter = isCasualty
        ? Math.max(
            LIGHT_HOSPITALIZATION_HP_FLOOR,
            attacker.context.player.resources.hp + resolution.attacker.hpDelta,
          )
        : attacker.context.player.resources.hp;
      const moneyAfter = roundMoney(attacker.context.player.resources.money + lootShare);
      const conceitoAfter = Math.max(
        0,
        attacker.context.player.resources.conceito + conceitoShare,
      );
      const levelAfter = this.levelSystem.resolve(conceitoAfter, attacker.context.player.level).level;
      const hospitalization = isCasualty
        ? resolution.attacker.hospitalization
        : {
            durationMinutes: 0,
            recommended: false,
            severity: 'none' as const,
          };

      return {
        conceitoAfter,
        conceitoBefore: attacker.context.player.resources.conceito,
        conceitoDelta: conceitoShare,
        heatAfter: attackerHeatUpdates[index]?.score ?? attacker.context.player.resources.heat,
        heatBefore: attacker.context.player.resources.heat,
        heatDelta: resolution.attacker.heatDelta,
        hospitalization,
        hpAfter,
        hpBefore: attacker.context.player.resources.hp,
        hpDelta: hpAfter - attacker.context.player.resources.hp,
        id: attacker.context.player.id,
        isInitiator: attacker.isInitiator,
        levelAfter,
        moneyAfter,
        moneyBefore: attacker.context.player.resources.money,
        moneyDelta: lootShare,
        nickname: attacker.context.player.nickname,
        power: attacker.powerProfile.power,
        powerSharePercent: basePower > 0 ? roundValue(attacker.powerProfile.power / basePower) : 0,
        rank: attacker.membership.rank,
        staminaAfter,
        staminaBefore: attacker.context.player.resources.stamina,
        staminaDelta: staminaAfter - attacker.context.player.resources.stamina,
      };
    });

    const defenderHpAfter =
      resolution.defender.hospitalization.recommended && !resolution.fatality.defenderDied
        ? Math.max(LIGHT_HOSPITALIZATION_HP_FLOOR, resolution.defender.hpAfter)
        : resolution.defender.hpAfter;
    const defenderMoneyAfter = roundMoney(
      Math.max(0, defender.player.resources.money - lootAmount),
    );

    await this.repository.persistAmbush({
      attackers: persistedAttackers.map((attacker) => ({
        conceitoAfter: attacker.conceitoAfter,
        hpAfter: attacker.hpAfter,
        id: attacker.id,
        levelAfter: attacker.levelAfter,
        moneyAfter: attacker.moneyAfter,
        staminaAfter: attacker.staminaAfter,
      })),
      defender: {
        hpAfter: defenderHpAfter,
        id: targetPlayerId,
        moneyAfter: defenderMoneyAfter,
      },
    });

    if (resolution.defender.hospitalization.recommended) {
      await this.hospitalizationSystem.hospitalize(targetPlayerId, {
        durationMs: resolution.defender.hospitalization.durationMinutes * 60 * 1000,
        reason: 'combat',
      });
    }

    await Promise.all([
      ...persistedAttackers
        .filter((attacker) => attacker.hospitalization.recommended)
        .map((attacker) =>
          this.hospitalizationSystem.hospitalize(attacker.id, {
            durationMs: attacker.hospitalization.durationMinutes * 60 * 1000,
            reason: 'combat',
          }),
        ),
      this.cooldownSystem.activateCrimeCooldown(targetPlayerId, cooldownKey, AMBUSH_COOLDOWN_SECONDS),
      this.keyValueStore.delete?.(buildPlayerProfileCacheKey(targetPlayerId)),
      ...persistedAttackers.map((attacker) =>
        this.keyValueStore.delete?.(buildPlayerProfileCacheKey(attacker.id)),
      ),
    ]);

    return {
      attackers: persistedAttackers.map((attacker) => ({
        conceitoAfter: attacker.conceitoAfter,
        conceitoBefore: attacker.conceitoBefore,
        conceitoDelta: attacker.conceitoDelta,
        heatAfter: attacker.heatAfter,
        heatBefore: attacker.heatBefore,
        heatDelta: attacker.heatDelta,
        hospitalization: attacker.hospitalization,
        hpAfter: attacker.hpAfter,
        hpBefore: attacker.hpBefore,
        hpDelta: attacker.hpDelta,
        id: attacker.id,
        isInitiator: attacker.isInitiator,
        moneyAfter: attacker.moneyAfter,
        moneyBefore: attacker.moneyBefore,
        moneyDelta: attacker.moneyDelta,
        nickname: attacker.nickname,
        power: attacker.power,
        powerSharePercent: attacker.powerSharePercent,
        rank: attacker.rank,
        staminaAfter: attacker.staminaAfter,
        staminaBefore: attacker.staminaBefore,
        staminaDelta: attacker.staminaDelta,
      })),
      coordinationMultiplier,
      defender: {
        hospitalization: resolution.defender.hospitalization,
        hpAfter: defenderHpAfter,
        hpBefore: defender.player.resources.hp,
        hpDelta: defenderHpAfter - defender.player.resources.hp,
        id: defender.player.id,
        moneyAfter: defenderMoneyAfter,
        moneyBefore: defender.player.resources.money,
        moneyDelta: defenderMoneyAfter - defender.player.resources.money,
        nickname: defender.player.nickname,
        prisonFollowUpChance: resolution.defender.prisonFollowUpChance,
      },
      fatality: resolution.fatality,
      groupPower,
      loot: resolution.loot,
      message: resolution.message,
      mode: 'ambush',
      powerRatio: resolution.powerRatio,
      success: resolution.success,
      targetCooldownSeconds: AMBUSH_COOLDOWN_SECONDS,
      tier: resolution.tier,
    };
  }

  private async syncExpiredAssassinationContracts(currentTime: Date): Promise<void> {
    await this.repository.expireAssassinationContracts(
      currentTime,
      buildAssassinationExpiryCutoff(currentTime),
    );
  }
}

function buildAssassinationExpiryCutoff(currentTime: Date): Date {
  return new Date(
    currentTime.getTime() - ASSASSINATION_CONTRACT_DURATION_HOURS * 60 * 60 * 1000,
  );
}

function buildAssassinationExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() + ASSASSINATION_CONTRACT_DURATION_HOURS * 60 * 60 * 1000,
  );
}

function ensurePvpInitiationAllowed(
  player: CombatPlayerContext,
  currentTime: Date,
  actorLabel: string,
): void {
  if (isUnderNoviceProtection(player.player.characterCreatedAt, currentTime)) {
    throw new PvpError(
      'forbidden',
      `${actorLabel} ainda esta sob protecao de novato e nao pode iniciar PvP.`,
    );
  }
}

function ensurePvpTargetAllowed(
  player: CombatPlayerContext,
  currentTime: Date,
  actorLabel: string,
): void {
  if (isUnderNoviceProtection(player.player.characterCreatedAt, currentTime)) {
    throw new PvpError('forbidden', `${actorLabel} esta sob protecao de novato.`);
  }
}

function isUnderNoviceProtection(
  characterCreatedAt: Date | null,
  currentTime: Date,
): boolean {
  if (!characterCreatedAt) {
    return false;
  }

  return (
    currentTime.getTime() - characterCreatedAt.getTime() <
    NOVICE_PROTECTION_DURATION_HOURS * 60 * 60 * 1000
  );
}

function buildAmbushCooldownId(): string {
  return 'pvp-ambush-target-lock';
}

function buildAssaultCooldownId(targetPlayerId: string): string {
  return `pvp-assault:${targetPlayerId}`;
}

function resolveAssassinationFee(reward: number): number {
  return roundMoney(reward * ASSASSINATION_CONTRACT_FEE_RATE);
}

function serializeAssassinationContract(
  contract: AssassinationContractRecord,
  viewerId: string,
  viewerLevel: number,
  viewerReady: boolean,
): AssassinationContractSummary {
  const expiresAt = buildAssassinationExpiresAt(contract.createdAt);
  const fee = resolveAssassinationFee(contract.reward);
  const canAccept =
    viewerReady &&
    viewerLevel >= MIN_ASSASSINATION_ACCEPT_LEVEL &&
    contract.requesterId !== viewerId &&
    contract.targetId !== viewerId &&
    !contract.acceptedBy &&
    (contract.status === 'open' || contract.status === 'failed');

  return {
    acceptedAt: contract.acceptedAt?.toISOString() ?? null,
    acceptedBy: contract.acceptedBy,
    acceptedByNickname: contract.acceptedByNickname,
    canAccept,
    createdAt: contract.createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fee,
    id: contract.id,
    isTarget: contract.targetId === viewerId,
    requesterId: contract.requesterId,
    requesterNickname: contract.requesterNickname,
    reward: contract.reward,
    status: contract.status,
    targetId: contract.targetId,
    targetNickname: contract.targetNickname,
    totalCost: roundMoney(contract.reward + fee),
  };
}

function serializeAssassinationNotification(
  notification: AssassinationContractNotificationRecord,
): AssassinationContractNotification {
  return {
    contractId: notification.contractId,
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    message: notification.message,
    title: notification.title,
    type: notification.type,
  };
}

function distributeIntegerEvenly(total: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }

  const base = Math.floor(total / count);
  let remainder = total % count;

  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return value;
  });
}

function distributeMoneyByWeight(total: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const totalCents = Math.round(Math.max(0, total) * 100);
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);

  if (totalCents <= 0) {
    return weights.map(() => 0);
  }

  if (totalWeight <= 0) {
    const evenCents = distributeIntegerEvenly(totalCents, weights.length);
    return evenCents.map((value) => value / 100);
  }

  let distributed = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return (totalCents - distributed) / 100;
    }

    const cents = Math.floor((totalCents * Math.max(0, weight)) / totalWeight);
    distributed += cents;
    return cents / 100;
  });
}

function ensureCharacterReady(player: CombatPlayerContext) {
  if (!player.player.characterCreatedAt) {
    throw new PvpError('character_not_ready', 'Crie o personagem antes de entrar em PvP.');
  }
}

function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

function getFactionRankScore(rank: FactionRank): number {
  return PVP_RANK_ORDER.length - PVP_RANK_ORDER.indexOf(rank);
}

function isRankAtLeast(rank: FactionRank, minimumRank: FactionRank): boolean {
  return getFactionRankScore(rank) >= getFactionRankScore(minimumRank);
}

function resolveAmbushCasualtyCount(participantCount: number, roll: number): number {
  if (participantCount <= 2) {
    return 1;
  }

  return roll >= 0.5 ? 2 : 1;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundValue(value: number): number {
  return Number(value.toFixed(2));
}

function selectAmbushCasualties(
  attackers: PreparedAmbushAttacker[],
  count: number,
  random: () => number,
): Set<string> {
  const pool = [...attackers];
  const selected = new Set<string>();

  while (selected.size < count && pool.length > 0) {
    const roll = Math.min(Math.max(random(), 0), 0.999999);
    const index = Math.floor(roll * pool.length);
    const [attacker] = pool.splice(index, 1);

    if (attacker) {
      selected.add(attacker.context.player.id);
    }
  }

  return selected;
}
