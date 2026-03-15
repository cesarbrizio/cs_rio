import {
  BOCA_OPERATION_CYCLE_MINUTES,
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  type BocaCollectResponse,
  type BocaListResponse,
  type BocaStockInput,
  type BocaStockResponse,
  type BocaSummary,
  type PropertyDefinitionSummary,
  type RegionId,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  bocaDrugStocks,
  bocaOperations,
  drugs,
  factionMembers,
  factions,
  favelas,
  gameEvents,
  playerInventory,
  players,
  properties,
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

type SupportedEventType = 'blitz_pm' | 'faca_na_caveira' | 'operacao_policial' | 'seca_drogas';

interface BocaPlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface BocaStockRecord {
  baseUnitPrice: number;
  code: string;
  drugId: string;
  drugName: string;
  productionLevel: number;
  quantity: number;
}

interface BocaSoldierRosterRecord {
  count: number;
  dailyCost: number;
}

interface BocaEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface BocaSnapshotRecord {
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
  operationCostMultiplier: number;
  policePressure: number;
  regionId: RegionId;
  soldierRoster: BocaSoldierRosterRecord[];
  stock: BocaStockRecord[];
  suspended: boolean;
  wealthIndex: number;
}

interface BocaMaintenanceStatus {
  blocked: boolean;
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
}

interface BocaStateUpdateInput {
  cashBalance: number;
  factionCommissionDelta: number;
  factionCommissionTotal: number;
  factionId: string | null;
  grossRevenueDelta: number;
  grossRevenueTotal: number;
  lastSaleAt: Date;
  playerMoneySpentOnMaintenance: number;
  propertyId: string;
  propertyLastMaintenanceAt: Date;
  propertySuspended: boolean;
  stockQuantities: Array<{
    drugId: string;
    quantity: number;
  }>;
}

interface BocaStockTransferRecord {
  drugId: string;
  drugName: string;
  transferredQuantity: number;
}

interface BocaCollectRecord {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

interface BocaSyncResult {
  changed: boolean;
  maintenanceStatus: BocaMaintenanceStatus;
  nextPlayerMoney: number;
  snapshot: BocaSnapshotRecord;
}

export interface BocaRepository {
  applyBocaState(playerId: string, input: BocaStateUpdateInput): Promise<boolean>;
  collectCash(playerId: string, propertyId: string): Promise<BocaCollectRecord | null>;
  getBoca(playerId: string, propertyId: string): Promise<BocaSnapshotRecord | null>;
  getPlayer(playerId: string): Promise<BocaPlayerRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<BocaEventRecord[]>;
  listBocas(playerId: string): Promise<BocaSnapshotRecord[]>;
  stockDrug(
    playerId: string,
    propertyId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<BocaStockTransferRecord | null>;
}

export interface BocaServiceOptions {
  gameConfigService?: GameConfigService;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  repository?: BocaRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface BocaServiceContract {
  close?(): Promise<void>;
  collectCash(playerId: string, propertyId: string): Promise<BocaCollectResponse>;
  listBocas(playerId: string): Promise<BocaListResponse>;
  stockDrug(playerId: string, propertyId: string, input: BocaStockInput): Promise<BocaStockResponse>;
}

type BocaErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'invalid_stock'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class BocaError extends Error {
  constructor(
    public readonly code: BocaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BocaError';
  }
}

export class DatabaseBocaRepository implements BocaRepository {
  async applyBocaState(playerId: string, input: BocaStateUpdateInput): Promise<boolean> {
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
            eq(properties.type, 'boca'),
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
            description: 'Comissao automatica recebida de uma boca de membro.',
            entryType: 'business_commission',
            factionId: input.factionId,
            grossAmount: input.grossRevenueDelta,
            netAmount: roundCurrency(input.grossRevenueDelta - input.factionCommissionDelta),
            originType: 'boca',
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
          propertyId: bocaOperations.propertyId,
        })
        .from(bocaOperations)
        .where(eq(bocaOperations.propertyId, input.propertyId))
        .limit(1);

      if (existingOperation) {
        await tx
          .update(bocaOperations)
          .set({
            cashBalance: input.cashBalance.toFixed(2),
            factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
            grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
            lastSaleAt: input.lastSaleAt,
          })
          .where(eq(bocaOperations.propertyId, input.propertyId));
      } else {
        await tx.insert(bocaOperations).values({
          cashBalance: input.cashBalance.toFixed(2),
          factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
          grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
          lastSaleAt: input.lastSaleAt,
          propertyId: input.propertyId,
        });
      }

      for (const stock of input.stockQuantities) {
        const [existingStock] = await tx
          .select({
            propertyId: bocaDrugStocks.propertyId,
          })
          .from(bocaDrugStocks)
          .where(
            and(
              eq(bocaDrugStocks.propertyId, input.propertyId),
              eq(bocaDrugStocks.drugId, stock.drugId),
            ),
          )
          .limit(1);

        if (stock.quantity <= 0) {
          if (existingStock) {
            await tx
              .delete(bocaDrugStocks)
              .where(
                and(
                  eq(bocaDrugStocks.propertyId, input.propertyId),
                  eq(bocaDrugStocks.drugId, stock.drugId),
                ),
              );
          }

          continue;
        }

        if (existingStock) {
          await tx
            .update(bocaDrugStocks)
            .set({
              quantity: stock.quantity,
            })
            .where(
              and(
                eq(bocaDrugStocks.propertyId, input.propertyId),
                eq(bocaDrugStocks.drugId, stock.drugId),
              ),
            );
        } else {
          await tx.insert(bocaDrugStocks).values({
            drugId: stock.drugId,
            propertyId: input.propertyId,
            quantity: stock.quantity,
          });
        }
      }

      return true;
    });
  }

  async collectCash(playerId: string, propertyId: string): Promise<BocaCollectRecord | null> {
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select({
          cashBalance: bocaOperations.cashBalance,
        })
        .from(bocaOperations)
        .innerJoin(properties, eq(properties.id, bocaOperations.propertyId))
        .where(
          and(
            eq(bocaOperations.propertyId, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'boca'),
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
        .update(bocaOperations)
        .set({
          cashBalance: '0.00',
          lastCollectedAt: new Date(),
        })
        .where(eq(bocaOperations.propertyId, propertyId));

      await tx.insert(transactions).values({
        amount: collectedAmount.toFixed(2),
        description: `Coleta de caixa da boca ${propertyId}`,
        playerId,
        type: 'boca_collect',
      });

      return {
        collectedAmount,
        playerMoneyAfterCollect,
      };
    });
  }

  async getBoca(playerId: string, propertyId: string): Promise<BocaSnapshotRecord | null> {
    const bocas = await this.listBocas(playerId);
    return bocas.find((boca) => boca.id === propertyId) ?? null;
  }

  async getPlayer(playerId: string): Promise<BocaPlayerRecord | null> {
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

  async listActiveEvents(regionId: RegionId, now: Date): Promise<BocaEventRecord[]> {
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
      (row): row is BocaEventRecord =>
        row.eventType === 'seca_drogas' ||
        row.eventType === 'operacao_policial' ||
        row.eventType === 'blitz_pm' ||
        row.eventType === 'faca_na_caveira',
    );
  }

  async listBocas(playerId: string): Promise<BocaSnapshotRecord[]> {
    const bocaRows = await db
      .select({
        cashBalance: bocaOperations.cashBalance,
        createdAt: properties.createdAt,
        densityIndex: regions.densityIndex,
        factionCommissionTotal: bocaOperations.factionCommissionTotal,
        favelaId: properties.favelaId,
        favelaPopulation: favelas.population,
        grossRevenueTotal: bocaOperations.grossRevenueTotal,
        id: properties.id,
        lastCollectedAt: bocaOperations.lastCollectedAt,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        lastSaleAt: bocaOperations.lastSaleAt,
        level: properties.level,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        regionId: properties.regionId,
        suspended: properties.suspended,
        wealthIndex: regions.wealthIndex,
      })
      .from(properties)
      .innerJoin(regions, eq(regions.id, properties.regionId))
      .leftJoin(favelas, eq(favelas.id, properties.favelaId))
      .leftJoin(bocaOperations, eq(bocaOperations.propertyId, properties.id))
      .where(
        and(
          eq(properties.playerId, playerId),
          eq(properties.type, 'boca'),
        ),
      );

    if (bocaRows.length === 0) {
      return [];
    }

    const propertyIds = bocaRows.map((row) => row.id);
    const stockRows = await db
      .select({
        baseUnitPrice: drugs.price,
        code: drugs.code,
        drugId: drugs.id,
        drugName: drugs.name,
        productionLevel: drugs.productionLevel,
        propertyId: bocaDrugStocks.propertyId,
        quantity: bocaDrugStocks.quantity,
      })
      .from(bocaDrugStocks)
      .innerJoin(drugs, eq(drugs.id, bocaDrugStocks.drugId))
      .where(inArray(bocaDrugStocks.propertyId, propertyIds));
    const soldierRows = await db
      .select({
        dailyCost: soldiers.dailyCost,
        propertyId: soldiers.propertyId,
      })
      .from(soldiers)
      .where(inArray(soldiers.propertyId, propertyIds));
    const stockByPropertyId = new Map<string, BocaStockRecord[]>();
    const soldiersByPropertyId = new Map<string, BocaSoldierRosterRecord>();

    for (const stockRow of stockRows) {
      const current = stockByPropertyId.get(stockRow.propertyId) ?? [];
      current.push({
        baseUnitPrice: roundCurrency(Number.parseFloat(String(stockRow.baseUnitPrice))),
        code: stockRow.code,
        drugId: stockRow.drugId,
        drugName: stockRow.drugName,
        productionLevel: stockRow.productionLevel,
        quantity: stockRow.quantity,
      });
      stockByPropertyId.set(stockRow.propertyId, current);
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

    return bocaRows.map((row) => ({
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
      operationCostMultiplier: roundCurrency(Number.parseFloat(String(row.operationCostMultiplier))),
      policePressure: row.policePressure,
      regionId: row.regionId as RegionId,
      soldierRoster: soldiersByPropertyId.get(row.id)
        ? [soldiersByPropertyId.get(row.id) as BocaSoldierRosterRecord]
        : [],
      stock: [...(stockByPropertyId.get(row.id) ?? [])].sort((left, right) =>
        left.drugName.localeCompare(right.drugName, 'pt-BR'),
      ),
      suspended: row.suspended,
      wealthIndex: row.wealthIndex,
    }));
  }

  async stockDrug(
    playerId: string,
    propertyId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<BocaStockTransferRecord | null> {
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
            eq(properties.type, 'boca'),
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

      const [existingStock] = await tx
        .select({
          quantity: bocaDrugStocks.quantity,
        })
        .from(bocaDrugStocks)
        .where(
          and(
            eq(bocaDrugStocks.propertyId, propertyId),
            eq(bocaDrugStocks.drugId, inventoryItem.itemId),
          ),
        )
        .limit(1);

      if (existingStock) {
        await tx
          .update(bocaDrugStocks)
          .set({
            quantity: existingStock.quantity + quantity,
          })
          .where(
            and(
              eq(bocaDrugStocks.propertyId, propertyId),
              eq(bocaDrugStocks.drugId, inventoryItem.itemId),
            ),
          );
      } else {
        await tx.insert(bocaDrugStocks).values({
          drugId: inventoryItem.itemId,
          propertyId,
          quantity,
        });
      }

      const [existingOperation] = await tx
        .select({
          propertyId: bocaOperations.propertyId,
        })
        .from(bocaOperations)
        .where(eq(bocaOperations.propertyId, propertyId))
        .limit(1);

      if (!existingOperation) {
        await tx.insert(bocaOperations).values({
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

export class BocaService implements BocaServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: BocaRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: BocaServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseBocaRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async collectCash(playerId: string, propertyId: string): Promise<BocaCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncBoca(player, propertyId, passiveProfile);

    if (synced.snapshot.cashBalance <= 0) {
      throw new BocaError('conflict', 'Esta boca nao possui caixa disponivel para coleta.');
    }

    const collected = await this.repository.collectCash(playerId, propertyId);

    if (!collected) {
      throw new BocaError('not_found', 'Boca nao encontrada para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const boca = await this.listSingleBoca(playerId, propertyId);

    return {
      boca,
      collectedAmount: collected.collectedAmount,
      playerMoneyAfterCollect: collected.playerMoneyAfterCollect,
    };
  }

  async listBocas(playerId: string): Promise<BocaListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [configCatalog, passiveProfile, bocas, favelasList] = await Promise.all([
      this.gameConfigService.getResolvedCatalog(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listBocas(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    let workingPlayer = player;
    let changed = false;
    const summaries: BocaSummary[] = [];
    const eventCache = new Map<RegionId, BocaEventRecord[]>();

    for (const boca of [...bocas].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      let events = eventCache.get(boca.regionId);

      if (!events) {
        events = await this.repository.listActiveEvents(boca.regionId, this.now());
        eventCache.set(boca.regionId, events);
      }

      const regionalDominationBonus =
        regionalDominationByRegion.get(boca.regionId) ??
        buildInactiveRegionalDominationBonus(boca.regionId);
      const synced = await this.syncBocaRecord(
        workingPlayer,
        boca,
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
        serializeBocaSummary(
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
      bocas: summaries,
    };
  }

  async stockDrug(
    playerId: string,
    propertyId: string,
    input: BocaStockInput,
  ): Promise<BocaStockResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new BocaError('validation', 'Quantidade para estocar deve ser um inteiro maior ou igual a 1.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    await this.syncBoca(player, propertyId, passiveProfile);
    const transferred = await this.repository.stockDrug(
      playerId,
      propertyId,
      input.inventoryItemId,
      input.quantity,
    );

    if (!transferred) {
      throw new BocaError(
        'invalid_stock',
        'Droga invalida, ausente no inventario ou incompatível com esta boca.',
      );
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const boca = await this.listSingleBoca(playerId, propertyId);

    return {
      boca,
      drug: {
        id: transferred.drugId,
        name: transferred.drugName,
      },
      transferredQuantity: transferred.transferredQuantity,
    };
  }

  private async listSingleBoca(playerId: string, propertyId: string): Promise<BocaSummary> {
    const summary = await this.listBocas(playerId);
    const boca = summary.bocas.find((entry) => entry.id === propertyId);

    if (!boca) {
      throw new BocaError('not_found', 'Boca nao encontrada apos a atualizacao.');
    }

    return boca;
  }

  private async requireReadyPlayer(playerId: string): Promise<BocaPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new BocaError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new BocaError('character_not_ready', 'Crie seu personagem antes de gerenciar bocas.');
    }

    return player;
  }

  private async syncBoca(
    player: BocaPlayerRecord,
    propertyId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<BocaSyncResult> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const boca = await this.repository.getBoca(player.id, propertyId);

    if (!boca) {
      throw new BocaError('not_found', 'Boca nao encontrada.');
    }

    const events = await this.repository.listActiveEvents(boca.regionId, this.now());
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(boca.regionId) ??
      buildInactiveRegionalDominationBonus(boca.regionId);
    return this.syncBocaRecord(
      player,
      boca,
      events,
      passiveProfile,
      regionalDominationBonus,
      configCatalog,
    );
  }

  private async syncBocaRecord(
    player: BocaPlayerRecord,
    boca: BocaSnapshotRecord,
    events: BocaEventRecord[],
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
    configCatalog: ResolvedGameConfigCatalog,
  ): Promise<BocaSyncResult> {
    const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'boca');
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'boca');
    const maintenanceStatus = syncBocaMaintenance(
      boca,
      player.money,
      this.now(),
      propertyDefinition,
      passiveProfile.business.propertyMaintenanceMultiplier *
        regionalDominationBonus.maintenanceMultiplier,
    );
    const propertyAfterMaintenance: BocaSnapshotRecord = {
      ...boca,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt,
      suspended: maintenanceStatus.blocked,
    };
    const cycleMs = BOCA_OPERATION_CYCLE_MINUTES * 60 * 1000;
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
    const nextStock = propertyAfterMaintenance.stock.map((stock) => ({ ...stock }));

    if (elapsedCycles > 0 && !propertyAfterMaintenance.suspended) {
      for (const stock of nextStock) {
        const quantityPerCycle = buildBocaDemandPerCycle(
          propertyAfterMaintenance,
          stock,
          events,
          passiveProfile,
          eventProfile,
        );
        const quantitySold = Math.min(stock.quantity, quantityPerCycle * elapsedCycles);

        if (quantitySold <= 0) {
          continue;
        }

        const estimatedUnitPrice = buildBocaUnitPrice(
          propertyAfterMaintenance,
          stock,
          events,
          eventProfile,
        );
        const grossRevenue = roundCurrency(
          estimatedUnitPrice *
            quantitySold *
            passiveProfile.business.passiveRevenueMultiplier *
            regionalDominationBonus.revenueMultiplier,
        );
        const commissionAmount = roundCurrency(grossRevenue * effectiveFactionCommissionRate);
        const netRevenue = roundCurrency(grossRevenue - commissionAmount);

        stock.quantity -= quantitySold;
        cashBalance = roundCurrency(cashBalance + netRevenue);
        grossRevenueDelta = roundCurrency(grossRevenueDelta + grossRevenue);
        grossRevenueTotal = roundCurrency(grossRevenueTotal + grossRevenue);
        factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
        factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
      }
    }

    const nextSnapshot: BocaSnapshotRecord = {
      ...propertyAfterMaintenance,
      cashBalance,
      factionCommissionTotal,
      grossRevenueTotal,
      lastSaleAt: elapsedCycles > 0 ? processedUntil : propertyAfterMaintenance.lastSaleAt,
      stock: nextStock.filter((stock) => stock.quantity > 0),
    };
    const changed =
      maintenanceStatus.moneySpentOnSync > 0 ||
      maintenanceStatus.overdueDays > 0 !== boca.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== boca.lastMaintenanceAt.getTime() ||
      nextSnapshot.lastSaleAt.getTime() !== boca.lastSaleAt.getTime() ||
      nextSnapshot.cashBalance !== boca.cashBalance ||
      nextSnapshot.grossRevenueTotal !== boca.grossRevenueTotal ||
      nextSnapshot.factionCommissionTotal !== boca.factionCommissionTotal ||
      haveStocksChanged(boca.stock, nextSnapshot.stock);

    if (changed) {
      const applied = await this.repository.applyBocaState(player.id, {
        cashBalance: nextSnapshot.cashBalance,
        factionCommissionDelta,
        factionCommissionTotal: nextSnapshot.factionCommissionTotal,
        factionId: player.factionId,
        grossRevenueDelta,
        grossRevenueTotal: nextSnapshot.grossRevenueTotal,
        lastSaleAt: nextSnapshot.lastSaleAt,
        playerMoneySpentOnMaintenance: maintenanceStatus.moneySpentOnSync,
        propertyId: nextSnapshot.id,
        propertyLastMaintenanceAt: nextSnapshot.lastMaintenanceAt,
        propertySuspended: nextSnapshot.suspended,
        stockQuantities: nextSnapshot.stock.map((stock) => ({
          drugId: stock.drugId,
          quantity: stock.quantity,
        })),
      });

      if (!applied) {
        throw new BocaError('not_found', 'Falha ao sincronizar a operacao da boca.');
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

function buildBocaDemandPerCycle(
  boca: BocaSnapshotRecord,
  stock: BocaStockRecord,
  events: BocaEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  eventProfile: PropertyEventProfile,
): number {
  const baseDemand =
    2 +
    boca.level * 2 +
    Math.floor(boca.densityIndex / 18) +
    Math.floor((boca.favelaPopulation ?? 0) / 18_000);
  const qualityMultiplier = 0.88 + stock.productionLevel * 0.22;
  const policePenalty = Math.max(0.55, 1 - boca.policePressure / 240);
  const eventDemandMultiplier = resolveEventDemandMultiplier(events, boca.regionId, eventProfile);

  return Math.max(
    1,
    Math.floor(
      baseDemand *
        qualityMultiplier *
        policePenalty *
        eventDemandMultiplier *
        passiveProfile.business.bocaDemandMultiplier,
    ),
  );
}

function buildBocaLocationMultiplier(boca: BocaSnapshotRecord): number {
  const populationFactor = (boca.favelaPopulation ?? 0) / 220_000;
  const rawValue =
    0.9 +
    boca.wealthIndex / 200 +
    boca.densityIndex / 250 +
    populationFactor +
    boca.level * 0.06 -
    boca.policePressure / 650;

  return clampMultiplier(rawValue, 1, 2.2);
}

function buildBocaUnitPrice(
  boca: BocaSnapshotRecord,
  stock: BocaStockRecord,
  events: BocaEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const locationMultiplier = buildBocaLocationMultiplier(boca);
  const qualityMultiplier = 0.92 + stock.productionLevel * 0.14;
  const eventPriceMultiplier = resolveEventPriceMultiplier(events, boca.regionId, eventProfile);

  return roundCurrency(stock.baseUnitPrice * locationMultiplier * qualityMultiplier * eventPriceMultiplier);
}

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function haveStocksChanged(previous: BocaStockRecord[], next: BocaStockRecord[]): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  const nextMap = new Map(next.map((stock) => [stock.drugId, stock.quantity]));

  return previous.some((stock) => nextMap.get(stock.drugId) !== stock.quantity);
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

function resolveEventDemandMultiplier(
  events: BocaEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  return resolveRegionalEventMultiplier(events, regionId, eventProfile.demandMultipliers);
}

function resolveEventPriceMultiplier(
  events: BocaEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  return resolveRegionalEventMultiplier(events, regionId, eventProfile.priceMultipliers);
}

function serializeBocaSummary(
  boca: BocaSnapshotRecord,
  factionId: string | null,
  maintenanceStatus: BocaMaintenanceStatus,
  events: BocaEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  configCatalog: ResolvedGameConfigCatalog,
): BocaSummary {
  const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'boca');
  const eventProfile = resolvePropertyEventProfile(configCatalog, 'boca');
  const locationMultiplier = buildBocaLocationMultiplier(boca);
  const stock = boca.stock.map((entry) => ({
    baseUnitPrice: entry.baseUnitPrice,
    code: entry.code,
    drugId: entry.drugId,
    drugName: entry.drugName,
    estimatedQuantityPerCycle: buildBocaDemandPerCycle(
      boca,
      entry,
      events,
      passiveProfile,
      eventProfile,
    ),
    estimatedUnitPrice: buildBocaUnitPrice(boca, entry, events, eventProfile),
    quantity: entry.quantity,
  }));
  const estimatedHourlyGrossRevenue = roundCurrency(
    stock.reduce(
      (total, entry) =>
        total +
        entry.estimatedUnitPrice *
          Math.min(entry.quantity, entry.estimatedQuantityPerCycle) *
          passiveProfile.business.passiveRevenueMultiplier *
          regionalDominationBonus.revenueMultiplier,
      0,
    ) * (60 / BOCA_OPERATION_CYCLE_MINUTES),
  );
  const stockUnits = stock.reduce((total, entry) => total + entry.quantity, 0);
  const projectedDailyGrossRevenue = roundCurrency(estimatedHourlyGrossRevenue * 24);
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    boca,
    boca.operationCostMultiplier,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );

  return {
    cashbox: {
      availableToCollect: boca.cashBalance,
      grossRevenueLifetime: boca.grossRevenueTotal,
      lastCollectedAt: boca.lastCollectedAt ? boca.lastCollectedAt.toISOString() : null,
      lastSaleAt: boca.lastSaleAt.toISOString(),
      totalFactionCommission: boca.factionCommissionTotal,
    },
    economics: {
      cycleMinutes: BOCA_OPERATION_CYCLE_MINUTES,
      effectiveFactionCommissionRate: resolveEffectiveFactionCommissionRate(
        factionId,
        propertyDefinition,
      ),
      estimatedHourlyGrossRevenue,
      locationMultiplier,
      npcDemandPerCycle: stock.reduce((total, entry) => total + entry.estimatedQuantityPerCycle, 0),
      profitable: projectedDailyGrossRevenue > dailyUpkeep,
    },
    favelaId: boca.favelaId,
    id: boca.id,
    level: boca.level,
    maintenanceStatus: {
      blocked: maintenanceStatus.blocked,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: maintenanceStatus.moneySpentOnSync,
      overdueDays: maintenanceStatus.overdueDays,
    },
    regionId: boca.regionId,
    status: maintenanceStatus.blocked ? 'maintenance_blocked' : stockUnits > 0 ? 'active' : 'out_of_stock',
    stock,
    stockUnits,
  };
}

function syncBocaMaintenance(
  boca: BocaSnapshotRecord,
  workingMoney: number,
  now: Date,
  propertyDefinition: PropertyDefinitionSummary,
  maintenanceMultiplier = 1,
): BocaMaintenanceStatus {
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    boca,
    boca.operationCostMultiplier,
    maintenanceMultiplier,
  );
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - boca.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  if (dueDays <= 0 || dailyUpkeep <= 0) {
    return {
      blocked: boca.suspended,
      lastMaintenanceAt: boca.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(workingMoney / dailyUpkeep));
  const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
  const overdueDays = dueDays - payableDays;
  const nextLastMaintenanceAt = new Date(
    boca.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  return {
    blocked: overdueDays > 0,
    lastMaintenanceAt: nextLastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
  };
}
