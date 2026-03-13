import { randomUUID } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import {
  configOperationLogs,
  configRuntimeState,
  featureFlags,
  gameConfigEntries,
  gameConfigSets,
  round,
  roundConfigOverrides,
  roundFeatureFlagOverrides,
} from '../src/db/schema.js';
import { ConfigOperationService } from '../src/services/config-operations.js';
import { ServerConfigService } from '../src/services/server-config.js';

const FIXED_NOW = new Date('2026-03-12T18:00:00.000Z');
const TEST_ACTOR = 'ops_test_runner';

describe('ConfigOperationService', () => {
  let createdRoundIds: string[];
  let createdSetIds: string[];
  let initialRuntimeVersion: number;
  let originalSetStates: Array<{ id: string; isDefault: boolean; status: 'active' | 'inactive' }>;
  let service: ConfigOperationService;

  beforeEach(async () => {
    createdRoundIds = [];
    createdSetIds = [];
    service = new ConfigOperationService({
      now: () => FIXED_NOW,
    });
    initialRuntimeVersion = await getRuntimeVersion();
    originalSetStates = await db
      .select({
        id: gameConfigSets.id,
        isDefault: gameConfigSets.isDefault,
        status: gameConfigSets.status,
      })
      .from(gameConfigSets);
  });

  afterEach(async () => {
    await db.delete(configOperationLogs).where(eq(configOperationLogs.actor, TEST_ACTOR));

    if (createdRoundIds.length > 0) {
      await db.delete(roundFeatureFlagOverrides).where(inArray(roundFeatureFlagOverrides.roundId, createdRoundIds));
      await db.delete(roundConfigOverrides).where(inArray(roundConfigOverrides.roundId, createdRoundIds));
      await db.delete(round).where(inArray(round.id, createdRoundIds));
    }

    if (createdSetIds.length > 0) {
      await db.delete(featureFlags).where(inArray(featureFlags.configSetId, createdSetIds));
      await db.delete(gameConfigEntries).where(inArray(gameConfigEntries.configSetId, createdSetIds));
      await db.delete(gameConfigSets).where(inArray(gameConfigSets.id, createdSetIds));
    }

    for (const setState of originalSetStates) {
      await db
        .update(gameConfigSets)
        .set({
          isDefault: setState.isDefault,
          status: setState.status,
          updatedAt: FIXED_NOW,
        })
        .where(eq(gameConfigSets.id, setState.id));
    }

    await db
      .insert(configRuntimeState)
      .values({
        lastOperationId: null,
        singletonKey: 'global',
        updatedAt: FIXED_NOW,
        version: initialRuntimeVersion,
      })
      .onConflictDoUpdate({
        set: {
          lastOperationId: null,
          updatedAt: FIXED_NOW,
          version: initialRuntimeVersion,
        },
        target: [configRuntimeState.singletonKey],
      });
  });

  it('applies set-level commands and records operational logs for each mutation', async () => {
    const tempSet = await createTempConfigSet();
    createdSetIds.push(tempSet.id);

    const results = await service.applyCommands([
      {
        actor: TEST_ACTOR,
        deactivateOthers: false,
        origin: 'vitest',
        setSelector: {
          code: tempSet.code,
          mode: 'code',
        },
        type: 'activate_set',
      },
      {
        actor: TEST_ACTOR,
        key: 'economy.property_definition',
        origin: 'vitest',
        scope: 'property_type',
        setSelector: {
          code: tempSet.code,
          mode: 'code',
        },
        targetKey: 'boca',
        type: 'upsert_set_entry',
        valueJson: {
          basePrice: 333_333,
          factionCommissionRate: 0.31,
        },
      },
      {
        actor: TEST_ACTOR,
        key: 'events.faca_na_caveira.enabled',
        origin: 'vitest',
        payloadJson: {
          source: 'test',
        },
        scope: 'event_type',
        setSelector: {
          code: tempSet.code,
          mode: 'code',
        },
        status: 'active',
        targetKey: 'faca_na_caveira',
        type: 'upsert_feature_flag',
      },
    ]);

    expect(results).toHaveLength(3);
    expect(new Set(results.map((result) => result.runtimeVersion))).toHaveLength(1);
    expect(results[0]?.summary).toContain('ativado');

    const [setRow] = await db
      .select({
        isDefault: gameConfigSets.isDefault,
        status: gameConfigSets.status,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.id, tempSet.id))
      .limit(1);

    expect(setRow).toMatchObject({
      isDefault: false,
      status: 'active',
    });

    const [entryRow] = await db
      .select({
        key: gameConfigEntries.key,
        valueJson: gameConfigEntries.valueJson,
      })
      .from(gameConfigEntries)
      .where(eq(gameConfigEntries.configSetId, tempSet.id))
      .limit(1);

    expect(entryRow).toMatchObject({
      key: 'economy.property_definition',
      valueJson: {
        basePrice: 333_333,
        factionCommissionRate: 0.31,
      },
    });

    const [flagRow] = await db
      .select({
        key: featureFlags.key,
        status: featureFlags.status,
        targetKey: featureFlags.targetKey,
      })
      .from(featureFlags)
      .where(eq(featureFlags.configSetId, tempSet.id))
      .limit(1);

    expect(flagRow).toMatchObject({
      key: 'events.faca_na_caveira.enabled',
      status: 'active',
      targetKey: 'faca_na_caveira',
    });

    const logRows = await db
      .select({
        afterJson: configOperationLogs.afterJson,
        batchId: configOperationLogs.batchId,
        beforeJson: configOperationLogs.beforeJson,
        operationType: configOperationLogs.operationType,
        summary: configOperationLogs.summary,
        validationJson: configOperationLogs.validationJson,
      })
      .from(configOperationLogs)
      .where(eq(configOperationLogs.actor, TEST_ACTOR));

    expect(logRows.map((row) => row.operationType).sort()).toEqual(
      ['activate_set', 'upsert_feature_flag', 'upsert_set_entry'].sort(),
    );
    expect(new Set(logRows.map((row) => row.batchId))).toHaveLength(1);

    const entryLog = logRows.find((row) => row.operationType === 'upsert_set_entry');
    expect(entryLog?.summary).toContain('economy.property_definition');
    expect(entryLog?.validationJson).toMatchObject({
      key: 'economy.property_definition',
      normalizedTargetKey: 'boca',
      rule: 'economy.property_definition/property_type',
      scope: 'property_type',
    });
    expect(entryLog?.beforeJson).toBeNull();
    expect(entryLog?.afterJson).toMatchObject({
      key: 'economy.property_definition',
      scope: 'property_type',
      targetKey: 'boca',
      valueJson: {
        basePrice: 333_333,
        factionCommissionRate: 0.31,
      },
    });
  });

  it('applies round injections to the selected round and refreshes cached config reads', async () => {
    const tempRound = await createTempRound();
    createdRoundIds.push(tempRound.id);

    const serverConfigService = new ServerConfigService({
      now: () => FIXED_NOW,
      runtimeStateSyncIntervalMs: 0,
    });
    const before = await serverConfigService.getPropertyDefinition('boca', {
      roundId: tempRound.id,
    });

    const results = await service.applyCommands([
      {
        actor: TEST_ACTOR,
        key: 'economy.property_definition',
        origin: 'vitest',
        roundSelector: {
          mode: 'number',
          number: tempRound.number,
        },
        scope: 'property_type',
        targetKey: 'boca',
        type: 'upsert_round_override',
        valueJson: {
          basePrice: before.basePrice + 77_777,
        },
      },
      {
        actor: TEST_ACTOR,
        key: 'events.operacao_policial.enabled',
        origin: 'vitest',
        payloadJson: {
          reason: 'ops_test',
        },
        roundSelector: {
          mode: 'number',
          number: tempRound.number,
        },
        scope: 'event_type',
        status: 'inactive',
        targetKey: 'operacao_policial',
        type: 'upsert_round_feature_flag',
      },
    ]);

    const after = await serverConfigService.getPropertyDefinition('boca', {
      roundId: tempRound.id,
    });

    expect(after.basePrice).toBe(before.basePrice + 77_777);
    expect(results).toHaveLength(2);
    expect(new Set(results.map((result) => result.runtimeVersion))).toHaveLength(1);

    const [overrideRow] = await db
      .select({
        key: roundConfigOverrides.key,
        valueJson: roundConfigOverrides.valueJson,
      })
      .from(roundConfigOverrides)
      .where(eq(roundConfigOverrides.roundId, tempRound.id))
      .limit(1);

    expect(overrideRow).toMatchObject({
      key: 'economy.property_definition',
      valueJson: {
        basePrice: before.basePrice + 77_777,
      },
    });

    const [flagRow] = await db
      .select({
        key: roundFeatureFlagOverrides.key,
        status: roundFeatureFlagOverrides.status,
      })
      .from(roundFeatureFlagOverrides)
      .where(eq(roundFeatureFlagOverrides.roundId, tempRound.id))
      .limit(1);

    expect(flagRow).toMatchObject({
      key: 'events.operacao_policial.enabled',
      status: 'inactive',
    });
  });

  it('rejects invalid config payloads before writing any broken operational state', async () => {
    const tempSet = await createTempConfigSet();
    createdSetIds.push(tempSet.id);

    await expect(
      service.applyCommand({
        actor: TEST_ACTOR,
        key: 'bank.daily_interest_rate',
        origin: 'vitest',
        scope: 'global',
        setSelector: {
          code: tempSet.code,
          mode: 'code',
        },
        type: 'upsert_set_entry',
        valueJson: {
          unit: 'rate',
          value: 1.5,
        },
      }),
    ).rejects.toThrow('Campo value precisa estar entre 0 e 1.');

    const [entryRow] = await db
      .select({
        id: gameConfigEntries.id,
      })
      .from(gameConfigEntries)
      .where(eq(gameConfigEntries.configSetId, tempSet.id))
      .limit(1);

    expect(entryRow).toBeUndefined();

    const [logRow] = await db
      .select({
        id: configOperationLogs.id,
      })
      .from(configOperationLogs)
      .where(eq(configOperationLogs.actor, TEST_ACTOR))
      .limit(1);

    expect(logRow).toBeUndefined();
  });
});

async function createTempConfigSet(): Promise<{ code: string; id: string }> {
  const code = `ops_test_${randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(gameConfigSets)
    .values({
      code,
      description: 'Set temporario para teste operacional.',
      isDefault: false,
      name: `Teste ${code}`,
      notes: 'vitest',
      status: 'inactive',
      updatedAt: FIXED_NOW,
    })
    .returning({
      code: gameConfigSets.code,
      id: gameConfigSets.id,
    });

  return row!;
}

async function createTempRound(): Promise<{ id: string; number: number }> {
  const roundNumber = 90_000 + Math.floor(Math.random() * 1_000);
  const [row] = await db
    .insert(round)
    .values({
      endsAt: new Date('2026-05-01T12:00:00.000Z'),
      number: roundNumber,
      startedAt: new Date('2026-03-01T12:00:00.000Z'),
      status: 'scheduled',
    })
    .returning({
      id: round.id,
      number: round.number,
    });

  return row!;
}

async function getRuntimeVersion(): Promise<number> {
  const [row] = await db
    .select({
      version: configRuntimeState.version,
    })
    .from(configRuntimeState)
    .where(eq(configRuntimeState.singletonKey, 'global'))
    .limit(1);

  return row?.version ?? 0;
}
