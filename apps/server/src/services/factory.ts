import {
  type DrugFactoryCollectResponse,
  type DrugFactoryCreateInput,
  type DrugFactoryCreateResponse,
  type DrugFactoryListResponse,
  type DrugFactoryRecipeSummary,
  type RegionId,
  type DrugFactoryStockInput,
  type DrugFactoryStockResponse,
  type DrugFactorySummary,
  VocationType,
} from '@cs-rio/shared';
import { and, eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  components,
  drugFactories,
  drugFactoryComponentStocks,
  drugFactoryRecipeComponents,
  drugFactoryRecipes,
  drugs,
  factionMembers,
  favelas,
  playerInventory,
  players,
  properties,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import {
  buildFactionRegionalDominationByRegion,
  buildInactiveRegionalDominationBonus,
  type RegionalDominationBonus,
  type RegionalDominationFavelaRecord,
} from './regional-domination.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';

const DRUG_FACTORY_CYCLE_FALLBACK_MINUTES = 60;
const DRUG_FACTORY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DRUG_FACTORY_MANAGER_VOCATION_MULTIPLIER = 1.15;

interface FactoryPlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  inteligencia: number;
  level: number;
  money: number;
  regionId: RegionId;
  vocation: VocationType;
}

interface FactoryRequirementRecord {
  availableQuantity: number;
  componentId: string;
  componentName: string;
  quantityPerCycle: number;
}

interface FactoryRecipeRecord {
  baseProduction: number;
  cycleMinutes: number;
  dailyMaintenanceCost: number;
  drugId: string;
  drugName: string;
  levelRequired: number;
  requirements: FactoryRequirementRecord[];
}

interface FactorySnapshotRecord extends FactoryRecipeRecord {
  createdAt: Date;
  id: string;
  impulseMultiplier: number;
  lastCycleAt: Date;
  lastMaintenanceAt: Date;
  regionId: RegionId;
  storedOutput: number;
  suspended: boolean;
}

interface FactoryStateUpdateInput {
  componentQuantities: Array<{
    componentId: string;
    quantity: number;
  }>;
  factoryId: string;
  lastCycleAt: Date;
  lastMaintenanceAt: Date;
  moneySpent: number;
  storedOutput: number;
  suspended: boolean;
}

interface FactoryStockTransferRecord {
  componentId: string;
  componentName: string;
  transferredQuantity: number;
}

interface FactorySyncResult {
  blockedReason: 'components' | 'maintenance' | null;
  changed: boolean;
  maintenanceStatus: {
    blocked: boolean;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  nextMoney: number;
  snapshot: FactorySnapshotRecord;
}

export interface FactoryRepository {
  applyFactoryState(playerId: string, input: FactoryStateUpdateInput): Promise<boolean>;
  collectFactoryOutput(playerId: string, factoryId: string, quantity: number): Promise<boolean>;
  createFactory(input: {
    drugId: string;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
  }): Promise<FactorySnapshotRecord | null>;
  getFactory(playerId: string, factoryId: string): Promise<FactorySnapshotRecord | null>;
  getPlayer(playerId: string): Promise<FactoryPlayerRecord | null>;
  getRecipe(drugId: string): Promise<FactoryRecipeRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  listFactories(playerId: string): Promise<FactorySnapshotRecord[]>;
  listRecipes(): Promise<FactoryRecipeRecord[]>;
  stockFactoryComponent(
    playerId: string,
    factoryId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<FactoryStockTransferRecord | null>;
}

export interface FactoryServiceOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  repository?: FactoryRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface FactoryServiceContract {
  close?(): Promise<void>;
  collectOutput(playerId: string, factoryId: string): Promise<DrugFactoryCollectResponse>;
  createFactory(playerId: string, input: DrugFactoryCreateInput): Promise<DrugFactoryCreateResponse>;
  listFactories(playerId: string): Promise<DrugFactoryListResponse>;
  stockComponent(
    playerId: string,
    factoryId: string,
    input: DrugFactoryStockInput,
  ): Promise<DrugFactoryStockResponse>;
}

type FactoryErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_components'
  | 'invalid_component'
  | 'invalid_recipe'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class FactoryError extends Error {
  constructor(
    public readonly code: FactoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FactoryError';
  }
}

export class DatabaseFactoryRepository implements FactoryRepository {
  async applyFactoryState(playerId: string, input: FactoryStateUpdateInput): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [factory] = await tx
        .select({
          propertyId: drugFactories.propertyId,
        })
        .from(drugFactories)
        .innerJoin(properties, eq(properties.id, drugFactories.propertyId))
        .where(
          and(
            eq(drugFactories.propertyId, input.factoryId),
            eq(properties.playerId, playerId),
          ),
        )
        .limit(1);

