import {
  UNIVERSITY_COURSE_DEFINITIONS,
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  type UniversityPerkStatus,
  type UniversityCenterResponse,
  type UniversityCourseCode,
  type UniversityCourseDefinitionSummary,
  type UniversityCourseSummary,
  type UniversityEnrollInput,
  type UniversityEnrollResponse,
  type UniversityPassiveProfile,
  type UniversityVocationPerkSummary,
  type UniversityVocationProgressionSummary,
  type VocationType,
} from '@cs-rio/shared';
import { and, asc, desc, eq, isNull, lte } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { players, trainingSessions, universityEnrollments } from '../db/schema.js';
import {
  AuthError,
  type AuthPlayerRecord,
  RedisKeyValueStore,
  type KeyValueStore,
  toPlayerSummary,
} from './auth.js';
import {
  assertPlayerActionUnlocked,
  type HospitalizationStatusReaderContract,
} from './action-readiness.js';
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

type TrainingGateRecord = Pick<typeof trainingSessions.$inferSelect, 'claimedAt' | 'endsAt' | 'id'>;
type UniversityEnrollmentRecord = typeof universityEnrollments.$inferSelect;

export interface UniversityRepository {
  completeFinishedEnrollments(playerId: string, now: Date): Promise<number>;
  createEnrollment(
    playerId: string,
    input: {
      courseCode: UniversityCourseCode;
      costMoney: number;
      endsAt: Date;
      startedAt: Date;
    },
  ): Promise<{ enrollment: UniversityEnrollmentRecord; player: AuthPlayerRecord } | null>;
  getPlayer(playerId: string): Promise<AuthPlayerRecord | null>;
  getUnclaimedTrainingSession(playerId: string): Promise<TrainingGateRecord | null>;
  listEnrollments(playerId: string): Promise<UniversityEnrollmentRecord[]>;
}

export interface UniversityEffectReaderContract {
  getActiveCourse(playerId: string): Promise<UniversityCourseSummary | null>;
  getPassiveProfile(playerId: string): Promise<UniversityPassiveProfile>;
}

export interface UniversityServiceOptions {
  inflationReader?: NpcInflationReaderContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  overdoseSystem?: HospitalizationStatusReaderContract;
  prisonSystem?: PrisonSystemContract;
  repository?: UniversityRepository;
}

export interface UniversityServiceContract extends UniversityEffectReaderContract {
  close?(): Promise<void>;
  enroll(playerId: string, input: UniversityEnrollInput): Promise<UniversityEnrollResponse>;
  getCenter(playerId: string): Promise<UniversityCenterResponse>;
}

type UniversityErrorCode =
  | 'action_locked'
  | 'character_not_ready'
  | 'course_already_completed'
  | 'course_in_progress'
  | 'course_locked'
  | 'insufficient_resources'
  | 'not_found'
  | 'validation';

export class UniversityError extends Error {
  constructor(
    public readonly code: UniversityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'UniversityError';
  }
}

export class NoopUniversityEffectReader implements UniversityEffectReaderContract {
  async getActiveCourse(): Promise<UniversityCourseSummary | null> {
    return null;
  }

  async getPassiveProfile(): Promise<UniversityPassiveProfile> {
    return createEmptyUniversityPassiveProfile();
  }
}

export class DatabaseUniversityRepository implements UniversityRepository {
  async completeFinishedEnrollments(playerId: string, now: Date): Promise<number> {
    const openEnrollments = await db
      .select()
      .from(universityEnrollments)
      .where(
        and(
          eq(universityEnrollments.playerId, playerId),
          isNull(universityEnrollments.completedAt),
          lte(universityEnrollments.endsAt, now),
        ),
      )
      .orderBy(asc(universityEnrollments.endsAt));

    if (openEnrollments.length === 0) {
      return 0;
    }

    for (const enrollment of openEnrollments) {
      await db
        .update(universityEnrollments)
        .set({
          completedAt: enrollment.endsAt,
        })
        .where(eq(universityEnrollments.id, enrollment.id));
    }

    return openEnrollments.length;
  }

