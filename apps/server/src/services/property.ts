import {
  PROPERTY_SABOTAGE_CANSACO_COST,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE,
  PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS,
  PROPERTY_DOMINATION_TIER_THRESHOLDS,
  PROPERTY_SABOTAGE_DISPOSICAO_COST,
  PROPERTY_SABOTAGE_HARD_FAILURE_HEAT_DELTA,
  PROPERTY_SABOTAGE_HARD_FAILURE_PRISON_MINUTES,
  PROPERTY_SABOTAGE_LEVEL_REQUIRED,
  PROPERTY_SABOTAGE_PROPERTY_COOLDOWN_HOURS,
  PROPERTY_SABOTAGE_SUCCESS_HEAT_DELTA,
  PROPERTY_SABOTAGE_TARGET_TYPES,
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  type OwnedPropertySummary,
  type PropertyCatalogResponse,
  type PropertySabotageAttemptResponse,
  type PropertySabotageCenterResponse,
  type PropertyDefinitionSummary,
  type PropertyHireSoldiersInput,
  type PropertyHireSoldiersResponse,
  type PropertySabotageLogSummary,
  type PropertySabotageOutcome,
  type PropertySabotageRecoveryResponse,
  type PropertySabotageState,
  type PropertySabotageStatusSummary,
  type PropertyPurchaseInput,
  type PropertyPurchaseResponse,
  type PropertyType,
  type RegionId,
  SOLDIER_TEMPLATES,
  type SoldierTemplateSummary,
  type SoldierType,
  type PropertyUpgradeResponse,
  VocationType,
} from '@cs-rio/shared';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionMembers,
  favelas,
  players,
  prisonRecords,
  properties,
  propertySabotageLogs,
  regions,
  soldiers,
  soldierTemplates,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { assertPlayerActionUnlocked, type PrisonStatusReaderContract } from './action-readiness.js';
import { type FactionUpgradeEffectReaderContract } from './faction.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { PoliceHeatSystem } from '../systems/PoliceHeatSystem.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';
import {
  buildFactionRegionalDominationByRegion,
  buildInactiveRegionalDominationBonus,
  type RegionalDominationBonus,
} from './regional-domination.js';
import { resolveCachedEconomyPropertyDefinition } from './economy-config.js';
import { ServerConfigService } from './server-config.js';

type TerritoryTier = OwnedPropertySummary['protection']['territoryTier'];
const serverConfigService = new ServerConfigService();

interface PropertyPlayerRecord {
  cansaco: number;
  carisma: number;
  characterCreatedAt: Date | null;
  disposicao: number;
  factionId: string | null;
  forca: number;
  id: string;
  inteligencia: number;
  level: number;
  money: number;
  nickname: string;
  regionId: RegionId;
  resistencia: number;
  vocation: VocationType;
}

interface PropertyRegionRecord {
  id: RegionId;
  operationCostMultiplier: number;
}

interface PropertyFavelaRecord {
  controllingFactionId: string | null;
  id: string;
  regionId: RegionId;
}

interface PropertyFavelaForceRecord {
  id: string;
  maxSoldiers: number;
  soldiersCount: number;
}

interface PropertySoldierRosterRecord {
  count: number;
  dailyCost: number;
  label: string;
  power: number;
  type: SoldierType;
}

interface PropertySnapshotRecord {
  createdAt: Date;
  favelaId: string | null;
  id: string;
  lastMaintenanceAt: Date;
  level: number;
  regionId: RegionId;
  sabotageRecoveryReadyAt: Date | null;
  sabotageResolvedAt: Date | null;
  sabotageState: PropertySabotageState;
  soldierRoster: PropertySoldierRosterRecord[];
  suspended: boolean;
  type: PropertyType;
}

interface PropertySabotageTargetRecord extends PropertySnapshotRecord {
  ownerCharacterCreatedAt: Date | null;
  ownerFactionId: string | null;
  ownerNickname: string;
  ownerPlayerId: string;
}

interface PropertySabotageLogRecord {
  attackRatio: number;
  attackScore: number;
  attackerFactionId: string | null;
  attackerPlayerId: string;
  createdAt: Date;
  defenseScore: number;
  favelaId: string | null;
  heatDelta: number;
  id: string;
  outcome: PropertySabotageOutcome;
  ownerAlertMode: 'anonymous' | 'identified';
  ownerFactionId: string | null;
  ownerPlayerId: string;
  prisonMinutes: number | null;
  propertyId: string;
  regionId: RegionId;
  type: PropertyType;
}

interface PropertyMaintenanceSyncResult {
  changed: boolean;
  moneySpentOnSync: number;
  nextMoney: number;
  overdueDays: number;
  snapshot: PropertySnapshotRecord;
}

interface PropertyMaintenanceStateUpdateInput {
  lastMaintenanceAt: Date;
  moneySpent: number;
  propertyId: string;
  suspended: boolean;
}

interface PropertyHireSoldiersRecord {
  hiredQuantity: number;
  totalDailyCostAdded: number;
}

interface PropertySabotageMutationInput {
  attackerPlayerId: string;
  attackerFactionId: string | null;
  attackRatio: number;
  attackScore: number;
  createdAt: Date;
  defenseScore: number;
  heatDelta: number;
  nextAttackerCansaco: number;
  nextAttackerDisposicao: number;
  outcome: PropertySabotageOutcome;
  ownerAlertMode: 'anonymous' | 'identified';
  ownerFactionId: string | null;
  ownerPlayerId: string;
  prisonMinutes: number | null;
  propertyId: string;
  sabotageRecoveryReadyAt: Date | null;
  sabotageResolvedAt: Date | null;
  sabotageState: PropertySabotageState;
}

export interface PropertyRepository {
  applyMaintenanceState(
    playerId: string,
    input: PropertyMaintenanceStateUpdateInput,
  ): Promise<boolean>;
  createProperty(input: {
    favelaId: string | null;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
    type: PropertyType;
  }): Promise<PropertySnapshotRecord | null>;
  getPlayer(playerId: string): Promise<PropertyPlayerRecord | null>;
  getProperty(playerId: string, propertyId: string): Promise<PropertySnapshotRecord | null>;
  getSabotageTarget(propertyId: string): Promise<PropertySabotageTargetRecord | null>;
  getFavelaForceState(favelaId: string): Promise<PropertyFavelaForceRecord | null>;
  getLatestSabotageLogForProperty(propertyId: string): Promise<PropertySabotageLogRecord | null>;
  hireSoldiers(
    playerId: string,
    propertyId: string,
    template: SoldierTemplateSummary,
    quantity: number,
    totalCost: number,
  ): Promise<PropertyHireSoldiersRecord | null>;
  listFavelas(): Promise<PropertyFavelaRecord[]>;
  listProperties(playerId: string): Promise<PropertySnapshotRecord[]>;
  listRegions(): Promise<PropertyRegionRecord[]>;
  listRecentSabotageLogs(playerId: string, limit: number): Promise<PropertySabotageLogRecord[]>;
  listSabotageTargets(
    regionId: RegionId,
    propertyTypes: PropertyType[],
  ): Promise<PropertySabotageTargetRecord[]>;
  listSoldierTemplates(): Promise<SoldierTemplateSummary[]>;
  recoverSabotage(playerId: string, propertyId: string, recoveryCost: number): Promise<boolean>;
  recordSabotageAttempt(input: PropertySabotageMutationInput): Promise<boolean>;
  upgradeProperty(
    playerId: string,
    propertyId: string,
    nextLevel: number,
    upgradeCost: number,
  ): Promise<boolean>;
}

