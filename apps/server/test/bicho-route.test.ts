import { randomUUID } from 'node:crypto';

import {
  BICHO_ANIMALS,
  DEFAULT_CHARACTER_APPEARANCE,
  type BichoPlaceBetInput,
  VocationType,
  RegionId,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createBichoRoutes } from '../src/api/routes/bicho.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import {
  BichoService,
  type BichoRepository,
} from '../src/services/bicho.js';

type DrawRecord = {
  closesAt: Date;
  id: string;
  opensAt: Date;
  sequence: number;
  settledAt: Date | null;
  totalBetAmount: number;
  totalPayoutAmount: number;
  winningAnimalNumber: number | null;
  winningDozen: number | null;
};

type BetRecord = {
  amount: number;
  animalNumber: number | null;
  dozen: number | null;
  drawId: string;
  id: string;
  mode: 'cabeca' | 'grupo' | 'dezena';
  payout: number;
  placedAt: Date;
  playerId: string;
  settledAt: Date | null;
  status: 'pending' | 'won' | 'lost';
};

interface TestState {
  bets: Map<string, BetRecord>;
  draws: Map<string, DrawRecord>;
  factionLedgerByFactionId: Map<string, Array<{
    balanceAfter: number;
    commissionAmount: number;
    createdAt: Date;
    description: string;
    entryType: 'business_commission';
    grossAmount: number;
    id: string;
    netAmount: number;
    originType: 'bicho';
    playerId: string | null;
    propertyId: string | null;
  }>>;
  factions: Map<string, { bankMoney: number; id: string; points: number }>;
  players: Map<string, AuthPlayerRecord>;
}

class InMemoryAuthBichoRepository implements AuthRepository, BichoRepository {
  constructor(private readonly state: TestState) {}

  async createDraw(input: { closesAt: Date; opensAt: Date; sequence: number }) {
    const draw: DrawRecord = {
      closesAt: input.closesAt,
      id: randomUUID(),
      opensAt: input.opensAt,
      sequence: input.sequence,
      settledAt: null,
      totalBetAmount: 0,
      totalPayoutAmount: 0,
      winningAnimalNumber: null,
      winningDozen: null,
    };
    this.state.draws.set(draw.id, draw);
    return { ...draw };
  }

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player: AuthPlayerRecord = {
      addiction: 0,
      appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
      bankMoney: '0',
      carisma: 25,
      characterCreatedAt: new Date('2026-03-10T12:00:00.000Z'),
      conceito: 9000,
      createdAt: new Date('2026-03-10T12:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 10,
      hp: 100,
      id: randomUUID(),
      inteligencia: 10,
      lastLogin: input.lastLogin,
      level: 1,
      morale: 100,
      money: '50000',
      nerve: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 0,
      positionY: 0,
      regionId: RegionId.Centro,
      resistencia: 10,
      stamina: 100,
      vocation: VocationType.Cria,
    };

    this.state.players.set(player.id, player);
    return { ...player };
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async getCurrentDraw(opensAt: Date, closesAt: Date) {
    for (const draw of this.state.draws.values()) {
      if (draw.opensAt.getTime() === opensAt.getTime() && draw.closesAt.getTime() === closesAt.getTime()) {
        return { ...draw };
      }
    }

    return null;
  }

  async getLatestDraw() {
    let latest: DrawRecord | null = null;

    for (const draw of this.state.draws.values()) {
      if (!latest || draw.sequence > latest.sequence) {
        latest = draw;
      }
    }

    return latest ? { ...latest } : null;
  }

  async getPlayer(playerId: string) {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      money: Number.parseFloat(player.money),
    };
  }

  async listBetsForDraw(drawId: string) {
    return [...this.state.bets.values()]
      .filter((bet) => bet.drawId === drawId)
      .sort((left, right) => left.placedAt.getTime() - right.placedAt.getTime())
      .map((bet) => ({ ...bet }));
  }

  async listPendingDraws(now: Date) {
    return [...this.state.draws.values()]
      .filter((draw) => draw.closesAt <= now && !draw.settledAt)
      .sort((left, right) => left.closesAt.getTime() - right.closesAt.getTime())
      .map((draw) => ({ ...draw }));
  }

  async listPlayerBets(playerId: string, limit: number) {
    const drawMap = this.state.draws;

    return [...this.state.bets.values()]
      .filter((bet) => bet.playerId === playerId)
      .sort((left, right) => right.placedAt.getTime() - left.placedAt.getTime())
      .slice(0, limit)
      .flatMap((bet) => {
        const draw = drawMap.get(bet.drawId);
        if (!draw) {
          return [];
        }

        return [
          {
            ...bet,
            drawClosesAt: draw.closesAt,
          },
        ];
      });
  }

  async listRecentDraws(limit: number) {
    return [...this.state.draws.values()]
      .filter((draw) => draw.settledAt)
      .sort((left, right) => (right.settledAt?.getTime() ?? 0) - (left.settledAt?.getTime() ?? 0))
      .slice(0, limit)
      .map((draw) => ({ ...draw }));
  }

