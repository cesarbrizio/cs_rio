import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class FactionPresenceState extends Schema {
  @type('string') declare nickname: string;
  @type('string') declare playerId: string;
  @type('string') declare rank: string;
  @type('string') declare title: string;
  @type('string') declare vocation: string;
  @type('boolean') declare isLeader: boolean;
  @type('string') declare joinedAt: string;

  public constructor(input: Partial<FactionPresenceStateRecord> = {}) {
    super();
    this.nickname = input.nickname ?? '';
    this.playerId = input.playerId ?? '';
    this.rank = input.rank ?? 'cria';
    this.title = input.title ?? 'pivete';
    this.vocation = input.vocation ?? 'cria';
    this.isLeader = input.isLeader ?? false;
    this.joinedAt = input.joinedAt ?? new Date(0).toISOString();
  }
}

export class FactionChatEntryState extends Schema {
  @type('string') declare createdAt: string;
  @type('string') declare id: string;
  @type('string') declare kind: string;
  @type('string') declare message: string;
  @type('string') declare nickname: string;
  @type('string') declare playerId: string;

  public constructor(input: Partial<FactionChatEntryStateRecord> = {}) {
    super();
    this.createdAt = input.createdAt ?? new Date(0).toISOString();
    this.id = input.id ?? '';
    this.kind = input.kind ?? 'chat';
    this.message = input.message ?? '';
    this.nickname = input.nickname ?? '';
    this.playerId = input.playerId ?? '';
  }
}

export class FactionCoordinationState extends Schema {
  @type('string') declare createdAt: string;
  @type('string') declare id: string;
  @type('string') declare kind: string;
  @type('string') declare label: string;
  @type('string') declare nickname: string;
  @type('string') declare playerId: string;

  public constructor(input: Partial<FactionCoordinationStateRecord> = {}) {
    super();
    this.createdAt = input.createdAt ?? new Date(0).toISOString();
    this.id = input.id ?? '';
    this.kind = input.kind ?? 'gather';
    this.label = input.label ?? '';
    this.nickname = input.nickname ?? '';
    this.playerId = input.playerId ?? '';
  }
}

export class FactionState extends Schema {
  @type({ array: FactionChatEntryState }) declare chatMessages: ArraySchema<FactionChatEntryState>;
  @type({ array: FactionCoordinationState }) declare coordinationCalls: ArraySchema<FactionCoordinationState>;
  @type('string') declare factionAbbreviation: string;
  @type('string') declare factionId: string;
  @type('string') declare factionName: string;
  @type({ map: FactionPresenceState }) declare members: MapSchema<FactionPresenceState>;

  public constructor(input: Partial<FactionStateRecord> = {}) {
    super();
    this.chatMessages = new ArraySchema<FactionChatEntryState>();
    this.coordinationCalls = new ArraySchema<FactionCoordinationState>();
    this.factionAbbreviation = input.factionAbbreviation ?? '';
    this.factionId = input.factionId ?? '';
    this.factionName = input.factionName ?? '';
    this.members = new MapSchema<FactionPresenceState>();
  }
}

interface FactionPresenceStateRecord {
  isLeader: boolean;
  joinedAt: string;
  nickname: string;
  playerId: string;
  rank: string;
  title: string;
  vocation: string;
}

interface FactionChatEntryStateRecord {
  createdAt: string;
  id: string;
  kind: string;
  message: string;
  nickname: string;
  playerId: string;
}

interface FactionCoordinationStateRecord {
  createdAt: string;
  id: string;
  kind: string;
  label: string;
  nickname: string;
  playerId: string;
}

interface FactionStateRecord {
  factionAbbreviation: string;
  factionId: string;
  factionName: string;
}
