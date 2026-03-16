import {
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  RAVE_DEFAULT_PRICE_MULTIPLIER,
  RAVE_MAX_PRICE_MULTIPLIER,
  RAVE_MIN_PRICE_MULTIPLIER,
  RAVE_OPERATION_CYCLE_MINUTES,
  type RaveCollectResponse,
  type RaveListResponse,
  type RavePricingInput,
  type RavePricingResponse,
  type RaveStockInput,
  type RaveStockResponse,
  type RaveSummary,
  type PropertyDefinitionSummary,
  type RegionId,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  drugs,
  factionMembers,
  factions,
  favelas,
  gameEvents,
  playerInventory,
  players,
  properties,
  raveDrugLineups,
  raveOperations,
  regions,
  soldiers,
  transactions,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import {
  resolveEconomyPropertyDefinition,
  resolvePropertyEventProfile,
  resolveRegionalEventMultiplier,
  type PropertyEventProfile,
} from './economy-config.js';
import { calculateFactionPointsDelta, insertFactionBankLedgerEntry } from './faction.js';
import { GameConfigService } from './game-config.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import {
  buildPropertySabotageStatusSummary,
  resolvePropertyDailyUpkeep,
  roundCurrency,
} from './property.js';
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

type SupportedEventType =
  | 'ano_novo_copa'
  | 'baile_cidade'
  | 'blitz_pm'
  | 'carnaval'
  | 'faca_na_caveira'
  | 'operacao_policial';

interface RavePlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface RaveLineupRecord {
  baseUnitPrice: number;
  code: string;
  drugId: string;
  drugName: string;
  priceMultiplier: number;
  productionLevel: number;
  quantity: number;
}

interface RaveSoldierRosterRecord {
  count: number;
  dailyCost: number;
}

interface RaveEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface RaveSnapshotRecord {
  cashBalance: number;
  createdAt: Date;
  densityIndex: number;
  factionCommissionTotal: number;
  favelaId: string | null;
  favelaPopulation: number | null;
  grossRevenueTotal: number;
  id: string;
  lastCollectedAt: Date | null;
  lastMaintenanceAt: Date;
  lastSaleAt: Date;
  level: number;
  lineup: RaveLineupRecord[];
  operationCostMultiplier: number;
  policePressure: number;
  regionId: RegionId;
  sabotageRecoveryReadyAt: Date | null;
  sabotageResolvedAt: Date | null;
  sabotageState: 'normal' | 'damaged' | 'destroyed';
  soldierRoster: RaveSoldierRosterRecord[];
  suspended: boolean;
  wealthIndex: number;
}

interface RaveMaintenanceStatus {
  blocked: boolean;
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
}

interface RaveStateUpdateInput {
  cashBalance: number;
  factionCommissionDelta: number;
  factionCommissionTotal: number;
  factionId: string | null;
  grossRevenueDelta: number;
  grossRevenueTotal: number;
  lastSaleAt: Date;
  lineupStates: Array<{
    drugId: string;
    priceMultiplier: number;
    quantity: number;
  }>;
  playerMoneySpentOnMaintenance: number;
  propertyId: string;
  propertyLastMaintenanceAt: Date;
  propertySuspended: boolean;
}

interface RaveStockTransferRecord {
  drugId: string;
  drugName: string;
  transferredQuantity: number;
}

interface RaveCollectRecord {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

interface RaveSyncResult {
  changed: boolean;
  maintenanceStatus: RaveMaintenanceStatus;
  nextPlayerMoney: number;
  snapshot: RaveSnapshotRecord;
}

export interface RaveRepository {
  applyRaveState(playerId: string, input: RaveStateUpdateInput): Promise<boolean>;
  collectCash(playerId: string, propertyId: string): Promise<RaveCollectRecord | null>;
  configurePricing(
    playerId: string,
    propertyId: string,
    drugId: string,
    priceMultiplier: number,
  ): Promise<boolean>;
  getPlayer(playerId: string): Promise<RavePlayerRecord | null>;
  getRave(playerId: string, propertyId: string): Promise<RaveSnapshotRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<RaveEventRecord[]>;
  listRaves(playerId: string): Promise<RaveSnapshotRecord[]>;
  stockDrug(
    playerId: string,
    propertyId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<RaveStockTransferRecord | null>;
}

export interface RaveServiceOptions {
  gameConfigService?: GameConfigService;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  repository?: RaveRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface RaveServiceContract {
  close?(): Promise<void>;
  collectCash(playerId: string, propertyId: string): Promise<RaveCollectResponse>;
  configurePricing(
    playerId: string,
    propertyId: string,
    input: RavePricingInput,
  ): Promise<RavePricingResponse>;
  listRaves(playerId: string): Promise<RaveListResponse>;
  stockDrug(playerId: string, propertyId: string, input: RaveStockInput): Promise<RaveStockResponse>;
}

type RaveErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'invalid_lineup'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class RaveError extends Error {
  constructor(
    public readonly code: RaveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RaveError';
  }
}

export class DatabaseRaveRepository implements RaveRepository {
  async applyRaveState(playerId: string, input: RaveStateUpdateInput): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'rave'),
          ),
        )
        .limit(1);