      if (!factory) {
        return false;
      }

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

        const nextMoney = Math.max(0, roundCurrency(Number.parseFloat(String(player.money)) - input.moneySpent));

        await tx
          .update(players)
          .set({
            money: nextMoney.toFixed(2),
          })
          .where(eq(players.id, playerId));
      }

      await tx
        .update(drugFactories)
        .set({
          lastCycleAt: input.lastCycleAt,
          lastMaintenanceAt: input.lastMaintenanceAt,
          storedOutput: input.storedOutput,
          suspended: input.suspended,
        })
        .where(eq(drugFactories.propertyId, input.factoryId));

      for (const stock of input.componentQuantities) {
        const [existing] = await tx
          .select({
            componentId: drugFactoryComponentStocks.componentId,
          })
          .from(drugFactoryComponentStocks)
          .where(
            and(
              eq(drugFactoryComponentStocks.propertyId, input.factoryId),
              eq(drugFactoryComponentStocks.componentId, stock.componentId),
            ),
          )
          .limit(1);

        if (existing) {
          await tx
            .update(drugFactoryComponentStocks)
            .set({
              quantity: stock.quantity,
            })
            .where(
              and(
                eq(drugFactoryComponentStocks.propertyId, input.factoryId),
                eq(drugFactoryComponentStocks.componentId, stock.componentId),
              ),
            );
        } else {
          await tx.insert(drugFactoryComponentStocks).values({
            componentId: stock.componentId,
            propertyId: input.factoryId,
            quantity: stock.quantity,
          });
        }
      }