export interface PropertyServiceOptions {
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
  prisonSystem?: PrisonStatusReaderContract;
  repository?: PropertyRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface PropertyServiceContract {
  attemptSabotage(
    playerId: string,
    propertyId: string,
  ): Promise<PropertySabotageAttemptResponse>;
  close?(): Promise<void>;
  getSabotageCenter(playerId: string): Promise<PropertySabotageCenterResponse>;
  hireSoldiers(
    playerId: string,
    propertyId: string,
    input: PropertyHireSoldiersInput,
  ): Promise<PropertyHireSoldiersResponse>;
  listProperties(playerId: string): Promise<PropertyCatalogResponse>;
  purchaseProperty(playerId: string, input: PropertyPurchaseInput): Promise<PropertyPurchaseResponse>;
  recoverSabotage(
    playerId: string,
    propertyId: string,
  ): Promise<PropertySabotageRecoveryResponse>;
  upgradeProperty(playerId: string, propertyId: string): Promise<PropertyUpgradeResponse>;
}

type PropertyErrorCode =
  | 'capacity'
  | 'character_not_ready'
  | 'action_locked'
  | 'conflict'
  | 'insufficient_funds'
  | 'insufficient_resources'
  | 'invalid_favela'
  | 'invalid_property'
  | 'invalid_soldier'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class PropertyError extends Error {
  constructor(
    public readonly code: PropertyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PropertyError';
  }
}

export class DatabasePropertyRepository implements PropertyRepository {
  async applyMaintenanceState(
    playerId: string,
    input: PropertyMaintenanceStateUpdateInput,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), eq(properties.playerId, playerId)))
        .limit(1);

      if (!property) {
        return false;
      }

      await tx
        .update(properties)
        .set({
          lastMaintenanceAt: input.lastMaintenanceAt,
          suspended: input.suspended,
        })
        .where(eq(properties.id, input.propertyId));

      if (input.moneySpent > 0) {
        const [player] = await tx
          .select({
            money: players.money,
          })
          .from(players)
          .where(eq(players.id, playerId))
          .limit(1);

        if (!player) {
          return false;
        }

        await tx
          .update(players)
          .set({
            money: roundCurrency(Number.parseFloat(String(player.money)) - input.moneySpent).toFixed(2),
          })
          .where(eq(players.id, playerId));
      }

      return true;
    });
  }

  async createProperty(input: {
    favelaId: string | null;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
    type: PropertyType;
  }): Promise<PropertySnapshotRecord | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, input.playerId))
        .limit(1);

      if (!player) {
        return null;
      }

      const definition = getPropertyDefinition(input.type);

      if (!definition) {
        return null;
      }

      await tx
        .update(players)
        .set({
          money: roundCurrency(Number.parseFloat(String(player.money)) - definition.basePrice).toFixed(2),
        })
        .where(eq(players.id, input.playerId));

      const [createdProperty] = await tx
        .insert(properties)
        .values({
          favelaId: input.favelaId,
          lastMaintenanceAt: input.startedAt,
          playerId: input.playerId,
          regionId: input.regionId,
          suspended: false,
          type: input.type,
        })
        .returning({
          id: properties.id,
        });

      if (!createdProperty) {
        return null;
      }

      return this.getProperty(input.playerId, createdProperty.id);
    });
  }

  async getPlayer(playerId: string): Promise<PropertyPlayerRecord | null> {
    const [player] = await db
      .select({
        cansaco: players.cansaco,
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        forca: players.forca,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        money: players.money,
        nickname: players.nickname,
        disposicao: players.disposicao,
        regionId: players.regionId,
        resistencia: players.resistencia,
        vocation: players.vocation,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
      })
      .from(factionMembers)
      .where(eq(factionMembers.playerId, playerId))
      .limit(1);

    return {
      cansaco: player.cansaco,
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      disposicao: player.disposicao,
      factionId: membership?.factionId ?? player.factionId ?? null,
      forca: player.forca,
      id: player.id,
      inteligencia: player.inteligencia,
      level: player.level,
      money: roundCurrency(Number.parseFloat(String(player.money))),
      nickname: player.nickname,
      regionId: player.regionId as RegionId,
      resistencia: player.resistencia,
      vocation: player.vocation as VocationType,
    };
  }

  async getProperty(playerId: string, propertyId: string): Promise<PropertySnapshotRecord | null> {
    const propertiesList = await this.listProperties(playerId);
    return propertiesList.find((property) => property.id === propertyId) ?? null;
  }

  async getSabotageTarget(propertyId: string): Promise<PropertySabotageTargetRecord | null> {
    const [row] = await db
      .select({
        createdAt: properties.createdAt,
        favelaId: properties.favelaId,
        id: properties.id,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        level: properties.level,
        ownerCharacterCreatedAt: players.characterCreatedAt,
        ownerFactionId: players.factionId,
        ownerNickname: players.nickname,
        ownerPlayerId: players.id,
        regionId: properties.regionId,
        sabotageRecoveryReadyAt: properties.sabotageRecoveryReadyAt,
        sabotageResolvedAt: properties.sabotageResolvedAt,
        sabotageState: properties.sabotageState,
        suspended: properties.suspended,
        type: properties.type,
      })
      .from(properties)
      .innerJoin(players, eq(players.id, properties.playerId))
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!row) {
      return null;
    }

    const rosterByProperty = await loadPropertyRosterByProperty([propertyId]);
    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
      })
      .from(factionMembers)
      .where(eq(factionMembers.playerId, row.ownerPlayerId))
      .limit(1);

    return {
      createdAt: row.createdAt,
      favelaId: row.favelaId,
      id: row.id,
      lastMaintenanceAt: row.lastMaintenanceAt,
      level: row.level,
      ownerCharacterCreatedAt: row.ownerCharacterCreatedAt,
      ownerFactionId: membership?.factionId ?? row.ownerFactionId ?? null,
      ownerNickname: row.ownerNickname,
      ownerPlayerId: row.ownerPlayerId,
      regionId: row.regionId as RegionId,
      sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
      sabotageResolvedAt: row.sabotageResolvedAt,
      sabotageState: row.sabotageState as PropertySabotageState,
      soldierRoster: [...(rosterByProperty.get(row.id)?.values() ?? [])].sort((left, right) =>
        left.label.localeCompare(right.label, 'pt-BR'),
      ),
      suspended: row.suspended,
      type: row.type as PropertyType,
    };
  }

  async getFavelaForceState(favelaId: string): Promise<PropertyFavelaForceRecord | null> {
    const [favela] = await db
      .select({
        id: favelas.id,
        maxSoldiers: favelas.maxSoldiers,
        soldiersCount:
          sql<number>`coalesce(sum(case when ${properties.suspended} = false then ${properties.soldiersCount} else 0 end), 0)`.as(
            'soldiers_count',
          ),
      })
      .from(favelas)
      .leftJoin(properties, eq(properties.favelaId, favelas.id))
      .where(eq(favelas.id, favelaId))
      .groupBy(favelas.id)
      .limit(1);

    return favela
      ? {
          id: favela.id,
          maxSoldiers: favela.maxSoldiers,
          soldiersCount: Number(favela.soldiersCount ?? 0),
        }
      : null;
  }

  async getLatestSabotageLogForProperty(propertyId: string): Promise<PropertySabotageLogRecord | null> {
    const [row] = await db
      .select({
        attackRatio: propertySabotageLogs.attackRatio,
        attackScore: propertySabotageLogs.attackScore,
        attackerFactionId: propertySabotageLogs.attackerFactionId,
        attackerPlayerId: propertySabotageLogs.attackerPlayerId,
        createdAt: propertySabotageLogs.createdAt,
        defenseScore: propertySabotageLogs.defenseScore,
        favelaId: propertySabotageLogs.favelaId,
        heatDelta: propertySabotageLogs.heatDelta,
        id: propertySabotageLogs.id,
        outcome: propertySabotageLogs.outcome,
        ownerAlertMode: propertySabotageLogs.ownerAlertMode,
        ownerFactionId: propertySabotageLogs.ownerFactionId,
        ownerPlayerId: propertySabotageLogs.ownerPlayerId,
        prisonMinutes: propertySabotageLogs.prisonMinutes,
        propertyId: propertySabotageLogs.propertyId,
        regionId: propertySabotageLogs.regionId,
        type: propertySabotageLogs.type,
      })
      .from(propertySabotageLogs)
      .where(eq(propertySabotageLogs.propertyId, propertyId))
      .orderBy(desc(propertySabotageLogs.createdAt))
      .limit(1);

    return row ? serializeSabotageLogRecord(row) : null;
  }

  async hireSoldiers(
    playerId: string,
    propertyId: string,
    template: SoldierTemplateSummary,
    quantity: number,
    totalCost: number,
  ): Promise<PropertyHireSoldiersRecord | null> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
          soldiersCount: properties.soldiersCount,
        })
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.playerId, playerId)))
        .limit(1);

      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!property || !player) {
        return null;
      }

      await tx
        .update(players)
        .set({
          money: roundCurrency(Number.parseFloat(String(player.money)) - totalCost).toFixed(2),
        })
        .where(eq(players.id, playerId));

      const now = new Date();
      await tx.insert(soldiers).values(
        Array.from({ length: quantity }, () => ({
          dailyCost: totalCost <= 0 ? '0.00' : template.dailyCost.toFixed(2),
          hiredAt: now,
          power: template.power,
          propertyId,
          type: template.type,
        })),
      );

      await tx
        .update(properties)
        .set({
          soldiersCount: property.soldiersCount + quantity,
        })
        .where(eq(properties.id, propertyId));

      return {
        hiredQuantity: quantity,
        totalDailyCostAdded: roundCurrency(template.dailyCost * quantity),
      };
    });
  }

  async listFavelas(): Promise<PropertyFavelaRecord[]> {
    const rows = await db
      .select({
        controllingFactionId: favelas.controllingFactionId,
        id: favelas.id,
        regionId: favelas.regionId,
      })
      .from(favelas);

    return rows.map((row) => ({
      controllingFactionId: row.controllingFactionId,
      id: row.id,
      regionId: row.regionId as RegionId,
    }));
  }

  async listProperties(playerId: string): Promise<PropertySnapshotRecord[]> {
    const propertyRows = await db
      .select({
        createdAt: properties.createdAt,
        favelaId: properties.favelaId,
        id: properties.id,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        level: properties.level,
        regionId: properties.regionId,
        sabotageRecoveryReadyAt: properties.sabotageRecoveryReadyAt,
        sabotageResolvedAt: properties.sabotageResolvedAt,
        sabotageState: properties.sabotageState,
        suspended: properties.suspended,
        type: properties.type,
      })
      .from(properties)
      .where(eq(properties.playerId, playerId));

    if (propertyRows.length === 0) {
      return [];
    }

    const rosterByProperty = await loadPropertyRosterByProperty(propertyRows.map((property) => property.id));

    return propertyRows.map((row) => {
      const roster = [...(rosterByProperty.get(row.id)?.values() ?? [])].sort((left, right) =>
        left.label.localeCompare(right.label, 'pt-BR'),
      );

      return {
        createdAt: row.createdAt,
        favelaId: row.favelaId,
        id: row.id,
        lastMaintenanceAt: row.lastMaintenanceAt,
        level: row.level,
        regionId: row.regionId as RegionId,
        sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
        sabotageResolvedAt: row.sabotageResolvedAt,
        sabotageState: row.sabotageState as PropertySabotageState,
        soldierRoster: roster,
        suspended: row.suspended,
        type: row.type as PropertyType,
      };
    });
  }

  async listRegions(): Promise<PropertyRegionRecord[]> {
    const rows = await db
      .select({
        id: regions.id,
        operationCostMultiplier: regions.operationCostMultiplier,
      })
      .from(regions)
      .where(eq(regions.isActive, true))
      .orderBy(asc(regions.sortOrder), asc(regions.name));

    return rows.map((row) => ({
      id: row.id as RegionId,
      operationCostMultiplier: Number.parseFloat(String(row.operationCostMultiplier)),
    }));
  }

  async listRecentSabotageLogs(
    playerId: string,
    limit: number,
  ): Promise<PropertySabotageLogRecord[]> {
    const rows = await db
      .select({
        attackRatio: propertySabotageLogs.attackRatio,
        attackScore: propertySabotageLogs.attackScore,
        attackerFactionId: propertySabotageLogs.attackerFactionId,
        attackerPlayerId: propertySabotageLogs.attackerPlayerId,
        createdAt: propertySabotageLogs.createdAt,
        defenseScore: propertySabotageLogs.defenseScore,
        favelaId: propertySabotageLogs.favelaId,
        heatDelta: propertySabotageLogs.heatDelta,
        id: propertySabotageLogs.id,
        outcome: propertySabotageLogs.outcome,
        ownerAlertMode: propertySabotageLogs.ownerAlertMode,
        ownerFactionId: propertySabotageLogs.ownerFactionId,
        ownerPlayerId: propertySabotageLogs.ownerPlayerId,
        prisonMinutes: propertySabotageLogs.prisonMinutes,
        propertyId: propertySabotageLogs.propertyId,
        regionId: propertySabotageLogs.regionId,
        type: propertySabotageLogs.type,
      })
      .from(propertySabotageLogs)
      .where(
        or(
          eq(propertySabotageLogs.attackerPlayerId, playerId),
          eq(propertySabotageLogs.ownerPlayerId, playerId),
        ),
      )
      .orderBy(desc(propertySabotageLogs.createdAt))
      .limit(limit);

    return rows.map((row) => serializeSabotageLogRecord(row));
  }

  async listSabotageTargets(
    regionId: RegionId,
    propertyTypes: PropertyType[],
  ): Promise<PropertySabotageTargetRecord[]> {
    const propertyRows = await db
      .select({
        createdAt: properties.createdAt,
        favelaId: properties.favelaId,
        id: properties.id,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        level: properties.level,
        ownerCharacterCreatedAt: players.characterCreatedAt,
        ownerFactionId: players.factionId,
        ownerNickname: players.nickname,
        ownerPlayerId: players.id,
        regionId: properties.regionId,
        sabotageRecoveryReadyAt: properties.sabotageRecoveryReadyAt,
        sabotageResolvedAt: properties.sabotageResolvedAt,
        sabotageState: properties.sabotageState,
        suspended: properties.suspended,
        type: properties.type,
      })
      .from(properties)
      .innerJoin(players, eq(players.id, properties.playerId))
      .where(and(eq(properties.regionId, regionId), inArray(properties.type, propertyTypes)));

    if (propertyRows.length === 0) {
      return [];
    }

    const rosterByProperty = await loadPropertyRosterByProperty(propertyRows.map((property) => property.id));
    const ownerIds = [...new Set(propertyRows.map((row) => row.ownerPlayerId))];
    const membershipRows =
      ownerIds.length === 0
        ? []
        : await db
            .select({
              factionId: factionMembers.factionId,
              playerId: factionMembers.playerId,
            })
            .from(factionMembers)
            .where(inArray(factionMembers.playerId, ownerIds));
    const factionByOwnerId = new Map(membershipRows.map((row) => [row.playerId, row.factionId]));

    return propertyRows.map((row) => ({
      createdAt: row.createdAt,
      favelaId: row.favelaId,
      id: row.id,
      lastMaintenanceAt: row.lastMaintenanceAt,
      level: row.level,
      ownerCharacterCreatedAt: row.ownerCharacterCreatedAt,
      ownerFactionId: factionByOwnerId.get(row.ownerPlayerId) ?? row.ownerFactionId ?? null,
      ownerNickname: row.ownerNickname,
      ownerPlayerId: row.ownerPlayerId,
      regionId: row.regionId as RegionId,
      sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
      sabotageResolvedAt: row.sabotageResolvedAt,
      sabotageState: row.sabotageState as PropertySabotageState,
      soldierRoster: [...(rosterByProperty.get(row.id)?.values() ?? [])].sort((left, right) =>
        left.label.localeCompare(right.label, 'pt-BR'),
      ),
      suspended: row.suspended,
      type: row.type as PropertyType,
    }));
  }

  async listSoldierTemplates(): Promise<SoldierTemplateSummary[]> {
    const rows = await db
      .select({
        dailyCost: soldierTemplates.dailyCost,
        label: soldierTemplates.name,
        power: soldierTemplates.power,
        type: soldierTemplates.type,
        unlockLevel: soldierTemplates.levelRequired,
      })
      .from(soldierTemplates);

    if (rows.length === 0) {
      return [...SOLDIER_TEMPLATES];
    }

    return rows.map((row) => ({
      dailyCost: roundCurrency(Number.parseFloat(String(row.dailyCost))),
      label: row.label,
      power: row.power,
      type: row.type as SoldierType,
      unlockLevel: row.unlockLevel,
    }));
  }

  async recoverSabotage(playerId: string, propertyId: string, recoveryCost: number): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.playerId, playerId)))
        .limit(1);
      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!property || !player) {
        return false;
      }

      const nextMoney = roundCurrency(Number.parseFloat(String(player.money)) - recoveryCost);

      if (nextMoney < 0) {
        return false;
      }

      await tx
        .update(players)
        .set({
          money: nextMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));
      await tx
        .update(properties)
        .set({
          sabotageRecoveryReadyAt: null,
          sabotageResolvedAt: null,
          sabotageState: 'normal',
        })
        .where(eq(properties.id, propertyId));

      return true;
    });
  }

  async recordSabotageAttempt(input: PropertySabotageMutationInput): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [attacker] = await tx
        .select({
          cansaco: players.cansaco,
          disposicao: players.disposicao,
        })
        .from(players)
        .where(eq(players.id, input.attackerPlayerId))
        .limit(1);
      const [target] = await tx
        .select({
          favelaId: properties.favelaId,
          ownerPlayerId: properties.playerId,
          regionId: properties.regionId,
          type: properties.type,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (!attacker || !target) {
        return false;
      }

      if (
        attacker.cansaco < PROPERTY_SABOTAGE_CANSACO_COST ||
        attacker.disposicao < PROPERTY_SABOTAGE_DISPOSICAO_COST
      ) {
        return false;
      }

      await tx
        .update(players)
        .set({
          cansaco: input.nextAttackerCansaco,
          disposicao: input.nextAttackerDisposicao,
        })
        .where(eq(players.id, input.attackerPlayerId));

      if (input.sabotageState !== 'normal') {
        await tx
          .update(properties)
          .set({
            sabotageRecoveryReadyAt: input.sabotageRecoveryReadyAt,
            sabotageResolvedAt: input.sabotageResolvedAt,
            sabotageState: input.sabotageState,
          })
          .where(eq(properties.id, input.propertyId));
      }

      if (input.prisonMinutes && input.prisonMinutes > 0) {
        await tx.insert(prisonRecords).values({
          allowBail: true,
          allowBribe: true,
          allowEscape: true,
          allowFactionRescue: false,
          playerId: input.attackerPlayerId,
          reason: 'Sabotagem mal sucedida contra propriedade rival.',
          releaseAt: new Date(input.createdAt.getTime() + input.prisonMinutes * 60 * 1000),
          sentencedAt: input.createdAt,
        });
      }

      await tx.insert(propertySabotageLogs).values({
        attackRatio: input.attackRatio.toFixed(4),
        attackScore: input.attackScore.toFixed(2),
        attackerFactionId: input.attackerFactionId,
        attackerPlayerId: input.attackerPlayerId,
        createdAt: input.createdAt,
        defenseScore: input.defenseScore.toFixed(2),
        favelaId: target.favelaId,
        heatDelta: input.heatDelta,
        outcome: input.outcome,
        ownerAlertMode: input.ownerAlertMode,
        ownerFactionId: input.ownerFactionId,
        ownerPlayerId: input.ownerPlayerId,
        prisonMinutes: input.prisonMinutes,
        propertyId: input.propertyId,
        regionId: target.regionId,
        type: target.type,
      });

      return true;
    });
  }

  async upgradeProperty(
    playerId: string,
    propertyId: string,
    nextLevel: number,
    upgradeCost: number,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.playerId, playerId)))
        .limit(1);

      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!property || !player) {
        return false;
      }

      await tx
        .update(players)
        .set({
          money: roundCurrency(Number.parseFloat(String(player.money)) - upgradeCost).toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(properties)
        .set({
          level: nextLevel,
        })
        .where(eq(properties.id, propertyId));

      return true;
    });
  }
}

