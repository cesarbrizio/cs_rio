import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  FAVELA_SERVICE_DEFINITIONS,
  type FactionWarRoundOutcome,
  type FactionWarSide,
  type FactionWarStatus,
  type FavelaBaileMcTier,
  type FavelaBaileResultTier,
  RegionId,
  VocationType,
  type FactionRank,
  type FavelaControlState,
  type FavelaServiceType,
  type FavelaStateTransitionInput,
} from '@cs-rio/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ActionIdempotency } from '../src/api/action-idempotency.js';
import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createTerritoryRoutes } from '../src/api/routes/territory.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  TerritoryService,
  type TerritoryRepository,
} from '../src/services/territory.js';

interface InMemoryFactionRecord {
  abbreviation: string;
  bankMoney: number;
  id: string;
  internalSatisfaction: number;
  name: string;
  points: number;
}

interface InMemoryFavelaRecord {
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  banditsSyncedAt: Date;
  code: string;
  contestingFactionId: string | null;
  controllingFactionId: string | null;
  difficulty: number;
  id: string;
  lastX9RollAt: Date;
  maxSoldiers: number;
  name: string;
  population: number;
  propinaDiscountRate: number;
  propinaDueDate: Date | null;
  propinaLastPaidAt: Date | null;
  propinaNegotiatedAt: Date | null;
  propinaNegotiatedByPlayerId: string | null;
  propinaValue: number;
  regionId: RegionId;
  satisfaction: number;
  satisfactionSyncedAt: Date;
  stabilizationEndsAt: Date | null;
  state: FavelaControlState;
  stateControlledUntil: Date | null;
  warDeclaredAt: Date | null;
}

interface InMemoryLoadout {
  proficiency: number;
  vestDefense: number;
  weaponPower: number;
}

interface InMemoryFavelaServiceRecord {
  active: boolean;
  favelaId: string;
  grossRevenueTotal: number;
  id: string;
  installedAt: Date;
  lastRevenueAt: Date;
  level: number;
  serviceType: FavelaServiceType;
}

interface InMemoryRegionRecord {
  densityIndex: number;
  id: RegionId;
  operationCostMultiplier: number;
  policePressure: number;
  wealthIndex: number;
}

interface InMemoryFavelaPropertyStatsRecord {
  activePropertyCount: number;
  favelaId: string;
  soldiersCount: number;
  suspendedPropertyCount: number;
}

interface InMemoryFavelaBanditReturnRecord {
  favelaId: string;
  id: string;
  quantity: number;
  releaseAt: Date;
  returnFlavor: 'audiencia_custodia' | 'habeas_corpus' | 'lili_cantou';
}

interface InMemorySatisfactionEventRecord {
  endsAt?: Date;
  eventType: 'baile_cidade' | 'blitz_pm' | 'operacao_policial';
  favelaId: string | null;
  regionId: RegionId | null;
  startedAt?: Date;
}

interface InMemoryFavelaBaileRecord {
  activeEndsAt: Date | null;
  budget: number;
  cooldownEndsAt: Date;
  entryPrice: number;
  factionId: string;
  factionPointsDelta: number;
  favelaId: string;
  hangoverEndsAt: Date | null;
  id: string;
  incidentCode: string | null;
  mcTier: FavelaBaileMcTier;
  organizedAt: Date;
  organizedByPlayerId: string;
  resultTier: FavelaBaileResultTier;
  satisfactionDelta: number;
  cansacoBoostPercent: number;
}

interface InMemoryFactionWarPreparationRecord {
  budget: number;
  powerBonus: number;
  preparedAt: Date;
  preparedByPlayerId: string;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
}

interface InMemoryFactionWarRoundRecord {
  attackerHpLoss: number;
  attackerDisposicaoLoss: number;
  attackerPower: number;
  attackerCansacoLoss: number;
  defenderHpLoss: number;
  defenderDisposicaoLoss: number;
  defenderPower: number;
  defenderCansacoLoss: number;
  message: string;
  outcome: FactionWarRoundOutcome;
  resolvedAt: Date;
  roundNumber: number;
}

interface InMemoryFactionWarRecord {
  attackerFactionId: string;
  attackerPreparation: InMemoryFactionWarPreparationRecord | null;
  attackerScore: number;
  cooldownEndsAt: Date | null;
  declaredAt: Date;
  declaredByPlayerId: string | null;
  defenderFactionId: string;
  defenderPreparation: InMemoryFactionWarPreparationRecord | null;
  defenderScore: number;
  endedAt: Date | null;
  favelaId: string;
  id: string;
  lootMoney: number;
  nextRoundAt: Date | null;
  preparationEndsAt: Date | null;
  rounds: InMemoryFactionWarRoundRecord[];
  roundsResolved: number;
  roundsTotal: number;
  startsAt: Date | null;
  status: FactionWarStatus;
  winnerFactionId: string | null;
}

interface InMemoryX9SoldierImpactRecord {
  count: number;
  propertyId: string;
}

interface InMemoryX9EventRecord {
  desenroloAttemptedAt: Date | null;
  desenroloBaseMoneyCost: number;
  desenroloBasePointsCost: number;
  desenroloMoneySpent: number;
  desenroloNegotiatorPlayerId: string | null;
  desenroloPointsSpent: number;
  desenroloSucceeded: boolean | null;
  drugsLost: number;
  favelaId: string;
  id: string;
  incursionAt: Date | null;
  moneyLost: number;
  resolvedAt: Date | null;
  soldierImpacts: InMemoryX9SoldierImpactRecord[];
  soldiersArrested: number;
  soldiersReleaseAt: Date | null;
  status: 'warning' | 'pending_desenrolo' | 'jailed' | 'resolved';
  triggeredAt: Date;
  warningEndsAt: Date | null;
  weaponsLost: number;
}

interface InMemoryX9CashTargetRecord {
  cashBalance: number;
  kind: 'boca' | 'front_store' | 'puteiro' | 'rave' | 'slot_machine';
  propertyId: string;
}

interface InMemoryX9DrugTargetRecord {
  drugId: string;
  kind: 'boca' | 'factory' | 'rave';
  propertyId: string;
  quantity: number;
}

interface InMemoryX9SoldierTargetRecord {
  propertyId: string;
  soldiersCount: number;
}

interface InMemoryFavelaX9Exposure {
  cashTargets: InMemoryX9CashTargetRecord[];
  drugTargets: InMemoryX9DrugTargetRecord[];
  soldierTargets: InMemoryX9SoldierTargetRecord[];
}

interface TestState {
  activeSatisfactionEvents: InMemorySatisfactionEventRecord[];
  defaultFactionId: string | null;
  defaultFactionRank: FactionRank | null;
  factions: Map<string, InMemoryFactionRecord>;
  favelaBailes: Map<string, InMemoryFavelaBaileRecord>;
  favelaBanditReturns: Map<string, InMemoryFavelaBanditReturnRecord>;
  factionWars: Map<string, InMemoryFactionWarRecord>;
  favelas: Map<string, InMemoryFavelaRecord>;
  favelaPropertyStats: Map<string, InMemoryFavelaPropertyStatsRecord>;
  favelaServices: Map<string, InMemoryFavelaServiceRecord>;
  playerLoadouts: Map<string, InMemoryLoadout>;
  playerRanks: Map<string, FactionRank>;
  players: Map<string, AuthPlayerRecord>;
  regions: Map<RegionId, InMemoryRegionRecord>;
  x9Events: Map<string, InMemoryX9EventRecord>;
  x9ExposureByFavela: Map<string, InMemoryFavelaX9Exposure>;
}

class InMemoryAuthTerritoryRepository implements AuthRepository, TerritoryRepository {
  constructor(private readonly state: TestState) {}

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player = buildPlayerRecord({
      email: input.email,
      factionId: this.state.defaultFactionId,
      id: randomUUID(),
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      regionId: RegionId.Centro,
    });

    this.state.players.set(player.id, player);

    if (player.factionId && this.state.defaultFactionRank) {
      this.state.playerRanks.set(player.id, this.state.defaultFactionRank);
      this.state.playerLoadouts.set(player.id, {
        proficiency: 30,
        vestDefense: 2500,
        weaponPower: 10000,
      });
    }

    return { ...player };
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async getFavela(favelaId: string): Promise<InMemoryFavelaRecord | null> {
    const favela = this.state.favelas.get(favelaId);
    return favela ? { ...favela } : null;
  }

