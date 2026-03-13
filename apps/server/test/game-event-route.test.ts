import {
  RegionId,
  type DocksEventStatusResponse,
  type PoliceEventStatusResponse,
  type PoliceEventType,
  type ResolvedGameConfigCatalog,
  type ResolvedGameConfigEntrySummary,
  type SeasonalEventStatusResponse,
  type SeasonalEventType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createEventRoutes } from '../src/api/routes/events.js';
import {
  GameEventService,
  type GameEventConfigReaderContract,
  type GameEventRepository,
  type GameEventServiceContract,
} from '../src/services/game-event.js';
import { type AuthService } from '../src/services/auth.js';

interface InMemoryDocksEventRecord {
  endsAt: Date;
  id: string;
  regionId: RegionId;
  startedAt: Date;
}

interface InMemoryPoliceEventRecord {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: PoliceEventType;
  favelaId: string | null;
  id: string;
  regionId: RegionId;
  startedAt: Date;
}

interface InMemoryGlobalEventRecord {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: 'saidinha_natal';
  id: string;
  startedAt: Date;
}

interface InMemorySeasonalEventRecord {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: SeasonalEventType;
  id: string;
  regionId: RegionId;
  startedAt: Date;
}

interface InMemoryRegionRecord {
  id: RegionId;
  name: string;
  policePressure: number;
}

interface InMemoryFavelaRecord {
  banditsActive: number;
  banditsArrested: number;
  controllingFactionId: string | null;
  difficulty: number;
  factionInternalSatisfaction: number | null;
  id: string;
  name: string;
  population: number;
  regionId: RegionId;
  satisfaction: number;
}

interface InMemoryBanditReturnRecord {
  favelaId: string;
  id: string;
  quantity: number;
  releaseAt: Date;
  returnFlavor: 'audiencia_custodia' | 'habeas_corpus' | 'lili_cantou';
}

interface InMemoryFavelaBopeExposure {
  drugTargets: Array<{
    drugId: string;
    kind: 'boca' | 'factory' | 'rave';
    propertyId: string;
    quantity: number;
  }>;
  soldierTargets: Array<{
    propertyId: string;
    soldierIds: string[];
    soldiersCount: number;
  }>;
}

class InMemoryGameEventRepository implements GameEventRepository {
  private nextId = 1;

  constructor(
    private readonly docksRecords: InMemoryDocksEventRecord[] = [],
    private readonly policeRecords: InMemoryPoliceEventRecord[] = [],
    private readonly regions: InMemoryRegionRecord[] = [],
    private readonly controlledFavelas: InMemoryFavelaRecord[] = [],
    private readonly bopeExposureByFavela: Record<string, InMemoryFavelaBopeExposure> = {},
    private readonly activePrisonerIds: string[] = [],
    private readonly globalEvents: InMemoryGlobalEventRecord[] = [],
    private readonly seasonalEvents: InMemorySeasonalEventRecord[] = [],
    private readonly banditReturns: InMemoryBanditReturnRecord[] = [],
  ) {}

  async applyFavelaSatisfactionImpact(input: {
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
  }) {
    const favela = this.controlledFavelas.find((entry) => entry.id === input.favelaId);

    if (favela) {
      favela.satisfaction = input.nextSatisfaction;
    }
  }

  async applyFactionInternalSatisfactionImpact(input: {
    factionId: string;
    nextInternalSatisfaction: number;
  }) {
    for (const favela of this.controlledFavelas) {
      if (favela.controllingFactionId === input.factionId) {
        favela.factionInternalSatisfaction = input.nextInternalSatisfaction;
      }
    }
  }

  async applyOperationPolicialBanditImpact(input: {
    arrests: Array<{
      quantity: number;
      releaseAt: Date;
      returnFlavor: 'audiencia_custodia' | 'habeas_corpus' | 'lili_cantou';
    }>;
    favelaId: string;
  }) {
    const favela = this.controlledFavelas.find((entry) => entry.id === input.favelaId);
    const totalArrested = input.arrests.reduce((sum, entry) => sum + entry.quantity, 0);

    if (favela && totalArrested > 0) {
      favela.banditsActive = Math.max(0, favela.banditsActive - totalArrested);
      favela.banditsArrested += totalArrested;
    }

    for (const arrest of input.arrests) {
      this.banditReturns.push({
        favelaId: input.favelaId,
        id: `bandit-return-${this.nextId++}`,
        quantity: arrest.quantity,
        releaseAt: arrest.releaseAt,
        returnFlavor: arrest.returnFlavor,
      });
    }
  }

