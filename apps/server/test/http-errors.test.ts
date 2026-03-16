import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type HttpErrorResponseBody,
  installGlobalHttpErrorHandler,
  throwRouteHttpError,
} from '../src/api/http-errors.js';
import { DomainError } from '../src/errors/domain-error.js';
import { bindRequestContext, refreshRequestContext } from '../src/observability/request-context.js';

describe('global http error handler', () => {
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
      refreshRequestContext(request);
    });

    installGlobalHttpErrorHandler(app);

    app.get('/domain', async () => {
      throw new DomainError('auth', 'validation', 'invalid_input', 'Email invalido.');
    });

    app.get('/insufficient', async () => {
      throw new DomainError(
        'hospital',
        'insufficient_resources',
        'insufficient_resources',
        'Dinheiro insuficiente para tratamento.',
      );
    });

    app.get('/internal', async () => {
      try {
        throw new Error('kaboom');
      } catch (error) {
        throwRouteHttpError(error, 'Falha inesperada na rota de teste.');
      }
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns standardized payload for mapped domain errors', async () => {
    const response = await app.inject({
      headers: {
        'x-request-id': 'domain-request-id',
      },
      method: 'GET',
      url: '/domain',
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['x-request-id']).toBe('domain-request-id');
    expect(response.json<HttpErrorResponseBody>()).toEqual({
      category: 'validation',
      message: 'Email invalido.',
      requestId: 'domain-request-id',
    });
  });

  it('returns standardized payload for wrapped internal errors', async () => {
    const response = await app.inject({
      headers: {
        'x-request-id': 'internal-request-id',
      },
      method: 'GET',
      url: '/internal',
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['x-request-id']).toBe('internal-request-id');
    expect(response.json<HttpErrorResponseBody>()).toEqual({
      category: 'internal',
      message: 'Falha inesperada na rota de teste.',
      requestId: 'internal-request-id',
    });
  });

  it('applies domain-specific status overrides through DomainError', async () => {
    const response = await app.inject({
      headers: {
        'x-request-id': 'insufficient-request-id',
      },
      method: 'GET',
      url: '/insufficient',
    });

    expect(response.statusCode).toBe(402);
    expect(response.json<HttpErrorResponseBody>()).toEqual({
      category: 'domain',
      message: 'Dinheiro insuficiente para tratamento.',
      requestId: 'insufficient-request-id',
    });
  });
});