  async createEnrollment(
    playerId: string,
    input: {
      courseCode: UniversityCourseCode;
      costMoney: number;
      endsAt: Date;
      startedAt: Date;
    },
  ): Promise<{ enrollment: UniversityEnrollmentRecord; player: AuthPlayerRecord } | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1);

      if (!player) {
        return null;
      }

      const nextMoney = roundMoney(Number.parseFloat(player.money) - input.costMoney);
      const [updatedPlayer] = await tx
        .update(players)
        .set({
          money: nextMoney.toFixed(2),
        })
        .where(eq(players.id, playerId))
        .returning();

      const [enrollment] = await tx
        .insert(universityEnrollments)
        .values({
          courseCode: input.courseCode,
          endsAt: input.endsAt,
          playerId,
          startedAt: input.startedAt,
        })
        .returning();

      if (!updatedPlayer || !enrollment) {
        return null;
      }

      return {
        enrollment,
        player: updatedPlayer,
      };
    });
  }

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    return player ?? null;
  }

  async getUnclaimedTrainingSession(playerId: string): Promise<TrainingGateRecord | null> {
    const [session] = await db
      .select({
        claimedAt: trainingSessions.claimedAt,
        endsAt: trainingSessions.endsAt,
        id: trainingSessions.id,
      })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.playerId, playerId), isNull(trainingSessions.claimedAt)))
      .orderBy(desc(trainingSessions.startedAt))
      .limit(1);

    return session ?? null;
  }

  async listEnrollments(playerId: string): Promise<UniversityEnrollmentRecord[]> {
    return db
      .select()
      .from(universityEnrollments)
      .where(eq(universityEnrollments.playerId, playerId))
      .orderBy(asc(universityEnrollments.startedAt));
  }
}

export class UniversityService implements UniversityServiceContract {
  private readonly inflationReader: NpcInflationReaderContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly overdoseSystem: HospitalizationStatusReaderContract;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsOverdoseSystem: boolean;

  private readonly ownsPrisonSystem: boolean;

  private readonly repository: UniversityRepository;

  constructor(options: UniversityServiceOptions = {}) {
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
    this.repository = options.repository ?? new DatabaseUniversityRepository();
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

  async enroll(playerId: string, input: UniversityEnrollInput): Promise<UniversityEnrollResponse> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new UniversityError('character_not_ready', 'Crie seu personagem antes de estudar na universidade.');
    }

    const definition = UNIVERSITY_COURSE_DEFINITIONS.find((entry) => entry.code === input.courseCode);

    if (!definition || definition.vocation !== player.vocation) {
      throw new UniversityError('validation', 'Curso invalido para a vocacao do jogador.');
    }

    await this.syncPlayerUniversity(playerId);

    const [enrollments, hospitalization, inflationProfile, trainingGate] = await Promise.all([
      this.repository.listEnrollments(playerId),
      this.overdoseSystem.getHospitalizationStatus(playerId),
      this.inflationReader.getProfile(),
      this.repository.getUnclaimedTrainingSession(playerId),
    ]);
    const inflatedMoneyCost = inflateNpcMoney(definition.moneyCost, inflationProfile);

    const completedCourseCodes = enrollments
      .filter((entry) => entry.completedAt)
      .map((entry) => entry.courseCode);
    const activeEnrollment = resolveActiveEnrollment(enrollments, this.now());

    if (completedCourseCodes.includes(definition.code)) {
      throw new UniversityError('course_already_completed', 'Esse curso ja foi concluido.');
    }

    if (activeEnrollment) {
      throw new UniversityError('course_in_progress', 'Ja existe um curso universitario em andamento.');
    }

    if (trainingGate) {
      throw new UniversityError(
        'action_locked',
        trainingGate.endsAt.getTime() <= this.now().getTime()
          ? 'Resgate o treino concluido antes de iniciar um curso universitario.'
          : 'Finalize o treino em andamento antes de iniciar um curso universitario.',
      );
    }

    if (hospitalization.isHospitalized) {
      throw new UniversityError(
        'action_locked',
        'Jogador hospitalizado nao pode iniciar curso universitario.',
      );
    }

    ensureUniversityCourseUnlocked(definition, player, completedCourseCodes);

    if (Number.parseFloat(player.money) < inflatedMoneyCost) {
      throw new UniversityError(
        'insufficient_resources',
        'Dinheiro insuficiente para iniciar esse curso universitario.',
      );
    }

