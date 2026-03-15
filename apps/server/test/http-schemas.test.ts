import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { installGlobalHttpErrorHandler } from '../src/api/http-errors.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createBankRoutes } from '../src/api/routes/bank.js';
import { createBichoRoutes } from '../src/api/routes/bicho.js';
import { createCrimeRoutes } from '../src/api/routes/crimes.js';
import { createDrugSaleRoutes } from '../src/api/routes/drug-sales.js';
import { createFactionRoutes } from '../src/api/routes/factions.js';
import { createFactoryRoutes } from '../src/api/routes/factories.js';
import { createFrontStoreRoutes } from '../src/api/routes/front-stores.js';
import { createHospitalRoutes } from '../src/api/routes/hospital.js';
import { createInventoryRoutes } from '../src/api/routes/inventory.js';
import { createMarketRoutes } from '../src/api/routes/market.js';
import { createPlayerRoutes } from '../src/api/routes/players.js';
import { createPrisonRoutes } from '../src/api/routes/prison.js';
import { createPropertyRoutes } from '../src/api/routes/properties.js';
import { createPvpRoutes } from '../src/api/routes/pvp.js';
import { createRobberyRoutes } from '../src/api/routes/robberies.js';
import { createTerritoryRoutes } from '../src/api/routes/territory.js';
import { createTrainingRoutes } from '../src/api/routes/training.js';
import { createTribunalRoutes } from '../src/api/routes/tribunal.js';
import { createUniversityRoutes } from '../src/api/routes/university.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('HTTP route schemas', () => {
  it('rejects invalid auth register payload before reaching the service', async () => {
    const app = await createRouteTestApp(
      createAuthRoutes({
        authService: {
          login: unexpectedAsyncCall('auth.login'),
          refresh: unexpectedAsyncCall('auth.refresh'),
          register: unexpectedAsyncCall('auth.register'),
        } as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'not-an-email',
        nickname: 'x',
        password: '123',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid player creation payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createPlayerRoutes({
        playerService: {
          createCharacter: unexpectedAsyncCall('players.createCharacter'),
          getPlayerProfile: unexpectedAsyncCall('players.getPlayerProfile'),
          travelToRegion: unexpectedAsyncCall('players.travelToRegion'),
        } as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/players/create',
      payload: {
        appearance: {
          hair: 'corte_curto',
          outfit: 'camisa_branca',
          skin: 'pele_media',
        },
        vocation: 'chefe_final',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid market order payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createMarketRoutes({
        actionIdempotency: {
          run: unexpectedAsyncCall('actionIdempotency.market'),
        } as never,
        marketService: {
          bidAuction: unexpectedAsyncCall('market.bidAuction'),
          cancelOrder: unexpectedAsyncCall('market.cancelOrder'),
          createAuction: unexpectedAsyncCall('market.createAuction'),
          createOrder: unexpectedAsyncCall('market.createOrder'),
          getAuctionBook: unexpectedAsyncCall('market.getAuctionBook'),
          getOrderBook: unexpectedAsyncCall('market.getOrderBook'),
        } as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/market/orders',
      payload: {
        itemId: 'drug-1',
        itemType: 'drug',
        pricePerUnit: 65,
        quantity: 0,
        side: 'sell',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid faction creation payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createFactionRoutes({
        factionService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`faction.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/factions',
      payload: {
        abbreviation: 'A',
        name: 'CV',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid territory preparation payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createTerritoryRoutes({
        actionIdempotency: {
          run: unexpectedAsyncCall('actionIdempotency.territory'),
        } as never,
        territoryService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`territory.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/territory/favelas/favela-1/war/prepare',
      payload: {
        budget: 1000,
        soldierCommitment: 99,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects empty hospital surgery payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createHospitalRoutes({
        actionIdempotency: {
          run: unexpectedAsyncCall('actionIdempotency.hospital'),
        } as never,
        hospitalService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`hospital.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/hospital/surgery',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid prison rescue target before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createPrisonRoutes({
        actionIdempotency: {
          run: unexpectedAsyncCall('actionIdempotency.prison'),
        } as never,
        prisonService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`prison.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/prison/faction-rescue/%20',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid bank deposit payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createBankRoutes({
        bankService: {
          deposit: unexpectedAsyncCall('bank.deposit'),
          getCenter: unexpectedAsyncCall('bank.getCenter'),
          withdraw: unexpectedAsyncCall('bank.withdraw'),
        } as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        amount: 0,
      },
      url: '/bank/deposit',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid inventory grant payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createInventoryRoutes({
        playerService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`inventory.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        itemId: 'drug-1',
        itemType: 'misterioso',
        quantity: 1,
      },
      url: '/inventory/items',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid assassination contract payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createPvpRoutes({
        pvpService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`pvp.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        reward: 0,
        targetPlayerId: 'target-1',
      },
      url: '/pvp/contracts',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid robbery payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createRobberyRoutes({
        robberyService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`robbery.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        executorType: 'npc',
      },
      url: '/robberies/pedestrian/attempt',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid faction crime payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createCrimeRoutes({
        actionIdempotency: {
          run: unexpectedAsyncCall('actionIdempotency.crime'),
        } as never,
        crimeService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`crime.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        participantIds: [],
      },
      url: '/crimes/faction/faction-1/crime-1/attempt',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid training payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createTrainingRoutes({
        trainingService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`training.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        type: 'ultra',
      },
      url: '/training-center/sessions',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid university enrollment payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createUniversityRoutes({
        universityService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`university.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        courseCode: 'curso_fake',
      },
      url: '/university/enrollments',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid tribunal punishment payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createTribunalRoutes({
        tribunalService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`tribunal.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        punishment: 'banir',
      },
      url: '/tribunal/favelas/favela-1/case/judgment',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid drug sale payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createDrugSaleRoutes({
        drugSaleService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`drugSale.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        channel: 'rave',
        inventoryItemId: 'inventory-1',
        quantity: 1,
      },
      url: '/drug-sales/quote',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid property purchase payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createPropertyRoutes({
        propertyService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`property.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        regionId: 'centro',
        type: 'castelo',
      },
      url: '/properties',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid front-store investment payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createFrontStoreRoutes({
        frontStoreService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`frontStore.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        dirtyAmount: 50,
      },
      url: '/front-stores/property-1/invest',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid factory creation payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createFactoryRoutes({
        factoryService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`factory.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        drugId: ' ',
      },
      url: '/factories',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });

  it('rejects invalid bicho bet payload before reaching the service', async () => {
    const app = await createAuthenticatedRouteTestApp(
      createBichoRoutes({
        bichoService: new Proxy(
          {},
          {
            get: (_target, key) => unexpectedAsyncCall(`bicho.${String(key)}`),
          },
        ) as never,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      payload: {
        amount: 100,
        mode: 'dezena',
      },
      url: '/jogo-do-bicho/bets',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      category: 'validation',
    });
  });
});

async function createRouteTestApp(plugin: FastifyPluginAsync): Promise<FastifyInstance> {
  const app = Fastify();
  installGlobalHttpErrorHandler(app);
  await app.register(plugin);
  await app.ready();
  apps.push(app);
  return app;
}

async function createAuthenticatedRouteTestApp(plugin: FastifyPluginAsync): Promise<FastifyInstance> {
  const app = Fastify();
  installGlobalHttpErrorHandler(app);
  app.decorateRequest('playerId', undefined);
  app.addHook('onRequest', async (request) => {
    request.playerId = 'player-1';
  });
  await app.register(plugin);
  await app.ready();
  apps.push(app);
  return app;
}

function unexpectedAsyncCall(label: string) {
  return async () => {
    throw new Error(`${label} should not be called during schema validation tests.`);
  };
}
