import {
  GP_TEMPLATES,
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  PUTEIRO_DST_RECOVERY_CYCLES,
  PUTEIRO_MAX_ACTIVE_GPS,
  PUTEIRO_OPERATION_CYCLE_MINUTES,
  type GpTemplateSummary,
  type GpType,
  type PropertyDefinitionSummary,
  type PuteiroCollectResponse,
  type PuteiroHireInput,
  type PuteiroHireResponse,
  type PuteiroListResponse,
  type PuteiroSummary,
  type RegionId,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionMembers,
  favelas,
  gameEvents,
  players,
  properties,
  puteiroGps,
  puteiroOperations,
  regions,
  soldiers,
  transactions,
} from '../db/schema.js';
import { DomainError, inferDomainErrorCategory } from '../errors/domain-error.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import {
  resolveEconomyPropertyDefinition,
  resolvePropertyEventProfile,
  resolveRegionalEventMultiplier,
  type PropertyEventProfile,
} from './economy-config.js';
import { applyFactionBankDelta, applyPlayerResourceDeltas } from './financial-updates.js';
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
  | 'blitz_pm'
  | 'bonecas_china'
  | 'carnaval'
  | 'faca_na_caveira'
  | 'operacao_policial'
  | 'ressaca_baile';

type GpStatus = 'active' | 'deceased' | 'escaped';

interface PuteiroPlayerRecord {
  carisma: number;
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface PuteiroWorkerRecord {
  dstRecoversAt: Date | null;
  hasDst: boolean;
  id: string;
  lastIncidentAt: Date | null;
  purchasedAt: Date;
  status: GpStatus;
  type: GpType;
}

interface PuteiroSoldierRosterRecord {
  count: number;
  dailyCost: number;
}

interface PuteiroEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface PuteiroSnapshotRecord {
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
  lastRevenueAt: Date;
  level: number;
  operationCostMultiplier: number;
  policePressure: number;
  regionId: RegionId;
  sabotageRecoveryReadyAt: Date | null;
  sabotageResolvedAt: Date | null;
  sabotageState: 'normal' | 'damaged' | 'destroyed';
  soldierRoster: PuteiroSoldierRosterRecord[];
  suspended: boolean;
  totalDeaths: number;
  totalDstIncidents: number;
  totalEscapes: number;
  wealthIndex: number;
  workers: PuteiroWorkerRecord[];
}

interface PuteiroMaintenanceStatus {
  blocked: boolean;
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
}

interface PuteiroStateUpdateInput {
  cashBalance: number;
  factionCommissionDelta: number;
  factionCommissionTotal: number;
  factionId: string | null;
  grossRevenueDelta: number;
  grossRevenueTotal: number;
  lastRevenueAt: Date;
  playerMoneySpentOnMaintenance: number;
  propertyId: string;
  propertyLastMaintenanceAt: Date;
  propertySuspended: boolean;
  totalDeaths: number;
  totalDstIncidents: number;
  totalEscapes: number;
  workerStates: Array<{
    dstRecoversAt: Date | null;
    hasDst: boolean;
    id: string;
    lastIncidentAt: Date | null;
    status: GpStatus;
  }>;
}

interface PuteiroHireRecord {
  hiredWorkers: PuteiroWorkerRecord[];
  playerMoneyAfterPurchase: number;
  totalPurchaseCost: number;
}

interface PuteiroCollectRecord {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

interface PuteiroSyncResult {
  changed: boolean;
  maintenanceStatus: PuteiroMaintenanceStatus;
  nextPlayerMoney: number;
  snapshot: PuteiroSnapshotRecord;
}

export interface PuteiroRepository {
  applyPuteiroState(playerId: string, input: PuteiroStateUpdateInput): Promise<boolean>;
  collectCash(playerId: string, propertyId: string): Promise<PuteiroCollectRecord | null>;
  getPlayer(playerId: string): Promise<PuteiroPlayerRecord | null>;
  getPuteiro(playerId: string, propertyId: string): Promise<PuteiroSnapshotRecord | null>;
  hireGps(
    playerId: string,
    propertyId: string,
    template: GpTemplateSummary,
    quantity: number,
    purchasedAt: Date,
  ): Promise<PuteiroHireRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<PuteiroEventRecord[]>;
  listPuteiros(playerId: string): Promise<PuteiroSnapshotRecord[]>;
}

export interface PuteiroServiceOptions {
  gameConfigService?: GameConfigService;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  random?: () => number;
  repository?: PuteiroRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface PuteiroServiceContract {
  close?(): Promise<void>;
  collectCash(playerId: string, propertyId: string): Promise<PuteiroCollectResponse>;
  hireGps(
    playerId: string,
    propertyId: string,
    input: PuteiroHireInput,
  ): Promise<PuteiroHireResponse>;
  listPuteiros(playerId: string): Promise<PuteiroListResponse>;
}

type PuteiroErrorCode =
  | 'capacity'
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_funds'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export function puteiroError(code: PuteiroErrorCode, message: string): DomainError {
  return new DomainError('puteiro', code, inferDomainErrorCategory(code), message);
}

export class PuteiroError extends DomainError {
  constructor(
    code: PuteiroErrorCode,
    message: string,
  ) {
    super('puteiro', code, inferDomainErrorCategory(code), message);
    this.name = 'PuteiroError';
  }
}

export class DatabasePuteiroRepository implements PuteiroRepository {
  async applyPuteiroState(playerId: string, input: PuteiroStateUpdateInput): Promise<boolean> {
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
            eq(properties.type, 'puteiro'),
          ),
        )
        .limit(1);