    const startedAt = this.now();
    const endsAt = new Date(startedAt.getTime() + definition.durationHours * 60 * 60 * 1000);
    await this.assertUniversityActionUnlocked(playerId);
    const mutation = await this.repository.createEnrollment(playerId, {
      costMoney: inflatedMoneyCost,
      courseCode: definition.code,
      endsAt,
      startedAt,
    });

    if (!mutation) {
      throw new UniversityError('not_found', 'Nao foi possivel iniciar o curso universitario.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);

    return {
      course: buildUniversityCourseSummary({
        activeEnrollmentId: mutation.enrollment.id,
        completedCourseCodes,
        definition,
        enrollment: mutation.enrollment,
        inflationProfile,
        now: startedAt,
        player,
        trainingGate,
      }),
      player: toPlayerSummary(mutation.player),
    };
  }

  async getActiveCourse(playerId: string): Promise<UniversityCourseSummary | null> {
    const player = await this.repository.getPlayer(playerId);

    if (!player?.characterCreatedAt) {
      return null;
    }

    await this.syncPlayerUniversity(playerId);
    const [enrollments, inflationProfile] = await Promise.all([
      this.repository.listEnrollments(playerId),
      this.inflationReader.getProfile(),
    ]);
    const activeEnrollment = resolveActiveEnrollment(enrollments, this.now());

    if (!activeEnrollment) {
      return null;
    }

    const definition = UNIVERSITY_COURSE_DEFINITIONS.find((entry) => entry.code === activeEnrollment.courseCode);

    if (!definition) {
      return null;
    }

    const completedCourseCodes = enrollments
      .filter((entry) => entry.completedAt)
      .map((entry) => entry.courseCode);

    return buildUniversityCourseSummary({
      activeEnrollmentId: activeEnrollment.id,
      completedCourseCodes,
      definition,
      enrollment: activeEnrollment,
      inflationProfile,
      now: this.now(),
      player,
      trainingGate: null,
    });
  }

  async getCenter(playerId: string): Promise<UniversityCenterResponse> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new UniversityError('character_not_ready', 'Crie seu personagem antes de estudar na universidade.');
    }

    await this.syncPlayerUniversity(playerId);
    const [enrollments, inflationProfile, trainingGate] = await Promise.all([
      this.repository.listEnrollments(playerId),
      this.inflationReader.getProfile(),
      this.repository.getUnclaimedTrainingSession(playerId),
    ]);
    const activeEnrollment = resolveActiveEnrollment(enrollments, this.now());
    const completedCourseCodes = enrollments
      .filter((entry) => entry.completedAt)
      .map((entry) => entry.courseCode);
    const courseDefinitions = UNIVERSITY_COURSE_DEFINITIONS.filter(
      (entry) => entry.vocation === player.vocation,
    );
    const courses = courseDefinitions.map((definition) =>
      buildUniversityCourseSummary({
        activeEnrollmentId: activeEnrollment?.id ?? null,
        completedCourseCodes,
        definition,
        enrollment:
          enrollments.find((entry) => entry.courseCode === definition.code) ?? null,
        inflationProfile,
        now: this.now(),
        player,
        trainingGate,
      }),
    );
    const passiveProfile = buildUniversityPassiveProfile(completedCourseCodes);
    const progression = buildUniversityVocationProgressionSummary({
      courses,
      passiveProfile,
      vocation: player.vocation as VocationType,
    });

    return {
      activeCourse: courses.find((entry) => entry.isInProgress) ?? null,
      completedCourseCodes,
      courses,
      npcInflation: buildNpcInflationSummary(inflationProfile),
      passiveProfile,
      player: toPlayerSummary(player),
      progression,
    };
  }

  async getPassiveProfile(playerId: string): Promise<UniversityPassiveProfile> {
    const player = await this.repository.getPlayer(playerId);

    if (!player?.characterCreatedAt) {
      return createEmptyUniversityPassiveProfile();
    }

    await this.syncPlayerUniversity(playerId);
    const enrollments = await this.repository.listEnrollments(playerId);
    const completedCourseCodes = enrollments
      .filter((entry) => entry.completedAt)
      .map((entry) => entry.courseCode);
    return buildUniversityPassiveProfile(completedCourseCodes);
  }

  private async syncPlayerUniversity(playerId: string): Promise<void> {
    const completedCount = await this.repository.completeFinishedEnrollments(playerId, this.now());

    if (completedCount > 0) {
      await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    }
  }

  private async assertUniversityActionUnlocked(playerId: string): Promise<void> {
    await assertPlayerActionUnlocked({
      getHospitalizationStatus: () => this.overdoseSystem.getHospitalizationStatus(playerId),
      getPrisonStatus: () => this.prisonSystem.getStatus(playerId),
      hospitalizedError: () =>
        new UniversityError(
          'action_locked',
          'Jogador hospitalizado nao pode iniciar curso universitario.',
        ),
      imprisonedError: () =>
        new UniversityError('action_locked', 'Jogador preso nao pode iniciar curso universitario.'),
    });
  }
}

