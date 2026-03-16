import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  VocationType,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';
import { eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import {
  factionBankLedger,
  factions,
  favelaBanditReturns,
  favelas,
  players,
} from '../src/db/schema.js';
import {
  RobberyService,
  type RobberyServiceOptions,
} from '../src/services/robbery.js';
import type { HospitalizationSystemContract } from '../src/services/action-readiness.js';
import type { PrisonSystemContract } from '../src/systems/PrisonSystem.js';

const FIXED_NOW = new Date('2026-03-12T15:00:00.000Z');

class SequencedHospitalizationReader implements HospitalizationSystemContract {
  constructor(private readonly statuses: boolean[]) {}

  async getHospitalizationStatus() {
    const isHospitalized = this.statuses.shift() ?? false;

    return {
      endsAt: isHospitalized ? new Date('2026-03-12T15:30:00.000Z').toISOString() : null,
      isHospitalized,
      reason: isHospitalized ? 'combat' : null,
      remainingSeconds: isHospitalized ? 1800 : 0,
      startedAt: isHospitalized ? new Date('2026-03-12T15:00:00.000Z').toISOString() : null,
      trigger: null,
    };
  }

  async hospitalize() {
    return this.getHospitalizationStatus();
  }
}

class StaticPrisonSystem implements PrisonSystemContract {
  constructor(private readonly imprisoned: boolean) {}

  async getStatus() {
    return {
      endsAt: this.imprisoned ? new Date('2026-03-12T15:30:00.000Z').toISOString() : null,
      heatScore: 0,
      heatTier: 'frio' as const,
      isImprisoned: this.imprisoned,
      reason: this.imprisoned ? 'Teste' : null,
      remainingSeconds: this.imprisoned ? 1800 : 0,
      sentencedAt: this.imprisoned ? new Date('2026-03-12T15:00:00.000Z').toISOString() : null,
    };
  }
}

describe('robbery routes', () => {
  const openApps: Array<Awaited<ReturnType<typeof createApp>>> = [];
  const openServices: RobberyService[] = [];

  afterEach(async () => {
    while (openApps.length > 0) {
      const app = openApps.pop();

      if (app) {
        await app.close();
      }
    }

    while (openServices.length > 0) {
      const service = openServices.pop();

      if (service) {
        await service.close();
      }
    }
  });

  it('returns the robbery catalog with faction-controlled favelas available for bandit runs', async () => {
    const { app } = await createRobberyTestApp(() => 0.25, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    const controlledFavela = await attachPlayerToFactionAndFavela(player.id);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/robberies',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      banditFavelas: expect.arrayContaining([
        expect.objectContaining({
          banditsActive: controlledFavela.banditsActive,
          id: controlledFavela.id,
          name: controlledFavela.name,
          regionId: controlledFavela.regionId,
        }),
      ]),
      factionRobberyPolicy: {
        global: 'allowed',
        regions: {},
      },
      playerRegion: expect.objectContaining({
        regionId: controlledFavela.regionId,
      }),
      robberies: expect.arrayContaining([
        expect.objectContaining({
          id: 'pedestrian',
        }),
        expect.objectContaining({
          id: 'truck',
        }),
      ]),
      vehicleRoutes: expect.arrayContaining([
        expect.objectContaining({
          id: 'ransom',
        }),
        expect.objectContaining({
          id: 'chop_shop',
        }),
        expect.objectContaining({
          id: 'paraguay',
        }),
      ]),
    });
  });

  it('credits pocket money and faction commission on a successful player robbery', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    const controlledFavela = await attachPlayerToFactionAndFavela(player.id);
    const before = await loadFactionSnapshot(controlledFavela.factionId);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/pedestrian/attempt',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      executorType: 'player',
      factionCommissionAmount: expect.any(Number),
      message: expect.any(String),
      outcome: 'success',
      player: expect.objectContaining({
        heatAfter: expect.any(Number),
        moneyAfter: expect.any(Number),
      }),
      robberyType: 'pedestrian',
      success: true,
    });
    expect(response.json().factionCommissionAmount).toBeGreaterThan(0);
    expect(response.json().netAmount).toBeGreaterThan(0);

    const after = await loadFactionSnapshot(controlledFavela.factionId);
    expect(after.bankMoney).toBeGreaterThan(before.bankMoney);
    expect(after.internalSatisfaction).toBe(before.internalSatisfaction + 1);
    expect(after.points).toBeGreaterThanOrEqual(before.points);
    expect(after.lastLedgerEntry).toMatchObject({
      entryType: 'robbery_commission',
      originType: 'robbery',
    });
    expect(after.lastLedgerEntry?.playerId).not.toBeNull();

    const [playerRow] = await db
      .select({
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(Number(playerRow?.money ?? 0)).toBeGreaterThan(0);
  });

  it('arrests favela bandits and schedules their return when a bandit robbery fails', async () => {
    const { app } = await createRobberyTestApp(() => 0.99, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    const controlledFavela = await attachPlayerToFactionAndFavela(player.id, {
      banditsActive: 14,
      level: 6,
    });
    const before = await loadFactionSnapshot(controlledFavela.factionId);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        banditsCommitted: 5,
        executorType: 'bandits',
        favelaId: controlledFavela.id,
      },
      url: '/api/robberies/truck/attempt',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      bandits: expect.objectContaining({
        arrestedNow: expect.any(Number),
        committed: 5,
        returnBatchesCreated: 1,
      }),
      executorType: 'bandits',
      outcome: 'bandits_arrested',
      success: false,
    });
    expect(response.json().bandits.arrestedNow).toBeGreaterThan(0);

    const [favelaRow] = await db
      .select({
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
      })
      .from(favelas)
      .where(eq(favelas.id, controlledFavela.id))
      .limit(1);

    expect(favelaRow?.banditsActive).toBeLessThan(controlledFavela.banditsActive);
    expect(favelaRow?.banditsArrested).toBeGreaterThan(0);

    const returnRows = await db
      .select({
        quantity: favelaBanditReturns.quantity,
        returnFlavor: favelaBanditReturns.returnFlavor,
      })
      .from(favelaBanditReturns)
      .where(eq(favelaBanditReturns.favelaId, controlledFavela.id));

    expect(returnRows).toHaveLength(1);
    expect(returnRows[0]?.quantity).toBeGreaterThan(0);

    const after = await loadFactionSnapshot(controlledFavela.factionId);
    expect(after.internalSatisfaction).toBe(before.internalSatisfaction - 4);
  });

  it('requires an explicit vehicle route for vehicle robberies', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    await attachPlayerToFactionAndFavela(player.id);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/vehicle/attempt',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: 'Informe a rota do roubo de veiculo.',
    });
  });

  it('applies distinct payout and commission profiles for each vehicle route', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW);
    const ransomPlayer = await registerAndCreateCharacter(app);
    const chopShopPlayer = await registerAndCreateCharacter(app);
    await attachPlayerToFactionAndFavela(ransomPlayer.id, { level: 8 });
    await attachPlayerToFactionAndFavela(chopShopPlayer.id, { level: 8 });

    const ransomResponse = await app.inject({
      headers: {
        authorization: `Bearer ${ransomPlayer.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
        vehicleRoute: 'ransom',
      },
      url: '/api/robberies/vehicle/attempt',
    });

    const chopShopResponse = await app.inject({
      headers: {
        authorization: `Bearer ${chopShopPlayer.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
        vehicleRoute: 'chop_shop',
      },
      url: '/api/robberies/vehicle/attempt',
    });

    expect(ransomResponse.statusCode).toBe(200);
    expect(chopShopResponse.statusCode).toBe(200);
    expect(ransomResponse.json()).toMatchObject({
      robberyType: 'vehicle',
      success: true,
      vehicleRoute: 'ransom',
    });
    expect(chopShopResponse.json()).toMatchObject({
      robberyType: 'vehicle',
      success: true,
      vehicleRoute: 'chop_shop',
    });
    expect(ransomResponse.json().factionCommissionRatePercent).toBe(20);
    expect(chopShopResponse.json().factionCommissionRatePercent).toBe(15);
    expect(ransomResponse.json().grossAmount).toBeGreaterThan(chopShopResponse.json().grossAmount);
    expect(ransomResponse.json().regionPolicePressureDelta).toBeGreaterThan(
      chopShopResponse.json().regionPolicePressureDelta,
    );
  });

  it('blocks robberies when the faction forbids them globally', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    const controlledFavela = await attachPlayerToFactionAndFavela(player.id);

    await db
      .update(factions)
      .set({
        robberyPolicyJson: {
          global: 'forbidden',
          regions: {},
        },
      })
      .where(eq(factions.id, controlledFavela.factionId));

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/pedestrian/attempt',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'A faccao proibiu roubos para todos os membros neste momento.',
    });
  });

  it('displaces the robbery to another region when the local region is forbidden by faction policy', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW);
    const player = await registerAndCreateCharacter(app);
    const controlledFavela = await attachPlayerToFactionAndFavela(player.id);

    await db
      .update(factions)
      .set({
        robberyPolicyJson: {
          global: 'allowed',
          regions: {
            [controlledFavela.regionId]: 'forbidden',
          },
        },
      })
      .where(eq(factions.id, controlledFavela.factionId));

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/pedestrian/attempt',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      policyDisplacedFromRegionId: controlledFavela.regionId,
      robberyType: 'pedestrian',
      success: true,
    });
    expect(response.json().regionId).not.toBe(controlledFavela.regionId);
  });

  it('reads robbery definitions and route availability from the dynamic catalog', async () => {
    const { app } = await createRobberyTestApp(() => 0.1, () => FIXED_NOW, {
      activeRoundId: 'round-config-test',
      activeSet: {
        code: 'test_catalog_robberies',
        description: 'Catalogo isolado do teste de roubos.',
        id: 'config-set-test-robberies',
        isDefault: false,
        name: 'Test Catalog Robberies',
        notes: null,
        status: 'active',
      },
      entries: [
        {
          key: 'robbery.definition',
          scope: 'robbery_type',
          source: 'set_entry',
          targetKey: 'pedestrian',
          valueJson: {
            baseCooldownSeconds: 45,
            baseFactionCommissionRate: 0.19,
            baseHeatDeltaRange: {
              max: 2,
              min: 1,
            },
            baseRewardRange: {
              max: 1900,
              min: 900,
            },
            defaultBanditsCommitted: 2,
            executorTypes: ['player', 'bandits'],
            id: 'pedestrian',
            label: 'Arrastao de esquina',
            maxBanditsCommitted: 4,
            minimumLevel: 1,
            riskLabel: 'baixo_medio',
          },
        },
      ],
      featureFlags: [
        {
          effectiveFrom: FIXED_NOW.toISOString(),
          effectiveUntil: null,
          id: 'flag-cellphones-disabled',
          key: 'robberies.cellphones.enabled',
          notes: null,
          payloadJson: {},
          scope: 'robbery_type',
          status: 'inactive',
          targetKey: 'cellphones',
        },
        {
          effectiveFrom: FIXED_NOW.toISOString(),
          effectiveUntil: null,
          id: 'flag-vehicle-paraguay-disabled',
          key: 'robberies.vehicle_route.paraguay.enabled',
          notes: null,
          payloadJson: {},
          scope: 'robbery_type',
          status: 'inactive',
          targetKey: 'vehicle_route:paraguay',
        },
      ],
      resolvedAt: FIXED_NOW.toISOString(),
    });
    const player = await registerAndCreateCharacter(app);
    await attachPlayerToFactionAndFavela(player.id, { level: 8 });

    const catalogResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/robberies',
    });

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json().robberies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseFactionCommissionRate: 0.19,
          id: 'pedestrian',
          label: 'Arrastao de esquina',
        }),
      ]),
    );
    expect(catalogResponse.json().robberies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cellphones',
        }),
      ]),
    );
    expect(catalogResponse.json().vehicleRoutes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'paraguay',
        }),
      ]),
    );

    const robberyResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/pedestrian/attempt',
    });

    expect(robberyResponse.statusCode).toBe(200);
    expect(robberyResponse.json()).toMatchObject({
      factionCommissionRatePercent: 19,
      robberyType: 'pedestrian',
      success: true,
    });

    const disabledTypeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/cellphones/attempt',
    });

    expect(disabledTypeResponse.statusCode).toBe(403);
    expect(disabledTypeResponse.json()).toMatchObject({
      message: 'Esse tipo de roubo esta desativado nesta rodada.',
    });

    const disabledRouteResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
        vehicleRoute: 'paraguay',
      },
      url: '/api/robberies/vehicle/attempt',
    });

    expect(disabledRouteResponse.statusCode).toBe(403);
    expect(disabledRouteResponse.json()).toMatchObject({
      message: 'Essa rota de roubo de veiculo esta desativada nesta rodada.',
    });
  });

  it('revalidates hospitalization immediately before persisting a robbery attempt', async () => {
    const { app } = await createRobberyTestApp(
      () => 0.1,
      () => FIXED_NOW,
      null,
      {
        hospitalizationSystem: new SequencedHospitalizationReader([false, true]),
      },
    );
    const player = await registerAndCreateCharacter(app);
    await attachPlayerToFactionAndFavela(player.id);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        executorType: 'player',
      },
      url: '/api/robberies/pedestrian/attempt',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('hospitalizado');
  });

  async function createRobberyTestApp(
    random: () => number,
    now: () => Date,
    catalog: ResolvedGameConfigCatalog | null = null,
    serviceOptions: Partial<RobberyServiceOptions> = {},
  ): Promise<{
    app: Awaited<ReturnType<typeof createApp>>;
    robberyService: RobberyService;
  }> {
    const robberyService = new RobberyService({
      gameConfigService: catalog ? createStaticGameConfigService(catalog) : undefined,
      ...serviceOptions,
      now,
      random,
    });
    const app = await createApp({
      prisonSystem: new StaticPrisonSystem(false),
      robberyService,
    });

    await app.ready();

    openServices.push(robberyService);
    openApps.push(app);

    return {
      app,
      robberyService,
    };
  }
});

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
): Promise<{ accessToken: string; id: string }> {
  const email = `robbery-${randomUUID()}@csrio.test`;
  const nickname = `R${randomUUID().slice(0, 8)}`;

  const registerResponse = await app.inject({
    method: 'POST',
    payload: {
      email,
      nickname,
      password: 'segredo123',
    },
    url: '/api/auth/register',
  });
  expect(registerResponse.statusCode).toBe(201);
  const session = registerResponse.json();

  const createResponse = await app.inject({
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
    method: 'POST',
    payload: {
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      vocation: VocationType.Soldado,
    },
    url: '/api/players/create',
  });

  expect(createResponse.statusCode).toBe(201);

  return {
    accessToken: session.accessToken,
    id: session.player.id,
  };
}

