import {
  PROPERTY_MAINTENANCE_INTERVAL_MS,
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  SLOT_MACHINE_INSTALL_COST,
  SLOT_MACHINE_MAX_BET,
  SLOT_MACHINE_MAX_HOUSE_EDGE,
  SLOT_MACHINE_MAX_JACKPOT_CHANCE,
  SLOT_MACHINE_MIN_BET,
  SLOT_MACHINE_MIN_HOUSE_EDGE,
  SLOT_MACHINE_MIN_JACKPOT_CHANCE,
  SLOT_MACHINE_OPERATION_CYCLE_MINUTES,
  type PropertyDefinitionSummary,
  type RegionId,
  type ResolvedGameConfigCatalog,
  type SlotMachineCollectResponse,
  type SlotMachineConfigureInput,
  type SlotMachineConfigureResponse,
  type SlotMachineInstallInput,
  type SlotMachineInstallResponse,
  type SlotMachineListResponse,
  type SlotMachineSummary,
} from '@cs-rio/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factionMembers,
  factions,
  favelas,
  gameEvents,
  players,
  properties,
  regions,
  slotMachineOperations,
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

interface SlotMachinePlayerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  money: number;
}

interface SlotMachineEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface SlotMachineSoldierRosterRecord {
  count: number;
  dailyCost: number;
}

interface SlotMachineSnapshotRecord {
  cashBalance: number;
  createdAt: Date;
  densityIndex: number;
  factionCommissionTotal: number;
  favelaId: string | null;
  favelaPopulation: number | null;
  grossRevenueTotal: number;
  houseEdge: number;
  id: string;
  installedMachines: number;
  jackpotChance: number;
  lastCollectedAt: Date | null;
  lastMaintenanceAt: Date;
  lastPlayAt: Date;
  level: number;
  maxBet: number;
  minBet: number;
  operationCostMultiplier: number;
  policePressure: number;
  regionId: RegionId;
  sabotageRecoveryReadyAt: Date | null;
  sabotageResolvedAt: Date | null;
  sabotageState: 'normal' | 'damaged' | 'destroyed';
  soldierRoster: SlotMachineSoldierRosterRecord[];
  suspended: boolean;
  wealthIndex: number;
}

interface SlotMachineMaintenanceStatus {
  blocked: boolean;
  lastMaintenanceAt: Date;
  moneySpentOnSync: number;
  overdueDays: number;
}

interface SlotMachineStateUpdateInput {
  cashBalance: number;
  factionCommissionDelta: number;
  factionCommissionTotal: number;
  factionId: string | null;
  grossRevenueDelta: number;
  grossRevenueTotal: number;
  houseEdge: number;
  installedMachines: number;
  jackpotChance: number;
  lastPlayAt: Date;
  maxBet: number;
  minBet: number;
  playerMoneySpentOnMaintenance: number;
  propertyId: string;
  propertyLastMaintenanceAt: Date;
  propertySuspended: boolean;
}

interface SlotMachineInstallRecord {
  installedQuantity: number;
  playerMoneyAfterInstall: number;
}

interface SlotMachineCollectRecord {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

interface SlotMachineSyncResult {
  changed: boolean;
  maintenanceStatus: SlotMachineMaintenanceStatus;
  nextPlayerMoney: number;
  snapshot: SlotMachineSnapshotRecord;
}

export interface SlotMachineRepository {
  applySlotMachineState(playerId: string, input: SlotMachineStateUpdateInput): Promise<boolean>;
  collectCash(playerId: string, propertyId: string): Promise<SlotMachineCollectRecord | null>;
  configureOdds(
    playerId: string,
    propertyId: string,
    input: {
      houseEdge: number;
      jackpotChance: number;
      lastPlayAt: Date;
      maxBet: number;
      minBet: number;
    },
  ): Promise<boolean>;
  getPlayer(playerId: string): Promise<SlotMachinePlayerRecord | null>;
  getSlotMachine(playerId: string, propertyId: string): Promise<SlotMachineSnapshotRecord | null>;
  installMachines(
    playerId: string,
    propertyId: string,
    input: {
      installedAt: Date;
      quantity: number;
      totalInstallCost: number;
    },
  ): Promise<SlotMachineInstallRecord | null>;
  listFavelas?(): Promise<RegionalDominationFavelaRecord[]>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<SlotMachineEventRecord[]>;
  listSlotMachines(playerId: string): Promise<SlotMachineSnapshotRecord[]>;
}

export interface SlotMachineServiceOptions {
  gameConfigService?: GameConfigService;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  repository?: SlotMachineRepository;
  universityReader?: UniversityEffectReaderContract;
}

export interface SlotMachineServiceContract {
  close?(): Promise<void>;
  collectCash(playerId: string, propertyId: string): Promise<SlotMachineCollectResponse>;
  configureOdds(
    playerId: string,
    propertyId: string,
    input: SlotMachineConfigureInput,
  ): Promise<SlotMachineConfigureResponse>;
  installMachines(
    playerId: string,
    propertyId: string,
    input: SlotMachineInstallInput,
  ): Promise<SlotMachineInstallResponse>;
  listSlotMachines(playerId: string): Promise<SlotMachineListResponse>;
}

type SlotMachineErrorCode =
  | 'capacity'
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_funds'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class SlotMachineError extends Error {
  constructor(
    public readonly code: SlotMachineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SlotMachineError';
  }
}

