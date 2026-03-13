import { afterEach, describe, expect, it } from 'vitest';

import {
  assertConfirmForSensitiveOperations,
  buildGuardrailSummary,
  ensureOpsEnvironment,
  OpsGuardrailsError,
  requiresConfirm,
  type OpsCommandName,
} from '../src/services/ops-guardrails.js';

const ORIGINAL_ALLOW = process.env.CSRIO_ALLOW_INTERNAL_OPS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('ops guardrails', () => {
  afterEach(() => {
    process.env.CSRIO_ALLOW_INTERNAL_OPS = ORIGINAL_ALLOW;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('blocks internal ops in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CSRIO_ALLOW_INTERNAL_OPS;

    expect(() => ensureOpsEnvironment('ops:world')).toThrowError(OpsGuardrailsError);

    process.env.CSRIO_ALLOW_INTERNAL_OPS = 'true';

    expect(() => ensureOpsEnvironment('ops:world')).not.toThrow();
  });

  it('requires confirm for sensitive operations unless dry-run is enabled', () => {
    expect(requiresConfirm('ops:world', ['clear-market-offers'])).toBe(true);
    expect(requiresConfirm('ops:world', ['set-faction-bank-money'])).toBe(false);

    expect(() =>
      assertConfirmForSensitiveOperations({
        commandName: 'ops:world',
        operationTypes: ['clear-market-offers'],
      }),
    ).toThrowError(OpsGuardrailsError);

    expect(() =>
      assertConfirmForSensitiveOperations({
        commandName: 'ops:world',
        confirm: true,
        operationTypes: ['clear-market-offers'],
      }),
    ).not.toThrow();

    expect(() =>
      assertConfirmForSensitiveOperations({
        commandName: 'ops:world',
        dryRun: true,
        operationTypes: ['clear-market-offers'],
      }),
    ).not.toThrow();
  });

  it('builds a guardrail summary for CLI output', () => {
    process.env.NODE_ENV = 'development';

    const summary = buildGuardrailSummary({
      commandName: 'ops:round',
      confirm: false,
      dryRun: true,
      operationTypes: ['finish-round', 'snapshot-round-state'],
    });

    expect(summary).toEqual({
      dryRun: true,
      environment: 'development',
      needsConfirm: true,
      operationTypes: ['finish-round', 'snapshot-round-state'],
    });
  });

  it.each<OpsCommandName>(['ops:player', 'ops:round', 'ops:scenario', 'ops:world'])(
    'allows %s in development by default',
    (commandName) => {
      process.env.NODE_ENV = 'development';
      delete process.env.CSRIO_ALLOW_INTERNAL_OPS;

      expect(() => ensureOpsEnvironment(commandName)).not.toThrow();
    },
  );
});
