import { describe, expect, it } from 'vitest';

import {
  GameConfigService,
  type FeatureFlagRecord,
  type GameConfigEntryRecord,
  type GameConfigRepository,
  type GameConfigSetRecord,
  type RoundConfigOverrideRecord,
  type RoundFeatureFlagOverrideRecord,
} from '../src/services/game-config.js';

const NOW = new Date('2026-03-12T15:00:00.000Z');

class FakeGameConfigRepository implements GameConfigRepository {
  constructor(
    private readonly state: {
      activeRoundId?: string | null;
      activeSet?: GameConfigSetRecord | null;
      entries?: GameConfigEntryRecord[];
      featureFlags?: FeatureFlagRecord[];
      roundOverrides?: RoundConfigOverrideRecord[];
      roundFeatureFlagOverrides?: RoundFeatureFlagOverrideRecord[];
    } = {},
  ) {}

  async getActiveRound(): Promise<{ id: string } | null> {
    return this.state.activeRoundId ? { id: this.state.activeRoundId } : null;
  }

  async getActiveSet(): Promise<GameConfigSetRecord | null> {
    return this.state.activeSet ?? null;
  }

  async listEntries(): Promise<GameConfigEntryRecord[]> {
    return [...(this.state.entries ?? [])];
  }

  async listFeatureFlags(): Promise<FeatureFlagRecord[]> {
    return [...(this.state.featureFlags ?? [])];
  }

  async listRoundOverrides(): Promise<RoundConfigOverrideRecord[]> {
    return [...(this.state.roundOverrides ?? [])];
  }

  async listRoundFeatureFlagOverrides(): Promise<RoundFeatureFlagOverrideRecord[]> {
    return [...(this.state.roundFeatureFlagOverrides ?? [])];
  }
}

describe('GameConfigService', () => {
  it('builds the resolved catalog from the active config set', async () => {
    const service = new GameConfigService({
      now: () => NOW,
      repository: new FakeGameConfigRepository({
        activeRoundId: 'round-1',
        activeSet: buildActiveSet(),
        entries: [
          buildEntry({
            key: 'round.total_game_days',
            value: 156,
          }),
          buildEntry({
            key: 'round.top_ten_credit_reward',
            value: 5,
          }),
        ],
      }),
    });

    const catalog = await service.getResolvedCatalog();

    expect(catalog.activeRoundId).toBe('round-1');
    expect(catalog.activeSet).toMatchObject({
      code: 'pre_alpha_default_2026_03',
      isDefault: true,
    });
    expect(catalog.entries).toEqual([
      expect.objectContaining({
        key: 'round.top_ten_credit_reward',
        source: 'set_entry',
        valueJson: {
          value: 5,
        },
      }),
      expect.objectContaining({
        key: 'round.total_game_days',
        source: 'set_entry',
        valueJson: {
          value: 156,
        },
      }),
    ]);
    expect(await service.getNumberValue({ fallback: 0, key: 'round.total_game_days' })).toBe(156);
  });

  it('prioritizes round overrides and allows an inactive override to suppress the base config', async () => {
    const service = new GameConfigService({
      now: () => NOW,
      repository: new FakeGameConfigRepository({
        activeRoundId: 'round-7',
        activeSet: buildActiveSet(),
        entries: [
          buildEntry({
            key: 'bank.daily_interest_rate',
            value: 0.01,
          }),
          buildEntry({
            key: 'bank.withdraw_fee_rate',
            value: 0.005,
          }),
        ],
        roundOverrides: [
          buildRoundOverride({
            key: 'bank.daily_interest_rate',
            roundId: 'round-7',
            value: 0.015,
          }),
          buildRoundOverride({
            key: 'bank.withdraw_fee_rate',
            roundId: 'round-7',
            status: 'inactive',
            value: 0.009,
          }),
        ],
      }),
    });

    const catalog = await service.getResolvedCatalog();

    expect(catalog.entries).toEqual([
      expect.objectContaining({
        key: 'bank.daily_interest_rate',
        source: 'round_override',
        valueJson: {
          value: 0.015,
        },
      }),
    ]);
    expect(await service.getNumberValue({ fallback: 0, key: 'bank.daily_interest_rate' })).toBe(0.015);
    expect(await service.getNumberValue({ fallback: 0.02, key: 'bank.withdraw_fee_rate' })).toBe(0.02);
  });

  it('falls back from scoped config to global config and resolves feature flags by scope', async () => {
    const service = new GameConfigService({
      now: () => NOW,
      repository: new FakeGameConfigRepository({
        activeRoundId: 'round-9',
        activeSet: buildActiveSet(),
        entries: [
          buildEntry({
            key: 'events.police_pressure_delta',
            value: 8,
          }),
          buildEntry({
            key: 'events.police_pressure_delta',
            scope: 'region',
            targetKey: 'zona_sul',
            value: 12,
          }),
        ],
        featureFlags: [
          buildFeatureFlag({
            key: 'events.police.enabled',
            status: 'active',
          }),
          buildFeatureFlag({
            key: 'events.police.enabled',
            scope: 'event_type',
            status: 'inactive',
            targetKey: 'operacao_policial',
          }),
        ],
      }),
    });

    expect(
      await service.getNumberValue({
        fallback: 0,
        key: 'events.police_pressure_delta',
        scope: 'region',
        targetKey: 'zona_sul',
      }),
    ).toBe(12);
    expect(
      await service.getNumberValue({
        fallback: 0,
        key: 'events.police_pressure_delta',
        scope: 'region',
        targetKey: 'zona_oeste',
      }),
    ).toBe(8);
    expect(
      await service.isFeatureEnabled({
        key: 'events.police.enabled',
        scope: 'event_type',
        targetKey: 'operacao_policial',
      }),
    ).toBe(false);
    expect(
      await service.isFeatureEnabled({
        key: 'events.police.enabled',
        scope: 'event_type',
        targetKey: 'blitz_pm',
      }),
    ).toBe(true);
  });

  it('freezes the snapshotted catalog for the current round and ignores later set drift', async () => {
    const service = new GameConfigService({
      now: () => NOW,
      repository: new FakeGameConfigRepository({
        activeRoundId: 'round-11',
        activeSet: buildActiveSet(),
        entries: [
          buildEntry({
            key: 'round.total_game_days',
            value: 180,
          }),
          buildEntry({
            key: 'round.top_ten_credit_reward',
            value: 7,
          }),
        ],
        featureFlags: [
          buildFeatureFlag({
            key: 'events.police.enabled',
            status: 'active',
          }),
          buildFeatureFlag({
            key: 'robberies.vehicle.enabled',
            scope: 'robbery_type',
            status: 'inactive',
            targetKey: 'vehicle',
          }),
        ],
        roundOverrides: [
          buildRoundOverride({
            key: '__round_config_snapshot__',
            roundId: 'round-11',
            valueJson: {
              isDefault: true,
              setCode: 'snapshot_round_11',
              setId: 'config-set-snapshot-11',
              setName: 'Snapshot da Rodada 11',
              setStatus: 'active',
              snapshottedAt: NOW.toISOString(),
            },
          }),
          buildRoundOverride({
            key: 'round.total_game_days',
            roundId: 'round-11',
            value: 156,
          }),
        ],
        roundFeatureFlagOverrides: [
          buildRoundFeatureFlagOverride({
            key: 'events.police.enabled',
            roundId: 'round-11',
            status: 'inactive',
          }),
        ],
      }),
    });

    const catalog = await service.getResolvedCatalog();

    expect(catalog.activeSet).toMatchObject({
      code: 'snapshot_round_11',
      id: 'config-set-snapshot-11',
      name: 'Snapshot da Rodada 11',
    });
    expect(catalog.entries).toEqual([
      expect.objectContaining({
        key: 'round.total_game_days',
        source: 'round_override',
        valueJson: {
          value: 156,
        },
      }),
    ]);
    expect(await service.getNumberValue({ fallback: 0, key: 'round.total_game_days' })).toBe(156);
    expect(await service.getNumberValue({ fallback: 5, key: 'round.top_ten_credit_reward' })).toBe(5);
    expect(await service.isFeatureEnabled({ fallback: true, key: 'events.police.enabled' })).toBe(false);
    expect(
      await service.isFeatureEnabled({
        fallback: true,
        key: 'robberies.vehicle.enabled',
        scope: 'robbery_type',
        targetKey: 'vehicle',
      }),
    ).toBe(true);
  });
});

