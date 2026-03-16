import {
  TRAINING_ATTRIBUTE_WEIGHTS,
  TRAINING_BASE_ATTRIBUTE_POINTS,
  TRAINING_DEFINITIONS,
  TRAINING_DIMINISH_STEP,
  TRAINING_MIN_MULTIPLIER,
  TRAINING_REST_WINDOW_MS,
  type PlayerAttributes,
  type TrainingCatalogItem,
  type TrainingCenterResponse,
  type TrainingClaimResponse,
  type TrainingDefinitionSummary,
  type TrainingSessionSummary,
  type TrainingStartInput,
  type TrainingStartResponse,
  type TrainingType,
  type UniversityCourseSummary,
} from '@cs-rio/shared';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { players, trainingSessions } from '../db/schema.js';
import {
  AuthError,
  type AuthPlayerRecord,
  RedisKeyValueStore,
  type KeyValueStore,
  toPlayerSummary,
} from './auth.js';
import {
  buildNpcInflationSummary,
  DatabaseNpcInflationReader,
  inflateNpcMoney,
  type NpcInflationProfile,
  type NpcInflationReaderContract,
} from './npc-inflation.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { PrisonSystem, type PrisonSystemContract } from '../systems/PrisonSystem.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';
import {
  assertPlayerActionUnlocked,
  type HospitalizationStatusReaderContract,
} from './action-readiness.js';

export interface TrainingRepository {
  claimTrainingSession(
    playerId: string,
    sessionId: string,
    claimedAt: Date,
  ): Promise<TrainingMutationRecord | null>;
  countClaimedSessions(playerId: string, type: TrainingType): Promise<number>;
  createTrainingSession(
    playerId: string,
    input: TrainingSessionCreateInput,
  ): Promise<TrainingMutationRecord | null>;
  getPlayer(playerId: string): Promise<AuthPlayerRecord | null>;
  getTrainingSession(playerId: string, sessionId: string): Promise<TrainingSessionRecord | null>;
  getUnclaimedTrainingSession(playerId: string): Promise<TrainingSessionRecord | null>;
  getLatestClaimedTrainingSession(playerId: string): Promise<TrainingSessionRecord | null>;
}