  async applyFacaNaCaveiraImpact(input: {
    banditsKilled: number;
    drugImpacts: Array<{
      drugId: string;
      kind: 'boca' | 'factory' | 'rave';
      lostQuantity: number;
      propertyId: string;
    }>;
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
    soldierImpacts: Array<{
      count: number;
      propertyId: string;
      soldierIds: string[];
    }>;
  }) {
    const favela = this.controlledFavelas.find((entry) => entry.id === input.favelaId);

    if (favela) {
      favela.banditsActive = Math.max(0, favela.banditsActive - input.banditsKilled);
      favela.satisfaction = input.nextSatisfaction;
    }

    const exposure = this.bopeExposureByFavela[input.favelaId];

    if (!exposure) {
      return;
    }

    for (const impact of input.drugImpacts) {
      const target = exposure.drugTargets.find(
        (entry) =>
          entry.propertyId === impact.propertyId &&
          entry.drugId === impact.drugId &&
          entry.kind === impact.kind,
      );

      if (target) {
        target.quantity = Math.max(0, target.quantity - impact.lostQuantity);
      }
    }

    for (const impact of input.soldierImpacts) {
      const target = exposure.soldierTargets.find((entry) => entry.propertyId === impact.propertyId);

      if (!target) {
        continue;
      }

      const removed = new Set(impact.soldierIds);
      target.soldierIds = target.soldierIds.filter((soldierId) => !removed.has(soldierId));
      target.soldiersCount = target.soldierIds.length;
    }
  }

