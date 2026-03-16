import {
  CrimeType,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogItem,
  type FactionCrimeCatalogResponse,
  type FactionCrimeCrewMemberSummary,
  type FactionCrimeParticipantOutcome,
  type FactionRank,
  type PlayerResources,
} from '@cs-rio/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  crimes,
  factionMembers,
  playerInventory,
  players,
  transactions,
  vests,
  weapons,
} from '../db/schema.js';
import { type FactionUpgradeEffectReaderContract } from '../services/faction.js';
import {
  buildEmptyResolvedCatalog,
  resolveFactionCrimePolicy,
} from '../services/gameplay-config.js';
import { type GameConfigService } from '../services/game-config.js';
import { type CrimeDefinitionRecord, type CrimePlayerContext, CrimeError } from './CrimeSystem.js';
import { CooldownSystem } from './CooldownSystem.js';
import { LevelSystem } from './LevelSystem.js';

const COORDINATION_BONUS_PER_EXTRA_MEMBER = 0.03;

interface FactionCrimeParticipantContext extends CrimePlayerContext {
  rank: FactionRank;
}

interface FactionCrimePersistenceUpdate {
  conceitoDelta: number;
  crimeName: string;
  hpDelta: number;
  logType: 'faction_crime_failure' | 'faction_crime_success';
  moneyDelta: number;
  nextLevel: number;
  nextResources: Pick<PlayerResources, 'conceito' | 'hp' | 'money' | 'disposicao' | 'cansaco'>;
  playerId: string;
}

export interface FactionCrimeRepository {
  getFactionCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null>;
  listFactionCrimes(): Promise<CrimeDefinitionRecord[]>;
  listFactionParticipants(factionId: string): Promise<FactionCrimeParticipantContext[]>;
  persistFactionCrimeAttempt(updates: FactionCrimePersistenceUpdate[]): Promise<void>;
}

export interface FactionCrimeSystemOptions {
  cooldownSystem?: CooldownSystem;
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  gameConfigService?: Pick<GameConfigService, 'getResolvedCatalog'>;
  levelSystem?: LevelSystem;
  now?: () => Date;
  random?: () => number;
  repository?: FactionCrimeRepository;
}

export class DatabaseFactionCrimeRepository implements FactionCrimeRepository {
  async getFactionCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null> {
    const [crime] = await db
      .select()
      .from(crimes)
      .where(and(eq(crimes.id, crimeId), eq(crimes.crimeType, CrimeType.Faccao)))
      .limit(1);

    return crime ? mapCrimeDefinition(crime) : null;
  }

  async listFactionCrimes(): Promise<CrimeDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(crimes)
      .where(eq(crimes.crimeType, CrimeType.Faccao))
      .orderBy(asc(crimes.levelRequired), asc(crimes.name));

