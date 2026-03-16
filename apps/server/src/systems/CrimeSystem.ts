import { type CrimeCatalogItem, type CrimeRewardRead, CrimeType, VocationType } from '@cs-rio/shared';
import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  crimes,
  drugs,
  factionMembers,
  playerInventory,
  players,
  prisonRecords,
  transactions,
  vests,
  weapons,
} from '../db/schema.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from '../services/university.js';
import { type FactionUpgradeEffectReaderContract } from '../services/faction.js';
import {
  assertPlayerActionUnlocked,
  type HospitalizationStatusReaderContract,
  type PrisonStatusReaderContract,
} from '../services/action-readiness.js';
import {
  buildEmptyResolvedCatalog,
  resolveCrimePolicy,
} from '../services/gameplay-config.js';
import { type GameConfigService } from '../services/game-config.js';
import { CooldownSystem } from './CooldownSystem.js';
import { LevelSystem } from './LevelSystem.js';
import { OverdoseSystem } from './OverdoseSystem.js';
import { PoliceHeatSystem } from './PoliceHeatSystem.js';
import { PrisonSystem } from './PrisonSystem.js';

const MAX_ARREST_CHANCE = 0.95;
const MIN_SUCCESS_CHANCE = 0.05;
const WEAPON_PROFICIENCY_BONUS_PER_STEP = 0.02;
const WEAPON_PROFICIENCY_MAX = 100;
const WEAPON_PROFICIENCY_STEP_SIZE = 10;

const VOCATION_POWER_MULTIPLIERS: Record<VocationType, number> = {
  [VocationType.Cria]: 1.02,
  [VocationType.Gerente]: 1,
  [VocationType.Soldado]: 1.08,
  [VocationType.Politico]: 0.96,
  [VocationType.Empreendedor]: 1.01,
};

type CrimeRow = typeof crimes.$inferSelect;

export interface CrimeDefinitionRecord {
  arrestChance: number;
  code: string;
  conceitoReward: number;
  cooldownSeconds: number;
  id: string;
  levelRequired: number;
  minPower: number;
  name: string;
  disposicaoCost: number;
  rewardMax: number;
  rewardMin: number;
  cansacoCost: number;
  type: CrimeType;
}

export interface CrimeDropCandidate {
  itemId: string;
  itemName: string;
  itemType: 'drug';
  quantity: number;
}

export interface CrimeResourcesSnapshot {
  addiction: number;
  conceito: number;
  hp: number;
  money: number;
  disposicao: number;
  cansaco: number;
}

export interface CrimeEquippedWeapon {
  durability: number | null;
  inventoryItemId: string;
  power: number;
  proficiency: number;
}

export interface CrimeEquippedVest {
  defense: number;
  durability: number | null;
  inventoryItemId: string;
}

export interface CrimeDurabilityUpdate {
  inventoryItemId: string;
  nextDurability: number;
  unequip: boolean;
}

export interface CrimeProficiencyUpdate {
  inventoryItemId: string;
  nextProficiency: number;
}

export interface CrimePlayerContext {
  attributes: {
    carisma: number;
    forca: number;
    inteligencia: number;
    resistencia: number;
  };
  equipment: {
    vest: CrimeEquippedVest | null;
    weapon: CrimeEquippedWeapon | null;
  };
  factionId: string | null;
  player: {
    characterCreatedAt: Date | null;
    id: string;
    level: number;
    nickname: string;
    resources: CrimeResourcesSnapshot;
    vocation: VocationType;
  };
}

export interface CrimePersistenceInput {
  arrested: boolean;
  crime: CrimeDefinitionRecord;
  durabilityUpdates: CrimeDurabilityUpdate[];
  drop: CrimeDropCandidate | null;
  logDescription: string;
  logType: 'crime_arrested' | 'crime_failure' | 'crime_success';
  moneyDelta: number;
  nextLevel: number;
  nextResources: CrimeResourcesSnapshot;
  playerId: string;
  prisonReleaseAt: Date | null;
  proficiencyUpdates: CrimeProficiencyUpdate[];
}

export interface CrimePersistedState {
  drop: CrimeDropCandidate | null;
  level: number;
  resources: CrimeResourcesSnapshot;
}