  async getFaction(factionId: string): Promise<InMemoryFactionRecord | null> {
    const faction = this.state.factions.get(factionId);
    return faction ? { ...faction } : null;
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      carisma: player.carisma,
      characterCreatedAt: player.characterCreatedAt,
      conceito: player.conceito,
      factionId: player.factionId,
      id: player.id,
      level: player.level,
      nickname: player.nickname,
      rank: player.factionId ? (this.state.playerRanks.get(player.id) ?? this.state.defaultFactionRank) : null,
      vocation: player.vocation,
    };
  }

  async getRegion(regionId: RegionId): Promise<InMemoryRegionRecord | null> {
    const region = this.state.regions.get(regionId);
    return region ? { ...region } : null;
  }

  async getFavelaX9Exposure(favelaId: string): Promise<InMemoryFavelaX9Exposure> {
    return cloneX9Exposure(this.state.x9ExposureByFavela.get(favelaId) ?? buildEmptyX9Exposure());
  }

  async listActiveSatisfactionEvents(
    regionIds: RegionId[],
    favelaIds: string[],
    now: Date,
  ): Promise<InMemorySatisfactionEventRecord[]> {
    return this.state.activeSatisfactionEvents
      .filter(
        (event) =>
          (!event.startedAt || event.startedAt.getTime() <= now.getTime()) &&
          (!event.endsAt || event.endsAt.getTime() >= now.getTime()) &&
          (
            (event.regionId !== null && regionIds.includes(event.regionId)) ||
            (event.favelaId !== null && favelaIds.includes(event.favelaId))
          ),
      )
      .map((event) => ({ ...event }));
  }

  async listAllFavelaServices(favelaIds: string[]): Promise<InMemoryFavelaServiceRecord[]> {
    return [...this.state.favelaServices.values()]
      .filter((service) => favelaIds.includes(service.favelaId))
      .map((service) => ({
        ...service,
        installedAt: new Date(service.installedAt),
        lastRevenueAt: new Date(service.lastRevenueAt),
      }));
  }

  async listLatestBailes(favelaIds: string[]): Promise<InMemoryFavelaBaileRecord[]> {
    return [...this.state.favelaBailes.values()]
      .filter((record) => favelaIds.includes(record.favelaId))
      .map((record) => ({
        ...record,
        activeEndsAt: record.activeEndsAt ? new Date(record.activeEndsAt) : null,
        cooldownEndsAt: new Date(record.cooldownEndsAt),
        hangoverEndsAt: record.hangoverEndsAt ? new Date(record.hangoverEndsAt) : null,
        organizedAt: new Date(record.organizedAt),
      }));
  }

  async findLatestFactionWarBetweenFactions(
    attackerFactionId: string,
    defenderFactionId: string,
  ): Promise<InMemoryFactionWarRecord | null> {
    const wars = [...this.state.factionWars.values()]
      .filter(
        (war) =>
          (war.attackerFactionId === attackerFactionId && war.defenderFactionId === defenderFactionId) ||
          (war.attackerFactionId === defenderFactionId && war.defenderFactionId === attackerFactionId),
      )
      .sort((left, right) => right.declaredAt.getTime() - left.declaredAt.getTime());

    return wars[0] ? cloneFactionWar(wars[0]) : null;
  }

  async listFactionWars(favelaIds: string[]): Promise<InMemoryFactionWarRecord[]> {
    return [...this.state.factionWars.values()]
      .filter((war) => favelaIds.includes(war.favelaId))
      .sort((left, right) => right.declaredAt.getTime() - left.declaredAt.getTime())
      .map((war) => cloneFactionWar(war));
  }

  async listFactionParticipants(factionId: string) {
    return [...this.state.players.values()]
      .filter((player) => player.factionId === factionId)
      .map((player) => {
        const loadout = this.state.playerLoadouts.get(player.id) ?? {
          proficiency: 0,
          vestDefense: 0,
          weaponPower: 0,
        };

        return {
          attributes: {
            carisma: player.carisma,
            forca: player.forca,
            inteligencia: player.inteligencia,
            resistencia: player.resistencia,
          },
          equipment: {
            vest:
              loadout.vestDefense > 0
                ? {
                    defense: loadout.vestDefense,
                    durability: 200,
                    inventoryItemId: `vest-${player.id}`,
                  }
                : null,
            weapon:
              loadout.weaponPower > 0
                ? {
                    durability: 250,
                    inventoryItemId: `weapon-${player.id}`,
                    power: loadout.weaponPower,
                    proficiency: loadout.proficiency,
                  }
                : null,
          },
          factionId,
          player: {
            characterCreatedAt: player.characterCreatedAt,
            id: player.id,
            level: player.level,
            nickname: player.nickname,
            resources: {
              conceito: player.conceito,
              hp: player.hp,
              disposicao: player.disposicao,
              cansaco: player.cansaco,
            },
            vocation: player.vocation,
          },
          rank: this.state.playerRanks.get(player.id) ?? this.state.defaultFactionRank ?? 'cria',
          regionId: player.regionId,
        };
      });
  }

  async listFactionsByIds(factionIds: string[]) {
    return factionIds
      .map((factionId) => this.state.factions.get(factionId))
      .filter((faction): faction is InMemoryFactionRecord => faction !== undefined)
      .map((faction) => ({ ...faction }));
  }

  async listFavelaBanditReturns(favelaIds: string[]) {
    return [...this.state.favelaBanditReturns.values()]
      .filter((entry) => favelaIds.includes(entry.favelaId))
      .map((entry) => ({
        ...entry,
        releaseAt: new Date(entry.releaseAt),
      }));
  }

  async listFavelaPropertyStats(favelaIds: string[]): Promise<InMemoryFavelaPropertyStatsRecord[]> {
    return favelaIds
      .map((favelaId) => this.state.favelaPropertyStats.get(favelaId))
      .filter((entry): entry is InMemoryFavelaPropertyStatsRecord => entry !== undefined)
      .map((entry) => ({ ...entry }));
  }

  async listFavelaServices(favelaId: string): Promise<InMemoryFavelaServiceRecord[]> {
    return [...this.state.favelaServices.values()]
      .filter((service) => service.favelaId === favelaId)
      .map((service) => ({
        ...service,
        installedAt: new Date(service.installedAt),
        lastRevenueAt: new Date(service.lastRevenueAt),
      }));
  }

  async listFavelas(): Promise<InMemoryFavelaRecord[]> {
    return [...this.state.favelas.values()].map((favela) => ({ ...favela }));
  }

  async listX9Events(favelaIds: string[]): Promise<InMemoryX9EventRecord[]> {
    return [...this.state.x9Events.values()]
      .filter((event) => favelaIds.includes(event.favelaId))
      .map((event) => cloneX9Event(event));
  }

  async installFavelaService(input: {
    factionId: string;
    favelaId: string;
    favelaName: string;
    installedAt: Date;
    playerId: string;
    serviceType: FavelaServiceType;
  }): Promise<void> {
    const faction = this.state.factions.get(input.factionId);

    if (!faction) {
      return;
    }

    const definition = resolveServiceDefinition(input.serviceType);
    faction.bankMoney = roundCurrency(faction.bankMoney - definition.installCost);

    this.state.favelaServices.set(`${input.favelaId}:${input.serviceType}`, {
      active: true,
      favelaId: input.favelaId,
      grossRevenueTotal: 0,
      id: `${input.favelaId}:${input.serviceType}`,
      installedAt: new Date(input.installedAt),
      lastRevenueAt: new Date(input.installedAt),
      level: 1,
      serviceType: input.serviceType,
    });
  }

  async organizeFavelaBaile(input: {
    activeEndsAt: Date | null;
    budget: number;
    cooldownEndsAt: Date;
    entryPrice: number;
    factionId: string;
    factionPointsDelta: number;
    favelaId: string;
    favelaName: string;
    hangoverEndsAt: Date | null;
    incidentCode: string | null;
    mcTier: FavelaBaileMcTier;
    organizedAt: Date;
    organizedByPlayerId: string;
    regionId: RegionId;
    resultTier: FavelaBaileResultTier;
    satisfactionAfter: number;
    satisfactionDelta: number;
    cansacoBoostPercent: number;
  }): Promise<InMemoryFavelaBaileRecord> {
    void input.favelaName;

    const faction = this.state.factions.get(input.factionId);
    const favela = this.state.favelas.get(input.favelaId);

    if (!faction || !favela) {
      throw new Error('Missing faction or favela fixture for baile');
    }

    faction.bankMoney = roundCurrency(faction.bankMoney - input.budget);
    faction.points += input.factionPointsDelta;
    favela.satisfaction = input.satisfactionAfter;
    favela.satisfactionSyncedAt = new Date(input.organizedAt);

    for (const player of this.state.players.values()) {
      if (
        input.cansacoBoostPercent > 0 &&
        player.factionId === input.factionId &&
        player.regionId === input.regionId
      ) {
        player.cansaco = Math.min(100, player.cansaco + input.cansacoBoostPercent);
      }
    }

    const record: InMemoryFavelaBaileRecord = {
      activeEndsAt: input.activeEndsAt ? new Date(input.activeEndsAt) : null,
      budget: input.budget,
      cooldownEndsAt: new Date(input.cooldownEndsAt),
      entryPrice: input.entryPrice,
      factionId: input.factionId,
      factionPointsDelta: input.factionPointsDelta,
      favelaId: input.favelaId,
      hangoverEndsAt: input.hangoverEndsAt ? new Date(input.hangoverEndsAt) : null,
      id: randomUUID(),
      incidentCode: input.incidentCode,
      mcTier: input.mcTier,
      organizedAt: new Date(input.organizedAt),
      organizedByPlayerId: input.organizedByPlayerId,
      resultTier: input.resultTier,
      satisfactionDelta: input.satisfactionDelta,
      cansacoBoostPercent: input.cansacoBoostPercent,
    };

    this.state.favelaBailes.set(record.id, record);

    if (record.activeEndsAt) {
      this.state.activeSatisfactionEvents.push({
        endsAt: new Date(record.activeEndsAt),
        eventType: 'baile_cidade',
        favelaId: input.favelaId,
        regionId: input.regionId,
        startedAt: new Date(input.organizedAt),
      });
    }

    return {
      ...record,
      activeEndsAt: record.activeEndsAt ? new Date(record.activeEndsAt) : null,
      cooldownEndsAt: new Date(record.cooldownEndsAt),
      hangoverEndsAt: record.hangoverEndsAt ? new Date(record.hangoverEndsAt) : null,
      organizedAt: new Date(record.organizedAt),
    };
  }

  async createFactionWar(input: {
    attackerFactionId: string;
    declaredAt: Date;
    declaredByPlayerId: string;
    defenderFactionId: string;
    favelaId: string;
    favelaName: string;
    preparationEndsAt: Date;
    startsAt: Date;
  }): Promise<InMemoryFactionWarRecord> {
    void input.favelaName;

    const attackerFaction = this.state.factions.get(input.attackerFactionId);
    const favela = this.state.favelas.get(input.favelaId);

    if (!attackerFaction || !favela) {
      throw new Error('Missing faction or favela fixture for faction war');
    }

    attackerFaction.bankMoney = roundCurrency(attackerFaction.bankMoney - 50000);
    favela.contestingFactionId = input.attackerFactionId;
    favela.controllingFactionId = input.defenderFactionId;
    favela.state = 'at_war';
    favela.stabilizationEndsAt = null;
    favela.stateControlledUntil = null;
    favela.warDeclaredAt = new Date(input.declaredAt);

    const war: InMemoryFactionWarRecord = {
      attackerFactionId: input.attackerFactionId,
      attackerPreparation: null,
      attackerScore: 0,
      cooldownEndsAt: null,
      declaredAt: new Date(input.declaredAt),
      declaredByPlayerId: input.declaredByPlayerId,
      defenderFactionId: input.defenderFactionId,
      defenderPreparation: null,
      defenderScore: 0,
      endedAt: null,
      favelaId: input.favelaId,
      id: randomUUID(),
      lootMoney: 0,
      nextRoundAt: new Date(input.startsAt),
      preparationEndsAt: new Date(input.preparationEndsAt),
      rounds: [],
      roundsResolved: 0,
      roundsTotal: 3,
      startsAt: new Date(input.startsAt),
      status: 'declared',
      winnerFactionId: null,
    };

    this.state.factionWars.set(war.id, war);
    return cloneFactionWar(war);
  }

  async prepareFactionWar(input: {
    budget: number;
    factionId: string;
    favelaName: string;
    playerId: string;
    powerBonus: number;
    preparedAt: Date;
    regionPresenceCount: number;
    side: FactionWarSide;
    soldierCommitment: number;
    warId: string;
  }): Promise<InMemoryFactionWarRecord | null> {
    void input.favelaName;

    const war = this.state.factionWars.get(input.warId);
    const faction = this.state.factions.get(input.factionId);

    if (!war || !faction) {
      return null;
    }

    faction.bankMoney = roundCurrency(faction.bankMoney - input.budget);
    const preparation: InMemoryFactionWarPreparationRecord = {
      budget: input.budget,
      powerBonus: input.powerBonus,
      preparedAt: new Date(input.preparedAt),
      preparedByPlayerId: input.playerId,
      regionPresenceCount: input.regionPresenceCount,
      side: input.side,
      soldierCommitment: input.soldierCommitment,
    };

    if (input.side === 'attacker') {
      war.attackerPreparation = preparation;
    } else {
      war.defenderPreparation = preparation;
    }

    war.status = 'preparing';
    return cloneFactionWar(war);
  }

  async persistConquestAttempt(input: {
    favelaId: string;
    nextFavelaState: {
      contestingFactionId: string | null;
      controllingFactionId: string | null;
      stabilizationEndsAt: Date | null;
      state: FavelaControlState;
      stateControlledUntil: Date | null;
      warDeclaredAt: Date | null;
    } | null;
    nextSatisfaction: number | null;
    nextSatisfactionSyncedAt: Date | null;
    participantUpdates: Array<{
      nextLevel: number;
      nextResources: {
        conceito: number;
        hp: number;
        disposicao: number;
        cansaco: number;
      };
      playerId: string;
    }>;
  }): Promise<void> {
    for (const update of input.participantUpdates) {
      const player = this.state.players.get(update.playerId);

      if (!player) {
        continue;
      }

      player.conceito = update.nextResources.conceito;
      player.hp = update.nextResources.hp;
      player.level = update.nextLevel;
      player.disposicao = update.nextResources.disposicao;
      player.cansaco = update.nextResources.cansaco;
    }

    if (!input.nextFavelaState) {
      return;
    }

    const favela = this.state.favelas.get(input.favelaId);

    if (!favela) {
      return;
    }

    favela.contestingFactionId = input.nextFavelaState.contestingFactionId;
    favela.controllingFactionId = input.nextFavelaState.controllingFactionId;
    favela.stabilizationEndsAt = input.nextFavelaState.stabilizationEndsAt;
    favela.state = input.nextFavelaState.state;
    favela.stateControlledUntil = input.nextFavelaState.stateControlledUntil;
    favela.warDeclaredAt = input.nextFavelaState.warDeclaredAt;

    if (input.nextSatisfaction !== null) {
      favela.satisfaction = input.nextSatisfaction;
    }

    if (input.nextSatisfactionSyncedAt) {
      favela.satisfactionSyncedAt = new Date(input.nextSatisfactionSyncedAt);
    }
  }

  async persistFavelaSatisfactionSync(
    updates: Array<{
      favelaId: string;
      nextSatisfaction: number;
      nextSyncedAt: Date;
    }>,
  ): Promise<void> {
    for (const update of updates) {
      const favela = this.state.favelas.get(update.favelaId);

      if (!favela) {
        continue;
      }

      favela.satisfaction = update.nextSatisfaction;
      favela.satisfactionSyncedAt = new Date(update.nextSyncedAt);
    }
  }

  async persistFavelaBanditSync(input: {
    releasedReturnIds: string[];
    updates: Array<{
      banditsActive: number;
      banditsArrested: number;
      banditsDeadRecent: number;
      banditsSyncedAt: Date;
      favelaId: string;
    }>;
  }): Promise<void> {
    for (const returnId of input.releasedReturnIds) {
      this.state.favelaBanditReturns.delete(returnId);
    }

    for (const update of input.updates) {
      const favela = this.state.favelas.get(update.favelaId);

      if (!favela) {
        continue;
      }

      favela.banditsActive = update.banditsActive;
      favela.banditsArrested = update.banditsArrested;
      favela.banditsDeadRecent = update.banditsDeadRecent;
      favela.banditsSyncedAt = new Date(update.banditsSyncedAt);
    }
  }

  async persistFavelaPropinaSync(
    updates: Array<{
      favelaId: string;
      nextDiscountRate: number;
      nextDueDate: Date | null;
      nextLastPaidAt: Date | null;
      nextNegotiatedAt: Date | null;
      nextNegotiatedByPlayerId: string | null;
      nextPropinaValue: number;
    }>,
  ): Promise<void> {
    for (const update of updates) {
      const favela = this.state.favelas.get(update.favelaId);

      if (!favela) {
        continue;
      }

      favela.propinaDiscountRate = update.nextDiscountRate;
      favela.propinaDueDate = update.nextDueDate ? new Date(update.nextDueDate) : null;
      favela.propinaLastPaidAt = update.nextLastPaidAt ? new Date(update.nextLastPaidAt) : null;
      favela.propinaNegotiatedAt = update.nextNegotiatedAt ? new Date(update.nextNegotiatedAt) : null;
      favela.propinaNegotiatedByPlayerId = update.nextNegotiatedByPlayerId;
      favela.propinaValue = update.nextPropinaValue;
    }
  }

  async persistFavelaX9RollSync(
    updates: Array<{
      favelaId: string;
      nextLastRollAt: Date;
    }>,
  ): Promise<void> {
    for (const update of updates) {
      const favela = this.state.favelas.get(update.favelaId);

      if (!favela) {
        continue;
      }

      favela.lastX9RollAt = new Date(update.nextLastRollAt);
    }
  }

  async payFavelaPropina(input: {
    amount: number;
    factionId: string;
    favelaId: string;
    nextDueAt: Date;
    nextPropinaValue: number;
    now: Date;
    playerId: string | null;
  }): Promise<boolean> {
    void input.playerId;

    const faction = this.state.factions.get(input.factionId);
    const favela = this.state.favelas.get(input.favelaId);

    if (!faction || !favela || faction.bankMoney < input.amount) {
      return false;
    }

    faction.bankMoney = roundCurrency(faction.bankMoney - input.amount);
    favela.propinaDiscountRate = 0;
    favela.propinaDueDate = new Date(input.nextDueAt);
    favela.propinaLastPaidAt = new Date(input.now);
    favela.propinaNegotiatedAt = null;
    favela.propinaNegotiatedByPlayerId = null;
    favela.propinaValue = input.nextPropinaValue;

    return true;
  }

  async negotiateFavelaPropina(input: {
    discountRate: number;
    favelaId: string;
    negotiatedAt: Date;
    negotiatedByPlayerId: string;
    nextPropinaValue: number;
  }): Promise<boolean> {
    const favela = this.state.favelas.get(input.favelaId);

    if (!favela) {
      return false;
    }

    favela.propinaDiscountRate = input.discountRate;
    favela.propinaNegotiatedAt = new Date(input.negotiatedAt);
    favela.propinaNegotiatedByPlayerId = input.negotiatedByPlayerId;
    favela.propinaValue = input.nextPropinaValue;

    return true;
  }

  async createX9Warning(input: {
    favelaId: string;
    status: 'warning' | 'pending_desenrolo' | 'jailed' | 'resolved';
    triggeredAt: Date;
    warningEndsAt: Date;
  }): Promise<InMemoryX9EventRecord> {
    const event: InMemoryX9EventRecord = {
      desenroloAttemptedAt: null,
      desenroloBaseMoneyCost: 0,
      desenroloBasePointsCost: 0,
      desenroloMoneySpent: 0,
      desenroloNegotiatorPlayerId: null,
      desenroloPointsSpent: 0,
      desenroloSucceeded: null,
      drugsLost: 0,
      favelaId: input.favelaId,
      id: randomUUID(),
      incursionAt: null,
      moneyLost: 0,
      resolvedAt: null,
      soldierImpacts: [],
      soldiersArrested: 0,
      soldiersReleaseAt: null,
      status: input.status,
      triggeredAt: new Date(input.triggeredAt),
      warningEndsAt: new Date(input.warningEndsAt),
      weaponsLost: 0,
    };

    this.state.x9Events.set(event.id, event);
    return cloneX9Event(event);
  }

  async applyX9Incursion(input: {
    baseMoneyCost: number;
    basePointsCost: number;
    cashImpacts: Array<{
      kind: 'boca' | 'front_store' | 'puteiro' | 'rave' | 'slot_machine';
      lostAmount: number;
      propertyId: string;
    }>;
    drugsLost: number;
    drugImpacts: Array<{
      drugId: string;
      kind: 'boca' | 'factory' | 'rave';
      lostQuantity: number;
      propertyId: string;
    }>;
    eventId: string;
    favelaId: string;
    incursionAt: Date;
    moneyLost: number;
    nextSatisfaction: number;
    soldierImpacts: InMemoryX9SoldierImpactRecord[];
    soldiersArrested: number;
    soldiersReleaseAt: Date;
    weaponsLost: number;
  }): Promise<InMemoryX9EventRecord | null> {
    const event = this.state.x9Events.get(input.eventId);
    const favela = this.state.favelas.get(input.favelaId);
    const exposure = this.state.x9ExposureByFavela.get(input.favelaId) ?? buildEmptyX9Exposure();

    if (!event || !favela) {
      return null;
    }

    for (const impact of input.cashImpacts) {
      const target = exposure.cashTargets.find(
        (entry) => entry.kind === impact.kind && entry.propertyId === impact.propertyId,
      );

      if (target) {
        target.cashBalance = roundCurrency(Math.max(0, target.cashBalance - impact.lostAmount));
      }
    }

    for (const impact of input.drugImpacts) {
      const target = exposure.drugTargets.find(
        (entry) =>
          entry.kind === impact.kind &&
          entry.propertyId === impact.propertyId &&
          entry.drugId === impact.drugId,
      );

      if (target) {
        target.quantity = Math.max(0, target.quantity - impact.lostQuantity);
      }
    }

    for (const impact of input.soldierImpacts) {
      const target = exposure.soldierTargets.find((entry) => entry.propertyId === impact.propertyId);

      if (target) {
        target.soldiersCount = Math.max(0, target.soldiersCount - impact.count);
      }
    }

    favela.satisfaction = input.nextSatisfaction;
    favela.satisfactionSyncedAt = new Date(input.incursionAt);
    this.state.x9ExposureByFavela.set(input.favelaId, exposure);
    syncFavelaPropertyStatsFromX9Exposure(this.state, input.favelaId);

    event.desenroloBaseMoneyCost = input.baseMoneyCost;
    event.desenroloBasePointsCost = input.basePointsCost;
    event.drugsLost = input.drugsLost;
    event.incursionAt = new Date(input.incursionAt);
    event.moneyLost = input.moneyLost;
    event.soldierImpacts = input.soldierImpacts.map((entry) => ({ ...entry }));
    event.soldiersArrested = input.soldiersArrested;
    event.soldiersReleaseAt = new Date(input.soldiersReleaseAt);
    event.status = 'pending_desenrolo';
    event.weaponsLost = input.weaponsLost;

    return cloneX9Event(event);
  }

  async resolveX9Desenrolo(input: {
    actorPlayerId: string;
    attemptedAt: Date;
    eventId: string;
    factionId: string;
    moneySpent: number;
    pointsSpent: number;
    releaseAt: Date;
    success: boolean;
  }): Promise<InMemoryX9EventRecord | null> {
    const event = this.state.x9Events.get(input.eventId);
    const faction = this.state.factions.get(input.factionId);

    if (!event || !faction) {
      return null;
    }

    faction.bankMoney = roundCurrency(faction.bankMoney - input.moneySpent);
    faction.points -= input.pointsSpent;
    event.desenroloAttemptedAt = new Date(input.attemptedAt);
    event.desenroloMoneySpent = input.moneySpent;
    event.desenroloNegotiatorPlayerId = input.actorPlayerId;
    event.desenroloPointsSpent = input.pointsSpent;
    event.desenroloSucceeded = input.success;
    event.soldiersReleaseAt = new Date(input.releaseAt);
    event.status = input.success ? 'resolved' : 'jailed';
    event.resolvedAt = input.success ? new Date(input.attemptedAt) : null;

    if (input.success) {
      const exposure = this.state.x9ExposureByFavela.get(event.favelaId) ?? buildEmptyX9Exposure();

      for (const impact of event.soldierImpacts) {
        const target = exposure.soldierTargets.find((entry) => entry.propertyId === impact.propertyId);

        if (target) {
          target.soldiersCount += impact.count;
        } else {
          exposure.soldierTargets.push({
            propertyId: impact.propertyId,
            soldiersCount: impact.count,
          });
        }
      }

      this.state.x9ExposureByFavela.set(event.favelaId, exposure);
      syncFavelaPropertyStatsFromX9Exposure(this.state, event.favelaId);
    }

    return cloneX9Event(event);
  }

  async releaseX9Soldiers(eventId: string, releasedAt: Date): Promise<InMemoryX9EventRecord | null> {
    const event = this.state.x9Events.get(eventId);

    if (!event) {
      return null;
    }

    const exposure = this.state.x9ExposureByFavela.get(event.favelaId) ?? buildEmptyX9Exposure();

    for (const impact of event.soldierImpacts) {
      const target = exposure.soldierTargets.find((entry) => entry.propertyId === impact.propertyId);

      if (target) {
        target.soldiersCount += impact.count;
      } else {
        exposure.soldierTargets.push({
          propertyId: impact.propertyId,
          soldiersCount: impact.count,
        });
      }
    }

    this.state.x9ExposureByFavela.set(event.favelaId, exposure);
    syncFavelaPropertyStatsFromX9Exposure(this.state, event.favelaId);
    event.resolvedAt = new Date(releasedAt);
    event.status = 'resolved';
    return cloneX9Event(event);
  }

  async persistFactionWarRound(input: {
    attackerFactionId: string;
    attackerPointsDelta: number;
    attackerRewardMoney: number;
    defenderFactionId: string;
    defenderPointsDelta: number;
    endedAt: Date | null;
    favelaId: string;
    favelaName: string;
    nextAttackerScore: number;
    nextCooldownEndsAt: Date | null;
    nextDefenderScore: number;
    nextFavelaState: {
      contestingFactionId: string | null;
      controllingFactionId: string | null;
      lastX9RollAt?: Date | null;
      propinaDiscountRate?: number | null;
      propinaDueDate?: Date | null;
      propinaLastPaidAt?: Date | null;
      propinaNegotiatedAt?: Date | null;
      propinaNegotiatedByPlayerId?: string | null;
      propinaValue?: number | null;
      satisfactionSyncedAt?: Date | null;
      stabilizationEndsAt: Date | null;
      state: FavelaControlState;
      stateControlledUntil: Date | null;
      warDeclaredAt: Date | null;
    } | null;
    nextNextRoundAt: Date | null;
    nextRounds: InMemoryFactionWarRoundRecord[];
    nextRoundsResolved: number;
    nextStatus: FactionWarStatus;
    nextWinnerFactionId: string | null;
    now: Date;
    participantUpdates: Array<{
      conceitoDelta: number;
      nextLevel: number;
      nextResources: {
        conceito: number;
        hp: number;
        disposicao: number;
        cansaco: number;
      };
      playerId: string;
    }>;
    satisfactionAfter: number | null;
    satisfactionSyncedAt: Date | null;
    warId: string;
    winnerFactionId: string | null;
  }): Promise<InMemoryFactionWarRecord | null> {
    void input.favelaName;
    void input.winnerFactionId;

    const war = this.state.factionWars.get(input.warId);
    const attackerFaction = this.state.factions.get(input.attackerFactionId);
    const defenderFaction = this.state.factions.get(input.defenderFactionId);
    const favela = this.state.favelas.get(input.favelaId);

    if (!war || !attackerFaction || !defenderFaction || !favela) {
      return null;
    }

    for (const participant of input.participantUpdates) {
      const player = this.state.players.get(participant.playerId);

      if (!player) {
        continue;
      }

      player.conceito = participant.nextResources.conceito;
      player.hp = participant.nextResources.hp;
      player.level = participant.nextLevel;
      player.disposicao = participant.nextResources.disposicao;
      player.cansaco = participant.nextResources.cansaco;
    }

    attackerFaction.bankMoney = roundCurrency(attackerFaction.bankMoney + input.attackerRewardMoney);
    attackerFaction.points = Math.max(0, attackerFaction.points + input.attackerPointsDelta);
    defenderFaction.points = Math.max(0, defenderFaction.points + input.defenderPointsDelta);

    if (input.nextFavelaState) {
      favela.contestingFactionId = input.nextFavelaState.contestingFactionId;
      favela.controllingFactionId = input.nextFavelaState.controllingFactionId;
      if (input.nextFavelaState.lastX9RollAt) {
        favela.lastX9RollAt = new Date(input.nextFavelaState.lastX9RollAt);
      }
      if (input.nextFavelaState.propinaDiscountRate !== undefined && input.nextFavelaState.propinaDiscountRate !== null) {
        favela.propinaDiscountRate = input.nextFavelaState.propinaDiscountRate;
      }
      if (input.nextFavelaState.propinaDueDate !== undefined) {
        favela.propinaDueDate = input.nextFavelaState.propinaDueDate
          ? new Date(input.nextFavelaState.propinaDueDate)
          : null;
      }
      if (input.nextFavelaState.propinaLastPaidAt !== undefined) {
        favela.propinaLastPaidAt = input.nextFavelaState.propinaLastPaidAt
          ? new Date(input.nextFavelaState.propinaLastPaidAt)
          : null;
      }
      if (input.nextFavelaState.propinaNegotiatedAt !== undefined) {
        favela.propinaNegotiatedAt = input.nextFavelaState.propinaNegotiatedAt
          ? new Date(input.nextFavelaState.propinaNegotiatedAt)
          : null;
      }
      if (input.nextFavelaState.propinaNegotiatedByPlayerId !== undefined) {
        favela.propinaNegotiatedByPlayerId = input.nextFavelaState.propinaNegotiatedByPlayerId;
      }
      if (input.nextFavelaState.propinaValue !== undefined && input.nextFavelaState.propinaValue !== null) {
        favela.propinaValue = input.nextFavelaState.propinaValue;
      }
      if (input.satisfactionAfter !== null) {
        favela.satisfaction = input.satisfactionAfter;
      }
      if (input.satisfactionSyncedAt) {
        favela.satisfactionSyncedAt = new Date(input.satisfactionSyncedAt);
      }
      favela.stabilizationEndsAt = input.nextFavelaState.stabilizationEndsAt;
      favela.state = input.nextFavelaState.state;
      favela.stateControlledUntil = input.nextFavelaState.stateControlledUntil;
      favela.warDeclaredAt = input.nextFavelaState.warDeclaredAt;
    }

    war.attackerScore = input.nextAttackerScore;
    war.cooldownEndsAt = input.nextCooldownEndsAt ? new Date(input.nextCooldownEndsAt) : null;
    war.defenderScore = input.nextDefenderScore;
    war.endedAt = input.endedAt ? new Date(input.endedAt) : null;
    war.lootMoney = input.attackerRewardMoney;
    war.nextRoundAt = input.nextNextRoundAt ? new Date(input.nextNextRoundAt) : null;
    war.rounds = input.nextRounds.map((round) => ({
      ...round,
      resolvedAt: new Date(round.resolvedAt),
    }));
    war.roundsResolved = input.nextRoundsResolved;
    war.status = input.nextStatus;
    war.winnerFactionId = input.nextWinnerFactionId;

    return cloneFactionWar(war);
  }

  async updateFactionWarStatus(
    warId: string,
    nextStatus: FactionWarStatus,
    nextRoundAt: Date | null,
  ): Promise<InMemoryFactionWarRecord | null> {
    const war = this.state.factionWars.get(warId);

    if (!war) {
      return null;
    }

    war.status = nextStatus;
    war.nextRoundAt = nextRoundAt ? new Date(nextRoundAt) : null;
    return cloneFactionWar(war);
  }

  async persistFavelaServiceSync(input: {
    factionId: string | null;
    favelaName: string;
    now: Date;
    revenueDelta: number;
    serviceUpdates: Array<{
      grossRevenueTotal: number;
      id: string;
      lastRevenueAt: Date;
    }>;
  }): Promise<void> {
    for (const update of input.serviceUpdates) {
      const service = this.state.favelaServices.get(update.id);

      if (!service) {
        continue;
      }

      service.grossRevenueTotal = update.grossRevenueTotal;
      service.lastRevenueAt = new Date(update.lastRevenueAt);
    }

    if (!input.factionId || input.revenueDelta <= 0) {
      return;
    }

    const faction = this.state.factions.get(input.factionId);

    if (!faction) {
      return;
    }

    faction.bankMoney = roundCurrency(faction.bankMoney + input.revenueDelta);
  }

  async upgradeFavelaService(input: {
    factionId: string;
    favelaId: string;
    favelaName: string;
    nextLevel: number;
    now: Date;
    playerId: string;
    satisfactionAfter: number;
    serviceType: FavelaServiceType;
  }): Promise<void> {
    const faction = this.state.factions.get(input.factionId);
    const service = this.state.favelaServices.get(`${input.favelaId}:${input.serviceType}`);
    const favela = this.state.favelas.get(input.favelaId);

    if (!faction || !service || !favela) {
      return;
    }

    const definition = resolveServiceDefinition(input.serviceType);
    const upgradeCost = resolveServiceUpgradeCost(definition.installCost, input.nextLevel - 1);

    faction.bankMoney = roundCurrency(faction.bankMoney - upgradeCost);
    service.level = input.nextLevel;
    favela.satisfaction = input.satisfactionAfter;
    favela.satisfactionSyncedAt = new Date(input.now);
  }

  async updateFavelaState(
    favelaId: string,
    input: {
      contestingFactionId: string | null;
      controllingFactionId: string | null;
      lastX9RollAt?: Date | null;
      propinaDiscountRate?: number | null;
      propinaDueDate?: Date | null;
      propinaLastPaidAt?: Date | null;
      propinaNegotiatedAt?: Date | null;
      propinaNegotiatedByPlayerId?: string | null;
      propinaValue?: number | null;
      satisfactionSyncedAt?: Date | null;
      stabilizationEndsAt: Date | null;
      state: FavelaControlState;
      stateControlledUntil: Date | null;
      warDeclaredAt: Date | null;
    },
  ): Promise<boolean> {
    const favela = this.state.favelas.get(favelaId);

    if (!favela) {
      return false;
    }

    favela.contestingFactionId = input.contestingFactionId;
    favela.controllingFactionId = input.controllingFactionId;
    if (input.lastX9RollAt) {
      favela.lastX9RollAt = new Date(input.lastX9RollAt);
    }
    if (input.propinaDiscountRate !== undefined && input.propinaDiscountRate !== null) {
      favela.propinaDiscountRate = input.propinaDiscountRate;
    }
    if (input.propinaDueDate !== undefined) {
      favela.propinaDueDate = input.propinaDueDate ? new Date(input.propinaDueDate) : null;
    }
    if (input.propinaLastPaidAt !== undefined) {
      favela.propinaLastPaidAt = input.propinaLastPaidAt ? new Date(input.propinaLastPaidAt) : null;
    }
    if (input.propinaNegotiatedAt !== undefined) {
      favela.propinaNegotiatedAt = input.propinaNegotiatedAt
        ? new Date(input.propinaNegotiatedAt)
        : null;
    }
    if (input.propinaNegotiatedByPlayerId !== undefined) {
      favela.propinaNegotiatedByPlayerId = input.propinaNegotiatedByPlayerId;
    }
    if (input.propinaValue !== undefined && input.propinaValue !== null) {
      favela.propinaValue = input.propinaValue;
    }
    if (input.satisfactionSyncedAt) {
      favela.satisfactionSyncedAt = new Date(input.satisfactionSyncedAt);
    }
    favela.stabilizationEndsAt = input.stabilizationEndsAt;
    favela.state = input.state;
    favela.stateControlledUntil = input.stateControlledUntil;
    favela.warDeclaredAt = input.warDeclaredAt;
    return true;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async increment(key: string): Promise<number> {
    const nextValue = Number.parseInt(this.values.get(key) ?? '0', 10) + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('territory routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-11T03:10:00.000Z');
    state = buildState();
    app = await buildTestApp({
      now: () => now,
      state,
    });
  });

  afterEach(async () => {
    await app.server.close();
  });

  it('lists the favela state machine and resolves attacker victory through the territory API', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const beforeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    expect(beforeResponse.statusCode).toBe(200);
    expect(beforeResponse.json().favelas[0].state).toBe('controlled');
    expect(beforeResponse.json().favelas[0].controllingFaction.abbreviation).toBe('TCP');
    expect(beforeResponse.json().regions[0].controlledFavelas).toBe(1);

    const declareResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        action: 'declare_war',
      } satisfies FavelaStateTransitionInput,
      url: '/api/territory/favelas/favela-centro-1/transition',
    });

    expect(declareResponse.statusCode).toBe(200);
    expect(declareResponse.json().favela.state).toBe('at_war');
    expect(declareResponse.json().favela.contestingFaction.abbreviation).toBe('CV');
    expect(declareResponse.json().favela.controllingFaction.abbreviation).toBe('TCP');

    const attackerWinResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        action: 'attacker_win',
      } satisfies FavelaStateTransitionInput,
      url: '/api/territory/favelas/favela-centro-1/transition',
    });

    expect(attackerWinResponse.statusCode).toBe(200);
    expect(attackerWinResponse.json().favela.state).toBe('controlled');
    expect(attackerWinResponse.json().favela.controllingFaction.abbreviation).toBe('CV');
    expect(attackerWinResponse.json().favela.stabilizationEndsAt).not.toBeNull();
    expect(attackerWinResponse.json().regions[0].playerFactionControlledFavelas).toBe(1);
  });

  it('declares a faction war, prepares both sides, resolves three rounds and applies the final takeover cooldown', async () => {
    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.99, 0, 0.99, 0, 0.99, 0]),
      state,
    });

    const attackerToken = await registerAndExtractToken(app.server, {
      email: 'guerra-cv@test.com',
      nickname: 'GuerraCV',
    });

    const declareResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-1/war/declare',
    });

    expect(declareResponse.statusCode).toBe(200);
    expect(declareResponse.json().war.status).toBe('declared');
    expect(declareResponse.json().favela.state).toBe('at_war');
    expect(state.factions.get('faction-cv')?.bankMoney).toBe(200000);

    const attackerPrepareResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      payload: {
        budget: 100000,
        soldierCommitment: 20,
      },
      url: '/api/territory/favelas/favela-centro-1/war/prepare',
    });

    expect(attackerPrepareResponse.statusCode).toBe(200);
    expect(attackerPrepareResponse.json().war.status).toBe('preparing');
    expect(attackerPrepareResponse.json().war.attackerPreparation.budget).toBe(100000);

    state.defaultFactionId = 'faction-tcp';
    state.defaultFactionRank = 'general';
    const defenderToken = await registerAndExtractToken(app.server, {
      email: 'guerra-tcp@test.com',
      nickname: 'GuerraTCP',
    });

    const defenderPrepareResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${defenderToken}`,
      },
      method: 'POST',
      payload: {
        budget: 0,
        soldierCommitment: 0,
      },
      url: '/api/territory/favelas/favela-centro-1/war/prepare',
    });

    expect(defenderPrepareResponse.statusCode).toBe(200);
    expect(defenderPrepareResponse.json().war.defenderPreparation.budget).toBe(0);
    expect(state.factions.get('faction-tcp')?.bankMoney).toBe(180000);

    const blockedBeforeStart = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-1/war/round',
    });

    expect(blockedBeforeStart.statusCode).toBe(409);
    expect(blockedBeforeStart.json().message).toContain('preparacao');

    now = new Date('2026-03-11T04:45:00.000Z');
    const firstRound = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-1/war/round',
    });

    expect(firstRound.statusCode).toBe(200);
    expect(firstRound.json().round.roundNumber).toBe(1);
    expect(firstRound.json().war.status).toBe('active');
    expect(firstRound.json().war.roundsResolved).toBe(1);

    now = new Date('2026-03-11T05:16:00.000Z');
    const secondRound = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-1/war/round',
    });

    expect(secondRound.statusCode).toBe(200);
    expect(secondRound.json().round.roundNumber).toBe(2);
    expect(secondRound.json().war.roundsResolved).toBe(2);

    now = new Date('2026-03-11T05:47:00.000Z');
    const finalRound = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-1/war/round',
    });

    expect(finalRound.statusCode).toBe(200);
    expect(finalRound.json().round.roundNumber).toBe(3);
    expect(finalRound.json().war.status).toBe('attacker_won');
    expect(finalRound.json().war.cooldownEndsAt).toBe('2026-03-18T05:47:00.000Z');
    expect(finalRound.json().favela.state).toBe('controlled');
    expect(finalRound.json().favela.controllingFaction.abbreviation).toBe('CV');
    expect(finalRound.json().favela.satisfaction).toBe(35);
    expect(state.factions.get('faction-cv')?.bankMoney).toBeCloseTo(141000, 2);
    expect(state.factions.get('faction-cv')?.points).toBe(820);
    expect(state.factions.get('faction-tcp')?.points).toBe(0);

    const defenderLossesResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${defenderToken}`,
      },
      method: 'GET',
      url: '/api/territory/losses',
    });

    expect(defenderLossesResponse.statusCode).toBe(200);
    expect(defenderLossesResponse.json().cues).toEqual([
      expect.objectContaining({
        cause: 'war_defeat',
        favelaId: 'favela-centro-1',
        lostByFactionAbbreviation: 'TCP',
        newControllerFactionAbbreviation: 'CV',
        title: 'Morro da Providencia: guerra perdida',
      }),
    ]);

    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-tcp',
      state: 'controlled',
    });
    state.defaultFactionId = 'faction-cv';
    state.defaultFactionRank = 'general';

    const cooldownResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${attackerToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-2/war/declare',
    });

    expect(cooldownResponse.statusCode).toBe(409);
    expect(cooldownResponse.json().message).toContain('cooldown');
  });

  it('conquers a neutral favela with members present in the same region', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const ally = state.players.get('player-sombra');

    expect(ally).toBeDefined();

    const conquerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: ['player-sombra'],
      },
      url: '/api/territory/favelas/favela-centro-2/conquer',
    });

    expect(conquerResponse.statusCode).toBe(200);
    expect(conquerResponse.json().success).toBe(true);
    expect(conquerResponse.json().favela.state).toBe('controlled');
    expect(conquerResponse.json().favela.controllingFaction.abbreviation).toBe('CV');
    expect(conquerResponse.json().favela.stabilizationEndsAt).not.toBeNull();
    expect(conquerResponse.json().participantCount).toBe(2);
    expect(conquerResponse.json().combinedPower).toBeGreaterThan(conquerResponse.json().minimumPowerRequired);

    const actor = [...state.players.values()].find((player) => player.nickname === 'Territorio');

    expect(actor?.cansaco).toBeLessThan(100);
    expect(actor?.disposicao).toBeLessThan(100);
    expect(state.favelas.get('favela-centro-2')?.controllingFactionId).toBe('faction-cv');
  });

  it('rejects conquest when one of the selected members is outside the favela region', async () => {
    const ally = state.players.get('player-sombra');

    if (!ally) {
      throw new Error('Missing ally test fixture');
    }

    ally.regionId = RegionId.ZonaNorte;
    const accessToken = await registerAndExtractToken(app.server);

    const conquerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: ['player-sombra'],
      },
      url: '/api/territory/favelas/favela-centro-2/conquer',
    });

    expect(conquerResponse.statusCode).toBe(409);
    expect(conquerResponse.json().message).toContain('presente fisicamente');
  });

  it('syncs state-controlled favelas back to neutral after the state timer expires', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    await app.territoryService.forceStateControlForDurationHours('favela-centro-2', 2);

    const whileStateActive = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    expect(whileStateActive.statusCode).toBe(200);
    expect(
      whileStateActive.json().favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2')?.state,
    ).toBe('state');

    now = new Date('2026-03-11T06:30:00.000Z');
    const afterExpiration = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const transitionedFavela = afterExpiration
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(afterExpiration.statusCode).toBe(200);
    expect(transitionedFavela?.state).toBe('neutral');
    expect(transitionedFavela?.stateControlledUntil).toBeNull();
  });

  it('blocks low hierarchy members from forcing territory transitions', async () => {
    state.defaultFactionRank = 'soldado';
    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const declareResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        action: 'declare_war',
      } satisfies FavelaStateTransitionInput,
      url: '/api/territory/favelas/favela-centro-1/transition',
    });

    expect(declareResponse.statusCode).toBe(403);
    expect(declareResponse.json().message).toContain('patrao ou general');
  });

  it('installs a favela service after conquest and exposes the complete revenue formula', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    const conquerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: ['player-sombra'],
      },
      url: '/api/territory/favelas/favela-centro-2/conquer',
    });

    expect(conquerResponse.statusCode).toBe(200);

    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        serviceType: 'gatonet',
      },
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(installResponse.statusCode).toBe(200);
    expect(installResponse.json().service.definition.type).toBe('gatonet');
    expect(installResponse.json().service.level).toBe(1);
    expect(installResponse.json().service.currentDailyRevenue).toBeCloseTo(765900, 2);
    expect(installResponse.json().service.revenueBreakdown.satisfactionMultiplier).toBe(0.8);
    expect(installResponse.json().service.revenueBreakdown.regionalMultiplier).toBe(1.034);
    expect(installResponse.json().service.revenueBreakdown.factionBonusMultiplier).toBe(1);
    expect(installResponse.json().service.revenueBreakdown.stabilizationMultiplier).toBe(0.5);
    expect(installResponse.json().factionBankMoney).toBe(200000);
  });

  it('syncs automatic favela service income and allows upgrading the service', async () => {
    const accessToken = await registerAndExtractToken(app.server);

    await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: ['player-sombra'],
      },
      url: '/api/territory/favelas/favela-centro-2/conquer',
    });

    await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        serviceType: 'gatonet',
      },
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    now = new Date('2026-03-11T10:10:00.000Z');

    const syncedResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(syncedResponse.statusCode).toBe(200);
    expect(
      syncedResponse
        .json()
        .services.find((entry: { definition: { type: string } }) => entry.definition.type === 'gatonet')
        ?.grossRevenueTotal,
    ).toBeCloseTo(191475, 2);
    expect(syncedResponse.json().factionBankMoney).toBeCloseTo(391475, 2);

    const upgradeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-2/services/gatonet/upgrade',
    });

    expect(upgradeResponse.statusCode).toBe(200);
    expect(upgradeResponse.json().favela.satisfaction).toBe(55);
    expect(upgradeResponse.json().service.level).toBe(2);
    expect(upgradeResponse.json().service.currentDailyRevenue).toBeGreaterThan(765900);
    expect(upgradeResponse.json().factionBankMoney).toBeCloseTo(341475, 2);
  });

  it('applies the regional domination multiplier when the faction controls every favela in the region', async () => {
    state.favelas.set('favela-centro-1', {
      ...state.favelas.get('favela-centro-1')!,
      controllingFactionId: 'faction-cv',
      state: 'controlled',
    });

    const accessToken = await registerAndExtractToken(app.server);

    await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: ['player-sombra'],
      },
      url: '/api/territory/favelas/favela-centro-2/conquer',
    });

    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        serviceType: 'gatonet',
      },
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(installResponse.statusCode).toBe(200);
    expect(installResponse.json().service.revenueBreakdown.territoryDominationMultiplier).toBe(1.2);
    expect(installResponse.json().service.currentDailyRevenue).toBeGreaterThan(765900);
  });

  it('syncs favela satisfaction continuously and exposes the current risk profile', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfactionSyncedAt: new Date('2026-03-08T03:10:00.000Z'),
      state: 'controlled',
    });

    const accessToken = await registerAndExtractToken(app.server);
    now = new Date('2026-03-11T03:10:00.000Z');

    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.satisfaction).toBe(44);
    expect(favela?.satisfactionProfile.dailyDeltaEstimate).toBe(-2);
    expect(favela?.satisfactionProfile.revenueMultiplier).toBe(0.8);
    expect(favela?.satisfactionProfile.dailyX9RiskPercent).toBe(30);
    expect(favela?.satisfactionProfile.tier).toBe('restless');
  });

  it('raises favela satisfaction when services, soldiers and peace keep the favela stable', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfactionSyncedAt: new Date('2026-03-09T03:10:00.000Z'),
      state: 'controlled',
    });
    state.favelaPropertyStats.set('favela-centro-2', {
      activePropertyCount: 1,
      favelaId: 'favela-centro-2',
      soldiersCount: 2,
      suspendedPropertyCount: 0,
    });
    state.favelaServices.set('favela-centro-2:gatonet', {
      active: true,
      favelaId: 'favela-centro-2',
      grossRevenueTotal: 0,
      id: 'favela-centro-2:gatonet',
      installedAt: new Date('2026-03-09T03:10:00.000Z'),
      lastRevenueAt: new Date('2026-03-11T03:10:00.000Z'),
      level: 1,
      serviceType: 'gatonet',
    });
    state.favelaServices.set('favela-centro-2:mototaxi', {
      active: true,
      favelaId: 'favela-centro-2',
      grossRevenueTotal: 0,
      id: 'favela-centro-2:mototaxi',
      installedAt: new Date('2026-03-09T03:10:00.000Z'),
      lastRevenueAt: new Date('2026-03-11T03:10:00.000Z'),
      level: 2,
      serviceType: 'mototaxi',
    });

    const accessToken = await registerAndExtractToken(app.server);
    now = new Date('2026-03-11T03:10:00.000Z');

    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.satisfaction).toBe(56);
    expect(favela?.satisfactionProfile.dailyDeltaEstimate).toBe(3);
    expect(favela?.satisfactionProfile.tier).toBe('restless');
  });

  it('applies heavy satisfaction penalties during war and police pressure', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      contestingFactionId: 'faction-tcp',
      controllingFactionId: 'faction-cv',
      satisfactionSyncedAt: new Date('2026-03-10T03:10:00.000Z'),
      state: 'at_war',
      warDeclaredAt: new Date('2026-03-10T03:10:00.000Z'),
    });
    state.activeSatisfactionEvents.push({
      eventType: 'operacao_policial',
      favelaId: null,
      regionId: RegionId.Centro,
    });

    const accessToken = await registerAndExtractToken(app.server);
    now = new Date('2026-03-11T03:10:00.000Z');

    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.satisfaction).toBe(29);
    expect(favela?.satisfactionProfile.dailyDeltaEstimate).toBe(-21);
    expect(favela?.satisfactionProfile.tier).toBe('critical');
    expect(favela?.satisfactionProfile.dailyX9RiskPercent).toBe(50);
  });

  it('triggers an X9 incursion on the daily roll and applies concrete territorial losses', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      lastX9RollAt: new Date('2026-03-09T03:10:00.000Z'),
      satisfaction: 10,
      satisfactionSyncedAt: new Date('2026-03-11T03:10:00.000Z'),
      state: 'controlled',
      stabilizationEndsAt: null,
    });
    state.favelaPropertyStats.set('favela-centro-2', {
      activePropertyCount: 1,
      favelaId: 'favela-centro-2',
      soldiersCount: 3,
      suspendedPropertyCount: 0,
    });
    state.x9ExposureByFavela.set('favela-centro-2', {
      cashTargets: [
        {
          cashBalance: 20000,
          kind: 'boca',
          propertyId: 'prop-boca-1',
        },
      ],
      drugTargets: [
        {
          drugId: 'drug-cocaina',
          kind: 'boca',
          propertyId: 'prop-boca-1',
          quantity: 100,
        },
      ],
      soldierTargets: [
        {
          propertyId: 'prop-boca-1',
          soldiersCount: 3,
        },
      ],
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.01, 0, 0, 0, 0, 0.4]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.satisfaction).toBe(0);
    expect(favela?.x9?.status).toBe('pending_desenrolo');
    expect(favela?.x9?.moneyLost).toBe(1000);
    expect(favela?.x9?.drugsLost).toBe(20);
    expect(favela?.x9?.soldiersArrested).toBe(2);
    expect(favela?.x9?.weaponsLost).toBe(2);
    expect(state.x9ExposureByFavela.get('favela-centro-2')?.cashTargets[0]?.cashBalance).toBe(19000);
    expect(state.x9ExposureByFavela.get('favela-centro-2')?.drugTargets[0]?.quantity).toBe(80);
    expect(state.x9ExposureByFavela.get('favela-centro-2')?.soldierTargets[0]?.soldiersCount).toBe(1);
    expect(state.favelaPropertyStats.get('favela-centro-2')?.soldiersCount).toBe(1);
  });

  it('resolves a successful X9 desenrolo and restores the arrested soldiers', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfaction: 35,
      state: 'controlled',
    });
    state.favelaPropertyStats.set('favela-centro-2', {
      activePropertyCount: 1,
      favelaId: 'favela-centro-2',
      soldiersCount: 1,
      suspendedPropertyCount: 0,
    });
    state.x9ExposureByFavela.set('favela-centro-2', {
      cashTargets: [],
      drugTargets: [],
      soldierTargets: [
        {
          propertyId: 'prop-boca-1',
          soldiersCount: 1,
        },
      ],
    });
    state.x9Events.set('x9-event-1', {
      desenroloAttemptedAt: null,
      desenroloBaseMoneyCost: 10000,
      desenroloBasePointsCost: 20,
      desenroloMoneySpent: 0,
      desenroloNegotiatorPlayerId: null,
      desenroloPointsSpent: 0,
      desenroloSucceeded: null,
      drugsLost: 20,
      favelaId: 'favela-centro-2',
      id: 'x9-event-1',
      incursionAt: new Date('2026-03-11T01:10:00.000Z'),
      moneyLost: 3000,
      resolvedAt: null,
      soldierImpacts: [
        {
          count: 2,
          propertyId: 'prop-boca-1',
        },
      ],
      soldiersArrested: 2,
      soldiersReleaseAt: new Date('2026-03-16T01:10:00.000Z'),
      status: 'pending_desenrolo',
      triggeredAt: new Date('2026-03-10T23:10:00.000Z'),
      warningEndsAt: new Date('2026-03-11T01:10:00.000Z'),
      weaponsLost: 2,
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.1]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-2/x9/desenrolo',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().moneySpent).toBe(8200);
    expect(response.json().pointsSpent).toBe(16);
    expect(response.json().favela.x9.status).toBe('resolved');
    expect(state.factions.get('faction-cv')?.bankMoney).toBe(241800);
    expect(state.factions.get('faction-cv')?.points).toBe(304);
    expect(state.x9ExposureByFavela.get('favela-centro-2')?.soldierTargets[0]?.soldiersCount).toBe(3);
    expect(state.favelaPropertyStats.get('favela-centro-2')?.soldiersCount).toBe(3);
  });

  it('keeps soldiers jailed after a failed X9 desenrolo and releases them automatically later', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfaction: 28,
      state: 'controlled',
    });
    state.favelaPropertyStats.set('favela-centro-2', {
      activePropertyCount: 1,
      favelaId: 'favela-centro-2',
      soldiersCount: 1,
      suspendedPropertyCount: 0,
    });
    state.x9ExposureByFavela.set('favela-centro-2', {
      cashTargets: [],
      drugTargets: [],
      soldierTargets: [
        {
          propertyId: 'prop-boca-1',
          soldiersCount: 1,
        },
      ],
    });
    state.x9Events.set('x9-event-2', {
      desenroloAttemptedAt: null,
      desenroloBaseMoneyCost: 12000,
      desenroloBasePointsCost: 24,
      desenroloMoneySpent: 0,
      desenroloNegotiatorPlayerId: null,
      desenroloPointsSpent: 0,
      desenroloSucceeded: null,
      drugsLost: 35,
      favelaId: 'favela-centro-2',
      id: 'x9-event-2',
      incursionAt: new Date('2026-03-11T01:10:00.000Z'),
      moneyLost: 4500,
      resolvedAt: null,
      soldierImpacts: [
        {
          count: 2,
          propertyId: 'prop-boca-1',
        },
      ],
      soldiersArrested: 2,
      soldiersReleaseAt: new Date('2026-03-16T01:10:00.000Z'),
      status: 'pending_desenrolo',
      triggeredAt: new Date('2026-03-10T23:10:00.000Z'),
      warningEndsAt: new Date('2026-03-11T01:10:00.000Z'),
      weaponsLost: 3,
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.99, 0.3]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const failedResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-2/x9/desenrolo',
    });

    expect(failedResponse.statusCode).toBe(200);
    expect(failedResponse.json().success).toBe(false);
    expect(failedResponse.json().favela.x9.status).toBe('jailed');
    expect(state.favelaPropertyStats.get('favela-centro-2')?.soldiersCount).toBe(1);

    now = new Date('2026-03-12T03:20:00.000Z');

    const afterRelease = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = afterRelease
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(afterRelease.statusCode).toBe(200);
    expect(favela?.x9?.status).toBe('resolved');
    expect(state.x9ExposureByFavela.get('favela-centro-2')?.soldierTargets[0]?.soldiersCount).toBe(3);
    expect(state.favelaPropertyStats.get('favela-centro-2')?.soldiersCount).toBe(3);
  });

  it('schedules propina for controlled favelas and allows a one-shot negotiated discount', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      state: 'controlled',
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.1]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const negotiationResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/territory/favelas/favela-centro-2/propina/negotiate',
    });

    expect(negotiationResponse.statusCode).toBe(200);
    expect(negotiationResponse.json().success).toBe(true);
    expect(negotiationResponse.json().discountRate).toBeCloseTo(0.329, 3);
    expect(negotiationResponse.json().propina.baseAmount).toBe(22200);
    expect(negotiationResponse.json().propina.currentAmount).toBeCloseTo(14896.2, 2);
    expect(negotiationResponse.json().propina.canNegotiate).toBe(false);
    expect(negotiationResponse.json().favela.propina.status).toBe('scheduled');
  });

  it('auto-pays propina on the due date when the faction bank has balance', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      propinaDiscountRate: 0.2,
      propinaDueDate: new Date('2026-03-11T02:10:00.000Z'),
      propinaValue: 17760,
      state: 'controlled',
    });

    const accessToken = await registerAndExtractToken(app.server);
    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.propina.status).toBe('scheduled');
    expect(favela?.propina.currentAmount).toBe(22200);
    expect(state.factions.get('faction-cv')?.bankMoney).toBe(232240);
    expect(state.favelas.get('favela-centro-2')?.propinaLastPaidAt?.toISOString()).toBe(
      '2026-03-11T03:10:00.000Z',
    );
    expect(state.favelas.get('favela-centro-2')?.propinaDueDate?.toISOString()).toBe(
      '2026-03-16T03:10:00.000Z',
    );
  });

  it('records a territory loss cue when the state takes a favela for unpaid propina', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      propinaDueDate: new Date('2026-03-03T03:10:00.000Z'),
      propinaValue: 22200,
      state: 'controlled',
    });

    const accessToken = await registerAndExtractToken(app.server);
    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    expect(territoryResponse.statusCode).toBe(200);
    expect(
      territoryResponse
        .json()
        .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2')?.state,
    ).toBe('state');

    const lossesResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/losses',
    });

    expect(lossesResponse.statusCode).toBe(200);
    expect(lossesResponse.json().cues).toEqual([
      expect.objectContaining({
        cause: 'state_takeover',
        favelaId: 'favela-centro-2',
        lostByFactionAbbreviation: 'CV',
        newControllerFactionAbbreviation: 'Estado',
        title: 'Santo Cristo: tomada estatal',
      }),
    ]);
  });

  it('applies propina delinquency penalties to favela service revenue', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      propinaDueDate: new Date('2026-03-09T03:10:00.000Z'),
      propinaValue: 22200,
      state: 'controlled',
    });
    state.factions.set('faction-cv', {
      ...state.factions.get('faction-cv')!,
      bankMoney: 5000,
    });
    state.favelaServices.set('favela-centro-2:gatonet', {
      active: true,
      favelaId: 'favela-centro-2',
      grossRevenueTotal: 0,
      id: 'favela-centro-2:gatonet',
      installedAt: new Date('2026-03-09T03:10:00.000Z'),
      lastRevenueAt: new Date('2026-03-11T03:10:00.000Z'),
      level: 1,
      serviceType: 'gatonet',
    });

    const accessToken = await registerAndExtractToken(app.server);
    const warningResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(warningResponse.statusCode).toBe(200);
    expect(warningResponse.json().favela.propina.status).toBe('warning');
    expect(
      warningResponse
        .json()
        .services.find((entry: { definition: { type: string } }) => entry.definition.type === 'gatonet')
        ?.revenueBreakdown.propinaPenaltyMultiplier,
    ).toBe(0.8);

    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      propinaDueDate: new Date('2026-03-06T03:10:00.000Z'),
      propinaValue: 22200,
    });

    const severeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(severeResponse.statusCode).toBe(200);
    expect(severeResponse.json().favela.propina.status).toBe('severe');
    expect(
      severeResponse
        .json()
        .services.find((entry: { definition: { type: string } }) => entry.definition.type === 'gatonet')
        ?.revenueBreakdown.propinaPenaltyMultiplier,
    ).toBe(0.5);
  });

  it('hands the favela to the State after seven overdue propina days', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      propinaDueDate: new Date('2026-03-05T03:10:00.000Z'),
      propinaValue: 22200,
      state: 'controlled',
    });
    state.factions.set('faction-cv', {
      ...state.factions.get('faction-cv')!,
      bankMoney: 0,
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const territoryResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas',
    });

    const favela = territoryResponse
      .json()
      .favelas.find((entry: { id: string }) => entry.id === 'favela-centro-2');

    expect(territoryResponse.statusCode).toBe(200);
    expect(favela?.state).toBe('state');
    expect(favela?.controllingFaction).toBeNull();
    expect(favela?.propina).toBeNull();
    expect(favela?.stateControlledUntil).toBe('2026-03-14T03:10:00.000Z');
  });

  it('returns baile status as ready before any event is organized', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      state: 'controlled',
    });

    const accessToken = await registerAndExtractToken(app.server);
    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/territory/favelas/favela-centro-2/baile',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().baile.status).toBe('ready');
    expect(response.json().baile.lastOrganizedAt).toBeNull();
  });

  it('organizes a total-success baile, boosts brisa and enforces cooldown', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfaction: 82,
      state: 'controlled',
    });
    const ally = state.players.get('player-sombra');

    if (!ally) {
      throw new Error('Missing ally fixture');
    }

    ally.cansaco = 60;

    const accessToken = await registerAndExtractToken(app.server);
    const actor = [...state.players.values()].find((player) => player.nickname === 'Territorio');

    if (!actor) {
      throw new Error('Missing actor fixture');
    }

    actor.cansaco = 55;

    const organizeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        budget: 40000,
        entryPrice: 1200,
        mcTier: 'estelar',
      },
      url: '/api/territory/favelas/favela-centro-2/baile',
    });

    expect(organizeResponse.statusCode).toBe(200);
    expect(organizeResponse.json().baile.resultTier).toBe('total_success');
    expect(organizeResponse.json().baile.status).toBe('active');
    expect(organizeResponse.json().favela.satisfaction).toBe(100);
    expect(organizeResponse.json().baile.cooldownEndsAt).toBe('2026-03-14T03:10:00.000Z');
    expect(state.factions.get('faction-cv')?.bankMoney).toBe(210000);
    expect(state.factions.get('faction-cv')?.points).toBe(780);
    expect(state.players.get('player-sombra')?.cansaco).toBe(95);
    expect(actor.cansaco).toBe(90);
    expect(
      organizeResponse.json().favela.satisfactionProfile.factors.some(
        (factor: { code: string }) => factor.code === 'baile',
      ),
    ).toBe(true);

    const secondAttempt = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        budget: 30000,
        entryPrice: 900,
        mcTier: 'regional',
      },
      url: '/api/territory/favelas/favela-centro-2/baile',
    });

    expect(secondAttempt.statusCode).toBe(409);
    expect(secondAttempt.json().message).toContain('cooldown');
  });

  it('organizes a failed baile, applies ressaca and drops faction points', async () => {
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      satisfaction: 20,
      state: 'controlled',
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      random: sequenceRandom([0.1]),
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const organizeResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        budget: 20000,
        entryPrice: 4500,
        mcTier: 'local',
      },
      url: '/api/territory/favelas/favela-centro-2/baile',
    });

    expect(organizeResponse.statusCode).toBe(200);
    expect(organizeResponse.json().baile.resultTier).toBe('failure');
    expect(organizeResponse.json().baile.status).toBe('hangover');
    expect(organizeResponse.json().baile.incidentCode).toBe('briga_generalizada');
    expect(organizeResponse.json().favela.satisfaction).toBe(10);
    expect(state.factions.get('faction-cv')?.bankMoney).toBe(230000);
    expect(state.factions.get('faction-cv')?.points).toBe(120);
  });

  it('blocks low hierarchy members from installing territorial services', async () => {
    state.defaultFactionRank = 'soldado';
    state.favelas.set('favela-centro-2', {
      ...state.favelas.get('favela-centro-2')!,
      controllingFactionId: 'faction-cv',
      state: 'controlled',
    });

    await app.server.close();
    app = await buildTestApp({
      now: () => now,
      state,
    });

    const accessToken = await registerAndExtractToken(app.server);
    const installResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        serviceType: 'van',
      },
      url: '/api/territory/favelas/favela-centro-2/services',
    });

    expect(installResponse.statusCode).toBe(403);
    expect(installResponse.json().message).toContain('patrao, general ou gerente');
  });
});

