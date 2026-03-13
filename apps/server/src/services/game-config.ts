import {
  type FeatureFlagSummary,
  type GameConfigScope,
  type GameConfigSetSummary,
  type GameConfigStatus,
  type ResolvedGameConfigCatalog,
  type ResolvedGameConfigEntrySummary,
} from '@cs-rio/shared';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  featureFlags,
  gameConfigEntries,
  gameConfigSets,
  round,
  roundConfigOverrides,
  roundFeatureFlagOverrides,
} from '../db/schema.js';
import { primeEconomyConfigCache } from './economy-config.js';

const ROUND_CONFIG_SNAPSHOT_MARKER_KEY = '__round_config_snapshot__';

export interface GameConfigSetRecord extends GameConfigSetSummary {
  createdAt: Date;
  updatedAt: Date;
}

export interface GameConfigEntryRecord {
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  id: string;
  key: string;
  notes: string | null;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
  valueJson: Record<string, unknown>;
}

export interface RoundConfigOverrideRecord extends GameConfigEntryRecord {
  roundId: string;
}

export interface FeatureFlagRecord {
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  id: string;
  key: string;
  notes: string | null;
  payloadJson: Record<string, unknown>;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
}

export interface RoundFeatureFlagOverrideRecord extends FeatureFlagRecord {
  roundId: string;
}

export interface GameConfigRepository {
  getActiveRound(now: Date): Promise<{ id: string } | null>;
  getActiveSet(now: Date): Promise<GameConfigSetRecord | null>;
  listEntries(configSetId: string, now: Date): Promise<GameConfigEntryRecord[]>;
  listFeatureFlags(configSetId: string, now: Date): Promise<FeatureFlagRecord[]>;
  listRoundOverrides(roundId: string, now: Date): Promise<RoundConfigOverrideRecord[]>;
  listRoundFeatureFlagOverrides(roundId: string, now: Date): Promise<RoundFeatureFlagOverrideRecord[]>;
}

