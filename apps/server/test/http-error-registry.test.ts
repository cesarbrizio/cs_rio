import { describe, expect, it } from 'vitest';

import {
  clearErrorMappers,
  createFixedStatusCodeMapper,
  mapDomainErrorCategoryToStatus,
  registerErrorMapper,
  resolveDomainErrorStatus,
} from '../src/api/http-error-registry.js';
import { DomainError } from '../src/errors/domain-error.js';

describe('http error registry', () => {
  it('falls back to the default category mapping when no mapper is registered', () => {
    clearErrorMappers();

    const error = new DomainError('custom-domain', 'conflict', 'conflict', 'Falha qualquer.');

    expect(resolveDomainErrorStatus(error)).toBe(mapDomainErrorCategoryToStatus('conflict'));
  });

  it('lets a new domain define its HTTP status without touching http-errors.ts', () => {
    clearErrorMappers();
    registerErrorMapper(
      createFixedStatusCodeMapper('custom-domain', {
        special_case: 418,
      }),
    );

    const error = new DomainError('custom-domain', 'special_case', 'conflict', 'Erro especial.');

    expect(resolveDomainErrorStatus(error)).toBe(418);
  });
});