      if (!property) {
        return false;
      }

      if (input.playerMoneySpentOnMaintenance > 0) {
        const balanceMutation = await applyPlayerResourceDeltas(tx, playerId, {
          moneyDelta: -input.playerMoneySpentOnMaintenance,
        });

        if (balanceMutation.status !== 'updated') {
          return false;
        }
      }

      if (input.factionCommissionDelta > 0 && input.factionId) {
        const pointsDelta = calculateFactionPointsDelta(input.factionCommissionDelta);
        const factionMutation = await applyFactionBankDelta(tx, input.factionId, {
          bankMoneyDelta: input.factionCommissionDelta,
          pointsDelta,
        });

        if (factionMutation.status === 'updated') {
          await insertFactionBankLedgerEntry(tx, {
            balanceAfter: factionMutation.faction.bankMoney,
            commissionAmount: input.factionCommissionDelta,
            createdAt: input.lastRevenueAt,
            description: 'Comissao automatica recebida de um puteiro de membro.',
            entryType: 'business_commission',
            factionId: input.factionId,
            grossAmount: input.grossRevenueDelta,
            netAmount: roundCurrency(input.grossRevenueDelta - input.factionCommissionDelta),
            originType: 'puteiro',
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
          propertyId: puteiroOperations.propertyId,
        })
        .from(puteiroOperations)
        .where(eq(puteiroOperations.propertyId, input.propertyId))
        .limit(1);

      if (existingOperation) {
        await tx
          .update(puteiroOperations)
          .set({
            cashBalance: input.cashBalance.toFixed(2),
            factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
            grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
            lastRevenueAt: input.lastRevenueAt,
            totalDeaths: input.totalDeaths,
            totalDstIncidents: input.totalDstIncidents,
            totalEscapes: input.totalEscapes,
          })
          .where(eq(puteiroOperations.propertyId, input.propertyId));
      } else {
        await tx.insert(puteiroOperations).values({
          cashBalance: input.cashBalance.toFixed(2),
          factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
          grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
          lastRevenueAt: input.lastRevenueAt,
          propertyId: input.propertyId,
          totalDeaths: input.totalDeaths,
          totalDstIncidents: input.totalDstIncidents,
          totalEscapes: input.totalEscapes,
        });
      }

      for (const workerState of input.workerStates) {
        await tx
          .update(puteiroGps)
          .set({
            dstRecoversAt: workerState.dstRecoversAt,
            hasDst: workerState.hasDst,
            lastIncidentAt: workerState.lastIncidentAt,
            status: workerState.status,
          })
          .where(
            and(
              eq(puteiroGps.id, workerState.id),
              eq(puteiroGps.propertyId, input.propertyId),
            ),
          );
      }

      return true;
    });
  }