    return rows.map(mapCrimeDefinition);
  }

  async listFactionParticipants(factionId: string): Promise<FactionCrimeParticipantContext[]> {
    const memberRows = await db
      .select({
        addiction: players.addiction,
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        factionId: factionMembers.factionId,
        forca: players.forca,
        hp: players.hp,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        money: players.money,
        disposicao: players.disposicao,
        nickname: players.nickname,
        rank: factionMembers.rank,
        resistencia: players.resistencia,
        cansaco: players.cansaco,
        vocation: players.vocation,
      })
      .from(factionMembers)
      .innerJoin(players, eq(players.id, factionMembers.playerId))
      .where(eq(factionMembers.factionId, factionId));

    if (memberRows.length === 0) {
      return [];
    }

    const playerIds = memberRows.map((member) => member.id);
    const [weaponRows, vestRows] = await Promise.all([
      db
        .select({
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
          playerId: playerInventory.playerId,
          power: weapons.power,
          proficiency: playerInventory.proficiency,
        })
        .from(playerInventory)
        .innerJoin(weapons, eq(playerInventory.itemId, weapons.id))
        .where(
          and(
            inArray(playerInventory.playerId, playerIds),
            eq(playerInventory.itemType, 'weapon'),
            eq(playerInventory.equippedSlot, 'weapon'),
          ),
        ),
      db
        .select({
          defense: vests.defense,
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
          playerId: playerInventory.playerId,
        })
        .from(playerInventory)
        .innerJoin(vests, eq(playerInventory.itemId, vests.id))
        .where(
          and(
            inArray(playerInventory.playerId, playerIds),
            eq(playerInventory.itemType, 'vest'),
            eq(playerInventory.equippedSlot, 'vest'),
          ),
        ),
    ]);

    const weaponByPlayerId = new Map(
      weaponRows.map((weapon) => [
        weapon.playerId,
        {
          durability: weapon.durability,
          inventoryItemId: weapon.inventoryItemId,
          power: weapon.power,
          proficiency: weapon.proficiency,
        },
      ]),
    );
    const vestByPlayerId = new Map(
      vestRows.map((vest) => [
        vest.playerId,
        {
          defense: vest.defense,
          durability: vest.durability,
          inventoryItemId: vest.inventoryItemId,
        },
      ]),
    );

    return memberRows.map((member) => ({
      attributes: {
        carisma: member.carisma,
        forca: member.forca,
        inteligencia: member.inteligencia,
        resistencia: member.resistencia,
      },
      equipment: {
        vest: vestByPlayerId.get(member.id) ?? null,
        weapon: weaponByPlayerId.get(member.id) ?? null,
      },
      factionId: member.factionId,
      player: {
        characterCreatedAt: member.characterCreatedAt,
        id: member.id,
        level: member.level,
        nickname: member.nickname,
        resources: {
          addiction: member.addiction,
          conceito: member.conceito,
          hp: member.hp,
          money: roundMoney(Number.parseFloat(String(member.money))),
          disposicao: member.disposicao,
          cansaco: member.cansaco,
        },
        vocation: member.vocation as CrimePlayerContext['player']['vocation'],
      },
      rank: member.rank,
    }));
  }

  async persistFactionCrimeAttempt(updates: FactionCrimePersistenceUpdate[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(players)
          .set({
            conceito: update.nextResources.conceito,
            hp: update.nextResources.hp,
            level: update.nextLevel,
            money: update.nextResources.money.toFixed(2),
            disposicao: update.nextResources.disposicao,
            cansaco: update.nextResources.cansaco,
          })
          .where(eq(players.id, update.playerId));

        await tx.insert(transactions).values({
          amount: update.moneyDelta.toFixed(2),
          description: buildFactionCrimeLogDescription(update),
          playerId: update.playerId,
          type: update.logType,
        });
      }
    });
  }
}

export class FactionCrimeSystem {
  private readonly cooldownSystem: CooldownSystem;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly gameConfigService: Pick<GameConfigService, 'getResolvedCatalog'>;

  private readonly levelSystem: LevelSystem;

  private readonly now: () => Date;

  private readonly random: () => number;

  private readonly repository: FactionCrimeRepository;

  constructor(options: FactionCrimeSystemOptions) {
    this.cooldownSystem = options.cooldownSystem ?? new CooldownSystem();
    this.factionUpgradeReader = options.factionUpgradeReader ?? {
      async getFactionUpgradeEffectsForFaction() {
        return {
          attributeBonusMultiplier: 1,
          canAccessExclusiveArsenal: false,
          hasFortifiedHeadquarters: false,
          muleDeliveryTier: 0,
          soldierCapacityMultiplier: 1,
        };
      },
    };
    this.gameConfigService = options.gameConfigService ?? {
      async getResolvedCatalog() {
        return buildEmptyResolvedCatalog();
      },
    };
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseFactionCrimeRepository();
  }

  async close(): Promise<void> {
    await this.cooldownSystem.close?.();
  }