      return true;
    });
  }

  async collectFactoryOutput(playerId: string, factoryId: string, quantity: number): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [factory] = await tx
        .select({
          drugId: drugFactories.drugId,
          storedOutput: drugFactories.storedOutput,
        })
        .from(drugFactories)
        .innerJoin(properties, eq(properties.id, drugFactories.propertyId))
        .where(
          and(
            eq(drugFactories.propertyId, factoryId),
            eq(properties.playerId, playerId),
          ),
        )
        .limit(1);

      if (!factory || factory.storedOutput < quantity) {
        return false;
      }

      await tx
        .update(drugFactories)
        .set({
          storedOutput: factory.storedOutput - quantity,
        })
        .where(eq(drugFactories.propertyId, factoryId));

      const [existingInventory] = await tx
        .select({
          id: playerInventory.id,
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.itemType, 'drug'),
            eq(playerInventory.itemId, factory.drugId),
          ),
        )
        .limit(1);

      if (existingInventory) {
        await tx
          .update(playerInventory)
          .set({
            quantity: existingInventory.quantity + quantity,
          })
          .where(eq(playerInventory.id, existingInventory.id));
      } else {
        await tx.insert(playerInventory).values({
          itemId: factory.drugId,
          itemType: 'drug',
          playerId,
          quantity,
        });
      }

      return true;
    });
  }

  async createFactory(input: {
    drugId: string;
    playerId: string;
    regionId: RegionId;
    startedAt: Date;
  }): Promise<FactorySnapshotRecord | null> {
    const recipe = await this.getRecipe(input.drugId);

    if (!recipe) {
      return null;
    }

    const [createdProperty] = await db
      .insert(properties)
      .values({
        playerId: input.playerId,
        regionId: input.regionId,
        type: 'factory',
      })
      .returning({
        id: properties.id,
      });

    if (!createdProperty) {
      return null;
    }

    await db.insert(drugFactories).values({
      drugId: input.drugId,
      lastCycleAt: input.startedAt,
      lastMaintenanceAt: input.startedAt,
      propertyId: createdProperty.id,
    });

    return this.getFactory(input.playerId, createdProperty.id);
  }

  async getFactory(playerId: string, factoryId: string): Promise<FactorySnapshotRecord | null> {
    const factories = await this.listFactories(playerId);
    return factories.find((factory) => factory.id === factoryId) ?? null;
  }

  async getPlayer(playerId: string): Promise<FactoryPlayerRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        money: players.money,
        regionId: players.regionId,
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
      characterCreatedAt: player.characterCreatedAt,
      factionId: membership?.factionId ?? player.factionId ?? null,
      id: player.id,
      inteligencia: player.inteligencia,
      level: player.level,
      money: roundCurrency(Number.parseFloat(String(player.money))),
      regionId: player.regionId as RegionId,
      vocation: player.vocation as VocationType,
    };
  }

  async getRecipe(drugId: string): Promise<FactoryRecipeRecord | null> {
    const recipes = await this.listRecipes();
    return recipes.find((recipe) => recipe.drugId === drugId) ?? null;
  }

  async listFavelas(): Promise<RegionalDominationFavelaRecord[]> {
    return db
      .select({
        controllingFactionId: favelas.controllingFactionId,
        regionId: favelas.regionId,
      })
      .from(favelas)
      .then((rows) =>
        rows.map((row) => ({
          controllingFactionId: row.controllingFactionId,
          regionId: row.regionId as RegionId,
        })),
      );
  }

  async listFactories(playerId: string): Promise<FactorySnapshotRecord[]> {
    const factoryRows = await db
      .select({
        createdAt: properties.createdAt,
        drugId: drugFactories.drugId,
        id: properties.id,
        impulseMultiplier: drugFactories.impulseMultiplier,
        lastCycleAt: drugFactories.lastCycleAt,
        lastMaintenanceAt: drugFactories.lastMaintenanceAt,
        regionId: properties.regionId,
        storedOutput: drugFactories.storedOutput,
        suspended: drugFactories.suspended,
      })
      .from(drugFactories)
      .innerJoin(properties, eq(properties.id, drugFactories.propertyId))
      .where(eq(properties.playerId, playerId));

    if (factoryRows.length === 0) {
      return [];
    }

    const recipeByDrugId = new Map(
      (await this.listRecipes()).map((recipe) => [recipe.drugId, recipe]),
    );
    const stocksRows = await db
      .select({
        componentId: drugFactoryComponentStocks.componentId,
        factoryId: drugFactoryComponentStocks.propertyId,
        quantity: drugFactoryComponentStocks.quantity,
      })
      .from(drugFactoryComponentStocks)
      .innerJoin(properties, eq(properties.id, drugFactoryComponentStocks.propertyId))
      .where(eq(properties.playerId, playerId));
    const stocksByFactoryId = new Map<string, Map<string, number>>();

    for (const stock of stocksRows) {
      const factoryStocks = stocksByFactoryId.get(stock.factoryId) ?? new Map<string, number>();
      factoryStocks.set(stock.componentId, stock.quantity);
      stocksByFactoryId.set(stock.factoryId, factoryStocks);
    }

    return factoryRows.flatMap((row) => {
      const recipe = recipeByDrugId.get(row.drugId);

      if (!recipe) {
        return [];
      }

      const availableStocks = stocksByFactoryId.get(row.id) ?? new Map<string, number>();

      return [
        {
          baseProduction: recipe.baseProduction,
          createdAt: row.createdAt,
          cycleMinutes: recipe.cycleMinutes,
          dailyMaintenanceCost: recipe.dailyMaintenanceCost,
          drugId: recipe.drugId,
          drugName: recipe.drugName,
          id: row.id,
          impulseMultiplier: Number.parseFloat(String(row.impulseMultiplier)),
          lastCycleAt: row.lastCycleAt,
          lastMaintenanceAt: row.lastMaintenanceAt,
          levelRequired: recipe.levelRequired,
          regionId: row.regionId as RegionId,
          requirements: recipe.requirements.map((requirement) => ({
            ...requirement,
            availableQuantity: availableStocks.get(requirement.componentId) ?? 0,
          })),
          storedOutput: row.storedOutput,
          suspended: row.suspended,
        },
      ];
    });
  }

  async listRecipes(): Promise<FactoryRecipeRecord[]> {
    const recipeRows = await db
      .select({
        baseProduction: drugFactoryRecipes.baseProduction,
        cycleMinutes: drugFactoryRecipes.cycleMinutes,
        dailyMaintenanceCost: drugFactoryRecipes.dailyMaintenanceCost,
        drugId: drugs.id,
        drugName: drugs.name,
        levelRequired: drugs.productionLevel,
      })
      .from(drugFactoryRecipes)
      .innerJoin(drugs, eq(drugs.id, drugFactoryRecipes.drugId));
    const requirementRows = await db
      .select({
        componentId: components.id,
        componentName: components.name,
        drugId: drugFactoryRecipeComponents.drugId,
        quantityRequired: drugFactoryRecipeComponents.quantityRequired,
      })
      .from(drugFactoryRecipeComponents)
      .innerJoin(components, eq(components.id, drugFactoryRecipeComponents.componentId));
    const requirementsByDrugId = new Map<string, FactoryRequirementRecord[]>();

    for (const requirement of requirementRows) {
      const current = requirementsByDrugId.get(requirement.drugId) ?? [];

      current.push({
        availableQuantity: 0,
        componentId: requirement.componentId,
        componentName: requirement.componentName,
        quantityPerCycle: requirement.quantityRequired,
      });
      requirementsByDrugId.set(requirement.drugId, current);
    }

    return recipeRows.map((recipe) => ({
      baseProduction: recipe.baseProduction,
      cycleMinutes: recipe.cycleMinutes,
      dailyMaintenanceCost: roundCurrency(Number.parseFloat(String(recipe.dailyMaintenanceCost))),
      drugId: recipe.drugId,
      drugName: recipe.drugName,
      levelRequired: recipe.levelRequired,
      requirements: requirementsByDrugId.get(recipe.drugId) ?? [],
    }));
  }

  async stockFactoryComponent(
    playerId: string,
    factoryId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<FactoryStockTransferRecord | null> {
    return db.transaction(async (tx) => {
      const factoryRequirements = await tx
        .select({
          componentId: drugFactoryRecipeComponents.componentId,
          componentName: components.name,
          propertyId: properties.id,
          quantityRequired: drugFactoryRecipeComponents.quantityRequired,
        })
        .from(properties)
        .innerJoin(drugFactories, eq(drugFactories.propertyId, properties.id))
        .innerJoin(drugFactoryRecipeComponents, eq(drugFactoryRecipeComponents.drugId, drugFactories.drugId))
        .innerJoin(components, eq(components.id, drugFactoryRecipeComponents.componentId))
        .where(
          and(
            eq(properties.id, factoryId),
            eq(properties.playerId, playerId),
          ),
        );

      if (factoryRequirements.length === 0) {
        return null;
      }

      const [inventoryItem] = await tx
        .select({
          id: playerInventory.id,
          itemId: playerInventory.itemId,
          itemType: playerInventory.itemType,
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.id, inventoryItemId),
            eq(playerInventory.playerId, playerId),
          ),
        )
        .limit(1);

      if (!inventoryItem || inventoryItem.itemType !== 'component' || !inventoryItem.itemId) {
        return null;
      }

      const factoryRequirement = factoryRequirements.find(
        (requirement) => requirement.componentId === inventoryItem.itemId,
      );

      if (!factoryRequirement || inventoryItem.quantity < quantity) {
        return null;
      }

      if (inventoryItem.quantity === quantity) {
        await tx.delete(playerInventory).where(eq(playerInventory.id, inventoryItem.id));
      } else {
        await tx
          .update(playerInventory)
          .set({
            quantity: inventoryItem.quantity - quantity,
          })
          .where(eq(playerInventory.id, inventoryItem.id));
      }

      const [existingStock] = await tx
        .select({
          quantity: drugFactoryComponentStocks.quantity,
        })
        .from(drugFactoryComponentStocks)
        .where(
          and(
            eq(drugFactoryComponentStocks.propertyId, factoryId),
            eq(drugFactoryComponentStocks.componentId, inventoryItem.itemId),
          ),
        )
        .limit(1);

      if (existingStock) {
        await tx
          .update(drugFactoryComponentStocks)
          .set({
            quantity: existingStock.quantity + quantity,
          })
          .where(
            and(
              eq(drugFactoryComponentStocks.propertyId, factoryId),
              eq(drugFactoryComponentStocks.componentId, inventoryItem.itemId),
            ),
          );
      } else {
        await tx.insert(drugFactoryComponentStocks).values({
          componentId: inventoryItem.itemId,
          propertyId: factoryId,
          quantity,
        });
      }

      return {
        componentId: inventoryItem.itemId,
        componentName: factoryRequirement.componentName,
        transferredQuantity: quantity,
      };
    });
  }
}