export class DatabaseSlotMachineRepository implements SlotMachineRepository {
  async applySlotMachineState(playerId: string, input: SlotMachineStateUpdateInput): Promise<boolean> {
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
            eq(properties.type, 'slot_machine'),
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
            createdAt: input.lastPlayAt,
            description: 'Comissao automatica recebida de maquininhas de membro.',
            entryType: 'business_commission',
            factionId: input.factionId,
            grossAmount: input.grossRevenueDelta,
            netAmount: roundCurrency(input.grossRevenueDelta - input.factionCommissionDelta),
            originType: 'slot_machine',
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

      const [operation] = await tx
        .select({
          propertyId: slotMachineOperations.propertyId,
        })
        .from(slotMachineOperations)
        .where(eq(slotMachineOperations.propertyId, input.propertyId))
        .limit(1);

      if (operation) {
        await tx
          .update(slotMachineOperations)
          .set({
            cashBalance: input.cashBalance.toFixed(2),
            factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
            grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
            houseEdge: input.houseEdge.toFixed(4),
            jackpotChance: input.jackpotChance.toFixed(4),
            lastPlayAt: input.lastPlayAt,
            machinesInstalled: input.installedMachines,
            maxBet: input.maxBet.toFixed(2),
            minBet: input.minBet.toFixed(2),
          })
          .where(eq(slotMachineOperations.propertyId, input.propertyId));
      } else {
        await tx.insert(slotMachineOperations).values({
          cashBalance: input.cashBalance.toFixed(2),
          factionCommissionTotal: input.factionCommissionTotal.toFixed(2),
          grossRevenueTotal: input.grossRevenueTotal.toFixed(2),
          houseEdge: input.houseEdge.toFixed(4),
          jackpotChance: input.jackpotChance.toFixed(4),
          lastPlayAt: input.lastPlayAt,
          machinesInstalled: input.installedMachines,
          maxBet: input.maxBet.toFixed(2),
          minBet: input.minBet.toFixed(2),
          propertyId: input.propertyId,
        });
      }

      return true;
    });
  }

  async collectCash(playerId: string, propertyId: string): Promise<SlotMachineCollectRecord | null> {
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select({
          cashBalance: slotMachineOperations.cashBalance,
        })
        .from(slotMachineOperations)
        .innerJoin(properties, eq(properties.id, slotMachineOperations.propertyId))
        .where(
          and(
            eq(slotMachineOperations.propertyId, propertyId),
            eq(properties.playerId, playerId),
            eq(properties.type, 'slot_machine'),
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

      const playerMoneyAfterCollect = roundCurrency(
        Number.parseFloat(String(player.money)) + collectedAmount,
      );

      await tx
        .update(players)
        .set({
          money: playerMoneyAfterCollect.toFixed(2),
        })
        .where(eq(players.id, playerId));

      await tx
        .update(slotMachineOperations)
        .set({
          cashBalance: '0.00',
          lastCollectedAt: new Date(),
        })
        .where(eq(slotMachineOperations.propertyId, propertyId));

      await tx.insert(transactions).values({
        amount: collectedAmount.toFixed(2),
        description: `Coleta de caixa da maquininha ${propertyId}`,
        playerId,
        type: 'slot_machine_collect',
      });

      return {
        collectedAmount,
        playerMoneyAfterCollect,
      };
    });
  }

  async configureOdds(
    playerId: string,
    propertyId: string,
    input: {
      houseEdge: number;
      jackpotChance: number;
      lastPlayAt: Date;
      maxBet: number;
      minBet: number;
    },
  ): Promise<boolean> {
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
            eq(properties.type, 'slot_machine'),
          ),
        )
        .limit(1);

      if (!property) {
        return false;
      }

      const [operation] = await tx
        .select({
          propertyId: slotMachineOperations.propertyId,
        })
        .from(slotMachineOperations)
        .where(eq(slotMachineOperations.propertyId, propertyId))
        .limit(1);

      if (operation) {
        await tx
          .update(slotMachineOperations)
          .set({
            houseEdge: input.houseEdge.toFixed(4),
            jackpotChance: input.jackpotChance.toFixed(4),
            maxBet: input.maxBet.toFixed(2),
            minBet: input.minBet.toFixed(2),
          })
          .where(eq(slotMachineOperations.propertyId, propertyId));
      } else {
        await tx.insert(slotMachineOperations).values({
          houseEdge: input.houseEdge.toFixed(4),
          jackpotChance: input.jackpotChance.toFixed(4),
          lastPlayAt: input.lastPlayAt ?? property.createdAt,
          maxBet: input.maxBet.toFixed(2),
          minBet: input.minBet.toFixed(2),
          propertyId,
        });
      }

      return true;
    });
  }

  async getPlayer(playerId: string): Promise<SlotMachinePlayerRecord | null> {
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

  async getSlotMachine(playerId: string, propertyId: string): Promise<SlotMachineSnapshotRecord | null> {
    const slotMachines = await this.listSlotMachines(playerId);
    return slotMachines.find((slotMachine) => slotMachine.id === propertyId) ?? null;
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

  async installMachines(
    playerId: string,
    propertyId: string,
    input: {
      installedAt: Date;
      quantity: number;
      totalInstallCost: number;
    },
  ): Promise<SlotMachineInstallRecord | null> {
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
            eq(properties.type, 'slot_machine'),
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

      const playerMoneyAfterInstall = roundCurrency(
        Number.parseFloat(String(player.money)) - input.totalInstallCost,
      );

      await tx
        .update(players)
        .set({
          money: playerMoneyAfterInstall.toFixed(2),
        })
        .where(eq(players.id, playerId));

      const [operation] = await tx
        .select({
          machinesInstalled: slotMachineOperations.machinesInstalled,
        })
        .from(slotMachineOperations)
        .where(eq(slotMachineOperations.propertyId, propertyId))
        .limit(1);

      if (operation) {
        await tx
          .update(slotMachineOperations)
          .set({
            machinesInstalled: operation.machinesInstalled + input.quantity,
          })
          .where(eq(slotMachineOperations.propertyId, propertyId));
      } else {
        await tx.insert(slotMachineOperations).values({
          lastPlayAt: input.installedAt,
          machinesInstalled: input.quantity,
          propertyId,
        });
      }

      await tx.insert(transactions).values({
        amount: input.totalInstallCost.toFixed(2),
        description: `Instalacao de ${input.quantity} maquininha(s) em ${propertyId}`,
        playerId,
        type: 'slot_machine_install',
      });

      return {
        installedQuantity: input.quantity,
        playerMoneyAfterInstall,
      };
    });
  }

  async listActiveEvents(regionId: RegionId, now: Date): Promise<SlotMachineEventRecord[]> {
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
      (row): row is SlotMachineEventRecord =>
        row.eventType === 'ano_novo_copa' ||
        row.eventType === 'baile_cidade' ||
        row.eventType === 'blitz_pm' ||
        row.eventType === 'carnaval' ||
        row.eventType === 'operacao_policial' ||
        row.eventType === 'faca_na_caveira',
    );
  }

  async listSlotMachines(playerId: string): Promise<SlotMachineSnapshotRecord[]> {
    const rows = await db
      .select({
        cashBalance: slotMachineOperations.cashBalance,
        createdAt: properties.createdAt,
        densityIndex: regions.densityIndex,
        factionCommissionTotal: slotMachineOperations.factionCommissionTotal,
        favelaId: properties.favelaId,
        favelaPopulation: favelas.population,
        grossRevenueTotal: slotMachineOperations.grossRevenueTotal,
        houseEdge: slotMachineOperations.houseEdge,
        id: properties.id,
        installedMachines: slotMachineOperations.machinesInstalled,
        jackpotChance: slotMachineOperations.jackpotChance,
        lastCollectedAt: slotMachineOperations.lastCollectedAt,
        lastMaintenanceAt: properties.lastMaintenanceAt,
        lastPlayAt: slotMachineOperations.lastPlayAt,
        level: properties.level,
        maxBet: slotMachineOperations.maxBet,
        minBet: slotMachineOperations.minBet,
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
      .leftJoin(slotMachineOperations, eq(slotMachineOperations.propertyId, properties.id))
      .where(and(eq(properties.playerId, playerId), eq(properties.type, 'slot_machine')));

    if (rows.length === 0) {
      return [];
    }

    const propertyIds = rows.map((row) => row.id);
    const soldierRows = await db
      .select({
        dailyCost: soldiers.dailyCost,
        propertyId: soldiers.propertyId,
      })
      .from(soldiers)
      .where(inArray(soldiers.propertyId, propertyIds));
    const soldiersByPropertyId = new Map<string, SlotMachineSoldierRosterRecord>();

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
      cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance ?? '0'))),
      createdAt: row.createdAt,
      densityIndex: row.densityIndex,
      factionCommissionTotal: roundCurrency(Number.parseFloat(String(row.factionCommissionTotal ?? '0'))),
      favelaId: row.favelaId,
      favelaPopulation: row.favelaPopulation,
      grossRevenueTotal: roundCurrency(Number.parseFloat(String(row.grossRevenueTotal ?? '0'))),
      houseEdge: roundProbability(Number.parseFloat(String(row.houseEdge ?? SLOT_MACHINE_DEFAULT_HOUSE_EDGE))),
      id: row.id,
      installedMachines: row.installedMachines ?? 0,
      jackpotChance: roundProbability(
        Number.parseFloat(String(row.jackpotChance ?? SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE)),
      ),
      lastCollectedAt: row.lastCollectedAt,
      lastMaintenanceAt: row.lastMaintenanceAt,
      lastPlayAt: row.lastPlayAt ?? row.createdAt,
      level: row.level,
      maxBet: roundCurrency(Number.parseFloat(String(row.maxBet ?? SLOT_MACHINE_DEFAULT_MAX_BET))),
      minBet: roundCurrency(Number.parseFloat(String(row.minBet ?? SLOT_MACHINE_DEFAULT_MIN_BET))),
      operationCostMultiplier: roundCurrency(Number.parseFloat(String(row.operationCostMultiplier))),
      policePressure: row.policePressure,
      regionId: row.regionId as RegionId,
      sabotageRecoveryReadyAt: row.sabotageRecoveryReadyAt,
      sabotageResolvedAt: row.sabotageResolvedAt,
      sabotageState: row.sabotageState,
      soldierRoster: soldiersByPropertyId.get(row.id)
        ? [soldiersByPropertyId.get(row.id) as SlotMachineSoldierRosterRecord]
        : [],
      suspended: row.suspended,
      wealthIndex: row.wealthIndex,
    }));
  }
}

