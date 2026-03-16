import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  LevelTitle,
  RegionId,
  VocationType,
  type PlayerProfile,
  type PlayerPrisonStatus,
} from '@cs-rio/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { type AuthService } from '../src/services/auth.js';
import { type PlayerService } from '../src/services/player.js';
import { type TrainingServiceContract } from '../src/services/training.js';
import { type PrisonSystemContract } from '../src/systems/PrisonSystem.js';

function buildProfile(prison: PlayerPrisonStatus): PlayerProfile {
  return {
    appearance: DEFAULT_CHARACTER_APPEARANCE,
    attributes: {
      carisma: 10,
      forca: 30,
      inteligencia: 10,
      resistencia: 20,
    },
    faction: null,
    hasCharacter: true,
    hospitalization: DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
    id: 'player-1',
    inventory: [],
    level: 1,
    location: {
      positionX: 102,
      positionY: 96,
      regionId: RegionId.Centro,
    },
    nickname: 'Player_01',
    prison,
    properties: [],
    regionId: RegionId.Centro,
    resources: {
      addiction: 0,
      bankMoney: 0,
      conceito: 0,
      hp: 100,
      brisa: 100,
      money: 0,
      disposicao: 100,
      cansaco: 100,
    },
    title: LevelTitle.Pivete,
    vocation: VocationType.Cria,
  };
}

describe('prison action lock middleware', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  const verifyAccessToken = vi.fn(() => ({
    playerId: 'player-1',
  }));
  const getPlayerProfile = vi.fn<() => Promise<PlayerProfile>>();
  const startTraining = vi.fn();

  const trainingService: TrainingServiceContract = {
    claimTraining: vi.fn(),
    getTrainingCenter: vi.fn(),
    startTraining,
  };

  beforeEach(async () => {
    app = await createApp({
      authService: {
        verifyAccessToken,
      } as unknown as AuthService,
      playerService: {
        createCharacter: vi.fn(),
        getPlayerProfile,
      } as unknown as PlayerService,
      prisonSystem: {
        getStatus: vi.fn(async () => DEFAULT_PLAYER_PRISON_STATUS),
      } as PrisonSystemContract,
      trainingService,
    });
    await app.ready();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('keeps /players/me available and exposes the prison timer with police heat', async () => {
    const prison: PlayerPrisonStatus = {
      endsAt: '2026-03-11T18:00:00.000Z',
      heatScore: 64,
      heatTier: 'quente',
      isImprisoned: true,
      reason: 'Flagrado em assalto a pedestre',
      remainingSeconds: 7200,
      sentencedAt: '2026-03-11T16:00:00.000Z',
    };

    getPlayerProfile.mockResolvedValueOnce(buildProfile(prison));

    const response = await app.inject({
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'GET',
      url: '/api/players/me',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'player-1',
      prison,
    });
  });

  it('blocks protected actions while the player is imprisoned before hitting the route service', async () => {
    const prison: PlayerPrisonStatus = {
      endsAt: '2026-03-11T18:00:00.000Z',
      heatScore: 82,
      heatTier: 'cacado',
      isImprisoned: true,
      reason: 'Flagrado em homicidio',
      remainingSeconds: 14400,
      sentencedAt: '2026-03-11T14:00:00.000Z',
    };

    const prisonSystem: PrisonSystemContract = {
      getStatus: vi.fn(async () => prison),
    };

    await app.close();
    app = await createApp({
      authService: {
        verifyAccessToken,
      } as unknown as AuthService,
      playerService: {
        createCharacter: vi.fn(),
        getPlayerProfile,
      } as unknown as PlayerService,
      prisonSystem,
      trainingService,
    });
    await app.ready();

    const response = await app.inject({
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'POST',
      payload: {
        type: 'basic',
      },
      url: '/api/training-center/sessions',
    });

    expect(response.statusCode).toBe(423);
    expect(response.json()).toMatchObject({
      message: expect.stringContaining('Jogador preso ate'),
      prison: {
        heatScore: 82,
        heatTier: 'cacado',
        isImprisoned: true,
      },
    });
    expect(startTraining).not.toHaveBeenCalled();
  });
});
