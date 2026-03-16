import { VocationType, type PlayerAttributes, type RegionId } from '@cs-rio/shared';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  factionMembers,
  playerInventory,
  players,
  vests,
  weapons,
} from '../db/schema.js';
import {
  NoopFactionUpgradeEffectReader,
  type FactionUpgradeEffectReaderContract,
} from '../services/faction.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from '../services/university.js';
import { PoliceHeatSystem } from './PoliceHeatSystem.js';

const AMBUSH_COORDINATION_BONUS_PER_EXTRA_MEMBER = 0.05;
const AMBUSH_COORDINATION_MAX = 1.2;
const ATTRIBUTE_STEAL_PERCENT_MAX = 0.05;
const ATTRIBUTE_STEAL_PERCENT_MIN = 0.01;
const ATTRIBUTE_STEAL_POINTS_CAP = 50;
const HARD_FAIL_HP_LOSS = 20;
const LOW_HP_DAMAGE_THRESHOLD = 35;
const MAX_PLAYER_HEALTH = 100;
const TOTAL_TAKEDOWN_EXTRA_LOOT_MAX = 0.35;
const TOTAL_TAKEDOWN_EXTRA_LOOT_MIN = 0.2;
const VICTORY_LOOT_MAX = 0.25;
const VICTORY_LOOT_MIN = 0.1;
const WEAPON_PROFICIENCY_BONUS_PER_STEP = 0.02;
const WEAPON_PROFICIENCY_MAX = 100;
const WEAPON_PROFICIENCY_STEP_SIZE = 10;

type CombatHeatLevel = 'cacado' | 'frio' | 'marcado' | 'observado' | 'quente';

export type CombatMode = 'ambush' | 'assault' | 'contract';
export type CombatResultTier =
  | 'clear_victory'
  | 'hard_fail'
  | 'narrow_victory'
  | 'total_takedown';
export type CombatHospitalizationSeverity = 'heavy' | 'light' | 'none' | 'standard';
export type CombatAttributeKey = keyof Pick<
  PlayerAttributes,
  'carisma' | 'forca' | 'inteligencia' | 'resistencia'
>;

const ASSAULT_VOCATION_POWER_MULTIPLIERS: Record<VocationType, number> = {
  [VocationType.Cria]: 1,
  [VocationType.Empreendedor]: 1,
  [VocationType.Gerente]: 1,
  [VocationType.Politico]: 0.98,
  [VocationType.Soldado]: 1.1,
};

export interface CombatResourcesSnapshot {
  conceito: number;
  heat: number;
  hp: number;
  money: number;
  cansaco: number;
}

export interface CombatEquippedWeapon {
  durability: number | null;
  inventoryItemId: string;
  power: number;
  proficiency: number;
}

export interface CombatEquippedVest {
  defense: number;
  durability: number | null;
  inventoryItemId: string;
}

export interface CombatPlayerContext {
  attributes: Pick<PlayerAttributes, 'carisma' | 'forca' | 'inteligencia' | 'resistencia'>;
  equipment: {
    vest: CombatEquippedVest | null;
    weapon: CombatEquippedWeapon | null;
  };
  factionId: string | null;
  player: {
    characterCreatedAt: Date | null;
    id: string;
    level: number;
    nickname: string;
    regionId: RegionId;
    resources: CombatResourcesSnapshot;
    vocation: VocationType;
  };
}

export interface CombatPowerBreakdown {
  attributePower: number;
  equipmentPower: number;
  factionMultiplier: number;
  total: number;
  universityMultiplier: number;
  vocationMultiplier: number;
}

export interface CombatPowerProfile {
  breakdown: CombatPowerBreakdown;
  power: number;
}

export interface CombatMoneyLootSummary {
  amount: number;
  percentage: number;
}

export interface CombatAttributeStealSummary {
  amount: number;
  attribute: CombatAttributeKey;
  percentage: number;
}

export interface CombatHospitalizationSummary {
  durationMinutes: number;
  recommended: boolean;
  severity: CombatHospitalizationSeverity;
}

export interface CombatFatalitySummary {
  defenderDied: boolean;
  eligible: boolean;
  chance: number;
}

