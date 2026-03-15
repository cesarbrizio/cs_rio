import {
  PROPERTY_DOMINATION_TIER_THRESHOLDS,
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  type OwnedPropertySummary,
  type PropertyCatalogResponse,
  type PropertyDefinitionSummary,
  type PropertyHireSoldiersInput,
  type PropertyHireSoldiersResponse,
  type PropertyPurchaseInput,
  type PropertyPurchaseResponse,
  type PropertyType,
  type RegionId,
  SOLDIER_TEMPLATES,
  type SoldierTemplateSummary,
  type SoldierType,
  type PropertyUpgradeResponse,
} from '@cs-rio/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionMembers,
  favelas,
  players,
  properties,
  regions,
  soldiers,
  soldierTemplates,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { type FactionUpgradeEffectReaderContract } from './faction.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
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
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  level: number;
  money: number;
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
  soldierRoster: PropertySoldierRosterRecord[];
  suspended: boolean;
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
  getFavelaForceState(favelaId: string): Promise<PropertyFavelaForceRecord | null>;
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
  listSoldierTemplates(): Promise<SoldierTemplateSummary[]>;
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
  repository?: PropertyRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface PropertyServiceContract {
  close?(): Promise<void>;
  hireSoldiers(
    playerId: string,
    propertyId: string,
    input: PropertyHireSoldiersInput,
  ): Promise<PropertyHireSoldiersResponse>;
  listProperties(playerId: string): Promise<PropertyCatalogResponse>;
  purchaseProperty(playerId: string, input: PropertyPurchaseInput): Promise<PropertyPurchaseResponse>;
  upgradeProperty(playerId: string, propertyId: string): Promise<PropertyUpgradeResponse>;
}

type PropertyErrorCode =
  | 'capacity'
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_funds'
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
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        level: players.level,
        money: players.money,
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
      characterCreatedAt: player.characterCreatedAt,
      factionId: membership?.factionId ?? player.factionId ?? null,
      id: player.id,
      level: player.level,
      money: roundCurrency(Number.parseFloat(String(player.money))),
    };
  }

  async getProperty(playerId: string, propertyId: string): Promise<PropertySnapshotRecord | null> {
    const propertiesList = await this.listProperties(playerId);
    return propertiesList.find((property) => property.id === propertyId) ?? null;
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
        soldiersCount: properties.soldiersCount,
        suspended: properties.suspended,
        type: properties.type,
      })
      .from(properties)
      .where(eq(properties.playerId, playerId));

    if (propertyRows.length === 0) {
      return [];
    }

    const propertyIds = propertyRows.map((property) => property.id);
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
    const rosterByProperty = new Map<string, Map<SoldierType, PropertySoldierRosterRecord>>();

    for (const rosterRow of rosterRows) {
      const propertyRoster = rosterByProperty.get(rosterRow.propertyId) ?? new Map<SoldierType, PropertySoldierRosterRecord>();
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

  private readonly repository: PropertyRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  constructor(options: PropertyServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
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
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
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

function resolvePropertyPrestigeScore(
  definition: PropertyDefinitionSummary,
  property: Pick<PropertySnapshotRecord, 'level'>,
): number {
  return roundCurrency(definition.prestigeScore * (1 + (property.level - 1) * 0.35));
}

function serializeOwnedPropertySummary(input: {
  factionId: string | null;
  maintenanceMultiplier: number;
  property: PropertySnapshotRecord;
  regionalDominationBonus: RegionalDominationBonus;
  regionMultiplier: number;
  sync: Pick<PropertyMaintenanceSyncResult, 'moneySpentOnSync' | 'overdueDays'>;
  territoryControlRatio: number;
}): OwnedPropertySummary {
  const definition = requirePropertyDefinition(input.property.type);
  const soldiersPower = input.property.soldierRoster.reduce((total, entry) => total + entry.power, 0);
  const territoryTier = resolveTerritoryTier(input.territoryControlRatio);
  const territoryProtectionBonus = resolveTerritoryProtectionBonus(territoryTier);
  const factionProtectionBonus = input.factionId ? 12 : 0;
  const effectivePrestigeScore = resolvePropertyPrestigeScore(definition, input.property);
  const effectiveSoldiersPower = roundCurrency(
    soldiersPower * input.regionalDominationBonus.soldiersDefenseMultiplier,
  );
  const defenseScore = roundCurrency(
    definition.baseProtectionScore +
      input.property.level * 16 +
      effectiveSoldiersPower / 100 +
      factionProtectionBonus +
      territoryProtectionBonus +
      input.regionalDominationBonus.propertyDefenseBonus,
  );
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

  return {
    createdAt: input.property.createdAt.toISOString(),
    definition,
    economics: {
      effectiveFactionCommissionRate: effectiveCommissionRate,
      effectivePrestigeScore,
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
    status: input.property.suspended ? 'maintenance_blocked' : 'active',
    type: input.property.type,
  };
}

function clampRisk(value: number): number {
  return roundCurrency(Math.max(0, Math.min(95, value)));
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