class DatabaseGameConfigRepository implements GameConfigRepository {
  async getActiveRound(now: Date): Promise<{ id: string } | null> {
    void now;
    const [activeRound] = await db
      .select({
        id: round.id,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .orderBy(desc(round.startedAt))
      .limit(1);

    return activeRound ?? null;
  }

  async getActiveSet(now: Date): Promise<GameConfigSetRecord | null> {
    void now;
    const [activeSet] = await db
      .select({
        code: gameConfigSets.code,
        createdAt: gameConfigSets.createdAt,
        description: gameConfigSets.description,
        id: gameConfigSets.id,
        isDefault: gameConfigSets.isDefault,
        name: gameConfigSets.name,
        notes: gameConfigSets.notes,
        status: gameConfigSets.status,
        updatedAt: gameConfigSets.updatedAt,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.status, 'active'))
      .orderBy(desc(gameConfigSets.isDefault), desc(gameConfigSets.updatedAt), desc(gameConfigSets.createdAt))
      .limit(1);

    if (!activeSet) {
      return null;
    }

    return {
      ...activeSet,
      description: activeSet.description ?? null,
      notes: activeSet.notes ?? null,
    };
  }

  async listEntries(configSetId: string, now: Date): Promise<GameConfigEntryRecord[]> {
    const rows = await db
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
      .where(
        and(
          eq(gameConfigEntries.configSetId, configSetId),
          lte(gameConfigEntries.effectiveFrom, now),
          or(isNull(gameConfigEntries.effectiveUntil), gt(gameConfigEntries.effectiveUntil, now)),
        ),
      );

    return rows.map((row) => ({
      ...row,
      notes: row.notes ?? null,
      valueJson: row.valueJson ?? {},
    }));
  }

  async listFeatureFlags(configSetId: string, now: Date): Promise<FeatureFlagRecord[]> {
    const rows = await db
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
      .where(
        and(
          eq(featureFlags.configSetId, configSetId),
          lte(featureFlags.effectiveFrom, now),
          or(isNull(featureFlags.effectiveUntil), gt(featureFlags.effectiveUntil, now)),
        ),
      );

    return rows.map((row) => ({
      ...row,
      notes: row.notes ?? null,
      payloadJson: row.payloadJson ?? {},
    }));
  }

  async listRoundOverrides(roundId: string, now: Date): Promise<RoundConfigOverrideRecord[]> {
    const rows = await db
      .select({
        effectiveFrom: roundConfigOverrides.effectiveFrom,
        effectiveUntil: roundConfigOverrides.effectiveUntil,
        id: roundConfigOverrides.id,
        key: roundConfigOverrides.key,
        notes: roundConfigOverrides.notes,
        roundId: roundConfigOverrides.roundId,
        scope: roundConfigOverrides.scope,
        status: roundConfigOverrides.status,
        targetKey: roundConfigOverrides.targetKey,
        valueJson: roundConfigOverrides.valueJson,
      })
      .from(roundConfigOverrides)
      .where(
        and(
          eq(roundConfigOverrides.roundId, roundId),
          lte(roundConfigOverrides.effectiveFrom, now),
          or(isNull(roundConfigOverrides.effectiveUntil), gt(roundConfigOverrides.effectiveUntil, now)),
        ),
      );

    return rows.map((row) => ({
      ...row,
      notes: row.notes ?? null,
      valueJson: row.valueJson ?? {},
    }));
  }

  async listRoundFeatureFlagOverrides(roundId: string, now: Date): Promise<RoundFeatureFlagOverrideRecord[]> {
    const rows = await db
      .select({
        effectiveFrom: roundFeatureFlagOverrides.effectiveFrom,
        effectiveUntil: roundFeatureFlagOverrides.effectiveUntil,
        id: roundFeatureFlagOverrides.id,
        key: roundFeatureFlagOverrides.key,
        notes: roundFeatureFlagOverrides.notes,
        payloadJson: roundFeatureFlagOverrides.payloadJson,
        roundId: roundFeatureFlagOverrides.roundId,
        scope: roundFeatureFlagOverrides.scope,
        status: roundFeatureFlagOverrides.status,
        targetKey: roundFeatureFlagOverrides.targetKey,
      })
      .from(roundFeatureFlagOverrides)
      .where(
        and(
          eq(roundFeatureFlagOverrides.roundId, roundId),
          lte(roundFeatureFlagOverrides.effectiveFrom, now),
          or(isNull(roundFeatureFlagOverrides.effectiveUntil), gt(roundFeatureFlagOverrides.effectiveUntil, now)),
        ),
      );

    return rows.map((row) => ({
      ...row,
      notes: row.notes ?? null,
      payloadJson: row.payloadJson ?? {},
    }));
  }
}

export interface GameConfigServiceOptions {
  now?: () => Date;
  repository?: GameConfigRepository;
}

interface LookupConfigValueInput<TValue> {
  fallback: TValue;
  key: string;
  roundId?: string | null;
  scope?: GameConfigScope;
  targetKey?: string | null;
}

export class GameConfigService {
  private readonly now: () => Date;

  private readonly repository: GameConfigRepository;

  constructor(options: GameConfigServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseGameConfigRepository();
  }

  async getResolvedCatalog(options: { now?: Date; roundId?: string | null } = {}): Promise<ResolvedGameConfigCatalog> {
    const now = options.now ?? this.now();
    const activeSet = await this.repository.getActiveSet(now);

    if (!activeSet) {
      const emptyCatalog = {
        activeRoundId: resolveCatalogRoundId(options.roundId, null),
        activeSet: null,
        entries: [],
        featureFlags: [],
        resolvedAt: now.toISOString(),
      };
      primeEconomyConfigCache(emptyCatalog);
      return emptyCatalog;
    }

    const activeRound = options.roundId === undefined ? await this.repository.getActiveRound(now) : null;
    const roundId = resolveCatalogRoundId(options.roundId, activeRound?.id ?? null);
    const [entries, roundOverrides, flags, roundFeatureOverrides] = await Promise.all([
      this.repository.listEntries(activeSet.id, now),
      roundId ? this.repository.listRoundOverrides(roundId, now) : Promise.resolve([]),
      this.repository.listFeatureFlags(activeSet.id, now),
      roundId ? this.repository.listRoundFeatureFlagOverrides(roundId, now) : Promise.resolve([]),
    ]);
    const snapshotMarker = resolveRoundSnapshotMarker(roundOverrides);

    const catalog = {
      activeRoundId: roundId,
      activeSet: resolveCatalogActiveSet(activeSet, snapshotMarker),
      entries: snapshotMarker
        ? resolveSnapshotCatalogEntries(roundOverrides)
        : resolveCatalogEntries(entries, roundOverrides),
      featureFlags: snapshotMarker
        ? resolveSnapshotFeatureFlags(roundFeatureOverrides)
        : resolveCatalogFeatureFlags(flags, roundFeatureOverrides),
      resolvedAt: now.toISOString(),
    };

    primeEconomyConfigCache(catalog);
    return catalog;
  }

  async getBooleanValue(input: LookupConfigValueInput<boolean>): Promise<boolean> {
    const entry = await this.getResolvedEntry(input);

    if (!entry) {
      return input.fallback;
    }

    const value = extractPrimaryValue(entry.valueJson);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (['1', 'true', 'yes', 'on', 'enabled', 'active'].includes(normalized)) {
        return true;
      }

      if (['0', 'false', 'no', 'off', 'disabled', 'inactive'].includes(normalized)) {
        return false;
      }
    }

    return input.fallback;
  }

  async getNumberValue(input: LookupConfigValueInput<number>): Promise<number> {
    const entry = await this.getResolvedEntry(input);

    if (!entry) {
      return input.fallback;
    }

    const value = extractPrimaryValue(entry.valueJson);
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

    return Number.isFinite(parsed) ? parsed : input.fallback;
  }

  async getObjectValue<TValue extends Record<string, unknown>>(input: LookupConfigValueInput<TValue>): Promise<TValue> {
    const entry = await this.getResolvedEntry(input);
    return entry ? (entry.valueJson as TValue) : input.fallback;
  }

  async getStringValue(input: LookupConfigValueInput<string>): Promise<string> {
    const entry = await this.getResolvedEntry(input);

    if (!entry) {
      return input.fallback;
    }

    const value = extractPrimaryValue(entry.valueJson);
    return typeof value === 'string' ? value : input.fallback;
  }

  async isFeatureEnabled(input: {
    fallback?: boolean;
    key: string;
    roundId?: string | null;
    scope?: GameConfigScope;
    targetKey?: string | null;
  }): Promise<boolean> {
    const catalog = await this.getResolvedCatalog({
      roundId: input.roundId,
    });
    const fallback = input.fallback ?? false;

    for (const candidate of buildLookupCandidates(input.scope, input.targetKey)) {
      const featureFlag = catalog.featureFlags.find(
        (entry) =>
          entry.key === input.key &&
          entry.scope === candidate.scope &&
          entry.targetKey === candidate.targetKey,
      );

      if (featureFlag) {
        return featureFlag.status === 'active';
      }
    }

    return fallback;
  }

  private async getResolvedEntry(input: {
    key: string;
    roundId?: string | null;
    scope?: GameConfigScope;
    targetKey?: string | null;
  }): Promise<ResolvedGameConfigEntrySummary | null> {
    const catalog = await this.getResolvedCatalog({
      roundId: input.roundId,
    });

    for (const candidate of buildLookupCandidates(input.scope, input.targetKey)) {
      const entry = catalog.entries.find(
        (resolvedEntry) =>
          resolvedEntry.key === input.key &&
          resolvedEntry.scope === candidate.scope &&
          resolvedEntry.targetKey === candidate.targetKey,
      );

      if (entry) {
        return entry;
      }
    }

    return null;
  }
}

function buildCompositeKey(scope: GameConfigScope, targetKey: string, key: string): string {
  return `${scope}::${targetKey}::${key}`;
}

function buildLookupCandidates(
  scope?: GameConfigScope,
  targetKey?: string | null,
): Array<{ scope: GameConfigScope; targetKey: string }> {
  if (!scope || scope === 'global') {
    return [{ scope: 'global', targetKey: '*' }];
  }

  return [
    {
      scope,
      targetKey: normalizeTargetKey(targetKey),
    },
    {
      scope: 'global',
      targetKey: '*',
    },
  ];
}

function compareFeatureFlags(left: FeatureFlagSummary, right: FeatureFlagSummary): number {
  return buildCompositeKey(left.scope, left.targetKey, left.key).localeCompare(
    buildCompositeKey(right.scope, right.targetKey, right.key),
  );
}

function compareResolvedEntries(left: ResolvedGameConfigEntrySummary, right: ResolvedGameConfigEntrySummary): number {
  return buildCompositeKey(left.scope, left.targetKey, left.key).localeCompare(
    buildCompositeKey(right.scope, right.targetKey, right.key),
  );
}

function resolveCatalogActiveSet(
  activeSet: GameConfigSetRecord,
  snapshotMarker: RoundConfigOverrideRecord | null,
): GameConfigSetSummary {
  const snapshotValue = snapshotMarker?.valueJson;

  if (!snapshotValue) {
    return {
      code: activeSet.code,
      description: activeSet.description,
      id: activeSet.id,
      isDefault: activeSet.isDefault,
      name: activeSet.name,
      notes: activeSet.notes,
      status: activeSet.status,
    };
  }

  return {
    code: typeof snapshotValue.setCode === 'string' ? snapshotValue.setCode : activeSet.code,
    description:
      typeof snapshotValue.setDescription === 'string'
        ? snapshotValue.setDescription
        : snapshotValue.setDescription === null
          ? null
          : activeSet.description,
    id: typeof snapshotValue.setId === 'string' ? snapshotValue.setId : activeSet.id,
    isDefault:
      typeof snapshotValue.isDefault === 'boolean' ? snapshotValue.isDefault : activeSet.isDefault,
    name: typeof snapshotValue.setName === 'string' ? snapshotValue.setName : activeSet.name,
    notes:
      typeof snapshotValue.setNotes === 'string'
        ? snapshotValue.setNotes
        : snapshotValue.setNotes === null
          ? null
          : activeSet.notes,
    status:
      snapshotValue.setStatus === 'active' || snapshotValue.setStatus === 'inactive'
        ? snapshotValue.setStatus
        : activeSet.status,
  };
}

function extractPrimaryValue(valueJson: Record<string, unknown>): unknown {
  if ('value' in valueJson) {
    return valueJson.value;
  }

  return undefined;
}

function normalizeTargetKey(targetKey?: string | null): string {
  return targetKey?.trim() ? targetKey.trim() : '*';
}

function resolveRoundSnapshotMarker(
  roundOverrides: RoundConfigOverrideRecord[],
): RoundConfigOverrideRecord | null {
  return (
    roundOverrides.find(
      (entry) =>
        entry.scope === 'global' &&
        entry.targetKey === '*' &&
        entry.key === ROUND_CONFIG_SNAPSHOT_MARKER_KEY,
    ) ?? null
  );
}

function resolveCatalogEntries(
  entries: GameConfigEntryRecord[],
  roundOverrides: RoundConfigOverrideRecord[],
): ResolvedGameConfigEntrySummary[] {
  const resolved = new Map<string, ResolvedGameConfigEntrySummary>();

  for (const entry of entries) {
    if (entry.status !== 'active') {
      continue;
    }

    resolved.set(buildCompositeKey(entry.scope, entry.targetKey, entry.key), {
      key: entry.key,
      scope: entry.scope,
      source: 'set_entry',
      targetKey: entry.targetKey,
      valueJson: entry.valueJson,
    });
  }

  for (const override of roundOverrides) {
    const compositeKey = buildCompositeKey(override.scope, override.targetKey, override.key);

    if (override.status === 'active') {
      resolved.set(compositeKey, {
        key: override.key,
        scope: override.scope,
        source: 'round_override',
        targetKey: override.targetKey,
        valueJson: override.valueJson,
      });
      continue;
    }

    resolved.delete(compositeKey);
  }

  return [...resolved.values()].sort(compareResolvedEntries);
}

function resolveSnapshotCatalogEntries(
  roundOverrides: RoundConfigOverrideRecord[],
): ResolvedGameConfigEntrySummary[] {
  return roundOverrides
    .filter(
      (override) =>
        override.status === 'active' &&
        !(
          override.scope === 'global' &&
          override.targetKey === '*' &&
          override.key === ROUND_CONFIG_SNAPSHOT_MARKER_KEY
        ),
    )
    .map((override) => ({
      key: override.key,
      scope: override.scope,
      source: 'round_override' as const,
      targetKey: override.targetKey,
      valueJson: override.valueJson,
    }))
    .sort(compareResolvedEntries);
}

function resolveCatalogFeatureFlags(
  baseFlags: FeatureFlagRecord[],
  roundOverrides: RoundFeatureFlagOverrideRecord[],
): FeatureFlagSummary[] {
  const resolved = new Map<string, FeatureFlagSummary>();

  for (const flag of baseFlags) {
    resolved.set(buildCompositeKey(flag.scope, flag.targetKey, flag.key), {
      effectiveFrom: flag.effectiveFrom.toISOString(),
      effectiveUntil: flag.effectiveUntil?.toISOString() ?? null,
      id: flag.id,
      key: flag.key,
      notes: flag.notes,
      payloadJson: flag.payloadJson,
      scope: flag.scope,
      status: flag.status,
      targetKey: flag.targetKey,
    });
  }

  for (const override of roundOverrides) {
    resolved.set(buildCompositeKey(override.scope, override.targetKey, override.key), {
      effectiveFrom: override.effectiveFrom.toISOString(),
      effectiveUntil: override.effectiveUntil?.toISOString() ?? null,
      id: override.id,
      key: override.key,
      notes: override.notes,
      payloadJson: override.payloadJson,
      scope: override.scope,
      status: override.status,
      targetKey: override.targetKey,
    });
  }

  return [...resolved.values()].sort(compareFeatureFlags);
}

function resolveSnapshotFeatureFlags(
  roundOverrides: RoundFeatureFlagOverrideRecord[],
): FeatureFlagSummary[] {
  return roundOverrides
    .map((override) => ({
      effectiveFrom: override.effectiveFrom.toISOString(),
      effectiveUntil: override.effectiveUntil?.toISOString() ?? null,
      id: override.id,
      key: override.key,
      notes: override.notes,
      payloadJson: override.payloadJson,
      scope: override.scope,
      status: override.status,
      targetKey: override.targetKey,
    }))
    .sort(compareFeatureFlags);
}

function resolveCatalogRoundId(explicitRoundId: string | null | undefined, activeRoundId: string | null): string | null {
  if (explicitRoundId !== undefined) {
    return explicitRoundId;
  }

  return activeRoundId;
}
