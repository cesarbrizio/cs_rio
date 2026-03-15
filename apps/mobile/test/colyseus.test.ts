import { REALTIME_MESSAGE_PLAYER_MOVE, RegionId } from '@cs-rio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  appEnv: {
    wsUrl: 'ws://127.0.0.1:2567',
  },
}));

import { ColyseusService } from '../src/services/colyseus';

class FakeRoom {
  public name: string;

  public onErrorListeners = new Set<(code: number, message?: string) => void>();

  public onLeaveListeners = new Set<(code: number, reason?: string) => void>();

  public onStateChangeListeners = new Set<
    (state: { players?: unknown; regionId?: string }) => void
  >();

  public reconnectionToken: string;

  public roomId: string;

  public send = vi.fn();

  public state: { players?: unknown; regionId?: string };

  public leave = vi.fn(async () => 1000);

  public constructor(
    name: string,
    roomId: string,
    regionId: string,
    players: Record<string, unknown>,
  ) {
    this.name = name;
    this.reconnectionToken = `${roomId}:reconnect-token`;
    this.roomId = roomId;
    this.state = {
      players,
      regionId,
    };
  }

  onError(callback: (code: number, message?: string) => void): void {
    this.onErrorListeners.add(callback);
  }

  onLeave(callback: (code: number, reason?: string) => void): void {
    this.onLeaveListeners.add(callback);
  }

  onStateChange(callback: (state: { players?: unknown; regionId?: string }) => void): void {
    this.onStateChangeListeners.add(callback);
  }

  emitLeave(code: number, reason?: string): void {
    for (const listener of this.onLeaveListeners) {
      listener(code, reason);
    }
  }

  emitState(state: { players: Record<string, unknown>; regionId: string }): void {
    this.state = state;

    for (const listener of this.onStateChangeListeners) {
      listener(state);
    }
  }
}

describe('colyseus service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('connects to the room matching the player region and mirrors state players', async () => {
    const joinedRoom = new FakeRoom('room_centro', 'room-1', RegionId.Centro, {
      session_1: {
        animation: 'idle_s',
        nickname: 'Player_01',
        playerId: 'player-1',
        regionId: RegionId.Centro,
        title: 'pivete',
        vocation: 'soldado',
        x: 102,
        y: 96,
      },
    });
    const fakeClient = {
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(),
    };
    const service = new ColyseusService(() => fakeClient);

    await service.connectToRegionRoom({
      accessToken: 'access-token',
      regionId: RegionId.Centro,
    });

    expect(fakeClient.joinOrCreate).toHaveBeenCalledWith('room_centro', {
      accessToken: 'access-token',
      regionId: RegionId.Centro,
    });
    expect(service.getSnapshot()).toMatchObject({
      players: [
        {
          nickname: 'Player_01',
          playerId: 'player-1',
        },
      ],
      roomId: 'room-1',
      roomName: 'room_centro',
      status: 'connected',
    });

    joinedRoom.emitState({
      players: {
        session_1: {
          animation: 'walk_e',
          nickname: 'Player_01',
          playerId: 'player-1',
          regionId: RegionId.Centro,
          title: 'pivete',
          vocation: 'soldado',
          x: 140,
          y: 118,
        },
      },
      regionId: RegionId.Centro,
    });

    expect(service.getSnapshot().players[0]).toMatchObject({
      animation: 'walk_e',
      x: 140,
      y: 118,
    });
  });

  it('tries to reconnect automatically after an unexpected leave', async () => {
    const joinedRoom = new FakeRoom('room_centro', 'room-1', RegionId.Centro, {});
    const reconnectedRoom = new FakeRoom('room_centro', 'room-1', RegionId.Centro, {});
    const fakeClient = {
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(async () => reconnectedRoom),
    };
    const service = new ColyseusService(() => fakeClient);

    await service.connectToRegionRoom({
      accessToken: 'access-token',
      regionId: RegionId.Centro,
    });

    joinedRoom.emitLeave(4001, 'network');
    await vi.advanceTimersByTimeAsync(500);

    expect(fakeClient.reconnect).toHaveBeenCalledWith(joinedRoom.reconnectionToken);
    expect(service.getSnapshot().status).toBe('connected');
  });

  it('throttles local movement updates to one send per 100ms window', async () => {
    const joinedRoom = new FakeRoom('room_centro', 'room-1', RegionId.Centro, {});
    const service = new ColyseusService(() => ({
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(),
    }));

    await service.connectToRegionRoom({
      accessToken: 'access-token',
      regionId: RegionId.Centro,
    });

    service.sendPlayerMove({
      animation: 'walk_e',
      x: 102.12,
      y: 96.34,
    });
    service.sendPlayerMove({
      animation: 'walk_e',
      x: 103.12,
      y: 96.34,
    });

    expect(joinedRoom.send).toHaveBeenCalledTimes(1);
    expect(joinedRoom.send).toHaveBeenCalledWith(REALTIME_MESSAGE_PLAYER_MOVE, {
      animation: 'walk_e',
      x: 102.12,
      y: 96.34,
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(joinedRoom.send).toHaveBeenCalledTimes(2);
    expect(joinedRoom.send).toHaveBeenLastCalledWith(REALTIME_MESSAGE_PLAYER_MOVE, {
      animation: 'walk_e',
      x: 103.12,
      y: 96.34,
    });
  });
});
