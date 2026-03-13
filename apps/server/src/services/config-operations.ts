import { randomUUID } from 'node:crypto';

import { type GameConfigScope, type GameConfigStatus } from '@cs-rio/shared';
import { desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  configOperationLogs,
  configRuntimeState,
  featureFlags,
  gameConfigEntries,
  gameConfigSets,
  round,
  roundConfigOverrides,
  roundFeatureFlagOverrides,
} from '../db/schema.js';
import { ConfigValidationService } from './config-validation.js';
import { notifyServerConfigRuntimeChange } from './server-config.js';

const CONFIG_RUNTIME_STATE_KEY = 'global';

type DatabaseClient = typeof db;

type ConfigOperationType =
  | 'activate_set'
  | 'upsert_set_entry'
  | 'upsert_round_override'
  | 'upsert_feature_flag'
  | 'upsert_round_feature_flag';

interface ConfigSetSelector {
  code?: string;
  id?: string;
  mode?: 'active' | 'code' | 'id';
}

interface RoundSelector {
  id?: string;
  mode?: 'active' | 'id' | 'number';
  number?: number;
}

interface ConfigOperationMetadata {
  actor?: string;
  notes?: string;
  origin?: string;
}

interface ConfigEntryMutationFields {
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  key: string;
  notes?: string;
  scope?: GameConfigScope;
  status?: GameConfigStatus;
  targetKey?: string | null;
  valueJson: Record<string, unknown>;
}

interface FeatureFlagMutationFields {
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  key: string;
  notes?: string;
  payloadJson?: Record<string, unknown>;
  scope?: GameConfigScope;
  status?: GameConfigStatus;
  targetKey?: string | null;
}

export interface ActivateConfigSetCommand extends ConfigOperationMetadata {
  deactivateOthers?: boolean;
  setDefault?: boolean;
  setSelector: ConfigSetSelector;
  type: 'activate_set';
}

export interface UpsertSetEntryCommand extends ConfigOperationMetadata, ConfigEntryMutationFields {
  setSelector?: ConfigSetSelector;
  type: 'upsert_set_entry';
}

export interface UpsertRoundOverrideCommand extends ConfigOperationMetadata, ConfigEntryMutationFields {
  roundSelector?: RoundSelector;
  type: 'upsert_round_override';
}

export interface UpsertFeatureFlagCommand extends ConfigOperationMetadata, FeatureFlagMutationFields {
  setSelector?: ConfigSetSelector;
  type: 'upsert_feature_flag';
}

export interface UpsertRoundFeatureFlagCommand
  extends ConfigOperationMetadata,
    FeatureFlagMutationFields {
  roundSelector?: RoundSelector;
  type: 'upsert_round_feature_flag';
}

export type ConfigOperationCommand =
  | ActivateConfigSetCommand
  | UpsertSetEntryCommand
  | UpsertRoundOverrideCommand
  | UpsertFeatureFlagCommand
  | UpsertRoundFeatureFlagCommand;

interface ResolvedConfigSet {
  code: string;
  id: string;
}

interface ResolvedRound {
  id: string;
  number: number;
}

export interface ConfigOperationResult {
  affectedRecordId: string;
  appliedAt: string;
  batchId: string;
  configSetId: string | null;
  operationLogId: string;
  operationType: ConfigOperationType;
  roundId: string | null;
  runtimeVersion: number;
  summary: string;
}

export interface ConfigOperationServiceOptions {
  now?: () => Date;
  validationService?: ConfigValidationService;
}

class ConfigOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigOperationError';
  }
}

export class ConfigOperationService {
  private readonly now: () => Date;

  private readonly validationService: ConfigValidationService;

  constructor(options: ConfigOperationServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.validationService = options.validationService ?? new ConfigValidationService({
      now: this.now,
    });
  }

  async applyCommand(command: ConfigOperationCommand): Promise<ConfigOperationResult> {
    const [result] = await this.applyCommands([command]);
    return result!;
  }

