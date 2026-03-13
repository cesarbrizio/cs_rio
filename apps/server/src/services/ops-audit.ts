import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  configOperationLogs,
  factions,
  favelas,
  playerOperationLogs,
  players,
  round,
  roundOperationLogs,
  worldOperationLogs,
} from '../db/schema.js';

export interface OpsAuditFilters {
  actor?: string;
  batchId?: string;
  command?: string;
  faction?: string;
  favela?: string;
  latest?: number;
  player?: string;
  roundId?: string;
  source?: 'config' | 'player' | 'round' | 'world';
}

export interface OpsAuditEntry {
  actor: string;
  batchId: string;
  createdAt: string;
  eventType: string | null;
  id: string;
  operationType: string;
  origin: string;
  round: null | {
    id: string;
    number: number | null;
  };
  source: 'config' | 'player' | 'round' | 'world';
  summary: string;
  target: {
    faction: string | null;
    favela: string | null;
    player: string | null;
  };
  targetType: string | null;
}

type RawAuditEntry = {
  actor: string;
  batchId: string;
  createdAt: Date;
  eventType: string | null;
  factionId: string | null;
  id: string;
  operationType: string;
  origin: string;
  playerId: string | null;
  roundId: string | null;
  source: 'config' | 'player' | 'round' | 'world';
  summary: string;
  targetType: string | null;
  favelaId: string | null;
};

export class OpsAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpsAuditError';
  }
}

export class OpsAuditService {
  async listEntries(filters: OpsAuditFilters = {}): Promise<OpsAuditEntry[]> {
    const latest = clampLatest(filters.latest);
    const [playerId, factionId, favelaId] = await Promise.all([
      filters.player ? resolvePlayerId(filters.player) : Promise.resolve<string | null>(null),
      filters.faction ? resolveFactionId(filters.faction) : Promise.resolve<string | null>(null),
      filters.favela ? resolveFavelaId(filters.favela) : Promise.resolve<string | null>(null),
    ]);

    const sources: Array<'config' | 'player' | 'round' | 'world'> = filters.source
      ? [filters.source]
      : ['player', 'world', 'round', 'config'];
    const queryLimit = Math.max(latest * 3, 50);

    const rows = (
      await Promise.all(
        sources.map((source) =>
          this.readSource(source, {
            actor: filters.actor,
            batchId: filters.batchId,
            command: filters.command,
            factionId,
            favelaId,
            limit: queryLimit,
            playerId,
            roundId: filters.roundId,
          }),
        ),
      )
    )
      .flat()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, latest);