export interface CrimeRepository {
  getCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null>;
  getDropCandidatesForCrimeLevel(levelRequired: number): Promise<CrimeDropCandidate[]>;
  listCrimes(): Promise<CrimeDefinitionRecord[]>;
  getPlayerContext(playerId: string): Promise<CrimePlayerContext | null>;
  persistCrimeAttempt(input: CrimePersistenceInput): Promise<CrimePersistedState>;
}

export interface CrimeAttemptResult {
  arrestChance: number;
  arrested: boolean;
  chance: number;
  crimeId: string;
  crimeName: string;
  cooldownRemainingSeconds: number;
  conceitoDelta: number;
  drop: CrimeDropCandidate | null;
  heatAfter: number;
  heatBefore: number;
  hpDelta: number;
  leveledUp: boolean;
  level: number;
  message: string;
  moneyDelta: number;
  nextConceitoRequired: number | null;
  nextLevel: number | null;
  disposicaoSpent: number;
  playerPower: number;
  resources: CrimeResourcesSnapshot;
  cansacoSpent: number;
  success: boolean;
}

export interface CrimeSystemOptions {
  cooldownSystem?: CooldownSystem;
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  gameConfigService?: Pick<GameConfigService, 'getResolvedCatalog'>;
  hospitalizationSystem?: HospitalizationStatusReaderContract;
  levelSystem?: LevelSystem;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
  prisonSystem?: PrisonStatusReaderContract;
  random?: () => number;
  repository?: CrimeRepository;
  universityReader?: UniversityEffectReaderContract;
}

type CrimeErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'cooldown_active'
  | 'forbidden'
  | 'faction_required'
  | 'insufficient_resources'
  | 'level_required'
  | 'not_found'
  | 'validation';

export class CrimeError extends Error {
  constructor(
    public readonly code: CrimeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CrimeError';
  }
}

export class DatabaseCrimeRepository implements CrimeRepository {
  async getCrimeById(crimeId: string): Promise<CrimeDefinitionRecord | null> {
    const [crime] = await db.select().from(crimes).where(eq(crimes.id, crimeId)).limit(1);
    return crime ? mapCrimeDefinition(crime) : null;
  }

  async getDropCandidatesForCrimeLevel(levelRequired: number): Promise<CrimeDropCandidate[]> {
    const eligibleLevel = Math.max(2, levelRequired);
    const rows = await db
      .select({
        id: drugs.id,
        name: drugs.name,
      })
      .from(drugs)
      .where(lte(drugs.productionLevel, eligibleLevel));

    return rows.map((row) => ({
      itemId: row.id,
      itemName: row.name,
      itemType: 'drug' as const,
      quantity: 1,
    }));
  }

  async listCrimes(): Promise<CrimeDefinitionRecord[]> {
    const rows = await db.select().from(crimes).orderBy(asc(crimes.levelRequired), asc(crimes.name));
    return rows.map(mapCrimeDefinition);
  }