export function buildUniversityPassiveProfile(
  completedCourseCodes: UniversityCourseCode[],
): UniversityPassiveProfile {
  const profile = createEmptyUniversityPassiveProfile();

  for (const courseCode of completedCourseCodes) {
    switch (courseCode) {
      case 'mao_leve':
        profile.crime.soloSuccessMultiplier *= 1.1;
        break;
      case 'corrida_de_fuga':
        profile.crime.arrestChanceMultiplier *= 0.8;
        break;
      case 'olho_clinico':
        profile.crime.revealsTargetValue = true;
        break;
      case 'rei_da_rua':
        profile.crime.lowLevelSoloRewardMultiplier *= 1.25;
        break;
      case 'logistica_de_boca':
        profile.factory.productionMultiplier *= 1.15;
        break;
      case 'rede_de_distribuicao':
        profile.business.bocaDemandMultiplier *= 1.2;
        break;
      case 'quimico_mestre':
        profile.factory.extraDrugSlots += 1;
        break;
      case 'magnata_do_po':
        profile.factory.productionMultiplier *= 1.3;
        break;
      case 'tiro_certeiro':
        profile.pvp.damageDealtMultiplier *= 1.15;
        break;
      case 'emboscada_perfeita':
        profile.pvp.ambushPowerMultiplier *= 1.2;
        break;
      case 'instinto_de_sobrevivencia':
        profile.pvp.lowHpDamageTakenMultiplier *= 0.7;
        break;
      case 'maquina_de_guerra':
        profile.pvp.assaultPowerMultiplier *= 1.25;
        break;
      case 'labia_de_politico':
        profile.police.negotiationSuccessMultiplier *= 1.2;
        break;
      case 'rede_de_contatos':
        profile.business.gpRevenueMultiplier *= 1.15;
        profile.police.bribeCostMultiplier *= 0.8;
        break;
      case 'manipulacao_de_massa':
        profile.social.communityInfluenceMultiplier *= 1.25;
        break;
      case 'poderoso_chefao':
        profile.faction.factionCharismaAura += 0.05;
        break;
      case 'engenharia_financeira':
        profile.business.launderingReturnMultiplier *= 1.1;
        break;
      case 'faro_para_negocios':
        profile.business.propertyMaintenanceMultiplier *= 0.85;
        break;
      case 'mercado_paralelo':
        profile.market.feeRate = 0.02;
        break;
      case 'imperio_do_crime':
        profile.business.passiveRevenueMultiplier *= 1.2;
        break;
    }
  }

  return normalizeUniversityPassiveProfile(profile);
}