    return hydrateAuditEntries(rows);
  }

  private async readSource(
    source: 'config' | 'player' | 'round' | 'world',
    filters: {
      actor?: string;
      batchId?: string;
      command?: string;
      factionId?: string | null;
      favelaId?: string | null;
      limit: number;
      playerId?: string | null;
      roundId?: string;
    },
  ): Promise<RawAuditEntry[]> {
    if (source === 'player') {
      const conditions = [];
      if (filters.actor) conditions.push(eq(playerOperationLogs.actor, filters.actor));
      if (filters.batchId) conditions.push(eq(playerOperationLogs.batchId, filters.batchId));
      if (filters.command) conditions.push(eq(playerOperationLogs.origin, filters.command));
      if (filters.playerId) conditions.push(eq(playerOperationLogs.playerId, filters.playerId));

      return db
        .select({
          actor: playerOperationLogs.actor,
          batchId: playerOperationLogs.batchId,
          createdAt: playerOperationLogs.createdAt,
          eventType: sql<string | null>`null`,
          factionId: players.factionId,
          favelaId: sql<string | null>`null`,
          id: playerOperationLogs.id,
          operationType: playerOperationLogs.operationType,
          origin: playerOperationLogs.origin,
          playerId: playerOperationLogs.playerId,
          roundId: sql<string | null>`null`,
          summary: playerOperationLogs.summary,
          targetType: sql<string | null>`null`,
        })
        .from(playerOperationLogs)
        .leftJoin(players, eq(players.id, playerOperationLogs.playerId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(playerOperationLogs.createdAt))
        .limit(filters.limit)
        .then((entries) => entries.map((entry): RawAuditEntry => ({ ...entry, source: 'player' })));
    }

    if (source === 'world') {
      const conditions = [];
      if (filters.actor) conditions.push(eq(worldOperationLogs.actor, filters.actor));
      if (filters.batchId) conditions.push(eq(worldOperationLogs.batchId, filters.batchId));
      if (filters.command) conditions.push(eq(worldOperationLogs.origin, filters.command));
      if (filters.playerId) conditions.push(eq(worldOperationLogs.playerId, filters.playerId));
      if (filters.factionId) conditions.push(eq(worldOperationLogs.factionId, filters.factionId));
      if (filters.favelaId) conditions.push(eq(worldOperationLogs.favelaId, filters.favelaId));

      return db
        .select({
          actor: worldOperationLogs.actor,
          batchId: worldOperationLogs.batchId,
          createdAt: worldOperationLogs.createdAt,
          eventType: sql<string | null>`null`,
          factionId: worldOperationLogs.factionId,
          favelaId: worldOperationLogs.favelaId,
          id: worldOperationLogs.id,
          operationType: worldOperationLogs.operationType,
          origin: worldOperationLogs.origin,
          playerId: worldOperationLogs.playerId,
          roundId: sql<string | null>`null`,
          summary: worldOperationLogs.summary,
          targetType: worldOperationLogs.targetType,
        })
        .from(worldOperationLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(worldOperationLogs.createdAt))
        .limit(filters.limit)
        .then((entries) =>
          entries.map(
            (entry): RawAuditEntry => ({
              actor: entry.actor,
              batchId: entry.batchId,
              createdAt: entry.createdAt,
              eventType: entry.eventType,
              factionId: entry.factionId,
              favelaId: entry.favelaId,
              id: entry.id,
              operationType: entry.operationType,
              origin: entry.origin,
              playerId: entry.playerId,
              roundId: entry.roundId,
              source: 'world',
              summary: entry.summary,
              targetType: entry.targetType,
            }),
          ),
        );
    }

    if (source === 'round') {
      const conditions = [];
      if (filters.actor) conditions.push(eq(roundOperationLogs.actor, filters.actor));
      if (filters.batchId) conditions.push(eq(roundOperationLogs.batchId, filters.batchId));
      if (filters.command) conditions.push(eq(roundOperationLogs.origin, filters.command));
      if (filters.favelaId) conditions.push(eq(roundOperationLogs.favelaId, filters.favelaId));
      if (filters.roundId) conditions.push(eq(roundOperationLogs.roundId, filters.roundId));

      return db
        .select({
          actor: roundOperationLogs.actor,
          batchId: roundOperationLogs.batchId,
          createdAt: roundOperationLogs.createdAt,
          eventType: roundOperationLogs.eventType,
          factionId: sql<string | null>`null`,
          favelaId: roundOperationLogs.favelaId,
          id: roundOperationLogs.id,
          operationType: roundOperationLogs.operationType,
          origin: roundOperationLogs.origin,
          playerId: sql<string | null>`null`,
          roundId: roundOperationLogs.roundId,
          summary: roundOperationLogs.summary,
          targetType: sql<string | null>`null`,
        })
        .from(roundOperationLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(roundOperationLogs.createdAt))
        .limit(filters.limit)
        .then((entries) =>
          entries.map(
            (entry): RawAuditEntry => ({
              actor: entry.actor,
              batchId: entry.batchId,
              createdAt: entry.createdAt,
              eventType: entry.eventType,
              factionId: entry.factionId,
              favelaId: entry.favelaId,
              id: entry.id,
              operationType: entry.operationType,
              origin: entry.origin,
              playerId: entry.playerId,
              roundId: entry.roundId,
              source: 'round',
              summary: entry.summary,
              targetType: entry.targetType,
            }),
          ),
        );
    }

    const conditions = [];
    if (filters.actor) conditions.push(eq(configOperationLogs.actor, filters.actor));
    if (filters.batchId) conditions.push(eq(configOperationLogs.batchId, filters.batchId));
    if (filters.command) conditions.push(eq(configOperationLogs.origin, filters.command));
    if (filters.roundId) conditions.push(eq(configOperationLogs.roundId, filters.roundId));

    return db
      .select({
        actor: configOperationLogs.actor,
        batchId: configOperationLogs.batchId,
        createdAt: configOperationLogs.createdAt,
        eventType: sql<string | null>`null`,
        factionId: sql<string | null>`null`,
        favelaId: sql<string | null>`null`,
        id: configOperationLogs.id,
        operationType: configOperationLogs.operationType,
        origin: configOperationLogs.origin,
        playerId: sql<string | null>`null`,
        roundId: configOperationLogs.roundId,
        summary: configOperationLogs.summary,
        targetType: configOperationLogs.scope,
      })
      .from(configOperationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(configOperationLogs.createdAt))
      .limit(filters.limit)
      .then((entries) =>
        entries.map(
          (entry): RawAuditEntry => ({
            actor: entry.actor,
            batchId: entry.batchId,
            createdAt: entry.createdAt,
            eventType: entry.eventType,
            factionId: entry.factionId,
            favelaId: entry.favelaId,
            id: entry.id,
            operationType: entry.operationType,
            origin: entry.origin,
            playerId: entry.playerId,
            roundId: entry.roundId,
            source: 'config',
            summary: entry.summary,
            targetType: entry.targetType,
          }),
        ),
      );
  }
}

