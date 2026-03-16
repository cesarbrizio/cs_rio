import {
  FACTION_REALTIME_ROOM_NAME,
  REALTIME_MESSAGE_FACTION_CHAT,
  REALTIME_MESSAGE_FACTION_COORDINATION,
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  REALTIME_MESSAGE_PLAYER_MOVE,
  REGION_REALTIME_ROOM_NAMES,
  RegionId,
  VocationType,
  type PlayerProfile,
} from '@cs-rio/shared';
import { type Client } from 'colyseus';
import { describe, expect, it } from 'vitest';

import { createFactionRoom } from '../src/rooms/FactionRoom.js';
import {
  handleFactionChatMessage,
  handleFactionCoordinationMessage,
} from '../src/rooms/handlers/faction.js';
import { handlePlayerMoveMessage } from '../src/rooms/handlers/movement.js';
import { createGameRoom } from '../src/rooms/GameRoom.js';
import { FactionState, FactionPresenceState } from '../src/rooms/schemas/FactionState.js';
import { GameState, PlayerState } from '../src/rooms/schemas/GameState.js';
import { ServerConfigService } from '../src/services/server-config.js';

const baseProfile: PlayerProfile = {
  appearance: DEFAULT_CHARACTER_APPEARANCE,
  attributes: {
    carisma: 10,
    forca: 25,
    inteligencia: 20,
    resistencia: 15,
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
  properties: [],
  prison: DEFAULT_PLAYER_PRISON_STATUS,
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
  title: 'pivete',
  vocation: VocationType.Soldado,
};

const factionProfile: PlayerProfile = {
  ...baseProfile,
  faction: {
    abbreviation: 'CV',
    id: 'faction-1',
    name: 'Comando Vermelho',
    rank: 'general',
  },
};

describe('realtime rooms', () => {
  it('keeps one room definition per map region', async () => {
    const serverConfigService = new ServerConfigService({
      gameConfigService: {
        getResolvedCatalog: async () => ({
          activeRoundId: null,
          activeSet: null,
          entries: [],
          featureFlags: [],
        }),
      },
      worldDefinitionService: {
        async getDefaultSpawnRegion() {
          return null;
        },
        async getRegion() {
          return null;
        },
        async listActiveFavelas() {
          return [];
        },
        async listActiveRegions() {
          return [];
        },
        async listFixedFactionTemplates() {
          return [];
        },
      },
      runtimeStateRepository: {
        getVersion: async () => 0,
      },
    });
    const roomDefinitions = await serverConfigService.listRealtimeRoomDefinitions();

    expect(roomDefinitions).toHaveLength(6);
    expect(roomDefinitions[2]).toMatchObject({
      regionId: RegionId.Centro,
      roomName: REGION_REALTIME_ROOM_NAMES.centro,
    });
  });

  it('authenticates the player and mirrors the join into room state', async () => {
    const GameRoom = createGameRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: baseProfile.id,
        }),
      },
      playerService: {
        getFreshPlayerProfile: async () => baseProfile,
      },
    });
    const room = new GameRoom();

    room.onCreate({
      regionId: RegionId.Centro,
      roomName: REGION_REALTIME_ROOM_NAMES.centro,
    });

    const auth = await room.onAuth(
      {} as Client,
      {},
      {
        headers: new Headers(),
        ip: '127.0.0.1',
        token: 'access-token',
      },
    );
    const client = {
      auth,
      sessionId: 'session-1',
    } as unknown as Client;

    room.onJoin(client as never);

    expect(room.maxClients).toBe(100);
    expect(room.state.players.get('session-1')?.nickname).toBe('Player_01');
    expect(room.state.npcs.get(`${REGION_REALTIME_ROOM_NAMES.centro}:vigia`)?.label).toBe('Vigia');
    expect(room.state.entities.get(`${REGION_REALTIME_ROOM_NAMES.centro}:boca`)?.kind).toBe('boca');
  });

  it('accepts valid movement updates and rejects teleport attempts', () => {
    const state = new GameState(RegionId.Centro);
    const client = {
      sessionId: 'session-1',
      userData: {
        lastAcceptedMoveAt: 1_000,
        playerId: baseProfile.id,
      },
    } as unknown as Client<{
      userData: {
        lastAcceptedMoveAt: number;
        playerId: string;
      };
    }>;

    state.players.set(
      client.sessionId,
      new PlayerState({
        animation: 'idle_s',
        nickname: baseProfile.nickname,
        playerId: baseProfile.id,
        regionId: RegionId.Centro,
        title: baseProfile.title,
        vocation: baseProfile.vocation,
        x: 102,
        y: 96,
      }),
    );

    const accepted = handlePlayerMoveMessage({
      client,
      message: {
        animation: 'walk_e',
        x: 102.4,
        y: 96.2,
      },
      now: () => 1_100,
      room: { state },
    });
    const rejected = handlePlayerMoveMessage({
      client,
      message: {
        animation: 'walk_s',
        x: 160,
        y: 160,
      },
      now: () => 1_200,
      room: { state },
    });

    expect(REALTIME_MESSAGE_PLAYER_MOVE).toBe('player:move');
    expect(accepted).toBe(true);
    expect(rejected).toBe(false);
    expect(state.players.get(client.sessionId)).toMatchObject({
      animation: 'walk_e',
      x: 102.4,
      y: 96.2,
    });
  });

  it('rejects a player trying to enter a room from another region', async () => {
    const GameRoom = createGameRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: baseProfile.id,
        }),
      },
      playerService: {
        getFreshPlayerProfile: async () => ({
          ...baseProfile,
          location: {
            ...baseProfile.location,
            regionId: RegionId.ZonaNorte,
          },
          regionId: RegionId.ZonaNorte,
        }),
      },
    });
    const room = new GameRoom();

    room.onCreate({
      regionId: RegionId.Centro,
      roomName: REGION_REALTIME_ROOM_NAMES.centro,
    });

    await expect(
      room.onAuth(
        {} as Client,
        {},
        {
          headers: new Headers(),
          ip: '127.0.0.1',
          token: 'access-token',
        },
      ),
    ).rejects.toThrow('Jogador nao pertence a esta room de regiao.');
  });

  it('uses the fresh region snapshot for room auth instead of a stale cached profile', async () => {
    const playerService = {
      getFreshPlayerProfile: async () => ({
        ...baseProfile,
        location: {
          ...baseProfile.location,
          regionId: RegionId.ZonaNorte,
        },
        regionId: RegionId.ZonaNorte,
      }),
      getPlayerProfile: async () => baseProfile,
    } as const;
    const GameRoom = createGameRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: baseProfile.id,
        }),
      },
      playerService,
    });
    const room = new GameRoom();

    room.onCreate({
      regionId: RegionId.Centro,
      roomName: REGION_REALTIME_ROOM_NAMES.centro,
    });

    await expect(
      room.onAuth(
        {} as Client,
        {},
        {
          headers: new Headers(),
          ip: '127.0.0.1',
          token: 'access-token',
        },
      ),
    ).rejects.toThrow('Jogador nao pertence a esta room de regiao.');
  });

  it('authenticates a faction member and mirrors the join into faction room state', async () => {
    const FactionRoom = createFactionRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: factionProfile.id,
        }),
      },
      playerService: {
        getFreshPlayerProfile: async () => factionProfile,
      },
    });
    const room = new FactionRoom();

    room.onCreate({
      factionId: factionProfile.faction?.id ?? 'faction-1',
      roomName: FACTION_REALTIME_ROOM_NAME,
    });

    const auth = await room.onAuth(
      {} as Client,
      {
        factionId: factionProfile.faction?.id,
      },
      {
        headers: new Headers(),
        ip: '127.0.0.1',
        token: 'access-token',
      },
    );
    const client = {
      auth,
      sessionId: 'faction-session-1',
    } as unknown as Client;

    room.onJoin(client as never);

    expect(room.state.factionId).toBe('faction-1');
    expect(room.state.factionName).toBe('Comando Vermelho');
    expect(room.state.members.get('faction-session-1')).toMatchObject({
      nickname: 'Player_01',
      playerId: 'player-1',
      rank: 'general',
    });
    expect(room.state.chatMessages.at(-1)).toMatchObject({
      kind: 'system',
      message: 'Player_01 entrou no QG da faccao.',
    });
  });

  it('rejects joining a faction room when the player has no faction', async () => {
    const FactionRoom = createFactionRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: baseProfile.id,
        }),
      },
      playerService: {
        getFreshPlayerProfile: async () => baseProfile,
      },
    });
    const room = new FactionRoom();

    room.onCreate({
      factionId: 'faction-1',
      roomName: FACTION_REALTIME_ROOM_NAME,
    });

    await expect(
      room.onAuth(
        {} as Client,
        {
          factionId: 'faction-1',
        },
        {
          headers: new Headers(),
          ip: '127.0.0.1',
          token: 'access-token',
        },
      ),
    ).rejects.toThrow('Jogador nao pertence a nenhuma faccao.');
  });

  it('uses the fresh faction membership for room auth instead of a stale cached profile', async () => {
    const playerService = {
      getFreshPlayerProfile: async () => ({
        ...factionProfile,
        faction: {
          ...factionProfile.faction!,
          id: 'faction-2',
          name: 'Terceiro Comando',
        },
      }),
      getPlayerProfile: async () => factionProfile,
    } as const;
    const FactionRoom = createFactionRoom({
      authService: {
        verifyAccessToken: () => ({
          playerId: factionProfile.id,
        }),
      },
      playerService,
    });
    const room = new FactionRoom();

    room.onCreate({
      factionId: 'faction-1',
      roomName: FACTION_REALTIME_ROOM_NAME,
    });

    await expect(
      room.onAuth(
        {} as Client,
        {
          factionId: 'faction-1',
        },
        {
          headers: new Headers(),
          ip: '127.0.0.1',
          token: 'access-token',
        },
      ),
    ).rejects.toThrow('Jogador nao pertence a esta room de faccao.');
  });

  it('accepts faction chat and coordination messages for online members', () => {
    const state = new FactionState({
      factionAbbreviation: 'CV',
      factionId: 'faction-1',
      factionName: 'Comando Vermelho',
    });
    const client = {
      sessionId: 'faction-session-1',
    } as Client;

    state.members.set(
      'faction-session-1',
      new FactionPresenceState({
        isLeader: false,
        joinedAt: new Date('2026-03-11T15:00:00.000Z').toISOString(),
        nickname: 'Player_01',
        playerId: 'player-1',
        rank: 'general',
        title: 'pivete',
        vocation: VocationType.Soldado,
      }),
    );

    const chatAccepted = handleFactionChatMessage({
      client,
      message: {
        message: '  Segura a entrada da favela  ',
      },
      now: () => new Date('2026-03-11T15:01:00.000Z'),
      room: { state },
    });
    const coordinationAccepted = handleFactionCoordinationMessage({
      client,
      message: {
        kind: 'defend',
        label: 'Boca principal',
      },
      now: () => new Date('2026-03-11T15:01:05.000Z'),
      room: { state },
    });

    expect(REALTIME_MESSAGE_FACTION_CHAT).toBe('faction:chat');
    expect(REALTIME_MESSAGE_FACTION_COORDINATION).toBe('faction:coordination');
    expect(chatAccepted).toBe(true);
    expect(coordinationAccepted).toBe(true);
    expect(state.chatMessages.at(-1)).toMatchObject({
      kind: 'chat',
      message: 'Segura a entrada da favela',
      nickname: 'Player_01',
      playerId: 'player-1',
    });
    expect(state.coordinationCalls.at(-1)).toMatchObject({
      kind: 'defend',
      label: 'Boca principal',
      nickname: 'Player_01',
      playerId: 'player-1',
    });
  });
});
