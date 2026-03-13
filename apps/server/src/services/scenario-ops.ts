import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PlayerOpsCommand, PlayerOpsOperation, PlayerOpsSelector } from './player-ops.js';
import { PlayerOpsError, PlayerOpsService } from './player-ops.js';
import type { RoundOpsCommand, RoundOpsSelector } from './round-ops.js';
import { RoundOpsError, RoundOpsService } from './round-ops.js';
import type { WorldOpsCommand, WorldOpsOperation, WorldOpsSelector } from './world-ops.js';
import { WorldOpsError, WorldOpsService } from './world-ops.js';

export type ScenarioVariableValue = boolean | number | string;

export interface ScenarioVariables {
  [key: string]: ScenarioVariableValue | undefined;
}

type ScenarioStepKind = 'player' | 'round' | 'world';

interface ScenarioStepFile {
  commands: Array<Record<string, unknown>>;
  description?: string;
  kind: ScenarioStepKind;
  selector?: Record<string, unknown>;
}

interface ScenarioFile {
  defaults?: Record<string, unknown>;
  description: string;
  extends?: string[];
  name: string;
  requires?: string[];
  steps: ScenarioStepFile[];
}

export interface ScenarioInvocationDefinition {
  defaults?: ScenarioVariables;
  description: string;
  name: string;
  scenarioName: string;
}

export interface ScenarioOpsInput {
  actor?: string;
  filePath?: string;
  name?: string;
  origin?: string;
  variables?: ScenarioVariables;
}

export interface ScenarioOpsResult {
  appliedSteps: Array<{
    appliedCount: number;
    batchId: string;
    kind: ScenarioStepKind;
    summaries: string[];
    target: Record<string, unknown>;
    title: string;
  }>;
  description: string;
  name: string;
  resolvedVariables: ScenarioVariables;
  source: 'built-in' | 'file';
}

export interface ScenarioPreviewResult {
  appliedSteps: Array<{
    changedCount: number;
    dryRun: true;
    kind: ScenarioStepKind;
    summaries: string[];
    target: Record<string, unknown>;
    title: string;
  }>;
  description: string;
  dryRun: true;
  name: string;
  operationTypes: string[];
  resolvedVariables: ScenarioVariables;
  source: 'built-in' | 'file';
}

export interface ScenarioInspectionResult {
  description: string;
  name: string;
  operationTypes: string[];
  resolvedVariables: ScenarioVariables;
  source: 'built-in' | 'file';
}

export class ScenarioOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioOpsError';
  }
}

export class ScenarioOpsService {
  private readonly playerOpsService: PlayerOpsService;

  private readonly roundOpsService: RoundOpsService;

  private readonly worldOpsService: WorldOpsService;

  constructor() {
    this.playerOpsService = new PlayerOpsService();
    this.worldOpsService = new WorldOpsService();
    this.roundOpsService = new RoundOpsService();
  }

  async close(): Promise<void> {
    await this.playerOpsService.close();
    await this.worldOpsService.close();
    await this.roundOpsService.close();
  }

  async applyScenario(input: ScenarioOpsInput): Promise<ScenarioOpsResult> {
    const loaded = await this.resolveScenarioInput(input);

    return this.executeScenario({
      actor: input.actor ?? process.env.USER ?? 'local',
      definition: loaded.definition,
      origin: input.origin ?? 'ops:scenario',
      source: loaded.source,
      variables: input.variables ?? {},
    });
  }