  async applyCommands(commands: ConfigOperationCommand[]): Promise<ConfigOperationResult[]> {
    if (commands.length === 0) {
      return [];
    }

    const now = this.now();
    const batchId = randomUUID();
    const results = await db.transaction(async (tx) => {
      const pendingResults: Array<Omit<ConfigOperationResult, 'runtimeVersion'>> = [];

      for (const command of commands) {
        pendingResults.push(
          await this.applyCommandInTransaction(
            tx as unknown as DatabaseClient,
            command,
            batchId,
            now,
          ),
        );
      }

      const runtimeVersion = await touchConfigRuntimeState(
        tx as unknown as DatabaseClient,
        pendingResults.at(-1)?.operationLogId ?? randomUUID(),
        now,
      );

      return pendingResults.map((result) => ({
        ...result,
        runtimeVersion,
      }));
    });

    notifyServerConfigRuntimeChange();
    return results;
  }

  private async applyCommandInTransaction(
    executor: DatabaseClient,
    command: ConfigOperationCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    switch (command.type) {
      case 'activate_set':
        return this.activateSet(executor, command, batchId, now);
      case 'upsert_set_entry':
        return this.upsertSetEntry(executor, command, batchId, now);
      case 'upsert_round_override':
        return this.upsertRoundOverride(executor, command, batchId, now);
      case 'upsert_feature_flag':
        return this.upsertFeatureFlag(executor, command, batchId, now);
      case 'upsert_round_feature_flag':
        return this.upsertRoundFeatureFlag(executor, command, batchId, now);
      default:
        throw new ConfigOperationError('Tipo de comando operacional desconhecido.');
    }
  }

  private async activateSet(
    executor: DatabaseClient,
    command: ActivateConfigSetCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    const targetSet = await resolveConfigSet(executor, command.setSelector);
    const beforeState = await getConfigSetSnapshot(executor, targetSet.id);

    if (command.deactivateOthers ?? true) {
      await executor
        .update(gameConfigSets)
        .set({
          status: 'inactive',
          updatedAt: now,
        })
        .where(eq(gameConfigSets.status, 'active'));
    }

    const updatePayload: {
      isDefault?: boolean;
      status: 'active';
      updatedAt: Date;
    } = {
      status: 'active',
      updatedAt: now,
    };

    if (command.setDefault) {
      await executor
        .update(gameConfigSets)
        .set({
          isDefault: false,
          updatedAt: now,
        })
        .where(eq(gameConfigSets.isDefault, true));
      updatePayload.isDefault = true;
    }

    await executor.update(gameConfigSets).set(updatePayload).where(eq(gameConfigSets.id, targetSet.id));
    const afterState = await getConfigSetSnapshot(executor, targetSet.id);

    return logOperation(executor, {
      actor: command.actor,
      affectedRecordId: targetSet.id,
      afterJson: afterState,
      batchId,
      beforeJson: beforeState,
      configSetId: targetSet.id,
      notes: command.notes,
      now,
      operationType: 'activate_set',
      origin: command.origin,
      payloadJson: {
        deactivateOthers: command.deactivateOthers ?? true,
        setDefault: command.setDefault ?? false,
        setSelector: command.setSelector,
      },
      roundId: null,
      scope: null,
      status: 'active',
      summary: `Set de configuração ${targetSet.code} ativado.`,
      targetKey: null,
      validationJson: {
        rule: 'activate_set',
        validatedAt: now.toISOString(),
      },
      key: null,
    });
  }

  private async upsertSetEntry(
    executor: DatabaseClient,
    command: UpsertSetEntryCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    const targetSet = await resolveConfigSet(executor, command.setSelector);
    const scope = command.scope ?? 'global';
    const validationSummary = await this.validationService.validateEntryMutation({
      key: command.key,
      scope,
      targetKey: command.targetKey,
      valueJson: command.valueJson,
    });
    const targetKey = validationSummary.normalizedTargetKey;
    const status = command.status ?? 'active';
    const effectiveFrom = parseEffectiveDate(command.effectiveFrom, now, 'effectiveFrom');
    const effectiveUntil = parseOptionalDate(command.effectiveUntil, 'effectiveUntil');

    validateEffectiveWindow(effectiveFrom, effectiveUntil);
    const beforeState = await findSetEntrySnapshot(executor, targetSet.id, scope, targetKey, command.key);

    await executor
      .insert(gameConfigEntries)
      .values({
        configSetId: targetSet.id,
        effectiveFrom,
        effectiveUntil,
        key: command.key,
        notes: command.notes ?? null,
        scope,
        status,
        targetKey,
        updatedAt: now,
        valueJson: command.valueJson,
      })
      .onConflictDoUpdate({
        set: {
          effectiveFrom,
          effectiveUntil,
          notes: command.notes ?? null,
          status,
          updatedAt: now,
          valueJson: command.valueJson,
        },
        target: [
          gameConfigEntries.configSetId,
          gameConfigEntries.scope,
          gameConfigEntries.targetKey,
          gameConfigEntries.key,
        ],
      });

    const record = await requireSetEntrySnapshot(executor, targetSet.id, scope, targetKey, command.key);

    return logOperation(executor, {
      actor: command.actor,
      affectedRecordId: record.id,
      afterJson: record,
      batchId,
      beforeJson: beforeState,
      configSetId: targetSet.id,
      key: command.key,
      notes: command.notes,
      now,
      operationType: 'upsert_set_entry',
      origin: command.origin,
      payloadJson: {
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveUntil: effectiveUntil?.toISOString() ?? null,
        status,
        valueJson: command.valueJson,
      },
      roundId: null,
      scope,
      status,
      summary: `Entry ${command.key} atualizada no set ${targetSet.code}.`,
      targetKey,
      validationJson: {
        ...validationSummary,
      },
    });
  }

