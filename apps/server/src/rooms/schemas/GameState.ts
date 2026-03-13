import { MapSchema, Schema, type } from '@colyseus/schema';
import { type RegionId } from '@cs-rio/shared';

export class PlayerState extends Schema {
  @type('string') declare animation: string;
  @type('string') declare nickname: string;
  @type('string') declare playerId: string;
  @type('string') declare regionId: string;
  @type('string') declare title: string;
  @type('string') declare vocation: string;
  @type('number') declare x: number;
  @type('number') declare y: number;

  public constructor(input: Partial<PlayerStateRecord> = {}) {
    super();
    this.animation = input.animation ?? 'idle_s';
    this.nickname = input.nickname ?? '';
    this.playerId = input.playerId ?? '';
    this.regionId = input.regionId ?? 'centro';
    this.title = input.title ?? 'pivete';
    this.vocation = input.vocation ?? 'cria';
    this.x = input.x ?? 0;
    this.y = input.y ?? 0;
  }
}

export class NpcState extends Schema {
  @type('string') declare animation: string;
  @type('string') declare behavior: string;
  @type('string') declare id: string;
  @type('string') declare label: string;
  @type('number') declare x: number;
  @type('number') declare y: number;

  public constructor(input: Partial<NpcStateRecord> = {}) {
    super();
    this.animation = input.animation ?? 'idle_s';
    this.behavior = input.behavior ?? 'idle';
    this.id = input.id ?? '';
    this.label = input.label ?? '';
    this.x = input.x ?? 0;
    this.y = input.y ?? 0;
  }
}

export class WorldEntityState extends Schema {
  @type('string') declare animation: string;
  @type('string') declare id: string;
  @type('string') declare kind: string;
  @type('string') declare label: string;
  @type('number') declare x: number;
  @type('number') declare y: number;

  public constructor(input: Partial<WorldEntityStateRecord> = {}) {
    super();
    this.animation = input.animation ?? 'idle';
    this.id = input.id ?? '';
    this.kind = input.kind ?? '';
    this.label = input.label ?? '';
    this.x = input.x ?? 0;
    this.y = input.y ?? 0;
  }
}

export class GameState extends Schema {
  @type({ map: WorldEntityState }) declare entities: MapSchema<WorldEntityState>;
  @type({ map: NpcState }) declare npcs: MapSchema<NpcState>;
  @type({ map: PlayerState }) declare players: MapSchema<PlayerState>;
  @type('string') declare regionId: string;

  public constructor(regionId: RegionId | string = 'centro') {
    super();
    this.entities = new MapSchema<WorldEntityState>();
    this.npcs = new MapSchema<NpcState>();
    this.players = new MapSchema<PlayerState>();
    this.regionId = regionId;
  }
}

interface PlayerStateRecord {
  animation: string;
  nickname: string;
  playerId: string;
  regionId: string;
  title: string;
  vocation: string;
  x: number;
  y: number;
}

interface NpcStateRecord {
  animation: string;
  behavior: string;
  id: string;
  label: string;
  x: number;
  y: number;
}

interface WorldEntityStateRecord {
  animation: string;
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}