  async getPlayerContext(playerId: string): Promise<CrimePlayerContext | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);

    if (!player) {
      return null;
    }

    const [membership, bestWeapon, bestVest] = await Promise.all([
      db
        .select({
          factionId: factionMembers.factionId,
        })
        .from(factionMembers)
        .where(eq(factionMembers.playerId, playerId))
        .limit(1),
      db
        .select({
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
          power: weapons.power,
          proficiency: playerInventory.proficiency,
        })
        .from(playerInventory)
        .innerJoin(weapons, eq(playerInventory.itemId, weapons.id))
        .where(
          and(
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.itemType, 'weapon'),
            eq(playerInventory.equippedSlot, 'weapon'),
          ),
        )
        .orderBy(desc(weapons.power), desc(playerInventory.proficiency))
        .limit(1),
      db
        .select({
          defense: vests.defense,
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
        })
        .from(playerInventory)
        .innerJoin(vests, eq(playerInventory.itemId, vests.id))
        .where(
          and(
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.itemType, 'vest'),
            eq(playerInventory.equippedSlot, 'vest'),
          ),
        )
        .orderBy(desc(vests.defense), desc(playerInventory.proficiency))
        .limit(1),
    ]);

    return {
      attributes: {
        carisma: player.carisma,
        forca: player.forca,
        inteligencia: player.inteligencia,
        resistencia: player.resistencia,
      },
      equipment: {
        vest: bestVest[0]
          ? {
              defense: bestVest[0].defense,
              durability: bestVest[0].durability,
              inventoryItemId: bestVest[0].inventoryItemId,
            }
          : null,
        weapon: bestWeapon[0]
          ? {
              durability: bestWeapon[0].durability,
              inventoryItemId: bestWeapon[0].inventoryItemId,
              power: bestWeapon[0].power,
              proficiency: bestWeapon[0].proficiency,
            }
          : null,
      },
      factionId: membership[0]?.factionId ?? player.factionId ?? null,
      player: {
        characterCreatedAt: player.characterCreatedAt,
        id: player.id,
        level: player.level,
        nickname: player.nickname,
        resources: {
          addiction: player.addiction,
          conceito: player.conceito,
          hp: player.hp,
          money: Number(player.money),
          disposicao: player.disposicao,
          cansaco: player.cansaco,
        },
        vocation: player.vocation as VocationType,
      },
    };
  }

  async persistCrimeAttempt(input: CrimePersistenceInput): Promise<CrimePersistedState> {
    return db.transaction(async (tx) => {
      await tx
        .update(players)
        .set({
          addiction: input.nextResources.addiction,
          conceito: input.nextResources.conceito,
          hp: input.nextResources.hp,
          level: input.nextLevel,
          money: formatMoney(input.nextResources.money),
          disposicao: input.nextResources.disposicao,
          cansaco: input.nextResources.cansaco,
        })
        .where(eq(players.id, input.playerId));

      if (input.drop) {
        const [existingInventoryEntry] = await tx
          .select({
            id: playerInventory.id,
            quantity: playerInventory.quantity,
          })
          .from(playerInventory)
          .where(
            and(
              eq(playerInventory.playerId, input.playerId),
              eq(playerInventory.itemType, input.drop.itemType),
              eq(playerInventory.itemId, input.drop.itemId),
            ),
          )
          .limit(1);

        if (existingInventoryEntry) {
          await tx
            .update(playerInventory)
            .set({
              quantity: existingInventoryEntry.quantity + input.drop.quantity,
            })
            .where(eq(playerInventory.id, existingInventoryEntry.id));
        } else {
          await tx.insert(playerInventory).values({
            itemId: input.drop.itemId,
            itemType: input.drop.itemType,
            playerId: input.playerId,
            proficiency: 0,
            quantity: input.drop.quantity,
          });
        }
      }

      const inventoryUpdateMap = new Map<
        string,
        {
          durability?: number;
          equippedSlot?: null;
          proficiency?: number;
        }
      >();

      for (const durabilityUpdate of input.durabilityUpdates) {
        const currentUpdate = inventoryUpdateMap.get(durabilityUpdate.inventoryItemId) ?? {};
        currentUpdate.durability = durabilityUpdate.nextDurability;

        if (durabilityUpdate.unequip) {
          currentUpdate.equippedSlot = null;
        }

        inventoryUpdateMap.set(durabilityUpdate.inventoryItemId, currentUpdate);
      }

      for (const proficiencyUpdate of input.proficiencyUpdates) {
        const currentUpdate = inventoryUpdateMap.get(proficiencyUpdate.inventoryItemId) ?? {};
        currentUpdate.proficiency = proficiencyUpdate.nextProficiency;
        inventoryUpdateMap.set(proficiencyUpdate.inventoryItemId, currentUpdate);
      }

      for (const [inventoryItemId, updatePayload] of inventoryUpdateMap) {
        await tx
          .update(playerInventory)
          .set(updatePayload)
          .where(
            and(
              eq(playerInventory.id, inventoryItemId),
              eq(playerInventory.playerId, input.playerId),
            ),
          );
      }

      if (input.arrested && input.prisonReleaseAt) {
        await tx.insert(prisonRecords).values({
          playerId: input.playerId,
          reason: `Flagrado em ${input.crime.name}`,
          releaseAt: input.prisonReleaseAt,
          sentencedAt: new Date(),
        });
      }

      await tx.insert(transactions).values({
        amount: formatMoney(input.moneyDelta),
        description: input.logDescription,
        playerId: input.playerId,
        type: input.logType,
      });

      return {
        drop: input.drop,
        level: input.nextLevel,
        resources: input.nextResources,
      };
    });
  }
}

export class CrimeSystem {
  private readonly cooldownSystem: CooldownSystem;

  private readonly levelSystem: LevelSystem;

  private readonly hospitalizationSystem: HospitalizationStatusReaderContract;

  private readonly now: () => Date;

  private readonly ownsCooldownSystem: boolean;

