import { describe, expect, it } from 'vitest';

import {
  deriveAppErrorBoundaryState,
  normalizeAppRenderError,
} from '../src/components/app-error-boundary.shared';

describe('app error boundary helpers', () => {
  it('derives a fallback state from a render error', () => {
    expect(deriveAppErrorBoundaryState(new Error('Falha no render do mapa'))).toEqual({
      errorMessage: 'Falha no render do mapa',
      hasError: true,
    });
  });

  it('collapses missing or huge errors into the generic recovery message', () => {
    expect(normalizeAppRenderError(null)).toBe(
      'O app encontrou um erro inesperado e abriu um modo de recuperação.',
    );
    expect(normalizeAppRenderError(new Error('x'.repeat(200)))).toBe(
      'O app encontrou um erro inesperado e abriu um modo de recuperação.',
    );
  });
});
