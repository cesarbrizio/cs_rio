import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bindRequestContext, getRequestContext, refreshRequestContext } from '../src/observability/request-context.js';

describe('request context hooks', () => {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
  });

  beforeAll(async () => {
    app.decorateRequest('contextLog', undefined);
    app.decorateRequest('playerId', undefined);
    app.decorateRequest('requestContext', undefined);

    app.addHook('onRequest', async (request, reply) => {
      bindRequestContext(request);
      reply.header('x-request-id', request.id);
    });

    app.addHook('preHandler', async (request) => {
      if (request.headers.authorization === 'Bearer player-1') {
        request.playerId = 'player-1';
      }

      refreshRequestContext(request);
    });

    app.get('/echo/:regionId', async (request) => {
      return {
        inHandlerContext: getRequestContext(),
        requestContext: request.requestContext,
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('binds request id, route, region and player to the request context', async () => {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer player-1',
        'x-request-id': 'request-context-id',
      },
      method: 'GET',
      url: '/echo/zona_norte',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('request-context-id');
    expect(response.json()).toMatchObject({
      inHandlerContext: {
        method: 'GET',
        playerId: 'player-1',
        regionId: 'zona_norte',
        requestId: 'request-context-id',
        route: '/echo/:regionId',
      },
      requestContext: {
        method: 'GET',
        playerId: 'player-1',
        regionId: 'zona_norte',
        requestId: 'request-context-id',
        route: '/echo/:regionId',
      },
    });
  });
});