export interface TrainingServiceOptions {
  inflationReader?: NpcInflationReaderContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  overdoseSystem?: HospitalizationStatusReaderContract;
  prisonSystem?: PrisonSystemContract;
  repository?: TrainingRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface TrainingServiceContract {
  close?(): Promise<void>;
  claimTraining(playerId: string, sessionId: string): Promise<TrainingClaimResponse>;
  getTrainingCenter(playerId: string): Promise<TrainingCenterResponse>;
  startTraining(playerId: string, input: TrainingStartInput): Promise<TrainingStartResponse>;
}

interface TrainingSessionCreateInput {
  costMoney: number;
  costCansaco: number;
  diminishingMultiplier: number;
  endsAt: Date;
  gains: PlayerAttributes;
  startedAt: Date;
  streakIndex: number;
  type: TrainingType;
}

interface TrainingMutationRecord {
  player: AuthPlayerRecord;
  session: TrainingSessionRecord;
}

type TrainingErrorCode =
  | 'action_locked'
  | 'character_not_ready'
  | 'insufficient_resources'
  | 'not_found'
  | 'too_early_claim'
  | 'training_in_progress'
  | 'training_locked'
  | 'training_ready_to_claim'
  | 'validation';

export class TrainingError extends Error {
  constructor(
    public readonly code: TrainingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TrainingError';
  }
}

type TrainingSessionRecord = typeof trainingSessions.$inferSelect;

export class DatabaseTrainingRepository implements TrainingRepository {
  async claimTrainingSession(
    playerId: string,
    sessionId: string,
    claimedAt: Date,
  ): Promise<TrainingMutationRecord | null> {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.id, sessionId),
            eq(trainingSessions.playerId, playerId),
            isNull(trainingSessions.claimedAt),
          ),
        )
        .limit(1);

      if (!session) {
        return null;
      }

      const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1);

      if (!player) {
        return null;
      }

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          carisma: player.carisma + session.carismaGain,
          forca: player.forca + session.forcaGain,
          inteligencia: player.inteligencia + session.inteligenciaGain,
          resistencia: player.resistencia + session.resistenciaGain,
        })
        .where(eq(players.id, playerId))
        .returning();

      const [updatedSession] = await tx
        .update(trainingSessions)
        .set({
          claimedAt,
        })
        .where(eq(trainingSessions.id, sessionId))
        .returning();

      if (!updatedPlayer || !updatedSession) {
        return null;
      }

      return {
        player: updatedPlayer,
        session: updatedSession,
      };
    });
  }

  async countClaimedSessions(playerId: string, type: TrainingType): Promise<number> {
    const rows = await db
      .select({
        id: trainingSessions.id,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.playerId, playerId),
          eq(trainingSessions.type, type),
          isNotNull(trainingSessions.claimedAt),
        ),
      );

    return rows.length;
  }

  async createTrainingSession(
    playerId: string,
    input: TrainingSessionCreateInput,
  ): Promise<TrainingMutationRecord | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1);

      if (!player) {
        return null;
      }

      const nextMoney = roundMoney(Number.parseFloat(player.money) - input.costMoney);
      const nextCansaco = player.cansaco - input.costCansaco;

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          money: nextMoney.toFixed(2),
          cansaco: nextCansaco,
        })
        .where(eq(players.id, playerId))
        .returning();

      const [session] = await tx
        .insert(trainingSessions)
        .values({
          carismaGain: input.gains.carisma,
          costMoney: input.costMoney.toFixed(2),
          costCansaco: input.costCansaco,
          diminishingMultiplier: input.diminishingMultiplier.toFixed(4),
          endsAt: input.endsAt,
          forcaGain: input.gains.forca,
          inteligenciaGain: input.gains.inteligencia,
          playerId,
          resistenciaGain: input.gains.resistencia,
          startedAt: input.startedAt,
          streakIndex: input.streakIndex,
          type: input.type,
        })
        .returning();

      if (!updatedPlayer || !session) {
        return null;
      }

      return {
        player: updatedPlayer,
        session,
      };
    });
  }

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    return player ?? null;
  }

  async getTrainingSession(playerId: string, sessionId: string): Promise<TrainingSessionRecord | null> {
    const [session] = await db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.id, sessionId), eq(trainingSessions.playerId, playerId)))
      .limit(1);

    return session ?? null;
  }

  async getUnclaimedTrainingSession(playerId: string): Promise<TrainingSessionRecord | null> {
    const [session] = await db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.playerId, playerId), isNull(trainingSessions.claimedAt)))
      .orderBy(desc(trainingSessions.startedAt))
      .limit(1);

    return session ?? null;
  }

  async getLatestClaimedTrainingSession(playerId: string): Promise<TrainingSessionRecord | null> {
    const [session] = await db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.playerId, playerId), isNotNull(trainingSessions.claimedAt)))
      .orderBy(desc(trainingSessions.endsAt))
      .limit(1);

    return session?.claimedAt ? session : null;
  }
}

export class TrainingService implements TrainingServiceContract {
  private readonly inflationReader: NpcInflationReaderContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly overdoseSystem: HospitalizationStatusReaderContract;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsOverdoseSystem: boolean;

  private readonly ownsPrisonSystem: boolean;

