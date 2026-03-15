import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  VocationType,
  type RoundServiceContract,
} from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('round routes', () => {
  it('returns the active round center from the protected route', async () => {
    const roundService: RoundServiceContract = {
      async getCenter() {
        return {
          leaderboard: [
            {
              conceito: 12_000,
              factionAbbreviation: 'ADA',
              level: 7,
              nickname: 'Flucesar',
              playerId: 'player-1',
              rank: 1,
            },
          ],
          npcInflation: buildNpcInflationStub(),
          round: {
            currentGameDay: 12,
            endsAt: '2026-04-20T12:00:00.000Z',
            id: 'round-1',
            number: 1,
            remainingSeconds: 86400,
            startedAt: '2026-03-12T12:00:00.000Z',
            status: 'active',
            totalGameDays: 156,
          },
          topTenCreditReward: 5,
        };
      },
      async getHallOfFame() {
        return {
          rounds: [
            {
              endedAt: '2026-04-20T12:00:00.000Z',
              roundId: 'round-1',
              roundNumber: 1,
              startedAt: '2026-03-12T12:00:00.000Z',
              topThree: [
                {
                  conceito: 12_000,
                  nickname: 'Flucesar',
                  playerId: 'player-1',
                  rank: 1,
                },
              ],
              winnerConceito: 12_000,
              winnerNickname: 'Flucesar',
              winnerPlayerId: 'player-1',
            },
          ],
          totalFinishedRounds: 1,
        };
      },
      async syncLifecycle() {},
    };
    const app = await createApp({
      roundService,
    });
    await app.ready();

    const player = await registerAndCreateCharacter(app);
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/round',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      leaderboard: [
        {
          conceito: 12_000,
          factionAbbreviation: 'ADA',
          level: 7,
          nickname: 'Flucesar',
          playerId: 'player-1',
          rank: 1,
        },
      ],
      round: {
        currentGameDay: 12,
        id: 'round-1',
        number: 1,
        status: 'active',
        totalGameDays: 156,
      },
      topTenCreditReward: 5,
    });

    await app.close();
  });

  it('returns the Hall da Fama from the protected route', async () => {
    const roundService: RoundServiceContract = {
      async getCenter() {
        return {
          leaderboard: [],
          npcInflation: buildNpcInflationStub(),
          round: {
            currentGameDay: 1,
            endsAt: '2026-04-20T12:00:00.000Z',
            id: 'round-2',
            number: 2,
            remainingSeconds: 120,
            startedAt: '2026-03-12T12:00:00.000Z',
            status: 'active',
            totalGameDays: 156,
          },
          topTenCreditReward: 5,
        };
      },
      async getHallOfFame() {
        return {
          rounds: [
            {
              endedAt: '2026-04-20T12:00:00.000Z',
              roundId: 'round-1',
              roundNumber: 1,
              startedAt: '2026-03-12T12:00:00.000Z',
              topThree: [
                {
                  conceito: 12_000,
                  nickname: 'Flucesar',
                  playerId: 'player-1',
                  rank: 1,
                },
                {
                  conceito: 10_500,
                  nickname: 'BocaBraba',
                  playerId: 'player-2',
                  rank: 2,
                },
              ],
              winnerConceito: 12_000,
              winnerNickname: 'Flucesar',
              winnerPlayerId: 'player-1',
            },
          ],
          totalFinishedRounds: 1,
        };
      },
      async syncLifecycle() {},
    };
    const app = await createApp({
      roundService,
    });
    await app.ready();

    const player = await registerAndCreateCharacter(app);
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/round/hall-of-fame',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rounds: [
        {
          roundId: 'round-1',
          roundNumber: 1,
          topThree: [
            {
              conceito: 12_000,
              nickname: 'Flucesar',
              rank: 1,
            },
            {
              conceito: 10_500,
              nickname: 'BocaBraba',
              rank: 2,
            },
          ],
          winnerNickname: 'Flucesar',
        },
      ],
      totalFinishedRounds: 1,
    });

    await app.close();
  });
});

async function registerAndCreateCharacter(
  app: Awaited<ReturnType<typeof createApp>>,
): Promise<{ accessToken: string; id: string }> {
  const email = `player-${randomUUID()}@csrio.test`;
  const nickname = `R${randomUUID().slice(0, 8)}`;

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

function buildNpcInflationStub() {
  return {
    affectedServices: ['hospital', 'training', 'university', 'black_market'] as const,
    currentGameDay: 12,
    currentMultiplier: 1.12,
    currentSurchargePercent: 12,
    gameDayDurationHours: 6,
    maxMultiplier: 1.65,
    nextIncreaseGameDay: 13,
    nextIncreaseInDays: 1,
    nextMultiplier: 1.13,
    nextSurchargePercent: 13,
    resetsOnNewRound: true,
    roundActive: true,
    schedule: [
      {
        gameDay: 1,
        multiplier: 1,
        surchargePercent: 0,
      },
      {
        gameDay: 13,
        multiplier: 1.13,
        surchargePercent: 13,
      },
    ],
    tier: 'rising' as const,
    totalGameDays: 156,
  };
}