async function buildTestApp({
  now,
  random,
  state,
}: {
  now: () => Date;
  random?: () => number;
  state: TestState;
}) {
  const repository = new InMemoryAuthTerritoryRepository(state);
  const keyValueStore = new InMemoryKeyValueStore();
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const territoryService = new TerritoryService({
    keyValueStore,
    now,
    random,
    repository,
  });
  const actionIdempotency = new ActionIdempotency(keyValueStore);
  const app = Fastify();

  await app.register(createAuthRoutes({ authService }), {
    prefix: '/api',
  });
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
    await protectedRoutes.register(createTerritoryRoutes({ actionIdempotency, territoryService }), {
      prefix: '/api',
    });
  });

  return {
    server: app,
    territoryService,
  };
}

function buildPlayerRecord(input: {
  email: string;
  factionId: string | null;
  id: string;
  nickname: string;
  passwordHash: string;
  regionId: RegionId;
}): AuthPlayerRecord {
  return {
    addiction: 0,
    appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
    bankMoney: '0',
    carisma: 18,
    characterCreatedAt: new Date('2026-03-10T13:00:00.000Z'),
    conceito: 9000,
    createdAt: new Date('2026-03-10T12:00:00.000Z'),
    email: input.email,
    factionId: input.factionId,
    forca: 16,
    hp: 100,
    id: input.id,
    inteligencia: 14,
    lastLogin: new Date('2026-03-10T12:30:00.000Z'),
    level: 8,
    brisa: 100,
    money: '80000',
    disposicao: 100,
    nickname: input.nickname,
    passwordHash: input.passwordHash,
    positionX: 100,
    positionY: 100,
    regionId: input.regionId,
    resistencia: 17,
    cansaco: 100,
    vocation: VocationType.Soldado,
  };
}

