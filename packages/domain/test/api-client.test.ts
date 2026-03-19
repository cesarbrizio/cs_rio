import { describe, expect, it } from 'vitest';

import { createApiClient } from '../src/api/client';

describe('createApiClient', () => {
  it('normalizes the api base url', () => {
    const client = createApiClient({
      env: {
        apiUrl: 'https://csrio.test/backend/',
      },
    });

    expect(client.api.defaults.baseURL).toBe('https://csrio.test/backend/api');
  });

  it('formats generic network failures without leaking the backend url', () => {
    const client = createApiClient({
      env: {
        apiUrl: 'https://csrio.test/backend',
      },
    });

    const error = client.formatApiError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
      request: {},
    });

    expect(error.message).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
    expect(error.message).not.toContain('csrio.test');
  });
});