  private readonly ownsHospitalizationSystem: boolean;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly ownsPrisonSystem: boolean;

  private readonly policeHeatSystem: PoliceHeatSystem;

  private readonly prisonSystem: PrisonStatusReaderContract;

  private readonly random: () => number;

  private readonly repository: CrimeRepository;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly gameConfigService: Pick<GameConfigService, 'getResolvedCatalog'>;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: CrimeSystemOptions = {}) {
    this.ownsCooldownSystem = !options.cooldownSystem;
    this.ownsHospitalizationSystem = !options.hospitalizationSystem;
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.ownsPrisonSystem = !options.prisonSystem;
    this.cooldownSystem = options.cooldownSystem ?? new CooldownSystem();
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.hospitalizationSystem =
      options.hospitalizationSystem ??
      new OverdoseSystem();
    this.policeHeatSystem = options.policeHeatSystem ?? new PoliceHeatSystem();
    this.prisonSystem =
      options.prisonSystem ??
      new PrisonSystem();
    this.random = options.random ?? (() => Math.random());
    this.repository = options.repository ?? new DatabaseCrimeRepository();
    this.gameConfigService = options.gameConfigService ?? {
      async getResolvedCatalog() {
        return buildEmptyResolvedCatalog();
      },
    };
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
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsCooldownSystem) {
      await this.cooldownSystem.close();
    }

    if (this.ownsHospitalizationSystem) {
      await this.hospitalizationSystem.close?.();
    }

    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close();
    }

    if (this.ownsPrisonSystem) {
      await this.prisonSystem.close?.();
    }
  }

  async getCrimeCatalog(playerId: string): Promise<CrimeCatalogItem[]> {
    const [playerContext, availableCrimes, passiveProfile, configCatalog] = await Promise.all([
      this.repository.getPlayerContext(playerId),
      this.repository.listCrimes(),
      this.universityReader.getPassiveProfile(playerId),
      this.gameConfigService.getResolvedCatalog(),
    ]);

    if (!playerContext) {
      throw new CrimeError('not_found', 'Jogador nao encontrado.');
    }

    if (!playerContext.player.characterCreatedAt) {
      throw new CrimeError('character_not_ready', 'Crie o personagem antes de cometer crimes.');
    }

    await this.assertCrimeActionUnlocked(playerId);

    const effectivePlayerContext = await this.applyFactionUpgradeEffects(playerContext);
    const crimePolicy = resolveCrimePolicy(configCatalog);

    const cooldowns = await Promise.all(
      availableCrimes.map((crime) => this.cooldownSystem.getCrimeCooldown(playerId, crime.id)),
    );

    return availableCrimes.map((crime, index) => {
      const cooldown = cooldowns[index] ?? {
        active: false,
        expiresAt: null,
        key: `crime:${playerId}:${crime.id}`,
        remainingSeconds: 0,
      };
      const playerPower = this.calculatePlayerPower(effectivePlayerContext, crime.type);
      const rewardRange = resolveCrimeRewardRange(crime, passiveProfile);
      const visibleRewardRange = resolveVisibleCrimeRewardRange(
        rewardRange,
        passiveProfile.crime.revealsTargetValue,
      );
      const estimatedSuccessChance = Math.round(
        this.estimateCrimeSuccessChance(
          playerPower,
          crime,
          crimePolicy.minimumPowerRatio,
          passiveProfile,
        ) * 100,
      );
      const levelLocked = effectivePlayerContext.player.level < crime.levelRequired;
      const factionLocked = crime.type !== CrimeType.Solo && !effectivePlayerContext.factionId;
      const resourceBlocked =
        effectivePlayerContext.player.resources.cansaco < crime.cansacoCost ||
        effectivePlayerContext.player.resources.disposicao < crime.disposicaoCost;
      const lockReason = resolveCrimeLockReason({
        cooldownRemainingSeconds: cooldown.remainingSeconds,
        factionLocked,
        levelLocked,
        playerLevel: effectivePlayerContext.player.level,
        requiredLevel: crime.levelRequired,
        resourceBlocked,
      });

      return {
        arrestChance: crime.arrestChance,
        cooldownRemainingSeconds: cooldown.remainingSeconds,
        estimatedSuccessChance,
        id: crime.id,
        isLocked: levelLocked || factionLocked,
        isOnCooldown: cooldown.active,
        isRunnable: !levelLocked && !factionLocked && !cooldown.active && !resourceBlocked,
        levelRequired: crime.levelRequired,
        lockReason,
        minPower: crime.minPower,
        name: crime.name,
        playerPower,
        disposicaoCost: crime.disposicaoCost,
        conceitoReward: crime.conceitoReward,
        rewardMax: visibleRewardRange.max,
        rewardMin: visibleRewardRange.min,
        rewardRead: visibleRewardRange.read,
        cansacoCost: crime.cansacoCost,
        type: crime.type,
      };
    });
  }

  async getCrimeCooldown(playerId: string, crimeId: string) {
    return this.cooldownSystem.getCrimeCooldown(playerId, crimeId);
  }

  calculatePlayerPower(playerContext: CrimePlayerContext, crimeType: CrimeType): number {
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
    const vocationMultiplier = VOCATION_POWER_MULTIPLIERS[playerContext.player.vocation] ?? 1;

    return Math.round(
      (attributePower + equipmentPower + playerContext.player.level * 10) *
        factionBonus *
        vocationMultiplier,
    );
  }

  estimateSuccessChance(power: number, minimumPower: number, minimumPowerRatio: number): number {
    if (power < minimumPower * minimumPowerRatio) {
      return 0;
    }

    if (power >= minimumPower * 3) {
      return 0.99;
    }

    return clamp(power / (minimumPower * 2), MIN_SUCCESS_CHANCE, 0.99);
  }

  estimateCrimeSuccessChance(
    playerPower: number,
    crime: Pick<CrimeDefinitionRecord, 'minPower' | 'type'>,
    minimumPowerRatio: number,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): number {
    const baseChance = this.estimateSuccessChance(playerPower, crime.minPower, minimumPowerRatio);

    if (crime.type !== CrimeType.Solo) {
      return baseChance;
    }

    return clamp(baseChance * passiveProfile.crime.soloSuccessMultiplier, MIN_SUCCESS_CHANCE, 0.99);
  }

  async attemptCrime(playerId: string, crimeId: string): Promise<CrimeAttemptResult> {
    const [crime, playerContext] = await Promise.all([
      this.repository.getCrimeById(crimeId),
      this.repository.getPlayerContext(playerId),
    ]);

    if (!crime || !playerContext) {
      throw new CrimeError('not_found', 'Crime ou jogador nao encontrado.');
    }

    if (!playerContext.player.characterCreatedAt) {
      throw new CrimeError('character_not_ready', 'Crie o personagem antes de cometer crimes.');
    }

    await this.assertCrimeActionUnlocked(playerId);

    const effectivePlayerContext = await this.applyFactionUpgradeEffects(playerContext);

    if (crime.type !== CrimeType.Solo && !effectivePlayerContext.factionId) {
      throw new CrimeError('faction_required', 'Esse crime exige que o jogador esteja em uma faccao.');
    }

    if (effectivePlayerContext.player.level < crime.levelRequired) {
      throw new CrimeError(
        'level_required',
        `Nivel insuficiente. Necessario nivel ${crime.levelRequired}.`,
      );
    }

    if (
      effectivePlayerContext.player.resources.cansaco < crime.cansacoCost ||
      effectivePlayerContext.player.resources.disposicao < crime.disposicaoCost
    ) {
      throw new CrimeError(
        'insufficient_resources',
        'Cansaço ou disposição insuficientes para executar esse crime.',
      );
    }

    const [cooldown, passiveProfile] = await Promise.all([
      this.cooldownSystem.getCrimeCooldown(playerId, crimeId),
      this.universityReader.getPassiveProfile(playerId),
    ]);

    if (cooldown.active) {
      throw new CrimeError(
        'cooldown_active',
        `Crime em cooldown por mais ${cooldown.remainingSeconds}s.`,
      );
    }

    const [heatBeforeState, configCatalog] = await Promise.all([
      this.policeHeatSystem.getHeat(playerId),
      this.gameConfigService.getResolvedCatalog(),
    ]);
    const crimePolicy = resolveCrimePolicy(configCatalog);
    const playerPower = this.calculatePlayerPower(effectivePlayerContext, crime.type);
    const chance = this.estimateCrimeSuccessChance(
      playerPower,
      crime,
      crimePolicy.minimumPowerRatio,
      passiveProfile,
    );
    const success = this.random() <= chance;

    const cansacoAfter = clamp(effectivePlayerContext.player.resources.cansaco - crime.cansacoCost, 0, 100);
    const disposicaoAfter = clamp(effectivePlayerContext.player.resources.disposicao - crime.disposicaoCost, 0, 100);
    const baseResources: CrimeResourcesSnapshot = {
      ...effectivePlayerContext.player.resources,
      disposicao: disposicaoAfter,
      cansaco: cansacoAfter,
    };

    let arrested = false;
    let arrestChance = 0;
    let conceitoDelta = 0;
    let drop: CrimeDropCandidate | null = null;
    let hpDelta = 0;
    let moneyDelta = 0;
    let message = '';
    let logType: CrimePersistenceInput['logType'] = 'crime_failure';
    let prisonReleaseAt: Date | null = null;

    if (success) {
      const rewardRange = resolveCrimeRewardRange(crime, passiveProfile);
      moneyDelta = calculateRewardAmount(rewardRange.min, rewardRange.max, this.random());
      conceitoDelta = crime.conceitoReward;
      drop = await this.tryResolveDrop(crime.levelRequired);
      logType = 'crime_success';
      message = `Crime concluido com sucesso: ${crime.name}.`;
    } else {
      arrestChance = calculateArrestChance(crime.arrestChance, heatBeforeState.score);
      arrestChance = clamp(
        arrestChance * passiveProfile.crime.arrestChanceMultiplier,
        0,
        MAX_ARREST_CHANCE,
      );
      arrested = this.random() <= arrestChance;
      hpDelta = -calculateHpLoss(crime.levelRequired, arrested);
      conceitoDelta = -Math.max(1, Math.round(crime.conceitoReward * (arrested ? 0.75 : 0.4)));
      prisonReleaseAt = arrested
        ? new Date(
            this.now().getTime() +
              crime.levelRequired * crimePolicy.prisonMinutesPerLevel * 60 * 1000,
          )
        : null;
      logType = arrested ? 'crime_arrested' : 'crime_failure';
      message = arrested
        ? `Crime falhou e o jogador foi preso em ${crime.name}.`
        : `Crime falhou em ${crime.name}.`;
    }

    const nextResources = {
      ...baseResources,
      conceito: clamp(effectivePlayerContext.player.resources.conceito + conceitoDelta, 0, Number.MAX_SAFE_INTEGER),
      hp: clamp(effectivePlayerContext.player.resources.hp + hpDelta, 0, 100),
      money: roundMoney(effectivePlayerContext.player.resources.money + moneyDelta),
    };
    const durabilityUpdates = resolveDurabilityUpdates(effectivePlayerContext, crime.levelRequired, {
      arrested,
      hpDelta,
      success,
    });
    const proficiencyUpdates = resolveWeaponProficiencyUpdates(
      effectivePlayerContext,
      crime.levelRequired,
      success,
    );
    const levelProgression = this.levelSystem.resolve(
      nextResources.conceito,
      effectivePlayerContext.player.level,
    );
    await this.assertCrimeActionUnlocked(playerId);
    const persistedState = await this.repository.persistCrimeAttempt({
      arrested,
      crime,
      durabilityUpdates,
      drop,
      logDescription: buildCrimeLogDescription({
        arrested,
        crimeName: crime.name,
        dropName: drop?.itemName ?? null,
        moneyDelta,
      }),
      logType,
      moneyDelta,
      nextLevel: levelProgression.level,
      nextResources,
      playerId,
      prisonReleaseAt,
      proficiencyUpdates,
    });
    const heatAfterState = await this.policeHeatSystem.addHeat(playerId, calculateHeatGain(crime));

    const nextCooldown = await this.cooldownSystem.activateCrimeCooldown(
      playerId,
      crimeId,
      crime.cooldownSeconds,
    );

    return {
      arrestChance,
      arrested,
      chance,
      crimeId: crime.id,
      crimeName: crime.name,
      cooldownRemainingSeconds: nextCooldown.remainingSeconds,
      conceitoDelta,
      drop: persistedState.drop,
      heatAfter: heatAfterState.score,
      heatBefore: heatBeforeState.score,
      hpDelta,
      leveledUp: levelProgression.leveledUp,
      level: persistedState.level,
      message,
      moneyDelta,
      nextConceitoRequired: levelProgression.nextConceitoRequired,
      nextLevel: levelProgression.nextLevel,
      disposicaoSpent: crime.disposicaoCost,
      playerPower,
      resources: persistedState.resources,
      cansacoSpent: crime.cansacoCost,
      success,
    };
  }

  private async tryResolveDrop(levelRequired: number): Promise<CrimeDropCandidate | null> {
    const dropChance = calculateDropChance(levelRequired);

    if (this.random() > dropChance) {
      return null;
    }

    const candidates = await this.repository.getDropCandidatesForCrimeLevel(levelRequired);

    if (candidates.length === 0) {
      return null;
    }

    const index = Math.min(
      candidates.length - 1,
      Math.floor(this.random() * candidates.length),
    );

    return candidates[index] ?? null;
  }

  private async assertCrimeActionUnlocked(playerId: string): Promise<void> {
    await assertPlayerActionUnlocked({
      getHospitalizationStatus: () => this.hospitalizationSystem.getHospitalizationStatus(playerId),
      getPrisonStatus: () => this.prisonSystem.getStatus(playerId),
      hospitalizedError: () =>
        new CrimeError('conflict', 'Jogador hospitalizado nao pode cometer crimes.'),
      imprisonedError: () =>
        new CrimeError('conflict', 'Jogador preso nao pode cometer crimes.'),
    });
  }

  private async applyFactionUpgradeEffects(
    playerContext: CrimePlayerContext,
  ): Promise<CrimePlayerContext> {
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

function buildCrimeLogDescription(input: {
  arrested: boolean;
  crimeName: string;
  dropName: string | null;
  moneyDelta: number;
}): string {
  if (input.arrested) {
    return `Crime ${input.crimeName} falhou e resultou em prisao.`;
  }

  if (input.moneyDelta > 0) {
    return input.dropName
      ? `Crime ${input.crimeName} concluido com sucesso. Recompensa R$ ${input.moneyDelta} e drop ${input.dropName}.`
      : `Crime ${input.crimeName} concluido com sucesso. Recompensa R$ ${input.moneyDelta}.`;
  }

  return `Crime ${input.crimeName} falhou sem prisao.`;
}

function resolveCrimeLockReason(input: {
  cooldownRemainingSeconds: number;
  factionLocked: boolean;
  levelLocked: boolean;
  playerLevel: number;
  requiredLevel: number;
  resourceBlocked: boolean;
}): string | null {
  if (input.levelLocked) {
    return `Requer nivel ${input.requiredLevel}. Atual: ${input.playerLevel}.`;
  }

  if (input.factionLocked) {
    return 'Esse crime exige faccao.';
  }

  if (input.cooldownRemainingSeconds > 0) {
    return `Cooldown ativo: ${input.cooldownRemainingSeconds}s restantes.`;
  }

  if (input.resourceBlocked) {
    return 'Cansaço ou disposição insuficientes.';
  }

  return null;
}

function calculateArrestChance(baseChancePercent: number, heatScore: number): number {
  return clamp((baseChancePercent + heatScore) / 100, MIN_SUCCESS_CHANCE, MAX_ARREST_CHANCE);
}

function calculateDropChance(levelRequired: number): number {
  return clamp(0.04 + levelRequired * 0.015, 0.04, 0.2);
}

function calculateHeatGain(crime: CrimeDefinitionRecord): number {
  return Math.max(
    1,
    Math.round(crime.levelRequired * 2 + crime.disposicaoCost / 5 + crime.cansacoCost / 10),
  );
}

function resolveDurabilityUpdates(
  playerContext: CrimePlayerContext,
  crimeLevel: number,
  result: {
    arrested: boolean;
    hpDelta: number;
    success: boolean;
  },
): CrimeDurabilityUpdate[] {
  const updates: CrimeDurabilityUpdate[] = [];
  const weaponWear = Math.max(1, Math.ceil(crimeLevel / 2)) + (result.success ? 0 : 1);
  const vestWear =
    result.hpDelta < 0 ? Math.max(1, Math.ceil(crimeLevel / 3)) + (result.arrested ? 1 : 0) : 0;

  if (playerContext.equipment.weapon && (playerContext.equipment.weapon.durability ?? 0) > 0) {
    const nextDurability = Math.max(0, (playerContext.equipment.weapon.durability ?? 0) - weaponWear);
    updates.push({
      inventoryItemId: playerContext.equipment.weapon.inventoryItemId,
      nextDurability,
      unequip: nextDurability === 0,
    });
  }

  if (
    vestWear > 0 &&
    playerContext.equipment.vest &&
    (playerContext.equipment.vest.durability ?? 0) > 0
  ) {
    const nextDurability = Math.max(0, (playerContext.equipment.vest.durability ?? 0) - vestWear);
    updates.push({
      inventoryItemId: playerContext.equipment.vest.inventoryItemId,
      nextDurability,
      unequip: nextDurability === 0,
    });
  }

  return updates;
}

function resolveWeaponProficiencyUpdates(
  playerContext: CrimePlayerContext,
  crimeLevel: number,
  success: boolean,
): CrimeProficiencyUpdate[] {
  const weapon = playerContext.equipment.weapon;

  if (!weapon || (weapon.durability ?? 0) <= 0) {
    return [];
  }

  const nextProficiency = Math.min(
    WEAPON_PROFICIENCY_MAX,
    weapon.proficiency + calculateWeaponProficiencyGain(crimeLevel, success),
  );

  if (nextProficiency === weapon.proficiency) {
    return [];
  }

  return [
    {
      inventoryItemId: weapon.inventoryItemId,
      nextProficiency,
    },
  ];
}

function calculateWeaponProficiencyGain(crimeLevel: number, success: boolean): number {
  if (!success) {
    return 1;
  }

  return Math.max(2, Math.ceil(crimeLevel / 2));
}

function resolveWeaponEffectivePower(basePower: number, proficiency: number): number {
  if (proficiency <= 0) {
    return basePower;
  }

  const steps = Math.min(
    WEAPON_PROFICIENCY_MAX / WEAPON_PROFICIENCY_STEP_SIZE,
    Math.floor(Math.min(WEAPON_PROFICIENCY_MAX, proficiency) / WEAPON_PROFICIENCY_STEP_SIZE),
  );

  if (steps < 1) {
    return basePower;
  }

  return Math.round(basePower * (1 + steps * WEAPON_PROFICIENCY_BONUS_PER_STEP));
}

function calculateHpLoss(levelRequired: number, arrested: boolean): number {
  const baseLoss = Math.max(4, Math.round(levelRequired * 4.5));
  return arrested ? baseLoss + 8 : baseLoss;
}

function calculateRewardAmount(min: number, max: number, roll: number): number {
  if (max <= min) {
    return min;
  }

  return Math.round(min + (max - min) * clamp(roll, 0, 1));
}

function resolveCrimeRewardRange(
  crime: Pick<CrimeDefinitionRecord, 'levelRequired' | 'rewardMax' | 'rewardMin' | 'type'>,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
): {
  max: number;
  min: number;
} {
  if (crime.type !== CrimeType.Solo || crime.levelRequired > 4) {
    return {
      max: crime.rewardMax,
      min: crime.rewardMin,
    };
  }

  return {
    max: Math.round(crime.rewardMax * passiveProfile.crime.lowLevelSoloRewardMultiplier),
    min: Math.round(crime.rewardMin * passiveProfile.crime.lowLevelSoloRewardMultiplier),
  };
}

function resolveVisibleCrimeRewardRange(
  actualRange: { max: number; min: number },
  revealsTargetValue: boolean,
): {
  max: number;
  min: number;
  read: CrimeRewardRead;
} {
  if (revealsTargetValue) {
    return {
      ...actualRange,
      read: 'exact',
    };
  }

  const step = resolveCrimeRewardHintStep(actualRange.max);
  let min = Math.max(step, Math.floor(actualRange.min / step) * step);
  let max = Math.max(min + step, Math.ceil(actualRange.max / step) * step);

  if (min === actualRange.min && max === actualRange.max) {
    min = Math.max(step, min - step);
    max += step;
  }

  return {
    max,
    min,
    read: 'approximate',
  };
}

function resolveCrimeRewardHintStep(maxReward: number): number {
  if (maxReward <= 500) {
    return 100;
  }

  if (maxReward <= 2_000) {
    return 250;
  }

  if (maxReward <= 10_000) {
    return 1_000;
  }

  if (maxReward <= 100_000) {
    return 5_000;
  }

  return 50_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

function mapCrimeDefinition(crime: CrimeRow): CrimeDefinitionRecord {
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
    rewardMax: Number(crime.rewardMax),
    rewardMin: Number(crime.rewardMin),
    cansacoCost: crime.cansacoCost,
    type: crime.crimeType as CrimeType,
  };
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