export class SlotMachineService implements SlotMachineServiceContract {
  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: SlotMachineRepository;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: SlotMachineServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseSlotMachineRepository();
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async collectCash(playerId: string, propertyId: string): Promise<SlotMachineCollectResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncSlotMachine(player, propertyId, passiveProfile);

    if (synced.snapshot.cashBalance <= 0) {
      throw new SlotMachineError('conflict', 'Esta maquininha nao possui caixa disponivel para coleta.');
    }

    const collected = await this.repository.collectCash(playerId, propertyId);

    if (!collected) {
      throw new SlotMachineError('not_found', 'Maquininha nao encontrada para coleta.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const slotMachine = await this.listSingleSlotMachine(playerId, propertyId);

    return {
      collectedAmount: collected.collectedAmount,
      playerMoneyAfterCollect: collected.playerMoneyAfterCollect,
      slotMachine,
    };
  }

  async configureOdds(
    playerId: string,
    propertyId: string,
    input: SlotMachineConfigureInput,
  ): Promise<SlotMachineConfigureResponse> {
    validateSlotMachineConfig(input);
    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    await this.syncSlotMachine(player, propertyId, passiveProfile);
    const configured = await this.repository.configureOdds(playerId, propertyId, {
      houseEdge: roundProbability(input.houseEdge),
      jackpotChance: roundProbability(input.jackpotChance),
      lastPlayAt: this.now(),
      maxBet: roundCurrency(input.maxBet),
      minBet: roundCurrency(input.minBet),
    });

    if (!configured) {
      throw new SlotMachineError('not_found', 'Maquininha nao encontrada para configuracao.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    return {
      slotMachine: await this.listSingleSlotMachine(playerId, propertyId),
    };
  }

  async installMachines(
    playerId: string,
    propertyId: string,
    input: SlotMachineInstallInput,
  ): Promise<SlotMachineInstallResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new SlotMachineError('validation', 'Informe uma quantidade inteira positiva para instalacao.');
    }

    const player = await this.requireReadyPlayer(playerId);
    const passiveProfile = await this.universityReader.getPassiveProfile(playerId);
    const synced = await this.syncSlotMachine(player, propertyId, passiveProfile);

    if (synced.maintenanceStatus.blocked) {
      throw new SlotMachineError('conflict', 'Regularize a manutencao antes de instalar novas maquininhas.');
    }

    const capacity = resolveSlotMachineCapacity(synced.snapshot.level);

    if (synced.snapshot.installedMachines + input.quantity > capacity) {
      throw new SlotMachineError(
        'capacity',
        `Capacidade excedida. Esta propriedade suporta ate ${capacity} maquininhas nesse nivel.`,
      );
    }

    const totalInstallCost = roundCurrency(input.quantity * SLOT_MACHINE_INSTALL_COST);

    if (synced.nextPlayerMoney < totalInstallCost) {
      throw new SlotMachineError('insufficient_funds', 'Dinheiro em maos insuficiente para instalar as maquininhas.');
    }

    const installed = await this.repository.installMachines(playerId, propertyId, {
      installedAt: this.now(),
      quantity: input.quantity,
      totalInstallCost,
    });

    if (!installed) {
      throw new SlotMachineError('not_found', 'Maquininha nao encontrada para instalacao.');
    }

    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const slotMachine = await this.listSingleSlotMachine(playerId, propertyId);

    return {
      installedQuantity: installed.installedQuantity,
      playerMoneyAfterInstall: installed.playerMoneyAfterInstall,
      slotMachine,
      totalInstallCost,
    };
  }

