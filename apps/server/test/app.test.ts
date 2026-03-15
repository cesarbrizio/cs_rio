import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('server bootstrap', () => {
  const appPromise = createApp();

  beforeAll(async () => {
    const app = await appPromise;
    await app.ready();
  });

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it('answers the health endpoint', async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'cs-rio-server',
      status: 'ok',
      phase: 'fase-0-bootstrap',
    });
  });

  it('returns x-request-id and preserves the incoming correlation header', async () => {
    const app = await appPromise;
    const response = await app.inject({
      headers: {
        'x-request-id': 'health-check-request-id',
      },
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('health-check-request-id');
  });
});