  async getCatalog(playerId: string, factionId: string): Promise<FactionCrimeCatalogResponse> {
    const factionCrimePolicy = resolveFactionCrimePolicy(await this.gameConfigService.getResolvedCatalog());
    const [crimesCatalog, memberContexts] = await Promise.all([
      this.repository.listFactionCrimes(),
      this.repository.listFactionParticipants(factionId),
    ]);
    const actor = memberContexts.find((member) => member.player.id === playerId);

    if (!actor) {
      throw new CrimeError('forbidden', 'Voce nao faz parte desta faccao.');
    }

    if (!actor.player.characterCreatedAt) {
      throw new CrimeError('character_not_ready', 'Crie o personagem antes de coordenar crimes de faccao.');
    }

    const effectiveMembers = await Promise.all(
      memberContexts.map(async (member) => this.applyFactionUpgradeEffects(member)),
    );
    const memberSummaries = effectiveMembers.map((member) =>
      this.buildCrewMemberSummary(member, factionCrimePolicy.coordinatorRanks),
    );
    const factionCooldownKey = buildFactionCrimeCooldownKey(factionId);
    const readyMemberCount = memberSummaries.filter((member) => member.lockReason === null).length;
    const coordinatorCanStart = canCoordinateFactionCrime(actor.rank, factionCrimePolicy.coordinatorRanks);
    const cooldowns = await Promise.all(
      crimesCatalog.map((crime) => this.cooldownSystem.getCrimeCooldown(factionCooldownKey, crime.id)),
    );

    return {
      coordinatorCanStart,
      crimes: crimesCatalog.map((crime, index) =>
        this.buildCatalogItem(
          crime,
          cooldowns[index]?.remainingSeconds ?? 0,
          coordinatorCanStart,
          readyMemberCount,
          factionCrimePolicy,
        ),
      ),
      factionId,
      members: memberSummaries,
      playerFactionId: factionId,
    };
  }