function buildState(): TestState {
  const players = new Map<string, AuthPlayerRecord>();
  const playerRanks = new Map<string, FactionRank>();
  const playerLoadouts = new Map<string, InMemoryLoadout>();

  players.set(
    'player-sombra',
    buildPlayerRecord({
      email: 'sombra@test.com',
      factionId: 'faction-cv',
      id: 'player-sombra',
      nickname: 'Sombra',
      passwordHash: 'hash',
      regionId: RegionId.Centro,
    }),
  );
  playerRanks.set('player-sombra', 'soldado');
  playerLoadouts.set('player-sombra', {
    proficiency: 20,
    vestDefense: 2500,
    weaponPower: 10000,
  });
  players.set(
    'player-cv-apoio',
    buildPlayerRecord({
      email: 'apoio@test.com',
      factionId: 'faction-cv',
      id: 'player-cv-apoio',
      nickname: 'Apoio',
      passwordHash: 'hash',
      regionId: RegionId.Centro,
    }),
  );
  playerRanks.set('player-cv-apoio', 'soldado');
  playerLoadouts.set('player-cv-apoio', {
    proficiency: 25,
    vestDefense: 2600,
    weaponPower: 11000,
  });
  players.set(
    'player-tcp-1',
    buildPlayerRecord({
      email: 'trincheira@test.com',
      factionId: 'faction-tcp',
      id: 'player-tcp-1',
      nickname: 'Trincheira',
      passwordHash: 'hash',
      regionId: RegionId.Centro,
    }),
  );
  playerRanks.set('player-tcp-1', 'general');
  playerLoadouts.set('player-tcp-1', {
    proficiency: 15,
    vestDefense: 2200,
    weaponPower: 8500,
  });
  players.set(
    'player-tcp-2',
    buildPlayerRecord({
      email: 'bunker@test.com',
      factionId: 'faction-tcp',
      id: 'player-tcp-2',
      nickname: 'Bunker',
      passwordHash: 'hash',
      regionId: RegionId.Centro,
    }),
  );
  playerRanks.set('player-tcp-2', 'soldado');
  playerLoadouts.set('player-tcp-2', {
    proficiency: 10,
    vestDefense: 1800,
    weaponPower: 7000,
  });

  return {
    activeSatisfactionEvents: [],
    defaultFactionId: 'faction-cv',
    defaultFactionRank: 'general',
    factions: new Map([
      [
        'faction-cv',
        {
          abbreviation: 'CV',
          bankMoney: 250000,
          id: 'faction-cv',
          internalSatisfaction: 58,
          name: 'Comando Vermelho',
          points: 320,
        },
      ],
      [
        'faction-tcp',
        {
          abbreviation: 'TCP',
          bankMoney: 180000,
          id: 'faction-tcp',
          internalSatisfaction: 52,
          name: 'Terceiro Comando Puro',
          points: 220,
        },
      ],
    ]),
    favelaBanditReturns: new Map(),
    favelaBailes: new Map(),
    factionWars: new Map(),
    favelas: new Map([
      [
        'favela-centro-1',
        {
          banditsActive: 18,
          banditsArrested: 0,
          banditsDeadRecent: 0,
          banditsSyncedAt: new Date('2026-03-11T03:10:00.000Z'),
          code: 'morro_da_providencia',
          contestingFactionId: null,
          controllingFactionId: 'faction-tcp',
          difficulty: 5,
          id: 'favela-centro-1',
          lastX9RollAt: new Date('2026-03-11T03:10:00.000Z'),
          maxSoldiers: 18,
          name: 'Morro da Providencia',
          population: 5500,
          propinaDiscountRate: 0,
          propinaDueDate: null,
          propinaLastPaidAt: null,
          propinaNegotiatedAt: null,
          propinaNegotiatedByPlayerId: null,
          propinaValue: 0,
          regionId: RegionId.Centro,
          satisfaction: 50,
          satisfactionSyncedAt: new Date('2026-03-11T03:10:00.000Z'),
          stabilizationEndsAt: null,
          state: 'controlled',
          stateControlledUntil: null,
          warDeclaredAt: null,
        },
      ],
      [
        'favela-centro-2',
        {
          banditsActive: 14,
          banditsArrested: 0,
          banditsDeadRecent: 0,
          banditsSyncedAt: new Date('2026-03-11T03:10:00.000Z'),
          code: 'santo_cristo',
          contestingFactionId: null,
          controllingFactionId: null,
          difficulty: 4,
          id: 'favela-centro-2',
          lastX9RollAt: new Date('2026-03-11T03:10:00.000Z'),
          maxSoldiers: 18,
          name: 'Santo Cristo',
          population: 3700,
          propinaDiscountRate: 0,
          propinaDueDate: null,
          propinaLastPaidAt: null,
          propinaNegotiatedAt: null,
          propinaNegotiatedByPlayerId: null,
          propinaValue: 0,
          regionId: RegionId.Centro,
          satisfaction: 50,
          satisfactionSyncedAt: new Date('2026-03-11T03:10:00.000Z'),
          stabilizationEndsAt: null,
          state: 'neutral',
          stateControlledUntil: null,
          warDeclaredAt: null,
        },
      ],
    ]),
    favelaPropertyStats: new Map([
      [
        'favela-centro-1',
        {
          activePropertyCount: 0,
          favelaId: 'favela-centro-1',
          soldiersCount: 0,
          suspendedPropertyCount: 0,
        },
      ],
      [
        'favela-centro-2',
        {
          activePropertyCount: 0,
          favelaId: 'favela-centro-2',
          soldiersCount: 0,
          suspendedPropertyCount: 0,
        },
      ],
    ]),
    favelaServices: new Map(),
    playerLoadouts,
    playerRanks,
    players,
    regions: new Map([
      [
        RegionId.Centro,
        {
          densityIndex: 60,
          id: RegionId.Centro,
          operationCostMultiplier: 1.05,
          policePressure: 70,
          wealthIndex: 65,
        },
      ],
    ]),
    x9Events: new Map(),
    x9ExposureByFavela: new Map(),
  };
}