  async listSlotMachines(playerId: string): Promise<SlotMachineListResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [configCatalog, passiveProfile, slotMachines, favelasList] = await Promise.all([
      this.gameConfigService.getResolvedCatalog(),
      this.universityReader.getPassiveProfile(playerId),
      this.repository.listSlotMachines(playerId),
      this.repository.listFavelas?.() ?? Promise.resolve([]),
    ]);
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      favelasList,
    );
    const eventCache = new Map<RegionId, SlotMachineEventRecord[]>();
    const summaries: SlotMachineSummary[] = [];
    let changed = false;
    let workingPlayer = player;

    for (const slotMachine of [...slotMachines].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    )) {
      let events = eventCache.get(slotMachine.regionId);

      if (!events) {
        events = await this.repository.listActiveEvents(slotMachine.regionId, this.now());
        eventCache.set(slotMachine.regionId, events);
      }

      const regionalDominationBonus =
        regionalDominationByRegion.get(slotMachine.regionId) ??
        buildInactiveRegionalDominationBonus(slotMachine.regionId);
      const synced = await this.syncSlotMachineRecord(
        workingPlayer,
        slotMachine,
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
        serializeSlotMachineSummary(
          synced.snapshot,
          synced.maintenanceStatus,
          events,
          workingPlayer,
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
      slotMachines: summaries,
    };
  }

  private async listSingleSlotMachine(playerId: string, propertyId: string): Promise<SlotMachineSummary> {
    const summary = await this.listSlotMachines(playerId);
    const slotMachine = summary.slotMachines.find((entry: SlotMachineSummary) => entry.id === propertyId);

    if (!slotMachine) {
      throw new SlotMachineError('not_found', 'Maquininha nao encontrada apos a atualizacao.');
    }

    return slotMachine;
  }

  private async requireReadyPlayer(playerId: string): Promise<SlotMachinePlayerRecord> {
    const player = await this.repository.getPlayer(playerId);

    if (!player) {
      throw new SlotMachineError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new SlotMachineError('character_not_ready', 'Crie seu personagem antes de gerenciar maquininhas.');
    }

    return player;
  }

  private async syncSlotMachine(
    player: SlotMachinePlayerRecord,
    propertyId: string,
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  ): Promise<SlotMachineSyncResult> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const slotMachine = await this.repository.getSlotMachine(player.id, propertyId);

    if (!slotMachine) {
      throw new SlotMachineError('not_found', 'Maquininha nao encontrada.');
    }

    const events = await this.repository.listActiveEvents(slotMachine.regionId, this.now());
    const regionalDominationByRegion = buildFactionRegionalDominationByRegion(
      player.factionId,
      (await this.repository.listFavelas?.()) ?? [],
    );
    const regionalDominationBonus =
      regionalDominationByRegion.get(slotMachine.regionId) ??
      buildInactiveRegionalDominationBonus(slotMachine.regionId);
    return this.syncSlotMachineRecord(
      player,
      slotMachine,
      events,
      passiveProfile,
      regionalDominationBonus,
      configCatalog,
    );
  }

  private async syncSlotMachineRecord(
    player: SlotMachinePlayerRecord,
    slotMachine: SlotMachineSnapshotRecord,
    events: SlotMachineEventRecord[],
    passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
    regionalDominationBonus: RegionalDominationBonus,
    configCatalog: ResolvedGameConfigCatalog,
  ): Promise<SlotMachineSyncResult> {
    const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'slot_machine');
    const eventProfile = resolvePropertyEventProfile(configCatalog, 'slot_machine');
    const maintenanceStatus = syncSlotMachineMaintenance(
      slotMachine,
      player.money,
      this.now(),
      propertyDefinition,
      passiveProfile.business.propertyMaintenanceMultiplier *
        regionalDominationBonus.maintenanceMultiplier,
    );
    const sabotageStatus = buildPropertySabotageStatusSummary({
      now: this.now(),
      sabotageRecoveryReadyAt: slotMachine.sabotageRecoveryReadyAt,
      sabotageResolvedAt: slotMachine.sabotageResolvedAt,
      sabotageState: slotMachine.sabotageState,
      type: 'slot_machine',
    });
    const cycleMs = SLOT_MACHINE_OPERATION_CYCLE_MINUTES * 60 * 1000;
    const elapsedCycles = Math.floor(
      Math.max(0, this.now().getTime() - slotMachine.lastPlayAt.getTime()) / cycleMs,
    );
    const processedUntil = new Date(
      slotMachine.lastPlayAt.getTime() + elapsedCycles * cycleMs,
    );
    let cashBalance = slotMachine.cashBalance;
    let grossRevenueDelta = 0;
    let grossRevenueTotal = slotMachine.grossRevenueTotal;
    let factionCommissionTotal = slotMachine.factionCommissionTotal;
    let factionCommissionDelta = 0;
    const effectiveFactionCommissionRate = resolveEffectiveFactionCommissionRate(
      player.factionId,
      propertyDefinition,
    );

    if (elapsedCycles > 0 && !maintenanceStatus.blocked && !sabotageStatus.blocked && slotMachine.installedMachines > 0) {
      const grossRevenuePerCycle = buildSlotMachineGrossRevenuePerCycle(
        slotMachine,
        events,
        passiveProfile,
        regionalDominationBonus,
        eventProfile,
      );

      if (grossRevenuePerCycle > 0) {
        const grossRevenue = roundCurrency(
          grossRevenuePerCycle * elapsedCycles * sabotageStatus.operationalMultiplier,
        );
        const commissionAmount = roundCurrency(grossRevenue * effectiveFactionCommissionRate);
        const netRevenue = roundCurrency(grossRevenue - commissionAmount);

        cashBalance = roundCurrency(cashBalance + netRevenue);
        grossRevenueDelta = roundCurrency(grossRevenueDelta + grossRevenue);
        grossRevenueTotal = roundCurrency(grossRevenueTotal + grossRevenue);
        factionCommissionTotal = roundCurrency(factionCommissionTotal + commissionAmount);
        factionCommissionDelta = roundCurrency(factionCommissionDelta + commissionAmount);
      }
    }

    const nextSnapshot: SlotMachineSnapshotRecord = {
      ...slotMachine,
      cashBalance,
      factionCommissionTotal,
      grossRevenueTotal,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt,
      lastPlayAt: elapsedCycles > 0 ? processedUntil : slotMachine.lastPlayAt,
      suspended: maintenanceStatus.blocked,
    };
    const changed =
      maintenanceStatus.moneySpentOnSync > 0 ||
      maintenanceStatus.overdueDays > 0 !== slotMachine.suspended ||
      nextSnapshot.lastMaintenanceAt.getTime() !== slotMachine.lastMaintenanceAt.getTime() ||
      nextSnapshot.lastPlayAt.getTime() !== slotMachine.lastPlayAt.getTime() ||
      nextSnapshot.cashBalance !== slotMachine.cashBalance ||
      nextSnapshot.grossRevenueTotal !== slotMachine.grossRevenueTotal ||
      nextSnapshot.factionCommissionTotal !== slotMachine.factionCommissionTotal;

    if (changed) {
      const applied = await this.repository.applySlotMachineState(player.id, {
        cashBalance: nextSnapshot.cashBalance,
        factionCommissionDelta,
        factionCommissionTotal: nextSnapshot.factionCommissionTotal,
        factionId: player.factionId,
        grossRevenueDelta,
        grossRevenueTotal: nextSnapshot.grossRevenueTotal,
        houseEdge: nextSnapshot.houseEdge,
        installedMachines: nextSnapshot.installedMachines,
        jackpotChance: nextSnapshot.jackpotChance,
        lastPlayAt: nextSnapshot.lastPlayAt,
        maxBet: nextSnapshot.maxBet,
        minBet: nextSnapshot.minBet,
        playerMoneySpentOnMaintenance: maintenanceStatus.moneySpentOnSync,
        propertyId: nextSnapshot.id,
        propertyLastMaintenanceAt: nextSnapshot.lastMaintenanceAt,
        propertySuspended: nextSnapshot.suspended,
      });

      if (!applied) {
        throw new SlotMachineError('not_found', 'Falha ao sincronizar a operacao da maquininha.');
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

function buildSlotMachineAverageBet(slotMachine: SlotMachineSnapshotRecord): number {
  const geometricAverage = Math.sqrt(
    Math.max(SLOT_MACHINE_MIN_BET, slotMachine.minBet) * Math.max(slotMachine.minBet, slotMachine.maxBet),
  );
  const wealthLift = clampMultiplier(0.88 + slotMachine.wealthIndex / 400, 0.88, 1.15);
  return roundCurrency(geometricAverage * wealthLift);
}

function buildSlotMachineGrossRevenuePerCycle(
  slotMachine: SlotMachineSnapshotRecord,
  events: SlotMachineEventRecord[],
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  eventProfile: PropertyEventProfile,
): number {
  const averageBet = buildSlotMachineAverageBet(slotMachine);
  const locationMultiplier = buildSlotMachineLocationMultiplier(slotMachine);
  const trafficMultiplier = buildSlotMachineTrafficMultiplier(slotMachine, events, eventProfile);
  const playsPerMachine = 1.15 * locationMultiplier * trafficMultiplier;
  const grossHandle = averageBet * slotMachine.installedMachines * playsPerMachine;
  const levelMultiplier = 1 + (slotMachine.level - 1) * 0.12;
  return roundCurrency(
    grossHandle *
      slotMachine.houseEdge *
      levelMultiplier *
      regionalDominationBonus.revenueMultiplier *
      passiveProfile.business.passiveRevenueMultiplier,
  );
}

function buildSlotMachineLocationMultiplier(
  slotMachine: Pick<
    SlotMachineSnapshotRecord,
    'densityIndex' | 'favelaPopulation' | 'policePressure' | 'regionId' | 'wealthIndex'
  >,
): number {
  const base =
    0.75 +
    slotMachine.wealthIndex / 220 +
    slotMachine.densityIndex / 360 +
    (slotMachine.favelaPopulation ?? 0) / 420_000 -
    slotMachine.policePressure / 1400 +
    (slotMachine.regionId === 'centro' ? 0.12 : 0);

  return clampMultiplier(base, 0.8, 1.8);
}

function buildSlotMachineTrafficMultiplier(
  slotMachine: Pick<SlotMachineSnapshotRecord, 'houseEdge' | 'jackpotChance' | 'maxBet' | 'minBet' | 'regionId'>,
  events: SlotMachineEventRecord[],
  eventProfile: PropertyEventProfile,
): number {
  const fairOddsBoost = 1 + (SLOT_MACHINE_MAX_HOUSE_EDGE - slotMachine.houseEdge) * 1.6;
  const jackpotBoost = 1 + (slotMachine.jackpotChance - SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE) * 10;
  const betRatio = Math.max(1, slotMachine.maxBet / Math.max(slotMachine.minBet, SLOT_MACHINE_MIN_BET));
  const rangePenalty = clampMultiplier(1.08 - Math.log10(betRatio) * 0.12, 0.72, 1.08);
  const eventMultiplier = resolveSlotMachineTrafficEventMultiplier(
    events,
    slotMachine.regionId,
    eventProfile,
  );
  return clampMultiplier(fairOddsBoost * jackpotBoost * rangePenalty * eventMultiplier, 0.55, 1.8);
}

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function resolveSlotMachineCapacity(level: number): number {
  return 3 + level * 2;
}

function resolveSlotMachineTrafficEventMultiplier(
  events: SlotMachineEventRecord[],
  regionId: RegionId,
  eventProfile: PropertyEventProfile,
): number {
  const multiplier = resolveRegionalEventMultiplier(events, regionId, eventProfile.trafficMultipliers);
  const clampProfile = eventProfile.clamps?.traffic;
  return clampMultiplier(multiplier, clampProfile?.min ?? 0.5, clampProfile?.max ?? 1.75);
}

function roundProbability(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function serializeSlotMachineSummary(
  slotMachine: SlotMachineSnapshotRecord,
  maintenanceStatus: SlotMachineMaintenanceStatus,
  events: SlotMachineEventRecord[],
  player: SlotMachinePlayerRecord,
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>,
  regionalDominationBonus: RegionalDominationBonus,
  configCatalog: ResolvedGameConfigCatalog,
): SlotMachineSummary {
  const propertyDefinition = resolveEconomyPropertyDefinition(configCatalog, 'slot_machine');
  const eventProfile = resolvePropertyEventProfile(configCatalog, 'slot_machine');
  const sabotageStatus = buildPropertySabotageStatusSummary({
    now: new Date(),
    sabotageRecoveryReadyAt: slotMachine.sabotageRecoveryReadyAt,
    sabotageResolvedAt: slotMachine.sabotageResolvedAt,
    sabotageState: slotMachine.sabotageState,
    type: 'slot_machine',
  });
  const locationMultiplier = buildSlotMachineLocationMultiplier(slotMachine);
  const trafficMultiplier = buildSlotMachineTrafficMultiplier(slotMachine, events, eventProfile);
  const expectedGrossRevenuePerCycle =
    !maintenanceStatus.blocked && !sabotageStatus.blocked && slotMachine.installedMachines > 0
      ? buildSlotMachineGrossRevenuePerCycle(
          slotMachine,
          events,
          passiveProfile,
          regionalDominationBonus,
          eventProfile,
        ) * sabotageStatus.operationalMultiplier
      : 0;
  const estimatedHourlyGrossRevenue = roundCurrency(
    expectedGrossRevenuePerCycle * (60 / SLOT_MACHINE_OPERATION_CYCLE_MINUTES),
  );
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    slotMachine,
    slotMachine.operationCostMultiplier,
    passiveProfile.business.propertyMaintenanceMultiplier *
      regionalDominationBonus.maintenanceMultiplier,
  );
  const projectedDailyGrossRevenue = roundCurrency(
    expectedGrossRevenuePerCycle * ((24 * 60) / SLOT_MACHINE_OPERATION_CYCLE_MINUTES),
  );

  return {
    cashbox: {
      availableToCollect: slotMachine.cashBalance,
      grossRevenueLifetime: slotMachine.grossRevenueTotal,
      lastCollectedAt: slotMachine.lastCollectedAt ? slotMachine.lastCollectedAt.toISOString() : null,
      lastPlayAt: slotMachine.lastPlayAt.toISOString(),
      totalFactionCommission: slotMachine.factionCommissionTotal,
    },
    config: {
      houseEdge: slotMachine.houseEdge,
      jackpotChance: slotMachine.jackpotChance,
      maxBet: slotMachine.maxBet,
      minBet: slotMachine.minBet,
    },
    economics: {
      capacity: resolveSlotMachineCapacity(slotMachine.level),
      cycleMinutes: SLOT_MACHINE_OPERATION_CYCLE_MINUTES,
      effectiveFactionCommissionRate: resolveEffectiveFactionCommissionRate(
        player.factionId,
        propertyDefinition,
      ),
      estimatedHourlyGrossRevenue,
      expectedGrossRevenuePerCycle,
      installedMachines: slotMachine.installedMachines,
      locationMultiplier,
      playerTrafficMultiplier: trafficMultiplier,
      profitable: projectedDailyGrossRevenue > dailyUpkeep,
    },
    favelaId: slotMachine.favelaId,
    id: slotMachine.id,
    level: slotMachine.level,
    maintenanceStatus: {
      blocked: maintenanceStatus.blocked,
      lastMaintenanceAt: maintenanceStatus.lastMaintenanceAt.toISOString(),
      moneySpentOnSync: maintenanceStatus.moneySpentOnSync,
      overdueDays: maintenanceStatus.overdueDays,
    },
    regionId: slotMachine.regionId,
    sabotageStatus,
    status: sabotageStatus.blocked
      ? 'sabotage_blocked'
      : maintenanceStatus.blocked
        ? 'maintenance_blocked'
      : slotMachine.installedMachines <= 0
        ? 'installation_required'
        : 'active',
  };
}

function syncSlotMachineMaintenance(
  slotMachine: SlotMachineSnapshotRecord,
  workingMoney: number,
  now: Date,
  propertyDefinition: PropertyDefinitionSummary,
  maintenanceMultiplier = 1,
): SlotMachineMaintenanceStatus {
  const dailyUpkeep = resolvePropertyDailyUpkeep(
    propertyDefinition,
    slotMachine,
    slotMachine.operationCostMultiplier,
    maintenanceMultiplier,
  );
  const dueDays = Math.floor(
    Math.max(0, now.getTime() - slotMachine.lastMaintenanceAt.getTime()) / PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  if (dueDays <= 0 || dailyUpkeep <= 0) {
    return {
      blocked: slotMachine.suspended,
      lastMaintenanceAt: slotMachine.lastMaintenanceAt,
      moneySpentOnSync: 0,
      overdueDays: 0,
    };
  }

  const payableDays = Math.min(dueDays, Math.floor(workingMoney / dailyUpkeep));
  const moneySpentOnSync = roundCurrency(payableDays * dailyUpkeep);
  const overdueDays = dueDays - payableDays;
  const nextLastMaintenanceAt = new Date(
    slotMachine.lastMaintenanceAt.getTime() + payableDays * PROPERTY_MAINTENANCE_INTERVAL_MS,
  );

  return {
    blocked: overdueDays > 0,
    lastMaintenanceAt: nextLastMaintenanceAt,
    moneySpentOnSync,
    overdueDays,
  };
}

function validateSlotMachineConfig(input: SlotMachineConfigureInput): void {
  if (input.houseEdge < SLOT_MACHINE_MIN_HOUSE_EDGE || input.houseEdge > SLOT_MACHINE_MAX_HOUSE_EDGE) {
    throw new SlotMachineError(
      'validation',
      `A margem da casa deve ficar entre ${(SLOT_MACHINE_MIN_HOUSE_EDGE * 100).toFixed(0)}% e ${(SLOT_MACHINE_MAX_HOUSE_EDGE * 100).toFixed(0)}%.`,
    );
  }

  if (
    input.jackpotChance < SLOT_MACHINE_MIN_JACKPOT_CHANCE ||
    input.jackpotChance > SLOT_MACHINE_MAX_JACKPOT_CHANCE
  ) {
    throw new SlotMachineError(
      'validation',
      `A chance de jackpot deve ficar entre ${(SLOT_MACHINE_MIN_JACKPOT_CHANCE * 100).toFixed(1)}% e ${(SLOT_MACHINE_MAX_JACKPOT_CHANCE * 100).toFixed(0)}%.`,
    );
  }

  if (input.minBet < SLOT_MACHINE_MIN_BET || input.minBet > SLOT_MACHINE_MAX_BET) {
    throw new SlotMachineError(
      'validation',
      `A aposta minima deve ficar entre R$ ${SLOT_MACHINE_MIN_BET} e R$ ${SLOT_MACHINE_MAX_BET}.`,
    );
  }

  if (input.maxBet < SLOT_MACHINE_MIN_BET || input.maxBet > SLOT_MACHINE_MAX_BET) {
    throw new SlotMachineError(
      'validation',
      `A aposta maxima deve ficar entre R$ ${SLOT_MACHINE_MIN_BET} e R$ ${SLOT_MACHINE_MAX_BET}.`,
    );
  }

  if (input.maxBet < input.minBet) {
    throw new SlotMachineError('validation', 'A aposta maxima nao pode ser menor que a minima.');
  }
}