  private async upsertRoundOverride(
    executor: DatabaseClient,
    command: UpsertRoundOverrideCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    const targetRound = await resolveRound(executor, command.roundSelector);
    const scope = command.scope ?? 'global';
    const validationSummary = await this.validationService.validateEntryMutation({
      key: command.key,
      scope,
      targetKey: command.targetKey,
      valueJson: command.valueJson,
    });
    const targetKey = validationSummary.normalizedTargetKey;
    const status = command.status ?? 'active';
    const effectiveFrom = parseEffectiveDate(command.effectiveFrom, now, 'effectiveFrom');
    const effectiveUntil = parseOptionalDate(command.effectiveUntil, 'effectiveUntil');

    validateEffectiveWindow(effectiveFrom, effectiveUntil);
    const beforeState = await findRoundOverrideSnapshot(
      executor,
      targetRound.id,
      scope,
      targetKey,
      command.key,
    );

    await executor
      .insert(roundConfigOverrides)
      .values({
        effectiveFrom,
        effectiveUntil,
        key: command.key,
        notes: command.notes ?? null,
        roundId: targetRound.id,
        scope,
        status,
        targetKey,
        updatedAt: now,
        valueJson: command.valueJson,
      })
      .onConflictDoUpdate({
        set: {
          effectiveFrom,
          effectiveUntil,
          notes: command.notes ?? null,
          status,
          updatedAt: now,
          valueJson: command.valueJson,
        },
        target: [
          roundConfigOverrides.roundId,
          roundConfigOverrides.scope,
          roundConfigOverrides.targetKey,
          roundConfigOverrides.key,
        ],
      });

    const record = await requireRoundOverrideSnapshot(
      executor,
      targetRound.id,
      scope,
      targetKey,
      command.key,
    );

    return logOperation(executor, {
      actor: command.actor,
      affectedRecordId: record.id,
      afterJson: record,
      batchId,
      beforeJson: beforeState,
      configSetId: null,
      key: command.key,
      notes: command.notes,
      now,
      operationType: 'upsert_round_override',
      origin: command.origin,
      payloadJson: {
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveUntil: effectiveUntil?.toISOString() ?? null,
        roundNumber: targetRound.number,
        status,
        valueJson: command.valueJson,
      },
      roundId: targetRound.id,
      scope,
      status,
      summary: `Override ${command.key} aplicado na rodada ${targetRound.number}.`,
      targetKey,
      validationJson: {
        ...validationSummary,
      },
    });
  }

