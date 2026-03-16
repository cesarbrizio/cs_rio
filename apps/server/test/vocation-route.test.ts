import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  VOCATION_CHANGE_COOLDOWN_HOURS,
  VOCATION_CHANGE_CREDITS_COST,
  VocationType,
} from '@cs-rio/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { players } from '../src/db/schema.js';
import { PlayerService } from '../src/services/player.js';

const FIXED_NOW = new Date('2026-03-16T18:00:00.000Z');

describe('vocation routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let playerService: PlayerService | null;

  beforeEach(async () => {
    playerService = new PlayerService({
      now: () => FIXED_NOW,
    });
    app = await createApp({
      playerService,
    });
    await app.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
    if (playerService) {
      await playerService.close();
      playerService = null;
    }
  });

  it('returns the vocation center with current status, pricing and options', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Cria);
    await updatePlayerState(player.id, {
      credits: 18,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/players/vocation',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      availability: {
        available: true,
        creditsCost: VOCATION_CHANGE_CREDITS_COST,
        reason: null,
      },
      cooldownHours: VOCATION_CHANGE_COOLDOWN_HOURS,
      player: {
        credits: 18,
        nickname: expect.stringMatching(/^Vocacao_/),
        vocation: VocationType.Cria,
      },
      status: {
        changedAt: null,
        currentVocation: VocationType.Cria,
        pendingVocation: null,
        state: 'ready',
      },
    });
    expect(response.json().options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: VocationType.Cria,
          isCurrent: true,
          label: 'Cria',
        }),
        expect.objectContaining({
          id: VocationType.Politico,
          isCurrent: false,
          label: 'Politico',
        }),
      ]),
    );
  });

  it('changes vocation, consumes credits and starts the global cooldown', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Cria);
    await updatePlayerState(player.id, {
      credits: 25,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        vocation: VocationType.Gerente,
      },
      url: '/api/players/vocation/change',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      center: {
        availability: {
          available: false,
          creditsCost: VOCATION_CHANGE_CREDITS_COST,
        },
        player: {
          credits: 25 - VOCATION_CHANGE_CREDITS_COST,
          vocation: VocationType.Gerente,
        },
        status: {
          changedAt: FIXED_NOW.toISOString(),
          currentVocation: VocationType.Gerente,
          state: 'cooldown',
        },
      },
      message: 'Vocacao alterada para Gerente. Cooldown global de 24h iniciado.',
      player: {
        vocation: VocationType.Gerente,
      },
    });

    const [updatedPlayer] = await db
      .select({
        credits: players.credits,
        vocation: players.vocation,
        vocationChangedAt: players.vocationChangedAt,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(updatedPlayer).toMatchObject({
      credits: 25 - VOCATION_CHANGE_CREDITS_COST,
      vocation: VocationType.Gerente,
    });
    expect(updatedPlayer?.vocationChangedAt?.toISOString()).toBe(FIXED_NOW.toISOString());
  });

  it('rejects changing to the same vocation', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Soldado);
    await updatePlayerState(player.id, {
      credits: 15,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        vocation: VocationType.Soldado,
      },
      url: '/api/players/vocation/change',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      category: 'domain',
      message: 'Essa ja e a vocacao atual do personagem.',
    });
  });

  it('rejects vocation change while the cooldown is still active', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Cria);
    await updatePlayerState(player.id, {
      credits: 25,
      vocationChangedAt: new Date(FIXED_NOW.getTime() - 2 * 60 * 60 * 1000),
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        vocation: VocationType.Politico,
      },
      url: '/api/players/vocation/change',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      category: 'domain',
      message: `A troca de vocacao esta em cooldown global de ${VOCATION_CHANGE_COOLDOWN_HOURS}h.`,
    });
  });

  it('rejects vocation change when the player lacks credits', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Cria);
    await updatePlayerState(player.id, {
      credits: 3,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        vocation: VocationType.Empreendedor,
      },
      url: '/api/players/vocation/change',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      category: 'domain',
      message: 'Creditos insuficientes para mudar de vocacao.',
    });
  });

  it('rejects vocation change when credits disappear between pre-check and update', async () => {
    const player = await registerAndCreateCharacter(app, VocationType.Cria);
    await updatePlayerState(player.id, {
      credits: VOCATION_CHANGE_CREDITS_COST,
    });

    await spendCreditsBeforeNextTransaction(player.id, 0);

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        vocation: VocationType.Empreendedor,
      },
      url: '/api/players/vocation/change',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      category: 'domain',
      message: 'Creditos insuficientes para mudar de vocacao.',
    });

    const [playerRow] = await db
      .select({
        credits: players.credits,
        vocation: players.vocation,
        vocationChangedAt: players.vocationChangedAt,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(playerRow).toMatchObject({
      credits: 0,
      vocation: VocationType.Cria,
      vocationChangedAt: null,
    });
  });
});

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
  vocation: VocationType,
) {
  const email = `${randomUUID()}@vocacao.test`;
  const nickname = `Vocacao_${randomUUID().slice(0, 8)}`;

  const registerResponse = await app.inject({
    method: 'POST',
    payload: {
      email,
      nickname,
      password: 'segredo123',
    },
    url: '/api/auth/register',
  });
  const session = registerResponse.json();

  const createResponse = await app.inject({
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
    method: 'POST',
    payload: {
      appearance: DEFAULT_CHARACTER_APPEARANCE,
      vocation,
    },
    url: '/api/players/create',
  });

  expect(createResponse.statusCode).toBe(201);

  return {
    accessToken: session.accessToken as string,
    id: session.player.id as string,
  };
}

async function updatePlayerState(
  playerId: string,
  input: Partial<{
    credits: number;
    vocationChangedAt: Date | null;
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