export interface CombatResolution {
  attacker: {
    conceitoDelta: number;
    heatDelta: number;
    hospitalization: CombatHospitalizationSummary;
    hpAfter: number;
    hpDelta: number;
  };
  attackerPower: CombatPowerProfile;
  attributeSteal: CombatAttributeStealSummary | null;
  defender: {
    hospitalization: CombatHospitalizationSummary;
    hpAfter: number;
    hpDelta: number;
    prisonFollowUpChance: number;
  };
  defenderPower: CombatPowerProfile;
  fatality: CombatFatalitySummary;
  heatLevel: CombatHeatLevel;
  loot: CombatMoneyLootSummary | null;
  message: string;
  mode: CombatMode;
  powerRatio: number;
  success: boolean;
  tier: CombatResultTier;
}

export interface CombatRepository {
  getPlayerContext(playerId: string): Promise<CombatPlayerContext | null>;
}

export interface CombatSystemOptions {
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  policeHeatSystem?: PoliceHeatSystem;
  random?: () => number;
  repository?: CombatRepository;
  universityReader?: UniversityEffectReaderContract;
}

export class DatabaseCombatRepository implements CombatRepository {
  constructor(private readonly policeHeatSystem: Pick<PoliceHeatSystem, 'getHeat'>) {}

  async getPlayerContext(playerId: string): Promise<CombatPlayerContext | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);

    if (!player) {
      return null;
    }

    const [heatState, membership, bestWeapon, bestVest] = await Promise.all([
      this.policeHeatSystem.getHeat(playerId),
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
        regionId: player.regionId as RegionId,
        resources: {
          conceito: player.conceito,
          heat: heatState.score,
          hp: player.hp,
          money: Number(player.money),
          cansaco: player.cansaco,
        },
        vocation: player.vocation as VocationType,
      },
    };
  }
}

export class CombatSystem {
  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly random: () => number;

