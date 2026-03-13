import { RegionId, VocationType, type FactionRobberyPolicy } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { RoundService, type RoundRepository } from '../src/services/round.js';

interface FakePlayer {
  bankMoney: number;
  conceito: number;
  credits: number;
  id: string;
  level: number;
  money: number;
  nickname: string;
  regionId: RegionId;
  vocation: VocationType;
}

class FakeRoundRepository implements RoundRepository {
  public hallOfFameRecords: Array<{
    finalConceito: number;
    finalRank: number;
    nickname: string;
    playerId: string;
    roundEndsAt: Date;
    roundId: string;
    roundNumber: number;
    roundStartedAt: Date;
  }> = [];

  public readonly rankingsByRound = new Map<
    string,
    Array<{ finalConceito: number; finalRank: number; playerId: string }>
  >();
  public readonly snapshotsByRound = new Map<
    string,
    {
      activeSetCode: string | null;
      entryCount: number;
      featureFlagCount: number;
    }
  >();

  public worldResetCount = 0;

  constructor(
    public rounds: Array<{
      endsAt: Date;
      id: string;
      number: number;
      startedAt: Date;
      status: 'active' | 'finished' | 'scheduled';
    }>,
    public players: FakePlayer[],
  ) {}

  async completeRound(input: {
    defaultFactionInternalSatisfaction: number;
    defaultRobberyPolicy: FactionRobberyPolicy;
    legacyBonuses: Array<{
      bankMoneyBonus: number;
      moneyBonus: number;
      playerId: string;
      tier: 'champion' | 'elite' | 'podium';
    }>;
    now: Date;
    rankings: Array<{ finalConceito: number; finalRank: number; playerId: string }>;
    rewardCredits: number;
    rewardedPlayerIds: string[];
    roundId: string;
  }): Promise<void> {
    const round = this.rounds.find((entry) => entry.id === input.roundId);

    if (!round) {
      throw new Error('Round nao encontrada.');
    }

    round.status = 'finished';
    this.rankingsByRound.set(input.roundId, [...input.rankings]);
    const legacyBonuses = new Map(
      input.legacyBonuses.map((bonus) => [
        bonus.playerId,
        {
          bankMoneyBonus: bonus.bankMoneyBonus,
          moneyBonus: bonus.moneyBonus,
        },
      ]),
    );

    for (const player of this.players) {
      if (input.rewardedPlayerIds.includes(player.id)) {
        player.credits += input.rewardCredits;
      }

      player.bankMoney = legacyBonuses.get(player.id)?.bankMoneyBonus ?? 0;
      player.conceito = 0;
      player.level = 1;
      player.money = legacyBonuses.get(player.id)?.moneyBonus ?? 0;
    }

    this.worldResetCount += 1;
  }

  async createRound(input: {
    configSnapshot?: {
      activeSet: { code: string } | null;
      entries: unknown[];
      featureFlags: unknown[];
    } | null;
    endsAt: Date;
    number: number;
    startedAt: Date;
  }) {
    const created = {
      endsAt: input.endsAt,
      id: `round-${input.number}`,
      number: input.number,
      startedAt: input.startedAt,
      status: 'active' as const,
    };

    this.rounds.push(created);
    this.snapshotsByRound.set(created.id, {
      activeSetCode: input.configSnapshot?.activeSet?.code ?? null,
      entryCount: input.configSnapshot?.entries.length ?? 0,
      featureFlagCount: input.configSnapshot?.featureFlags.length ?? 0,
    });
    return created;
  }

  async getActiveRound() {
    return this.rounds.find((entry) => entry.status === 'active') ?? null;
  }

  async getHallOfFame() {
    return [...this.hallOfFameRecords];
  }

  async getLatestRound() {
    return [...this.rounds].sort((left, right) => right.number - left.number)[0] ?? null;
  }

  async listStandings() {
    return [...this.players]
      .sort((left, right) => {
        if (right.conceito !== left.conceito) {
          return right.conceito - left.conceito;
        }

        if (right.level !== left.level) {
          return right.level - left.level;
        }

        return left.nickname.localeCompare(right.nickname);
      })
      .map((player) => ({
        conceito: player.conceito,
        factionAbbreviation: null,
        level: player.level,
        nickname: player.nickname,
        playerId: player.id,
      }));
  }
}

