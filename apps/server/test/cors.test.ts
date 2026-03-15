import { describe, expect, it } from 'vitest';

import { InvalidEnvironmentError } from '../src/config/env.js';
import {
  isCorsOriginAllowed,
  parseCorsAllowedOrigins,
  resolveCorsOptions,
} from '../src/config/cors.js';

describe('cors policy', () => {
  it('accepts localhost and local network origins in development', async () => {
    const input = {
      nodeEnv: 'development',
    };

    const localhost = isCorsOriginAllowed(input, 'http://localhost:8081');
    const lan = isCorsOriginAllowed(input, 'http://192.168.1.20:8081');

    expect(localhost).toBe(true);
    expect(lan).toBe(true);
  });

  it('requires explicit allowlist in staging and production', () => {
    expect(() =>
      resolveCorsOptions({
        corsAllowedOrigins: '',
        nodeEnv: 'production',
      }),
    ).toThrow(InvalidEnvironmentError);

    expect(() =>
      resolveCorsOptions({
        corsAllowedOrigins: '',
        nodeEnv: 'staging',
      }),
    ).toThrow(InvalidEnvironmentError);
  });

  it('allows only explicit origins in production', async () => {
    const input = {
      corsAllowedOrigins: 'https://app.csrio.example, https://staging.csrio.example',
      nodeEnv: 'production',
    };

    resolveCorsOptions(input);

    expect(isCorsOriginAllowed(input, 'https://app.csrio.example')).toBe(true);
    expect(isCorsOriginAllowed(input, 'https://evil.example')).toBe(false);
    expect(isCorsOriginAllowed(input, undefined)).toBe(true);
  });

  it('normalizes and deduplicates the allowlist', () => {
    expect(
      parseCorsAllowedOrigins(' https://app.example , https://app.example,https://m.example '),
    ).toEqual(['https://app.example', 'https://m.example']);
  });
});
