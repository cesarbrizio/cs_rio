import type { ParseArgsConfig } from 'node:util';

import {
  assertConfirmForSensitiveOperations,
  buildGuardrailSummary,
  ensureOpsEnvironment,
  type OpsCommandName,
} from '../../services/ops-guardrails.js';

type ParseArgsOption = NonNullable<ParseArgsConfig['options']>[string];

export interface CliGuardValues {
  confirm?: boolean;
  'dry-run'?: boolean;
}

export const CLI_GUARD_OPTION_DEFINITIONS: Record<string, ParseArgsOption> = {
  confirm: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
};

export interface CliGuardContext {
  confirm: boolean;
  dryRun: boolean;
}

export function parseCliGuardContext(values: CliGuardValues): CliGuardContext {
  return {
    confirm: Boolean(values.confirm),
    dryRun: Boolean(values['dry-run']),
  };
}

export function enforceCliGuardrails(
  commandName: OpsCommandName,
  guardContext: CliGuardContext,
  operationTypes: string[],
): { dryRun: boolean; environment: string; needsConfirm: boolean; operationTypes: string[] } {
  ensureOpsEnvironment(commandName);
  assertConfirmForSensitiveOperations({
    commandName,
    confirm: guardContext.confirm,
    dryRun: guardContext.dryRun,
    operationTypes,
  });

  return buildGuardrailSummary({
    commandName,
    confirm: guardContext.confirm,
    dryRun: guardContext.dryRun,
    operationTypes,
  });
}