  async attemptCrime(
    actorPlayerId: string,
    factionId: string,
    crimeId: string,
    input: FactionCrimeAttemptInput,
  ): Promise<FactionCrimeAttemptResponse> {
    const factionCrimePolicy = resolveFactionCrimePolicy(await this.gameConfigService.getResolvedCatalog());
    const [crime, memberContexts] = await Promise.all([
      this.repository.getFactionCrimeById(crimeId),
      this.repository.listFactionParticipants(factionId),
    ]);

    if (!crime) {
      throw new CrimeError('not_found', 'Crime coletivo de faccao nao encontrado.');
    }

    const actor = memberContexts.find((member) => member.player.id === actorPlayerId);

    if (!actor) {
      throw new CrimeError('forbidden', 'Voce nao faz parte desta faccao.');
    }

    if (!actor.player.characterCreatedAt) {
      throw new CrimeError('character_not_ready', 'Crie o personagem antes de coordenar crimes de faccao.');
    }

    if (!canCoordinateFactionCrime(actor.rank, factionCrimePolicy.coordinatorRanks)) {
      throw new CrimeError('forbidden', 'Seu cargo nao pode coordenar crimes coletivos da faccao.');
    }

    const cooldown = await this.cooldownSystem.getCrimeCooldown(buildFactionCrimeCooldownKey(factionId), crimeId);

    if (cooldown.active) {
      throw new CrimeError(
        'cooldown_active',
        `Crime coletivo em cooldown por mais ${cooldown.remainingSeconds}s.`,
      );
    }

    const selectedParticipantIds = [...new Set([actorPlayerId, ...(input.participantIds ?? [])])];

    if (selectedParticipantIds.length < factionCrimePolicy.minCrewSize) {
      throw new CrimeError(
        'validation',
        `Crime coletivo exige ao menos ${factionCrimePolicy.minCrewSize} participantes.`,
      );
    }

    if (selectedParticipantIds.length > factionCrimePolicy.maxCrewSize) {
      throw new CrimeError(
        'validation',
        `Crime coletivo permite no maximo ${factionCrimePolicy.maxCrewSize} participantes.`,
      );
    }

    const selectedParticipants = selectedParticipantIds.map((participantId) =>
      memberContexts.find((member) => member.player.id === participantId) ?? null,
    );

    if (selectedParticipants.some((participant) => participant === null)) {
      throw new CrimeError('validation', 'Todos os participantes precisam pertencer a esta faccao.');
    }

    const factionParticipants = selectedParticipants.filter(
      (participant): participant is FactionCrimeParticipantContext => participant !== null,
    );
    const effectiveParticipants = await Promise.all(
      factionParticipants.map(async (participant) => this.applyFactionUpgradeEffects(participant)),
    );

    for (const participant of effectiveParticipants) {
      const lockReason = resolveParticipantCrimeLockReason(participant, crime);

      if (lockReason) {
        throw new CrimeError(
          'conflict',
          `${participant.player.nickname} nao pode entrar no bonde: ${lockReason}`,
        );
      }
    }

    const participantPowers = effectiveParticipants.map((participant) =>
      calculatePlayerPower(participant, crime.type),
    );
    const combinedBasePower = participantPowers.reduce((sum, power) => sum + power, 0);
    const coordinationMultiplier = resolveCoordinationMultiplier(
      effectiveParticipants.length,
      factionCrimePolicy.coordinationBonusPerExtraMember,
    );
    const combinedPower = Math.round(combinedBasePower * coordinationMultiplier);
    const chance = estimateSuccessChance(combinedPower, crime.minPower);
    const success = this.random() <= chance;
    const bustedChance = success
      ? 0
      : clamp(
          crime.arrestChance / 100,
          factionCrimePolicy.minBustedChance,
          factionCrimePolicy.maxBustedChance,
        );
    const busted = !success && this.random() <= bustedChance;
    const rewardTotal = success
      ? calculateRewardAmount(roundMoney(crime.rewardMin), roundMoney(crime.rewardMax), this.random())
      : 0;
    const moneyShares = splitMoneyReward(rewardTotal, effectiveParticipants.length);
    const conceitoRewardPerParticipant = success
      ? crime.conceitoReward
      : -Math.max(1, Math.round(crime.conceitoReward * (busted ? 0.5 : 0.25)));
    const hpDelta = success ? 0 : -calculateFactionCrimeHpLoss(crime.levelRequired, busted);

    const participantOutcomes: FactionCrimeParticipantOutcome[] = effectiveParticipants.map((participant, index) => {
      const moneyDelta = moneyShares[index] ?? 0;
      const nextResources = {
        conceito: Math.max(0, participant.player.resources.conceito + conceitoRewardPerParticipant),
        hp: clamp(participant.player.resources.hp + hpDelta, 0, 100),
        money: roundMoney(participant.player.resources.money + moneyDelta),
        disposicao: clamp(participant.player.resources.disposicao - crime.disposicaoCost, 0, 100),
        cansaco: clamp(participant.player.resources.cansaco - crime.cansacoCost, 0, 100),
      };
      const levelProgression = this.levelSystem.resolve(nextResources.conceito, participant.player.level);

      return {
        conceitoDelta: conceitoRewardPerParticipant,
        hpDelta,
        id: participant.player.id,
        level: levelProgression.level,
        leveledUp: levelProgression.leveledUp,
        moneyDelta,
        disposicaoSpent: crime.disposicaoCost,
        nickname: participant.player.nickname,
        playerPower: participantPowers[index] ?? 0,
        rank: participant.rank,
        resources: nextResources,
        cansacoSpent: crime.cansacoCost,
      };
    });

    await this.repository.persistFactionCrimeAttempt(
      participantOutcomes.map((outcome) => ({
        conceitoDelta: outcome.conceitoDelta,
        crimeName: crime.name,
        hpDelta: outcome.hpDelta,
        logType: success ? 'faction_crime_success' : 'faction_crime_failure',
        moneyDelta: outcome.moneyDelta,
        nextLevel: outcome.level,
        nextResources: outcome.resources,
        playerId: outcome.id,
      })),
    );

    const nextCooldown = await this.cooldownSystem.activateCrimeCooldown(
      buildFactionCrimeCooldownKey(factionId),
      crime.id,
      crime.cooldownSeconds,
    );

    return {
      busted,
      bustedChance,
      chance,
      combinedPower,
      conceitoRewardPerParticipant,
      cooldownRemainingSeconds: nextCooldown.remainingSeconds,
      coordinationMultiplier,
      crimeId: crime.id,
      crimeName: crime.name,
      factionId,
      message: buildFactionCrimeMessage(crime.name, success, busted),
      minimumPowerRequired: crime.minPower,
      participantCount: participantOutcomes.length,
      participants: participantOutcomes,
      rewardTotal,
      success,
    };
  }

  private buildCatalogItem(
    crime: CrimeDefinitionRecord,
      cooldownRemainingSeconds: number,
    coordinatorCanStart: boolean,
    readyMemberCount: number,
    factionCrimePolicy: ReturnType<typeof resolveFactionCrimePolicy>,
  ): FactionCrimeCatalogItem {
    let lockReason: string | null = null;

    if (!coordinatorCanStart) {
      lockReason = 'Seu cargo nao pode coordenar crimes coletivos.';
    } else if (cooldownRemainingSeconds > 0) {
      lockReason = `Cooldown ativo: ${cooldownRemainingSeconds}s restantes.`;
    } else if (readyMemberCount < factionCrimePolicy.minCrewSize) {
      lockReason = `Sao necessarios ao menos ${factionCrimePolicy.minCrewSize} membros prontos.`;
    }

    return {
      arrestChance: crime.arrestChance,
      conceitoReward: crime.conceitoReward,
      cooldownRemainingSeconds,
      id: crime.id,
      isLocked: lockReason !== null,
      isOnCooldown: cooldownRemainingSeconds > 0,
      isRunnable: lockReason === null,
      levelRequired: crime.levelRequired,
      lockReason,
      maximumCrewSize: factionCrimePolicy.maxCrewSize,
      minimumCrewSize: factionCrimePolicy.minCrewSize,
      minPower: crime.minPower,
      name: crime.name,
      disposicaoCost: crime.disposicaoCost,
      rewardMax: crime.rewardMax,
      rewardMin: crime.rewardMin,
      cansacoCost: crime.cansacoCost,
      type: crime.type,
    };
  }