function buildUniversityCourseSummary(input: {
  activeEnrollmentId: string | null;
  completedCourseCodes: UniversityCourseCode[];
  definition: UniversityCourseDefinitionSummary;
  enrollment: UniversityEnrollmentRecord | null;
  inflationProfile: NpcInflationProfile;
  now: Date;
  player: AuthPlayerRecord;
  trainingGate: TrainingGateRecord | null;
}): UniversityCourseSummary {
  const inflatedMoneyCost = inflateNpcMoney(input.definition.moneyCost, input.inflationProfile);
  const staticLockReason = resolveStaticCourseLockReason(
    input.definition,
    input.player,
    input.completedCourseCodes,
  );
  const isCompleted = input.completedCourseCodes.includes(input.definition.code);
  const isInProgress = Boolean(
    input.enrollment &&
      input.activeEnrollmentId === input.enrollment.id &&
      input.enrollment.completedAt === null &&
      input.enrollment.endsAt.getTime() > input.now.getTime(),
  );
  let lockReason = staticLockReason;

  if (!lockReason && !isCompleted && !isInProgress && input.trainingGate) {
    lockReason =
      input.trainingGate.endsAt.getTime() <= input.now.getTime()
        ? 'Resgate o treino concluido antes de iniciar o curso.'
        : 'Finalize o treino atual antes de iniciar o curso.';
  } else if (!lockReason && !isCompleted && !isInProgress && input.activeEnrollmentId) {
    lockReason = 'Ja existe outro curso universitario em andamento.';
  } else if (!lockReason && !isCompleted && Number.parseFloat(input.player.money) < inflatedMoneyCost) {
    lockReason = 'Dinheiro insuficiente.';
  } else if (!lockReason && isInProgress) {
    lockReason = 'Curso em andamento.';
  }

  return {
    ...input.definition,
    completedAt: input.enrollment?.completedAt?.toISOString() ?? null,
    endsAt: input.enrollment?.endsAt.toISOString() ?? null,
    isCompleted,
    isInProgress,
    isLocked: staticLockReason !== null,
    isUnlocked: staticLockReason === null,
    lockReason,
    moneyCost: inflatedMoneyCost,
    startedAt: input.enrollment?.startedAt.toISOString() ?? null,
  };
}

function buildUniversityVocationProgressionSummary(input: {
  courses: UniversityCourseSummary[];
  passiveProfile: UniversityPassiveProfile;
  vocation: VocationType;
}): UniversityVocationProgressionSummary {
  const perks: UniversityVocationPerkSummary[] = input.courses.map((course, index) => ({
    ...course,
    isMasteryPerk: course.prerequisiteCourseCodes.length > 0,
    perkSlot: index + 1,
    status: resolveUniversityPerkStatus(course),
  }));
  const completedPerks = perks.filter((perk) => perk.status === 'completed').length;
  const currentPerk = perks.find((perk) => perk.status === 'in_progress') ?? null;
  const nextPerk =
    currentPerk ??
    perks.find((perk) => perk.status === 'available') ??
    perks.find((perk) => perk.status === 'locked') ??
    null;
  const masteryUnlocked = perks.some((perk) => perk.isMasteryPerk && perk.status === 'completed');
  const totalPerks = Math.max(perks.length, 1);

  return {
    completedPerks,
    completionRatio: roundPassive(completedPerks / totalPerks),
    currentPerkCode: currentPerk?.code ?? null,
    masteryUnlocked,
    nextPerk,
    passiveProfile: input.passiveProfile,
    perks,
    stage: resolveUniversityVocationProgressionStage({
      completedPerks,
      currentPerk,
      masteryUnlocked,
    }),
    totalPerks: perks.length,
    trackLabel: resolveUniversityVocationTrackLabel(input.vocation),
    vocation: input.vocation,
  };
}

function createEmptyUniversityPassiveProfile(): UniversityPassiveProfile {
  return {
    business: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.business,
    },
    crime: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.crime,
    },
    factory: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.factory,
    },
    faction: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.faction,
    },
    market: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.market,
    },
    police: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.police,
    },
    pvp: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.pvp,
    },
    social: {
      ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.social,
    },
  };
}

function ensureUniversityCourseUnlocked(
  definition: UniversityCourseDefinitionSummary,
  player: AuthPlayerRecord,
  completedCourseCodes: UniversityCourseCode[],
) {
  const lockReason = resolveStaticCourseLockReason(definition, player, completedCourseCodes);

  if (lockReason) {
    throw new UniversityError('course_locked', lockReason);
  }
}

