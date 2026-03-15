import { describe, expect, it } from 'vitest';

import {
  InvalidEnvironmentError,
  ensureValidJwtSecrets,
} from '../src/config/env.js';

describe('env jwt secret validation', () => {
  it('accepts explicit strong and distinct secrets', () => {
    expect(
      ensureValidJwtSecrets({
        jwtRefreshSecret: 'refresh-secret-abcdefghijklmnopqrstuvwxyz',
        jwtSecret: 'access-secret-abcdefghijklmnopqrstuvwxyz',
      }),
    ).toEqual({
      jwtRefreshSecret: 'refresh-secret-abcdefghijklmnopqrstuvwxyz',
      jwtSecret: 'access-secret-abcdefghijklmnopqrstuvwxyz',
    });
  });

  it('rejects missing secrets', () => {
    expect(() =>
      ensureValidJwtSecrets({
        jwtRefreshSecret: undefined,
        jwtSecret: undefined,
      }),
    ).toThrow(InvalidEnvironmentError);
  });

  it('rejects legacy placeholders and duplicated secrets', () => {
    expect(() =>
      ensureValidJwtSecrets({
        jwtRefreshSecret: 'change-me-too',
        jwtSecret: 'change-me-too',
      }),
    ).toThrow(InvalidEnvironmentError);
  });
});