async function attachPlayerToFactionAndFavela(
  playerId: string,
  input: {
    banditsActive?: number;
    level?: number;
  } = {},
): Promise<{
  banditsActive: number;
  factionId: string;
  id: string;
  name: string;
  regionId: string;
}> {
  const [playerRow] = await db
    .select({
      regionId: players.regionId,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  const factionNameSuffix = randomUUID().slice(0, 8);
  const [factionRow] = await db
    .insert(factions)
    .values({
      abbreviation: `RB${factionNameSuffix.slice(0, 6).toUpperCase()}`,
      bankMoney: '0.00',
      description: 'Facção de teste isolada para roubos.',
      initialTerritory: null,
      internalSatisfaction: 50,
      isFixed: false,
      leaderId: playerId,
      name: `Faccao Teste Roubos ${factionNameSuffix}`,
      points: 0,
      robberyPolicyJson: {
        global: 'allowed',
        regions: {},
      },
      thematicBonus: null,
    })
    .returning({
      id: factions.id,
    });

  const [favelaRow] = await db
    .select({
      id: favelas.id,
      name: favelas.name,
      regionId: favelas.regionId,
    })
    .from(favelas)
    .where(eq(favelas.regionId, playerRow!.regionId))
    .limit(1);

  await db
    .update(players)
    .set({
      factionId: factionRow!.id,
      level: input.level ?? 8,
      money: '0.00',
      disposicao: 100,
      regionId: playerRow!.regionId,
      cansaco: 100,
    })
    .where(eq(players.id, playerId));

  await db
    .update(favelas)
    .set({
      banditsActive: input.banditsActive ?? 12,
      banditsArrested: 0,
      banditsDeadRecent: 0,
      banditsSyncedAt: FIXED_NOW,
      controllingFactionId: factionRow!.id,
      satisfaction: 58,
      state: 'controlled',
    })
    .where(eq(favelas.id, favelaRow!.id));

  await db.delete(favelaBanditReturns).where(eq(favelaBanditReturns.favelaId, favelaRow!.id));

  return {
    banditsActive: input.banditsActive ?? 12,
    factionId: factionRow!.id,
    id: favelaRow!.id,
    name: favelaRow!.name,
    regionId: favelaRow!.regionId,
  };
}

async function loadFactionSnapshot(factionId: string): Promise<{
  bankMoney: number;
  internalSatisfaction: number;
  lastLedgerEntry: {
    entryType: string;
    originType: string;
    playerId: string | null;
  } | null;
  points: number;
}> {
  const [factionRow] = await db
    .select({
      bankMoney: factions.bankMoney,
      internalSatisfaction: factions.internalSatisfaction,
      points: factions.points,
    })
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  const [ledgerRow] = await db
    .select({
      entryType: factionBankLedger.entryType,
      originType: factionBankLedger.originType,
      playerId: factionBankLedger.playerId,
    })
    .from(factionBankLedger)
    .where(eq(factionBankLedger.factionId, factionId))
    .orderBy(sql`created_at desc`, sql`id desc`)
    .limit(1);

  return {
    bankMoney: Number(factionRow?.bankMoney ?? 0),
    internalSatisfaction: factionRow?.internalSatisfaction ?? 0,
    lastLedgerEntry: ledgerRow
      ? {
          entryType: ledgerRow.entryType,
          originType: ledgerRow.originType,
          playerId: ledgerRow.playerId,
        }
      : null,
    points: factionRow?.points ?? 0,
  };
}

function createStaticGameConfigService(catalog: ResolvedGameConfigCatalog) {
  return {
    async getResolvedCatalog(): Promise<ResolvedGameConfigCatalog> {
      return catalog;
    },
  };
}