function normalizeUniversityPassiveProfile(profile: UniversityPassiveProfile): UniversityPassiveProfile {
  return {
    business: {
      bocaDemandMultiplier: roundPassive(profile.business.bocaDemandMultiplier),
      gpRevenueMultiplier: roundPassive(profile.business.gpRevenueMultiplier),
      launderingReturnMultiplier: roundPassive(profile.business.launderingReturnMultiplier),
      passiveRevenueMultiplier: roundPassive(profile.business.passiveRevenueMultiplier),
      propertyMaintenanceMultiplier: roundPassive(profile.business.propertyMaintenanceMultiplier),
    },
    crime: {
      arrestChanceMultiplier: roundPassive(profile.crime.arrestChanceMultiplier),
      lowLevelSoloRewardMultiplier: roundPassive(profile.crime.lowLevelSoloRewardMultiplier),
      revealsTargetValue: profile.crime.revealsTargetValue,
      soloSuccessMultiplier: roundPassive(profile.crime.soloSuccessMultiplier),
    },
    factory: {
      extraDrugSlots: profile.factory.extraDrugSlots,
      productionMultiplier: roundPassive(profile.factory.productionMultiplier),
    },
    faction: {
      factionCharismaAura: roundPassive(profile.faction.factionCharismaAura),
    },
    market: {
      feeRate: roundPassive(profile.market.feeRate),
    },
    police: {
      bribeCostMultiplier: roundPassive(profile.police.bribeCostMultiplier),
      negotiationSuccessMultiplier: roundPassive(profile.police.negotiationSuccessMultiplier),
    },
    pvp: {
      ambushPowerMultiplier: roundPassive(profile.pvp.ambushPowerMultiplier),
      assaultPowerMultiplier: roundPassive(profile.pvp.assaultPowerMultiplier),
      damageDealtMultiplier: roundPassive(profile.pvp.damageDealtMultiplier),
      lowHpDamageTakenMultiplier: roundPassive(profile.pvp.lowHpDamageTakenMultiplier),
    },
    social: {
      communityInfluenceMultiplier: roundPassive(profile.social.communityInfluenceMultiplier),
    },
  };
}

function resolveActiveEnrollment(
  enrollments: UniversityEnrollmentRecord[],
  now: Date,
): UniversityEnrollmentRecord | null {
  return (
    enrollments.find(
      (entry) => entry.completedAt === null && entry.endsAt.getTime() > now.getTime(),
    ) ?? null
  );
}

function resolveStaticCourseLockReason(
  definition: UniversityCourseDefinitionSummary,
  player: AuthPlayerRecord,
  completedCourseCodes: UniversityCourseCode[],
): string | null {
  if (player.level < definition.unlockLevel) {
    return `Curso desbloqueado apenas no nivel ${definition.unlockLevel}.`;
  }

  for (const [attribute, requiredValue] of Object.entries(definition.attributeRequirements)) {
    const playerValue = player[attribute as keyof Pick<AuthPlayerRecord, 'carisma' | 'forca' | 'inteligencia' | 'resistencia'>];

    if (typeof playerValue !== 'number' || playerValue < requiredValue) {
      return `Exige ${attribute} ${requiredValue}.`;
    }
  }

  for (const prerequisite of definition.prerequisiteCourseCodes) {
    if (!completedCourseCodes.includes(prerequisite)) {
      const prerequisiteDefinition = UNIVERSITY_COURSE_DEFINITIONS.find(
        (entry) => entry.code === prerequisite,
      );
      return prerequisiteDefinition
        ? `Exige concluir ${prerequisiteDefinition.label}.`
        : 'Exige concluir cursos anteriores da arvore.';
    }
  }

  return null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPassive(value: number): number {
  return Number.parseFloat(value.toFixed(4));
}

function resolveUniversityPerkStatus(course: UniversityCourseSummary): UniversityPerkStatus {
  if (course.isCompleted) {
    return 'completed';
  }

  if (course.isInProgress) {
    return 'in_progress';
  }

  if (course.isUnlocked && !course.lockReason) {
    return 'available';
  }

  return 'locked';
}

function resolveUniversityVocationProgressionStage(input: {
  completedPerks: number;
  currentPerk: UniversityVocationPerkSummary | null;
  masteryUnlocked: boolean;
}): UniversityVocationProgressionSummary['stage'] {
  if (input.masteryUnlocked) {
    return 'mastered';
  }

  if (input.completedPerks > 0 || input.currentPerk) {
    return 'developing';
  }

  return 'starting';
}

function resolveUniversityVocationTrackLabel(vocation: VocationType): string {
  switch (vocation) {
    case 'cria':
      return 'Trilha de Rua';
    case 'gerente':
      return 'Trilha Operacional';
    case 'soldado':
      return 'Trilha de Guerra';
    case 'politico':
      return 'Trilha de Influencia';
    case 'empreendedor':
      return 'Trilha de Negocios';
    default:
      return 'Trilha de Vocacao';
  }
}