export class FactoryService implements FactoryServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: FactoryRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: FactoryServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseFactoryRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  private async resolveRegionalDominationByRegion(factionId: string | null) {
    return buildFactionRegionalDominationByRegion(
      factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
  }

  async collectOutput(playerId: string, factoryId: string): Promise<DrugFactoryCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncFactory(player, factoryId, passiveProfile);

    if (synced.snapshot.storedOutput < 1) {
      throw new FactoryError('conflict', 'Esta fabrica nao possui droga pronta para coleta.');
    }

    const collectedQuantity = synced.snapshot.storedOutput;
    const collected = await this.repository.collectFactoryOutput(playerId, factoryId, collectedQuantity);

    if (!collected) {
      throw new FactoryError('not_found', 'Fabrica nao encontrada para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const refreshedFactory = await this.requireFactory(playerId, factoryId);
    const regionalDominationBonus =
      (await this.resolveRegionalDominationByRegion(player.factionId)).get(refreshedFactory.regionId) ??
      buildInactiveRegionalDominationBonus(refreshedFactory.regionId);

    return {
      collectedQuantity,
      drug: {
        id: refreshedFactory.drugId,
        name: refreshedFactory.drugName,
      },
      factory: serializeFactorySummary(
        refreshedFactory,
        player,
        passiveProfile,
        {
          blockedReason: refreshedFactory.suspended ? 'maintenance' : null,
          maintenanceStatus: {
            blocked: refreshedFactory.suspended,
            moneySpentOnSync: 0,
            overdueDays: 0,
          },
        },
        regionalDominationBonus,
      ),
    };
  }

  async createFactory(playerId: string, input: DrugFactoryCreateInput): Promise<DrugFactoryCreateResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);