  private async upsertFeatureFlag(
    executor: DatabaseClient,
    command: UpsertFeatureFlagCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    const targetSet = await resolveConfigSet(executor, command.setSelector);
    const scope = command.scope ?? 'global';
    const validationSummary = await this.validationService.validateFeatureFlagMutation({
      key: command.key,
      payloadJson: command.payloadJson ?? {},
      scope,
      targetKey: command.targetKey,
    });
    const targetKey = validationSummary.normalizedTargetKey;
    const status = command.status ?? 'inactive';
    const effectiveFrom = parseEffectiveDate(command.effectiveFrom, now, 'effectiveFrom');
    const effectiveUntil = parseOptionalDate(command.effectiveUntil, 'effectiveUntil');

    validateEffectiveWindow(effectiveFrom, effectiveUntil);
    const beforeState = await findFeatureFlagSnapshot(
      executor,
      targetSet.id,
      scope,
      targetKey,
      command.key,
    );

    await executor
      .insert(featureFlags)
      .values({
        configSetId: targetSet.id,
        effectiveFrom,
        effectiveUntil,
        key: command.key,
        notes: command.notes ?? null,
        payloadJson: command.payloadJson ?? {},
        scope,
        status,
        targetKey,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          effectiveFrom,
          effectiveUntil,
          notes: command.notes ?? null,
          payloadJson: command.payloadJson ?? {},
          status,
          updatedAt: now,
        },
        target: [
          featureFlags.configSetId,
          featureFlags.scope,
          featureFlags.targetKey,
          featureFlags.key,
        ],
      });

    const record = await requireFeatureFlagSnapshot(
      executor,
      targetSet.id,
      scope,
      targetKey,
      command.key,
    );

    return logOperation(executor, {
      actor: command.actor,
      affectedRecordId: record.id,
      afterJson: record,
      batchId,
      beforeJson: beforeState,
      configSetId: targetSet.id,
      key: command.key,
      notes: command.notes,
      now,
      operationType: 'upsert_feature_flag',
      origin: command.origin,
      payloadJson: {
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveUntil: effectiveUntil?.toISOString() ?? null,
        payloadJson: command.payloadJson ?? {},
        status,
      },
      roundId: null,
      scope,
      status,
      summary: `Feature flag ${command.key} atualizada no set ${targetSet.code}.`,
      targetKey,
      validationJson: {
        ...validationSummary,
      },
    });
  }

  private async upsertRoundFeatureFlag(
    executor: DatabaseClient,
    command: UpsertRoundFeatureFlagCommand,
    batchId: string,
    now: Date,
  ): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
    const targetRound = await resolveRound(executor, command.roundSelector);
    const scope = command.scope ?? 'global';
    const validationSummary = await this.validationService.validateFeatureFlagMutation({
      key: command.key,
      payloadJson: command.payloadJson ?? {},
      scope,
      targetKey: command.targetKey,
    });
    const targetKey = validationSummary.normalizedTargetKey;
    const status = command.status ?? 'inactive';
    const effectiveFrom = parseEffectiveDate(command.effectiveFrom, now, 'effectiveFrom');
    const effectiveUntil = parseOptionalDate(command.effectiveUntil, 'effectiveUntil');

    validateEffectiveWindow(effectiveFrom, effectiveUntil);
    const beforeState = await findRoundFeatureFlagSnapshot(
      executor,
      targetRound.id,
      scope,
      targetKey,
      command.key,
    );

    await executor
      .insert(roundFeatureFlagOverrides)
      .values({
        effectiveFrom,
        effectiveUntil,
        key: command.key,
        notes: command.notes ?? null,
        payloadJson: command.payloadJson ?? {},
        roundId: targetRound.id,
        scope,
        status,
        targetKey,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          effectiveFrom,
          effectiveUntil,
          notes: command.notes ?? null,
          payloadJson: command.payloadJson ?? {},
          status,
          updatedAt: now,
        },
        target: [
          roundFeatureFlagOverrides.roundId,
          roundFeatureFlagOverrides.scope,
          roundFeatureFlagOverrides.targetKey,
          roundFeatureFlagOverrides.key,
        ],
      });

    const record = await requireRoundFeatureFlagSnapshot(
      executor,
      targetRound.id,
      scope,
      targetKey,
      command.key,
    );

    return logOperation(executor, {
      actor: command.actor,
      affectedRecordId: record.id,
      afterJson: record,
      batchId,
      beforeJson: beforeState,
      configSetId: null,
      key: command.key,
      notes: command.notes,
      now,
      operationType: 'upsert_round_feature_flag',
      origin: command.origin,
      payloadJson: {
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveUntil: effectiveUntil?.toISOString() ?? null,
        payloadJson: command.payloadJson ?? {},
        roundNumber: targetRound.number,
        status,
      },
      roundId: targetRound.id,
      scope,
      status,
      summary: `Feature flag ${command.key} atualizada na rodada ${targetRound.number}.`,
      targetKey,
      validationJson: {
        ...validationSummary,
      },
    });
  }
}