  async previewScenario(input: ScenarioOpsInput): Promise<ScenarioPreviewResult> {
    const loaded = await this.resolveScenarioInput(input);
    const resolvedVariables = {
      ...coerceVariableMap(loaded.definition.defaults ?? {}),
      ...(input.variables ?? {}),
    };

    validateRequiredVariables(loaded.definition, resolvedVariables);

    const appliedSteps: ScenarioPreviewResult['appliedSteps'] = [];
    const operationTypes: string[] = [];

    for (const step of loaded.definition.steps) {
      const title = step.description ?? defaultStepTitle(step.kind);
      const selector = sanitizeObject(resolvePlaceholders(step.selector ?? {}, resolvedVariables));
      const operations = resolvePlaceholders(step.commands, resolvedVariables) as Array<Record<string, unknown>>;
      operationTypes.push(...extractOperationTypes(operations));

      if (step.kind === 'player') {
        const result = await this.playerOpsService.previewCommands(
          selector as PlayerOpsSelector,
          operations.map(
            (operation): PlayerOpsCommand => ({
              actor: input.actor ?? process.env.USER ?? 'local',
              operation: operation as PlayerOpsOperation,
              origin: input.origin ?? 'ops:scenario',
            }),
          ),
        );
        appliedSteps.push({
          changedCount: result.operations.filter((entry) => entry.changed).length,
          dryRun: true,
          kind: step.kind,
          summaries: result.operations.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      if (step.kind === 'world') {
        const result = await this.worldOpsService.previewCommands(
          selector as WorldOpsSelector,
          operations.map(
            (operation): WorldOpsCommand => ({
              actor: input.actor ?? process.env.USER ?? 'local',
              operation: operation as WorldOpsOperation,
              origin: input.origin ?? 'ops:scenario',
            }),
          ),
        );
        appliedSteps.push({
          changedCount: result.operations.filter((entry) => entry.changed).length,
          dryRun: true,
          kind: step.kind,
          summaries: result.operations.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      if (step.kind === 'round') {
        const result = await this.roundOpsService.previewCommands(
          selector as RoundOpsSelector,
          operations.map(
            (operation): RoundOpsCommand => ({
              actor: input.actor ?? process.env.USER ?? 'local',
              operation: operation as RoundOpsCommand['operation'],
              origin: input.origin ?? 'ops:scenario',
            }),
          ),
        );
        appliedSteps.push({
          changedCount: result.operations.filter((entry) => entry.changed).length,
          dryRun: true,
          kind: step.kind,
          summaries: result.operations.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      throw new ScenarioOpsError(`Tipo de passo desconhecido: ${String((step as { kind?: string }).kind)}.`);
    }

    return {
      appliedSteps,
      description: loaded.definition.description,
      dryRun: true,
      name: loaded.definition.name,
      operationTypes: Array.from(new Set(operationTypes)),
      resolvedVariables,
      source: loaded.source,
    };
  }

  async inspectScenario(input: ScenarioOpsInput): Promise<ScenarioInspectionResult> {
    const loaded = await this.resolveScenarioInput(input);
    const resolvedVariables = {
      ...coerceVariableMap(loaded.definition.defaults ?? {}),
      ...(input.variables ?? {}),
    };

    validateRequiredVariables(loaded.definition, resolvedVariables);

    const operationTypes = loaded.definition.steps.flatMap((step) =>
      extractOperationTypes(
        resolvePlaceholders(step.commands, resolvedVariables) as Array<Record<string, unknown>>,
      ),
    );

    return {
      description: loaded.definition.description,
      name: loaded.definition.name,
      operationTypes: Array.from(new Set(operationTypes)),
      resolvedVariables,
      source: loaded.source,
    };
  }

  async applyInvocation(definition: ScenarioInvocationDefinition, input: Omit<ScenarioOpsInput, 'filePath' | 'name'>): Promise<ScenarioOpsResult> {
    return this.applyScenario({
      actor: input.actor,
      name: definition.scenarioName,
      origin: input.origin,
      variables: {
        ...(definition.defaults ?? {}),
        ...(input.variables ?? {}),
      },
    });
  }

  private async executeScenario(input: {
    actor: string;
    definition: ScenarioFile;
    origin: string;
    source: 'built-in' | 'file';
    variables: ScenarioVariables;
  }): Promise<ScenarioOpsResult> {
    const resolvedVariables = {
      ...coerceVariableMap(input.definition.defaults ?? {}),
      ...input.variables,
    };

    validateRequiredVariables(input.definition, resolvedVariables);

    const appliedSteps: ScenarioOpsResult['appliedSteps'] = [];

    for (const step of input.definition.steps) {
      const title = step.description ?? defaultStepTitle(step.kind);
      const selector = sanitizeObject(resolvePlaceholders(step.selector ?? {}, resolvedVariables));
      const operations = resolvePlaceholders(step.commands, resolvedVariables) as Array<Record<string, unknown>>;

      if (step.kind === 'player') {
        const result = await this.playerOpsService.applyCommands(
          selector as PlayerOpsSelector,
          operations.map(
            (operation): PlayerOpsCommand => ({
              actor: input.actor,
              operation: operation as PlayerOpsOperation,
              origin: input.origin,
            }),
          ),
        );
        appliedSteps.push({
          appliedCount: result.applied.length,
          batchId: result.batchId,
          kind: step.kind,
          summaries: result.applied.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      if (step.kind === 'world') {
        const result = await this.worldOpsService.applyCommands(
          selector as WorldOpsSelector,
          operations.map(
            (operation): WorldOpsCommand => ({
              actor: input.actor,
              operation: operation as WorldOpsOperation,
              origin: input.origin,
            }),
          ),
        );
        appliedSteps.push({
          appliedCount: result.applied.length,
          batchId: result.batchId,
          kind: step.kind,
          summaries: result.applied.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      if (step.kind === 'round') {
        const result = await this.roundOpsService.applyCommands(
          selector as RoundOpsSelector,
          operations.map(
            (operation): RoundOpsCommand => ({
              actor: input.actor,
              operation: operation as RoundOpsCommand['operation'],
              origin: input.origin,
            }),
          ),
        );
        appliedSteps.push({
          appliedCount: result.applied.length,
          batchId: result.batchId,
          kind: step.kind,
          summaries: result.applied.map((entry) => entry.summary),
          target: selector,
          title,
        });
        continue;
      }

      throw new ScenarioOpsError(`Tipo de passo desconhecido: ${String((step as { kind?: string }).kind)}.`);
    }

    return {
      appliedSteps,
      description: input.definition.description,
      name: input.definition.name,
      resolvedVariables,
      source: input.source,
    };
  }

  private async loadBuiltInScenario(name: string): Promise<{ definition: ScenarioFile; source: 'built-in' }> {
    const definition = await loadScenarioDefinition(resolveScenarioFilePath(name), new Set());
    return {
      definition,
      source: 'built-in',
    };
  }

  private async loadScenarioFromFile(filePath: string): Promise<{ definition: ScenarioFile; source: 'file' }> {
    const definition = await loadScenarioDefinition(filePath, new Set());
    return {
      definition,
      source: 'file',
    };
  }

  private async resolveScenarioInput(input: ScenarioOpsInput): Promise<{ definition: ScenarioFile; source: 'built-in' | 'file' }> {
    const loaded = input.name
      ? await this.loadBuiltInScenario(input.name)
      : input.filePath
        ? await this.loadScenarioFromFile(path.resolve(input.filePath))
        : null;

    if (!loaded) {
      throw new ScenarioOpsError('Informe --apply <cenario> ou --file <arquivo>.');
    }

    return loaded;
  }
}

async function loadScenarioDefinition(filePath: string, stack: Set<string>): Promise<ScenarioFile> {
  if (stack.has(filePath)) {
    throw new ScenarioOpsError(`Ciclo de herança de cenário detectado em ${filePath}.`);
  }

  stack.add(filePath);
  const scenario = parseScenarioFile(await readFile(filePath, 'utf8'), filePath);

  const parentDefinitions = await Promise.all(
    (scenario.extends ?? []).map((entry) => loadScenarioDefinition(resolveScenarioFilePath(entry), stack)),
  );

  stack.delete(filePath);

  return parentDefinitions.reduce<ScenarioFile>(
    (merged, parent) => ({
      defaults: {
        ...(parent.defaults ?? {}),
        ...(merged.defaults ?? {}),
      },
      description: merged.description || parent.description,
      name: merged.name || parent.name,
      requires: Array.from(new Set([...(parent.requires ?? []), ...(merged.requires ?? [])])),
      steps: [...parent.steps, ...merged.steps],
    }),
    scenario,
  );
}

function parseScenarioFile(raw: string, filePath: string): ScenarioFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ScenarioOpsError(
      `Falha ao ler cenário em ${filePath}: ${error instanceof Error ? error.message : 'JSON inválido.'}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ScenarioOpsError(`Cenário inválido em ${filePath}.`);
  }

  const scenario = parsed as Partial<ScenarioFile>;

  if (!scenario.name || !scenario.description) {
    throw new ScenarioOpsError(`Cenário incompleto em ${filePath}.`);
  }

  return {
    defaults: scenario.defaults ?? {},
    description: scenario.description,
    extends: scenario.extends ?? [],
    name: scenario.name,
    requires: scenario.requires ?? [],
    steps: Array.isArray(scenario.steps) ? scenario.steps : [],
  };
}

function resolvePlaceholders<T>(value: T, variables: ScenarioVariables): T {
  if (Array.isArray(value)) {
    return value.map((entry) => resolvePlaceholders(entry, variables)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolvePlaceholders(entry, variables)]),
    ) as T;
  }

  if (typeof value === 'string' && value.startsWith('$')) {
    const key = value.slice(1);
    const resolved = variables[key];

    if (resolved === undefined) {
      throw new ScenarioOpsError(`Placeholder não resolvido: ${value}.`);
    }

    return resolved as T;
  }

  return value;
}

function coerceVariableMap(values: Record<string, unknown>): ScenarioVariables {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, coerceVariableValue(value)])
      .filter((entry): entry is [string, ScenarioVariableValue] => entry[1] !== undefined),
  );
}

function coerceVariableValue(value: unknown): ScenarioVariableValue | undefined {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return undefined;
}

function sanitizeObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeObject(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, sanitizeObject(entry)]),
    ) as T;
  }

  return value;
}

function validateRequiredVariables(definition: ScenarioFile, variables: ScenarioVariables): void {
  for (const required of definition.requires ?? []) {
    if (variables[required] === undefined) {
      throw new ScenarioOpsError(`O cenário ${definition.name} exige a variável "${required}".`);
    }
  }
}

function extractOperationTypes(operations: Array<Record<string, unknown>>): string[] {
  return operations
    .map((operation) => operation.type)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function defaultStepTitle(kind: ScenarioStepKind): string {
  switch (kind) {
    case 'player':
      return 'Operações de player';
    case 'round':
      return 'Operações de rodada';
    case 'world':
      return 'Operações de mundo';
    default:
      return 'Operações';
  }
}

function resolveScenarioFilePath(name: string): string {
  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFilePath), '../scripts/scenarios', `${name}.json`);
}

export function wrapScenarioError(error: unknown): Error {
  if (error instanceof ScenarioOpsError || error instanceof PlayerOpsError || error instanceof WorldOpsError || error instanceof RoundOpsError) {
    return error;
  }
  return error instanceof Error ? error : new ScenarioOpsError('Falha desconhecida ao aplicar cenário.');
}
