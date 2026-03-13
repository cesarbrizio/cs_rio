import { describe, expect, it } from 'vitest';

import { stepInterpolatedPlayers } from '../src/features/realtimeInterpolation';

describe('realtime interpolation', () => {
  it('lerps existing remote players toward the latest target position', () => {
    const nextPlayers = stepInterpolatedPlayers(
      [
        {
          animation: 'walk_e',
          nickname: 'Player_01',
          playerId: 'player-1',
          regionId: 'centro',
          sessionId: 'session-1',
          title: 'pivete',
          vocation: 'soldado',
          x: 100,
          y: 100,
        },
      ],
      [
        {
          animation: 'walk_e',
          nickname: 'Player_01',
          playerId: 'player-1',
          regionId: 'centro',
          sessionId: 'session-1',
          title: 'pivete',
          vocation: 'soldado',
          x: 110,
          y: 120,
        },
      ],
      0.5,
    );

    expect(nextPlayers[0]).toMatchObject({
      x: 105,
      y: 110,
    });
  });

  it('snaps new players into the interpolation state immediately', () => {
    const nextPlayers = stepInterpolatedPlayers([], [
      {
        animation: 'idle_s',
        nickname: 'Player_02',
        playerId: 'player-2',
        regionId: 'centro',
        sessionId: 'session-2',
        title: 'pivete',
        vocation: 'cria',
        x: 84,
        y: 118,
      },
    ]);

    expect(nextPlayers[0]).toMatchObject({
      x: 84,
      y: 118,
    });
  });
});