      if (!property) {
        return false;
      }

      if (input.playerMoneySpentOnMaintenance > 0) {
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

        const nextMoney = roundCurrency(
          Number.parseFloat(String(player.money)) - input.playerMoneySpentOnMaintenance,
        );

        await tx
          .update(players)
          .set({
            money: nextMoney.toFixed(2),
          })
          .where(eq(players.id, playerId));
      }

      if (input.factionCommissionDelta > 0 && input.factionId) {
        const [faction] = await tx
          .select({
            bankMoney: factions.bankMoney,
          })
          .from(factions)
          .where(eq(factions.id, input.factionId))
          .limit(1);

        if (faction) {
          const nextBankMoney = roundCurrency(
            Number.parseFloat(String(faction.bankMoney)) + input.factionCommissionDelta,
          );
          const pointsDelta = calculateFactionPointsDelta(input.factionCommissionDelta);

          await tx
            .update(factions)
            .set({
              bankMoney: nextBankMoney.toFixed(2),
              points: sql`${factions.points} + ${pointsDelta}`,
            })
            .where(eq(factions.id, input.factionId));

          await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
            balanceAfter: nextBankMoney,
            commissionAmount: input.factionCommissionDelta,
            createdAt: input.lastSaleAt,
            description: 'Comissao automatica recebida de uma rave ou baile de membro.',
            entryType: 'business_commission',
            factionId: input.factionId,
            grossAmount: input.grossRevenueDelta,
            netAmount: roundCurrency(input.grossRevenueDelta - input.factionCommissionDelta),
            originType: 'rave',
            playerId,
            propertyId: input.propertyId,
          });
        }
      }

      await tx
        .update(properties)
        .set({
          lastMaintenanceAt: input.propertyLastMaintenanceAt,
          suspended: input.propertySuspended,
        })
        .where(eq(properties.id, input.propertyId));

      const [existingOperation] = await tx
        .select({
          propertyId: raveOperations.propertyId,
        })
        .from(raveOperations)
        .where(eq(raveOperations.propertyId, input.propertyId))
        .limit(1);

      if (existingOperation) {
        await tx
          .update(raveOperations)
          .set({
            cashBalance: input.cashBalance.toFixed(2),
            factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
            grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
            lastSaleAt: input.lastSaleAt,
          })
          .where(eq(raveOperations.propertyId, input.propertyId));
      } else {
        await tx.insert(raveOperations).values({
          cashBalance: input.cashBalance.toFixed(2),
          factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
          grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
          lastSaleAt: input.lastSaleAt,
          propertyId: input.propertyId,
        });
      }

      for (const lineup of input.lineupStates) {
        const [existingLineup] = await tx
          .select({
            propertyId: raveDrugLineups.propertyId,
          })
          .from(raveDrugLineups)
          .where(
            and(
              eq(raveDrugLineups.propertyId, input.propertyId),
              eq(raveDrugLineups.drugId, lineup.drugId),
            ),
          )
          .limit(1);

        if (lineup.quantity <= 0) {
          if (existingLineup) {
            await tx
              .delete(raveDrugLineups)
              .where(
                and(
                  eq(raveDrugLineups.propertyId, input.propertyId),
                  eq(raveDrugLineups.drugId, lineup.drugId),
                ),
              );
          }

          continue;
        }

        if (existingLineup) {
          await tx
            .update(raveDrugLineups)
            .set({
              priceMultiplier: lineup.priceMultiplier.toFixed(2),
              quantity: lineup.quantity,
            })
            .where(
              and(
                eq(raveDrugLineups.propertyId, input.propertyId),
                eq(raveDrugLineups.drugId, lineup.drugId),
              ),
            );
        } else {
          await tx.insert(raveDrugLineups).values({
            drugId: lineup.drugId,
            priceMultiplier: lineup.priceMultiplier.toFixed(2),
            propertyId: input.propertyId,
            quantity: lineup.quantity,
          });
        }
      }

      return true;
    });
  }

  async collectCash(playerId: string, propertyId: string): Promise<RaveCollectRecord | null> {
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select({
          cashBalance: raveOperations.cashBalance,
        })
        .from(raveOperations)
        .innerJoin(properties, eq(properties.id, raveOperations.propertyId))
        .where(
          and(
            eq(raveOperations.propertyId, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'rave'),
          ),
        )
        .limit(1);
      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!operation || !player) {
        return null;
      }

      const collectedAmount = roundCurrency(Number.parseFloat(String(operation.cashBalance)));

      if (collectedAmount <= 0) {
        return null;
      }

      const playerMoneyAfterCollect = roundCurrency(Number.parseFloat(String(player.money)) + collectedAmount);

      await tx
        .update(players)
        .set({
          money: playerMoneyAfterCollect.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(raveOperations)
        .set({
          cashBalance: '0.00',
          lastCollectedAt: new Date(),
        })
        .where(eq(raveOperations.propertyId, propertyId));

      await tx.insert(transactions).values({
        amount: collectedAmount.toFixed(2),
        description: `Coleta de caixa da rave ${propertyId}`,
        playerId,
        type: 'rave_collect',
      });

      return {
        collectedAmount,
        playerMoneyAfterCollect,
      };
    });
  }

  async configurePricing(
    playerId: string,
    propertyId: string,
    drugId: string,
    priceMultiplier: number,
  ): Promise<boolean> {
    const [updated] = await db
      .update(raveDrugLineups)
      .set({
        priceMultiplier: priceMultiplier.toFixed(2),
      })
      .from(properties)
      .where(
        and(
          eq(raveDrugLineups.propertyId, propertyId),
          eq(raveDrugLineups.drugId, drugId),
          eq(properties.id, raveDrugLineups.propertyId),
          eq(properties.playerId, playerId),
          eq(properties.type, 'rave'),
        ),
      )
      .returning({
        propertyId: raveDrugLineups.propertyId,
      });

    return Boolean(updated);
  }

  async getPlayer(playerId: string): Promise<RavePlayerRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
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
      money: roundCurrency(Number.parseFloat(String(player.money))),
    };
  }

  async getRave(playerId: string, propertyId: string): Promise<RaveSnapshotRecord | null> {
    const raves = await this.listRaves(playerId);
    return raves.find((rave) => rave.id === propertyId) ?? null;
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

  async listActiveEvents(regionId: RegionId, now: Date): Promise<RaveEventRecord[]> {
    const rows = await db
      .select({
        eventType: gameEvents.eventType,
        regionId: gameEvents.regionId,
      })
      .from(gameEvents)
      .where(
        and(
          lte(gameEvents.startedAt, now),
          gte(gameEvents.endsAt, now),
          or(eq(gameEvents.regionId, regionId), isNull(gameEvents.regionId)),
        ),
      );

    return rows.filter(
      (row): row is RaveEventRecord =>
        row.eventType === 'ano_novo_copa' ||
        row.eventType === 'baile_cidade' ||
        row.eventType === 'blitz_pm' ||
        row.eventType === 'carnaval' ||
        row.eventType === 'operacao_policial' ||
        row.eventType === 'faca_na_caveira',
    );
  }

  async listRaves(playerId: string): Promise<RaveSnapshotRecord[]> {
    const raveRows = await db
      .select({
        cashBalance: raveOperations.cashBalance,
        createdAt: properties.createdAt,
        densityIndex: regions.densityIndex,
        factionCommissionTotal: raveOperations.factionCommissionTotal,
        favelaId: properties.favelaId,
        favelaPopulation: favelas.population,
        grossRevenueTotal: raveOperations.grossRevenueTotal,
        id: properties.id,
        lastCollectedAt: raveOperations.lastCollectedAt,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        lastSaleAt: raveOperations.lastSaleAt,
        level: properties.level,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        regionId: properties.regionId,
        sabotageRecoveryReadyAt: properties.sabotageRecoveryReadyAt,
        sabotageResolvedAt: properties.sabotageResolvedAt,
        sabotageState: properties.sabotageState,
        suspended: properties.suspended,
        wealthIndex: regions.wealthIndex,
      })
      .from(properties)
      .innerJoin(regions, eq(regions.id, properties.regionId))
      .leftJoin(favelas, eq(favelas.id, properties.favelaId))
      .leftJoin(raveOperations, eq(raveOperations.propertyId, properties.id))
      .where(
        and(
          eq(properties.playerId, playerId),
          eq(properties.type, 'rave'),
        ),
      );

    if (raveRows.length === 0) {
      return [];
    }

    const propertyIds = raveRows.map((row) => row.id);
    const lineupRows = await db
      .select({
        baseUnitPrice: drugs.price,
        code: drugs.code,
        drugId: drugs.id,
        drugName: drugs.name,
        priceMultiplier: raveDrugLineups.priceMultiplier,
        productionLevel: drugs.productionLevel,
        propertyId: raveDrugLineups.propertyId,
        quantity: raveDrugLineups.quantity,
      })
      .from(raveDrugLineups)
      .innerJoin(drugs, eq(drugs.id, raveDrugLineups.drugId))
      .where(inArray(raveDrugLineups.propertyId, propertyIds));
    const soldierRows = await db
      .select({
        dailyCost: soldiers.dailyCost,
        propertyId: soldiers.propertyId,
      })
      .from(soldiers)
      .where(inArray(soldiers.propertyId, propertyIds));
    const lineupByPropertyId = new Map<string, RaveLineupRecord[]>();
    const soldiersByPropertyId = new Map<string, RaveSoldierRosterRecord>();

    for (const lineupRow of lineupRows) {
      const current = lineupByPropertyId.get(lineupRow.propertyId) ?? [];
      current.push({
        baseUnitPrice: roundCurrency(Number.parseFloat(String(lineupRow.baseUnitPrice))),
        code: lineupRow.code,
        drugId: lineupRow.drugId,
        drugName: lineupRow.drugName,
        priceMultiplier: roundCurrency(Number.parseFloat(String(lineupRow.priceMultiplier))),
        productionLevel: lineupRow.productionLevel,
        quantity: lineupRow.quantity,
      });
      lineupByPropertyId.set(lineupRow.propertyId, current);
    }

    for (const soldierRow of soldierRows) {
      const current = soldiersByPropertyId.get(soldierRow.propertyId) ?? {
        count: 0,
        dailyCost: 0,
      };
      current.count += 1;
      current.dailyCost = roundCurrency(
        current.dailyCost + Number.parseFloat(String(soldierRow.dailyCost)),
      );
      soldiersByPropertyId.set(soldierRow.propertyId, current);
    }

    return raveRows.map((row) => ({
      cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance ?? '0'))),
      createdAt: row.createdAt,
      densityIndex: row.densityIndex,
      factionCommissionTotal: roundCurrency(Number.parseFloat(String(row.factionCommissionTotal ?? '0'))),
      favelaId: row.favelaId,
      favelaPopulation: row.favelaPopulation,
      grossRevenueTotal: roundCurrency(Number.parseFloat(String(row.grossRevenueTotal ?? '0'))),
      id: row.id,
      lastCollectedAt: row.lastCollectedAt,
      lastMaintenanceAt: row.lastMaintenanceAt,
      lastSaleAt: row.lastSaleAt ?? row.createdAt,
      level: row.level,
      lineup: [...(lineupByPropertyId.get(row.id) ?? [])].sort((left, right) =>
        left.drugName.localeCompare(right.drugName, 'pt-BR'),
      ),
      operationCostMultiplier: roundCurrency(Number.parseFloat(String(row.operationCostMultiplier))),
      policePressure: row.policePressure,
      regionId: row.regionId as RegionId,
      sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
      sabotageResolvedAt: row.sabotageResolvedAt,
      sabotageState: row.sabotageState,
      soldierRoster: soldiersByPropertyId.get(row.id)
        ? [soldiersByPropertyId.get(row.id) as RaveSoldierRosterRecord]
        : [],
      suspended: row.suspended,
      wealthIndex: row.wealthIndex,
    }));
  }

  async stockDrug(
    playerId: string,
    propertyId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<RaveStockTransferRecord | null> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          createdAt: properties.createdAt,
          id: properties.id,
        })
        .from(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'rave'),
          ),
        )
        .limit(1);

      if (!property) {
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

      if (!inventoryItem || inventoryItem.itemType !== 'drug' || !inventoryItem.itemId) {
        return null;
      }

      if (inventoryItem.quantity < quantity) {
        return null;
      }

      const [drug] = await tx
        .select({
          id: drugs.id,
          name: drugs.name,
        })
        .from(drugs)
        .where(eq(drugs.id, inventoryItem.itemId))
        .limit(1);

      if (!drug) {
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

      const [existingLineup] = await tx
        .select({
          priceMultiplier: raveDrugLineups.priceMultiplier,
          quantity: raveDrugLineups.quantity,
        })
        .from(raveDrugLineups)
        .where(
          and(
            eq(raveDrugLineups.propertyId, propertyId),
            eq(raveDrugLineups.drugId, inventoryItem.itemId),
          ),
        )
        .limit(1);

      if (existingLineup) {
        await tx
          .update(raveDrugLineups)
          .set({
            quantity: existingLineup.quantity + quantity,
          })
          .where(
            and(
              eq(raveDrugLineups.propertyId, propertyId),
              eq(raveDrugLineups.drugId, inventoryItem.itemId),
            ),
          );
      } else {
        await tx.insert(raveDrugLineups).values({
          drugId: inventoryItem.itemId,
          priceMultiplier: RAVE_DEFAULT_PRICE_MULTIPLIER.toFixed(2),
          propertyId,
          quantity,
        });
      }

      const [existingOperation] = await tx
        .select({
          propertyId: raveOperations.propertyId,
        })
        .from(raveOperations)
        .where(eq(raveOperations.propertyId, propertyId))
        .limit(1);

      if (!existingOperation) {
        await tx.insert(raveOperations).values({
          lastSaleAt: property.createdAt,
          propertyId,
        });
      }

      return {
        drugId: drug.id,
        drugName: drug.name,
        transferredQuantity: quantity,
      };
    });
  }
}

