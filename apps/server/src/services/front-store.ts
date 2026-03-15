import {
  FRONT_STORE_INVESTIGATION_BLOCK_HOURS,
  FRONT_STORE_KIND_TEMPLATES,
  FRONT_STORE_LAUNDERING_DURATION_HOURS,
  FRONT_STORE_OPERATION_CYCLE_MINUTES,
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  type FrontStoreBatchStatus,
  type FrontStoreCollectResponse,
  type FrontStoreInvestInput,
  type FrontStoreInvestResponse,
  type FrontStoreKind,
  type FrontStoreKindTemplateSummary,
  type FrontStoreListResponse,
  type FrontStoreSummary,
  type PropertyDefinitionSummary,
  type RegionId,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionMembers,
  factions,
  favelas,
  frontStoreBatches,
  frontStoreOperations,
  gameEvents,
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

type SupportedEventType =
  | 'blitz_pm'
  | 'carnaval'
  | 'faca_na_caveira'
  | 'operacao_policial'
  | 'operacao_verao';

interface FrontStorePlayerRecord {
  bankMoney: number;
  carisma: number;
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface FrontStoreBatchRecord {
  completesAt: Date;
  expectedCleanReturn: number;
  id: string;
  investedAmount: number;
  investigationRisk: number;
  resolvedAt: Date | null;
  resolvedCleanAmount: number;
  seizedAmount: number;
  startedAt: Date;
  status: FrontStoreBatchStatus;
}

interface FrontStoreEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface FrontStoreSoldierRosterRecord {
  count: number;
  dailyCost: number;
}

interface FrontStoreSnapshotRecord {
  batches: FrontStoreBatchRecord[];
  cashBalance: number;
  createdAt: Date;
  densityIndex: number;
  factionCommissionTotal: number;
  favelaId: string | null;
  favelaPopulation: number | null;
  grossRevenueTotal: number;
  id: string;
  investigationActiveUntil: Date | null;
  investigationsTotal: number;
  kind: FrontStoreKind | null;
  lastCollectedAt: Date | null;
  lastInvestigationAt: Date | null;
  lastMaintenanceAt: Date;
  lastRevenueAt: Date;
  level: number;
  operationCostMultiplier: number;
  policePressure: number;
  regionId: RegionId;
  soldierRoster: FrontStoreSoldierRosterRecord[];
  suspended: boolean;
  totalLaunderedClean: number;
  totalSeizedAmount: number;
  wealthIndex: number;
}

interface FrontStoreMaintenanceStatus {
  blocked: boolean;
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
}

interface FrontStoreStateUpdateInput {
  batchStates: Array<{
    id: string;
    resolvedAt: Date | null;
    resolvedCleanAmount: number;
    seizedAmount: number;
    status: FrontStoreBatchStatus;
  }>;
  cashBalance: number;
  factionCommissionDelta: number;
  factionCommissionTotal: number;
  factionId: string | null;
  grossRevenueDelta: number;
  grossRevenueTotal: number;
  investigationActiveUntil: Date | null;
  investigationsTotal: number;
  lastInvestigationAt: Date | null;
  lastRevenueAt: Date;
  playerMoneySpentOnMaintenance: number;
  propertyId: string;
  propertyLastMaintenanceAt: Date;
  propertySuspended: boolean;
  storeKind: FrontStoreKind | null;
  totalLaunderedClean: number;
  totalSeizedAmount: number;
}

interface FrontStoreInvestRecord {
  batchId: string;
  playerMoneyAfterInvest: number;
}

interface FrontStoreCollectRecord {
  collectedAmount: number;
  playerBankMoneyAfterCollect: number;
}

interface FrontStoreSyncResult {
  changed: boolean;
  maintenanceStatus: FrontStoreMaintenanceStatus;
  snapshot: FrontStoreSnapshotRecord;
  nextPlayerMoney: number;
}

export interface FrontStoreRepository {
  applyFrontStoreState(playerId: string, input: FrontStoreStateUpdateInput): Promise<boolean>;
  collectCash(playerId: string, propertyId: string): Promise<FrontStoreCollectRecord | null>;
  getFrontStore(playerId: string, propertyId: string): Promise<FrontStoreSnapshotRecord | null>;
  getPlayer(playerId: string): Promise<FrontStorePlayerRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  investDirtyMoney(
    playerId: string,
    propertyId: string,
    input: {
      completesAt: Date;
      dirtyAmount: number;
      expectedCleanReturn: number;
      investigationRisk: number;
      startedAt: Date;
      storeKind: FrontStoreKind;
    },
  ): Promise<FrontStoreInvestRecord | null>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<FrontStoreEventRecord[]>;
  listFrontStores(playerId: string): Promise<FrontStoreSnapshotRecord[]>;
}

export interface FrontStoreServiceOptions {
  gameConfigService?: GameConfigService;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  random?: () => number;
  repository?: FrontStoreRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface FrontStoreServiceContract {
  close?(): Promise<void>;
  collectCash(playerId: string, propertyId: string): Promise<FrontStoreCollectResponse>;
  invest(
    playerId: string,
    propertyId: string,
    input: FrontStoreInvestInput,
  ): Promise<FrontStoreInvestResponse>;
  listFrontStores(playerId: string): Promise<FrontStoreListResponse>;
}

type FrontStoreErrorCode =
  | 'capacity'
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_funds'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class FrontStoreError extends Error {
  constructor(
    public readonly code: FrontStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FrontStoreError';
  }
}

export class DatabaseFrontStoreRepository implements FrontStoreRepository {
  async applyFrontStoreState(playerId: string, input: FrontStoreStateUpdateInput): Promise<boolean> {
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
            eq(properties.type, 'front_store'),
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
            createdAt: input.lastRevenueAt,
            description: 'Comissao automatica recebida de uma loja de fachada de membro.',
            entryType: 'business_commission',
            factionId: input.factionId,
            grossAmount: input.grossRevenueDelta,
            netAmount: roundCurrency(input.grossRevenueDelta - input.factionCommissionDelta),
            originType: 'front_store',
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
          propertyId: frontStoreOperations.propertyId,
        })
        .from(frontStoreOperations)
        .where(eq(frontStoreOperations.propertyId, input.propertyId))
        .limit(1);

      if (existingOperation) {
        await tx
          .update(frontStoreOperations)
          .set({
            cashBalance: input.cashBalance.toFixed(2),
            factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
            grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
            investigationActiveUntil: input.investigationActiveUntil,
            investigationsTotal: input.investigationsTotal,
            lastInvestigationAt: input.lastInvestigationAt,
            lastRevenueAt: input.lastRevenueAt,
            storeKind: input.storeKind,
            totalLaunderedClean: input.totalLaunderedClean.toFixed(2),
            totalSeizedAmount: input.totalSeizedAmount.toFixed(2),
          })
          .where(eq(frontStoreOperations.propertyId, input.propertyId));
      } else {
        await tx.insert(frontStoreOperations).values({
          cashBalance: input.cashBalance.toFixed(2),
          factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
          grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
          investigationActiveUntil: input.investigationActiveUntil,
          investigationsTotal: input.investigationsTotal,
          lastInvestigationAt: input.lastInvestigationAt,
          lastRevenueAt: input.lastRevenueAt,
          propertyId: input.propertyId,
          storeKind: input.storeKind,
          totalLaunderedClean: input.totalLaunderedClean.toFixed(2),
          totalSeizedAmount: input.totalSeizedAmount.toFixed(2),
        });
      }

      for (const batchState of input.batchStates) {
        await tx
          .update(frontStoreBatches)
          .set({
            resolvedAt: batchState.resolvedAt,
            resolvedCleanAmount: batchState.resolvedCleanAmount.toFixed(2),
            seizedAmount: batchState.seizedAmount.toFixed(2),
            status: batchState.status,
          })
          .where(
            and(
              eq(frontStoreBatches.id, batchState.id),
              eq(frontStoreBatches.propertyId, input.propertyId),
            ),
          );
      }

      return true;
    });
  }

  async collectCash(playerId: string, propertyId: string): Promise<FrontStoreCollectRecord | null> {
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select({
          cashBalance: frontStoreOperations.cashBalance,
        })
        .from(frontStoreOperations)
        .innerJoin(properties, eq(properties.id, frontStoreOperations.propertyId))
        .where(
          and(
            eq(frontStoreOperations.propertyId, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'front_store'),
          ),
        )
        .limit(1);
      const [player] = await tx
        .select({
          bankMoney: players.bankMoney,
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

      const playerBankMoneyAfterCollect = roundCurrency(
        Number.parseFloat(String(player.bankMoney)) + collectedAmount,
      );

      await tx
        .update(players)
        .set({
          bankMoney: playerBankMoneyAfterCollect.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(frontStoreOperations)
        .set({
          cashBalance: '0.00',
          lastCollectedAt: new Date(),
        })
        .where(eq(frontStoreOperations.propertyId, propertyId));

      await tx.insert(transactions).values({
        amount: collectedAmount.toFixed(2),
        description: `Coleta de caixa limpo da loja de fachada ${propertyId}`,
        playerId,
        type: 'front_store_collect',
      });

      return {
        collectedAmount,
        playerBankMoneyAfterCollect,
      };
    });
  }

  async getFrontStore(playerId: string, propertyId: string): Promise<FrontStoreSnapshotRecord | null> {
    const frontStores = await this.listFrontStores(playerId);
    return frontStores.find((entry) => entry.id === propertyId) ?? null;
  }

  async getPlayer(playerId: string): Promise<FrontStorePlayerRecord | null> {
    const [player] = await db
      .select({
        bankMoney: players.bankMoney,
        carisma: players.carisma,
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
      bankMoney: roundCurrency(Number.parseFloat(String(player.bankMoney))),
      carisma: player.carisma,
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

  async investDirtyMoney(
    playerId: string,
    propertyId: string,
    input: {
      completesAt: Date;
      dirtyAmount: number;
      expectedCleanReturn: number;
      investigationRisk: number;
      startedAt: Date;
      storeKind: FrontStoreKind;
    },
  ): Promise<FrontStoreInvestRecord | null> {
    return db.transaction(async (tx) => {
      const [property] = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'front_store'),
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

      if (!property || !player) {
        return null;
      }

      const playerMoneyAfterInvest = roundCurrency(
        Number.parseFloat(String(player.money)) - input.dirtyAmount,
      );

      await tx
        .update(players)
        .set({
          money: playerMoneyAfterInvest.toFixed(2),
        })
        .where(eq(players.id, playerId));

      const [operation] = await tx
        .select({
          propertyId: frontStoreOperations.propertyId,
          storeKind: frontStoreOperations.storeKind,
        })
        .from(frontStoreOperations)
        .where(eq(frontStoreOperations.propertyId, propertyId))
        .limit(1);

      if (!operation) {
        await tx.insert(frontStoreOperations).values({
          lastRevenueAt: input.startedAt,
          propertyId,
          storeKind: input.storeKind,
        });
      } else if (!operation.storeKind) {
        await tx
          .update(frontStoreOperations)
          .set({
            storeKind: input.storeKind,
          })
          .where(eq(frontStoreOperations.propertyId, propertyId));
      }

      const [createdBatch] = await tx
        .insert(frontStoreBatches)
        .values({
          completesAt: input.completesAt,
          expectedCleanReturn: input.expectedCleanReturn.toFixed(2),
          investedAmount: input.dirtyAmount.toFixed(2),
          investigationRisk: input.investigationRisk.toFixed(4),
          propertyId,
          startedAt: input.startedAt,
        })
        .returning({
          id: frontStoreBatches.id,
        });

      await tx.insert(transactions).values({
        amount: input.dirtyAmount.toFixed(2),
        description: `Investimento de lavagem na loja de fachada ${propertyId}`,
        playerId,
        type: 'front_store_invest',
      });

      return createdBatch
        ? {
            batchId: createdBatch.id,
            playerMoneyAfterInvest,
          }
        : null;
    });
  }

  async listActiveEvents(regionId: RegionId, now: Date): Promise<FrontStoreEventRecord[]> {
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
      (row): row is FrontStoreEventRecord =>
        row.eventType === 'blitz_pm' ||
        row.eventType === 'carnaval' ||
        row.eventType === 'faca_na_caveira' ||
        row.eventType === 'operacao_policial' ||
        row.eventType === 'operacao_verao',
    );
  }

  async listFrontStores(playerId: string): Promise<FrontStoreSnapshotRecord[]> {
    const rows = await db
      .select({
        cashBalance: frontStoreOperations.cashBalance,
        createdAt: properties.createdAt,
        densityIndex: regions.densityIndex,
        factionCommissionTotal: frontStoreOperations.factionCommissionTotal,
        favelaId: properties.favelaId,
        favelaPopulation: favelas.population,
        grossRevenueTotal: frontStoreOperations.grossRevenueTotal,
        id: properties.id,
        investigationActiveUntil: frontStoreOperations.investigationActiveUntil,
        investigationsTotal: frontStoreOperations.investigationsTotal,
        lastCollectedAt: frontStoreOperations.lastCollectedAt,
        lastInvestigationAt: frontStoreOperations.lastInvestigationAt,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        lastRevenueAt: frontStoreOperations.lastRevenueAt,
        level: properties.level,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        regionId: properties.regionId,
        storeKind: frontStoreOperations.storeKind,
        suspended: properties.suspended,
        totalLaunderedClean: frontStoreOperations.totalLaunderedClean,
        totalSeizedAmount: frontStoreOperations.totalSeizedAmount,
        wealthIndex: regions.wealthIndex,
      })
      .from(properties)
      .innerJoin(regions, eq(regions.id, properties.regionId))
      .leftJoin(favelas, eq(favelas.id, properties.favelaId))
      .leftJoin(frontStoreOperations, eq(frontStoreOperations.propertyId, properties.id))
      .where(and(eq(properties.playerId, playerId), eq(properties.type, 'front_store')));

    if (rows.length === 0) {
      return [];
    }

    const propertyIds = rows.map((row) => row.id);
    const batchRows = await db
      .select({
        completesAt: frontStoreBatches.completesAt,
        expectedCleanReturn: frontStoreBatches.expectedCleanReturn,
        id: frontStoreBatches.id,
        investedAmount: frontStoreBatches.investedAmount,
        investigationRisk: frontStoreBatches.investigationRisk,
        propertyId: frontStoreBatches.propertyId,
        resolvedAt: frontStoreBatches.resolvedAt,
        resolvedCleanAmount: frontStoreBatches.resolvedCleanAmount,
        seizedAmount: frontStoreBatches.seizedAmount,
        startedAt: frontStoreBatches.startedAt,
        status: frontStoreBatches.status,
      })
      .from(frontStoreBatches)
      .where(inArray(frontStoreBatches.propertyId, propertyIds));
    const soldierRows = await db
      .select({
        dailyCost: soldiers.dailyCost,
        propertyId: soldiers.propertyId,
      })
      .from(soldiers)
      .where(inArray(soldiers.propertyId, propertyIds));
    const batchesByPropertyId = new Map<string, FrontStoreBatchRecord[]>();
    const soldiersByPropertyId = new Map<string, FrontStoreSoldierRosterRecord>();

    for (const batchRow of batchRows) {
      const current = batchesByPropertyId.get(batchRow.propertyId) ?? [];
      current.push({
        completesAt: batchRow.completesAt,
        expectedCleanReturn: roundCurrency(Number.parseFloat(String(batchRow.expectedCleanReturn))),
        id: batchRow.id,
        investedAmount: roundCurrency(Number.parseFloat(String(batchRow.investedAmount))),
        investigationRisk: roundProbability(Number.parseFloat(String(batchRow.investigationRisk))),
        resolvedAt: batchRow.resolvedAt,
        resolvedCleanAmount: roundCurrency(Number.parseFloat(String(batchRow.resolvedCleanAmount))),
        seizedAmount: roundCurrency(Number.parseFloat(String(batchRow.seizedAmount))),
        startedAt: batchRow.startedAt,
        status: batchRow.status,
      });
      batchesByPropertyId.set(batchRow.propertyId, current);
    }

    for (const soldierRow of soldierRows) {
      const current = soldiersByPropertyId.get(soldierRow.propertyId) ?? {
        count: 0,
        dailyCost: 0,
      };
      current.count += 1;
      current.dailyCost = roundCurrency(current.dailyCost + Number.parseFloat(String(soldierRow.dailyCost)));
      soldiersByPropertyId.set(soldierRow.propertyId, current);
    }

    return rows.map((row) => ({
      batches: [...(batchesByPropertyId.get(row.id) ?? [])].sort(
        (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
      ),
      cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance ?? '0'))),
      createdAt: row.createdAt,
      densityIndex: row.densityIndex,
      factionCommissionTotal: roundCurrency(Number.parseFloat(String(row.factionCommissionTotal ?? '0'))),
      favelaId: row.favelaId,
      favelaPopulation: row.favelaPopulation,
      grossRevenueTotal: roundCurrency(Number.parseFloat(String(row.grossRevenueTotal ?? '0'))),
      id: row.id,
      investigationActiveUntil: row.investigationActiveUntil,
      investigationsTotal: row.investigationsTotal ?? 0,
      kind: row.storeKind,
      lastCollectedAt: row.lastCollectedAt,
      lastInvestigationAt: row.lastInvestigationAt,
      lastMaintenanceAt: row.lastMaintenanceAt,
      lastRevenueAt: row.lastRevenueAt ?? row.createdAt,
      level: row.level,
      operationCostMultiplier: roundCurrency(Number.parseFloat(String(row.operationCostMultiplier))),
      policePressure: row.policePressure,
      regionId: row.regionId as RegionId,
      soldierRoster: soldiersByPropertyId.get(row.id)
        ? [soldiersByPropertyId.get(row.id) as FrontStoreSoldierRosterRecord]
        : [],
      suspended: row.suspended,
      totalLaunderedClean: roundCurrency(Number.parseFloat(String(row.totalLaunderedClean ?? '0'))),
      totalSeizedAmount: roundCurrency(Number.parseFloat(String(row.totalSeizedAmount ?? '0'))),
      wealthIndex: row.wealthIndex,
    }));
  }
}