describe('RoundService', () => {
  it('starts the first active round when none exists yet', async () => {
    const now = new Date('2026-03-12T15:00:00.000Z');
    const repository = new FakeRoundRepository([], [
      buildPlayer({
        conceito: 40,
        id: 'player-1',
        level: 3,
        nickname: 'Alpha',
      }),
    ]);
    const service = new RoundService({
      gameConfigService: createFakeGameConfigService(),
      now: () => now,
      repository,
    });

    const center = await service.getCenter();

    expect(center.round).toMatchObject({
      currentGameDay: 1,
      number: 1,
      remainingSeconds: 3_369_600,
      status: 'active',
      totalGameDays: 156,
    });
    expect(center.leaderboard[0]).toMatchObject({
      conceito: 40,
      nickname: 'Alpha',
      rank: 1,
    });
    expect(repository.rounds).toHaveLength(1);
    expect(repository.rounds[0]?.status).toBe('active');
    expect(repository.snapshotsByRound.get('round-1')).toMatchObject({
      activeSetCode: 'pre_alpha_default_2026_03',
      entryCount: 2,
      featureFlagCount: 1,
    });
  });

  it('finishes the expired round, rewards top ten and starts a new clean round', async () => {
    const now = new Date('2026-03-12T18:00:00.000Z');
    const repository = new FakeRoundRepository(
      [
        {
          endsAt: new Date('2026-03-12T17:59:00.000Z'),
          id: 'round-1',
          number: 1,
          startedAt: new Date('2026-02-01T18:00:00.000Z'),
          status: 'active',
        },
      ],
      Array.from({ length: 11 }, (_value, index) =>
        buildPlayer({
          conceito: 11_000 - index * 1_000,
          credits: 0,
          id: `player-${index + 1}`,
          level: 11 - index,
          nickname: `P${index + 1}`,
        }),
      ),
    );
    const service = new RoundService({
      gameConfigService: createFakeGameConfigService(),
      now: () => now,
      repository,
    });

    await service.syncLifecycle(now);

    expect(repository.worldResetCount).toBe(1);
    expect(repository.rounds).toHaveLength(2);
    expect(repository.rounds[0]).toMatchObject({
      id: 'round-1',
      status: 'finished',
    });
    expect(repository.rounds[1]).toMatchObject({
      id: 'round-2',
      number: 2,
      startedAt: now,
      status: 'active',
    });
    expect(repository.snapshotsByRound.get('round-2')).toMatchObject({
      activeSetCode: 'pre_alpha_default_2026_03',
      entryCount: 2,
      featureFlagCount: 1,
    });

    const firstRoundRankings = repository.rankingsByRound.get('round-1');
    expect(firstRoundRankings).toHaveLength(11);
    expect(firstRoundRankings?.[0]).toMatchObject({
      finalConceito: 11_000,
      finalRank: 1,
      playerId: 'player-1',
    });
    expect(firstRoundRankings?.[10]).toMatchObject({
      finalConceito: 1_000,
      finalRank: 11,
      playerId: 'player-11',
    });

    expect(repository.players.slice(0, 10).every((player) => player.credits === 5)).toBe(true);
    expect(repository.players[10]?.credits).toBe(0);
    expect(repository.players.every((player) => player.conceito === 0)).toBe(true);
    expect(repository.players.every((player) => player.level === 1)).toBe(true);
    expect(repository.players[0]).toMatchObject({
      bankMoney: 7_500,
      money: 15_000,
    });
    expect(repository.players[1]).toMatchObject({
      bankMoney: 5_000,
      money: 10_000,
    });
    expect(repository.players[9]).toMatchObject({
      bankMoney: 2_500,
      money: 5_000,
    });
    expect(repository.players[10]).toMatchObject({
      bankMoney: 0,
      money: 0,
    });
  });

  it('builds the Hall da Fama grouped by finished round', async () => {
    const repository = new FakeRoundRepository([], []);
    repository.hallOfFameRecords = [
      {
        finalConceito: 12_000,
        finalRank: 1,
        nickname: 'Flucesar',
        playerId: 'player-1',
        roundEndsAt: new Date('2026-04-20T12:00:00.000Z'),
        roundId: 'round-2',
        roundNumber: 2,
        roundStartedAt: new Date('2026-03-12T12:00:00.000Z'),
      },
      {
        finalConceito: 11_250,
        finalRank: 2,
        nickname: 'BocaBraba',
        playerId: 'player-2',
        roundEndsAt: new Date('2026-04-20T12:00:00.000Z'),
        roundId: 'round-2',
        roundNumber: 2,
        roundStartedAt: new Date('2026-03-12T12:00:00.000Z'),
      },
      {
        finalConceito: 9_990,
        finalRank: 4,
        nickname: 'TopoSeco',
        playerId: 'player-4',
        roundEndsAt: new Date('2026-04-20T12:00:00.000Z'),
        roundId: 'round-2',
        roundNumber: 2,
        roundStartedAt: new Date('2026-03-12T12:00:00.000Z'),
      },
      {
        finalConceito: 10_000,
        finalRank: 1,
        nickname: 'LiderVelho',
        playerId: 'player-9',
        roundEndsAt: new Date('2026-03-11T12:00:00.000Z'),
        roundId: 'round-1',
        roundNumber: 1,
        roundStartedAt: new Date('2026-02-01T12:00:00.000Z'),
      },
    ];
    const service = new RoundService({
      repository,
    });

    const hallOfFame = await service.getHallOfFame();

    expect(hallOfFame.totalFinishedRounds).toBe(2);
    expect(hallOfFame.rounds).toEqual([
      {
        endedAt: '2026-04-20T12:00:00.000Z',
        roundId: 'round-2',
        roundNumber: 2,
        startedAt: '2026-03-12T12:00:00.000Z',
        topThree: [
          {
            conceito: 12_000,
            nickname: 'Flucesar',
            playerId: 'player-1',
            rank: 1,
          },
          {
            conceito: 11_250,
            nickname: 'BocaBraba',
            playerId: 'player-2',
            rank: 2,
          },
        ],
        winnerConceito: 12_000,
        winnerNickname: 'Flucesar',
        winnerPlayerId: 'player-1',
      },
      {
        endedAt: '2026-03-11T12:00:00.000Z',
        roundId: 'round-1',
        roundNumber: 1,
        startedAt: '2026-02-01T12:00:00.000Z',
        topThree: [
          {
            conceito: 10_000,
            nickname: 'LiderVelho',
            playerId: 'player-9',
            rank: 1,
          },
        ],
        winnerConceito: 10_000,
        winnerNickname: 'LiderVelho',
        winnerPlayerId: 'player-9',
      },
    ]);
  });
});