export class PropertyService implements PropertyServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly repository: PropertyRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly policeHeatSystem: PoliceHeatSystem;

  private readonly prisonSystem: PrisonStatusReaderContract | null;

  constructor(options: PropertyServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabasePropertyRepository();
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
    this.policeHeatSystem =
      options.policeHeatSystem ??
      new PoliceHeatSystem({
        keyValueStore: this.keyValueStore,
        now: () => this.now().getTime(),
      });
    this.prisonSystem = options.prisonSystem ?? null;
  }

  async close(): Promise<void> {
    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close?.();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getSabotageCenter(playerId: string): Promise<PropertySabotageCenterResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [favelasList, logs, rawTargets] = await Promise.all([
      this.repository.listFavelas(),
      this.repository.listRecentSabotageLogs(playerId, 12),
      this.repository.listSabotageTargets(player.regionId, [...PROPERTY_SABOTAGE_TARGET_TYPES]),
    ]);

    const targets = await Promise.all(
      rawTargets
        .filter((target) => target.ownerPlayerId !== player.id)
        .map((target) => this.buildSabotageTargetSummary(player, target, favelasList)),
    );

    return {
      availability: resolvePropertySabotageAvailability(player),
      player: {
        factionId: player.factionId,
        id: player.id,
        level: player.level,
        nickname: player.nickname,
        regionId: player.regionId,
        resources: {
          cansaco: player.cansaco,
          disposicao: player.disposicao,
        },
      },
      recentLogs: logs.map(serializeSabotageLogSummary),
      targets: targets.sort((left: PropertySabotageCenterResponse['targets'][number], right: PropertySabotageCenterResponse['targets'][number]) => {
        if (left.status !== right.status) {
          return left.status === 'eligible' ? -1 : 1;
        }

        return left.defenseScore - right.defenseScore;
      }),
    };
  }

  async attemptSabotage(
    playerId: string,
    propertyId: string,
  ): Promise<PropertySabotageAttemptResponse> {
    await this.assertPropertyActionUnlocked(playerId);
    const player = await this.requireReadyPlayer(playerId);
    const availability = resolvePropertySabotageAvailability(player);

    if (!availability.available) {
      throw new PropertyError('insufficient_resources', availability.reason ?? 'Sabotagem indisponivel.');
    }

    const [favelasList, passiveProfile, target] = await Promise.all([
      this.repository.listFavelas(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.getSabotageTarget(propertyId),
    ]);

    if (!target) {
      throw new PropertyError('not_found', 'Alvo de sabotagem nao encontrado.');
    }

    const targetSummary = await this.buildSabotageTargetSummary(player, target, favelasList);

    if (targetSummary.status !== 'eligible') {
      throw new PropertyError(
        'conflict',
        targetSummary.targetCooldownSeconds > 0
          ? 'Esta propriedade ainda esta sob cooldown de sabotagem.'
          : 'Esta propriedade nao pode ser sabotada no momento.',
      );
    }

    const attackScore = resolvePropertySabotageAttackScore(player, passiveProfile);
    const attackRatio = roundCurrency(attackScore / Math.max(1, targetSummary.defenseScore));
    const outcome = resolvePropertySabotageOutcome(attackRatio);
    const createdAt = this.now();
    const sabotageState = resolvePropertySabotageState(outcome);
    const sabotageResolvedAt =
      sabotageState === 'normal'
        ? null
        : createdAt;
    const sabotageRecoveryReadyAt =
      sabotageState === 'damaged'
        ? new Date(createdAt.getTime() + PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS * 60 * 60 * 1000)
        : sabotageState === 'destroyed'
          ? new Date(createdAt.getTime() + PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS * 60 * 60 * 1000)
          : null;
    const heatDelta =
      outcome === 'failure_hard'
        ? PROPERTY_SABOTAGE_HARD_FAILURE_HEAT_DELTA
        : outcome === 'damaged' || outcome === 'destroyed'
          ? PROPERTY_SABOTAGE_SUCCESS_HEAT_DELTA
          : 0;
    const prisonMinutes =
      outcome === 'failure_hard' ? PROPERTY_SABOTAGE_HARD_FAILURE_PRISON_MINUTES : null;
    const ownerAlertMode = outcome === 'damaged' || outcome === 'destroyed' ? 'anonymous' : 'identified';
    const recorded = await this.repository.recordSabotageAttempt({
      attackerFactionId: player.factionId,
      attackerPlayerId: player.id,
      attackRatio,
      attackScore,
      createdAt,
      defenseScore: targetSummary.defenseScore,
      heatDelta,
      nextAttackerCansaco: Math.max(0, player.cansaco - PROPERTY_SABOTAGE_CANSACO_COST),
      nextAttackerDisposicao: Math.max(0, player.disposicao - PROPERTY_SABOTAGE_DISPOSICAO_COST),
      outcome,
      ownerAlertMode,
      ownerFactionId: target.ownerFactionId,
      ownerPlayerId: target.ownerPlayerId,
      prisonMinutes,
      propertyId,
      sabotageRecoveryReadyAt,
      sabotageResolvedAt,
      sabotageState,
    });

    if (!recorded) {
      throw new PropertyError('conflict', 'Nao foi possivel concluir a sabotagem.');
    }

    if (heatDelta > 0) {
      await this.policeHeatSystem.addHeat(player.id, heatDelta);
    }

    await Promise.all([
      invalidatePlayerProfileCache(this.keyValueStore, player.id),
      invalidatePlayerProfileCache(this.keyValueStore, target.ownerPlayerId),
    ]);

    const center = await this.getSabotageCenter(playerId);
    const result =
      center.recentLogs.find((entry: PropertySabotageLogSummary) => entry.propertyId === propertyId && entry.attackerPlayerId === player.id) ??
      (await this.repository.listRecentSabotageLogs(playerId, 1)).map(serializeSabotageLogSummary)[0];
    const refreshedTarget =
      center.targets.find((entry: PropertySabotageCenterResponse['targets'][number]) => entry.id === propertyId) ??
      (await this.buildSabotageTargetSummary(
        player,
        (await this.repository.getSabotageTarget(propertyId)) ?? target,
        favelasList,
      ));

    if (!result) {
      throw new PropertyError('conflict', 'Resultado da sabotagem nao foi encontrado apos a execucao.');
    }

    return {
      center,
      message: resolvePropertySabotageMessage(outcome),
      result,
      target: refreshedTarget,
    };
  }

  async recoverSabotage(
    playerId: string,
    propertyId: string,
  ): Promise<PropertySabotageRecoveryResponse> {
    await this.assertPropertyActionUnlocked(playerId);
    const player = await this.requireReadyPlayer(playerId);
    const property = await this.requireProperty(playerId, propertyId);
    const sabotageStatus = buildPropertySabotageStatusSummary({
      now: this.now(),
      sabotageRecoveryReadyAt: property.sabotageRecoveryReadyAt,
      sabotageResolvedAt: property.sabotageResolvedAt,
      sabotageState: property.sabotageState,
      type: property.type,
    });

    if (sabotageStatus.state === 'normal') {
      throw new PropertyError('conflict', 'Esta propriedade nao precisa de reparo por sabotagem.');
    }

    if (!sabotageStatus.recoveryReady) {
      throw new PropertyError('conflict', 'O reparo ainda nao pode ser iniciado para esta propriedade.');
    }

    if (sabotageStatus.recoveryCost === null || player.money < sabotageStatus.recoveryCost) {
      throw new PropertyError('insufficient_funds', 'Dinheiro insuficiente para recuperar a propriedade.');
    }

    const recovered = await this.repository.recoverSabotage(
      playerId,
      propertyId,
      sabotageStatus.recoveryCost,
    );

    if (!recovered) {
      throw new PropertyError('conflict', 'Nao foi possivel recuperar a propriedade sabotada.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const refreshedProperty = await this.listSingleProperty(playerId, propertyId);

    return {
      center: await this.getSabotageCenter(playerId),
      message:
        sabotageStatus.state === 'destroyed'
          ? 'Reconstrucao concluida e a propriedade voltou a operar.'
          : 'Reparo concluido e a propriedade voltou ao ritmo normal.',
      property: refreshedProperty,
      recoveryCost: sabotageStatus.recoveryCost,
    };
  }

  async hireSoldiers(
    playerId: string,
    propertyId: string,
    input: PropertyHireSoldiersInput,
  ): Promise<PropertyHireSoldiersResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new PropertyError('validation', 'Quantidade de soldados deve ser um inteiro maior ou igual a 1.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const property = await this.requireProperty(playerId, propertyId);
    const definitions = await this.repository.listSoldierTemplates();
    const template = definitions.find((entry) => entry.type === input.type);

    if (!template) {
      throw new PropertyError('invalid_soldier', 'Template de soldado nao encontrado.');
    }

    if (player.level < template.unlockLevel) {
      throw new PropertyError('conflict', `Nivel insuficiente para contratar ${template.label}.`);
    }

    const propertyDefinition = requirePropertyDefinition(property.type);
    const currentSoldierCount = property.soldierRoster.reduce((total, entry) => total + entry.count, 0);
    const factionUpgradeEffects = await this.factionUpgradeReader.getFactionUpgradeEffectsForFaction(
      player.factionId,
    );
    const effectiveSoldierCapacity = Math.max(
      0,
      Math.floor(propertyDefinition.soldierCapacity * factionUpgradeEffects.soldierCapacityMultiplier),
    );

    if (currentSoldierCount + input.quantity > effectiveSoldierCapacity) {
      throw new PropertyError('capacity', 'Capacidade maxima de soldados desta propriedade foi atingida.');
    }

    if (property.favelaId) {
      const favelaForceState = await this.repository.getFavelaForceState(property.favelaId);

      if (
        favelaForceState &&
        favelaForceState.soldiersCount + input.quantity > favelaForceState.maxSoldiers
      ) {
        throw new PropertyError(
          'capacity',
          'Teto maximo de soldados desta favela foi atingido.',
        );
      }
    }

    const totalCost = roundCurrency(template.dailyCost * input.quantity);

    if (player.money < totalCost) {
      throw new PropertyError('insufficient_funds', 'Dinheiro insuficiente para contratar soldados.');
    }

    const hired = await this.repository.hireSoldiers(playerId, propertyId, template, input.quantity, totalCost);

    if (!hired) {
      throw new PropertyError('not_found', 'Nao foi possivel contratar soldados para esta propriedade.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const refreshedProperty = await this.listSingleProperty(playerId, propertyId);

    return {
      hiredQuantity: hired.hiredQuantity,
      property: refreshedProperty,
      soldierType: template.type,
      totalDailyCostAdded: hired.totalDailyCostAdded,
    };
  }

  async listProperties(playerId: string): Promise<PropertyCatalogResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [propertiesList, favelasList, regionList, soldierDefinitions, passiveProfile] = await Promise.all([
      this.repository.listProperties(playerId),
      this.repository.listFavelas(),
      this.repository.listRegions(),
      this.repository.listSoldierTemplates(),
      this.universityReader.getPassiveProfile(playerId),
    ]);
    const regionMultiplierById = new Map<RegionId, number>(
      regionList.map((region: PropertyRegionRecord) => [region.id, region.operationCostMultiplier]),
    );
    const controlledFavelasByRegion = buildControlledFavelasByRegion(player.factionId, favelasList);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(player.factionId, favelasList);
    const summaries: OwnedPropertySummary[] = [];
    let changed = false;
    let workingMoney = player.money;

    for (const property of [...propertiesList].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      const regionalDominationBonus =
        regionalDominationByRegion.get(property.regionId) ??
        buildInactiveRegionalDominationBonus(property.regionId);
      const synced = await this.syncProperty({
        playerId,
        property,
        regionMultiplierById,
        maintenanceMultiplier:
          passiveProfile.business.propertyMaintenanceMultiplier * regionalDominationBonus.maintenanceMultiplier,
        workingMoney,
      });

      workingMoney = synced.nextMoney;
      changed ||= synced.changed;
      summaries.push(
        serializeOwnedPropertySummary({
          factionId: player.factionId,
          now: this.now(),
          property: synced.snapshot,
          regionalDominationBonus,
          territoryControlRatio: controlledFavelasByRegion.get(synced.snapshot.regionId) ?? 0,
          maintenanceMultiplier: passiveProfile.business.propertyMaintenanceMultiplier,
          regionMultiplier: regionMultiplierById.get(synced.snapshot.regionId) ?? 1,
          sync: synced,
        }),
      );
    }

    if (changed) {
      await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    }

    return {
      availableProperties: await serverConfigService.listPropertyDefinitions(),
      ownedProperties: summaries,
      soldierTemplates: soldierDefinitions,
    };
  }

  async purchaseProperty(playerId: string, input: PropertyPurchaseInput): Promise<PropertyPurchaseResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const definition = requirePropertyDefinition(input.type);

    if (definition.purchaseMode !== 'direct') {
      throw new PropertyError(
        'conflict',
        'Esta propriedade e provisionada por um sistema especializado e nao pode ser comprada por esta rota.',
      );
    }

    if (player.level < definition.unlockLevel) {
      throw new PropertyError('conflict', `Nivel insuficiente para comprar ${definition.label}.`);
    }

    if (player.money < definition.basePrice) {
      throw new PropertyError('insufficient_funds', 'Dinheiro insuficiente para comprar esta propriedade.');
    }

    const currentState = await this.listProperties(playerId);

    if (currentState.ownedProperties.some((property: OwnedPropertySummary) => property.type === input.type)) {
      throw new PropertyError('conflict', `Voce ja possui uma propriedade do tipo ${definition.label}.`);
    }

    const favelasList = await this.repository.listFavelas();
    validatePropertyLocation(input, definition, favelasList);

    const created = await this.repository.createProperty({
      favelaId: input.favelaId ?? null,
      playerId,
      regionId: input.regionId,
      startedAt: this.now(),
      type: input.type,
    });

    if (!created) {
      throw new PropertyError('invalid_property', 'Nao foi possivel comprar a propriedade solicitada.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const property = await this.listSingleProperty(playerId, created.id);

    return {
      property,
      purchaseCost: definition.basePrice,
    };
  }

  async upgradeProperty(playerId: string, propertyId: string): Promise<PropertyUpgradeResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const property = await this.requireProperty(playerId, propertyId);
    const definition = requirePropertyDefinition(property.type);

    if (property.level >= definition.maxLevel) {
      throw new PropertyError('conflict', 'Esta propriedade ja esta no nivel maximo.');
    }

    const nextLevel = property.level + 1;
    const upgradeCost = resolvePropertyUpgradeCost(definition, nextLevel);

    if (player.money < upgradeCost) {
      throw new PropertyError('insufficient_funds', 'Dinheiro insuficiente para fazer o upgrade.');
    }

    const upgraded = await this.repository.upgradeProperty(playerId, propertyId, nextLevel, upgradeCost);

    if (!upgraded) {
      throw new PropertyError('not_found', 'Nao foi possivel aplicar upgrade nesta propriedade.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const refreshedProperty = await this.listSingleProperty(playerId, propertyId);

    return {
      property: refreshedProperty,
      upgradeCost,
    };
  }

  private async buildSabotageTargetSummary(
    attacker: PropertyPlayerRecord,
    target: PropertySabotageTargetRecord,
    favelasList: PropertyFavelaRecord[],
  ): Promise<PropertySabotageCenterResponse['targets'][number]> {
    const targetTerritoryControlRatio =
      buildControlledFavelasByRegion(target.ownerFactionId, favelasList).get(target.regionId) ?? 0;
    const targetRegionalDominationBonus =
      buildFactionRegionalDominationByRegion(target.ownerFactionId, favelasList).get(target.regionId) ??
      buildInactiveRegionalDominationBonus(target.regionId);
    const defenseScore = roundCurrency(
      resolvePropertyDefenseScore({
        factionId: target.ownerFactionId,
        property: target,
        regionalDominationBonus: targetRegionalDominationBonus,
        territoryControlRatio: targetTerritoryControlRatio,
      }),
    );
    const sabotageStatus = buildPropertySabotageStatusSummary({
      now: this.now(),
      sabotageRecoveryReadyAt: target.sabotageRecoveryReadyAt,
      sabotageResolvedAt: target.sabotageResolvedAt,
      sabotageState: target.sabotageState,
      type: target.type,
    });
    const latestLog = await this.repository.getLatestSabotageLogForProperty(target.id);
    const cooldownSeconds = resolvePropertySabotageCooldownSeconds(latestLog, this.now());
    const blockedByProtection =
      target.ownerPlayerId === attacker.id ||
      target.regionId !== attacker.regionId ||
      (attacker.factionId !== null && target.ownerFactionId === attacker.factionId) ||
      isUnderNoviceProtection(target.ownerCharacterCreatedAt, this.now()) ||
      sabotageStatus.state !== 'normal';

    return {
      defenseScore,
      favelaId: target.favelaId,
      id: target.id,
      ownerFactionId: target.ownerFactionId,
      ownerNickname: target.ownerNickname,
      ownerPlayerId: target.ownerPlayerId,
      regionId: target.regionId,
      sabotageStatus,
      soldiersCount: target.soldierRoster.reduce((total, entry) => total + entry.count, 0),
      status: !blockedByProtection && cooldownSeconds <= 0 ? 'eligible' : 'cooldown',
      targetCooldownSeconds: cooldownSeconds,
      type: target.type,
    };
  }

  private async listSingleProperty(playerId: string, propertyId: string): Promise<OwnedPropertySummary> {
    const summary = await this.listProperties(playerId);
    const property = summary.ownedProperties.find(
      (entry: OwnedPropertySummary) => entry.id === propertyId,
    );

    if (!property) {
      throw new PropertyError('not_found', 'Propriedade nao encontrada apos a atualizacao.');
    }

    return property;
  }

  private async assertPropertyActionUnlocked(playerId: string): Promise<void> {
    await assertPlayerActionUnlocked({
      getPrisonStatus: this.prisonSystem ? () => this.prisonSystem!.getStatus(playerId) : null,
      imprisonedError: () =>
        new PropertyError('action_locked', 'Jogador preso nao pode mexer com propriedades agora.'),
    });
  }

  private async requireProperty(playerId: string, propertyId: string): Promise<PropertySnapshotRecord> {
    const property = await this.repository.getProperty(playerId, propertyId);

    if (!property) {
      throw new PropertyError('not_found', 'Propriedade nao encontrada.');
    }

    return property;
  }

  private async requireReadyPlayer(playerId: string): Promise<PropertyPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new PropertyError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new PropertyError('character_not_ready', 'Crie o personagem antes de gerenciar propriedades.');
    }

    return player;
  }

  private async syncProperty(input: {
    property: PropertySnapshotRecord;
    playerId: string;
    regionMultiplierById: Map<RegionId, number>;
    maintenanceMultiplier: number;
    workingMoney: number;
  }): Promise<PropertyMaintenanceSyncResult> {
    const definition = requirePropertyDefinition(input.property.type);
    const regionMultiplier = input.regionMultiplierById.get(input.property.regionId) ?? 1;
    const dailyUpkeep = resolvePropertyDailyUpkeep(
      definition,
      input.property,
      regionMultiplier,
      input.maintenanceMultiplier,
    );
    const dueDays = Math.floor(
      Math.max(0, this.now().getTime() - input.property.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
    );

    if (dueDays <= 0 || dailyUpkeep <= 0) {
      return {
        changed: false,
        moneySpentOnSync: 0,
        nextMoney: input.workingMoney,
        overdueDays: 0,
        snapshot: input.property,
      };
    }

    const payableDays = Math.min(dueDays, Math.floor(input.workingMoney / dailyUpkeep));
    const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
    const overdueDays = dueDays - payableDays;
    const nextLastMaintenanceAt = new Date(
      input.property.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
    );
    const nextSnapshot: PropertySnapshotRecord = {
      ...input.property,
      lastMaintenanceAt: nextLastMaintenanceAt,
      suspended: overdueDays > 0,
    };
    const changed =
      moneySpentOnSync > 0 ||
      nextSnapshot.suspended !== input.property.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== input.property.lastMaintenanceAt.getTime();

    if (changed) {
      const applied = await this.repository.applyMaintenanceState(input.playerId, {
        lastMaintenanceAt: nextLastMaintenanceAt,
        moneySpent: moneySpentOnSync,
        propertyId: input.property.id,
        suspended: overdueDays > 0,
      });

      if (!applied) {
        throw new PropertyError('not_found', 'Falha ao sincronizar manutencao da propriedade.');
      }
    }

    return {
      changed,
      moneySpentOnSync,
      nextMoney: roundCurrency(input.workingMoney - moneySpentOnSync),
      overdueDays,
      snapshot: nextSnapshot,
    };
  }
}

function buildControlledFavelasByRegion(
  factionId: string | null,
  favelasList: PropertyFavelaRecord[],
): Map<RegionId, number> {
  const counts = new Map<RegionId, { controlled: number; total: number }>();

  for (const favela of favelasList) {
    const current = counts.get(favela.regionId) ?? { controlled: 0, total: 0 };
    current.total += 1;

    if (factionId && favela.controllingFactionId === factionId) {
      current.controlled += 1;
    }

    counts.set(favela.regionId, current);
  }

  return new Map(
    [...counts.entries()].map(([regionId, value]) => [
      regionId,
      value.total > 0 ? value.controlled / value.total : 0,
    ]),
  );
}

export function getPropertyDefinition(type: PropertyType): PropertyDefinitionSummary | undefined {
  try {
    return resolveCachedEconomyPropertyDefinition(type);
  } catch {
    return undefined;
  }
}

export function requirePropertyDefinition(type: PropertyType): PropertyDefinitionSummary {
  const definition = getPropertyDefinition(type);

  if (!definition) {
    throw new PropertyError('invalid_property', 'Definicao da propriedade nao encontrada.');
  }

  return definition;
}

export function resolvePropertyDailyUpkeep(
  definition: PropertyDefinitionSummary,
  property: {
    level: number;
    soldierRoster: Array<{
      dailyCost: number;
    }>;
  },
  regionMultiplier: number,
  maintenanceMultiplier = 1,
): number {
  const rosterDailyCost = property.soldierRoster.reduce(
    (total, entry) => total + entry.dailyCost,
    0,
  );
  const propertyMaintenance = definition.baseDailyMaintenanceCost * (1 + (property.level - 1) * 0.6);
  return roundCurrency((propertyMaintenance + rosterDailyCost) * regionMultiplier * maintenanceMultiplier);
}

function resolvePropertyUpgradeCost(
  definition: PropertyDefinitionSummary,
  nextLevel: number,
): number {
  return roundCurrency(definition.basePrice * (0.55 + nextLevel * 0.35));
}

function resolveTerritoryTier(ratio: number): TerritoryTier {
  if (ratio >= PROPERTY_DOMINATION_TIER_THRESHOLDS.absolute) {
    return 'absolute';
  }

  if (ratio >= PROPERTY_DOMINATION_TIER_THRESHOLDS.dominant) {
    return 'dominant';
  }

  if (ratio >= PROPERTY_DOMINATION_TIER_THRESHOLDS.strong) {
    return 'strong';
  }

  if (ratio >= PROPERTY_DOMINATION_TIER_THRESHOLDS.partial) {
    return 'partial';
  }

  return 'none';
}

function resolveTerritoryProtectionBonus(tier: TerritoryTier): number {
  if (tier === 'absolute') {
    return 30;
  }

  if (tier === 'dominant') {
    return 22;
  }

  if (tier === 'strong') {
    return 15;
  }

  if (tier === 'partial') {
    return 8;
  }

  return 0;
}

function resolveRiskBase(propertyType: PropertyType): {
  invasion: number;
  robbery: number;
  takeover: number;
} {
  const definition = requirePropertyDefinition(propertyType);

  if (definition.assetClass === 'real_estate') {
    if (propertyType === 'mansion') {
      return {
        invasion: 18,
        robbery: 16,
        takeover: 0,
      };
    }

    if (propertyType === 'beach_house') {
      return {
        invasion: 24,
        robbery: 26,
        takeover: 0,
      };
    }

    return {
      invasion: 26,
      robbery: 34,
      takeover: 0,
    };
  }

  if (definition.assetClass === 'vehicle') {
    if (propertyType === 'yacht') {
      return {
        invasion: 14,
        robbery: 24,
        takeover: 0,
      };
    }

    if (propertyType === 'airplane' || propertyType === 'helicopter') {
      return {
        invasion: 10,
        robbery: 22,
        takeover: 0,
      };
    }

    return {
      invasion: 12,
      robbery: 36,
      takeover: 0,
    };
  }

  if (definition.assetClass === 'luxury') {
    return {
      invasion: 14,
      robbery: 42,
      takeover: 0,
    };
  }

  if (propertyType === 'front_store') {
    return {
      invasion: 30,
      robbery: 22,
      takeover: 16,
    };
  }

  if (propertyType === 'slot_machine') {
    return {
      invasion: 28,
      robbery: 24,
      takeover: 18,
    };
  }

  return {
    invasion: 38,
    robbery: 26,
    takeover: 24,
  };
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolvePropertyDefenseScore(input: {
  factionId: string | null;
  property: Pick<PropertySnapshotRecord, 'level' | 'soldierRoster' | 'type'>;
  regionalDominationBonus: RegionalDominationBonus;
  territoryControlRatio: number;
}): number {
  const definition = requirePropertyDefinition(input.property.type);
  const soldiersPower = input.property.soldierRoster.reduce((total, entry) => total + entry.power, 0);
  const territoryTier = resolveTerritoryTier(input.territoryControlRatio);
  const territoryProtectionBonus = resolveTerritoryProtectionBonus(territoryTier);
  const factionProtectionBonus = input.factionId ? 12 : 0;
  const effectiveSoldiersPower = roundCurrency(
    soldiersPower * input.regionalDominationBonus.soldiersDefenseMultiplier,
  );

  return roundCurrency(
    definition.baseProtectionScore +
      input.property.level * 16 +
      effectiveSoldiersPower / 100 +
      factionProtectionBonus +
      territoryProtectionBonus +
      input.regionalDominationBonus.propertyDefenseBonus,
  );
}

export function buildPropertySabotageStatusSummary(input: {
  now: Date;
  sabotageRecoveryReadyAt: Date | null | undefined;
  sabotageResolvedAt: Date | null | undefined;
  sabotageState: PropertySabotageState | null | undefined;
  type: PropertyType;
}): PropertySabotageStatusSummary {
  const sabotageState = input.sabotageState ?? 'normal';
  const sabotageRecoveryReadyAt = input.sabotageRecoveryReadyAt ?? null;
  const sabotageResolvedAt = input.sabotageResolvedAt ?? null;

  return {
    blocked: sabotageState === 'destroyed',
    operationalMultiplier:
      sabotageState === 'damaged' ? 0.5 : sabotageState === 'destroyed' ? 0 : 1,
    recoveryCost: resolvePropertySabotageRecoveryCost(input.type, sabotageState),
    recoveryReady:
      sabotageState !== 'normal' &&
      sabotageRecoveryReadyAt !== null &&
      sabotageRecoveryReadyAt.getTime() <= input.now.getTime(),
    recoveryReadyAt: sabotageRecoveryReadyAt?.toISOString() ?? null,
    resolvedAt: sabotageResolvedAt?.toISOString() ?? null,
    state: sabotageState,
  };
}

function serializeOwnedPropertySummary(input: {
  factionId: string | null;
  maintenanceMultiplier: number;
  now: Date;
  property: PropertySnapshotRecord;
  regionalDominationBonus: RegionalDominationBonus;
  regionMultiplier: number;
  sync: Pick<PropertyMaintenanceSyncResult, 'moneySpentOnSync' | 'overdueDays'>;
  territoryControlRatio: number;
}): OwnedPropertySummary {
  const definition = requirePropertyDefinition(input.property.type);
  const soldiersPower = input.property.soldierRoster.reduce((total, entry) => total + entry.power, 0);
  const territoryTier = resolveTerritoryTier(input.territoryControlRatio);
  const defenseScore = resolvePropertyDefenseScore({
    factionId: input.factionId,
    property: input.property,
    regionalDominationBonus: input.regionalDominationBonus,
    territoryControlRatio: input.territoryControlRatio,
  });
  const riskBase = resolveRiskBase(input.property.type);
  const riskMitigation = defenseScore * 0.32;
  const effectiveCommissionRate = definition.profitable && input.factionId ? definition.factionCommissionRate : 0;
  const totalDailyUpkeep = resolvePropertyDailyUpkeep(
    definition,
    input.property,
    input.regionMultiplier,
    input.maintenanceMultiplier,
  );
  const invasionRisk = clampRisk(
    (riskBase.invasion - riskMitigation) * input.regionalDominationBonus.propertyRiskMultiplier,
  );
  const robberyRisk = clampRisk(
    (riskBase.robbery - riskMitigation * 0.85) * input.regionalDominationBonus.propertyRiskMultiplier,
  );
  const takeoverRisk =
    riskBase.takeover === 0
      ? 0
      : clampRisk(
          (riskBase.takeover - riskMitigation * 0.75) * input.regionalDominationBonus.propertyRiskMultiplier,
        );
  const sabotageStatus = buildPropertySabotageStatusSummary({
    now: input.now,
    sabotageRecoveryReadyAt: input.property.sabotageRecoveryReadyAt,
    sabotageResolvedAt: input.property.sabotageResolvedAt,
    sabotageState: input.property.sabotageState,
    type: input.property.type,
  });

  return {
    createdAt: input.property.createdAt.toISOString(),
    definition,
    economics: {
      effectiveFactionCommissionRate: effectiveCommissionRate,
      profitable: definition.profitable,
      totalDailyUpkeep,
    },
    favelaId: input.property.favelaId,
    id: input.property.id,
    level: input.property.level,
    maintenanceStatus: {
      blocked: input.property.suspended,
      lastMaintenanceAt: input.property.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: input.sync.moneySpentOnSync,
      overdueDays: input.sync.overdueDays,
    },
    sabotageStatus,
    protection: {
      defenseScore,
      factionProtectionActive: Boolean(input.factionId),
      invasionRisk,
      robberyRisk,
      soldiersPower,
      takeoverRisk,
      territoryControlRatio: roundCurrency(input.territoryControlRatio),
      territoryTier,
    },
    regionId: input.property.regionId,
    soldierRoster: input.property.soldierRoster.map((entry) => ({
      count: entry.count,
      dailyCost: entry.dailyCost,
      label: entry.label,
      totalPower: entry.power,
      type: entry.type,
    })),
    soldiersCount: input.property.soldierRoster.reduce(
      (total, entry: PropertySoldierRosterRecord) => total + entry.count,
      0,
    ),
    status: sabotageStatus.blocked ? 'sabotage_blocked' : input.property.suspended ? 'maintenance_blocked' : 'active',
    type: input.property.type,
  };
}

function clampRisk(value: number): number {
  return roundCurrency(Math.max(0, Math.min(95, value)));
}

function resolvePropertySabotageAvailability(player: PropertyPlayerRecord) {
  if (player.level < PROPERTY_SABOTAGE_LEVEL_REQUIRED) {
    return {
      available: false,
      cansacoCost: PROPERTY_SABOTAGE_CANSACO_COST,
      disposicaoCost: PROPERTY_SABOTAGE_DISPOSICAO_COST,
      levelRequired: PROPERTY_SABOTAGE_LEVEL_REQUIRED,
      reason: `Nivel ${PROPERTY_SABOTAGE_LEVEL_REQUIRED} exigido para sabotagem.`,
    } satisfies PropertySabotageCenterResponse['availability'];
  }

  if (player.cansaco < PROPERTY_SABOTAGE_CANSACO_COST) {
    return {
      available: false,
      cansacoCost: PROPERTY_SABOTAGE_CANSACO_COST,
      disposicaoCost: PROPERTY_SABOTAGE_DISPOSICAO_COST,
      levelRequired: PROPERTY_SABOTAGE_LEVEL_REQUIRED,
      reason: 'Cansaco insuficiente para a sabotagem.',
    } satisfies PropertySabotageCenterResponse['availability'];
  }

  if (player.disposicao < PROPERTY_SABOTAGE_DISPOSICAO_COST) {
    return {
      available: false,
      cansacoCost: PROPERTY_SABOTAGE_CANSACO_COST,
      disposicaoCost: PROPERTY_SABOTAGE_DISPOSICAO_COST,
      levelRequired: PROPERTY_SABOTAGE_LEVEL_REQUIRED,
      reason: 'Disposicao insuficiente para a sabotagem.',
    } satisfies PropertySabotageCenterResponse['availability'];
  }

  return {
    available: true,
    cansacoCost: PROPERTY_SABOTAGE_CANSACO_COST,
    disposicaoCost: PROPERTY_SABOTAGE_DISPOSICAO_COST,
    levelRequired: PROPERTY_SABOTAGE_LEVEL_REQUIRED,
    reason: null,
  } satisfies PropertySabotageCenterResponse['availability'];
}

function resolvePropertySabotageAttackScore(
  player: PropertyPlayerRecord,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
): number {
  const vocationBonus: Record<VocationType, number> = {
    [VocationType.Cria]: 10,
    [VocationType.Empreendedor]: 8,
    [VocationType.Gerente]: 12,
    [VocationType.Politico]: 6,
    [VocationType.Soldado]: 18,
  };
  const baseScore =
    player.level * 8 +
    player.forca * 0.9 +
    player.inteligencia * 1.2 +
    player.resistencia * 0.8 +
    player.carisma * 0.5 +
    vocationBonus[player.vocation];
  const passiveMultiplier =
    passiveProfile.social.communityInfluenceMultiplier + passiveProfile.faction.factionCharismaAura;

  return roundCurrency(baseScore * Math.max(1, passiveMultiplier));
}

function resolvePropertySabotageOutcome(attackRatio: number): PropertySabotageOutcome {
  if (attackRatio < 0.85) {
    return 'failure_hard';
  }

  if (attackRatio < 1.15) {
    return 'failure_clean';
  }

  if (attackRatio < 1.5) {
    return 'damaged';
  }

  return 'destroyed';
}

function resolvePropertySabotageState(outcome: PropertySabotageOutcome): PropertySabotageState {
  if (outcome === 'damaged' || outcome === 'destroyed') {
    return outcome;
  }

  return 'normal';
}

function resolvePropertySabotageRecoveryCost(
  type: PropertyType,
  sabotageState: PropertySabotageState,
): number | null {
  if (sabotageState === 'normal') {
    return null;
  }

  const definition = requirePropertyDefinition(type);
  const basePrice = definition.basePrice > 0 ? definition.basePrice : type === 'factory' ? 50000 : 0;

  if (sabotageState === 'damaged') {
    return roundCurrency(basePrice * PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE);
  }

  return roundCurrency(basePrice * PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE);
}

function resolvePropertySabotageCooldownSeconds(
  latestLog: PropertySabotageLogRecord | null,
  now: Date,
): number {
  if (!latestLog) {
    return 0;
  }

  const cooldownMs = PROPERTY_SABOTAGE_PROPERTY_COOLDOWN_HOURS * 60 * 60 * 1000;
  const remainingMs = latestLog.createdAt.getTime() + cooldownMs - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function resolvePropertySabotageMessage(outcome: PropertySabotageOutcome): string {
  switch (outcome) {
    case 'failure_hard':
      return 'A sabotagem deu ruim, levantou suspeita pesada e a resposta veio no pior cenario.';
    case 'failure_clean':
      return 'A tentativa falhou sem dano estrutural, mas o alvo percebeu a movimentacao.';
    case 'damaged':
      return 'A sabotagem causou avaria e a operacao rival caiu para metade do ritmo.';
    case 'destroyed':
      return 'A sabotagem destruiu a operacao rival e o alvo ficou parado ate reconstruir.';
  }

  return 'A sabotagem foi registrada.';
}

function isUnderNoviceProtection(
  characterCreatedAt: Date | null,
  now: Date,
): boolean {
  if (!characterCreatedAt) {
    return true;
  }

  return now.getTime() - characterCreatedAt.getTime() < 72 * 60 * 60 * 1000;
}

function serializeSabotageLogSummary(log: PropertySabotageLogRecord): PropertySabotageLogSummary {
  return {
    attackRatio: log.attackRatio,
    attackScore: log.attackScore,
    attackerFactionId: log.attackerFactionId,
    attackerPlayerId: log.attackerPlayerId,
    createdAt: log.createdAt.toISOString(),
    defenseScore: log.defenseScore,
    favelaId: log.favelaId,
    heatDelta: log.heatDelta,
    id: log.id,
    outcome: log.outcome,
    ownerAlertMode: log.ownerAlertMode,
    ownerFactionId: log.ownerFactionId,
    ownerPlayerId: log.ownerPlayerId,
    prisonMinutes: log.prisonMinutes,
    propertyId: log.propertyId,
    regionId: log.regionId,
    type: log.type,
  };
}

function serializeSabotageLogRecord(row: {
  attackRatio: string | number;
  attackScore: string | number;
  attackerFactionId: string | null;
  attackerPlayerId: string;
  createdAt: Date;
  defenseScore: string | number;
  favelaId: string | null;
  heatDelta: number;
  id: string;
  outcome: PropertySabotageOutcome;
  ownerAlertMode: 'anonymous' | 'identified';
  ownerFactionId: string | null;
  ownerPlayerId: string;
  prisonMinutes: number | null;
  propertyId: string;
  regionId: RegionId | string;
  type: PropertyType | string;
}): PropertySabotageLogRecord {
  return {
    attackRatio: Number.parseFloat(String(row.attackRatio)),
    attackScore: Number.parseFloat(String(row.attackScore)),
    attackerFactionId: row.attackerFactionId,
    attackerPlayerId: row.attackerPlayerId,
    createdAt: row.createdAt,
    defenseScore: Number.parseFloat(String(row.defenseScore)),
    favelaId: row.favelaId,
    heatDelta: row.heatDelta,
    id: row.id,
    outcome: row.outcome,
    ownerAlertMode: row.ownerAlertMode,
    ownerFactionId: row.ownerFactionId,
    ownerPlayerId: row.ownerPlayerId,
    prisonMinutes: row.prisonMinutes,
    propertyId: row.propertyId,
    regionId: row.regionId as RegionId,
    type: row.type as PropertyType,
  };
}

async function loadPropertyRosterByProperty(propertyIds: string[]) {
  const rosterByProperty = new Map<string, Map<SoldierType, PropertySoldierRosterRecord>>();

  if (propertyIds.length === 0) {
    return rosterByProperty;
  }

  const rosterRows = await db
    .select({
      dailyCost: soldiers.dailyCost,
      label: soldierTemplates.name,
      power: soldiers.power,
      propertyId: soldiers.propertyId,
      type: soldiers.type,
    })
    .from(soldiers)
    .innerJoin(soldierTemplates, eq(soldierTemplates.type, soldiers.type))
    .where(inArray(soldiers.propertyId, propertyIds));

  for (const rosterRow of rosterRows) {
    const propertyRoster =
      rosterByProperty.get(rosterRow.propertyId) ?? new Map<SoldierType, PropertySoldierRosterRecord>();
    const current = propertyRoster.get(rosterRow.type as SoldierType);

    if (current) {
      current.count += 1;
      current.power += rosterRow.power;
      current.dailyCost = roundCurrency(current.dailyCost + Number.parseFloat(String(rosterRow.dailyCost)));
    } else {
      propertyRoster.set(rosterRow.type as SoldierType, {
        count: 1,
        dailyCost: roundCurrency(Number.parseFloat(String(rosterRow.dailyCost))),
        label: rosterRow.label,
        power: rosterRow.power,
        type: rosterRow.type as SoldierType,
      });
    }

    rosterByProperty.set(rosterRow.propertyId, propertyRoster);
  }

  return rosterByProperty;
}

function validatePropertyLocation(
  input: PropertyPurchaseInput,
  definition: PropertyDefinitionSummary,
  favelasList: PropertyFavelaRecord[],
): void {
  if ((definition.type === 'boca' || definition.type === 'rave') && !input.favelaId) {
    throw new PropertyError('validation', 'Esta propriedade exige uma favela especifica.');
  }

  if (!input.favelaId) {
    return;
  }

  const favela = favelasList.find((entry) => entry.id === input.favelaId);

  if (!favela) {
    throw new PropertyError('invalid_favela', 'Favela nao encontrada para esta propriedade.');
  }

  if (favela.regionId !== input.regionId) {
    throw new PropertyError('invalid_favela', 'A favela informada nao pertence a regiao escolhida.');
  }
}