  async collectCash(playerId: string, propertyId: string): Promise<PuteiroCollectRecord | null> {
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
            eq(properties.type, 'puteiro'),
          ),
        )
        .limit(1);

      if (!property) {
        return null;
      }

      const lockedOperation = await tx.execute(sql<{ cashBalance: string }>`
        select ${puteiroOperations.cashBalance} as "cashBalance"
        from ${puteiroOperations}
        where ${puteiroOperations.propertyId} = ${propertyId}
        for update
      `);
      const drainedOperation = lockedOperation.rows[0];

      if (!drainedOperation) {
        return null;
      }

      const collectedAmount = roundCurrency(Number.parseFloat(String(drainedOperation.cashBalance)));

      if (collectedAmount <= 0) {
        return null;
      }

      const collectedAt = new Date();

      await tx
        .update(puteiroOperations)
        .set({
          cashBalance: '0.00',
          lastCollectedAt: collectedAt,
        })
        .where(eq(puteiroOperations.propertyId, propertyId));

      const balanceMutation = await applyPlayerResourceDeltas(tx, playerId, {
        moneyDelta: collectedAmount,
      });

      if (balanceMutation.status !== 'updated') {
        return null;
      }

      await tx.insert(transactions).values({
        amount: collectedAmount.toFixed(2),
        description: `Coleta de caixa do puteiro ${propertyId}`,
        playerId,
        type: 'puteiro_collect',
      });

      return {
        collectedAmount,
        playerMoneyAfterCollect: balanceMutation.player.money,
      };
    });
  }

  async getPlayer(playerId: string): Promise<PuteiroPlayerRecord | null> {
    const [player] = await db
      .select({
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
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      factionId: membership?.factionId ?? player.factionId ?? null,
      id: player.id,
      money: roundCurrency(Number.parseFloat(String(player.money))),
    };
  }

  async getPuteiro(playerId: string, propertyId: string): Promise<PuteiroSnapshotRecord | null> {
    const puteiros = await this.listPuteiros(playerId);
    return puteiros.find((entry) => entry.id === propertyId) ?? null;
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

  async hireGps(
    playerId: string,
    propertyId: string,
    template: GpTemplateSummary,
    quantity: number,
    purchasedAt: Date,
  ): Promise<PuteiroHireRecord | null> {
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
            eq(properties.type, 'puteiro'),
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

      const totalPurchaseCost = roundCurrency(template.purchasePrice * quantity);
      const balanceMutation = await applyPlayerResourceDeltas(tx, playerId, {
        moneyDelta: -totalPurchaseCost,
      });

      if (balanceMutation.status !== 'updated') {
        return null;
      }

      const insertedWorkers = await tx
        .insert(puteiroGps)
        .values(
          Array.from({ length: quantity }, () => ({
            dstRecoversAt: null,
            hasDst: false,
            lastIncidentAt: null,
            propertyId,
            purchasedAt,
            status: 'active' as const,
            type: template.type,
          })),
        )
        .returning({
          dstRecoversAt: puteiroGps.dstRecoversAt,
          hasDst: puteiroGps.hasDst,
          id: puteiroGps.id,
          lastIncidentAt: puteiroGps.lastIncidentAt,
          purchasedAt: puteiroGps.purchasedAt,
          status: puteiroGps.status,
          type: puteiroGps.type,
        });

      await tx.insert(transactions).values({
        amount: totalPurchaseCost.toFixed(2),
        description: `Compra de ${quantity} GP(s) ${template.label} para o puteiro ${propertyId}`,
        playerId,
        type: 'puteiro_hire_gp',
      });

      return {
        hiredWorkers: insertedWorkers.map((worker) => ({
          dstRecoversAt: worker.dstRecoversAt,
          hasDst: worker.hasDst,
          id: worker.id,
          lastIncidentAt: worker.lastIncidentAt,
          purchasedAt: worker.purchasedAt,
          status: worker.status,
          type: worker.type,
        })),
        playerMoneyAfterPurchase: balanceMutation.player.money,
        totalPurchaseCost,
      };
    });
  }

  async listActiveEvents(regionId: RegionId, now: Date): Promise<PuteiroEventRecord[]> {
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
      (row): row is PuteiroEventRecord =>
        row.eventType === 'ano_novo_copa' ||
        row.eventType === 'blitz_pm' ||
        row.eventType === 'bonecas_china' ||
        row.eventType === 'carnaval' ||
        row.eventType === 'faca_na_caveira' ||
        row.eventType === 'operacao_policial' ||
        row.eventType === 'ressaca_baile',
    );
  }

  async listPuteiros(playerId: string): Promise<PuteiroSnapshotRecord[]> {
    const propertyRows = await db
      .select({
        cashBalance: puteiroOperations.cashBalance,
        createdAt: properties.createdAt,
        densityIndex: regions.densityIndex,
        factionCommissionTotal: puteiroOperations.factionCommissionTotal,
        favelaId: properties.favelaId,
        favelaPopulation: favelas.population,
        grossRevenueTotal: puteiroOperations.grossRevenueTotal,
        id: properties.id,
        lastCollectedAt: puteiroOperations.lastCollectedAt,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        lastRevenueAt: puteiroOperations.lastRevenueAt,
        level: properties.level,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        regionId: properties.regionId,
        sabotageRecoveryReadyAt: properties.sabotageRecoveryReadyAt,
        sabotageResolvedAt: properties.sabotageResolvedAt,
        sabotageState: properties.sabotageState,
        suspended: properties.suspended,
        totalDeaths: puteiroOperations.totalDeaths,
        totalDstIncidents: puteiroOperations.totalDstIncidents,
        totalEscapes: puteiroOperations.totalEscapes,
        wealthIndex: regions.wealthIndex,
      })
      .from(properties)
      .innerJoin(regions, eq(regions.id, properties.regionId))
      .leftJoin(favelas, eq(favelas.id, properties.favelaId))
      .leftJoin(puteiroOperations, eq(puteiroOperations.propertyId, properties.id))
      .where(
        and(
          eq(properties.playerId, playerId),
          eq(properties.type, 'puteiro'),
        ),
      );

    if (propertyRows.length === 0) {
      return [];
    }

    const propertyIds = propertyRows.map((row) => row.id);
    const workerRows = await db
      .select({
        dstRecoversAt: puteiroGps.dstRecoversAt,
        hasDst: puteiroGps.hasDst,
        id: puteiroGps.id,
        lastIncidentAt: puteiroGps.lastIncidentAt,
        propertyId: puteiroGps.propertyId,
        purchasedAt: puteiroGps.purchasedAt,
        status: puteiroGps.status,
        type: puteiroGps.type,
      })
      .from(puteiroGps)
      .where(inArray(puteiroGps.propertyId, propertyIds));
    const soldierRows = await db
      .select({
        dailyCost: soldiers.dailyCost,
        propertyId: soldiers.propertyId,
      })
      .from(soldiers)
      .where(inArray(soldiers.propertyId, propertyIds));
    const workersByPropertyId = new Map<string, PuteiroWorkerRecord[]>();
    const soldiersByPropertyId = new Map<string, PuteiroSoldierRosterRecord>();

    for (const workerRow of workerRows) {
      const current = workersByPropertyId.get(workerRow.propertyId) ?? [];
      current.push({
        dstRecoversAt: workerRow.dstRecoversAt,
        hasDst: workerRow.hasDst,
        id: workerRow.id,
        lastIncidentAt: workerRow.lastIncidentAt,
        purchasedAt: workerRow.purchasedAt,
        status: workerRow.status,
        type: workerRow.type,
      });
      workersByPropertyId.set(workerRow.propertyId, current);
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

    return propertyRows.map((row) => ({
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
      lastRevenueAt: row.lastRevenueAt ?? row.createdAt,
      level: row.level,
      operationCostMultiplier: roundCurrency(Number.parseFloat(String(row.operationCostMultiplier))),
      policePressure: row.policePressure,
      regionId: row.regionId as RegionId,
      sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
      sabotageResolvedAt: row.sabotageResolvedAt,
      sabotageState: row.sabotageState,
      soldierRoster: soldiersByPropertyId.get(row.id)
        ? [soldiersByPropertyId.get(row.id) as PuteiroSoldierRosterRecord]
        : [],
      suspended: row.suspended,
      totalDeaths: row.totalDeaths ?? 0,
      totalDstIncidents: row.totalDstIncidents ?? 0,
      totalEscapes: row.totalEscapes ?? 0,
      wealthIndex: row.wealthIndex,
      workers: [...(workersByPropertyId.get(row.id) ?? [])].sort((left, right) =>
        getGpTemplate(left.type).label.localeCompare(getGpTemplate(right.type).label, 'pt-BR'),
      ),
    }));
  }
}

