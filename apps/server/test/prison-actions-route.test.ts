import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, VocationType } from '@cs-rio/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { factionMembers, factions, players, prisonRecords } from '../src/db/schema.js';

describe('prison routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('returns prison center with action availability for the imprisoned player', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      conceito: 0,
      credits: 12,
      money: '1500.00',
    });
    await imprisonPlayer(player.id, {
      reason: 'Flagrado em assalto a pedestre',
      releaseInHours: 2,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/prison',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      actions: {
        bail: {
          available: true,
          creditsCost: 10,
        },
        bribe: {
          available: true,
          moneyCost: 500,
        },
        escape: {
          alreadyAttempted: false,
          available: true,
        },
        factionRescue: {
          available: false,
          eligibleTarget: false,
        },
      },
      prison: {
        isImprisoned: true,
        reason: 'Flagrado em assalto a pedestre',
      },
    });
  });

  it('releases the player on successful bribe and deducts the attempted money', async () => {
    await app.close();
    app = await createApp({
      prisonRandom: () => 0,
    });
    await app.ready();

    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      conceito: 0,
      money: '2000.00',
    });
    await imprisonPlayer(player.id, {
      reason: 'Flagrado em furto simples',
      releaseInHours: 2,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/prison/bribe',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      method: 'bribe',
      moneyRemaining: 1500,
      prison: {
        isImprisoned: false,
      },
      success: true,
    });
  });

  it('consumes credits on bail and frees the prisoner immediately', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      credits: 14,
    });
    await imprisonPlayer(player.id, {
      reason: 'Flagrado em blitz comum',
      releaseInHours: 3,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/prison/bail',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      creditsRemaining: 4,
      method: 'bail',
      prison: {
        isImprisoned: false,
      },
      success: true,
    });
  });

  it('keeps the prisoner locked when credits disappear before the bail transaction', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      credits: 10,
    });
    await imprisonPlayer(player.id, {
      reason: 'Flagrado em blitz comum',
      releaseInHours: 3,
    });

    await spendCreditsBeforeNextTransaction(player.id, 0);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/prison/bail',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      category: 'domain',
      message: 'Creditos insuficientes para pagar a fianca.',
    });

    const [playerRow] = await db
      .select({
        credits: players.credits,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(playerRow?.credits).toBe(0);

    const [record] = await db
      .select({
        releaseAt: prisonRecords.releaseAt,
        releasedEarlyBy: prisonRecords.releasedEarlyBy,
      })
      .from(prisonRecords)
      .where(eq(prisonRecords.playerId, player.id))
      .limit(1);

    expect(record).toBeDefined();
    expect(record?.releasedEarlyBy).toBeNull();
    expect(record?.releaseAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('extends the sentence and increases police heat when escape fails', async () => {
    await app.close();
    app = await createApp({
      prisonRandom: () => 0.99,
    });
    await app.ready();

    const player = await registerAndCreateCharacter();
    await imprisonPlayer(player.id, {
      reason: 'Flagrado em homicidio',
      releaseInHours: 1,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/prison/escape',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      method: 'escape',
      prison: {
        heatScore: 10,
        isImprisoned: true,
      },
      success: false,
    });
    expect(response.json().prison.remainingSeconds).toBeGreaterThan(5000);
  });

  it('lets a general rescue a gerente from prison using faction bank money', async () => {
    const rescuer = await registerAndCreateCharacter();
    const target = await registerAndCreateCharacter();
    const factionId = await createFactionForMembers([
      { playerId: rescuer.id, rank: 'general' },
      { playerId: target.id, rank: 'gerente' },
    ]);

    await db
      .update(factions)
      .set({
        bankMoney: '100000.00',
        leaderId: rescuer.id,
      })
      .where(eq(factions.id, factionId));

    await imprisonPlayer(target.id, {
      reason: 'Flagrado em defesa armada',
      releaseInHours: 1,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${rescuer.accessToken}`,
      },
      method: 'POST',
      url: `/api/prison/faction-rescue/${target.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      factionBankMoneyRemaining: 50000,
      method: 'faction_rescue',
      prison: {
        isImprisoned: false,
      },
      success: true,
    });
  });
});

async function registerAndCreateCharacter(): Promise<{ accessToken: string; id: string }> {
  const email = `player-${randomUUID()}@csrio.test`;
  const nickname = `P${randomUUID().slice(0, 8)}`;

  const registerApp = await createApp();
  await registerApp.ready();

  try {
    const registerResponse = await registerApp.inject({
      method: 'POST',
      payload: {
        email,
        nickname,
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();

    const createResponse = await registerApp.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createResponse.statusCode).toBe(201);

    return {
      accessToken: session.accessToken,
      id: session.player.id,
    };
  } finally {
    await registerApp.close();
  }
}

async function updatePlayerState(
  playerId: string,
  input: Partial<{
    conceito: number;
    credits: number;
    money: string;
  }>,
): Promise<void> {
  await db.update(players).set(input).where(eq(players.id, playerId));
}

async function spendCreditsBeforeNextTransaction(playerId: string, nextCredits: number): Promise<void> {
  const originalTransaction = db.transaction.bind(db);
  const spy = vi.spyOn(db, 'transaction');

  spy.mockImplementationOnce(async (...args) => {
    const [callback] = args;
    await db
      .update(players)
      .set({
        credits: nextCredits,
      })
      .where(eq(players.id, playerId));

    return originalTransaction(callback);
  });
}

async function imprisonPlayer(
  playerId: string,
  input: {
    reason: string;
    releaseInHours: number;
  },
): Promise<void> {
  const now = new Date();

  await db.insert(prisonRecords).values({
    playerId,
    reason: input.reason,
    releaseAt: new Date(now.getTime() + input.releaseInHours * 60 * 60 * 1000),
    sentencedAt: now,
  });
}

async function createFactionForMembers(
  members: Array<{ playerId: string; rank: 'general' | 'gerente' }>,
): Promise<string> {
  const factionId = randomUUID();

  await db.insert(factions).values({
    abbreviation: `F${randomUUID().slice(0, 4)}`,
    bankMoney: '0.00',
    id: factionId,
    isFixed: false,
    name: `Faccao ${randomUUID().slice(0, 8)}`,
  });

  for (const member of members) {
    await db
      .update(players)
      .set({
        factionId,
      })
      .where(eq(players.id, member.playerId));

    const existing = await db
      .select({ playerId: factionMembers.playerId })
      .from(factionMembers)
      .where(and(eq(factionMembers.playerId, member.playerId), eq(factionMembers.factionId, factionId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(factionMembers).values({
        factionId,
        joinedAt: new Date(),
        playerId: member.playerId,
        rank: member.rank,
      });
    }
  }

  return factionId;
}