export function formatAuditLine(entry: OpsAuditEntry): string {
  const targets = [
    entry.target.player ? `player=${entry.target.player}` : null,
    entry.target.faction ? `faction=${entry.target.faction}` : null,
    entry.target.favela ? `favela=${entry.target.favela}` : null,
    entry.round ? `round=#${entry.round.number ?? '?'}:${entry.round.id.slice(0, 8)}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `[${entry.createdAt}] ${entry.source}.${entry.operationType} actor=${entry.actor} origin=${entry.origin} batch=${entry.batchId.slice(0, 8)}${targets ? ` ${targets}` : ''} :: ${entry.summary}`;
}

async function hydrateAuditEntries(rows: RawAuditEntry[]): Promise<OpsAuditEntry[]> {
  const playerIds = uniqueStrings(rows.map((entry) => entry.playerId));
  const factionIds = uniqueStrings(rows.map((entry) => entry.factionId));
  const favelaIds = uniqueStrings(rows.map((entry) => entry.favelaId));
  const roundIds = uniqueStrings(rows.map((entry) => entry.roundId));

  const [playerRows, factionRows, favelaRows, roundRows] = await Promise.all([
    playerIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: players.id, nickname: players.nickname })
          .from(players)
          .where(inArray(players.id, playerIds)),
    factionIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ abbreviation: factions.abbreviation, id: factions.id, name: factions.name })
          .from(factions)
          .where(inArray(factions.id, factionIds)),
    favelaIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ code: favelas.code, id: favelas.id, name: favelas.name })
          .from(favelas)
          .where(inArray(favelas.id, favelaIds)),
    roundIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: round.id, number: round.number })
          .from(round)
          .where(inArray(round.id, roundIds)),
  ]);

  const playerMap = new Map(playerRows.map((row) => [row.id, row.nickname]));
  const factionMap = new Map(factionRows.map((row) => [row.id, `${row.name} · ${row.abbreviation}`]));
  const favelaMap = new Map(favelaRows.map((row) => [row.id, `${row.name} (${row.code})`]));
  const roundMap = new Map(roundRows.map((row) => [row.id, row.number]));

  return rows.map((entry) => ({
    actor: entry.actor,
    batchId: entry.batchId,
    createdAt: entry.createdAt.toISOString(),
    eventType: entry.eventType,
    id: entry.id,
    operationType: entry.operationType,
    origin: entry.origin,
    round: entry.roundId
      ? {
          id: entry.roundId,
          number: roundMap.get(entry.roundId) ?? null,
        }
      : null,
    source: entry.source,
    summary: entry.summary,
    target: {
      faction: entry.factionId ? factionMap.get(entry.factionId) ?? entry.factionId : null,
      favela: entry.favelaId ? favelaMap.get(entry.favelaId) ?? entry.favelaId : null,
      player: entry.playerId ? playerMap.get(entry.playerId) ?? entry.playerId : null,
    },
    targetType: entry.targetType,
  }));
}

async function resolvePlayerId(selector: string): Promise<string | null> {
  if (selector.includes('@')) {
    const [byEmail] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.email, selector))
      .limit(1);
    return byEmail?.id ?? null;
  }

  if (looksLikeUuid(selector)) {
    const [byId] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, selector))
      .limit(1);
    if (byId) {
      return byId.id;
    }
  }

  const [row] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.nickname, selector))
    .limit(1);

  return row?.id ?? null;
}

async function resolveFactionId(selector: string): Promise<string | null> {
  if (looksLikeUuid(selector)) {
    const [byId] = await db
      .select({ id: factions.id })
      .from(factions)
      .where(eq(factions.id, selector))
      .limit(1);
    if (byId) {
      return byId.id;
    }
  }

  const [byAbbreviation] = await db
    .select({ id: factions.id })
    .from(factions)
    .where(eq(factions.abbreviation, selector.toUpperCase()))
    .limit(1);
  if (byAbbreviation) {
    return byAbbreviation.id;
  }

  const [byName] = await db.select({ id: factions.id }).from(factions).where(eq(factions.name, selector)).limit(1);
  return byName?.id ?? null;
}

async function resolveFavelaId(selector: string): Promise<string | null> {
  if (looksLikeUuid(selector)) {
    const [byId] = await db
      .select({ id: favelas.id })
      .from(favelas)
      .where(eq(favelas.id, selector))
      .limit(1);
    if (byId) {
      return byId.id;
    }
  }

  const [byCode] = await db.select({ id: favelas.id }).from(favelas).where(eq(favelas.code, selector)).limit(1);
  if (byCode) {
    return byCode.id;
  }

  const [byName] = await db.select({ id: favelas.id }).from(favelas).where(eq(favelas.name, selector)).limit(1);
  return byName?.id ?? null;
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function clampLatest(value: number | undefined): number {
  if (!value) {
    return 20;
  }
  return Math.max(1, Math.min(200, Math.trunc(value)));
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