function buildActiveSet(): GameConfigSetRecord {
  return {
    code: 'pre_alpha_default_2026_03',
    createdAt: NOW,
    description: 'Catalogo padrao do pre-alpha.',
    id: 'config-set-1',
    isDefault: true,
    name: 'Pre-Alpha Default 2026.03',
    notes: null,
    status: 'active',
    updatedAt: NOW,
  };
}

function buildEntry(
  input: Partial<GameConfigEntryRecord> & {
    key: string;
    value: number;
  },
): GameConfigEntryRecord {
  return {
    effectiveFrom: NOW,
    effectiveUntil: null,
    id: input.id ?? `${input.scope ?? 'global'}-${input.targetKey ?? '*'}-${input.key}`,
    key: input.key,
    notes: input.notes ?? null,
    scope: input.scope ?? 'global',
    status: input.status ?? 'active',
    targetKey: input.targetKey ?? '*',
    valueJson: input.valueJson ?? {
      value: input.value,
    },
  };
}

function buildFeatureFlag(
  input: Partial<FeatureFlagRecord> & {
    key: string;
    status: 'active' | 'inactive';
  },
): FeatureFlagRecord {
  return {
    effectiveFrom: NOW,
    effectiveUntil: null,
    id: input.id ?? `${input.scope ?? 'global'}-${input.targetKey ?? '*'}-${input.key}`,
    key: input.key,
    notes: input.notes ?? null,
    payloadJson: input.payloadJson ?? {},
    scope: input.scope ?? 'global',
    status: input.status,
    targetKey: input.targetKey ?? '*',
  };
}

function buildRoundOverride(
  input: Partial<RoundConfigOverrideRecord> & {
    key: string;
    roundId: string;
    value?: number;
  },
): RoundConfigOverrideRecord {
  return {
    effectiveFrom: NOW,
    effectiveUntil: null,
    id: input.id ?? `round-${input.roundId}-${input.scope ?? 'global'}-${input.targetKey ?? '*'}-${input.key}`,
    key: input.key,
    notes: input.notes ?? null,
    roundId: input.roundId,
    scope: input.scope ?? 'global',
    status: input.status ?? 'active',
    targetKey: input.targetKey ?? '*',
    valueJson: input.valueJson ?? {
      value: input.value,
    },
  };
}

function buildRoundFeatureFlagOverride(
  input: Partial<RoundFeatureFlagOverrideRecord> & {
    key: string;
    roundId: string;
    status: 'active' | 'inactive';
  },
): RoundFeatureFlagOverrideRecord {
  return {
    effectiveFrom: NOW,
    effectiveUntil: null,
    id: input.id ?? `round-${input.roundId}-${input.scope ?? 'global'}-${input.targetKey ?? '*'}-${input.key}`,
    key: input.key,
    notes: input.notes ?? null,
    payloadJson: input.payloadJson ?? {},
    roundId: input.roundId,
    scope: input.scope ?? 'global',
    status: input.status,
    targetKey: input.targetKey ?? '*',
  };
}