interface OperationLogInput {
  actor?: string;
  affectedRecordId: string;
  afterJson: Record<string, unknown> | null;
  batchId: string;
  beforeJson: Record<string, unknown> | null;
  configSetId: string | null;
  key: string | null;
  notes?: string;
  now: Date;
  operationType: ConfigOperationType;
  origin?: string;
  payloadJson: Record<string, unknown>;
  roundId: string | null;
  scope: GameConfigScope | null;
  status: GameConfigStatus | null;
  summary: string;
  targetKey: string | null;
  validationJson: Record<string, unknown> | null;
}

async function logOperation(
  executor: DatabaseClient,
  input: OperationLogInput,
): Promise<Omit<ConfigOperationResult, 'runtimeVersion'>> {
  const operationLogId = randomUUID();

  await executor.insert(configOperationLogs).values({
    actor: input.actor ?? 'local',
    afterJson: input.afterJson,
    affectedRecordId: input.affectedRecordId,
    batchId: input.batchId,
    beforeJson: input.beforeJson,
    configSetId: input.configSetId,
    createdAt: input.now,
    id: operationLogId,
    key: input.key,
    notes: input.notes ?? null,
    operationType: input.operationType,
    origin: input.origin ?? 'manual_cli',
    payloadJson: input.payloadJson,
    roundId: input.roundId,
    scope: input.scope,
    status: input.status,
    summary: input.summary,
    targetKey: input.targetKey,
    validationJson: input.validationJson,
  });

  return {
    affectedRecordId: input.affectedRecordId,
    appliedAt: input.now.toISOString(),
    batchId: input.batchId,
    configSetId: input.configSetId,
    operationLogId,
    operationType: input.operationType,
    roundId: input.roundId,
    summary: input.summary,
  };
}

async function resolveConfigSet(
  executor: DatabaseClient,
  selector?: ConfigSetSelector,
): Promise<ResolvedConfigSet> {
  const mode = selector?.mode ?? (selector?.id ? 'id' : selector?.code ? 'code' : 'active');
  let queryResult: { code: string; id: string } | undefined;

  if (mode === 'id') {
    if (!selector?.id) {
      throw new ConfigOperationError('setSelector.id é obrigatório para mode = "id".');
    }

    [queryResult] = await executor
      .select({
        code: gameConfigSets.code,
        id: gameConfigSets.id,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.id, selector.id))
      .limit(1);
  } else if (mode === 'code') {
    if (!selector?.code) {
      throw new ConfigOperationError('setSelector.code é obrigatório para mode = "code".');
    }

    [queryResult] = await executor
      .select({
        code: gameConfigSets.code,
        id: gameConfigSets.id,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.code, selector.code))
      .limit(1);
  } else {
    [queryResult] = await executor
      .select({
        code: gameConfigSets.code,
        id: gameConfigSets.id,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.status, 'active'))
      .orderBy(desc(gameConfigSets.isDefault), desc(gameConfigSets.updatedAt), desc(gameConfigSets.createdAt))
      .limit(1);
  }

  if (!queryResult) {
    throw new ConfigOperationError('Set de configuração alvo não encontrado.');
  }

  return queryResult;
}

