import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  appEnv: {
    apiUrl: 'http://10.0.2.2:3000',
    wsUrl: 'ws://10.0.2.2:2567',
  },
}));

import { formatApiError } from '../src/services/api';

describe('formatApiError', () => {
  it('preserves domain messages returned by the backend', () => {
    const error = formatApiError({
      response: {
        data: {
          message: 'Saldo insuficiente.',
        },
      },
    });

    expect(error.message).toBe('Saldo insuficiente.');
  });

  it('returns a generic network error without exposing the backend URL', () => {
    const error = formatApiError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
      request: {},
    });

    expect(error.message).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
    expect(error.message).not.toContain('10.0.2.2');
    expect(error.message).not.toContain('/health');
  });
});
