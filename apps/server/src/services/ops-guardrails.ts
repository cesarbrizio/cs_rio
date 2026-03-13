export class OpsGuardrailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpsGuardrailsError';
  }
}

export type OpsCommandName = 'ops:player' | 'ops:round' | 'ops:scenario' | 'ops:world';

export interface OpsGuardrailsInput {
  commandName: OpsCommandName;
  confirm?: boolean;
  dryRun?: boolean;
  operationTypes: string[];
}

const ALLOW_INTERNAL_OPS_ENV = 'CSRIO_ALLOW_INTERNAL_OPS';
const ALLOWED_NODE_ENVS = new Set(['development', 'test']);

const SENSITIVE_OPERATIONS: Record<OpsCommandName, Set<string>> = {
  'ops:player': new Set(['remove-item']),
  'ops:round': new Set([
    'disable-event',
    'expire-event',
    'finish-round',
    'rebuild-world-state',
    'reseed-fixed-factions',
    'reseed-system-market',
    'reseed-territories',
  ]),
  'ops:scenario': new Set([
    'clear-market-offers',
    'disable-event',
    'expire-event',
    'finish-round',
    'leave-faction',
    'neutralize-favela',
    'rebuild-world-state',
    'reseed-fixed-factions',
    'reseed-system-market',
    'reseed-territories',
    'remove-item',
  ]),
  'ops:world': new Set(['clear-market-offers', 'leave-faction', 'neutralize-favela']),
};

export function ensureOpsEnvironment(commandName: OpsCommandName): void {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  const allowExplicit = parseBoolean(process.env[ALLOW_INTERNAL_OPS_ENV]);

  if (ALLOWED_NODE_ENVS.has(nodeEnv) || allowExplicit) {
    return;
  }

  throw new OpsGuardrailsError(
    `${commandName} está bloqueado em NODE_ENV=${nodeEnv}. Defina ${ALLOW_INTERNAL_OPS_ENV}=true para liberar de forma explícita.`,
  );
}

export function requiresConfirm(commandName: OpsCommandName, operationTypes: string[]): boolean {
  const sensitive = SENSITIVE_OPERATIONS[commandName];
  return operationTypes.some((operationType) => sensitive.has(operationType));
}

export function assertConfirmForSensitiveOperations(input: OpsGuardrailsInput): void {
  if (input.dryRun) {
    return;
  }

  if (!requiresConfirm(input.commandName, input.operationTypes)) {
    return;
  }

  if (input.confirm) {
    return;
  }

  throw new OpsGuardrailsError(
    `${input.commandName} inclui operação sensível (${input.operationTypes.join(', ')}). Reexecute com --confirm ou use --dry-run primeiro.`,
  );
}

export function buildGuardrailSummary(input: OpsGuardrailsInput): {
  dryRun: boolean;
  environment: string;
  needsConfirm: boolean;
  operationTypes: string[];
} {
  return {
    dryRun: Boolean(input.dryRun),
    environment: process.env.NODE_ENV?.trim() || 'development',
    needsConfirm: requiresConfirm(input.commandName, input.operationTypes),
    operationTypes: [...input.operationTypes],
  };
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}
