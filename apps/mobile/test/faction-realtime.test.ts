import {
  FACTION_REALTIME_MAX_LABEL_LENGTH,
  FACTION_REALTIME_MAX_MESSAGE_LENGTH,
  FACTION_REALTIME_ROOM_NAME,
  REALTIME_MESSAGE_FACTION_CHAT,
  REALTIME_MESSAGE_FACTION_COORDINATION,
} from '@cs-rio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  appEnv: {
    wsUrl: 'ws://127.0.0.1:2567',
  },
}));

import { FactionRealtimeService } from '../src/services/factionRealtime';

class FakeFactionRoom {
  public name: string;

  public onErrorListeners = new Set<(code: number, message?: string) => void>();

  public onLeaveListeners = new Set<(code: number, reason?: string) => void>();

  public onStateChangeListeners = new Set<(state: Record<string, unknown>) => void>();

  public reconnectionToken: string;

  public roomId: string;

  public send = vi.fn();

  public state: Record<string, unknown>;

  public leave = vi.fn(async () => 1000);

  public constructor(roomId: string, factionId: string) {
    this.name = FACTION_REALTIME_ROOM_NAME;
    this.reconnectionToken = `${roomId}:reconnect-token`;
    this.roomId = roomId;
    this.state = {
      chatMessages: [
        {
          createdAt: '2026-03-11T02:40:00.000Z',
          id: 'chat-1',
          kind: 'system',
          message: 'Sistema pronto.',
          nickname: 'Sistema',
          playerId: 'system',
        },
      ],
      coordinationCalls: [
        {
          createdAt: '2026-03-11T02:40:00.000Z',
          id: 'coord-1',
          kind: 'defend',
          label: 'Boca principal',
          nickname: 'Radar',
          playerId: 'player-2',
        },
      ],
      factionAbbreviation: 'CV',
      factionId,
      factionName: 'Comando Vermelho',
      members: {
        session_1: {
          isLeader: true,
          joinedAt: '2026-03-11T02:35:00.000Z',
          nickname: 'Chefe',
          playerId: 'player-1',
          rank: 'patrao',
          title: 'lider_da_faccao',
          vocation: 'politico',
        },
      },
    };
  }

  onError(callback: (code: number, message?: string) => void): void {
    this.onErrorListeners.add(callback);
  }

  onLeave(callback: (code: number, reason?: string) => void): void {
    this.onLeaveListeners.add(callback);
  }

  onStateChange(callback: (state: Record<string, unknown>) => void): void {
    this.onStateChangeListeners.add(callback);
  }
}

describe('faction realtime service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('connects to the faction room and mirrors roster, chat and coordination state', async () => {
    const joinedRoom = new FakeFactionRoom('faction-room-1', 'faction-1');
    const fakeClient = {
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(),
    };
    const service = new FactionRealtimeService(() => fakeClient);

    await service.connectToFactionRoom({
      accessToken: 'access-token',
      factionId: 'faction-1',
    });

    expect(fakeClient.joinOrCreate).toHaveBeenCalledWith(FACTION_REALTIME_ROOM_NAME, {
      accessToken: 'access-token',
      factionId: 'faction-1',
    });
    expect(service.getSnapshot()).toMatchObject({
      factionAbbreviation: 'CV',
      factionId: 'faction-1',
      factionName: 'Comando Vermelho',
      roomId: 'faction-room-1',
      roomName: FACTION_REALTIME_ROOM_NAME,
      status: 'connected',
    });
    expect(service.getSnapshot().members[0]).toMatchObject({
      nickname: 'Chefe',
      playerId: 'player-1',
      sessionId: 'session_1',
    });
    expect(service.getSnapshot().coordinationCalls[0]).toMatchObject({
      kind: 'defend',
      label: 'Boca principal',
    });
  });

  it('sends faction chat and coordination messages through the connected room', async () => {
    const joinedRoom = new FakeFactionRoom('faction-room-1', 'faction-1');
    const service = new FactionRealtimeService(() => ({
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(),
    }));

    await service.connectToFactionRoom({
      accessToken: 'access-token',
      factionId: 'faction-1',
    });

    service.sendChatMessage('Segura a entrada');
    service.sendCoordinationMessage({
      kind: 'attack',
      label: 'Morro do lado',
    });

    expect(joinedRoom.send).toHaveBeenNthCalledWith(1, REALTIME_MESSAGE_FACTION_CHAT, {
      message: 'Segura a entrada',
    });
    expect(joinedRoom.send).toHaveBeenNthCalledWith(2, REALTIME_MESSAGE_FACTION_COORDINATION, {
      kind: 'attack',
      label: 'Morro do lado',
    });
  });

  it('blocks outgoing faction messages that exceed the shared realtime limits', async () => {
    const joinedRoom = new FakeFactionRoom('faction-room-1', 'faction-1');
    const service = new FactionRealtimeService(() => ({
      joinOrCreate: vi.fn(async () => joinedRoom),
      reconnect: vi.fn(),
    }));

    await service.connectToFactionRoom({
      accessToken: 'access-token',
      factionId: 'faction-1',
    });

    service.sendChatMessage('x'.repeat(FACTION_REALTIME_MAX_MESSAGE_LENGTH + 1));
    service.sendCoordinationMessage({
      kind: 'attack',
      label: 'y'.repeat(FACTION_REALTIME_MAX_LABEL_LENGTH + 1),
    });

    expect(joinedRoom.send).not.toHaveBeenCalled();
  });
});
