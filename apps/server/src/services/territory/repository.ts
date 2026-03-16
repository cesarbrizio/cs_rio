import type {
  FavelaBaileMcTier,
  FavelaBaileResultTier,
  FactionWarStatus,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { and, desc, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import {
  bocaDrugStocks,
  bocaOperations,
  drugFactories,
  factionMembers,
  factions,
  favelaBanditReturns,
  favelaBailes,
  favelaServices,
  favelas,
  factionWars,
  frontStoreOperations,
  gameEvents,
  playerInventory,
  players,
  propinaPayments,
  properties,
  puteiroOperations,
  regions,
  raveDrugLineups,
  raveOperations,
  slotMachineOperations,
  transactions,
  vests,
  weapons,
  x9Events,
} from '../../db/schema.js';
import type { BanditReturnFlavor } from '../favela-force.js';
import { calculateFactionPointsDelta, insertFactionBankLedgerEntry } from '../faction.js';
import {
  buildTerritoryConquestLogDescription,
  mapTerritoryFactionWarRow,
  mapTerritoryX9EventRow,
  parseTerritoryX9SoldierImpactJson,
  requireFavelaServiceDefinition,
  resolveFavelaServiceUpgradeCost,
  roundCurrency,
  serializeTerritoryFactionWarPreparation,
  serializeTerritoryFactionWarRound,
} from './shared.js';
import {
  TerritoryError,
  type TerritoryApplyX9IncursionInput,
  type TerritoryConquestPersistenceInput,
  type TerritoryCreateX9WarningInput,
  type TerritoryFactionRecord,
  type TerritoryFactionWarCreateInput,
  type TerritoryFactionWarPreparePersistenceInput,
  type TerritoryFactionWarRecord,
  type TerritoryFactionWarRoundPersistenceInput,
  type TerritoryFavelaBailePersistenceInput,
  type TerritoryFavelaBaileRecord,
  type TerritoryFavelaBanditReturnRecord,
  type TerritoryFavelaBanditSyncUpdate,
  type TerritoryFavelaPropinaNegotiationInput,
  type TerritoryFavelaPropinaPaymentInput,
  type TerritoryFavelaPropertyStatsRecord,
  type TerritoryFavelaPropinaSyncUpdate,
  type TerritoryFavelaRecord,
  type TerritoryFavelaSatisfactionSyncUpdate,
  type TerritoryFavelaServiceInstallPersistenceInput,
  type TerritoryFavelaServiceRecord,
  type TerritoryFavelaServiceSyncPersistenceInput,
  type TerritoryFavelaServiceUpgradePersistenceInput,
  type TerritoryFavelaStateUpdateInput,
  type TerritoryFavelaX9Exposure,
  type TerritoryFavelaX9RollSyncUpdate,
  type TerritoryParticipantRecord,
  type TerritoryParticipantVest,
  type TerritoryParticipantWeapon,
  type TerritoryPlayerRecord,
  type TerritoryRegionRecord,
  type TerritoryRepository,
  type TerritoryResolveX9DesenroloInput,
  type TerritorySatisfactionEventRecord,
  type TerritorySatisfactionEventType,
  type TerritoryX9EventRecord,
} from './types.js';

const FACTION_WAR_DECLARATION_COST = 50000;
const FACTION_WAR_TOTAL_ROUNDS = 3;

export class DatabaseTerritoryRepository implements TerritoryRepository {
  async getFavela(favelaId: string): Promise<TerritoryFavelaRecord | null> {
    const [favela] = await db
      .select({
        baseBanditTarget: favelas.baseBanditTarget,
        code: favelas.code,
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
        banditsDeadRecent: favelas.banditsDeadRecent,
        banditsSyncedAt: favelas.banditsSyncedAt,
        contestingFactionId: favelas.contestingFactionId,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        id: favelas.id,
        lastX9RollAt: favelas.lastX9RollAt,
        maxSoldiers: favelas.maxSoldiers,
        name: favelas.name,
        population: favelas.population,
        propinaDiscountRate: favelas.propinaDiscountRate,
        propinaDueDate: favelas.propinaDueDate,
        propinaLastPaidAt: favelas.propinaLastPaidAt,
        propinaNegotiatedAt: favelas.propinaNegotiatedAt,
        propinaNegotiatedByPlayerId: favelas.propinaNegotiatedByPlayerId,
        propinaValue: favelas.propinaValue,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
        satisfactionSyncedAt: favelas.satisfactionSyncedAt,
        stabilizationEndsAt: favelas.stabilizationEndsAt,
        state: favelas.state,
        stateControlledUntil: favelas.stateControlledUntil,
        warDeclaredAt: favelas.warDeclaredAt,
      })
      .from(favelas)
      .where(eq(favelas.id, favelaId))
      .limit(1);

    return favela
      ? {
          ...favela,
          propinaDiscountRate: Number.parseFloat(String(favela.propinaDiscountRate)),
          propinaValue: Number.parseFloat(String(favela.propinaValue)),
          regionId: favela.regionId as RegionId,
        }
      : null;
  }

  async getFaction(factionId: string): Promise<TerritoryFactionRecord | null> {
    const [faction] = await db
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        id: factions.id,
        internalSatisfaction: factions.internalSatisfaction,
        name: factions.name,
        points: factions.points,
      })
      .from(factions)
      .where(eq(factions.id, factionId))
      .limit(1);

    return faction
      ? {
          abbreviation: faction.abbreviation,
          bankMoney: Number.parseFloat(String(faction.bankMoney)),
          id: faction.id,
          internalSatisfaction: faction.internalSatisfaction,
          name: faction.name,
          points: faction.points,
        }
      : null;
  }

  async getPlayer(playerId: string): Promise<TerritoryPlayerRecord | null> {
    const [player] = await db
      .select({
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        factionId: players.factionId,
        id: players.id,
        level: players.level,
        nickname: players.nickname,
        rank: factionMembers.rank,
        vocation: players.vocation,
      })
      .from(players)
      .leftJoin(
        factionMembers,
        and(eq(factionMembers.playerId, players.id), eq(factionMembers.factionId, players.factionId)),
      )
      .where(eq(players.id, playerId))
      .limit(1);

    return player
      ? {
          carisma: player.carisma,
          characterCreatedAt: player.characterCreatedAt,
          conceito: player.conceito,
          factionId: player.factionId,
          id: player.id,
          level: player.level,
          nickname: player.nickname,
          rank: player.rank,
          vocation: player.vocation as VocationType,
        }
      : null;
  }

  async getRegion(regionId: RegionId): Promise<TerritoryRegionRecord | null> {
    const [region] = await db
      .select({
        densityIndex: regions.densityIndex,
        id: regions.id,
        operationCostMultiplier: regions.operationCostMultiplier,
        policePressure: regions.policePressure,
        wealthIndex: regions.wealthIndex,
      })
      .from(regions)
      .where(eq(regions.id, regionId))
      .limit(1);

    return region
      ? {
          densityIndex: region.densityIndex,
          id: region.id as RegionId,
          operationCostMultiplier: Number.parseFloat(String(region.operationCostMultiplier)),
          policePressure: region.policePressure,
          wealthIndex: region.wealthIndex,
        }
      : null;
  }

  async listActiveSatisfactionEvents(
    regionIds: RegionId[],
    favelaIds: string[],
    now: Date,
  ): Promise<TerritorySatisfactionEventRecord[]> {
    if (regionIds.length === 0 && favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        eventType: gameEvents.eventType,
        favelaId: gameEvents.favelaId,
        regionId: gameEvents.regionId,
      })
      .from(gameEvents)
      .where(
        and(
          lte(gameEvents.startedAt, now),
          gte(gameEvents.endsAt, now),
          inArray(gameEvents.eventType, [
            'baile_cidade',
            'operacao_policial',
            'blitz_pm',
            'faca_na_caveira',
          ]),
          or(
            regionIds.length > 0 ? inArray(gameEvents.regionId, regionIds) : sql`false`,
            favelaIds.length > 0 ? inArray(gameEvents.favelaId, favelaIds) : sql`false`,
          ),
        ),
      );

    return rows.map((row) => ({
      eventType: row.eventType as TerritorySatisfactionEventType,
      favelaId: row.favelaId,
      regionId: row.regionId as RegionId | null,
    }));
  }

  async listAllFavelaServices(favelaIds: string[]): Promise<TerritoryFavelaServiceRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        active: favelaServices.active,
        favelaId: favelaServices.favelaId,
        grossRevenueTotal: favelaServices.grossRevenueTotal,
        id: favelaServices.id,
        installedAt: favelaServices.installedAt,
        lastRevenueAt: favelaServices.lastRevenueAt,
        level: favelaServices.level,
        serviceType: favelaServices.serviceType,
      })
      .from(favelaServices)
      .where(inArray(favelaServices.favelaId, favelaIds));

    return rows.map((row) => ({
      active: row.active,
      favelaId: row.favelaId,
      grossRevenueTotal: Number.parseFloat(String(row.grossRevenueTotal)),
      id: row.id,
      installedAt: row.installedAt,
      lastRevenueAt: row.lastRevenueAt,
      level: row.level,
      serviceType: row.serviceType,
    }));
  }

  async listLatestBailes(favelaIds: string[]): Promise<TerritoryFavelaBaileRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        activeEndsAt: favelaBailes.baileEndsAt,
        budget: favelaBailes.budget,
        cooldownEndsAt: favelaBailes.cooldownEndsAt,
        entryPrice: favelaBailes.entryPrice,
        factionId: favelaBailes.factionId,
        factionPointsDelta: favelaBailes.factionPointsDelta,
        favelaId: favelaBailes.favelaId,
        hangoverEndsAt: favelaBailes.hangoverEndsAt,
        id: favelaBailes.id,
        incidentCode: favelaBailes.incidentCode,
        mcTier: favelaBailes.mcTier,
        organizedAt: favelaBailes.organizedAt,
        organizedByPlayerId: favelaBailes.organizedByPlayerId,
        resultTier: favelaBailes.resultTier,
        satisfactionDelta: favelaBailes.satisfactionDelta,
        cansacoBoostPercent: favelaBailes.cansacoBoostPercent,
      })
      .from(favelaBailes)
      .where(inArray(favelaBailes.favelaId, favelaIds));

    return rows.map((row) => ({
      activeEndsAt: row.activeEndsAt,
      budget: roundCurrency(Number.parseFloat(String(row.budget))),
      cooldownEndsAt: row.cooldownEndsAt,
      entryPrice: roundCurrency(Number.parseFloat(String(row.entryPrice))),
      factionId: row.factionId,
      factionPointsDelta: row.factionPointsDelta,
      favelaId: row.favelaId,
      hangoverEndsAt: row.hangoverEndsAt,
      id: row.id,
      incidentCode: row.incidentCode,
      mcTier: row.mcTier as FavelaBaileMcTier,
      organizedAt: row.organizedAt,
      organizedByPlayerId: row.organizedByPlayerId,
      resultTier: row.resultTier as FavelaBaileResultTier,
      satisfactionDelta: row.satisfactionDelta,
      cansacoBoostPercent: row.cansacoBoostPercent,
    }));
  }

  async findLatestFactionWarBetweenFactions(
    attackerFactionId: string,
    defenderFactionId: string,
  ): Promise<TerritoryFactionWarRecord | null> {
    const [row] = await db
      .select({
        attackerFactionId: factionWars.attackerFactionId,
        attackerPreparationJson: factionWars.attackerPreparationJson,
        attackerScore: factionWars.attackerScore,
        cooldownEndsAt: factionWars.cooldownEndsAt,
        declaredAt: factionWars.declaredAt,
        declaredByPlayerId: factionWars.declaredByPlayerId,
        defenderFactionId: factionWars.defenderFactionId,
        defenderPreparationJson: factionWars.defenderPreparationJson,
        defenderScore: factionWars.defenderScore,
        endedAt: factionWars.endedAt,
        favelaId: factionWars.favelaId,
        id: factionWars.id,
        lootMoney: factionWars.lootMoney,
        nextRoundAt: factionWars.nextRoundAt,
        preparationEndsAt: factionWars.preparationEndsAt,
        roundResultsJson: factionWars.roundResultsJson,
        roundsResolved: factionWars.roundsResolved,
        roundsTotal: factionWars.roundsTotal,
        startsAt: factionWars.startsAt,
        status: factionWars.status,
        winnerFactionId: factionWars.winnerFactionId,
      })
      .from(factionWars)
      .where(
        or(
          and(
            eq(factionWars.attackerFactionId, attackerFactionId),
            eq(factionWars.defenderFactionId, defenderFactionId),
          ),
          and(
            eq(factionWars.attackerFactionId, defenderFactionId),
            eq(factionWars.defenderFactionId, attackerFactionId),
          ),
        ),
      )
      .orderBy(desc(factionWars.declaredAt))
      .limit(1);

    return row ? mapTerritoryFactionWarRow(row) : null;
  }

  async listFactionWars(favelaIds: string[]): Promise<TerritoryFactionWarRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        attackerFactionId: factionWars.attackerFactionId,
        attackerPreparationJson: factionWars.attackerPreparationJson,
        attackerScore: factionWars.attackerScore,
        cooldownEndsAt: factionWars.cooldownEndsAt,
        declaredAt: factionWars.declaredAt,
        declaredByPlayerId: factionWars.declaredByPlayerId,
        defenderFactionId: factionWars.defenderFactionId,
        defenderPreparationJson: factionWars.defenderPreparationJson,
        defenderScore: factionWars.defenderScore,
        endedAt: factionWars.endedAt,
        favelaId: factionWars.favelaId,
        id: factionWars.id,
        lootMoney: factionWars.lootMoney,
        nextRoundAt: factionWars.nextRoundAt,
        preparationEndsAt: factionWars.preparationEndsAt,
        roundResultsJson: factionWars.roundResultsJson,
        roundsResolved: factionWars.roundsResolved,
        roundsTotal: factionWars.roundsTotal,
        startsAt: factionWars.startsAt,
        status: factionWars.status,
        winnerFactionId: factionWars.winnerFactionId,
      })
      .from(factionWars)
      .where(inArray(factionWars.favelaId, favelaIds))
      .orderBy(desc(factionWars.declaredAt));

    return rows.map((row) => mapTerritoryFactionWarRow(row));
  }

  async listX9Events(favelaIds: string[]): Promise<TerritoryX9EventRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
        desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
        desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
        desenroloMoneySpent: x9Events.desenroloMoneySpent,
        desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
        desenroloPointsSpent: x9Events.desenroloPointsSpent,
        desenroloSucceeded: x9Events.desenroloSucceeded,
        drugsLost: x9Events.drugsLost,
        favelaId: x9Events.favelaId,
        id: x9Events.id,
        incursionAt: x9Events.incursionAt,
        moneyLost: x9Events.moneyLost,
        resolvedAt: x9Events.resolvedAt,
        soldierImpactJson: x9Events.soldierImpactJson,
        soldiersArrested: x9Events.soldiersArrested,
        soldiersReleaseAt: x9Events.soldiersReleaseAt,
        status: x9Events.status,
        triggeredAt: x9Events.triggeredAt,
        warningEndsAt: x9Events.warningEndsAt,
        weaponsLost: x9Events.weaponsLost,
      })
      .from(x9Events)
      .where(inArray(x9Events.favelaId, favelaIds));

    return rows.map((row) => mapTerritoryX9EventRow(row));
  }

  async getFavelaX9Exposure(favelaId: string): Promise<TerritoryFavelaX9Exposure> {
    const [soldierRows, bocaCashRows, raveCashRows, puteiroCashRows, frontStoreCashRows, slotCashRows, bocaDrugRows, raveDrugRows, factoryDrugRows] =
      await Promise.all([
        db
          .select({
            propertyId: properties.id,
            soldiersCount: properties.soldiersCount,
          })
          .from(properties)
          .where(
            and(
              eq(properties.favelaId, favelaId),
              eq(properties.suspended, false),
              gte(properties.soldiersCount, 1),
            ),
          ),
        db
          .select({
            cashBalance: bocaOperations.cashBalance,
            propertyId: properties.id,
          })
          .from(properties)
          .innerJoin(bocaOperations, eq(bocaOperations.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'boca'))),
        db
          .select({
            cashBalance: raveOperations.cashBalance,
            propertyId: properties.id,
          })
          .from(properties)
          .innerJoin(raveOperations, eq(raveOperations.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'rave'))),
        db
          .select({
            cashBalance: puteiroOperations.cashBalance,
            propertyId: properties.id,
          })
          .from(properties)
          .innerJoin(puteiroOperations, eq(puteiroOperations.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'puteiro'))),
        db
          .select({
            cashBalance: frontStoreOperations.cashBalance,
            propertyId: properties.id,
          })
          .from(properties)
          .innerJoin(frontStoreOperations, eq(frontStoreOperations.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'front_store'))),
        db
          .select({
            cashBalance: slotMachineOperations.cashBalance,
            propertyId: properties.id,
          })
          .from(properties)
          .innerJoin(slotMachineOperations, eq(slotMachineOperations.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'slot_machine'))),
        db
          .select({
            drugId: bocaDrugStocks.drugId,
            propertyId: properties.id,
            quantity: bocaDrugStocks.quantity,
          })
          .from(properties)
          .innerJoin(bocaDrugStocks, eq(bocaDrugStocks.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'boca'))),
        db
          .select({
            drugId: raveDrugLineups.drugId,
            propertyId: properties.id,
            quantity: raveDrugLineups.quantity,
          })
          .from(properties)
          .innerJoin(raveDrugLineups, eq(raveDrugLineups.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'rave'))),
        db
          .select({
            drugId: drugFactories.drugId,
            propertyId: properties.id,
            quantity: drugFactories.storedOutput,
          })
          .from(properties)
          .innerJoin(drugFactories, eq(drugFactories.propertyId, properties.id))
          .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'factory'))),
      ]);

    return {
      cashTargets: [
        ...bocaCashRows.map((row) => ({
          cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance))),
          kind: 'boca' as const,
          propertyId: row.propertyId,
        })),
        ...raveCashRows.map((row) => ({
          cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance))),
          kind: 'rave' as const,
          propertyId: row.propertyId,
        })),
        ...puteiroCashRows.map((row) => ({
          cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance))),
          kind: 'puteiro' as const,
          propertyId: row.propertyId,
        })),
        ...frontStoreCashRows.map((row) => ({
          cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance))),
          kind: 'front_store' as const,
          propertyId: row.propertyId,
        })),
        ...slotCashRows.map((row) => ({
          cashBalance: roundCurrency(Number.parseFloat(String(row.cashBalance))),
          kind: 'slot_machine' as const,
          propertyId: row.propertyId,
        })),
      ],
      drugTargets: [
        ...bocaDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'boca' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
        ...raveDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'rave' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
        ...factoryDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'factory' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
      ],
      soldierTargets: soldierRows.map((row) => ({
        propertyId: row.propertyId,
        soldiersCount: row.soldiersCount,
      })),
    };
  }

  async listFactionParticipants(factionId: string): Promise<TerritoryParticipantRecord[]> {
    const memberRows = await db
      .select({
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        factionId: factionMembers.factionId,
        forca: players.forca,
        hp: players.hp,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        disposicao: players.disposicao,
        nickname: players.nickname,
        rank: factionMembers.rank,
        regionId: players.regionId,
        resistencia: players.resistencia,
        cansaco: players.cansaco,
        vocation: players.vocation,
      })
      .from(factionMembers)
      .innerJoin(players, eq(players.id, factionMembers.playerId))
      .where(eq(factionMembers.factionId, factionId));

    if (memberRows.length === 0) {
      return [];
    }

    const playerIds = memberRows.map((member) => member.id);
    const [weaponRows, vestRows] = await Promise.all([
      db
        .select({
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
          playerId: playerInventory.playerId,
          power: weapons.power,
          proficiency: playerInventory.proficiency,
        })
        .from(playerInventory)
        .innerJoin(weapons, eq(playerInventory.itemId, weapons.id))
        .where(
          and(
            inArray(playerInventory.playerId, playerIds),
            eq(playerInventory.itemType, 'weapon'),
            eq(playerInventory.equippedSlot, 'weapon'),
          ),
        ),
      db
        .select({
          defense: vests.defense,
          durability: playerInventory.durability,
          inventoryItemId: playerInventory.id,
          playerId: playerInventory.playerId,
        })
        .from(playerInventory)
        .innerJoin(vests, eq(playerInventory.itemId, vests.id))
        .where(
          and(
            inArray(playerInventory.playerId, playerIds),
            eq(playerInventory.itemType, 'vest'),
            eq(playerInventory.equippedSlot, 'vest'),
          ),
        ),
    ]);

    const weaponByPlayerId = new Map(
      weaponRows.map((weapon) => [
        weapon.playerId,
        {
          durability: weapon.durability,
          inventoryItemId: weapon.inventoryItemId,
          power: weapon.power,
          proficiency: weapon.proficiency,
        } satisfies TerritoryParticipantWeapon,
      ]),
    );
    const vestByPlayerId = new Map(
      vestRows.map((vest) => [
        vest.playerId,
        {
          defense: vest.defense,
          durability: vest.durability,
          inventoryItemId: vest.inventoryItemId,
        } satisfies TerritoryParticipantVest,
      ]),
    );

    return memberRows.map((member) => ({
      attributes: {
        carisma: member.carisma,
        forca: member.forca,
        inteligencia: member.inteligencia,
        resistencia: member.resistencia,
      },
      equipment: {
        vest: vestByPlayerId.get(member.id) ?? null,
        weapon: weaponByPlayerId.get(member.id) ?? null,
      },
      factionId: member.factionId,
      player: {
        characterCreatedAt: member.characterCreatedAt,
        id: member.id,
        level: member.level,
        nickname: member.nickname,
        resources: {
          conceito: member.conceito,
          hp: member.hp,
          disposicao: member.disposicao,
          cansaco: member.cansaco,
        },
        vocation: member.vocation as VocationType,
      },
      rank: member.rank,
      regionId: member.regionId as RegionId,
    }));
  }

  async listFactionsByIds(factionIds: string[]): Promise<TerritoryFactionRecord[]> {
    if (factionIds.length === 0) {
      return [];
    }

    return db
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        id: factions.id,
        internalSatisfaction: factions.internalSatisfaction,
        name: factions.name,
        points: factions.points,
      })
      .from(factions)
      .where(inArray(factions.id, factionIds))
      .then((rows) =>
        rows.map((row) => ({
          abbreviation: row.abbreviation,
          bankMoney: Number.parseFloat(String(row.bankMoney)),
          id: row.id,
          internalSatisfaction: row.internalSatisfaction,
          name: row.name,
          points: row.points,
        })),
      );
  }

  async listFavelaPropertyStats(favelaIds: string[]): Promise<TerritoryFavelaPropertyStatsRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        activePropertyCount:
          sql<number>`coalesce(sum(case when ${properties.suspended} = false then 1 else 0 end), 0)`.as(
            'active_property_count',
          ),
        favelaId: properties.favelaId,
        soldiersCount:
          sql<number>`coalesce(sum(case when ${properties.suspended} = false then ${properties.soldiersCount} else 0 end), 0)`.as(
            'soldiers_count',
          ),
        suspendedPropertyCount:
          sql<number>`coalesce(sum(case when ${properties.suspended} = true then 1 else 0 end), 0)`.as(
            'suspended_property_count',
          ),
      })
      .from(properties)
      .where(and(isNotNull(properties.favelaId), inArray(properties.favelaId, favelaIds)))
      .groupBy(properties.favelaId);

    return rows.map((row) => ({
      activePropertyCount: Number(row.activePropertyCount ?? 0),
      favelaId: row.favelaId as string,
      soldiersCount: Number(row.soldiersCount ?? 0),
      suspendedPropertyCount: Number(row.suspendedPropertyCount ?? 0),
    }));
  }

  async listFavelaServices(favelaId: string): Promise<TerritoryFavelaServiceRecord[]> {
    const rows = await db
      .select({
        active: favelaServices.active,
        favelaId: favelaServices.favelaId,
        grossRevenueTotal: favelaServices.grossRevenueTotal,
        id: favelaServices.id,
        installedAt: favelaServices.installedAt,
        lastRevenueAt: favelaServices.lastRevenueAt,
        level: favelaServices.level,
        serviceType: favelaServices.serviceType,
      })
      .from(favelaServices)
      .where(eq(favelaServices.favelaId, favelaId));

    return rows.map((row) => ({
      active: row.active,
      favelaId: row.favelaId,
      grossRevenueTotal: Number.parseFloat(String(row.grossRevenueTotal)),
      id: row.id,
      installedAt: row.installedAt,
      lastRevenueAt: row.lastRevenueAt,
      level: row.level,
      serviceType: row.serviceType,
    }));
  }

  async listFavelaBanditReturns(favelaIds: string[]): Promise<TerritoryFavelaBanditReturnRecord[]> {
    if (favelaIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        favelaId: favelaBanditReturns.favelaId,
        id: favelaBanditReturns.id,
        quantity: favelaBanditReturns.quantity,
        releaseAt: favelaBanditReturns.releaseAt,
        returnFlavor: favelaBanditReturns.returnFlavor,
      })
      .from(favelaBanditReturns)
      .where(inArray(favelaBanditReturns.favelaId, favelaIds))
      .orderBy(desc(favelaBanditReturns.releaseAt));

    return rows.map((row) => ({
      favelaId: row.favelaId,
      id: row.id,
      quantity: row.quantity,
      releaseAt: row.releaseAt,
      returnFlavor: row.returnFlavor as BanditReturnFlavor,
    }));
  }

  async listFavelas(): Promise<TerritoryFavelaRecord[]> {
    const rows = await db
      .select({
        baseBanditTarget: favelas.baseBanditTarget,
        code: favelas.code,
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
        banditsDeadRecent: favelas.banditsDeadRecent,
        banditsSyncedAt: favelas.banditsSyncedAt,
        contestingFactionId: favelas.contestingFactionId,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        id: favelas.id,
        lastX9RollAt: favelas.lastX9RollAt,
        maxSoldiers: favelas.maxSoldiers,
        name: favelas.name,
        population: favelas.population,
        propinaDiscountRate: favelas.propinaDiscountRate,
        propinaDueDate: favelas.propinaDueDate,
        propinaLastPaidAt: favelas.propinaLastPaidAt,
        propinaNegotiatedAt: favelas.propinaNegotiatedAt,
        propinaNegotiatedByPlayerId: favelas.propinaNegotiatedByPlayerId,
        propinaValue: favelas.propinaValue,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
        satisfactionSyncedAt: favelas.satisfactionSyncedAt,
        stabilizationEndsAt: favelas.stabilizationEndsAt,
        state: favelas.state,
        stateControlledUntil: favelas.stateControlledUntil,
        warDeclaredAt: favelas.warDeclaredAt,
      })
      .from(favelas);

    return rows.map((row) => ({
      ...row,
      propinaDiscountRate: Number.parseFloat(String(row.propinaDiscountRate)),
      propinaValue: Number.parseFloat(String(row.propinaValue)),
      regionId: row.regionId as RegionId,
    }));
  }

  async installFavelaService(input: TerritoryFavelaServiceInstallPersistenceInput): Promise<void> {
    const definition = requireFavelaServiceDefinition(input.serviceType);

    await db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        throw new TerritoryError('not_found', 'Faccao nao encontrada.');
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));

      if (currentBankMoney < definition.installCost) {
        throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para instalar esse servico.');
      }

      const nextBankMoney = roundCurrency(currentBankMoney - definition.installCost);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, input.factionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.installedAt,
        description: `Instalacao do servico ${definition.label} em ${input.favelaName}.`,
        entryType: 'withdrawal',
        factionId: input.factionId,
        grossAmount: definition.installCost,
        netAmount: definition.installCost,
        originType: 'favela_service',
        playerId: input.playerId,
        propertyId: input.favelaId,
      });

      await tx.insert(favelaServices).values({
        active: true,
        favelaId: input.favelaId,
        grossRevenueTotal: '0',
        installedAt: input.installedAt,
        lastRevenueAt: input.installedAt,
        level: 1,
        serviceType: input.serviceType,
      });
    });
  }

  async createFactionWar(input: TerritoryFactionWarCreateInput): Promise<TerritoryFactionWarRecord> {
    return db.transaction(async (tx) => {
      const [attackerFaction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, input.attackerFactionId))
        .limit(1);

      if (!attackerFaction) {
        throw new TerritoryError('not_found', 'Faccao atacante nao encontrada.');
      }

      const currentBankMoney = Number.parseFloat(String(attackerFaction.bankMoney));

      if (currentBankMoney < FACTION_WAR_DECLARATION_COST) {
        throw new TerritoryError(
          'conflict',
          `O banco da facção não tem saldo para declarar a guerra. Custo: R$ ${FACTION_WAR_DECLARATION_COST.toLocaleString('pt-BR')} · saldo atual: R$ ${currentBankMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        );
      }

      const nextBankMoney = roundCurrency(currentBankMoney - FACTION_WAR_DECLARATION_COST);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, input.attackerFactionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.declaredAt,
        description: `Declaracao de guerra por ${input.favelaName}.`,
        entryType: 'withdrawal',
        factionId: input.attackerFactionId,
        grossAmount: FACTION_WAR_DECLARATION_COST,
        netAmount: FACTION_WAR_DECLARATION_COST,
        originType: 'manual',
        playerId: input.declaredByPlayerId,
        propertyId: input.favelaId,
      });

      const [created] = await tx
        .insert(factionWars)
        .values({
          attackerFactionId: input.attackerFactionId,
          attackerPreparationJson: {},
          attackerScore: 0,
          declaredAt: input.declaredAt,
          declaredByPlayerId: input.declaredByPlayerId,
          defenderFactionId: input.defenderFactionId,
          defenderPreparationJson: {},
          defenderScore: 0,
          favelaId: input.favelaId,
          nextRoundAt: input.startsAt,
          preparationEndsAt: input.preparationEndsAt,
          roundResultsJson: [],
          roundsResolved: 0,
          roundsTotal: FACTION_WAR_TOTAL_ROUNDS,
          startsAt: input.startsAt,
          status: 'declared',
        })
        .returning({
          attackerFactionId: factionWars.attackerFactionId,
          attackerPreparationJson: factionWars.attackerPreparationJson,
          attackerScore: factionWars.attackerScore,
          cooldownEndsAt: factionWars.cooldownEndsAt,
          declaredAt: factionWars.declaredAt,
          declaredByPlayerId: factionWars.declaredByPlayerId,
          defenderFactionId: factionWars.defenderFactionId,
          defenderPreparationJson: factionWars.defenderPreparationJson,
          defenderScore: factionWars.defenderScore,
          endedAt: factionWars.endedAt,
          favelaId: factionWars.favelaId,
          id: factionWars.id,
          lootMoney: factionWars.lootMoney,
          nextRoundAt: factionWars.nextRoundAt,
          preparationEndsAt: factionWars.preparationEndsAt,
          roundResultsJson: factionWars.roundResultsJson,
          roundsResolved: factionWars.roundsResolved,
          roundsTotal: factionWars.roundsTotal,
          startsAt: factionWars.startsAt,
          status: factionWars.status,
          winnerFactionId: factionWars.winnerFactionId,
        });

      await tx
        .update(favelas)
        .set({
          contestingFactionId: input.attackerFactionId,
          controllingFactionId: input.defenderFactionId,
          satisfactionSyncedAt: input.declaredAt,
          stabilizationEndsAt: null,
          state: 'at_war',
          stateControlledUntil: null,
          warDeclaredAt: input.declaredAt,
        })
        .where(eq(favelas.id, input.favelaId));

      if (!created) {
        throw new TerritoryError('conflict', 'Nao foi possivel registrar a guerra da faccao.');
      }

      return mapTerritoryFactionWarRow(created);
    });
  }

  async organizeFavelaBaile(
    input: TerritoryFavelaBailePersistenceInput,
  ): Promise<TerritoryFavelaBaileRecord> {
    return db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
          points: factions.points,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        throw new TerritoryError('not_found', 'Faccao nao encontrada para organizar o baile.');
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));

      if (currentBankMoney < input.budget) {
        throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para bancar o baile.');
      }

      const nextBankMoney = roundCurrency(currentBankMoney - input.budget);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
          points: faction.points + input.factionPointsDelta,
        })
        .where(eq(factions.id, input.factionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.organizedAt,
        description: `Organizacao de baile em ${input.favelaName}.`,
        entryType: 'withdrawal',
        factionId: input.factionId,
        grossAmount: input.budget,
        netAmount: input.budget,
        originType: 'manual',
        playerId: input.organizedByPlayerId,
        propertyId: input.favelaId,
      });

      await tx
        .update(favelas)
        .set({
          satisfaction: input.satisfactionAfter,
          satisfactionSyncedAt: input.organizedAt,
        })
        .where(eq(favelas.id, input.favelaId));

      if (input.cansacoBoostPercent > 0) {
        await tx
          .update(players)
          .set({
            cansaco: sql`least(100, ${players.cansaco} + ${input.cansacoBoostPercent})`,
          })
          .where(and(eq(players.factionId, input.factionId), eq(players.regionId, input.regionId)));
      }

      const [inserted] = await tx
        .insert(favelaBailes)
        .values({
          baileEndsAt: input.activeEndsAt,
          budget: input.budget.toFixed(2),
          cooldownEndsAt: input.cooldownEndsAt,
          entryPrice: input.entryPrice.toFixed(2),
          factionId: input.factionId,
          factionPointsDelta: input.factionPointsDelta,
          favelaId: input.favelaId,
          hangoverEndsAt: input.hangoverEndsAt,
          incidentCode: input.incidentCode,
          mcTier: input.mcTier,
          organizedAt: input.organizedAt,
          organizedByPlayerId: input.organizedByPlayerId,
          resultTier: input.resultTier,
          satisfactionDelta: input.satisfactionDelta,
          cansacoBoostPercent: input.cansacoBoostPercent,
        })
        .returning({
          activeEndsAt: favelaBailes.baileEndsAt,
          budget: favelaBailes.budget,
          cooldownEndsAt: favelaBailes.cooldownEndsAt,
          entryPrice: favelaBailes.entryPrice,
          factionId: favelaBailes.factionId,
          factionPointsDelta: favelaBailes.factionPointsDelta,
          favelaId: favelaBailes.favelaId,
          hangoverEndsAt: favelaBailes.hangoverEndsAt,
          id: favelaBailes.id,
          incidentCode: favelaBailes.incidentCode,
          mcTier: favelaBailes.mcTier,
          organizedAt: favelaBailes.organizedAt,
          organizedByPlayerId: favelaBailes.organizedByPlayerId,
          resultTier: favelaBailes.resultTier,
          satisfactionDelta: favelaBailes.satisfactionDelta,
          cansacoBoostPercent: favelaBailes.cansacoBoostPercent,
        });

      if (!inserted) {
        throw new TerritoryError('conflict', 'Nao foi possivel registrar o baile da favela.');
      }

      if (input.activeEndsAt && input.activeEndsAt.getTime() > input.organizedAt.getTime()) {
        await tx.insert(gameEvents).values({
          dataJson: {
            baileId: inserted.id,
            entryPrice: input.entryPrice,
            mcTier: input.mcTier,
            resultTier: input.resultTier,
          },
          endsAt: input.activeEndsAt,
          eventType: 'baile_cidade',
          favelaId: input.favelaId,
          regionId: input.regionId,
          startedAt: input.organizedAt,
        });
      }

      if (input.hangoverEndsAt && input.hangoverEndsAt.getTime() > input.organizedAt.getTime()) {
        await tx.insert(gameEvents).values({
          dataJson: {
            baileId: inserted.id,
            incidentCode: input.incidentCode,
            resultTier: input.resultTier,
          },
          endsAt: input.hangoverEndsAt,
          eventType: 'ressaca_baile',
          favelaId: input.favelaId,
          regionId: input.regionId,
          startedAt: input.activeEndsAt ?? input.organizedAt,
        });
      }

      return {
        activeEndsAt: inserted.activeEndsAt,
        budget: roundCurrency(Number.parseFloat(String(inserted.budget))),
        cooldownEndsAt: inserted.cooldownEndsAt,
        entryPrice: roundCurrency(Number.parseFloat(String(inserted.entryPrice))),
        factionId: inserted.factionId,
        factionPointsDelta: inserted.factionPointsDelta,
        favelaId: inserted.favelaId,
        hangoverEndsAt: inserted.hangoverEndsAt,
        id: inserted.id,
        incidentCode: inserted.incidentCode,
        mcTier: inserted.mcTier as FavelaBaileMcTier,
        organizedAt: inserted.organizedAt,
        organizedByPlayerId: inserted.organizedByPlayerId,
        resultTier: inserted.resultTier as FavelaBaileResultTier,
        satisfactionDelta: inserted.satisfactionDelta,
        cansacoBoostPercent: inserted.cansacoBoostPercent,
      };
    });
  }

  async prepareFactionWar(
    input: TerritoryFactionWarPreparePersistenceInput,
  ): Promise<TerritoryFactionWarRecord | null> {
    return db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        throw new TerritoryError('not_found', 'Faccao nao encontrada para preparar a guerra.');
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));

      if (currentBankMoney < input.budget) {
        throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para a preparacao da guerra.');
      }

      const nextBankMoney = roundCurrency(currentBankMoney - input.budget);
      const preparationJson = serializeTerritoryFactionWarPreparation({
        budget: input.budget,
        powerBonus: input.powerBonus,
        preparedAt: input.preparedAt,
        preparedByPlayerId: input.playerId,
        regionPresenceCount: input.regionPresenceCount,
        side: input.side,
        soldierCommitment: input.soldierCommitment,
      });

      if (input.budget > 0) {
        await tx
          .update(factions)
          .set({
            bankMoney: nextBankMoney.toFixed(2),
          })
          .where(eq(factions.id, input.factionId));

        await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
          balanceAfter: nextBankMoney,
          commissionAmount: 0,
          createdAt: input.preparedAt,
          description: `Preparacao de guerra por ${input.favelaName}.`,
          entryType: 'withdrawal',
          factionId: input.factionId,
          grossAmount: input.budget,
          netAmount: input.budget,
          originType: 'manual',
          playerId: input.playerId,
          propertyId: null,
        });
      }

      const [updated] = await tx
        .update(factionWars)
        .set(
          input.side === 'attacker'
            ? {
                attackerPreparationJson: preparationJson,
                status: 'preparing',
              }
            : {
                defenderPreparationJson: preparationJson,
                status: 'preparing',
              },
        )
        .where(eq(factionWars.id, input.warId))
        .returning({
          attackerFactionId: factionWars.attackerFactionId,
          attackerPreparationJson: factionWars.attackerPreparationJson,
          attackerScore: factionWars.attackerScore,
          cooldownEndsAt: factionWars.cooldownEndsAt,
          declaredAt: factionWars.declaredAt,
          declaredByPlayerId: factionWars.declaredByPlayerId,
          defenderFactionId: factionWars.defenderFactionId,
          defenderPreparationJson: factionWars.defenderPreparationJson,
          defenderScore: factionWars.defenderScore,
          endedAt: factionWars.endedAt,
          favelaId: factionWars.favelaId,
          id: factionWars.id,
          lootMoney: factionWars.lootMoney,
          nextRoundAt: factionWars.nextRoundAt,
          preparationEndsAt: factionWars.preparationEndsAt,
          roundResultsJson: factionWars.roundResultsJson,
          roundsResolved: factionWars.roundsResolved,
          roundsTotal: factionWars.roundsTotal,
          startsAt: factionWars.startsAt,
          status: factionWars.status,
          winnerFactionId: factionWars.winnerFactionId,
        });

      return updated ? mapTerritoryFactionWarRow(updated) : null;
    });
  }

  async persistConquestAttempt(input: TerritoryConquestPersistenceInput): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of input.participantUpdates) {
        await tx
          .update(players)
          .set({
            conceito: update.nextResources.conceito,
            hp: update.nextResources.hp,
            level: update.nextLevel,
            disposicao: update.nextResources.disposicao,
            cansaco: update.nextResources.cansaco,
          })
          .where(eq(players.id, update.playerId));

        await tx.insert(transactions).values({
          amount: '0.00',
          description: buildTerritoryConquestLogDescription(update),
          playerId: update.playerId,
          type: update.logType,
        });
      }

      if (input.nextFavelaState) {
        await tx
          .update(favelas)
          .set({
            contestingFactionId: input.nextFavelaState.contestingFactionId,
            controllingFactionId: input.nextFavelaState.controllingFactionId,
            lastX9RollAt: input.nextFavelaState.lastX9RollAt ?? undefined,
            propinaDiscountRate: input.nextFavelaState.propinaDiscountRate?.toFixed(4) ?? undefined,
            propinaDueDate: input.nextFavelaState.propinaDueDate ?? undefined,
            propinaLastPaidAt: input.nextFavelaState.propinaLastPaidAt ?? undefined,
            propinaNegotiatedAt: input.nextFavelaState.propinaNegotiatedAt ?? undefined,
            propinaNegotiatedByPlayerId: input.nextFavelaState.propinaNegotiatedByPlayerId ?? undefined,
            propinaValue:
              input.nextFavelaState.propinaValue !== undefined &&
              input.nextFavelaState.propinaValue !== null
                ? input.nextFavelaState.propinaValue.toFixed(2)
                : undefined,
            satisfaction: input.nextSatisfaction ?? undefined,
            satisfactionSyncedAt: input.nextSatisfactionSyncedAt ?? undefined,
            stabilizationEndsAt: input.nextFavelaState.stabilizationEndsAt,
            state: input.nextFavelaState.state,
            stateControlledUntil: input.nextFavelaState.stateControlledUntil,
            warDeclaredAt: input.nextFavelaState.warDeclaredAt,
          })
          .where(eq(favelas.id, input.favelaId));
      }
    });
  }

  async persistFavelaServiceSync(input: TerritoryFavelaServiceSyncPersistenceInput): Promise<void> {
    if (input.serviceUpdates.length === 0 && input.revenueDelta <= 0) {
      return;
    }

    await db.transaction(async (tx) => {
      for (const update of input.serviceUpdates) {
        await tx
          .update(favelaServices)
          .set({
            grossRevenueTotal: update.grossRevenueTotal.toFixed(2),
            lastRevenueAt: update.lastRevenueAt,
          })
          .where(eq(favelaServices.id, update.id));
      }

      if (input.revenueDelta <= 0 || !input.factionId) {
        return;
      }

      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
          id: factions.id,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        return;
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));
      const nextBankMoney = roundCurrency(currentBankMoney + input.revenueDelta);
      const pointsDelta = calculateFactionPointsDelta(input.revenueDelta);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
          points: sql`${factions.points} + ${pointsDelta}`,
        })
        .where(eq(factions.id, input.factionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.now,
        description: `Receita automatica de servicos de favela em ${input.favelaName}.`,
        entryType: 'service_income',
        factionId: input.factionId,
        grossAmount: input.revenueDelta,
        netAmount: input.revenueDelta,
        originType: 'favela_service',
        propertyId: null,
      });
    });
  }

  async persistFavelaSatisfactionSync(updates: TerritoryFavelaSatisfactionSyncUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(favelas)
          .set({
            satisfaction: update.nextSatisfaction,
            satisfactionSyncedAt: update.nextSyncedAt,
          })
          .where(eq(favelas.id, update.favelaId));
      }
    });
  }

  async persistFavelaBanditSync(input: {
    releasedReturnIds: string[];
    updates: TerritoryFavelaBanditSyncUpdate[];
  }): Promise<void> {
    if (input.releasedReturnIds.length === 0 && input.updates.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      if (input.releasedReturnIds.length > 0) {
        await tx.delete(favelaBanditReturns).where(inArray(favelaBanditReturns.id, input.releasedReturnIds));
      }

      for (const update of input.updates) {
        await tx
          .update(favelas)
          .set({
            banditsActive: update.banditsActive,
            banditsArrested: update.banditsArrested,
            banditsDeadRecent: update.banditsDeadRecent,
            banditsSyncedAt: update.banditsSyncedAt,
          })
          .where(eq(favelas.id, update.favelaId));
      }
    });
  }

  async persistFavelaPropinaSync(updates: TerritoryFavelaPropinaSyncUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(favelas)
          .set({
            propinaDiscountRate: update.nextDiscountRate.toFixed(4),
            propinaDueDate: update.nextDueDate,
            propinaLastPaidAt: update.nextLastPaidAt,
            propinaNegotiatedAt: update.nextNegotiatedAt,
            propinaNegotiatedByPlayerId: update.nextNegotiatedByPlayerId,
            propinaValue: update.nextPropinaValue.toFixed(2),
          })
          .where(eq(favelas.id, update.favelaId));
      }
    });
  }

  async persistFavelaX9RollSync(updates: TerritoryFavelaX9RollSyncUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(favelas)
          .set({
            lastX9RollAt: update.nextLastRollAt,
          })
          .where(eq(favelas.id, update.favelaId));
      }
    });
  }

  async payFavelaPropina(input: TerritoryFavelaPropinaPaymentInput): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        return false;
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));

      if (currentBankMoney < input.amount) {
        return false;
      }

      const nextBankMoney = roundCurrency(currentBankMoney - input.amount);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, input.factionId));

      await tx
        .update(favelas)
        .set({
          propinaDiscountRate: '0',
          propinaDueDate: input.nextDueAt,
          propinaLastPaidAt: input.now,
          propinaNegotiatedAt: null,
          propinaNegotiatedByPlayerId: null,
          propinaValue: input.nextPropinaValue.toFixed(2),
        })
        .where(eq(favelas.id, input.favelaId));

      await tx.insert(propinaPayments).values({
        amount: input.amount.toFixed(2),
        factionId: input.factionId,
        favelaId: input.favelaId,
        nextDue: input.nextDueAt,
        paidAt: input.now,
      });

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.now,
        description: 'Pagamento automatico de propina (arrego) territorial.',
        entryType: 'withdrawal',
        factionId: input.factionId,
        grossAmount: input.amount,
        netAmount: input.amount,
        originType: 'propina',
        playerId: input.playerId,
        propertyId: input.favelaId,
      });

      return true;
    });
  }

  async negotiateFavelaPropina(input: TerritoryFavelaPropinaNegotiationInput): Promise<boolean> {
    const result = await db
      .update(favelas)
      .set({
        propinaDiscountRate: input.discountRate.toFixed(4),
        propinaNegotiatedAt: input.negotiatedAt,
        propinaNegotiatedByPlayerId: input.negotiatedByPlayerId,
        propinaValue: input.nextPropinaValue.toFixed(2),
      })
      .where(eq(favelas.id, input.favelaId));

    return (result.rowCount ?? 0) > 0;
  }

  async createX9Warning(input: TerritoryCreateX9WarningInput): Promise<TerritoryX9EventRecord> {
    const [event] = await db
      .insert(x9Events)
      .values({
        favelaId: input.favelaId,
        status: input.status,
        triggeredAt: input.triggeredAt,
        warningEndsAt: input.warningEndsAt,
      })
      .returning({
        desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
        desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
        desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
        desenroloMoneySpent: x9Events.desenroloMoneySpent,
        desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
        desenroloPointsSpent: x9Events.desenroloPointsSpent,
        desenroloSucceeded: x9Events.desenroloSucceeded,
        drugsLost: x9Events.drugsLost,
        favelaId: x9Events.favelaId,
        id: x9Events.id,
        incursionAt: x9Events.incursionAt,
        moneyLost: x9Events.moneyLost,
        resolvedAt: x9Events.resolvedAt,
        soldierImpactJson: x9Events.soldierImpactJson,
        soldiersArrested: x9Events.soldiersArrested,
        soldiersReleaseAt: x9Events.soldiersReleaseAt,
        status: x9Events.status,
        triggeredAt: x9Events.triggeredAt,
        warningEndsAt: x9Events.warningEndsAt,
        weaponsLost: x9Events.weaponsLost,
      });

    if (!event) {
      throw new TerritoryError('conflict', 'Nao foi possivel registrar o aviso de X9.');
    }

    return mapTerritoryX9EventRow(event);
  }

  async applyX9Incursion(input: TerritoryApplyX9IncursionInput): Promise<TerritoryX9EventRecord | null> {
    return db.transaction(async (tx) => {
      for (const impact of input.cashImpacts) {
        if (impact.lostAmount <= 0) {
          continue;
        }

        switch (impact.kind) {
          case 'boca':
            await tx
              .update(bocaOperations)
              .set({ cashBalance: sql`${bocaOperations.cashBalance} - ${impact.lostAmount}` })
              .where(eq(bocaOperations.propertyId, impact.propertyId));
            break;
          case 'rave':
            await tx
              .update(raveOperations)
              .set({ cashBalance: sql`${raveOperations.cashBalance} - ${impact.lostAmount}` })
              .where(eq(raveOperations.propertyId, impact.propertyId));
            break;
          case 'puteiro':
            await tx
              .update(puteiroOperations)
              .set({ cashBalance: sql`${puteiroOperations.cashBalance} - ${impact.lostAmount}` })
              .where(eq(puteiroOperations.propertyId, impact.propertyId));
            break;
          case 'front_store':
            await tx
              .update(frontStoreOperations)
              .set({ cashBalance: sql`${frontStoreOperations.cashBalance} - ${impact.lostAmount}` })
              .where(eq(frontStoreOperations.propertyId, impact.propertyId));
            break;
          case 'slot_machine':
            await tx
              .update(slotMachineOperations)
              .set({ cashBalance: sql`${slotMachineOperations.cashBalance} - ${impact.lostAmount}` })
              .where(eq(slotMachineOperations.propertyId, impact.propertyId));
            break;
        }
      }

      for (const impact of input.drugImpacts) {
        if (impact.lostQuantity <= 0) {
          continue;
        }

        switch (impact.kind) {
          case 'boca':
            await tx
              .update(bocaDrugStocks)
              .set({
                quantity: sql`${bocaDrugStocks.quantity} - ${impact.lostQuantity}`,
              })
              .where(
                and(
                  eq(bocaDrugStocks.propertyId, impact.propertyId),
                  eq(bocaDrugStocks.drugId, impact.drugId),
                ),
              );
            break;
          case 'rave':
            await tx
              .update(raveDrugLineups)
              .set({
                quantity: sql`${raveDrugLineups.quantity} - ${impact.lostQuantity}`,
              })
              .where(
                and(
                  eq(raveDrugLineups.propertyId, impact.propertyId),
                  eq(raveDrugLineups.drugId, impact.drugId),
                ),
              );
            break;
          case 'factory':
            await tx
              .update(drugFactories)
              .set({
                storedOutput: sql`${drugFactories.storedOutput} - ${impact.lostQuantity}`,
              })
              .where(eq(drugFactories.propertyId, impact.propertyId));
            break;
        }
      }

      for (const impact of input.soldierImpacts) {
        if (impact.count <= 0) {
          continue;
        }

        await tx
          .update(properties)
          .set({
            soldiersCount: sql`${properties.soldiersCount} - ${impact.count}`,
          })
          .where(eq(properties.id, impact.propertyId));
      }

      await tx
        .update(favelas)
        .set({
          satisfaction: input.nextSatisfaction,
          satisfactionSyncedAt: input.incursionAt,
        })
        .where(eq(favelas.id, input.favelaId));

      const [event] = await tx
        .update(x9Events)
        .set({
          desenroloBaseMoneyCost: input.baseMoneyCost.toFixed(2),
          desenroloBasePointsCost: input.basePointsCost,
          drugsLost: input.drugsLost,
          incursionAt: input.incursionAt,
          moneyLost: input.moneyLost.toFixed(2),
          soldierImpactJson: input.soldierImpacts,
          soldiersArrested: input.soldiersArrested,
          soldiersReleaseAt: input.soldiersReleaseAt,
          status: 'pending_desenrolo',
          weaponsLost: input.weaponsLost,
        })
        .where(eq(x9Events.id, input.eventId))
        .returning({
          desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
          desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
          desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
          desenroloMoneySpent: x9Events.desenroloMoneySpent,
          desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
          desenroloPointsSpent: x9Events.desenroloPointsSpent,
          desenroloSucceeded: x9Events.desenroloSucceeded,
          drugsLost: x9Events.drugsLost,
          favelaId: x9Events.favelaId,
          id: x9Events.id,
          incursionAt: x9Events.incursionAt,
          moneyLost: x9Events.moneyLost,
          resolvedAt: x9Events.resolvedAt,
          soldierImpactJson: x9Events.soldierImpactJson,
          soldiersArrested: x9Events.soldiersArrested,
          soldiersReleaseAt: x9Events.soldiersReleaseAt,
          status: x9Events.status,
          triggeredAt: x9Events.triggeredAt,
          warningEndsAt: x9Events.warningEndsAt,
          weaponsLost: x9Events.weaponsLost,
        });

      return event ? mapTerritoryX9EventRow(event) : null;
    });
  }

  async resolveX9Desenrolo(input: TerritoryResolveX9DesenroloInput): Promise<TerritoryX9EventRecord | null> {
    return db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
          desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
          desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
          desenroloMoneySpent: x9Events.desenroloMoneySpent,
          desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
          desenroloPointsSpent: x9Events.desenroloPointsSpent,
          desenroloSucceeded: x9Events.desenroloSucceeded,
          drugsLost: x9Events.drugsLost,
          favelaId: x9Events.favelaId,
          id: x9Events.id,
          incursionAt: x9Events.incursionAt,
          moneyLost: x9Events.moneyLost,
          resolvedAt: x9Events.resolvedAt,
          soldierImpactJson: x9Events.soldierImpactJson,
          soldiersArrested: x9Events.soldiersArrested,
          soldiersReleaseAt: x9Events.soldiersReleaseAt,
          status: x9Events.status,
          triggeredAt: x9Events.triggeredAt,
          warningEndsAt: x9Events.warningEndsAt,
          weaponsLost: x9Events.weaponsLost,
        })
        .from(x9Events)
        .where(eq(x9Events.id, input.eventId))
        .limit(1);

      if (!event) {
        return null;
      }

      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
          points: factions.points,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        throw new TerritoryError('not_found', 'Faccao nao encontrada para desenrolo.');
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));
      const nextBankMoney = roundCurrency(currentBankMoney - input.moneySpent);
      const nextPoints = faction.points - input.pointsSpent;

      if (nextBankMoney < 0 || nextPoints < 0) {
        throw new TerritoryError('conflict', 'Recursos insuficientes para concluir o desenrolo.');
      }

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
          points: nextPoints,
        })
        .where(eq(factions.id, input.factionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.attemptedAt,
        description: 'Pagamento de desenrolo apos incursao policial de X9.',
        entryType: 'withdrawal',
        factionId: input.factionId,
        grossAmount: input.moneySpent,
        netAmount: input.moneySpent,
        originType: 'manual',
        playerId: input.actorPlayerId,
        propertyId: null,
      });

      if (input.success) {
        const soldierImpacts = parseTerritoryX9SoldierImpactJson(event.soldierImpactJson);

        for (const impact of soldierImpacts) {
          if (impact.count <= 0) {
            continue;
          }

          await tx
            .update(properties)
            .set({
              soldiersCount: sql`${properties.soldiersCount} + ${impact.count}`,
            })
            .where(eq(properties.id, impact.propertyId));
        }
      }

      const [updated] = await tx
        .update(x9Events)
        .set({
          desenroloAttemptedAt: input.attemptedAt,
          desenroloMoneySpent: input.moneySpent.toFixed(2),
          desenroloNegotiatorPlayerId: input.actorPlayerId,
          desenroloPointsSpent: input.pointsSpent,
          desenroloSucceeded: input.success,
          resolvedAt: input.success ? input.attemptedAt : null,
          soldiersReleaseAt: input.releaseAt,
          status: input.success ? 'resolved' : 'jailed',
        })
        .where(eq(x9Events.id, input.eventId))
        .returning({
          desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
          desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
          desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
          desenroloMoneySpent: x9Events.desenroloMoneySpent,
          desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
          desenroloPointsSpent: x9Events.desenroloPointsSpent,
          desenroloSucceeded: x9Events.desenroloSucceeded,
          drugsLost: x9Events.drugsLost,
          favelaId: x9Events.favelaId,
          id: x9Events.id,
          incursionAt: x9Events.incursionAt,
          moneyLost: x9Events.moneyLost,
          resolvedAt: x9Events.resolvedAt,
          soldierImpactJson: x9Events.soldierImpactJson,
          soldiersArrested: x9Events.soldiersArrested,
          soldiersReleaseAt: x9Events.soldiersReleaseAt,
          status: x9Events.status,
          triggeredAt: x9Events.triggeredAt,
          warningEndsAt: x9Events.warningEndsAt,
          weaponsLost: x9Events.weaponsLost,
        });

      return updated ? mapTerritoryX9EventRow(updated) : null;
    });
  }

  async releaseX9Soldiers(eventId: string, releasedAt: Date): Promise<TerritoryX9EventRecord | null> {
    return db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
          desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
          desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
          desenroloMoneySpent: x9Events.desenroloMoneySpent,
          desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
          desenroloPointsSpent: x9Events.desenroloPointsSpent,
          desenroloSucceeded: x9Events.desenroloSucceeded,
          drugsLost: x9Events.drugsLost,
          favelaId: x9Events.favelaId,
          id: x9Events.id,
          incursionAt: x9Events.incursionAt,
          moneyLost: x9Events.moneyLost,
          resolvedAt: x9Events.resolvedAt,
          soldierImpactJson: x9Events.soldierImpactJson,
          soldiersArrested: x9Events.soldiersArrested,
          soldiersReleaseAt: x9Events.soldiersReleaseAt,
          status: x9Events.status,
          triggeredAt: x9Events.triggeredAt,
          warningEndsAt: x9Events.warningEndsAt,
          weaponsLost: x9Events.weaponsLost,
        })
        .from(x9Events)
        .where(eq(x9Events.id, eventId))
        .limit(1);

      if (!event) {
        return null;
      }

      const soldierImpacts = parseTerritoryX9SoldierImpactJson(event.soldierImpactJson);

      for (const impact of soldierImpacts) {
        if (impact.count <= 0) {
          continue;
        }

        await tx
          .update(properties)
          .set({
            soldiersCount: sql`${properties.soldiersCount} + ${impact.count}`,
          })
          .where(eq(properties.id, impact.propertyId));
      }

      const [updated] = await tx
        .update(x9Events)
        .set({
          resolvedAt: releasedAt,
          status: 'resolved',
        })
        .where(eq(x9Events.id, eventId))
        .returning({
          desenroloAttemptedAt: x9Events.desenroloAttemptedAt,
          desenroloBaseMoneyCost: x9Events.desenroloBaseMoneyCost,
          desenroloBasePointsCost: x9Events.desenroloBasePointsCost,
          desenroloMoneySpent: x9Events.desenroloMoneySpent,
          desenroloNegotiatorPlayerId: x9Events.desenroloNegotiatorPlayerId,
          desenroloPointsSpent: x9Events.desenroloPointsSpent,
          desenroloSucceeded: x9Events.desenroloSucceeded,
          drugsLost: x9Events.drugsLost,
          favelaId: x9Events.favelaId,
          id: x9Events.id,
          incursionAt: x9Events.incursionAt,
          moneyLost: x9Events.moneyLost,
          resolvedAt: x9Events.resolvedAt,
          soldierImpactJson: x9Events.soldierImpactJson,
          soldiersArrested: x9Events.soldiersArrested,
          soldiersReleaseAt: x9Events.soldiersReleaseAt,
          status: x9Events.status,
          triggeredAt: x9Events.triggeredAt,
          warningEndsAt: x9Events.warningEndsAt,
          weaponsLost: x9Events.weaponsLost,
        });

      return updated ? mapTerritoryX9EventRow(updated) : null;
    });
  }

  async persistFactionWarRound(
    input: TerritoryFactionWarRoundPersistenceInput,
  ): Promise<TerritoryFactionWarRecord | null> {
    return db.transaction(async (tx) => {
      const [attackerFaction, defenderFaction] = await Promise.all([
        tx
          .select({
            bankMoney: factions.bankMoney,
            points: factions.points,
          })
          .from(factions)
          .where(eq(factions.id, input.attackerFactionId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        tx
          .select({
            bankMoney: factions.bankMoney,
            points: factions.points,
          })
          .from(factions)
          .where(eq(factions.id, input.defenderFactionId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      if (!attackerFaction || !defenderFaction) {
        throw new TerritoryError('not_found', 'Faccao da guerra nao encontrada.');
      }

      for (const participant of input.participantUpdates) {
        await tx
          .update(players)
          .set({
            conceito: participant.nextResources.conceito,
            hp: participant.nextResources.hp,
            level: participant.nextLevel,
            disposicao: participant.nextResources.disposicao,
            cansaco: participant.nextResources.cansaco,
          })
          .where(eq(players.id, participant.playerId));
      }

      const attackerNextBankMoney = roundCurrency(
        Number.parseFloat(String(attackerFaction.bankMoney)) + input.attackerRewardMoney,
      );

      await tx
        .update(factions)
        .set({
          bankMoney: attackerNextBankMoney.toFixed(2),
          points: Math.max(0, attackerFaction.points + input.attackerPointsDelta),
        })
        .where(eq(factions.id, input.attackerFactionId));

      await tx
        .update(factions)
        .set({
          points: Math.max(0, defenderFaction.points + input.defenderPointsDelta),
        })
        .where(eq(factions.id, input.defenderFactionId));

      if (input.attackerRewardMoney > 0) {
        await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
          balanceAfter: attackerNextBankMoney,
          commissionAmount: 0,
          createdAt: input.now,
          description: `Espolio de guerra conquistado em ${input.favelaName}.`,
          entryType: 'deposit',
          factionId: input.attackerFactionId,
          grossAmount: input.attackerRewardMoney,
          netAmount: input.attackerRewardMoney,
          originType: 'manual',
          playerId: null,
          propertyId: input.favelaId,
        });
      }

      if (input.nextFavelaState) {
        await tx
          .update(favelas)
          .set({
            contestingFactionId: input.nextFavelaState.contestingFactionId,
            controllingFactionId: input.nextFavelaState.controllingFactionId,
            lastX9RollAt: input.nextFavelaState.lastX9RollAt ?? undefined,
            propinaDiscountRate: input.nextFavelaState.propinaDiscountRate?.toFixed(4) ?? undefined,
            propinaDueDate: input.nextFavelaState.propinaDueDate ?? undefined,
            propinaLastPaidAt: input.nextFavelaState.propinaLastPaidAt ?? undefined,
            propinaNegotiatedAt: input.nextFavelaState.propinaNegotiatedAt ?? undefined,
            propinaNegotiatedByPlayerId:
              input.nextFavelaState.propinaNegotiatedByPlayerId ?? undefined,
            propinaValue:
              input.nextFavelaState.propinaValue !== undefined &&
              input.nextFavelaState.propinaValue !== null
                ? input.nextFavelaState.propinaValue.toFixed(2)
                : undefined,
            satisfaction:
              input.satisfactionAfter !== null ? input.satisfactionAfter : undefined,
            satisfactionSyncedAt: input.satisfactionSyncedAt ?? undefined,
            stabilizationEndsAt: input.nextFavelaState.stabilizationEndsAt,
            state: input.nextFavelaState.state,
            stateControlledUntil: input.nextFavelaState.stateControlledUntil,
            warDeclaredAt: input.nextFavelaState.warDeclaredAt,
          })
          .where(eq(favelas.id, input.favelaId));
      }

      const [updated] = await tx
        .update(factionWars)
        .set({
          attackerScore: input.nextAttackerScore,
          cooldownEndsAt: input.nextCooldownEndsAt,
          defenderScore: input.nextDefenderScore,
          endedAt: input.endedAt,
          lootMoney: input.attackerRewardMoney.toFixed(2),
          nextRoundAt: input.nextNextRoundAt,
          roundResultsJson: input.nextRounds.map((round) => serializeTerritoryFactionWarRound(round)),
          roundsResolved: input.nextRoundsResolved,
          status: input.nextStatus,
          winnerFactionId: input.nextWinnerFactionId,
        })
        .where(eq(factionWars.id, input.warId))
        .returning({
          attackerFactionId: factionWars.attackerFactionId,
          attackerPreparationJson: factionWars.attackerPreparationJson,
          attackerScore: factionWars.attackerScore,
          cooldownEndsAt: factionWars.cooldownEndsAt,
          declaredAt: factionWars.declaredAt,
          declaredByPlayerId: factionWars.declaredByPlayerId,
          defenderFactionId: factionWars.defenderFactionId,
          defenderPreparationJson: factionWars.defenderPreparationJson,
          defenderScore: factionWars.defenderScore,
          endedAt: factionWars.endedAt,
          favelaId: factionWars.favelaId,
          id: factionWars.id,
          lootMoney: factionWars.lootMoney,
          nextRoundAt: factionWars.nextRoundAt,
          preparationEndsAt: factionWars.preparationEndsAt,
          roundResultsJson: factionWars.roundResultsJson,
          roundsResolved: factionWars.roundsResolved,
          roundsTotal: factionWars.roundsTotal,
          startsAt: factionWars.startsAt,
          status: factionWars.status,
          winnerFactionId: factionWars.winnerFactionId,
        });

      return updated ? mapTerritoryFactionWarRow(updated) : null;
    });
  }

  async updateFactionWarStatus(
    warId: string,
    nextStatus: FactionWarStatus,
    nextRoundAt: Date | null,
  ): Promise<TerritoryFactionWarRecord | null> {
    const [updated] = await db
      .update(factionWars)
      .set({
        nextRoundAt,
        status: nextStatus,
      })
      .where(eq(factionWars.id, warId))
      .returning({
        attackerFactionId: factionWars.attackerFactionId,
        attackerPreparationJson: factionWars.attackerPreparationJson,
        attackerScore: factionWars.attackerScore,
        cooldownEndsAt: factionWars.cooldownEndsAt,
        declaredAt: factionWars.declaredAt,
        declaredByPlayerId: factionWars.declaredByPlayerId,
        defenderFactionId: factionWars.defenderFactionId,
        defenderPreparationJson: factionWars.defenderPreparationJson,
        defenderScore: factionWars.defenderScore,
        endedAt: factionWars.endedAt,
        favelaId: factionWars.favelaId,
        id: factionWars.id,
        lootMoney: factionWars.lootMoney,
        nextRoundAt: factionWars.nextRoundAt,
        preparationEndsAt: factionWars.preparationEndsAt,
        roundResultsJson: factionWars.roundResultsJson,
        roundsResolved: factionWars.roundsResolved,
        roundsTotal: factionWars.roundsTotal,
        startsAt: factionWars.startsAt,
        status: factionWars.status,
        winnerFactionId: factionWars.winnerFactionId,
      });

    return updated ? mapTerritoryFactionWarRow(updated) : null;
  }

  async upgradeFavelaService(input: TerritoryFavelaServiceUpgradePersistenceInput): Promise<void> {
    const definition = requireFavelaServiceDefinition(input.serviceType);
    const upgradeCost = resolveFavelaServiceUpgradeCost(definition, input.nextLevel - 1);

    await db.transaction(async (tx) => {
      const [faction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, input.factionId))
        .limit(1);

      if (!faction) {
        throw new TerritoryError('not_found', 'Faccao nao encontrada.');
      }

      const currentBankMoney = Number.parseFloat(String(faction.bankMoney));

      if (currentBankMoney < upgradeCost) {
        throw new TerritoryError('conflict', 'O banco da faccao nao tem saldo para melhorar esse servico.');
      }

      const nextBankMoney = roundCurrency(currentBankMoney - upgradeCost);

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, input.factionId));

      await insertFactionBankLedgerEntry(tx as unknown as typeof db, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: input.now,
        description: `Upgrade do servico ${definition.label} em ${input.favelaName} para nivel ${input.nextLevel}.`,
        entryType: 'withdrawal',
        factionId: input.factionId,
        grossAmount: upgradeCost,
        netAmount: upgradeCost,
        originType: 'favela_service',
        playerId: input.playerId,
        propertyId: input.favelaId,
      });

      await tx
        .update(favelaServices)
        .set({
          level: input.nextLevel,
        })
        .where(
          and(
            eq(favelaServices.favelaId, input.favelaId),
            eq(favelaServices.serviceType, input.serviceType),
          ),
        );

      await tx
        .update(favelas)
        .set({
          satisfaction: input.satisfactionAfter,
          satisfactionSyncedAt: input.now,
        })
        .where(eq(favelas.id, input.favelaId));
    });
  }

  async updateFavelaState(
    favelaId: string,
    input: TerritoryFavelaStateUpdateInput,
  ): Promise<boolean> {
    const result = await db
      .update(favelas)
      .set({
        contestingFactionId: input.contestingFactionId,
        controllingFactionId: input.controllingFactionId,
        lastX9RollAt: input.lastX9RollAt ?? undefined,
        propinaDiscountRate: input.propinaDiscountRate?.toFixed(4) ?? undefined,
        propinaDueDate: input.propinaDueDate ?? undefined,
        propinaLastPaidAt: input.propinaLastPaidAt ?? undefined,
        propinaNegotiatedAt: input.propinaNegotiatedAt ?? undefined,
        propinaNegotiatedByPlayerId: input.propinaNegotiatedByPlayerId ?? undefined,
        propinaValue:
          input.propinaValue !== undefined && input.propinaValue !== null
            ? input.propinaValue.toFixed(2)
            : undefined,
        satisfactionSyncedAt: input.satisfactionSyncedAt ?? undefined,
        stabilizationEndsAt: input.stabilizationEndsAt,
        state: input.state,
        stateControlledUntil: input.stateControlledUntil,
        warDeclaredAt: input.warDeclaredAt,
      })
      .where(eq(favelas.id, favelaId));

    return (result.rowCount ?? 0) > 0;
  }
}