export class RaveService implements RaveServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: RaveRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: RaveServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseRaveRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async collectCash(playerId: string, propertyId: string): Promise<RaveCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncRave(player, propertyId, passiveProfile);

    if (synced.snapshot.cashBalance <= 0) {
      throw new RaveError('conflict', 'Esta rave nao possui caixa disponivel para coleta.');
    }

    const collected = await this.repository.collectCash(playerId, propertyId);

    if (!collected) {
      throw new RaveError('not_found', 'Rave nao encontrada para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const rave = await this.listSingleRave(playerId, propertyId);

    return {
      collectedAmount: collected.collectedAmount,
      playerMoneyAfterCollect: collected.playerMoneyAfterCollect,
      rave,
    };
  }

  async configurePricing(
    playerId: string,
    propertyId: string,
    input: RavePricingInput,
  ): Promise<RavePricingResponse> {
    if (!input.drugId || input.drugId.trim().length === 0) {
      throw new RaveError('validation', 'Selecione uma droga valida para configurar a tabela.');
    }

    if (typeof input.priceMultiplier !== 'number' || Number.isNaN(input.priceMultiplier)) {
      throw new RaveError('validation', 'O multiplicador de preco precisa ser numerico.');
    }

    if (input.priceMultiplier < RAVE_MIN_PRICE_MULTIPLIER || input.priceMultiplier > RAVE_MAX_PRICE_MULTIPLIER) {
      throw new RaveError(
        'validation',
        `O multiplicador de preco deve ficar entre ${RAVE_MIN_PRICE_MULTIPLIER} e ${RAVE_MAX_PRICE_MULTIPLIER}.`,
      );
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    await this.syncRave(player, propertyId, passiveProfile);
    const updated = await this.repository.configurePricing(
      playerId,
      propertyId,
      input.drugId,
      roundCurrency(input.priceMultiplier),
    );

    if (!updated) {
      throw new RaveError('invalid_lineup', 'Droga nao encontrada no lineup desta rave.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const rave = await this.listSingleRave(playerId, propertyId);

    return {
      configuredDrugId: input.drugId,
      priceMultiplier: roundCurrency(input.priceMultiplier),
      rave,
    };
  }

  async listRaves(playerId: string): Promise<RaveListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [configCatalog, passiveProfile, raves, favelasList] = await Promise.all([
      this.gameConfigService.getResolvedCatalog(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listRaves(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    let workingPlayer = player;
    let changed = false;
    const summaries: RaveSummary[] = [];
    const eventCache = new Map<RegionId, RaveEventRecord[]>();

    for (const rave of [...raves].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      let events = eventCache.get(rave.regionId);

      if (!events) {
        events = await this.repository.listActiveEvents(rave.regionId, this.now());
        eventCache.set(rave.regionId, events);
      }

      const regionalDominationBonus =
        regionalDominationByRegion.get(rave.regionId) ??
        buildInactiveRegionalDominationBonus(rave.regionId);
      const synced = await this.syncRaveRecord(
        workingPlayer,
        rave,
        events,
        passiveProfile,
        regionalDominationBonus,
        configCatalog,
      );

      changed ||= synced.changed;
      workingPlayer = {
        ...workingPlayer,
        money: synced.nextPlayerMoney,
      };
      summaries.push(
        serializeRaveSummary(
          synced.snapshot,
          workingPlayer.factionId,
          synced.maintenanceStatus,
          events,
          passiveProfile,
          regionalDominationBonus,
          configCatalog,
        ),
      );
    }

    if (changed) {
      await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    }

    return {
      raves: summaries,
    };
  }

  async stockDrug(
    playerId: string,
    propertyId: string,
    input: RaveStockInput,
  ): Promise<RaveStockResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new RaveError('validation', 'Quantidade para estocar deve ser um inteiro maior ou igual a 1.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    await this.syncRave(player, propertyId, passiveProfile);
    const transferred = await this.repository.stockDrug(
      playerId,
      propertyId,
      input.inventoryItemId,
      input.quantity,
    );

    if (!transferred) {
      throw new RaveError(
        'invalid_lineup',
        'Droga invalida, ausente no inventario ou incompatível com esta rave.',
      );
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const rave = await this.listSingleRave(playerId, propertyId);

    return {
      drug: {
        id: transferred.drugId,
        name: transferred.drugName,
      },
      rave,
      transferredQuantity: transferred.transferredQuantity,
    };
  }

  private async listSingleRave(playerId: string, propertyId: string): Promise<RaveSummary> {
    const summary = await this.listRaves(playerId);
    const rave = summary.raves.find((entry) => entry.id === propertyId);

    if (!rave) {
      throw new RaveError('not_found', 'Rave nao encontrada apos a atualizacao.');
    }

    return rave;
  }

  private async requireReadyPlayer(playerId: string): Promise<RavePlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new RaveError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new RaveError('character_not_ready', 'Crie seu personagem antes de gerenciar raves.');
    }

    return player;
  }

  private async syncRave(
    player: RavePlayerRecord,
    propertyId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<RaveSyncResult> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const rave = await this.repository.getRave(player.id, propertyId);

    if (!rave) {
      throw new RaveError('not_found', 'Rave nao encontrada.');
    }

    const events = await this.repository.listActiveEvents(rave.regionId, this.now());
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(rave.regionId) ??
      buildInactiveRegionalDominationBonus(rave.regionId);
    return this.syncRaveRecord(
      player,
      rave,
      events,
      passiveProfile,
      regionalDominationBonus,
      configCatalog,
    );
  }

  private async syncRaveRecord(
    player: RavePlayerRecord,
    rave: RaveSnapshotRecord,
    events: RaveEventRecord[],
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
    configCatalog: ResolvedGameConfigCatalog,
  ): Promise<RaveSyncResult> {
    const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'rave');
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'rave');
    const maintenanceStatus = syncRaveMaintenance(
      rave,
      player.money,
      this.now(),
      propertyDefinition,
      passiveProfile.business.propertyMaintenanceMultiplier *
        regionalDominationBonus.maintenanceMultiplier,
    );
    const propertyAfterMaintenance: RaveSnapshotRecord = {
      ...rave,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt,
      suspended: maintenanceStatus.blocked,
    };
    const sabotageStatus = buildPropertySabotageStatusSummary({
      now: this.now(),
      sabotageRecoveryReadyAt: propertyAfterMaintenance.sabotageRecoveryReadyAt,
      sabotageResolvedAt: propertyAfterMaintenance.sabotageResolvedAt,
      sabotageState: propertyAfterMaintenance.sabotageState,
      type: 'rave',
    });
    const cycleMs = RAVE_OPERATION_CYCLE_MINUTES * 60 * 1000;
    const elapsedCycles = Math.floor(
      Math.max(0, this.now().getTime() - propertyAfterMaintenance.lastSaleAt.getTime()) / cycleMs,
    );
    const processedUntil = new Date(propertyAfterMaintenance.lastSaleAt.getTime() + elapsedCycles * cycleMs);
    let cashBalance = propertyAfterMaintenance.cashBalance;
    let grossRevenueDelta = 0;
    let grossRevenueTotal = propertyAfterMaintenance.grossRevenueTotal;
    let factionCommissionTotal = propertyAfterMaintenance.factionCommissionTotal;
    let factionCommissionDelta = 0;
    const effectiveFactionCommissionRate = resolveEffectiveFactionCommissionRate(
      player.factionId,
      propertyDefinition,
    );
    const nextLineup = propertyAfterMaintenance.lineup.map((entry) => ({ ...entry }));

    if (elapsedCycles > 0 && !propertyAfterMaintenance.suspended && !sabotageStatus.blocked) {
      for (const lineupEntry of nextLineup) {
        const visitorsPerCycle = buildRaveVisitorsPerCycle(
          propertyAfterMaintenance,
          lineupEntry,
          events,
          eventProfile,
        );
        const quantitySold = Math.min(lineupEntry.quantity, visitorsPerCycle * elapsedCycles);

        if (quantitySold <= 0) {
          continue;
        }

        const configuredUnitPrice = buildConfiguredUnitPrice(
          propertyAfterMaintenance,
          lineupEntry,
          events,
          eventProfile,
        );
        const grossRevenue = roundCurrency(
          configuredUnitPrice *
            quantitySold *
            passiveProfile.business.passiveRevenueMultiplier *
            regionalDominationBonus.revenueMultiplier *
            sabotageStatus.operationalMultiplier,
        );
        const commissionAmount = roundCurrency(grossRevenue * effectiveFactionCommissionRate);
        const netRevenue = roundCurrency(grossRevenue - commissionAmount);

        lineupEntry.quantity -= quantitySold;
        cashBalance = roundCurrency(cashBalance + netRevenue);
        grossRevenueDelta = roundCurrency(grossRevenueDelta + grossRevenue);
        grossRevenueTotal = roundCurrency(grossRevenueTotal + grossRevenue);
        factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
        factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
      }
    }

    const nextSnapshot: RaveSnapshotRecord = {
      ...propertyAfterMaintenance,
      cashBalance,
      factionCommissionTotal,
      grossRevenueTotal,
      lastSaleAt: elapsedCycles > 0 ? processedUntil : propertyAfterMaintenance.lastSaleAt,
      lineup: nextLineup.filter((entry) => entry.quantity > 0),
    };
    const changed =
      maintenanceStatus.moneySpentOnSync > 0 ||
      maintenanceStatus.overdueDays > 0 !== rave.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== rave.lastMaintenanceAt.getTime() ||
      nextSnapshot.lastSaleAt.getTime() !== rave.lastSaleAt.getTime() ||
      nextSnapshot.cashBalance !== rave.cashBalance ||
      nextSnapshot.grossRevenueTotal !== rave.grossRevenueTotal ||
      nextSnapshot.factionCommissionTotal !== rave.factionCommissionTotal ||
      haveLineupsChanged(rave.lineup, nextSnapshot.lineup);

    if (changed) {
      const applied = await this.repository.applyRaveState(player.id, {
        cashBalance: nextSnapshot.cashBalance,
        factionCommissionDelta,
        factionCommissionTotal: nextSnapshot.factionCommissionTotal,
        factionId: player.factionId,
        grossRevenueDelta,
        grossRevenueTotal: nextSnapshot.grossRevenueTotal,
        lastSaleAt: nextSnapshot.lastSaleAt,
        lineupStates: nextSnapshot.lineup.map((entry) => ({
          drugId: entry.drugId,
          priceMultiplier: entry.priceMultiplier,
          quantity: entry.quantity,
        })),
        playerMoneySpentOnMaintenance: maintenanceStatus.moneySpentOnSync,
        propertyId: nextSnapshot.id,
        propertyLastMaintenanceAt: nextSnapshot.lastMaintenanceAt,
        propertySuspended: nextSnapshot.suspended,
      });

      if (!applied) {
        throw new RaveError('not_found', 'Falha ao sincronizar a operacao da rave.');
      }
    }

    return {
      changed,
      maintenanceStatus,
      nextPlayerMoney: roundCurrency(player.money - maintenanceStatus.moneySpentOnSync),
      snapshot: nextSnapshot,
    };
  }
}

function buildConfiguredUnitPrice(
  rave: RaveSnapshotRecord,
  lineupEntry: RaveLineupRecord,
  events: RaveEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  return roundCurrency(
    lineupEntry.baseUnitPrice *
      lineupEntry.priceMultiplier *
      buildRaveLocationMultiplier(rave) *
      resolveRavePriceEventMultiplier(events, rave.regionId, eventProfile),
  );
}

function buildRaveLocationMultiplier(rave: RaveSnapshotRecord): number {
  const rawValue =
    0.95 +
    rave.wealthIndex / 150 +
    rave.densityIndex / 320 +
    (rave.favelaPopulation ?? 0) / 320_000 +
    rave.level * 0.05 -
    rave.policePressure / 720;

  return clampMultiplier(rawValue, 1, 2.35);
}

function buildRaveVisitorsPerCycle(
  rave: RaveSnapshotRecord,
  lineupEntry: RaveLineupRecord,
  events: RaveEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const baseVisitors =
    6 +
    rave.level * 4 +
    Math.floor(rave.wealthIndex / 7) +
    Math.floor(rave.densityIndex / 16) +
    Math.floor((rave.favelaPopulation ?? 0) / 22_000);
  const qualityMultiplier = clampMultiplier(0.92 + lineupEntry.productionLevel * 0.12, 1, 1.5);
  const priceSensitivity = clampMultiplier(
    1 - (lineupEntry.priceMultiplier - RAVE_DEFAULT_PRICE_MULTIPLIER) * 0.55,
    0.6,
    1.25,
  );
  const eventMultiplier = resolveRaveVisitorEventMultiplier(events, rave.regionId, eventProfile);

  return Math.max(1, Math.floor(baseVisitors * qualityMultiplier * priceSensitivity * eventMultiplier));
}

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function haveLineupsChanged(previous: RaveLineupRecord[], next: RaveLineupRecord[]): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  const nextMap = new Map(next.map((entry) => [entry.drugId, entry]));

  return previous.some((entry) => {
    const nextEntry = nextMap.get(entry.drugId);
    return (
      !nextEntry ||
      nextEntry.quantity !== entry.quantity ||
      nextEntry.priceMultiplier !== entry.priceMultiplier
    );
  });
}

function resolveEffectiveFactionCommissionRate(
  factionId: string | null,
  propertyDefinition: PropertyDefinitionSummary,
): number {
  if (!factionId) {
    return 0;
  }

  return propertyDefinition.factionCommissionRate;
}

function resolveRavePriceEventMultiplier(
  events: RaveEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  return resolveRegionalEventMultiplier(events, regionId, eventProfile.priceMultipliers);
}

function resolveRaveVisitorEventMultiplier(
  events: RaveEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  return resolveRegionalEventMultiplier(events, regionId, eventProfile.visitorMultipliers);
}

function serializeRaveSummary(
  rave: RaveSnapshotRecord,
  factionId: string | null,
  maintenanceStatus: RaveMaintenanceStatus,
  events: RaveEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  configCatalog: ResolvedGameConfigCatalog,
): RaveSummary {
  const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'rave');
  const eventProfile = resolvePropertyEventProfile(configCatalog, 'rave');
  const sabotageStatus = buildPropertySabotageStatusSummary({
    now: new Date(),
    sabotageRecoveryReadyAt: rave.sabotageRecoveryReadyAt,
    sabotageResolvedAt: rave.sabotageResolvedAt,
    sabotageState: rave.sabotageState,
    type: 'rave',
  });
  const locationMultiplier = buildRaveLocationMultiplier(rave);
  const lineup = rave.lineup.map((entry) => ({
    baseUnitPrice: entry.baseUnitPrice,
    code: entry.code,
    configuredPriceMultiplier: entry.priceMultiplier,
    configuredUnitPrice: buildConfiguredUnitPrice(rave, entry, events, eventProfile),
    drugId: entry.drugId,
    drugName: entry.drugName,
    estimatedVisitorsPerCycle: buildRaveVisitorsPerCycle(rave, entry, events, eventProfile),
    quantity: entry.quantity,
  }));
  const estimatedHourlyGrossRevenue = roundCurrency(
    lineup.reduce(
      (total, entry) =>
        total +
        entry.configuredUnitPrice *
          Math.min(entry.quantity, entry.estimatedVisitorsPerCycle) *
          passiveProfile.business.passiveRevenueMultiplier *
          regionalDominationBonus.revenueMultiplier *
          sabotageStatus.operationalMultiplier,
      0,
    ) * (60 / RAVE_OPERATION_CYCLE_MINUTES),
  );
  const projectedDailyGrossRevenue = roundCurrency(estimatedHourlyGrossRevenue * 24);
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    rave,
    rave.operationCostMultiplier,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );

  return {
    cashbox: {
      availableToCollect: rave.cashBalance,
      grossRevenueLifetime: rave.grossRevenueTotal,
      lastCollectedAt: rave.lastCollectedAt ? rave.lastCollectedAt.toISOString() : null,
      lastSaleAt: rave.lastSaleAt.toISOString(),
      totalFactionCommission: rave.factionCommissionTotal,
    },
    economics: {
      cycleMinutes: RAVE_OPERATION_CYCLE_MINUTES,
      effectiveFactionCommissionRate: resolveEffectiveFactionCommissionRate(
        factionId,
        propertyDefinition,
      ),
      estimatedHourlyGrossRevenue,
      locationMultiplier,
      profitable: projectedDailyGrossRevenue > dailyUpkeep,
      visitorFlowPerCycle: lineup.reduce((total, entry) => total + entry.estimatedVisitorsPerCycle, 0),
    },
    favelaId: rave.favelaId,
    id: rave.id,
    level: rave.level,
    lineup,
    maintenanceStatus: {
      blocked: maintenanceStatus.blocked,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: maintenanceStatus.moneySpentOnSync,
      overdueDays: maintenanceStatus.overdueDays,
    },
    sabotageStatus,
    regionId: rave.regionId,
    status: sabotageStatus.blocked
      ? 'sabotage_blocked'
      : maintenanceStatus.blocked
        ? 'maintenance_blocked'
        : lineup.length > 0
          ? 'active'
          : 'no_lineup',
  };
}

function syncRaveMaintenance(
  rave: RaveSnapshotRecord,
  workingMoney: number,
  now: Date,
  propertyDefinition: PropertyDefinitionSummary,
  maintenanceMultiplier = 1,
): RaveMaintenanceStatus {
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    rave,
    rave.operationCostMultiplier,
    maintenanceMultiplier,
  );
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - rave.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  if (dueDays <= 0 || dailyUpkeep <= 0) {
    return {
      blocked: rave.suspended,
      lastMaintenanceAt: rave.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(workingMoney / dailyUpkeep));
  const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
  const overdueDays = dueDays - payableDays;
  const nextLastMaintenanceAt = new Date(
    rave.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  return {
    blocked: overdueDays > 0,
    lastMaintenanceAt: nextLastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
  };
}