export class FrontStoreService implements FrontStoreServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly random: () => number;

  private readonly repository: FrontStoreRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: FrontStoreServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseFrontStoreRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async collectCash(playerId: string, propertyId: string): Promise<FrontStoreCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncFrontStore(player, propertyId, passiveProfile);

    if (synced.snapshot.cashBalance <= 0) {
      throw new FrontStoreError('conflict', 'Esta loja de fachada nao possui caixa limpo para coleta.');
    }

    const collected = await this.repository.collectCash(playerId, propertyId);

    if (!collected) {
      throw new FrontStoreError('not_found', 'Loja de fachada nao encontrada para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const frontStore = await this.listSingleFrontStore(playerId, propertyId);

    return {
      collectedAmount: collected.collectedAmount,
      frontStore,
      playerBankMoneyAfterCollect: collected.playerBankMoneyAfterCollect,
    };
  }

  async invest(
    playerId: string,
    propertyId: string,
    input: FrontStoreInvestInput,
  ): Promise<FrontStoreInvestResponse> {
    if (typeof input.dirtyAmount !== 'number' || Number.isNaN(input.dirtyAmount) || input.dirtyAmount < 100) {
      throw new FrontStoreError('validation', 'O investimento minimo para lavagem e de R$ 100.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncFrontStore(player, propertyId, passiveProfile);

    if (synced.maintenanceStatus.blocked) {
      throw new FrontStoreError('conflict', 'Regularize a manutencao da loja antes de investir em lavagem.');
    }

    if (isUnderInvestigation(synced.snapshot, this.now())) {
      throw new FrontStoreError('conflict', 'A loja esta sob investigacao e nao pode receber nova lavagem agora.');
    }

    const configuredKind = synced.snapshot.kind;

    if (configuredKind && input.storeKind && input.storeKind !== configuredKind) {
      throw new FrontStoreError('validation', 'O tipo da loja de fachada ja foi definido e nao pode ser trocado agora.');
    }

    const effectiveKind = configuredKind ?? input.storeKind;

    if (!effectiveKind) {
      throw new FrontStoreError('validation', 'Escolha o tipo da loja de fachada para iniciar a operacao.');
    }

    const capacityRemaining = resolveFrontStoreLaunderingCapacityRemaining(
      synced.snapshot,
      effectiveKind,
      this.now(),
    );

    if (roundCurrency(input.dirtyAmount) > capacityRemaining) {
      throw new FrontStoreError('capacity', 'A loja nao possui capacidade de lavagem disponivel para esse valor hoje.');
    }

    if (synced.nextPlayerMoney < roundCurrency(input.dirtyAmount)) {
      throw new FrontStoreError('insufficient_funds', 'Dinheiro em maos insuficiente para investir nessa lavagem.');
    }

    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(synced.snapshot.regionId) ??
      buildInactiveRegionalDominationBonus(synced.snapshot.regionId);
    const expectedCleanReturn = buildExpectedCleanReturn(
      synced.snapshot,
      effectiveKind,
      roundCurrency(input.dirtyAmount),
      passiveProfile,
      regionalDominationBonus,
    );
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'front_store');
    const investigationRisk = buildInvestigationRisk(
      synced.snapshot,
      effectiveKind,
      roundCurrency(input.dirtyAmount),
      player,
      capacityRemaining,
      await this.repository.listActiveEvents(synced.snapshot.regionId, this.now()),
      eventProfile,
    );
    const startedAt = this.now();
    const completesAt = new Date(
      startedAt.getTime() + FRONT_STORE_LAUNDERING_DURATION_HOURS * 60 * 60 * 1000,
    );
    const invested = await this.repository.investDirtyMoney(playerId, propertyId, {
      completesAt,
      dirtyAmount: roundCurrency(input.dirtyAmount),
      expectedCleanReturn,
      investigationRisk,
      startedAt,
      storeKind: effectiveKind,
    });

    if (!invested) {
      throw new FrontStoreError('not_found', 'Loja de fachada nao encontrada para investimento.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const frontStore = await this.listSingleFrontStore(playerId, propertyId);
    const batch = frontStore.batches.find((entry: FrontStoreSummary['batches'][number]) => entry.id === invested.batchId);

    if (!batch) {
      throw new FrontStoreError('not_found', 'Lote de lavagem nao encontrado apos o investimento.');
    }

    return {
      batch,
      frontStore,
      playerMoneyAfterInvest: invested.playerMoneyAfterInvest,
    };
  }

  async listFrontStores(playerId: string): Promise<FrontStoreListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [configCatalog, passiveProfile, frontStores, favelasList] = await Promise.all([
      this.gameConfigService.getResolvedCatalog(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listFrontStores(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    const eventCache = new Map<RegionId, FrontStoreEventRecord[]>();
    const summaries: FrontStoreSummary[] = [];
    let changed = false;
    let workingPlayer = player;

    for (const frontStore of [...frontStores].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      let events = eventCache.get(frontStore.regionId);

      if (!events) {
        events = await this.repository.listActiveEvents(frontStore.regionId, this.now());
        eventCache.set(frontStore.regionId, events);
      }

      const regionalDominationBonus =
        regionalDominationByRegion.get(frontStore.regionId) ??
        buildInactiveRegionalDominationBonus(frontStore.regionId);
      const synced = await this.syncFrontStoreRecord(
        workingPlayer,
        frontStore,
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
        serializeFrontStoreSummary(
          synced.snapshot,
          workingPlayer,
          synced.maintenanceStatus,
          this.now(),
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
      frontStores: summaries,
      kinds: [...FRONT_STORE_KIND_TEMPLATES],
    };
  }

  private async listSingleFrontStore(playerId: string, propertyId: string): Promise<FrontStoreSummary> {
    const summary = await this.listFrontStores(playerId);
    const frontStore = summary.frontStores.find((entry: FrontStoreSummary) => entry.id === propertyId);

    if (!frontStore) {
      throw new FrontStoreError('not_found', 'Loja de fachada nao encontrada apos a atualizacao.');
    }

    return frontStore;
  }

  private async requireReadyPlayer(playerId: string): Promise<FrontStorePlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new FrontStoreError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new FrontStoreError('character_not_ready', 'Crie seu personagem antes de gerenciar lojas de fachada.');
    }

    return player;
  }

  private async syncFrontStore(
    player: FrontStorePlayerRecord,
    propertyId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<FrontStoreSyncResult> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const frontStore = await this.repository.getFrontStore(player.id, propertyId);

    if (!frontStore) {
      throw new FrontStoreError('not_found', 'Loja de fachada nao encontrada.');
    }

    const events = await this.repository.listActiveEvents(frontStore.regionId, this.now());
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(frontStore.regionId) ??
      buildInactiveRegionalDominationBonus(frontStore.regionId);
    return this.syncFrontStoreRecord(
      player,
      frontStore,
      events,
      passiveProfile,
      regionalDominationBonus,
      configCatalog,
    );
  }

  private async syncFrontStoreRecord(
    player: FrontStorePlayerRecord,
    frontStore: FrontStoreSnapshotRecord,
    events: FrontStoreEventRecord[],
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
    configCatalog: ResolvedGameConfigCatalog,
  ): Promise<FrontStoreSyncResult> {
    const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'front_store');
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'front_store');
    const maintenanceStatus = syncFrontStoreMaintenance(
      frontStore,
      player.money,
      this.now(),
      propertyDefinition,
      passiveProfile.business.propertyMaintenanceMultiplier *
        regionalDominationBonus.maintenanceMultiplier,
    );
    const normalizedInvestigation = normalizeInvestigationWindow(frontStore, this.now());
    const propertyAfterMaintenance: FrontStoreSnapshotRecord = {
      ...frontStore,
      investigationActiveUntil: normalizedInvestigation.activeUntil,
      lastInvestigationAt: normalizedInvestigation.lastInvestigationAt,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt,
      suspended: maintenanceStatus.blocked,
    };
    const cycleMs = FRONT_STORE_OPERATION_CYCLE_MINUTES * 60 * 1000;
    const elapsedCycles = Math.floor(
      Math.max(0, this.now().getTime() - propertyAfterMaintenance.lastRevenueAt.getTime()) / cycleMs,
    );
    const processedUntil = new Date(
      propertyAfterMaintenance.lastRevenueAt.getTime() + elapsedCycles * cycleMs,
    );
    let cashBalance = propertyAfterMaintenance.cashBalance;
    let grossRevenueDelta = 0;
    let grossRevenueTotal = propertyAfterMaintenance.grossRevenueTotal;
    let factionCommissionTotal = propertyAfterMaintenance.factionCommissionTotal;
    let factionCommissionDelta = 0;
    let totalLaunderedClean = propertyAfterMaintenance.totalLaunderedClean;
    let totalSeizedAmount = propertyAfterMaintenance.totalSeizedAmount;
    let investigationsTotal = propertyAfterMaintenance.investigationsTotal;
    let investigationActiveUntil = propertyAfterMaintenance.investigationActiveUntil;
    let lastInvestigationAt = propertyAfterMaintenance.lastInvestigationAt;
    const effectiveFactionCommissionRate = resolveEffectiveFactionCommissionRate(
      player.factionId,
      propertyDefinition,
    );
    const nextBatches = propertyAfterMaintenance.batches.map((entry) => ({ ...entry }));

    if (elapsedCycles > 0 && !propertyAfterMaintenance.suspended && propertyAfterMaintenance.kind && !isUnderInvestigation(propertyAfterMaintenance, this.now())) {
      const legitRevenuePerCycle = buildFrontStoreLegitRevenuePerCycle(
        propertyAfterMaintenance,
        propertyAfterMaintenance.kind,
        events,
        passiveProfile,
        regionalDominationBonus,
        eventProfile,
      );

      if (legitRevenuePerCycle > 0) {
        const grossLegitRevenue = roundCurrency(legitRevenuePerCycle * elapsedCycles);
        const commissionAmount = roundCurrency(grossLegitRevenue * effectiveFactionCommissionRate);
        const netLegitRevenue = roundCurrency(grossLegitRevenue - commissionAmount);

        cashBalance = roundCurrency(cashBalance + netLegitRevenue);
        grossRevenueDelta = roundCurrency(grossRevenueDelta + grossLegitRevenue);
        grossRevenueTotal = roundCurrency(grossRevenueTotal + grossLegitRevenue);
        factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
        factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
      }
    }

    for (const batch of nextBatches) {
      if (batch.status !== 'pending' || batch.completesAt.getTime() > this.now().getTime()) {
        continue;
      }

      if (this.random() < batch.investigationRisk) {
        batch.resolvedAt = batch.completesAt;
        batch.resolvedCleanAmount = 0;
        batch.seizedAmount = batch.investedAmount;
        batch.status = 'seized';
        totalSeizedAmount = roundCurrency(totalSeizedAmount + batch.investedAmount);
        investigationsTotal += 1;
        lastInvestigationAt = batch.completesAt;
        const nextInvestigationUntil = new Date(
          batch.completesAt.getTime() + FRONT_STORE_INVESTIGATION_BLOCK_HOURS * 60 * 60 * 1000,
        );
        if (!investigationActiveUntil || nextInvestigationUntil.getTime() > investigationActiveUntil.getTime()) {
          investigationActiveUntil = nextInvestigationUntil;
        }
        continue;
      }

      const effectiveCleanReturn = roundCurrency(
        batch.expectedCleanReturn * passiveProfile.business.passiveRevenueMultiplier,
      );
      const commissionAmount = roundCurrency(effectiveCleanReturn * effectiveFactionCommissionRate);
      const netCleanReturn = roundCurrency(effectiveCleanReturn - commissionAmount);

      batch.resolvedAt = batch.completesAt;
      batch.resolvedCleanAmount = effectiveCleanReturn;
      batch.seizedAmount = 0;
      batch.status = 'completed';
        cashBalance = roundCurrency(cashBalance + netCleanReturn);
        grossRevenueDelta = roundCurrency(grossRevenueDelta + effectiveCleanReturn);
        grossRevenueTotal = roundCurrency(grossRevenueTotal + effectiveCleanReturn);
      totalLaunderedClean = roundCurrency(totalLaunderedClean + effectiveCleanReturn);
      factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
      factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
    }

    const nextSnapshot: FrontStoreSnapshotRecord = {
      ...propertyAfterMaintenance,
      batches: nextBatches,
      cashBalance,
      factionCommissionTotal,
      grossRevenueTotal,
      investigationActiveUntil,
      investigationsTotal,
      lastInvestigationAt,
      lastRevenueAt: elapsedCycles > 0 ? processedUntil : propertyAfterMaintenance.lastRevenueAt,
      totalLaunderedClean,
      totalSeizedAmount,
    };
    const changed =
      normalizedInvestigation.changed ||
      maintenanceStatus.moneySpentOnSync > 0 ||
      maintenanceStatus.overdueDays > 0 !== frontStore.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== frontStore.lastMaintenanceAt.getTime() ||
      nextSnapshot.lastRevenueAt.getTime() !== frontStore.lastRevenueAt.getTime() ||
      nextSnapshot.cashBalance !== frontStore.cashBalance ||
      nextSnapshot.grossRevenueTotal !== frontStore.grossRevenueTotal ||
      nextSnapshot.factionCommissionTotal !== frontStore.factionCommissionTotal ||
      nextSnapshot.totalLaunderedClean !== frontStore.totalLaunderedClean ||
      nextSnapshot.totalSeizedAmount !== frontStore.totalSeizedAmount ||
      nextSnapshot.investigationsTotal !== frontStore.investigationsTotal ||
      nextSnapshot.investigationActiveUntil?.getTime() !== frontStore.investigationActiveUntil?.getTime() ||
      nextSnapshot.lastInvestigationAt?.getTime() !== frontStore.lastInvestigationAt?.getTime() ||
      haveBatchesChanged(frontStore.batches, nextSnapshot.batches);

    if (changed) {
      const applied = await this.repository.applyFrontStoreState(player.id, {
        batchStates: nextSnapshot.batches.map((batch) => ({
          id: batch.id,
          resolvedAt: batch.resolvedAt,
          resolvedCleanAmount: batch.resolvedCleanAmount,
          seizedAmount: batch.seizedAmount,
          status: batch.status,
        })),
        cashBalance: nextSnapshot.cashBalance,
        factionCommissionDelta,
        factionCommissionTotal: nextSnapshot.factionCommissionTotal,
        factionId: player.factionId,
        grossRevenueDelta,
        grossRevenueTotal: nextSnapshot.grossRevenueTotal,
        investigationActiveUntil: nextSnapshot.investigationActiveUntil,
        investigationsTotal: nextSnapshot.investigationsTotal,
        lastInvestigationAt: nextSnapshot.lastInvestigationAt,
        lastRevenueAt: nextSnapshot.lastRevenueAt,
        playerMoneySpentOnMaintenance: maintenanceStatus.moneySpentOnSync,
        propertyId: nextSnapshot.id,
        propertyLastMaintenanceAt: nextSnapshot.lastMaintenanceAt,
        propertySuspended: nextSnapshot.suspended,
        storeKind: nextSnapshot.kind,
        totalLaunderedClean: nextSnapshot.totalLaunderedClean,
        totalSeizedAmount: nextSnapshot.totalSeizedAmount,
      });

      if (!applied) {
        throw new FrontStoreError('not_found', 'Falha ao sincronizar a operacao da loja de fachada.');
      }
    }

    return {
      changed,
      maintenanceStatus,
      snapshot: nextSnapshot,
      nextPlayerMoney: roundCurrency(player.money - maintenanceStatus.moneySpentOnSync),
    };
  }
}

function buildCenterLaunderingBonus(regionId: RegionId): number {
  return regionId === 'centro' ? 1.15 : 1;
}

function buildExpectedCleanReturn(
  frontStore: FrontStoreSnapshotRecord,
  kind: FrontStoreKind,
  dirtyAmount: number,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
): number {
  const template = getFrontStoreKindTemplate(kind);
  return roundCurrency(
    dirtyAmount *
      template.cleanReturnMultiplier *
      buildCenterLaunderingBonus(frontStore.regionId) *
      regionalDominationBonus.revenueMultiplier *
      regionalDominationBonus.frontStoreLaunderingMultiplier *
      passiveProfile.business.launderingReturnMultiplier,
  );
}

function buildFrontStoreLegitRevenuePerCycle(
  frontStore: FrontStoreSnapshotRecord,
  kind: FrontStoreKind,
  events: FrontStoreEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  eventProfile: PropertyEventProfile,
): number {
  const template = getFrontStoreKindTemplate(kind);
  const cyclesPerDay = (24 * 60) / FRONT_STORE_OPERATION_CYCLE_MINUTES;
  const baseCycleRevenue = template.baseDailyLegitRevenue / cyclesPerDay;
  const locationMultiplier = buildFrontStoreLocationMultiplier(frontStore);
  const levelMultiplier = 1 + frontStore.level * 0.08;
  const eventMultiplier = resolveFrontStoreRevenueEventMultiplier(
    events,
    frontStore.regionId,
    eventProfile,
  );

  return roundCurrency(
    baseCycleRevenue *
      locationMultiplier *
      levelMultiplier *
      eventMultiplier *
      regionalDominationBonus.revenueMultiplier *
      regionalDominationBonus.frontStoreLegitRevenueMultiplier *
      passiveProfile.business.passiveRevenueMultiplier,
  );
}

function buildFrontStoreLocationMultiplier(
  frontStore: Pick<
    FrontStoreSnapshotRecord,
    'densityIndex' | 'favelaPopulation' | 'level' | 'policePressure' | 'regionId' | 'wealthIndex'
  >,
): number {
  const rawValue =
    0.92 +
    frontStore.wealthIndex / 220 +
    frontStore.densityIndex / 360 +
    (frontStore.favelaPopulation ?? 0) / 420_000 +
    frontStore.level * 0.04 -
    frontStore.policePressure / 1200 +
    (frontStore.regionId === 'centro' ? 0.08 : 0);

  return clampMultiplier(rawValue, 0.9, 1.9);
}

function buildFrontStoreLaunderingCapacityPerDay(
  frontStore: FrontStoreSnapshotRecord,
  kind: FrontStoreKind,
): number {
  const template = getFrontStoreKindTemplate(kind);
  const locationMultiplier = buildFrontStoreLocationMultiplier(frontStore);
  const capacity = template.baseLaunderingCapacityPerDay * (1 + frontStore.level * 0.2) * locationMultiplier;
  return roundCurrency(capacity);
}

function buildFrontStoreCharismaRiskReduction(player: Pick<FrontStorePlayerRecord, 'carisma'>): number {
  return clampMultiplier(player.carisma / 300, 0, 0.3);
}

function buildInvestigationRisk(
  frontStore: FrontStoreSnapshotRecord,
  kind: FrontStoreKind,
  dirtyAmount: number,
  player: FrontStorePlayerRecord,
  capacityRemaining: number,
  events: FrontStoreEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const template = getFrontStoreKindTemplate(kind);
  const charismaReduction = buildFrontStoreCharismaRiskReduction(player);
  const amountPressure = clampMultiplier(dirtyAmount / Math.max(1000, capacityRemaining), 0.75, 1.6);
  const levelMitigation = clampMultiplier(1 - frontStore.level * 0.05, 0.82, 1);
  const eventMultiplier = resolveFrontStoreInvestigationEventMultiplier(
    events,
    frontStore.regionId,
    eventProfile,
  );

  return roundProbability(
    template.baseInvestigationRisk * amountPressure * levelMitigation * eventMultiplier * (1 - charismaReduction),
  );
}

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFrontStoreKindTemplate(kind: FrontStoreKind): FrontStoreKindTemplateSummary {
  const template = FRONT_STORE_KIND_TEMPLATES.find(
    (entry: FrontStoreKindTemplateSummary) => entry.kind === kind,
  );

  if (!template) {
    throw new Error(`Template de loja de fachada inexistente: ${kind}`);
  }

  return template;
}

function haveBatchesChanged(previous: FrontStoreBatchRecord[], next: FrontStoreBatchRecord[]): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  const nextMap = new Map(next.map((entry) => [entry.id, entry]));

  return previous.some((entry) => {
    const nextEntry = nextMap.get(entry.id);
    return (
      !nextEntry ||
      nextEntry.status !== entry.status ||
      nextEntry.resolvedAt?.getTime() !== entry.resolvedAt?.getTime() ||
      nextEntry.resolvedCleanAmount !== entry.resolvedCleanAmount ||
      nextEntry.seizedAmount !== entry.seizedAmount
    );
  });
}

function isUnderInvestigation(
  frontStore: Pick<FrontStoreSnapshotRecord, 'investigationActiveUntil'>,
  now: Date,
): boolean {
  return Boolean(
    frontStore.investigationActiveUntil && frontStore.investigationActiveUntil.getTime() > now.getTime(),
  );
}

function normalizeInvestigationWindow(
  frontStore: Pick<FrontStoreSnapshotRecord, 'investigationActiveUntil' | 'lastInvestigationAt'>,
  now: Date,
): {
  activeUntil: Date | null;
  changed: boolean;
  lastInvestigationAt: Date | null;
} {
  if (!frontStore.investigationActiveUntil) {
    return {
      activeUntil: null,
      changed: false,
      lastInvestigationAt: frontStore.lastInvestigationAt,
    };
  }

  if (frontStore.investigationActiveUntil.getTime() > now.getTime()) {
    return {
      activeUntil: frontStore.investigationActiveUntil,
      changed: false,
      lastInvestigationAt: frontStore.lastInvestigationAt,
    };
  }

  return {
    activeUntil: null,
    changed: true,
    lastInvestigationAt: frontStore.lastInvestigationAt,
  };
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

function resolveFrontStoreInvestigationEventMultiplier(
  events: FrontStoreEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  const multiplier = resolveRegionalEventMultiplier(
    events,
    regionId,
    eventProfile.investigationMultipliers,
  );
  const clampProfile = eventProfile.clamps?.investigation;
  return clampMultiplier(multiplier, clampProfile?.min ?? 0.5, clampProfile?.max ?? 2);
}

function resolveFrontStoreLaunderingCapacityRemaining(
  frontStore: FrontStoreSnapshotRecord,
  kind: FrontStoreKind,
  now: Date,
): number {
  const capacityPerDay = buildFrontStoreLaunderingCapacityPerDay(frontStore, kind);
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const used = frontStore.batches.reduce((total, batch) => {
    if (batch.startedAt.getTime() < cutoff) {
      return total;
    }

    return total + batch.investedAmount;
  }, 0);

  return roundCurrency(Math.max(0, capacityPerDay - used));
}

function resolveFrontStoreRevenueEventMultiplier(
  events: FrontStoreEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  const multiplier = resolveRegionalEventMultiplier(events, regionId, eventProfile.revenueMultipliers);
  const clampProfile = eventProfile.clamps?.revenue;
  return clampMultiplier(multiplier, clampProfile?.min ?? 0.5, clampProfile?.max ?? 1.6);
}

function roundProbability(value: number): number {
  return Math.round(clampMultiplier(value, 0.01, 0.95) * 10000) / 10000;
}

function serializeFrontStoreSummary(
  frontStore: FrontStoreSnapshotRecord,
  player: FrontStorePlayerRecord,
  maintenanceStatus: FrontStoreMaintenanceStatus,
  now: Date,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  configCatalog: ResolvedGameConfigCatalog,
): FrontStoreSummary {
  const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'front_store');
  const eventProfile = resolvePropertyEventProfile(configCatalog, 'front_store');
  const locationMultiplier = buildFrontStoreLocationMultiplier(frontStore);
  const isInvestigated = isUnderInvestigation(frontStore, now);
  const capacityPerDay = frontStore.kind
    ? buildFrontStoreLaunderingCapacityPerDay(frontStore, frontStore.kind)
    : 0;
  const remainingCapacity = frontStore.kind
    ? resolveFrontStoreLaunderingCapacityRemaining(frontStore, frontStore.kind, now)
    : 0;
  const legitRevenuePerCycle = frontStore.kind
    ? buildFrontStoreLegitRevenuePerCycle(
        frontStore,
        frontStore.kind,
        [],
        passiveProfile,
        regionalDominationBonus,
        eventProfile,
      )
    : 0;
  const estimatedHourlyLegitRevenue = roundCurrency(
    legitRevenuePerCycle * (60 / FRONT_STORE_OPERATION_CYCLE_MINUTES),
  );
  const charismaRiskReduction = buildFrontStoreCharismaRiskReduction(player);
  const projectedDailyGrossRevenue = roundCurrency(estimatedHourlyLegitRevenue * 24);
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    frontStore,
    frontStore.operationCostMultiplier,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );

  return {
    batches: frontStore.batches.map((batch) => ({
      completedAt: batch.completesAt.toISOString(),
      expectedCleanReturn: batch.expectedCleanReturn,
      id: batch.id,
      investedAmount: batch.investedAmount,
      investigationRisk: batch.investigationRisk,
      resolvedAt: batch.resolvedAt ? batch.resolvedAt.toISOString() : null,
      resolvedCleanAmount: batch.resolvedCleanAmount,
      seizedAmount: batch.seizedAmount,
      startedAt: batch.startedAt.toISOString(),
      status: batch.status,
    })),
    cashbox: {
      availableToCollect: frontStore.cashBalance,
      grossRevenueLifetime: frontStore.grossRevenueTotal,
      lastCollectedAt: frontStore.lastCollectedAt ? frontStore.lastCollectedAt.toISOString() : null,
      lastRevenueAt: frontStore.lastRevenueAt.toISOString(),
      totalFactionCommission: frontStore.factionCommissionTotal,
      totalLaunderedClean: frontStore.totalLaunderedClean,
      totalSeizedAmount: frontStore.totalSeizedAmount,
    },
    economics: {
      charismaRiskReduction,
      cleanReturnMultiplier: frontStore.kind
        ? roundCurrency(
            getFrontStoreKindTemplate(frontStore.kind).cleanReturnMultiplier *
              buildCenterLaunderingBonus(frontStore.regionId) *
              regionalDominationBonus.revenueMultiplier *
              regionalDominationBonus.frontStoreLaunderingMultiplier *
              passiveProfile.business.launderingReturnMultiplier,
          )
        : null,
      cycleMinutes: FRONT_STORE_OPERATION_CYCLE_MINUTES,
      effectiveFactionCommissionRate: resolveEffectiveFactionCommissionRate(
        player.factionId,
        propertyDefinition,
      ),
      estimatedHourlyLegitRevenue,
      launderingCapacityPerDay: capacityPerDay,
      launderingCapacityRemaining: remainingCapacity,
      legitRevenuePerCycle,
      locationMultiplier,
      profitable: projectedDailyGrossRevenue > dailyUpkeep,
    },
    favelaId: frontStore.favelaId,
    id: frontStore.id,
    investigation: {
      activeUntil: frontStore.investigationActiveUntil ? frontStore.investigationActiveUntil.toISOString() : null,
      investigationsTotal: frontStore.investigationsTotal,
      isUnderInvestigation: isInvestigated,
      lastInvestigationAt: frontStore.lastInvestigationAt ? frontStore.lastInvestigationAt.toISOString() : null,
    },
    kind: frontStore.kind,
    level: frontStore.level,
    maintenanceStatus: {
      blocked: maintenanceStatus.blocked,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: maintenanceStatus.moneySpentOnSync,
      overdueDays: maintenanceStatus.overdueDays,
    },
    regionId: frontStore.regionId,
    status: maintenanceStatus.blocked
      ? 'maintenance_blocked'
      : isInvestigated
        ? 'investigation_blocked'
        : frontStore.kind
          ? 'active'
          : 'setup_required',
  };
}

function syncFrontStoreMaintenance(
  frontStore: FrontStoreSnapshotRecord,
  workingMoney: number,
  now: Date,
  propertyDefinition: PropertyDefinitionSummary,
  maintenanceMultiplier = 1,
): FrontStoreMaintenanceStatus {
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    frontStore,
    frontStore.operationCostMultiplier,
    maintenanceMultiplier,
  );
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - frontStore.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  if (dueDays <= 0 || dailyUpkeep <= 0) {
    return {
      blocked: frontStore.suspended,
      lastMaintenanceAt: frontStore.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(workingMoney / dailyUpkeep));
  const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
  const overdueDays = dueDays - payableDays;
  const nextLastMaintenanceAt = new Date(
    frontStore.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  return {
    blocked: overdueDays > 0,
    lastMaintenanceAt: nextLastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
  };
}
