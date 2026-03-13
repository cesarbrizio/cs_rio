import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, VocationType } from '@cs-rio/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { players } from '../src/db/schema.js';
import { BankService } from '../src/services/bank.js';

const FIXED_NOW = new Date('2026-03-11T15:00:00.000Z');

describe('bank routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    app = await createApp({
      bankService: new BankService({
        now: () => FIXED_NOW,
      }),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the bank center with synced daily interest and protected balance metadata', async () => {
    const player = await registerAndCreateCharacter(app);
    await updatePlayerState(player.id, {
      bankInterestSyncedAt: new Date('2026-03-09T14:00:00.000Z'),
      bankMoney: '100000.00',
      level: 4,
      money: '5000.00',
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/bank',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      bankMoney: 102010,
      dailyDepositLimit: 575000,
      dailyInterestRatePercent: 1,
      pocketMoney: 5000,
      protection: {
        fromDeathLoss: true,
        fromPoliceSeizure: true,
        fromPvpLoot: true,
      },
      remainingDepositLimit: 575000,
      withdrawFeeRatePercent: 0.5,
    });
    expect(response.json().ledger[0]).toMatchObject({
      description: 'Juros diarios aplicados sobre o saldo (2 dias).',
      entryType: 'interest',
      grossAmount: 2010,
      netAmount: 2010,
    });
  });

  it('accepts deposits until the daily cap and then blocks new deposits', async () => {
    const player = await registerAndCreateCharacter(app);
    await updatePlayerState(player.id, {
      money: '700000.00',
    });

    const firstDeposit = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 500000,
      },
      url: '/api/bank/deposit',
    });

    expect(firstDeposit.statusCode).toBe(200);
    expect(firstDeposit.json()).toMatchObject({
      bank: {
        bankMoney: 500000,
        depositedToday: 500000,
        pocketMoney: 200000,
        remainingDepositLimit: 0,
      },
      bankMoneyDelta: 500000,
      feePaid: 0,
      pocketMoneyDelta: -500000,
    });

    const secondDeposit = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 1000,
      },
      url: '/api/bank/deposit',
    });

    expect(secondDeposit.statusCode).toBe(409);
    expect(secondDeposit.json()).toMatchObject({
      message: 'Limite diario de deposito excedido. Disponivel no dia: R$ 0.00.',
    });
  });

  it('applies the withdrawal fee and credits only the net amount to pocket money', async () => {
    const player = await registerAndCreateCharacter(app);
    await updatePlayerState(player.id, {
      bankMoney: '100000.00',
      money: '1000.00',
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        amount: 10000,
      },
      url: '/api/bank/withdraw',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      bank: {
        bankMoney: 90000,
        pocketMoney: 10950,
      },
      bankMoneyDelta: -10000,
      feePaid: 50,
      pocketMoneyDelta: 9950,
    });
  });
});

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
): Promise<{ accessToken: string; id: string }> {
  const email = `player-${randomUUID()}@csrio.test`;
  const nickname = `P${randomUUID().slice(0, 8)}`;

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
      vocation: VocationType.Soldado,
    },
    url: '/api/players/create',
  });

  expect(createResponse.statusCode).toBe(201);

  return {
    accessToken: session.accessToken,
    id: session.player.id,
  };
}

async function updatePlayerState(
  playerId: string,
  input: Partial<{
    bankInterestSyncedAt: Date;
    bankMoney: string;
    level: number;
    money: string;
  }>,
): Promise<void> {
  await db.update(players).set(input).where(eq(players.id, playerId));
}
