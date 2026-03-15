import { RegionId } from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

import { createFactionRoom } from '../src/rooms/FactionRoom.js';
import { createGameRoom } from '../src/rooms/GameRoom.js';

function createLoggerSpy() {
  return {
    error: vi.fn(),
  };
}

describe('realtime logging', () => {
  it('loga excecao nao tratada da room regional', () => {
    const logger = createLoggerSpy();
    const RoomClass = createGameRoom({
      authService: {
        verifyAccessToken: vi.fn(),
      },
      logger,
      playerService: {
        getFreshPlayerProfile: vi.fn(),
      },
    });

    const room = new RoomClass();
    room.onCreate({
      regionId: RegionId.Centro,
    });
    room.onUncaughtException?.(new Error('movement exploded'), 'onMessage');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        methodName: 'onMessage',
        regionId: RegionId.Centro,
      }),
      'Realtime game room uncaught exception.',
    );
  });

  it('loga excecao nao tratada da room de faccao', () => {
    const logger = createLoggerSpy();
    const RoomClass = createFactionRoom({
      authService: {
        verifyAccessToken: vi.fn(),
      },
      logger,
      playerService: {
        getFreshPlayerProfile: vi.fn(),
      },
    });

    const room = new RoomClass();
    room.onCreate({
      factionId: 'cv',
    });
    room.onUncaughtException?.(new Error('chat exploded'), 'onJoin');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        factionId: 'cv',
        methodName: 'onJoin',
      }),
      'Realtime faction room uncaught exception.',
    );
  });
});