  private readonly repository: TrainingRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: TrainingServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.ownsOverdoseSystem = !options.overdoseSystem;
    this.ownsPrisonSystem = !options.prisonSystem;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.inflationReader = options.inflationReader ?? new DatabaseNpcInflationReader(this.now);
    this.overdoseSystem =
      options.overdoseSystem ??
      new OverdoseSystem({
        keyValueStore: this.keyValueStore,
        now: () => this.now().getTime(),
      });
    this.prisonSystem =
      options.prisonSystem ??
      new PrisonSystem({
        keyValueStore: this.keyValueStore,
        now: this.now,
      });
    this.repository = options.repository ?? new DatabaseTrainingRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsOverdoseSystem) {
      await this.overdoseSystem.close?.();
    }

    if (this.ownsPrisonSystem) {
      await this.prisonSystem.close?.();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async claimTraining(playerId: string, sessionId: string): Promise<TrainingClaimResponse> {
    const session = await this.repository.getTrainingSession(playerId, sessionId);

    if (!session || session.claimedAt) {
      throw new TrainingError('not_found', 'Sessao de treino nao encontrada.');
    }

    const now = this.now().getTime();

    if (session.endsAt.getTime() > now) {
      throw new TrainingError('too_early_claim', 'O treino ainda esta em andamento.');
    }

    const mutation = await this.repository.claimTrainingSession(playerId, sessionId, this.now());

    if (!mutation) {
      throw new TrainingError('not_found', 'Sessao de treino nao encontrada.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);

    return {
      appliedGains: extractSessionGains(mutation.session),
      player: toPlayerSummary(mutation.player),
      session: serializeTrainingSession(mutation.session, now),
    };
  }

  async getTrainingCenter(playerId: string): Promise<TrainingCenterResponse> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new TrainingError('character_not_ready', 'Crie seu personagem antes de treinar.');
    }

    const [
      activeSession,
      activeUniversityCourse,
      completedBasicSessions,
      hospitalization,
      inflationProfile,
      nextTrainingPreview,
    ] = await Promise.all([
        this.repository.getUnclaimedTrainingSession(playerId),
        this.universityReader.getActiveCourse(playerId),
        this.repository.countClaimedSessions(playerId, 'basic'),
        this.overdoseSystem.getHospitalizationStatus(playerId),
        this.inflationReader.getProfile(),
        this.resolveNextTrainingPreview(playerId),
      ]);

    const catalog = TRAINING_DEFINITIONS.map((definition) =>
      this.buildCatalogItem({
        activeSession,
        activeUniversityCourse,
        completedBasicSessions,
        definition,
        inflationProfile,
        hospitalizationBlocked: hospitalization.isHospitalized,
        nextDiminishingMultiplier: nextTrainingPreview.multiplier,
        player,
      }),
    );

    return {
      activeSession: activeSession
        ? serializeTrainingSession(activeSession, this.now().getTime())
        : null,
      catalog,
      completedBasicSessions,
      nextDiminishingMultiplier: nextTrainingPreview.multiplier,
      npcInflation: buildNpcInflationSummary(inflationProfile),
      player: toPlayerSummary(player),
    };
  }

  async startTraining(playerId: string, input: TrainingStartInput): Promise<TrainingStartResponse> {
    const definition = TRAINING_DEFINITIONS.find((entry) => entry.type === input.type);

    if (!definition) {
      throw new TrainingError('validation', 'Tipo de treino invalido.');
    }

    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new TrainingError('character_not_ready', 'Crie seu personagem antes de treinar.');
    }

    const [
      activeSession,
      activeUniversityCourse,
      completedBasicSessions,
      hospitalization,
      inflationProfile,
      nextTrainingPreview,
    ] = await Promise.all([
        this.repository.getUnclaimedTrainingSession(playerId),
        this.universityReader.getActiveCourse(playerId),
        this.repository.countClaimedSessions(playerId, 'basic'),
        this.overdoseSystem.getHospitalizationStatus(playerId),
        this.inflationReader.getProfile(),
        this.resolveNextTrainingPreview(playerId),
      ]);
    const inflatedMoneyCost = inflateNpcMoney(definition.moneyCost, inflationProfile);

    if (activeSession) {
      throw new TrainingError(
        activeSession.endsAt.getTime() <= this.now().getTime()
          ? 'training_ready_to_claim'
          : 'training_in_progress',
        activeSession.endsAt.getTime() <= this.now().getTime()
          ? 'Existe um treino pronto para resgate.'
          : 'Ja existe um treino em andamento.',
      );
    }

    if (hospitalization.isHospitalized) {
      throw new TrainingError('action_locked', 'Jogador hospitalizado nao pode treinar.');
    }

    if (activeUniversityCourse) {
      throw new TrainingError(
        'action_locked',
        'Finalize o curso universitario em andamento antes de iniciar um novo treino.',
      );
    }

    ensureTrainingUnlocked(definition, player.level, completedBasicSessions);

    if (player.cansaco < definition.cansacoCost) {
      throw new TrainingError('insufficient_resources', 'Cansaço insuficiente para iniciar o treino.');
    }

    if (Number.parseFloat(player.money) < inflatedMoneyCost) {
      throw new TrainingError('insufficient_resources', 'Dinheiro insuficiente para iniciar o treino.');
    }

    const startedAt = this.now();
    const endsAt = new Date(startedAt.getTime() + definition.durationMinutes * 60 * 1000);
    const gains = resolveTrainingGains(player.vocation, definition, nextTrainingPreview.multiplier);
    await this.assertTrainingActionUnlocked(playerId);
    const mutation = await this.repository.createTrainingSession(playerId, {
      costMoney: inflatedMoneyCost,
      costCansaco: definition.cansacoCost,
      diminishingMultiplier: nextTrainingPreview.multiplier,
      endsAt,
      gains,
      startedAt,
      streakIndex: nextTrainingPreview.streakIndex,
      type: definition.type,
    });

    if (!mutation) {
      throw new TrainingError('not_found', 'Jogador nao encontrado para iniciar o treino.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);

    return {
      player: toPlayerSummary(mutation.player),
      session: serializeTrainingSession(mutation.session, startedAt.getTime()),
    };
  }

  private async assertTrainingActionUnlocked(playerId: string): Promise<void> {
    await assertPlayerActionUnlocked({
      getHospitalizationStatus: () => this.overdoseSystem.getHospitalizationStatus(playerId),
      getPrisonStatus: () => this.prisonSystem.getStatus(playerId),
      hospitalizedError: () =>
        new TrainingError('action_locked', 'Jogador hospitalizado nao pode treinar.'),
      imprisonedError: () =>
        new TrainingError('action_locked', 'Jogador preso nao pode treinar.'),
    });
  }

  private buildCatalogItem(input: {
    activeSession: TrainingSessionRecord | null;
    activeUniversityCourse: UniversityCourseSummary | null;
    completedBasicSessions: number;
    definition: TrainingDefinitionSummary;
    inflationProfile: NpcInflationProfile;
    hospitalizationBlocked: boolean;
    nextDiminishingMultiplier: number;
    player: AuthPlayerRecord;
  }): TrainingCatalogItem {
    const {
      activeSession,
      activeUniversityCourse,
      completedBasicSessions,
      definition,
      hospitalizationBlocked,
      player,
    } = input;
    const inflatedMoneyCost = inflateNpcMoney(definition.moneyCost, input.inflationProfile);
    let lockReason: string | null = null;

    if (player.level < definition.unlockLevel) {
      lockReason = `Desbloqueado no nivel ${definition.unlockLevel}.`;
    } else if (completedBasicSessions < definition.minimumBasicSessionsCompleted) {
      lockReason = `Exige ${definition.minimumBasicSessionsCompleted} treinos basicos concluidos.`;
    } else if (hospitalizationBlocked) {
      lockReason = 'Jogador hospitalizado.';
    } else if (activeUniversityCourse) {
      lockReason = 'Existe um curso universitario em andamento.';
    } else if (activeSession) {
      lockReason =
        activeSession.endsAt.getTime() <= this.now().getTime()
          ? 'Resgate o treino concluido antes de iniciar outro.'
          : 'Ja existe um treino em andamento.';
    } else if (player.cansaco < definition.cansacoCost) {
      lockReason = 'Cansaço insuficiente.';
    } else if (Number.parseFloat(player.money) < inflatedMoneyCost) {
      lockReason = 'Dinheiro insuficiente.';
    }

    return {
      ...definition,
      basicSessionsCompleted: completedBasicSessions,
      isLocked: lockReason !== null,
      isRunnable: lockReason === null,
      lockReason,
      moneyCost: inflatedMoneyCost,
      nextDiminishingMultiplier: input.nextDiminishingMultiplier,
      projectedGains: resolveTrainingGains(
        player.vocation,
        definition,
        input.nextDiminishingMultiplier,
      ),
    };
  }

  private async resolveNextTrainingPreview(playerId: string): Promise<{
    multiplier: number;
    streakIndex: number;
  }> {
    const latestClaimed = await this.repository.getLatestClaimedTrainingSession(playerId);

    if (!latestClaimed) {
      return {
        multiplier: 1,
        streakIndex: 0,
      };
    }

    const now = this.now().getTime();

    if (now - latestClaimed.endsAt.getTime() >= TRAINING_REST_WINDOW_MS) {
      return {
        multiplier: 1,
        streakIndex: 0,
      };
    }

    const streakIndex = latestClaimed.streakIndex + 1;

    return {
      multiplier: Math.max(TRAINING_MIN_MULTIPLIER, 1 - streakIndex * TRAINING_DIMINISH_STEP),
      streakIndex,
    };
  }
}

function ensureTrainingUnlocked(
  definition: TrainingDefinitionSummary,
  playerLevel: number,
  completedBasicSessions: number,
) {
  if (playerLevel < definition.unlockLevel) {
    throw new TrainingError('training_locked', `Treino desbloqueado apenas no nivel ${definition.unlockLevel}.`);
  }

  if (completedBasicSessions < definition.minimumBasicSessionsCompleted) {
    throw new TrainingError(
      'training_locked',
      `Treino exige ${definition.minimumBasicSessionsCompleted} treinos basicos concluidos.`,
    );
  }
}

function extractSessionGains(session: TrainingSessionRecord): PlayerAttributes {
  return {
    carisma: session.carismaGain,
    forca: session.forcaGain,
    inteligencia: session.inteligenciaGain,
    resistencia: session.resistenciaGain,
  };
}

function resolveTrainingGains(
  vocation: AuthPlayerRecord['vocation'],
  definition: TrainingDefinitionSummary,
  diminishingMultiplier: number,
): PlayerAttributes {
  const weights = TRAINING_ATTRIBUTE_WEIGHTS[vocation];
  const basePoints = TRAINING_BASE_ATTRIBUTE_POINTS * definition.rewardMultiplier * diminishingMultiplier;

  return {
    carisma: Math.max(1, Math.round(basePoints * weights.carisma)),
    forca: Math.max(1, Math.round(basePoints * weights.forca)),
    inteligencia: Math.max(1, Math.round(basePoints * weights.inteligencia)),
    resistencia: Math.max(1, Math.round(basePoints * weights.resistencia)),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function serializeTrainingSession(
  session: TrainingSessionRecord,
  nowTimestamp: number,
): TrainingSessionSummary {
  const startedAt = session.startedAt.getTime();
  const endsAt = session.endsAt.getTime();
  const durationMs = Math.max(1, endsAt - startedAt);
  const clampedNow = Math.min(Math.max(nowTimestamp, startedAt), endsAt);

  return {
    claimedAt: session.claimedAt?.toISOString() ?? null,
    costMoney: Number.parseFloat(session.costMoney),
    costCansaco: session.costCansaco,
    diminishingMultiplier: Number.parseFloat(session.diminishingMultiplier),
    endsAt: session.endsAt.toISOString(),
    id: session.id,
    progressRatio: Number.parseFloat(((clampedNow - startedAt) / durationMs).toFixed(3)),
    projectedGains: extractSessionGains(session),
    readyToClaim: session.claimedAt === null && endsAt <= nowTimestamp,
    remainingSeconds:
      session.claimedAt === null ? Math.max(0, Math.ceil((endsAt - nowTimestamp) / 1000)) : 0,
    startedAt: session.startedAt.toISOString(),
    streakIndex: session.streakIndex,
    type: session.type,
  };
}