  async createDocksEvent(input: { endsAt: Date; regionId: RegionId; startedAt: Date }) {
    this.docksRecords.push({
      endsAt: input.endsAt,
      id: `dock-${this.nextId++}`,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async countActivePrisoners() {
    return new Set(this.activePrisonerIds).size;
  }

  async countArrestedBandits() {
    return this.controlledFavelas.reduce((sum, favela) => sum + favela.banditsArrested, 0);
  }

  async createGlobalEvent(input: {
    dataJson: Record<string, unknown>;
    endsAt: Date;
    eventType: 'saidinha_natal';
    startedAt: Date;
  }) {
    this.globalEvents.push({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      id: `global-${this.nextId++}`,
      startedAt: input.startedAt,
    });
  }

  async createPoliceEvent(input: {
    dataJson: Record<string, unknown>;
    endsAt: Date;
    eventType: PoliceEventType;
    favelaId?: string | null;
    regionId: RegionId;
    startedAt: Date;
  }) {
    this.policeRecords.push({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      favelaId: input.favelaId ?? null,
      id: `police-${this.nextId++}`,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async createSeasonalEvent(input: {
    dataJson: Record<string, unknown>;
    endsAt: Date;
    eventType: SeasonalEventType;
    regionId: RegionId;
    startedAt: Date;
  }) {
    this.seasonalEvents.push({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      id: `seasonal-${this.nextId++}`,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async getFavelaBopeExposure(favelaId: string) {
    const exposure = this.bopeExposureByFavela[favelaId];

    if (!exposure) {
      return {
        drugTargets: [],
        soldierTargets: [],
      };
    }

    return {
      drugTargets: exposure.drugTargets.map((target) => ({ ...target })),
      soldierTargets: exposure.soldierTargets.map((target) => ({
        ...target,
        soldierIds: [...target.soldierIds],
      })),
    };
  }

  async hasRecentPoliceEvent(input: {
    eventType: PoliceEventType;
    regionId: RegionId;
    since: Date;
  }) {
    return this.policeRecords.some(
      (record) =>
        record.eventType === input.eventType &&
        record.regionId === input.regionId &&
        record.endsAt.getTime() >= input.since.getTime(),
    );
  }

  async hasRecentGlobalEvent(input: {
    eventType: 'saidinha_natal';
    since: Date;
  }) {
    return this.globalEvents.some(
      (record) =>
        record.eventType === input.eventType && record.endsAt.getTime() >= input.since.getTime(),
    );
  }

  async hasRecentSeasonalEvent(input: {
    eventType: SeasonalEventType;
    regionId: RegionId;
    since: Date;
  }) {
    return this.seasonalEvents.some(
      (record) =>
        record.eventType === input.eventType &&
        record.regionId === input.regionId &&
        record.endsAt.getTime() >= input.since.getTime(),
    );
  }

  async listActivePoliceEvents(now: Date) {
    return this.policeRecords
      .filter(
        (record) =>
          record.startedAt.getTime() <= now.getTime() && record.endsAt.getTime() >= now.getTime(),
      )
      .map((record) => {
        const region = this.regions.find((entry) => entry.id === record.regionId);
        const favela = this.controlledFavelas.find((entry) => entry.id === record.favelaId);

        return {
          dataJson: record.dataJson,
          endsAt: record.endsAt,
          eventType: record.eventType,
          favelaId: record.favelaId,
          favelaName: favela?.name ?? null,
          regionId: record.regionId,
          regionName: region?.name ?? record.regionId,
          startedAt: record.startedAt,
        };
      });
  }

  async listActiveSeasonalEvents(now: Date) {
    return this.seasonalEvents
      .filter(
        (record) =>
          record.startedAt.getTime() <= now.getTime() && record.endsAt.getTime() >= now.getTime(),
      )
      .map((record) => {
        const region = this.regions.find((entry) => entry.id === record.regionId);

        return {
          dataJson: record.dataJson,
          endsAt: record.endsAt,
          eventType: record.eventType,
          regionId: record.regionId,
          regionName: region?.name ?? record.regionId,
          startedAt: record.startedAt,
        };
      });
  }

  async listControlledFavelas() {
    return this.controlledFavelas.map((record) => ({ ...record }));
  }

  async listRegions() {
    return this.regions.map((record) => ({ ...record }));
  }

  async listUpcomingOrActiveDocksEvents(now: Date) {
    return this.docksRecords
      .filter((record) => record.endsAt.getTime() >= now.getTime())
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
      .map((record) => ({ ...record }))
      .slice(0, 2);
  }

  async releasePrisonersForSaidinha() {
    const playerIds = [...new Set(this.activePrisonerIds)];
    this.activePrisonerIds.length = 0;

    return {
      playerIds,
      releasedPlayers: playerIds.length,
    };
  }

  async releaseBanditsForSaidinha() {
    const released = this.banditReturns.reduce((sum, entry) => sum + entry.quantity, 0);

    if (released <= 0) {
      return 0;
    }

    for (const entry of this.banditReturns) {
      const favela = this.controlledFavelas.find((candidate) => candidate.id === entry.favelaId);

      if (!favela) {
        continue;
      }

      favela.banditsActive += entry.quantity;
      favela.banditsArrested = Math.max(0, favela.banditsArrested - entry.quantity);
    }

    this.banditReturns.splice(0, this.banditReturns.length);
    return released;
  }

  async updateRegionPolicePressure(input: { nextPolicePressure: number; regionId: RegionId }) {
    const region = this.regions.find((entry) => entry.id === input.regionId);

    if (region) {
      region.policePressure = input.nextPolicePressure;
    }
  }
}

function createResolvedCatalog(input: {
  entries?: ResolvedGameConfigEntrySummary[];
  featureFlags?: ResolvedGameConfigCatalog['featureFlags'];
  resolvedAt?: string;
} = {}): ResolvedGameConfigCatalog {
  return {
    activeRoundId: null,
    activeSet: null,
    entries: input.entries ?? [],
    featureFlags: input.featureFlags ?? [],
    resolvedAt: input.resolvedAt ?? '2026-03-12T00:00:00.000Z',
  };
}

function createConfigReader(catalog: ResolvedGameConfigCatalog): GameEventConfigReaderContract {
  return {
    getResolvedCatalog: async () => catalog,
  };
}

describe('GameEventService', () => {
  it('schedules the next docks ship in Centro with pre-alpha cadence', async () => {
    const repository = new InMemoryGameEventRepository();
    const service = new GameEventService({
      random: () => 0.5,
      repository,
    });
    const now = new Date('2026-03-11T12:00:00.000Z');

    await service.syncScheduledEvents(now);
    const status = await service.getDocksStatus(now);

    expect(status).toMatchObject({
      isActive: false,
      phase: 'scheduled',
      premiumMultiplier: 1.5,
      regionId: RegionId.Centro,
      unlimitedDemand: false,
    });
    expect(status.startsAt).not.toBeNull();
    expect(status.endsAt).not.toBeNull();

    const startsAt = new Date(status.startsAt ?? now.toISOString());
    const endsAt = new Date(status.endsAt ?? now.toISOString());
    const delayMs = startsAt.getTime() - now.getTime();

    expect(delayMs).toBeGreaterThanOrEqual(18 * 60 * 60 * 1000);
    expect(delayMs).toBeLessThanOrEqual(30 * 60 * 60 * 1000);
    expect(endsAt.getTime() - startsAt.getTime()).toBe(6 * 60 * 60 * 1000);
  });

  it('returns an active docks ship with remaining timer and unlimited demand flag', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository([
      {
        endsAt: new Date('2026-03-11T15:00:00.000Z'),
        id: 'dock-1',
        regionId: RegionId.Centro,
        startedAt: new Date('2026-03-11T10:00:00.000Z'),
      },
    ]);
    const service = new GameEventService({
      repository,
    });

    const status = await service.getDocksStatus(now);

    expect(status).toEqual({
      endsAt: '2026-03-11T15:00:00.000Z',
      isActive: true,
      phase: 'active',
      premiumMultiplier: 1.5,
      regionId: RegionId.Centro,
      remainingSeconds: 10800,
      secondsUntilStart: 0,
      startsAt: '2026-03-11T10:00:00.000Z',
      unlimitedDemand: true,
    });
  });

  it('reads docks configuration and feature flags from the resolved catalog', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const disabledRepository = new InMemoryGameEventRepository();
    const disabledService = new GameEventService({
      gameConfigService: createConfigReader(
        createResolvedCatalog({
          featureFlags: [
            {
              effectiveFrom: '2026-03-01T00:00:00.000Z',
              effectiveUntil: null,
              id: 'flag-docks-disabled',
              key: 'events.navio_docas.enabled',
              notes: null,
              payloadJson: {},
              scope: 'event_type',
              status: 'inactive',
              targetKey: 'navio_docas',
            },
          ],
          resolvedAt: now.toISOString(),
        }),
      ),
      random: () => 0,
      repository: disabledRepository,
    });

    await (disabledService as unknown as { syncDocks: (now: Date) => Promise<void> }).syncDocks(now);
    const disabledStatus = await disabledService.getDocksStatus(now);

    expect(disabledStatus).toMatchObject({
      isActive: false,
      phase: 'idle',
      startsAt: null,
      endsAt: null,
    });

    const customRepository = new InMemoryGameEventRepository();
    const customService = new GameEventService({
      gameConfigService: createConfigReader(
        createResolvedCatalog({
          entries: [
            {
              key: 'event.definition',
              scope: 'event_type',
              source: 'set_entry',
              targetKey: 'navio_docas',
              valueJson: {
                durationMs: 2 * 60 * 60 * 1000,
                headline: 'Navio customizado nas docas.',
                maxNextDelayMs: 60 * 60 * 1000,
                minNextDelayMs: 60 * 60 * 1000,
                premiumMultiplier: 2.25,
                regionIds: [RegionId.ZonaNorte],
                source: 'custom_docks_event',
                unlimitedDemand: false,
              },
            },
          ],
          featureFlags: [
            {
              effectiveFrom: '2026-03-01T00:00:00.000Z',
              effectiveUntil: null,
              id: 'flag-docks-enabled',
              key: 'events.navio_docas.enabled',
              notes: null,
              payloadJson: {},
              scope: 'event_type',
              status: 'active',
              targetKey: 'navio_docas',
            },
          ],
          resolvedAt: now.toISOString(),
        }),
      ),
      random: () => 0,
      repository: customRepository,
    });

    await (customService as unknown as { syncDocks: (now: Date) => Promise<void> }).syncDocks(now);
    const customStatus = await customService.getDocksStatus(now);

    expect(customStatus).toMatchObject({
      isActive: false,
      phase: 'scheduled',
      premiumMultiplier: 2.25,
      regionId: RegionId.ZonaNorte,
      unlimitedDemand: false,
    });
    expect(customStatus.startsAt).not.toBeNull();
    expect(customStatus.endsAt).not.toBeNull();

    const startsAt = new Date(customStatus.startsAt ?? now.toISOString());
    const endsAt = new Date(customStatus.endsAt ?? now.toISOString());

    expect(startsAt.getTime() - now.getTime()).toBe(60 * 60 * 1000);
    expect(endsAt.getTime() - startsAt.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('creates police operation, blitz and BOPE events with territorial impact', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository(
      [],
      [],
      [
        {
          id: RegionId.ZonaNorte,
          name: 'Zona Norte',
          policePressure: 70,
        },
      ],
      [
        {
          banditsActive: 26,
          banditsArrested: 0,
          controllingFactionId: 'faction-1',
          difficulty: 4,
          factionInternalSatisfaction: 60,
          id: 'favela-1',
          name: 'Complexo do Teste',
          population: 8000,
          regionId: RegionId.ZonaNorte,
          satisfaction: 32,
        },
      ],
    );
    const service = new GameEventService({
      random: () => 0,
      repository,
    });

    await service.syncScheduledEvents(now);
    const policeStatus = await service.getPoliceStatus(now);
    const updatedRegions = await repository.listRegions();
    const updatedFavelas = await repository.listControlledFavelas();

    expect(policeStatus.events).toHaveLength(3);
    expect(policeStatus.events.map((event) => event.eventType).sort()).toEqual([
      'blitz_pm',
      'faca_na_caveira',
      'operacao_policial',
    ]);
    expect(updatedRegions[0]?.policePressure).toBe(66);
    expect(updatedFavelas[0]?.factionInternalSatisfaction).toBe(52);
    expect(updatedFavelas[0]?.satisfaction).toBe(8);

    const operation = policeStatus.events.find((event) => event.eventType === 'operacao_policial');
    expect(operation).toMatchObject({
      banditsArrested: 1,
      favelaId: 'favela-1',
      policePressureAfter: 82,
      policePressureBefore: 70,
      regionId: RegionId.ZonaNorte,
      satisfactionAfter: 24,
      satisfactionBefore: 32,
    });

    const blitz = policeStatus.events.find((event) => event.eventType === 'blitz_pm');
    expect(blitz).toMatchObject({
      favelaId: null,
      policePressureAfter: 91,
      policePressureBefore: 82,
      regionId: RegionId.ZonaNorte,
      satisfactionAfter: 22,
      satisfactionBefore: 24,
    });

    const bope = policeStatus.events.find((event) => event.eventType === 'faca_na_caveira');
    expect(bope).toMatchObject({
      banditsKilledEstimate: 3,
      drugsLost: 0,
      eventType: 'faca_na_caveira',
      favelaId: 'favela-1',
      headline:
        'As operações do BOPE não fazem prisioneiros, não tem desenrolo, é faca na caveira! Eles entram, tomam armas, drogas e matam!',
      internalSatisfactionAfter: 52,
      internalSatisfactionBefore: 60,
      policePressureAfter: 66,
      policePressureBefore: 91,
      satisfactionAfter: 8,
      satisfactionBefore: 22,
      soldiersLost: 0,
      weaponsLost: 0,
    });
  });

  it('applies BOPE seizures and soldier deaths on exposed favela assets', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository(
      [],
      [],
      [
        {
          id: RegionId.ZonaNorte,
          name: 'Zona Norte',
          policePressure: 95,
        },
      ],
      [
        {
          banditsActive: 34,
          banditsArrested: 0,
          controllingFactionId: 'faction-7',
          difficulty: 5,
          factionInternalSatisfaction: 58,
          id: 'favela-77',
          name: 'Favela do BOPE',
          population: 12000,
          regionId: RegionId.ZonaNorte,
          satisfaction: 18,
        },
      ],
      {
        'favela-77': {
          drugTargets: [
            {
              drugId: 'drug-1',
              kind: 'boca',
              propertyId: 'property-boca',
              quantity: 120,
            },
            {
              drugId: 'drug-2',
              kind: 'factory',
              propertyId: 'property-factory',
              quantity: 80,
            },
          ],
          soldierTargets: [
            {
              propertyId: 'property-boca',
              soldierIds: ['s1', 's2', 's3', 's4', 's5'],
              soldiersCount: 5,
            },
          ],
        },
      },
    );
    const service = new GameEventService({
      random: () => 0,
      repository,
    });

    await (
      service as unknown as {
        syncFacaNaCaveira: (now: Date) => Promise<void>;
      }
    ).syncFacaNaCaveira(now);

    const policeStatus = await service.getPoliceStatus(now);
    const updatedRegions = await repository.listRegions();
    const updatedFavelas = await repository.listControlledFavelas();
    const updatedExposure = await repository.getFavelaBopeExposure('favela-77');

    expect(policeStatus.events).toHaveLength(1);
    expect(policeStatus.events[0]).toMatchObject({
      banditsKilledEstimate: 4,
      drugsLost: 70,
      eventType: 'faca_na_caveira',
      internalSatisfactionAfter: 50,
      internalSatisfactionBefore: 58,
      policePressureAfter: 70,
      policePressureBefore: 95,
      satisfactionAfter: 4,
      satisfactionBefore: 18,
      soldiersLost: 1,
      weaponsLost: 1,
    });
    expect(updatedRegions[0]?.policePressure).toBe(70);
    expect(updatedFavelas[0]?.banditsActive).toBe(30);
    expect(updatedFavelas[0]?.factionInternalSatisfaction).toBe(50);
    expect(updatedFavelas[0]?.satisfaction).toBe(4);
    expect(updatedExposure.drugTargets).toEqual([
      {
        drugId: 'drug-1',
        kind: 'boca',
        propertyId: 'property-boca',
        quantity: 78,
      },
      {
        drugId: 'drug-2',
        kind: 'factory',
        propertyId: 'property-factory',
        quantity: 52,
      },
    ]);
    expect(updatedExposure.soldierTargets).toEqual([
      {
        propertyId: 'property-boca',
        soldierIds: ['s2', 's3', 's4', 's5'],
        soldiersCount: 4,
      },
    ]);
  });

  it('releases imprisoned players and records Saidinha de Natal as a global event', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository(
      [],
      [],
      [
        {
          id: RegionId.ZonaNorte,
          name: 'Zona Norte',
          policePressure: 35,
        },
      ],
      [
        {
          banditsActive: 18,
          banditsArrested: 6,
          controllingFactionId: 'faction-9',
          difficulty: 4,
          factionInternalSatisfaction: 55,
          id: 'favela-99',
          name: 'Favela da Liberdade',
          population: 9000,
          regionId: RegionId.ZonaNorte,
          satisfaction: 44,
        },
      ],
      {},
      ['player-1', 'player-2', 'player-2'],
      [],
      [],
      [
        {
          favelaId: 'favela-99',
          id: 'return-1',
          quantity: 2,
          releaseAt: new Date('2026-03-18T12:00:00.000Z'),
          returnFlavor: 'audiencia_custodia',
        },
      ],
    );
    const service = new GameEventService({
      random: () => 0,
      repository,
    });

    await (
      service as unknown as {
        syncSaidinhaNatal: (now: Date) => Promise<void>;
      }
    ).syncSaidinhaNatal(now);

    expect((repository as unknown as { activePrisonerIds: string[] }).activePrisonerIds).toEqual([]);
    expect((await repository.listControlledFavelas())[0]?.banditsActive).toBe(20);
    expect((await repository.listControlledFavelas())[0]?.banditsArrested).toBe(4);
    expect(
      (
        repository as unknown as {
          globalEvents: InMemoryGlobalEventRecord[];
        }
      ).globalEvents,
    ).toHaveLength(1);
    expect(
      (
        repository as unknown as {
          globalEvents: InMemoryGlobalEventRecord[];
        }
      ).globalEvents[0],
    ).toMatchObject({
      dataJson: {
        headline:
          'Saidinha de Natal! Os presos elegíveis ganharam a rua de novo e os bandidos voltaram para as favelas.',
        phase: '14.5',
        releasedBanditsEstimate: 2,
        releasedPlayerIds: ['player-1', 'player-2'],
        releasedPlayers: 2,
        source: 'scheduled_saidinha_natal',
      },
      eventType: 'saidinha_natal',
      startedAt: now,
    });
  });

  it('creates seasonal events for Carnaval, Ano Novo em Copa and Operacao Verao', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository(
      [],
      [],
      [
        {
          id: RegionId.ZonaSul,
          name: 'Zona Sul',
          policePressure: 44,
        },
        {
          id: RegionId.Centro,
          name: 'Centro',
          policePressure: 39,
        },
      ],
      [],
    );
    const service = new GameEventService({
      random: () => 0,
      repository,
    });

    await (
      service as unknown as {
        syncSeasonalEvents: (now: Date) => Promise<void>;
      }
    ).syncSeasonalEvents(now);

    const seasonalStatus = await service.getSeasonalStatus(now);

    expect(seasonalStatus.events).toHaveLength(5);
    expect(seasonalStatus.events.map((event) => `${event.eventType}:${event.regionId}`).sort()).toEqual([
      'ano_novo_copa:centro',
      'ano_novo_copa:zona_sul',
      'carnaval:centro',
      'carnaval:zona_sul',
      'operacao_verao:zona_sul',
    ]);
    expect(seasonalStatus.events.find((event) => event.eventType === 'carnaval')).toMatchObject({
      headline:
        'Carnaval no Rio: turistas na pista, caixa quente na Zona Sul e a polícia distraída atrás do trio.',
      policeMood: 'distracted',
    });
    expect(
      (
        repository as unknown as {
          seasonalEvents: InMemorySeasonalEventRecord[];
        }
      ).seasonalEvents,
    ).toHaveLength(5);
  });

  it('reads seasonal definitions and feature flags from the resolved catalog', async () => {
    const now = new Date('2026-03-11T12:00:00.000Z');
    const repository = new InMemoryGameEventRepository(
      [],
      [],
      [
        {
          id: RegionId.ZonaNorte,
          name: 'Zona Norte',
          policePressure: 52,
        },
      ],
      [],
    );
    const service = new GameEventService({
      gameConfigService: createConfigReader(
        createResolvedCatalog({
          entries: [
            {
              key: 'event.definition',
              scope: 'event_type',
              source: 'set_entry',
              targetKey: 'carnaval',
              valueJson: {
                bonusSummary: [
                  'A rua virou pista na Zona Norte.',
                  'O caixa do entretenimento subiu com o bloco local.',
                ],
                cooldownMs: 0,
                durationMs: 4 * 60 * 60 * 1000,
                headline: 'Carnaval customizado: o bloco tomou a Zona Norte.',
                policeMood: 'distracted',
                policeRollMultiplier: 0.4,
                regionIds: [RegionId.ZonaNorte],
                rollChance: 1,
                source: 'custom_carnaval',
              },
            },
          ],
          featureFlags: [
            {
              effectiveFrom: '2026-03-01T00:00:00.000Z',
              effectiveUntil: null,
              id: 'flag-carnaval-enabled',
              key: 'events.carnaval.enabled',
              notes: null,
              payloadJson: {},
              scope: 'event_type',
              status: 'active',
              targetKey: 'carnaval',
            },
            {
              effectiveFrom: '2026-03-01T00:00:00.000Z',
              effectiveUntil: null,
              id: 'flag-ano-novo-disabled',
              key: 'events.ano_novo_copa.enabled',
              notes: null,
              payloadJson: {},
              scope: 'event_type',
              status: 'inactive',
              targetKey: 'ano_novo_copa',
            },
            {
              effectiveFrom: '2026-03-01T00:00:00.000Z',
              effectiveUntil: null,
              id: 'flag-operacao-verao-disabled',
              key: 'events.operacao_verao.enabled',
              notes: null,
              payloadJson: {},
              scope: 'event_type',
              status: 'inactive',
              targetKey: 'operacao_verao',
            },
          ],
          resolvedAt: now.toISOString(),
        }),
      ),
      random: () => 0,
      repository,
    });

    await (
      service as unknown as {
        syncSeasonalEvents: (now: Date) => Promise<void>;
      }
    ).syncSeasonalEvents(now);

    const seasonalStatus = await service.getSeasonalStatus(now);

    expect(seasonalStatus.events).toHaveLength(1);
    expect(seasonalStatus.events[0]).toMatchObject({
      bonusSummary: [
        'A rua virou pista na Zona Norte.',
        'O caixa do entretenimento subiu com o bloco local.',
      ],
      eventType: 'carnaval',
      headline: 'Carnaval customizado: o bloco tomou a Zona Norte.',
      policeMood: 'distracted',
      regionId: RegionId.ZonaNorte,
      regionName: 'Zona Norte',
    });
  });
});

describe('event routes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  const getDocksStatus = vi.fn<() => Promise<DocksEventStatusResponse>>();
  const getPoliceStatus = vi.fn<() => Promise<PoliceEventStatusResponse>>();
  const getSeasonalStatus = vi.fn<() => Promise<SeasonalEventStatusResponse>>();
  const eventService: GameEventServiceContract = {
    getDocksStatus,
    getPoliceStatus,
    getSeasonalStatus,
    syncScheduledEvents: vi.fn(),
  };
  const authService = {
    verifyAccessToken: vi.fn(() => ({
      playerId: 'player-1',
    })),
  } as unknown as AuthService;

  beforeEach(async () => {
    app = Fastify();
    await app.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      await protectedRoutes.register(createEventRoutes({ gameEventService: eventService }), {
        prefix: '/api',
      });
    });
    await app.ready();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns the current docks timer for authenticated players', async () => {
    getDocksStatus.mockResolvedValueOnce({
      endsAt: '2026-03-12T18:00:00.000Z',
      isActive: false,
      phase: 'scheduled',
      premiumMultiplier: 1.5,
      regionId: RegionId.Centro,
      remainingSeconds: 0,
      secondsUntilStart: 7200,
      startsAt: '2026-03-12T12:00:00.000Z',
      unlimitedDemand: false,
    });

    const response = await app.inject({
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'GET',
      url: '/api/events/docks',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      phase: 'scheduled',
      premiumMultiplier: 1.5,
      regionId: RegionId.Centro,
      secondsUntilStart: 7200,
    });
  });

  it('returns active police events for authenticated players', async () => {
    getPoliceStatus.mockResolvedValueOnce({
      events: [
        {
          banditsKilledEstimate: null,
          drugsLost: null,
          endsAt: '2026-03-11T14:00:00.000Z',
          eventType: 'operacao_policial',
          favelaId: 'favela-1',
          favelaName: 'Complexo do Teste',
          headline: null,
          internalSatisfactionAfter: null,
          internalSatisfactionBefore: null,
          policePressureAfter: 82,
          policePressureBefore: 70,
          regionId: RegionId.ZonaNorte,
          regionName: 'Zona Norte',
          remainingSeconds: 5400,
          satisfactionAfter: 24,
          satisfactionBefore: 32,
          soldiersLost: null,
          startedAt: '2026-03-11T12:00:00.000Z',
          weaponsLost: null,
        },
      ],
      generatedAt: '2026-03-11T12:30:00.000Z',
    });

    const response = await app.inject({
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'GET',
      url: '/api/events/police',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          eventType: 'operacao_policial',
          favelaId: 'favela-1',
          regionId: RegionId.ZonaNorte,
        },
      ],
      generatedAt: '2026-03-11T12:30:00.000Z',
    });
  });

  it('returns active seasonal events for authenticated players', async () => {
    getSeasonalStatus.mockResolvedValueOnce({
      events: [
        {
          bonusSummary: ['Raves e pontos de venda em Zona Sul e Centro faturam mais com turistas.'],
          endsAt: '2026-03-12T06:00:00.000Z',
          eventType: 'carnaval',
          headline:
            'Carnaval no Rio: turistas na pista, caixa quente na Zona Sul e a polícia distraída atrás do trio.',
          policeMood: 'distracted',
          regionId: RegionId.ZonaSul,
          regionName: 'Zona Sul',
          remainingSeconds: 7200,
          startedAt: '2026-03-11T12:00:00.000Z',
        },
      ],
      generatedAt: '2026-03-11T12:30:00.000Z',
    });

    const response = await app.inject({
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'GET',
      url: '/api/events/seasonal',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      events: [
        {
          eventType: 'carnaval',
          policeMood: 'distracted',
          regionId: RegionId.ZonaSul,
        },
      ],
      generatedAt: '2026-03-11T12:30:00.000Z',
    });
  });
});