  async placeBet(
    playerId: string,
    input: {
      amount: number;
      animalNumber: number | null;
      drawId: string;
      dozen: number | null;
      mode: 'cabeca' | 'grupo' | 'dezena';
      placedAt: Date;
    },
  ) {
    const player = this.state.players.get(playerId);
    const draw = this.state.draws.get(input.drawId);

    if (!player || !draw) {
      return null;
    }

    const bet: BetRecord = {
      amount: input.amount,
      animalNumber: input.animalNumber,
      dozen: input.dozen,
      drawId: input.drawId,
      id: randomUUID(),
      mode: input.mode,
      payout: 0,
      placedAt: input.placedAt,
      playerId,
      settledAt: null,
      status: 'pending',
    };

    player.money = String(roundMoney(Number.parseFloat(player.money) - input.amount));
    draw.totalBetAmount = roundMoney(draw.totalBetAmount + input.amount);

    if (player.factionId) {
      const faction = this.state.factions.get(player.factionId);

      if (faction) {
        const commissionAmount = roundMoney(input.amount * 0.07);
        faction.bankMoney = roundMoney(faction.bankMoney + commissionAmount);
        faction.points += Math.max(1, Math.round(commissionAmount));
        const ledgerEntries = this.state.factionLedgerByFactionId.get(faction.id) ?? [];
        ledgerEntries.push({
          balanceAfter: faction.bankMoney,
          commissionAmount,
          createdAt: input.placedAt,
          description: 'Comissão automática recebida de aposta no jogo do bicho de membro.',
          entryType: 'business_commission',
          grossAmount: input.amount,
          id: randomUUID(),
          netAmount: roundMoney(input.amount - commissionAmount),
          originType: 'bicho',
          playerId,
          propertyId: null,
        });
        this.state.factionLedgerByFactionId.set(faction.id, ledgerEntries);
      }
    }

    this.state.bets.set(bet.id, bet);

    return {
      betId: bet.id,
      factionCommissionAmount: player.factionId ? roundMoney(input.amount * 0.07) : 0,
      playerMoneyAfterBet: Number.parseFloat(player.money),
    };
  }