  private buildCrewMemberSummary(
    participant: FactionCrimeParticipantContext,
    coordinatorRanks: FactionRank[],
  ): FactionCrimeCrewMemberSummary {
    return {
      id: participant.player.id,
      isCoordinatorEligible: canCoordinateFactionCrime(participant.rank, coordinatorRanks),
      level: participant.player.level,
      lockReason: resolveParticipantReadinessLockReason(participant),
      nickname: participant.player.nickname,
      playerPower: calculatePlayerPower(participant, CrimeType.Faccao),
      rank: participant.rank,
      resources: {
        hp: participant.player.resources.hp,
        disposicao: participant.player.resources.disposicao,
        cansaco: participant.player.resources.cansaco,
      },
    };
  }

  private async applyFactionUpgradeEffects(
    playerContext: FactionCrimeParticipantContext,
  ): Promise<FactionCrimeParticipantContext> {
    const effects = await this.factionUpgradeReader.getFactionUpgradeEffectsForFaction(playerContext.factionId);

    if (effects.attributeBonusMultiplier === 1) {
      return playerContext;
    }

    return {
      ...playerContext,
      attributes: {
        carisma: Math.round(playerContext.attributes.carisma * effects.attributeBonusMultiplier),
        forca: Math.round(playerContext.attributes.forca * effects.attributeBonusMultiplier),
        inteligencia: Math.round(playerContext.attributes.inteligencia * effects.attributeBonusMultiplier),
        resistencia: Math.round(playerContext.attributes.resistencia * effects.attributeBonusMultiplier),
      },
    };
  }
}

function buildFactionCrimeCooldownKey(factionId: string): string {
  return `faction:${factionId}`;
}

function buildFactionCrimeLogDescription(input: FactionCrimePersistenceUpdate): string {
  if (input.logType === 'faction_crime_success') {
    return `Crime coletivo ${input.crimeName} concluido com sucesso. Parte do bonde recebeu R$ ${input.moneyDelta}.`;
  }

  return `Crime coletivo ${input.crimeName} falhou. Impacto de HP ${input.hpDelta}.`;
}

function buildFactionCrimeMessage(crimeName: string, success: boolean, busted: boolean): string {
  if (success) {
    return `Crime coletivo concluido com sucesso: ${crimeName}.`;
  }

  if (busted) {
    return `O bonde foi desmontado durante ${crimeName}.`;
  }

  return `O bonde falhou em ${crimeName}.`;
}

function calculateFactionCrimeHpLoss(levelRequired: number, busted: boolean): number {
  const baseLoss = Math.max(8, Math.round(levelRequired * 5));
  return busted ? baseLoss + 10 : baseLoss;
}

function calculatePlayerPower(playerContext: CrimePlayerContext, crimeType: CrimeType): number {
  const weaponPower =
    playerContext.equipment.weapon && (playerContext.equipment.weapon.durability ?? 0) > 0
      ? resolveWeaponEffectivePower(
          playerContext.equipment.weapon.power,
          playerContext.equipment.weapon.proficiency,
        )
      : 0;
  const vestDefense =
    playerContext.equipment.vest && (playerContext.equipment.vest.durability ?? 0) > 0
      ? playerContext.equipment.vest.defense
      : 0;
  const attributePower =
    playerContext.attributes.forca * 8 +
    playerContext.attributes.inteligencia * 6 +
    playerContext.attributes.resistencia * 7 +
    playerContext.attributes.carisma * 5;
  const equipmentPower = weaponPower + vestDefense * 6;
  const factionBonus = crimeType === CrimeType.Solo || !playerContext.factionId ? 1 : 1.08;
  const vocationMultiplier = resolveVocationPowerMultiplier(playerContext.player.vocation);

  return Math.round(
    (attributePower + equipmentPower + playerContext.player.level * 10) *
      factionBonus *
      vocationMultiplier,
  );
}