async function registerAndExtractToken(
  server: FastifyInstance,
  input?: {
    email?: string;
    nickname?: string;
  },
): Promise<string> {
  const registerResponse = await server.inject({
    method: 'POST',
    payload: {
      email: input?.email ?? 'territory@test.com',
      nickname: input?.nickname ?? 'Territorio',
      password: '12345678',
    },
    url: '/api/auth/register',
  });

  expect(registerResponse.statusCode).toBe(201);
  return registerResponse.json().accessToken as string;
}

function resolveServiceDefinition(serviceType: FavelaServiceType) {
  const definition = FAVELA_SERVICE_DEFINITIONS.find((entry) => entry.type === serviceType);

  if (!definition) {
    throw new Error(`Missing service definition for ${serviceType}`);
  }

  return definition;
}

function resolveServiceUpgradeCost(installCost: number, currentLevel: number): number {
  return roundCurrency(installCost * (0.7 + currentLevel * 0.3));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildEmptyX9Exposure(): InMemoryFavelaX9Exposure {
  return {
    cashTargets: [],
    drugTargets: [],
    soldierTargets: [],
  };
}

function cloneX9Exposure(exposure: InMemoryFavelaX9Exposure): InMemoryFavelaX9Exposure {
  return {
    cashTargets: exposure.cashTargets.map((entry) => ({ ...entry })),
    drugTargets: exposure.drugTargets.map((entry) => ({ ...entry })),
    soldierTargets: exposure.soldierTargets.map((entry) => ({ ...entry })),
  };
}

function cloneX9Event(event: InMemoryX9EventRecord): InMemoryX9EventRecord {
  return {
    ...event,
    desenroloAttemptedAt: event.desenroloAttemptedAt ? new Date(event.desenroloAttemptedAt) : null,
    incursionAt: event.incursionAt ? new Date(event.incursionAt) : null,
    resolvedAt: event.resolvedAt ? new Date(event.resolvedAt) : null,
    soldierImpacts: event.soldierImpacts.map((entry) => ({ ...entry })),
    soldiersReleaseAt: event.soldiersReleaseAt ? new Date(event.soldiersReleaseAt) : null,
    triggeredAt: new Date(event.triggeredAt),
    warningEndsAt: event.warningEndsAt ? new Date(event.warningEndsAt) : null,
  };
}

function cloneFactionWar(war: InMemoryFactionWarRecord): InMemoryFactionWarRecord {
  return {
    ...war,
    attackerPreparation: war.attackerPreparation
      ? {
          ...war.attackerPreparation,
          preparedAt: new Date(war.attackerPreparation.preparedAt),
        }
      : null,
    cooldownEndsAt: war.cooldownEndsAt ? new Date(war.cooldownEndsAt) : null,
    declaredAt: new Date(war.declaredAt),
    defenderPreparation: war.defenderPreparation
      ? {
          ...war.defenderPreparation,
          preparedAt: new Date(war.defenderPreparation.preparedAt),
        }
      : null,
    endedAt: war.endedAt ? new Date(war.endedAt) : null,
    nextRoundAt: war.nextRoundAt ? new Date(war.nextRoundAt) : null,
    preparationEndsAt: war.preparationEndsAt ? new Date(war.preparationEndsAt) : null,
    rounds: war.rounds.map((round) => ({
      ...round,
      resolvedAt: new Date(round.resolvedAt),
    })),
    startsAt: war.startsAt ? new Date(war.startsAt) : null,
  };
}

function syncFavelaPropertyStatsFromX9Exposure(state: TestState, favelaId: string): void {
  const exposure = state.x9ExposureByFavela.get(favelaId);
  const current = state.favelaPropertyStats.get(favelaId);

  if (!exposure || !current) {
    return;
  }

  current.soldiersCount = exposure.soldierTargets.reduce((sum, target) => sum + target.soldiersCount, 0);
}

function sequenceRandom(values: number[], fallback = 0.99): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? fallback;
    index += 1;
    return value;
  };
}