    if (!input.drugId || input.drugId.trim().length === 0) {
      throw new FactoryError('validation', 'Selecione uma droga valida para a fabrica.');
    }

    const recipe = await this.repository.getRecipe(input.drugId);

    if (!recipe) {
      throw new FactoryError('invalid_recipe', 'Receita da fabrica nao encontrada.');
    }

    if (player.level < recipe.levelRequired) {
      throw new FactoryError(
        'conflict',
        `Nivel insuficiente para abrir fabrica de ${recipe.drugName}.`,
      );
    }

    const createdFactory = await this.repository.createFactory({
      drugId: input.drugId,
      playerId,
      regionId: player.regionId,
      startedAt: this.now(),
    });

    if (!createdFactory) {
      throw new FactoryError('conflict', 'Nao foi possivel provisionar a fabrica.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const regionalDominationBonus =
      (await this.resolveRegionalDominationByRegion(player.factionId)).get(createdFactory.regionId) ??
      buildInactiveRegionalDominationBonus(createdFactory.regionId);

    return {
      factory: serializeFactorySummary(
        createdFactory,
        player,
        passiveProfile,
        {
          blockedReason: null,
          maintenanceStatus: {
            blocked: false,
            moneySpentOnSync: 0,
            overdueDays: 0,
          },
        },
        regionalDominationBonus,
      ),
    };
  }

  async listFactories(playerId: string): Promise<DrugFactoryListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [passiveProfile, recipes, factories, favelasList] = await Promise.all([
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listRecipes(),
      this.repository.listFactories(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    let workingPlayer = player;
    let changed = false;
    const summaries: DrugFactorySummary[] = [];

    for (const factory of [...factories].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      const regionalDominationBonus =
        regionalDominationByRegion.get(factory.regionId) ??
        buildInactiveRegionalDominationBonus(factory.regionId);
      const synced = await this.syncFactoryRecord(
        workingPlayer,
        factory,
        passiveProfile,
        regionalDominationBonus,
      );

      changed ||= synced.changed;
      workingPlayer = {
        ...workingPlayer,
        money: synced.nextMoney,
      };
      summaries.push(
        serializeFactorySummary(
          synced.snapshot,
          workingPlayer,
          passiveProfile,
          synced,
          regionalDominationBonus,
        ),
      );
    }

    if (changed) {
      await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    }

    return {
      availableRecipes: recipes.map(serializeRecipeSummary),
      factories: summaries,
    };
  }

  async stockComponent(
    playerId: string,
    factoryId: string,
    input: DrugFactoryStockInput,
  ): Promise<DrugFactoryStockResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new FactoryError('validation', 'Quantidade de componente deve ser um inteiro maior ou igual a 1.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncFactory(player, factoryId, passiveProfile);
    const transferred = await this.repository.stockFactoryComponent(
      playerId,
      factoryId,
      input.inventoryItemId,
      input.quantity,
    );

    if (!transferred) {
      throw new FactoryError(
        'invalid_component',
        'Componente invalido, ausente no inventario ou nao pertencente a esta receita.',
      );
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const refreshedFactory = await this.requireFactory(playerId, factoryId);
    const regionalDominationBonus =
      (await this.resolveRegionalDominationByRegion(player.factionId)).get(refreshedFactory.regionId) ??
      buildInactiveRegionalDominationBonus(refreshedFactory.regionId);

    return {
      component: {
        id: transferred.componentId,
        name: transferred.componentName,
      },
      factory: serializeFactorySummary(
        refreshedFactory,
        {
          ...player,
          money: synced.nextMoney,
        },
        passiveProfile,
        {
          blockedReason: refreshedFactory.suspended ? 'maintenance' : null,
          maintenanceStatus: {
            blocked: refreshedFactory.suspended,
            moneySpentOnSync: 0,
            overdueDays: 0,
          },
        },
        regionalDominationBonus,
      ),
      transferredQuantity: transferred.transferredQuantity,
    };
  }

  private async requireFactory(playerId: string, factoryId: string): Promise<FactorySnapshotRecord> {
    const factory = await this.repository.getFactory(playerId, factoryId);

    if (!factory) {
      throw new FactoryError('not_found', 'Fabrica nao encontrada.');
    }

    return factory;
  }

  private async requireReadyPlayer(playerId: string): Promise<FactoryPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new FactoryError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new FactoryError('character_not_ready', 'Crie seu personagem antes de operar fabricas.');
    }

    return player;
  }

  private async syncFactory(
    player: FactoryPlayerRecord,
    factoryId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<FactorySyncResult> {
    const factory = await this.requireFactory(player.id, factoryId);
    const regionalDominationBonus =
      (await this.resolveRegionalDominationByRegion(player.factionId)).get(factory.regionId) ??
      buildInactiveRegionalDominationBonus(factory.regionId);
    return this.syncFactoryRecord(player, factory, passiveProfile, regionalDominationBonus);
  }

  private async syncFactoryRecord(
    player: FactoryPlayerRecord,
    factory: FactorySnapshotRecord,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
  ): Promise<FactorySyncResult> {
    const simulated = simulateFactorySync(
      factory,
      player,
      passiveProfile,
      this.now(),
      regionalDominationBonus,
    );

    if (simulated.changed) {
      const updated = await this.repository.applyFactoryState(player.id, {
        componentQuantities: simulated.snapshot.requirements.map((requirement) => ({
          componentId: requirement.componentId,
          quantity: requirement.availableQuantity,
        })),
        factoryId: factory.id,
        lastCycleAt: simulated.snapshot.lastCycleAt,
        lastMaintenanceAt: simulated.snapshot.lastMaintenanceAt,
        moneySpent: simulated.maintenanceStatus.moneySpentOnSync,
        storedOutput: simulated.snapshot.storedOutput,
        suspended: simulated.snapshot.suspended,
      });

      if (!updated) {
        throw new FactoryError('not_found', 'Fabrica nao encontrada para sincronizacao.');
      }
    }

    return simulated;
  }
}

function serializeFactorySummary(
  factory: FactorySnapshotRecord,
  player: FactoryPlayerRecord,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  sync: Pick<FactorySyncResult, 'blockedReason' | 'maintenanceStatus'>,
  regionalDominationBonus: RegionalDominationBonus,
): DrugFactorySummary {
  return {
    baseProduction: factory.baseProduction,
    blockedReason: sync.blockedReason,
    createdAt: factory.createdAt.toISOString(),
    cycleMinutes: factory.cycleMinutes,
    dailyMaintenanceCost: roundCurrency(
      factory.dailyMaintenanceCost * regionalDominationBonus.maintenanceMultiplier,
    ),
    drugId: factory.drugId,
    drugName: factory.drugName,
    id: factory.id,
    maintenanceStatus: sync.maintenanceStatus,
    multipliers: {
      impulse: factory.impulseMultiplier,
      intelligence: Number.parseFloat((1 + player.inteligencia / 1000).toFixed(3)),
      universityProduction: passiveProfile.factory.productionMultiplier,
      vocation: player.vocation === VocationType.Gerente ? DRUG_FACTORY_MANAGER_VOCATION_MULTIPLIER : 1,
    },
    outputPerCycle: resolveFactoryOutputPerCycle(
      factory,
      player,
      passiveProfile,
      regionalDominationBonus,
    ),
    regionId: factory.regionId,
    requirements: factory.requirements,
    storedOutput: factory.storedOutput,
  };
}

function serializeRecipeSummary(recipe: FactoryRecipeRecord): DrugFactoryRecipeSummary {
  return {
    baseProduction: recipe.baseProduction,
    cycleMinutes: recipe.cycleMinutes,
    dailyMaintenanceCost: recipe.dailyMaintenanceCost,
    drugId: recipe.drugId,
    drugName: recipe.drugName,
    levelRequired: recipe.levelRequired,
    requirements: recipe.requirements,
  };
}

function simulateFactorySync(
  factory: FactorySnapshotRecord,
  player: FactoryPlayerRecord,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  now: Date,
  regionalDominationBonus: RegionalDominationBonus,
): FactorySyncResult {
  const maintenance = resolveFactoryMaintenance(
    factory,
    player.money,
    now,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );
  const cycleMs = Math.max(1, factory.cycleMinutes || DRUG_FACTORY_CYCLE_FALLBACK_MINUTES) * 60 * 1000;
  const cycleWindowMs = Math.max(0, maintenance.productionCutoff.getTime() - factory.lastCycleAt.getTime());
  const elapsedCycles = Math.floor(cycleWindowMs / cycleMs);
  const maxCyclesByComponents = resolveFactoryCyclesByComponents(factory.requirements);
  const producedCycles = Math.min(elapsedCycles, maxCyclesByComponents);
  const nextRequirements = factory.requirements.map((requirement) => ({
    ...requirement,
    availableQuantity: requirement.availableQuantity - requirement.quantityPerCycle * producedCycles,
  }));
  const nextLastCycleAt = new Date(factory.lastCycleAt.getTime() + elapsedCycles * cycleMs);
  const nextStoredOutput =
    factory.storedOutput +
    resolveFactoryOutputPerCycle(factory, player, passiveProfile, regionalDominationBonus) *
      producedCycles;
  const blockedReason =
    maintenance.overdueDays > 0
      ? 'maintenance'
      : elapsedCycles > 0 && producedCycles < elapsedCycles
        ? 'components'
        : null;
  const nextSnapshot: FactorySnapshotRecord = {
    ...factory,
    lastCycleAt: nextLastCycleAt,
    lastMaintenanceAt: maintenance.lastMaintenanceAt,
    requirements: nextRequirements,
    storedOutput: nextStoredOutput,
    suspended: maintenance.overdueDays > 0,
  };

  return {
    blockedReason,
    changed:
      producedCycles > 0 ||
      maintenance.moneySpentOnSync > 0 ||
      maintenance.overdueDays > 0 !== factory.suspended ||
      nextLastCycleAt.getTime() !== factory.lastCycleAt.getTime() ||
      nextSnapshot.requirements.some(
        (requirement, index) => requirement.availableQuantity !== factory.requirements[index]?.availableQuantity,
      ),
    maintenanceStatus: {
      blocked: maintenance.overdueDays > 0,
      moneySpentOnSync: maintenance.moneySpentOnSync,
      overdueDays: maintenance.overdueDays,
    },
    nextMoney: roundCurrency(player.money - maintenance.moneySpentOnSync),
    snapshot: nextSnapshot,
  };
}

function resolveFactoryCyclesByComponents(requirements: FactoryRequirementRecord[]): number {
  if (requirements.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return requirements.reduce<number>((current, requirement) => {
    if (requirement.quantityPerCycle <= 0) {
      return current;
    }

    return Math.min(current, Math.floor(requirement.availableQuantity / requirement.quantityPerCycle));
  }, Number.MAX_SAFE_INTEGER);
}

function resolveFactoryMaintenance(
  factory: FactorySnapshotRecord,
  playerMoney: number,
  now: Date,
  maintenanceMultiplier = 1,
): {
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
  productionCutoff: Date;
} {
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - factory.lastMaintenanceAt.getTime()) / DRUG_FACTORY_MAINTENANCE_INTERVAL_MS,
  );

  const dailyMaintenanceCost = roundCurrency(factory.dailyMaintenanceCost * maintenanceMultiplier);

  if (dueDays <= 0 || dailyMaintenanceCost <= 0) {
    return {
      lastMaintenanceAt: factory.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
      productionCutoff: now,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(playerMoney / dailyMaintenanceCost));
  const moneySpentOnSync = roundCurrency(payableDays * dailyMaintenanceCost);
  const lastMaintenanceAt = new Date(
    factory.lastMaintenanceAt.getTime() + payableDays * DRUG_FACTORY_MAINTENANCE_INTERVAL_MS,
  );
  const overdueDays = dueDays - payableDays;

  return {
    lastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
    productionCutoff: overdueDays > 0 ? lastMaintenanceAt : now,
  };
}

function resolveFactoryOutputPerCycle(
  factory: Pick<FactorySnapshotRecord, 'baseProduction' | 'impulseMultiplier'>,
  player: Pick<FactoryPlayerRecord, 'inteligencia' | 'vocation'>,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
): number {
  const intelligenceMultiplier = 1 + player.inteligencia / 1000;
  const vocationMultiplier =
    player.vocation === VocationType.Gerente ? DRUG_FACTORY_MANAGER_VOCATION_MULTIPLIER : 1;

  return Math.max(
    1,
    Math.floor(
      factory.baseProduction *
        intelligenceMultiplier *
        factory.impulseMultiplier *
        vocationMultiplier *
        passiveProfile.factory.productionMultiplier *
        regionalDominationBonus.factoryProductionMultiplier,
    ),
  );
}

function roundCurrency(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}