async function resolveRound(
  executor: DatabaseClient,
  selector?: RoundSelector,
): Promise<ResolvedRound> {
  const mode = selector?.mode ?? (selector?.id ? 'id' : typeof selector?.number === 'number' ? 'number' : 'active');
  let queryResult: { id: string; number: number } | undefined;

  if (mode === 'id') {
    if (!selector?.id) {
      throw new ConfigOperationError('roundSelector.id é obrigatório para mode = "id".');
    }

    [queryResult] = await executor
      .select({
        id: round.id,
        number: round.number,
      })
      .from(round)
      .where(eq(round.id, selector.id))
      .limit(1);
  } else if (mode === 'number') {
    if (typeof selector?.number !== 'number') {
      throw new ConfigOperationError('roundSelector.number é obrigatório para mode = "number".');
    }

    [queryResult] = await executor
      .select({
        id: round.id,
        number: round.number,
      })
      .from(round)
      .where(eq(round.number, selector.number))
      .limit(1);
  } else {
    [queryResult] = await executor
      .select({
        id: round.id,
        number: round.number,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .orderBy(desc(round.startedAt))
      .limit(1);
  }

  if (!queryResult) {
    throw new ConfigOperationError('Rodada alvo não encontrada.');
  }

  return queryResult;
}

async function getConfigSetSnapshot(
  executor: DatabaseClient,
  configSetId: string,
): Promise<Record<string, unknown> | null> {
  const [setRow] = await executor
    .select({
      code: gameConfigSets.code,
      id: gameConfigSets.id,
      isDefault: gameConfigSets.isDefault,
      name: gameConfigSets.name,
      status: gameConfigSets.status,
      updatedAt: gameConfigSets.updatedAt,
    })
    .from(gameConfigSets)
    .where(eq(gameConfigSets.id, configSetId))
    .limit(1);

  if (!setRow) {
    return null;
  }

  return {
    ...setRow,
    updatedAt: setRow.updatedAt.toISOString(),
  };
}

async function findSetEntrySnapshot(
  executor: DatabaseClient,
  configSetId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const entries = await executor
    .select({
      effectiveFrom: gameConfigEntries.effectiveFrom,
      effectiveUntil: gameConfigEntries.effectiveUntil,
      id: gameConfigEntries.id,
      key: gameConfigEntries.key,
      notes: gameConfigEntries.notes,
      scope: gameConfigEntries.scope,
      status: gameConfigEntries.status,
      targetKey: gameConfigEntries.targetKey,
      valueJson: gameConfigEntries.valueJson,
    })
    .from(gameConfigEntries)
    .where(eq(gameConfigEntries.configSetId, configSetId));

  const exact = entries.find(
    (entry) => entry.key === key && entry.scope === scope && entry.targetKey === targetKey,
  );

  if (!exact) {
    return null;
  }

  return {
    ...exact,
    effectiveFrom: exact.effectiveFrom.toISOString(),
    effectiveUntil: exact.effectiveUntil?.toISOString() ?? null,
    notes: exact.notes ?? null,
    valueJson: exact.valueJson ?? {},
  };
}

async function requireSetEntrySnapshot(
  executor: DatabaseClient,
  configSetId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await findSetEntrySnapshot(executor, configSetId, scope, targetKey, key);

  if (!snapshot) {
    throw new ConfigOperationError(`Não foi possível localizar a entry ${key} após o upsert.`);
  }

  return snapshot as Record<string, unknown> & { id: string };
}

async function findRoundOverrideSnapshot(
  executor: DatabaseClient,
  roundId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const overrides = await executor
    .select({
      effectiveFrom: roundConfigOverrides.effectiveFrom,
      effectiveUntil: roundConfigOverrides.effectiveUntil,
      id: roundConfigOverrides.id,
      key: roundConfigOverrides.key,
      notes: roundConfigOverrides.notes,
      scope: roundConfigOverrides.scope,
      status: roundConfigOverrides.status,
      targetKey: roundConfigOverrides.targetKey,
      valueJson: roundConfigOverrides.valueJson,
    })
    .from(roundConfigOverrides)
    .where(eq(roundConfigOverrides.roundId, roundId));

  const exact = overrides.find(
    (override) => override.key === key && override.scope === scope && override.targetKey === targetKey,
  );

  if (!exact) {
    return null;
  }

  return {
    ...exact,
    effectiveFrom: exact.effectiveFrom.toISOString(),
    effectiveUntil: exact.effectiveUntil?.toISOString() ?? null,
    notes: exact.notes ?? null,
    valueJson: exact.valueJson ?? {},
  };
}

async function requireRoundOverrideSnapshot(
  executor: DatabaseClient,
  roundId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await findRoundOverrideSnapshot(executor, roundId, scope, targetKey, key);

  if (!snapshot) {
    throw new ConfigOperationError(`Não foi possível localizar o override ${key} após o upsert.`);
  }

  return snapshot as Record<string, unknown> & { id: string };
}

async function findFeatureFlagSnapshot(
  executor: DatabaseClient,
  configSetId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const flags = await executor
    .select({
      effectiveFrom: featureFlags.effectiveFrom,
      effectiveUntil: featureFlags.effectiveUntil,
      id: featureFlags.id,
      key: featureFlags.key,
      notes: featureFlags.notes,
      payloadJson: featureFlags.payloadJson,
      scope: featureFlags.scope,
      status: featureFlags.status,
      targetKey: featureFlags.targetKey,
    })
    .from(featureFlags)
    .where(eq(featureFlags.configSetId, configSetId));

  const exact = flags.find((flag) => flag.key === key && flag.scope === scope && flag.targetKey === targetKey);

  if (!exact) {
    return null;
  }

  return {
    ...exact,
    effectiveFrom: exact.effectiveFrom.toISOString(),
    effectiveUntil: exact.effectiveUntil?.toISOString() ?? null,
    notes: exact.notes ?? null,
    payloadJson: exact.payloadJson ?? {},
  };
}

async function requireFeatureFlagSnapshot(
  executor: DatabaseClient,
  configSetId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await findFeatureFlagSnapshot(executor, configSetId, scope, targetKey, key);

  if (!snapshot) {
    throw new ConfigOperationError(`Não foi possível localizar a feature flag ${key} após o upsert.`);
  }

  return snapshot as Record<string, unknown> & { id: string };
}

async function findRoundFeatureFlagSnapshot(
  executor: DatabaseClient,
  roundId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const flags = await executor
    .select({
      effectiveFrom: roundFeatureFlagOverrides.effectiveFrom,
      effectiveUntil: roundFeatureFlagOverrides.effectiveUntil,
      id: roundFeatureFlagOverrides.id,
      key: roundFeatureFlagOverrides.key,
      notes: roundFeatureFlagOverrides.notes,
      payloadJson: roundFeatureFlagOverrides.payloadJson,
      scope: roundFeatureFlagOverrides.scope,
      status: roundFeatureFlagOverrides.status,
      targetKey: roundFeatureFlagOverrides.targetKey,
    })
    .from(roundFeatureFlagOverrides)
    .where(eq(roundFeatureFlagOverrides.roundId, roundId));

  const exact = flags.find((flag) => flag.key === key && flag.scope === scope && flag.targetKey === targetKey);

  if (!exact) {
    return null;
  }

  return {
    ...exact,
    effectiveFrom: exact.effectiveFrom.toISOString(),
    effectiveUntil: exact.effectiveUntil?.toISOString() ?? null,
    notes: exact.notes ?? null,
    payloadJson: exact.payloadJson ?? {},
  };
}

async function requireRoundFeatureFlagSnapshot(
  executor: DatabaseClient,
  roundId: string,
  scope: GameConfigScope,
  targetKey: string,
  key: string,
): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await findRoundFeatureFlagSnapshot(executor, roundId, scope, targetKey, key);

  if (!snapshot) {
    throw new ConfigOperationError(`Não foi possível localizar a feature flag ${key} após o upsert.`);
  }

  return snapshot as Record<string, unknown> & { id: string };
}

async function touchConfigRuntimeState(
  executor: DatabaseClient,
  lastOperationId: string,
  now: Date,
): Promise<number> {
  const [currentState] = await executor
    .select({
      version: configRuntimeState.version,
    })
    .from(configRuntimeState)
    .where(eq(configRuntimeState.singletonKey, CONFIG_RUNTIME_STATE_KEY))
    .limit(1);

  const nextVersion = (currentState?.version ?? 0) + 1;

  await executor
    .insert(configRuntimeState)
    .values({
      lastOperationId,
      singletonKey: CONFIG_RUNTIME_STATE_KEY,
      updatedAt: now,
      version: nextVersion,
    })
    .onConflictDoUpdate({
      set: {
        lastOperationId,
        updatedAt: now,
        version: nextVersion,
      },
      target: [configRuntimeState.singletonKey],
    });

  return nextVersion;
}

function parseEffectiveDate(value: string | undefined, fallback: Date, fieldName: string): Date {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ConfigOperationError(`Campo ${fieldName} inválido: ${value}.`);
  }

  return parsed;
}

function parseOptionalDate(value: string | null | undefined, fieldName: string): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ConfigOperationError(`Campo ${fieldName} inválido: ${value}.`);
  }

  return parsed;
}

function validateEffectiveWindow(effectiveFrom: Date, effectiveUntil: Date | null): void {
  if (effectiveUntil && effectiveUntil.getTime() <= effectiveFrom.getTime()) {
    throw new ConfigOperationError('effectiveUntil deve ser maior que effectiveFrom.');
  }
}