function calculateRewardAmount(min: number, max: number, roll: number): number {
  if (max <= min) {
    return min;
  }

  return Math.round(min + (max - min) * clamp(roll, 0, 1));
}

function canCoordinateFactionCrime(rank: FactionRank, coordinatorRanks: FactionRank[]): boolean {
  return coordinatorRanks.includes(rank);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function estimateSuccessChance(power: number, minimumPower: number): number {
  if (power < minimumPower * 0.5) {
    return 0;
  }

  if (power >= minimumPower * 3) {
    return 0.99;
  }

  return clamp(power / (minimumPower * 2), 0.05, 0.99);
}

function mapCrimeDefinition(crime: typeof crimes.$inferSelect): CrimeDefinitionRecord {
  return {
    arrestChance: crime.arrestChance,
    code: crime.code,
    conceitoReward: crime.conceitoReward,
    cooldownSeconds: crime.cooldownSeconds,
    id: crime.id,
    levelRequired: crime.levelRequired,
    minPower: crime.minPower,
    name: crime.name,
    disposicaoCost: crime.disposicaoCost,
    rewardMax: roundMoney(Number.parseFloat(String(crime.rewardMax))),
    rewardMin: roundMoney(Number.parseFloat(String(crime.rewardMin))),
    cansacoCost: crime.cansacoCost,
    type: crime.crimeType as CrimeType,
  };
}

function resolveCoordinationMultiplier(
  participantCount: number,
  coordinationBonusPerExtraMember: number = COORDINATION_BONUS_PER_EXTRA_MEMBER,
): number {
  return roundMultiplier(
    1 + Math.max(0, participantCount - 1) * coordinationBonusPerExtraMember,
  );
}

function resolveParticipantCrimeLockReason(
  participant: FactionCrimeParticipantContext,
  crime: CrimeDefinitionRecord,
): string | null {
  const readinessLockReason = resolveParticipantReadinessLockReason(participant);

  if (readinessLockReason) {
    return readinessLockReason;
  }

  if (participant.player.level < crime.levelRequired) {
    return `Nivel insuficiente. Requer nivel ${crime.levelRequired}.`;
  }

  if (participant.player.resources.cansaco < crime.cansacoCost) {
    return 'Cansaço insuficiente.';
  }

  if (participant.player.resources.disposicao < crime.disposicaoCost) {
    return 'Disposição insuficiente.';
  }

  return null;
}

function resolveParticipantReadinessLockReason(
  participant: FactionCrimeParticipantContext,
): string | null {
  if (!participant.player.characterCreatedAt) {
    return 'Personagem ainda nao foi criado.';
  }

  if (participant.player.resources.hp <= 0) {
    return 'HP esgotado.';
  }

  if (participant.player.resources.cansaco <= 0) {
    return 'Cansaço esgotado.';
  }

  if (participant.player.resources.disposicao <= 0) {
    return 'Disposição esgotada.';
  }

  return null;
}

function resolveVocationPowerMultiplier(vocation: CrimePlayerContext['player']['vocation']): number {
  switch (vocation) {
    case 'cria':
      return 1.02;
    case 'gerente':
      return 1;
    case 'soldado':
      return 1.08;
    case 'politico':
      return 0.96;
    case 'empreendedor':
      return 1.01;
    default:
      return 1;
  }
}

function resolveWeaponEffectivePower(basePower: number, proficiency: number): number {
  if (proficiency <= 0) {
    return basePower;
  }

  const steps = Math.floor(Math.min(100, proficiency) / 10);

  if (steps < 1) {
    return basePower;
  }

  return Math.round(basePower * (1 + steps * 0.02));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function splitMoneyReward(total: number, participants: number): number[] {
  if (participants <= 0) {
    return [];
  }

  const baseShare = roundMoney(total / participants);
  const shares = new Array<number>(participants).fill(baseShare);
  const distributed = roundMoney(baseShare * participants);
  const remainder = roundMoney(total - distributed);

  if (remainder !== 0) {
    shares[0] = roundMoney((shares[0] ?? 0) + remainder);
  }

  return shares;
}