  private readonly repository: CombatRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: CombatSystemOptions = {}) {
    this.factionUpgradeReader =
      options.factionUpgradeReader ?? new NoopFactionUpgradeEffectReader();
    this.random = options.random ?? Math.random;
    this.repository =
      options.repository ??
      new DatabaseCombatRepository(options.policeHeatSystem ?? new PoliceHeatSystem());
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async getPlayerContext(playerId: string): Promise<CombatPlayerContext | null> {
    return this.repository.getPlayerContext(playerId);
  }

  async calculatePlayerPower(
    playerContext: CombatPlayerContext,
    mode: CombatMode = 'assault',
  ): Promise<CombatPowerProfile> {
    const [upgradeEffects, passiveProfile] = await Promise.all([
      this.factionUpgradeReader.getFactionUpgradeEffectsForFaction(playerContext.factionId),
      this.universityReader.getPassiveProfile(playerContext.player.id),
    ]);

    const factionMultiplier = upgradeEffects.attributeBonusMultiplier;
    const effectiveAttributes = applyAttributeMultiplier(playerContext.attributes, factionMultiplier);
    const attributePower =
      effectiveAttributes.forca +
      effectiveAttributes.resistencia / 2 +
      effectiveAttributes.inteligencia * 0.25 +
      effectiveAttributes.carisma * 0.15;
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
    const equipmentPower = weaponPower + vestDefense;
    const vocationMultiplier =
      ASSAULT_VOCATION_POWER_MULTIPLIERS[playerContext.player.vocation] ?? 1;
    const universityMultiplier =
      mode === 'ambush'
        ? passiveProfile.pvp.ambushPowerMultiplier
        : passiveProfile.pvp.assaultPowerMultiplier;
    const total = Math.round(
      (attributePower + equipmentPower) *
        vocationMultiplier *
        universityMultiplier,
    );

    return {
      breakdown: {
        attributePower: roundTwo(attributePower),
        equipmentPower: roundTwo(equipmentPower),
        factionMultiplier: roundTwo(factionMultiplier),
        total,
        universityMultiplier: roundTwo(universityMultiplier),
        vocationMultiplier: roundTwo(vocationMultiplier),
      },
      power: total,
    };
  }

  async calculateAmbushPower(attackers: CombatPlayerContext[]): Promise<number> {
    if (attackers.length === 0) {
      return 0;
    }

    const profiles = await Promise.all(
      attackers.map((attacker) => this.calculatePlayerPower(attacker, 'ambush')),
    );
    const basePower = profiles.reduce((total, profile) => total + profile.power, 0);
    const coordinationMultiplier = clamp(
      1 + Math.max(0, attackers.length - 1) * AMBUSH_COORDINATION_BONUS_PER_EXTRA_MEMBER,
      1,
      AMBUSH_COORDINATION_MAX,
    );

    return Math.round(basePower * coordinationMultiplier);
  }

  async resolveCombat(input: {
    attacker: CombatPlayerContext;
    attackerPower?: number;
    defender: CombatPlayerContext;
    defenderPower?: number;
    mode?: CombatMode;
  }): Promise<CombatResolution> {
    const mode = input.mode ?? 'assault';
    const [attackerProfile, defenderProfile, attackerPassives, defenderPassives] =
      await Promise.all([
        input.attackerPower !== undefined
          ? Promise.resolve({
              breakdown: {
                attributePower: 0,
                equipmentPower: 0,
                factionMultiplier: 1,
                total: input.attackerPower,
                universityMultiplier: 1,
                vocationMultiplier: 1,
              },
              power: input.attackerPower,
            } satisfies CombatPowerProfile)
          : this.calculatePlayerPower(input.attacker, mode),
        input.defenderPower !== undefined
          ? Promise.resolve({
              breakdown: {
                attributePower: 0,
                equipmentPower: 0,
                factionMultiplier: 1,
                total: input.defenderPower,
                universityMultiplier: 1,
                vocationMultiplier: 1,
              },
              power: input.defenderPower,
            } satisfies CombatPowerProfile)
          : this.calculatePlayerPower(input.defender, mode),
        this.universityReader.getPassiveProfile(input.attacker.player.id),
        this.universityReader.getPassiveProfile(input.defender.player.id),
      ]);

    const attackerPower = Math.max(1, attackerProfile.power);
    const defenderPower = Math.max(1, defenderProfile.power);
    const ratio = attackerPower / defenderPower;
    const tier = resolveCombatTier(ratio);
    const defenderDamageMultiplier =
      input.defender.player.resources.hp <= LOW_HP_DAMAGE_THRESHOLD
        ? defenderPassives.pvp.lowHpDamageTakenMultiplier
        : 1;
    const attackerDamageMultiplier = attackerPassives.pvp.damageDealtMultiplier;
    const baseDefenderDamage =
      tier === 'hard_fail'
        ? 0
        : tier === 'narrow_victory'
          ? 42
          : tier === 'clear_victory'
            ? 72
            : 95;
    const defenderHpDelta =
      tier === 'hard_fail'
        ? 0
        : -Math.min(
            input.defender.player.resources.hp,
            Math.round(baseDefenderDamage * attackerDamageMultiplier * defenderDamageMultiplier),
          );
    const attackerHpDelta =
      tier === 'hard_fail'
        ? -Math.min(input.attacker.player.resources.hp, HARD_FAIL_HP_LOSS)
        : tier === 'narrow_victory'
          ? -Math.min(input.attacker.player.resources.hp, 6)
          : tier === 'clear_victory'
            ? -Math.min(input.attacker.player.resources.hp, 4)
            : -Math.min(input.attacker.player.resources.hp, 2);
    const loot = resolveMoneyLoot(
      tier,
      input.defender.player.resources.money,
      this.random(),
      mode,
    );
    const attributeSteal =
      tier === 'clear_victory' || tier === 'total_takedown'
        ? resolveAttributeSteal(input.defender.attributes, this.random(), this.random())
        : null;
    const fatality = resolveFatality({
      mode,
      random: this.random(),
      tier,
    });
    const prisonFollowUpChance =
      tier === 'total_takedown' ? resolvePrisonFollowUpChance(input.defender.player.resources.heat) : 0;

    return {
      attacker: {
        conceitoDelta: resolveConceitoDelta(mode, tier),
        heatDelta: resolveHeatDelta(mode, tier),
        hospitalization: {
          durationMinutes: tier === 'hard_fail' ? 90 : 0,
          recommended: tier === 'hard_fail',
          severity: tier === 'hard_fail' ? 'light' : 'none',
        },
        hpAfter: clamp(input.attacker.player.resources.hp + attackerHpDelta, 0, MAX_PLAYER_HEALTH),
        hpDelta: attackerHpDelta,
      },
      attackerPower: attackerProfile,
      attributeSteal,
      defender: {
        hospitalization: resolveDefenderHospitalization(tier, fatality.defenderDied),
        hpAfter: clamp(input.defender.player.resources.hp + defenderHpDelta, 0, MAX_PLAYER_HEALTH),
        hpDelta: defenderHpDelta,
        prisonFollowUpChance,
      },
      defenderPower: defenderProfile,
      fatality,
      heatLevel: resolveHeatLevel(input.defender.player.resources.heat),
      loot,
      message: buildCombatMessage(mode, tier, fatality.defenderDied),
      mode,
      powerRatio: roundTwo(ratio),
      success: tier !== 'hard_fail',
      tier,
    };
  }
}