export class PuteiroService implements PuteiroServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly random: () => number;

  private readonly repository: PuteiroRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: PuteiroServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabasePuteiroRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async collectCash(playerId: string, propertyId: string): Promise<PuteiroCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncPuteiro(player, propertyId, passiveProfile);

    if (synced.snapshot.cashBalance <= 0) {
      throw new PuteiroError('conflict', 'Este puteiro nao possui caixa disponivel para coleta.');
    }

    const collected = await this.repository.collectCash(playerId, propertyId);

    if (!collected) {
      throw new PuteiroError('not_found', 'Puteiro nao encontrado para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const puteiro = await this.listSinglePuteiro(playerId, propertyId);

    return {
      collectedAmount: collected.collectedAmount,
      playerMoneyAfterCollect: collected.playerMoneyAfterCollect,
      puteiro,
    };
  }

  async hireGps(
    playerId: string,
    propertyId: string,
    input: PuteiroHireInput,
  ): Promise<PuteiroHireResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new PuteiroError('validation', 'Quantidade de GPs deve ser um inteiro maior ou igual a 1.');
    }

    const template = GP_TEMPLATES.find((entry) => entry.type === input.type);

    if (!template) {
      throw new PuteiroError('validation', 'Tipo de GP invalido.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncPuteiro(player, propertyId, passiveProfile);
    const activeWorkers = synced.snapshot.workers.filter((worker) => worker.status === 'active');

    if (activeWorkers.length + input.quantity > PUTEIRO_MAX_ACTIVE_GPS) {
      throw new PuteiroError(
        'capacity',
        `Este puteiro suporta no maximo ${PUTEIRO_MAX_ACTIVE_GPS} GPs ativas ao mesmo tempo.`,
      );
    }

    const totalPurchaseCost = roundCurrency(template.purchasePrice * input.quantity);

    if (synced.nextPlayerMoney < totalPurchaseCost) {
      throw new PuteiroError('insufficient_funds', 'Dinheiro insuficiente para contratar essas GPs.');
    }

    const hired = await this.repository.hireGps(playerId, propertyId, template, input.quantity, this.now());

    if (!hired) {
      throw new PuteiroError('not_found', 'Puteiro nao encontrado para contratacao.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const puteiro = await this.listSinglePuteiro(playerId, propertyId);
    const hiredIds = new Set(hired.hiredWorkers.map((worker) => worker.id));
    const hiredGps = puteiro.roster.filter((worker) => hiredIds.has(worker.id));

    return {
      hiredGps,
      playerMoneyAfterPurchase: hired.playerMoneyAfterPurchase,
      puteiro,
      totalPurchaseCost: hired.totalPurchaseCost,
    };
  }

  async listPuteiros(playerId: string): Promise<PuteiroListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [configCatalog, passiveProfile, puteiros, favelasList] = await Promise.all([
      this.gameConfigService.getResolvedCatalog(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listPuteiros(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    let workingPlayer = player;
    let changed = false;
    const eventCache = new Map<RegionId, PuteiroEventRecord[]>();
    const summaries: PuteiroSummary[] = [];

    for (const puteiro of [...puteiros].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      let events = eventCache.get(puteiro.regionId);

      if (!events) {
        events = await this.repository.listActiveEvents(puteiro.regionId, this.now());
        eventCache.set(puteiro.regionId, events);
      }

      const regionalDominationBonus =
        regionalDominationByRegion.get(puteiro.regionId) ??
        buildInactiveRegionalDominationBonus(puteiro.regionId);
      const synced = await this.syncPuteiroRecord(
        workingPlayer,
        puteiro,
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
        serializePuteiroSummary(
          synced.snapshot,
          workingPlayer,
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
      puteiros: summaries,
      templates: [...GP_TEMPLATES],
    };
  }

  private async listSinglePuteiro(playerId: string, propertyId: string): Promise<PuteiroSummary> {
    const summary = await this.listPuteiros(playerId);
    const puteiro = summary.puteiros.find((entry) => entry.id === propertyId);

    if (!puteiro) {
      throw new PuteiroError('not_found', 'Puteiro nao encontrado apos a atualizacao.');
    }

    return puteiro;
  }

  private async requireReadyPlayer(playerId: string): Promise<PuteiroPlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new PuteiroError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new PuteiroError('character_not_ready', 'Crie seu personagem antes de gerenciar puteiros.');
    }

    return player;
  }

  private async syncPuteiro(
    player: PuteiroPlayerRecord,
    propertyId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<PuteiroSyncResult> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const puteiro = await this.repository.getPuteiro(player.id, propertyId);

    if (!puteiro) {
      throw new PuteiroError('not_found', 'Puteiro nao encontrado.');
    }

    const events = await this.repository.listActiveEvents(puteiro.regionId, this.now());
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(puteiro.regionId) ??
      buildInactiveRegionalDominationBonus(puteiro.regionId);
    return this.syncPuteiroRecord(
      player,
      puteiro,
      events,
      passiveProfile,
      regionalDominationBonus,
      configCatalog,
    );
  }

  private async syncPuteiroRecord(
    player: PuteiroPlayerRecord,
    puteiro: PuteiroSnapshotRecord,
    events: PuteiroEventRecord[],
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
    configCatalog: ResolvedGameConfigCatalog,
  ): Promise<PuteiroSyncResult> {
    const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'puteiro');
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'puteiro');
    const maintenanceStatus = syncPuteiroMaintenance(
      puteiro,
      player.money,
      this.now(),
      propertyDefinition,
      passiveProfile.business.propertyMaintenanceMultiplier *
        regionalDominationBonus.maintenanceMultiplier,
    );
    const propertyAfterMaintenance: PuteiroSnapshotRecord = {
      ...puteiro,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt,
      suspended: maintenanceStatus.blocked,
      workers: puteiro.workers.map((worker) => ({ ...worker })),
    };
    const sabotageStatus = buildPropertySabotageStatusSummary({
      now: this.now(),
      sabotageRecoveryReadyAt: propertyAfterMaintenance.sabotageRecoveryReadyAt,
      sabotageResolvedAt: propertyAfterMaintenance.sabotageResolvedAt,
      sabotageState: propertyAfterMaintenance.sabotageState,
      type: 'puteiro',
    });
    const cycleMs = PUTEIRO_OPERATION_CYCLE_MINUTES * 60 * 1000;
    const elapsedCycles = Math.floor(
      Math.max(0, this.now().getTime() - propertyAfterMaintenance.lastRevenueAt.getTime()) / cycleMs,
    );
    const processedUntil = new Date(
      propertyAfterMaintenance.lastRevenueAt.getTime() + elapsedCycles * cycleMs,
    );
    let cashBalance = propertyAfterMaintenance.cashBalance;
    let grossRevenueTotal = propertyAfterMaintenance.grossRevenueTotal;
    let factionCommissionTotal = propertyAfterMaintenance.factionCommissionTotal;
    let factionCommissionDelta = 0;
    let grossRevenueDelta = 0;
    let totalEscapes = propertyAfterMaintenance.totalEscapes;
    let totalDeaths = propertyAfterMaintenance.totalDeaths;
    let totalDstIncidents = propertyAfterMaintenance.totalDstIncidents;
    const effectiveFactionCommissionRate = resolveEffectiveFactionCommissionRate(
      player.factionId,
      propertyDefinition,
    );
    const nextWorkers = propertyAfterMaintenance.workers.map((worker) => ({ ...worker }));
    let workersRecovered = normalizeWorkerDstRecovery(nextWorkers, this.now());

    if (elapsedCycles > 0 && !propertyAfterMaintenance.suspended && !sabotageStatus.blocked) {
      for (let cycleIndex = 0; cycleIndex < elapsedCycles; cycleIndex += 1) {
        const cycleTime = new Date(
          propertyAfterMaintenance.lastRevenueAt.getTime() + (cycleIndex + 1) * cycleMs,
        );

        workersRecovered ||= normalizeWorkerDstRecovery(nextWorkers, cycleTime);

        for (const worker of nextWorkers) {
          if (worker.status !== 'active' || worker.purchasedAt.getTime() > cycleTime.getTime()) {
            continue;
          }

          const escapeChance = buildEscapeChancePerCycle(
            propertyAfterMaintenance,
            worker,
            player,
            events,
            eventProfile,
          );

          if (this.random() < escapeChance) {
            worker.dstRecoversAt = null;
            worker.hasDst = false;
            worker.lastIncidentAt = cycleTime;
            worker.status = 'escaped';
            totalEscapes += 1;
            continue;
          }

          const deathChance = buildDeathChancePerCycle(
            propertyAfterMaintenance,
            worker,
            player,
            events,
            eventProfile,
          );

          if (this.random() < deathChance) {
            worker.dstRecoversAt = null;
            worker.hasDst = false;
            worker.lastIncidentAt = cycleTime;
            worker.status = 'deceased';
            totalDeaths += 1;
            continue;
          }

          if (!worker.hasDst) {
            const dstChance = buildDstChancePerCycle(
              propertyAfterMaintenance,
              worker,
              player,
              events,
              eventProfile,
            );

            if (this.random() < dstChance) {
              worker.hasDst = true;
              worker.dstRecoversAt = new Date(cycleTime.getTime() + PUTEIRO_DST_RECOVERY_CYCLES * cycleMs);
              worker.lastIncidentAt = cycleTime;
              totalDstIncidents += 1;
            }
          }

          const grossRevenue = roundCurrency(
            buildGpGrossRevenuePerCycle(
            propertyAfterMaintenance,
            worker,
            player,
            events,
            passiveProfile,
            regionalDominationBonus,
            eventProfile,
          ) * sabotageStatus.operationalMultiplier,
          );

          if (grossRevenue <= 0) {
            continue;
          }

          const commissionAmount = roundCurrency(grossRevenue * effectiveFactionCommissionRate);
          const netRevenue = roundCurrency(grossRevenue - commissionAmount);

          cashBalance = roundCurrency(cashBalance + netRevenue);
          grossRevenueDelta = roundCurrency(grossRevenueDelta + grossRevenue);
          grossRevenueTotal = roundCurrency(grossRevenueTotal + grossRevenue);
          factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
          factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
        }
      }
    }

    const nextSnapshot: PuteiroSnapshotRecord = {
      ...propertyAfterMaintenance,
      cashBalance,
      factionCommissionTotal,
      grossRevenueTotal,
      lastRevenueAt: elapsedCycles > 0 ? processedUntil : propertyAfterMaintenance.lastRevenueAt,
      totalDeaths,
      totalDstIncidents,
      totalEscapes,
      workers: nextWorkers,
    };
    const changed =
      workersRecovered ||
      maintenanceStatus.moneySpentOnSync > 0 ||
      maintenanceStatus.overdueDays > 0 !== puteiro.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== puteiro.lastMaintenanceAt.getTime() ||
      nextSnapshot.lastRevenueAt.getTime() !== puteiro.lastRevenueAt.getTime() ||
      nextSnapshot.cashBalance !== puteiro.cashBalance ||
      nextSnapshot.grossRevenueTotal !== puteiro.grossRevenueTotal ||
      nextSnapshot.factionCommissionTotal !== puteiro.factionCommissionTotal ||
      nextSnapshot.totalEscapes !== puteiro.totalEscapes ||
      nextSnapshot.totalDeaths !== puteiro.totalDeaths ||
      nextSnapshot.totalDstIncidents !== puteiro.totalDstIncidents ||
      haveWorkersChanged(puteiro.workers, nextSnapshot.workers);

    if (changed) {
      const applied = await this.repository.applyPuteiroState(player.id, {
        cashBalance: nextSnapshot.cashBalance,
        factionCommissionDelta,
        factionCommissionTotal: nextSnapshot.factionCommissionTotal,
        factionId: player.factionId,
        grossRevenueDelta,
        grossRevenueTotal: nextSnapshot.grossRevenueTotal,
        lastRevenueAt: nextSnapshot.lastRevenueAt,
        playerMoneySpentOnMaintenance: maintenanceStatus.moneySpentOnSync,
        propertyId: nextSnapshot.id,
        propertyLastMaintenanceAt: nextSnapshot.lastMaintenanceAt,
        propertySuspended: nextSnapshot.suspended,
        totalDeaths: nextSnapshot.totalDeaths,
        totalDstIncidents: nextSnapshot.totalDstIncidents,
        totalEscapes: nextSnapshot.totalEscapes,
        workerStates: nextSnapshot.workers.map((worker) => ({
          dstRecoversAt: worker.dstRecoversAt,
          hasDst: worker.hasDst,
          id: worker.id,
          lastIncidentAt: worker.lastIncidentAt,
          status: worker.status,
        })),
      });

      if (!applied) {
        throw new PuteiroError('not_found', 'Falha ao sincronizar a operacao do puteiro.');
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

function buildPuteiroCharismaMultiplier(
  player: Pick<PuteiroPlayerRecord, 'carisma'>,
  puteiro: Pick<PuteiroSnapshotRecord, 'level'>,
): number {
  return clampMultiplier(0.9 + player.carisma / 100 + puteiro.level * 0.04, 1, 2.4);
}

function buildPuteiroLocationMultiplier(
  puteiro: Pick<
    PuteiroSnapshotRecord,
    'densityIndex' | 'favelaPopulation' | 'level' | 'policePressure' | 'wealthIndex'
  >,
): number {
  const rawValue =
    0.88 +
    puteiro.wealthIndex / 150 +
    puteiro.densityIndex / 360 +
    (puteiro.favelaPopulation ?? 0) / 400_000 +
    puteiro.level * 0.05 -
    puteiro.policePressure / 850;

  return clampMultiplier(rawValue, 0.95, 2.5);
}

function buildGpGrossRevenuePerCycle(
  puteiro: PuteiroSnapshotRecord,
  worker: PuteiroWorkerRecord,
  player: PuteiroPlayerRecord,
  events: PuteiroEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  eventProfile: PropertyEventProfile,
): number {
  if (worker.status !== 'active') {
    return 0;
  }

  const template = getGpTemplate(worker.type);
  const cyclesPerDay = (24 * 60) / PUTEIRO_OPERATION_CYCLE_MINUTES;
  const baseCycleRevenue = template.baseDailyRevenue / cyclesPerDay;
  const charismaMultiplier = buildPuteiroCharismaMultiplier(player, puteiro);
  const locationMultiplier = buildPuteiroLocationMultiplier(puteiro);
  const healthMultiplier = worker.hasDst ? 0.78 : 1;
  const eventMultiplier = resolvePuteiroRevenueEventMultiplier(events, puteiro.regionId, eventProfile);

  return roundCurrency(
    baseCycleRevenue *
      charismaMultiplier *
      locationMultiplier *
      healthMultiplier *
      eventMultiplier *
      regionalDominationBonus.revenueMultiplier *
      passiveProfile.business.gpRevenueMultiplier *
      passiveProfile.business.passiveRevenueMultiplier,
  );
}

function buildEscapeChancePerCycle(
  puteiro: PuteiroSnapshotRecord,
  worker: PuteiroWorkerRecord,
  player: PuteiroPlayerRecord,
  events: PuteiroEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const baseChanceByType: Record<GpType, number> = {
    diamante: 0.0008,
    experiente: 0.0022,
    novinha: 0.003,
    premium: 0.0016,
    vip: 0.0011,
  };

  return roundChance(
      baseChanceByType[worker.type] *
      buildIncidentProtectionModifier(puteiro, player) *
      resolvePuteiroRiskEventMultiplier(events, puteiro.regionId, eventProfile).escape,
  );
}

function buildDeathChancePerCycle(
  puteiro: PuteiroSnapshotRecord,
  worker: PuteiroWorkerRecord,
  player: PuteiroPlayerRecord,
  events: PuteiroEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const baseChanceByType: Record<GpType, number> = {
    diamante: 0.0002,
    experiente: 0.0005,
    novinha: 0.0007,
    premium: 0.00035,
    vip: 0.00025,
  };

  return roundChance(
      baseChanceByType[worker.type] *
      buildIncidentProtectionModifier(puteiro, player) *
      resolvePuteiroRiskEventMultiplier(events, puteiro.regionId, eventProfile).death,
  );
}

function buildDstChancePerCycle(
  puteiro: PuteiroSnapshotRecord,
  worker: PuteiroWorkerRecord,
  player: PuteiroPlayerRecord,
  events: PuteiroEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const baseChanceByType: Record<GpType, number> = {
    diamante: 0.0025,
    experiente: 0.004,
    novinha: 0.0045,
    premium: 0.0035,
    vip: 0.003,
  };

  const charismaMitigation = clampMultiplier(1.06 - player.carisma / 420, 0.55, 1.05);

  return roundChance(
      baseChanceByType[worker.type] *
      charismaMitigation *
      resolvePuteiroRiskEventMultiplier(events, puteiro.regionId, eventProfile).dst,
  );
}

function buildIncidentProtectionModifier(
  puteiro: Pick<PuteiroSnapshotRecord, 'level' | 'soldierRoster'>,
  player: Pick<PuteiroPlayerRecord, 'carisma' | 'factionId'>,
): number {
  const soldierCount = puteiro.soldierRoster.reduce((total, roster) => total + roster.count, 0);
  const protectionScore =
    Math.min(0.3, soldierCount * 0.03) +
    Math.min(0.14, puteiro.level * 0.04) +
    Math.min(0.12, player.carisma / 300) +
    (player.factionId ? 0.08 : 0);

  return clampMultiplier(1 - protectionScore, 0.45, 1.05);
}

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundChance(value: number): number {
  return Math.round(clampMultiplier(value, 0, 0.95) * 10000) / 10000;
}

function getGpTemplate(type: GpType): GpTemplateSummary {
  const template = GP_TEMPLATES.find((entry) => entry.type === type);

  if (!template) {
    throw new Error(`Template de GP inexistente: ${type}`);
  }

  return template;
}

function haveWorkersChanged(previous: PuteiroWorkerRecord[], next: PuteiroWorkerRecord[]): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  const nextMap = new Map(next.map((worker) => [worker.id, worker]));

  return previous.some((worker) => {
    const nextWorker = nextMap.get(worker.id);
    return (
      !nextWorker ||
      nextWorker.status !== worker.status ||
      nextWorker.hasDst !== worker.hasDst ||
      nextWorker.dstRecoversAt?.getTime() !== worker.dstRecoversAt?.getTime() ||
      nextWorker.lastIncidentAt?.getTime() !== worker.lastIncidentAt?.getTime()
    );
  });
}

function normalizeWorkerDstRecovery(workers: PuteiroWorkerRecord[], now: Date): boolean {
  let changed = false;

  for (const worker of workers) {
    if (worker.hasDst && worker.dstRecoversAt && worker.dstRecoversAt.getTime() <= now.getTime()) {
      worker.dstRecoversAt = null;
      worker.hasDst = false;
      changed = true;
    }
  }

  return changed;
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

function resolvePuteiroRevenueEventMultiplier(
  events: PuteiroEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  const multiplier = resolveRegionalEventMultiplier(events, regionId, eventProfile.revenueMultipliers);
  const clampProfile = eventProfile.clamps?.revenue;
  return clampMultiplier(multiplier, clampProfile?.min ?? 0.35, clampProfile?.max ?? 4.5);
}

function resolvePuteiroRiskEventMultiplier(
  events: PuteiroEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): {
  death: number;
  dst: number;
  escape: number;
} {
  const escape = resolveRegionalEventMultiplier(
    events,
    regionId,
    eventProfile.riskEscapeMultipliers,
  );
  const death = resolveRegionalEventMultiplier(
    events,
    regionId,
    eventProfile.riskDeathMultipliers,
  );
  const dst = resolveRegionalEventMultiplier(
    events,
    regionId,
    eventProfile.riskDstMultipliers,
  );
  const escapeClamp = eventProfile.clamps?.riskEscape;
  const deathClamp = eventProfile.clamps?.riskDeath;
  const dstClamp = eventProfile.clamps?.riskDst;

  return {
    death: clampMultiplier(death, deathClamp?.min ?? 0.5, deathClamp?.max ?? 2),
    dst: clampMultiplier(dst, dstClamp?.min ?? 0.5, dstClamp?.max ?? 2.5),
    escape: clampMultiplier(escape, escapeClamp?.min ?? 0.5, escapeClamp?.max ?? 2),
  };
}

function serializePuteiroSummary(
  puteiro: PuteiroSnapshotRecord,
  player: PuteiroPlayerRecord,
  maintenanceStatus: PuteiroMaintenanceStatus,
  events: PuteiroEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  configCatalog: ResolvedGameConfigCatalog,
): PuteiroSummary {
  const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'puteiro');
  const eventProfile = resolvePropertyEventProfile(configCatalog, 'puteiro');
  const sabotageStatus = buildPropertySabotageStatusSummary({
    now: new Date(),
    sabotageRecoveryReadyAt: puteiro.sabotageRecoveryReadyAt,
    sabotageResolvedAt: puteiro.sabotageResolvedAt,
    sabotageState: puteiro.sabotageState,
    type: 'puteiro',
  });
  const locationMultiplier = buildPuteiroLocationMultiplier(puteiro);
  const charismaMultiplier = buildPuteiroCharismaMultiplier(player, puteiro);
  const roster = [...puteiro.workers]
    .sort((left, right) => {
      const leftPriority = left.status === 'active' ? 0 : left.status === 'escaped' ? 1 : 2;
      const rightPriority = right.status === 'active' ? 0 : right.status === 'escaped' ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return getGpTemplate(left.type).label.localeCompare(getGpTemplate(right.type).label, 'pt-BR');
    })
    .map((worker) => {
      const template = getGpTemplate(worker.type);

      return {
        baseDailyRevenue: template.baseDailyRevenue,
        dstRecoversAt: worker.dstRecoversAt ? worker.dstRecoversAt.toISOString() : null,
        hasDst: worker.hasDst,
        hourlyGrossRevenueEstimate:
          worker.status === 'active'
            ? roundCurrency(
                buildGpGrossRevenuePerCycle(
                  puteiro,
                  worker,
                player,
                events,
                passiveProfile,
                regionalDominationBonus,
                eventProfile,
              ) *
                  (60 / PUTEIRO_OPERATION_CYCLE_MINUTES),
              )
            : 0,
        id: worker.id,
        incidentRisk:
          worker.status === 'active'
            ? {
                deathChancePerCycle: buildDeathChancePerCycle(
                  puteiro,
                  worker,
                  player,
                  events,
                  eventProfile,
                ),
                dstChancePerCycle: worker.hasDst
                  ? 0
                  : buildDstChancePerCycle(puteiro, worker, player, events, eventProfile),
                escapeChancePerCycle: buildEscapeChancePerCycle(
                  puteiro,
                  worker,
                  player,
                  events,
                  eventProfile,
                ),
              }
            : {
                deathChancePerCycle: 0,
                dstChancePerCycle: 0,
                escapeChancePerCycle: 0,
              },
        label: template.label,
        lastIncidentAt: worker.lastIncidentAt ? worker.lastIncidentAt.toISOString() : null,
        purchasePrice: template.purchasePrice,
        cansacoRestorePercent: template.cansacoRestorePercent,
        status: worker.status,
        type: worker.type,
      };
    });
  const activeWorkers = roster.filter((worker) => worker.status === 'active');
  const estimatedHourlyGrossRevenue = roundCurrency(
    activeWorkers.reduce((total, worker) => total + worker.hourlyGrossRevenueEstimate, 0) *
      sabotageStatus.operationalMultiplier,
  );
  const projectedDailyGrossRevenue = roundCurrency(estimatedHourlyGrossRevenue * 24);
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    puteiro,
    puteiro.operationCostMultiplier,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );

  return {
    cashbox: {
      availableToCollect: puteiro.cashBalance,
      grossRevenueLifetime: puteiro.grossRevenueTotal,
      lastCollectedAt: puteiro.lastCollectedAt ? puteiro.lastCollectedAt.toISOString() : null,
      lastRevenueAt: puteiro.lastRevenueAt.toISOString(),
      totalFactionCommission: puteiro.factionCommissionTotal,
    },
    economics: {
      activeGps: activeWorkers.length,
      availableSlots: Math.max(0, PUTEIRO_MAX_ACTIVE_GPS - activeWorkers.length),
      capacity: PUTEIRO_MAX_ACTIVE_GPS,
      charismaMultiplier,
      cycleMinutes: PUTEIRO_OPERATION_CYCLE_MINUTES,
      effectiveFactionCommissionRate: resolveEffectiveFactionCommissionRate(
        player.factionId,
        propertyDefinition,
      ),
      estimatedHourlyGrossRevenue,
      locationMultiplier,
      profitable: projectedDailyGrossRevenue > dailyUpkeep,
    },
    favelaId: puteiro.favelaId,
    id: puteiro.id,
    incidents: {
      activeDstCases: activeWorkers.filter((worker) => worker.hasDst).length,
      totalDeaths: puteiro.totalDeaths,
      totalDstIncidents: puteiro.totalDstIncidents,
      totalEscapes: puteiro.totalEscapes,
    },
    level: puteiro.level,
    maintenanceStatus: {
      blocked: maintenanceStatus.blocked,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: maintenanceStatus.moneySpentOnSync,
      overdueDays: maintenanceStatus.overdueDays,
    },
    regionId: puteiro.regionId,
    roster,
    sabotageStatus,
    status: sabotageStatus.blocked
      ? 'sabotage_blocked'
      : maintenanceStatus.blocked
        ? 'maintenance_blocked'
      : activeWorkers.length > 0
        ? 'active'
        : 'no_gps',
  };
}

function syncPuteiroMaintenance(
  puteiro: PuteiroSnapshotRecord,
  workingMoney: number,
  now: Date,
  propertyDefinition: PropertyDefinitionSummary,
  maintenanceMultiplier = 1,
): PuteiroMaintenanceStatus {
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    puteiro,
    puteiro.operationCostMultiplier,
    maintenanceMultiplier,
  );
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - puteiro.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  if (dueDays <= 0 || dailyUpkeep <= 0) {
    return {
      blocked: puteiro.suspended,
      lastMaintenanceAt: puteiro.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(workingMoney / dailyUpkeep));
  const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
  const overdueDays = dueDays - payableDays;
  const nextLastMaintenanceAt = new Date(
    puteiro.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  return {
    blocked: overdueDays > 0,
    lastMaintenanceAt: nextLastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
  };
}