function buildPlayer(
  input: Partial<FakePlayer> & Pick<FakePlayer, 'conceito' | 'id' | 'level' | 'nickname'>,
): FakePlayer {
  return {
    bankMoney: input.bankMoney ?? 0,
    conceito: input.conceito,
    credits: input.credits ?? 0,
    id: input.id,
    level: input.level,
    money: input.money ?? 0,
    nickname: input.nickname,
    regionId: input.regionId ?? RegionId.Centro,
    vocation: input.vocation ?? VocationType.Cria,
  };
}

function createFakeGameConfigService() {
  return {
    async getResolvedCatalog() {
      return {
        activeRoundId: null,
        activeSet: {
          code: 'pre_alpha_default_2026_03',
          description: 'Catalogo padrao do pre-alpha.',
          id: 'config-set-1',
          isDefault: true,
          name: 'Pre-Alpha Default 2026.03',
          notes: null,
          status: 'active' as const,
        },
        entries: [
          {
            key: 'round.total_game_days',
            scope: 'global' as const,
            source: 'set_entry' as const,
            targetKey: '*',
            valueJson: { value: 156 },
          },
          {
            key: 'round.top_ten_credit_reward',
            scope: 'global' as const,
            source: 'set_entry' as const,
            targetKey: '*',
            valueJson: { value: 5 },
          },
        ],
        featureFlags: [
          {
            effectiveFrom: new Date('2026-03-12T15:00:00.000Z').toISOString(),
            effectiveUntil: null,
            id: 'flag-1',
            key: 'events.police.enabled',
            notes: null,
            payloadJson: {},
            scope: 'global' as const,
            status: 'active' as const,
            targetKey: '*',
          },
        ],
        resolvedAt: new Date('2026-03-12T15:00:00.000Z').toISOString(),
      };
    },
  };
}