function applyAttributeMultiplier(
  attributes: CombatPlayerContext['attributes'],
  multiplier: number,
): CombatPlayerContext['attributes'] {
  if (multiplier === 1) {
    return { ...attributes };
  }

  return {
    carisma: Math.round(attributes.carisma * multiplier),
    forca: Math.round(attributes.forca * multiplier),
    inteligencia: Math.round(attributes.inteligencia * multiplier),
    resistencia: Math.round(attributes.resistencia * multiplier),
  };
}

function buildCombatMessage(
  mode: CombatMode,
  tier: CombatResultTier,
  defenderDied: boolean,
): string {
  if (mode === 'contract' && defenderDied) {
    return 'Contrato executado com abate total.';
  }

  if (mode === 'ambush' && defenderDied) {
    return 'Emboscada encerrada com eliminacao do alvo.';
  }

  switch (tier) {
    case 'hard_fail':
      return 'A investida falhou e o atacante saiu quebrado.';
    case 'narrow_victory':
      return 'Vitoria apertada. O alvo caiu, mas sem lucro financeiro.';
    case 'clear_victory':
      return 'Vitoria clara. O alvo caiu e houve ganho de rua.';
    case 'total_takedown':
      return 'Abate total. O alvo desabou e a rua vai sentir o impacto.';
    default:
      return 'Combate resolvido.';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveCombatTier(powerRatio: number): CombatResultTier {
  if (powerRatio < 0.9) {
    return 'hard_fail';
  }

  if (powerRatio < 1.2) {
    return 'narrow_victory';
  }

  if (powerRatio < 2) {
    return 'clear_victory';
  }

  return 'total_takedown';
}

function resolveConceitoDelta(mode: CombatMode, tier: CombatResultTier): number {
  if (tier === 'hard_fail') {
    return 0;
  }

  const base =
    tier === 'narrow_victory' ? 6 : tier === 'clear_victory' ? 18 : 42;

  if (mode === 'contract') {
    return base + 20;
  }

  if (mode === 'ambush') {
    return base + 8;
  }

  return base;
}

function resolveDefenderHospitalization(
  tier: CombatResultTier,
  defenderDied: boolean,
): CombatHospitalizationSummary {
  if (tier === 'hard_fail') {
    return {
      durationMinutes: 0,
      recommended: false,
      severity: 'none',
    };
  }

  if (defenderDied) {
    return {
      durationMinutes: 720,
      recommended: true,
      severity: 'heavy',
    };
  }

  if (tier === 'narrow_victory') {
    return {
      durationMinutes: 120,
      recommended: true,
      severity: 'standard',
    };
  }

  if (tier === 'clear_victory') {
    return {
      durationMinutes: 240,
      recommended: true,
      severity: 'standard',
    };
  }

  return {
    durationMinutes: 480,
    recommended: true,
    severity: 'heavy',
  };
}

function resolveFatality(input: {
  mode: CombatMode;
  random: number;
  tier: CombatResultTier;
}): CombatFatalitySummary {
  if (input.tier !== 'total_takedown') {
    return {
      chance: 0,
      defenderDied: false,
      eligible: false,
    };
  }

  if (input.mode === 'contract') {
    return {
      chance: 1,
      defenderDied: true,
      eligible: true,
    };
  }

  if (input.mode === 'ambush') {
    const chance = 0.22;
    return {
      chance,
      defenderDied: input.random <= chance,
      eligible: true,
    };
  }

  return {
    chance: 0,
    defenderDied: false,
    eligible: false,
  };
}

function resolveHeatDelta(mode: CombatMode, tier: CombatResultTier): number {
  if (mode === 'contract') {
    switch (tier) {
      case 'hard_fail':
        return 14;
      case 'narrow_victory':
        return 9;
      case 'clear_victory':
        return 16;
      case 'total_takedown':
        return 25;
    }
  }

  if (mode === 'ambush') {
    switch (tier) {
      case 'hard_fail':
        return 12;
      case 'narrow_victory':
        return 8;
      case 'clear_victory':
        return 14;
      case 'total_takedown':
        return 22;
    }
  }

  switch (tier) {
    case 'hard_fail':
      return 10;
    case 'narrow_victory':
      return 5;
    case 'clear_victory':
      return 10;
    case 'total_takedown':
      return 18;
  }
}

function resolveHeatLevel(heat: number): CombatHeatLevel {
  if (heat >= 80) {
    return 'cacado';
  }

  if (heat >= 60) {
    return 'quente';
  }

  if (heat >= 40) {
    return 'marcado';
  }

  if (heat >= 20) {
    return 'observado';
  }

  return 'frio';
}

function resolveMoneyLoot(
  tier: CombatResultTier,
  defenderMoney: number,
  roll: number,
  mode: CombatMode,
): CombatMoneyLootSummary | null {
  if (tier !== 'clear_victory' && tier !== 'total_takedown') {
    return null;
  }

  const min = tier === 'clear_victory' ? VICTORY_LOOT_MIN : TOTAL_TAKEDOWN_EXTRA_LOOT_MIN;
  const max = tier === 'clear_victory' ? VICTORY_LOOT_MAX : TOTAL_TAKEDOWN_EXTRA_LOOT_MAX;
  const contractBoost = mode === 'contract' ? 0.03 : 0;
  const percentage = clamp(min + (max - min) * clamp(roll, 0, 1) + contractBoost, min, max + 0.03);
  const amount = roundMoney(defenderMoney * percentage);

  if (amount <= 0) {
    return null;
  }

  return {
    amount,
    percentage: roundTwo(percentage),
  };
}

function resolvePrisonFollowUpChance(heat: number): number {
  if (heat >= 80) {
    return 0.45;
  }

  if (heat >= 60) {
    return 0.25;
  }

  if (heat >= 40) {
    return 0.1;
  }

  return 0;
}

function resolveAttributeSteal(
  attributes: CombatPlayerContext['attributes'],
  attributeRoll: number,
  percentRoll: number,
): CombatAttributeStealSummary | null {
  const orderedKeys = (Object.keys(attributes) as CombatAttributeKey[]).sort();
  const attributeIndex = Math.min(
    orderedKeys.length - 1,
    Math.floor(clamp(attributeRoll, 0, 0.9999) * orderedKeys.length),
  );
  const attribute = orderedKeys[attributeIndex] ?? 'forca';
  const baseValue = attributes[attribute];
  const percentage =
    ATTRIBUTE_STEAL_PERCENT_MIN +
    (ATTRIBUTE_STEAL_PERCENT_MAX - ATTRIBUTE_STEAL_PERCENT_MIN) * clamp(percentRoll, 0, 1);
  const amount = Math.min(ATTRIBUTE_STEAL_POINTS_CAP, Math.max(1, Math.round(baseValue * percentage)));

  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    return null;
  }

  return {
    amount,
    attribute,
    percentage: roundTwo(percentage),
  };
}

function resolveWeaponEffectivePower(basePower: number, proficiency: number): number {
  const steps = Math.min(
    WEAPON_PROFICIENCY_MAX / WEAPON_PROFICIENCY_STEP_SIZE,
    Math.floor(Math.min(WEAPON_PROFICIENCY_MAX, proficiency) / WEAPON_PROFICIENCY_STEP_SIZE),
  );

  if (steps < 1) {
    return basePower;
  }

  return Math.round(basePower * (1 + steps * WEAPON_PROFICIENCY_BONUS_PER_STEP));
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}
