import type { RegionId } from '@cs-rio/shared';
import { randomUUID } from 'node:crypto';

import { and, eq, gt, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import { MARKET_SYSTEM_OFFER_SEED } from '../src/db/seed.js';
import {
  favelas,
  gameEvents,
  marketSystemOffers,
  round,
  roundFeatureFlagOverrides,
  roundOperationLogs,
} from '../src/db/schema.js';
import { resolveRoundLifecycleConfig } from '../src/services/gameplay-config.js';
import { GameConfigService } from '../src/services/game-config.js';
import { RoundOpsService } from '../src/services/round-ops.js';

describe('RoundOpsService', () => {
  const fixedNow = new Date('2026-03-13T12:00:00.000Z');

  let createdBatchIds: string[];
  let createdFavelaIds: string[];
  let createdRoundIds: string[];
  let service: RoundOpsService;

  beforeEach(() => {
    createdBatchIds = [];
    createdFavelaIds = [];
    createdRoundIds = [];
    service = new RoundOpsService({
      now: () => fixedNow,
    });
  });

  afterEach(async () => {
    if (createdBatchIds.length > 0) {
      await db
        .delete(roundOperationLogs)
        .where(inArray(roundOperationLogs.batchId, createdBatchIds));
    }

    if (createdFavelaIds.length > 0) {
      await db.delete(gameEvents).where(inArray(gameEvents.favelaId, createdFavelaIds));
      await db.delete(favelas).where(inArray(favelas.id, createdFavelaIds));
    }

    if (createdRoundIds.length > 0) {
      await db
        .delete(roundFeatureFlagOverrides)
        .where(inArray(roundFeatureFlagOverrides.roundId, createdRoundIds));
      await db.delete(round).where(inArray(round.id, createdRoundIds));
    }

    await service.close();
  });

  it('sets a specific round day deterministically and writes audit', async () => {
    await ensureActiveRound();
    const targetRound = await createTestRound('scheduled');
    const configService = new GameConfigService();
    const catalog = await configService.getResolvedCatalog({
      now: fixedNow,
      roundId: targetRound.id,
    });
    const lifecycle = resolveRoundLifecycleConfig(catalog);

    const result = await service.applyCommands(
      { roundId: targetRound.id },
      [{ actor: 'vitest', operation: { type: 'set-round-day', value: 12 }, origin: 'test' }],
    );
    createdBatchIds.push(result.batchId);

    const [updatedRound] = await db
      .select({
        endsAt: round.endsAt,
        startedAt: round.startedAt,
      })
      .from(round)
      .where(eq(round.id, targetRound.id))
      .limit(1);

    expect(updatedRound).toBeTruthy();
    expect(result.applied[0]?.summary).toContain('dia 12');
    expect(updatedRound?.startedAt.toISOString()).toBe(
      new Date(fixedNow.getTime() - 11 * lifecycle.gameDayRealMs).toISOString(),
    );
    expect(updatedRound?.endsAt.toISOString()).toBe(
      new Date(
        fixedNow.getTime() - 11 * lifecycle.gameDayRealMs + lifecycle.realDurationMs,
      ).toISOString(),
    );

    const logs = await db
      .select({ id: roundOperationLogs.id })
      .from(roundOperationLogs)
      .where(eq(roundOperationLogs.batchId, result.batchId));

    expect(logs).toHaveLength(1);
  });

  it('triggers and expires a police event for a favela', async () => {
    await ensureActiveRound();
    const favela = await createTestFavela('zona_norte');

    const triggered = await service.applyCommands(
      { favelaCode: favela.code },
      [
        {
          actor: 'vitest',
          operation: {
            type: 'trigger-event',
            eventType: 'operacao_policial',
            favelaCode: favela.code,
          },
          origin: 'test',
        },
      ],
    );
    createdBatchIds.push(triggered.batchId);

    const [activeEvent] = await db
      .select({
        endsAt: gameEvents.endsAt,
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, 'operacao_policial'),
          eq(gameEvents.favelaId, favela.id),
          gt(gameEvents.endsAt, fixedNow),
        ),
      )
      .limit(1);

    expect(activeEvent).toBeTruthy();

    const expired = await service.applyCommands(
      { favelaCode: favela.code },
      [
        {
          actor: 'vitest',
          operation: {
            type: 'expire-event',
            eventType: 'operacao_policial',
            favelaCode: favela.code,
          },
          origin: 'test',
        },
      ],
    );
    createdBatchIds.push(expired.batchId);

    const [expiredEvent] = await db
      .select({
        endsAt: gameEvents.endsAt,
      })
      .from(gameEvents)
      .where(and(eq(gameEvents.eventType, 'operacao_policial'), eq(gameEvents.favelaId, favela.id)))
      .orderBy(gameEvents.startedAt)
      .limit(1);

    expect(expiredEvent).toBeTruthy();
    expect(expiredEvent?.endsAt.getTime()).toBeLessThanOrEqual(fixedNow.getTime());
  });

  it('enables and disables a round feature flag override', async () => {
    await ensureActiveRound();
    const targetRound = await createTestRound('scheduled');

    const enabled = await service.applyCommands(
      { roundId: targetRound.id },
      [{ actor: 'vitest', operation: { type: 'enable-event', eventType: 'carnaval' }, origin: 'test' }],
    );
    createdBatchIds.push(enabled.batchId);

    let [override] = await db
      .select({
        key: roundFeatureFlagOverrides.key,
        status: roundFeatureFlagOverrides.status,
        targetKey: roundFeatureFlagOverrides.targetKey,
      })
      .from(roundFeatureFlagOverrides)
      .where(eq(roundFeatureFlagOverrides.roundId, targetRound.id))
      .limit(1);

    expect(override?.key).toBe('events.carnaval.enabled');
    expect(override?.targetKey).toBe('carnaval');
    expect(override?.status).toBe('active');

    const disabled = await service.applyCommands(
      { roundId: targetRound.id },
      [{ actor: 'vitest', operation: { type: 'disable-event', eventType: 'carnaval' }, origin: 'test' }],
    );
    createdBatchIds.push(disabled.batchId);

    [override] = await db
      .select({
        status: roundFeatureFlagOverrides.status,
      })
      .from(roundFeatureFlagOverrides)
      .where(
        and(
          eq(roundFeatureFlagOverrides.roundId, targetRound.id),
          eq(roundFeatureFlagOverrides.key, 'events.carnaval.enabled'),
          eq(roundFeatureFlagOverrides.targetKey, 'carnaval'),
        ),
      )
      .limit(1);

    expect(override?.status).toBe('inactive');
  });

  it('rebuilds the world base by expiring events and reseeding system offers', async () => {
    await ensureActiveRound();
    const seedOfferCode = MARKET_SYSTEM_OFFER_SEED[0]?.code;

    if (!seedOfferCode) {
      throw new Error('MARKET_SYSTEM_OFFER_SEED vazio para o teste de round-ops.');
    }

    await db
      .update(marketSystemOffers)
      .set({
        isActive: false,
        stockAvailable: 0,
      })
      .where(eq(marketSystemOffers.code, seedOfferCode));

    await db.insert(gameEvents).values({
      dataJson: { headline: 'Evento de teste para rebuild-world-state' },
      endsAt: new Date(fixedNow.getTime() + 60 * 60 * 1000),
      eventType: 'blitz_pm',
      regionId: 'centro',
      startedAt: fixedNow,
    });

    const rebuilt = await service.applyCommands(
      {},
      [{ actor: 'vitest', operation: { type: 'rebuild-world-state' }, origin: 'test' }],
    );
    createdBatchIds.push(rebuilt.batchId);

    const [offer] = await db
      .select({
        isActive: marketSystemOffers.isActive,
        stockAvailable: marketSystemOffers.stockAvailable,
        stockMax: marketSystemOffers.stockMax,
      })
      .from(marketSystemOffers)
      .where(eq(marketSystemOffers.code, seedOfferCode))
      .limit(1);

    const [activePoliceEvent] = await db
      .select({
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(and(eq(gameEvents.eventType, 'blitz_pm'), gt(gameEvents.endsAt, fixedNow)))
      .limit(1);

    expect(offer?.isActive).toBe(true);
    expect(offer?.stockAvailable).toBe(offer?.stockMax);
    expect(activePoliceEvent).toBeUndefined();
    expect(rebuilt.applied[0]?.summary).toContain('Mundo-base reidratado');
  });

  async function ensureActiveRound() {
    const [active] = await db
      .select({ id: round.id })
      .from(round)
      .where(eq(round.status, 'active'))
      .limit(1);

    if (active) {
      return active;
    }

    const [created] = await db
      .insert(round)
      .values({
        endsAt: new Date('2026-04-12T00:00:00.000Z'),
        number: Math.floor(Math.random() * 10_000) + 50_000,
        startedAt: new Date('2026-03-13T00:00:00.000Z'),
        status: 'active',
      })
      .returning({ id: round.id });

    if (!created) {
      throw new Error('Falha ao garantir rodada ativa para round-ops.');
    }

    createdRoundIds.push(created.id);
    return created;
  }

  async function createTestRound(status: 'active' | 'scheduled') {
    const [created] = await db
      .insert(round)
      .values({
        endsAt: new Date('2026-04-14T00:00:00.000Z'),
        number: Math.floor(Math.random() * 10_000) + 60_000,
        startedAt: new Date('2026-03-14T00:00:00.000Z'),
        status,
      })
      .returning({
        id: round.id,
        number: round.number,
      });

    if (!created) {
      throw new Error('Falha ao criar rodada de teste para round-ops.');
    }

    createdRoundIds.push(created.id);
    return created;
  }

  async function createTestFavela(regionId: RegionId) {
    const code = `round_favela_${randomUUID().slice(0, 8)}`;
    const [created] = await db
      .insert(favelas)
      .values({
        baseBanditTarget: 110,
        code,
        defaultSatisfaction: 50,
        difficulty: 5,
        maxSoldiers: 24,
        name: `Favela Round ${code}`,
        population: 5_000,
        regionId,
        satisfaction: 50,
        sortOrder: 999,
      })
      .returning({
        code: favelas.code,
        id: favelas.id,
      });

    if (!created) {
      throw new Error('Falha ao criar favela de teste para round-ops.');
    }

    createdFavelaIds.push(created.id);
    return created;
  }
});