  async settleDraw(input: {
    drawId: string;
    settledAt: Date;
    settlements: Array<{
      betId: string;
      payout: number;
      playerId: string;
      settledAt: Date;
      status: 'pending' | 'won' | 'lost';
    }>;
    totalPayoutAmount: number;
    winningAnimalNumber: number;
    winningDozen: number;
  }) {
    const draw = this.state.draws.get(input.drawId);

    if (!draw) {
      return null;
    }

    draw.settledAt = input.settledAt;
    draw.totalPayoutAmount = input.totalPayoutAmount;
    draw.winningAnimalNumber = input.winningAnimalNumber;
    draw.winningDozen = input.winningDozen;

    const affectedPlayerIds = new Set<string>();

    for (const settlement of input.settlements) {
      const bet = this.state.bets.get(settlement.betId);
      if (!bet) {
        continue;
      }

      bet.payout = settlement.payout;
      bet.settledAt = settlement.settledAt;
      bet.status = settlement.status;

      if (settlement.payout > 0) {
        const player = this.state.players.get(settlement.playerId);
        if (player) {
          player.money = String(roundMoney(Number.parseFloat(player.money) + settlement.payout));
          affectedPlayerIds.add(settlement.playerId);
        }
      }
    }

    return {
      affectedPlayerIds: [...affectedPlayerIds],
    };
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async increment(key: string): Promise<number> {
    const nextValue = Number.parseInt(this.values.get(key) ?? '0', 10) + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('bicho routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;
  let randomProvider: () => number;
  let state: TestState;

  beforeEach(async () => {
    now = new Date('2026-03-10T12:05:00.000Z');
    randomProvider = createRandomSequence([0.24, 0.42, 0.1, 0.1]);
    state = buildState();
    app = await buildTestApp({
      now: () => now,
      random: () => randomProvider(),
      state,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates the current draw, settles a winning cabeca bet and pays the prize', async () => {
    const player = await registerPlayer(app.server);

    const firstList = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'GET',
      url: '/api/jogo-do-bicho',
    });

    expect(firstList.statusCode).toBe(200);
    expect(firstList.json().currentDraw.sequence).toBe(1);
    expect(firstList.json().animals).toHaveLength(BICHO_ANIMALS.length);

    const placeBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 1000,
        animalNumber: 7,
        mode: 'cabeca',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });

    expect(placeBet.statusCode).toBe(201);
    expect(placeBet.json().playerMoneyAfterBet).toBe(49000);

    now = new Date('2026-03-10T12:31:00.000Z');

    const settledList = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'GET',
      url: '/api/jogo-do-bicho',
    });

    expect(settledList.statusCode).toBe(200);
    expect(settledList.json().recentDraws[0].winningAnimalNumber).toBe(7);
    expect(settledList.json().recentDraws[0].winningDozen).toBe(42);
    expect(settledList.json().bets[0].status).toBe('won');
    expect(settledList.json().bets[0].payout).toBe(18000);
    expect(state.players.get(player.playerId)?.money).toBe('67000');
    expect(settledList.json().currentDraw.sequence).toBe(2);
  });

  it('settles a winning dezena bet and a losing grupo bet in the same draw', async () => {
    const player = await registerPlayer(app.server);

    const dozenBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 500,
        dozen: 42,
        mode: 'dezena',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });
    const groupBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 500,
        animalNumber: 1,
        mode: 'grupo',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });

    expect(dozenBet.statusCode).toBe(201);
    expect(groupBet.statusCode).toBe(201);

    now = new Date('2026-03-10T12:31:00.000Z');

    const settledList = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'GET',
      url: '/api/jogo-do-bicho',
    });

    expect(settledList.statusCode).toBe(200);
    expect(settledList.json().recentDraws[0].winningDozen).toBe(42);
    const settledBets = settledList.json().bets;
    const groupResult = settledBets.find((bet) => bet.mode === 'grupo');
    const dozenResult = settledBets.find((bet) => bet.mode === 'dezena');

    expect(groupResult?.status).toBe('lost');
    expect(dozenResult?.status).toBe('won');
    expect(dozenResult?.payout).toBe(30000);
    expect(state.players.get(player.playerId)?.money).toBe('79000');
  });

  it('rejects invalid selections and bets above the available money', async () => {
    const player = await registerPlayer(app.server);

    const invalidBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 1000,
        dozen: 100,
        mode: 'dezena',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });

    expect(invalidBet.statusCode).toBe(400);
    expect(invalidBet.json().message).toContain('dezena valida');

    const playerRecord = state.players.get(player.playerId);
    if (!playerRecord) {
      throw new Error('Jogador de teste nao encontrado.');
    }
    playerRecord.money = '200';

    const expensiveBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 1000,
        animalNumber: 3,
        mode: 'cabeca',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });

    expect(expensiveBet.statusCode).toBe(409);
    expect(expensiveBet.json().message).toContain('Dinheiro em maos insuficiente');
  });

  it('repasse automático do bicho cai no caixa da facção e entra no ledger', async () => {
    const player = await registerPlayer(app.server);
    state.factions.set('faction-bicho', {
      bankMoney: 0,
      id: 'faction-bicho',
      points: 0,
    });
    const playerRecord = state.players.get(player.playerId);

    if (!playerRecord) {
      throw new Error('Jogador do bicho não encontrado no estado de teste.');
    }

    playerRecord.factionId = 'faction-bicho';

    const placeBet = await app.server.inject({
      headers: { authorization: `Bearer ${player.accessToken}` },
      method: 'POST',
      payload: {
        amount: 1000,
        animalNumber: 7,
        mode: 'cabeca',
      } satisfies BichoPlaceBetInput,
      url: '/api/jogo-do-bicho/bets',
    });

    expect(placeBet.statusCode).toBe(201);
    expect(placeBet.json().factionCommission).toMatchObject({
      active: true,
      amount: 70,
      ratePercent: 7,
    });
    expect(state.factions.get('faction-bicho')?.bankMoney).toBe(70);
    expect(state.factions.get('faction-bicho')?.points).toBe(70);
    expect(state.factionLedgerByFactionId.get('faction-bicho')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commissionAmount: 70,
          entryType: 'business_commission',
          grossAmount: 1000,
          originType: 'bicho',
          playerId: player.playerId,
        }),
      ]),
    );
  });
});

async function buildTestApp(input: {
  now: () => Date;
  random: () => number;
  state: TestState;
}) {
  const keyValueStore = new InMemoryKeyValueStore();
  const repository = new InMemoryAuthBichoRepository(input.state);
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const bichoService = new BichoService({
    keyValueStore,
    now: input.now,
    random: input.random,
    repository,
  });
  const server = Fastify();

  await server.register(
    async (api) => {
      await api.register(createAuthRoutes({ authService }));
      await api.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
        await protectedRoutes.register(createBichoRoutes({ bichoService }));
      });
    },
    {
      prefix: '/api',
    },
  );

  return {
    close: async () => {
      await bichoService.close?.();
      await authService.close();
      await server.close();
    },
    server,
  };
}

function buildState(): TestState {
  return {
    bets: new Map(),
    draws: new Map(),
    factionLedgerByFactionId: new Map(),
    factions: new Map(),
    players: new Map(),
  };
}

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index];

    if (value === undefined) {
      return 0.1;
    }

    index += 1;
    return value;
  };
}

async function registerPlayer(server: Awaited<ReturnType<typeof Fastify>>) {
  const response = await server.inject({
    method: 'POST',
    payload: {
      email: `player-${randomUUID()}@csrio.test`,
      nickname: `player_${Math.floor(Math.random() * 100000)}`,
      password: '12345678',
    },
    url: '/api/auth/register',
  });

  expect(response.statusCode).toBe(201);

  return {
    accessToken: response.json().accessToken as string,
    playerId: response.json().player.id as string,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
