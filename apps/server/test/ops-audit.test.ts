import { randomUUID } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RegionId, VocationType } from '@cs-rio/shared';

import { db } from '../src/db/client.js';
import {
  configOperationLogs,
  factions,
  favelas,
  playerOperationLogs,
  players,
  round,
  roundOperationLogs,
  worldOperationLogs,
} from '../src/db/schema.js';
import { formatAuditLine, OpsAuditService } from '../src/services/ops-audit.js';

const TEST_ACTOR = 'ops_audit_vitest';

describe('OpsAuditService', () => {
  let createdFactionIds: string[];
  let createdFavelaIds: string[];
  let createdPlayerIds: string[];
  let createdRoundIds: string[];

  beforeEach(() => {
    createdFactionIds = [];
    createdFavelaIds = [];
    createdPlayerIds = [];
    createdRoundIds = [];
  });

  afterEach(async () => {
    await db.delete(configOperationLogs).where(eq(configOperationLogs.actor, TEST_ACTOR));
    await db.delete(roundOperationLogs).where(eq(roundOperationLogs.actor, TEST_ACTOR));
    await db.delete(worldOperationLogs).where(eq(worldOperationLogs.actor, TEST_ACTOR));
    await db.delete(playerOperationLogs).where(eq(playerOperationLogs.actor, TEST_ACTOR));

    if (createdRoundIds.length > 0) {
      await db.delete(round).where(inArray(round.id, createdRoundIds));
    }

    if (createdPlayerIds.length > 0) {
      await db.delete(players).where(inArray(players.id, createdPlayerIds));
    }

    if (createdFavelaIds.length > 0) {
      await db.delete(favelas).where(inArray(favelas.id, createdFavelaIds));
    }

    if (createdFactionIds.length > 0) {
      await db.delete(factions).where(inArray(factions.id, createdFactionIds));
    }
  });

  it('lists and hydrates audit entries across all supported sources', async () => {
    const faction = await createFaction();
    createdFactionIds.push(faction.id);
    const player = await createPlayer(faction.id);
    createdPlayerIds.push(player.id);
    const favela = await createFavela(faction.id);
    createdFavelaIds.push(favela.id);
    const activeRound = await createRound();
    createdRoundIds.push(activeRound.id);

    await db.insert(playerOperationLogs).values({
      actor: TEST_ACTOR,
      batchId: randomUUID(),
      operationType: 'set-money',
      origin: 'ops:player',
      playerId: player.id,
      summary: 'Dinheiro ajustado para playtest.',
    });

    await db.insert(worldOperationLogs).values({
      actor: TEST_ACTOR,
      batchId: randomUUID(),
      factionId: faction.id,
      favelaId: favela.id,
      operationType: 'set-favela-controller',
      origin: 'ops:world',
      playerId: player.id,
      summary: 'Favela transferida para facção de teste.',
      targetType: 'favela',
    });

    await db.insert(roundOperationLogs).values({
      actor: TEST_ACTOR,
      batchId: randomUUID(),
      eventType: 'navio_docas',
      operationType: 'trigger-event',
      origin: 'ops:round',
      roundId: activeRound.id,
      summary: 'Evento operacional disparado.',
    });

    await db.insert(configOperationLogs).values({
      actor: TEST_ACTOR,
      batchId: randomUUID(),
      key: 'economy.property_definition',
      operationType: 'upsert_set_entry',
      origin: 'ops:config',
      roundId: activeRound.id,
      scope: 'property_type',
      status: 'active',
      summary: 'Comissão da boca ajustada para a rodada.',
      targetKey: 'boca',
      valueJson: {
        factionCommissionRate: 0.18,
      },
    });

    const service = new OpsAuditService();
    const entries = await service.listEntries({
      actor: TEST_ACTOR,
      latest: 10,
    });

    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.source).sort()).toEqual(['config', 'player', 'round', 'world']);

    const worldEntry = entries.find((entry) => entry.source === 'world');
    expect(worldEntry).toMatchObject({
      target: {
        faction: `${faction.name} · ${faction.abbreviation}`,
        favela: `${favela.name} (${favela.code})`,
        player: player.nickname,
      },
    });

    const formatted = formatAuditLine(worldEntry!);
    expect(formatted).toContain('ops:world');
    expect(formatted).toContain(faction.abbreviation);
    expect(formatted).toContain(favela.code);
  });

  it('supports filtered lookup by player, faction, favela and source', async () => {
    const faction = await createFaction();
    createdFactionIds.push(faction.id);
    const player = await createPlayer(faction.id);
    createdPlayerIds.push(player.id);
    const favela = await createFavela(faction.id);
    createdFavelaIds.push(favela.id);

    await db.insert(worldOperationLogs).values({
      actor: TEST_ACTOR,
      batchId: randomUUID(),
      factionId: faction.id,
      favelaId: favela.id,
      operationType: 'set-bandits',
      origin: 'ops:world',
      playerId: player.id,
      summary: 'Bandidos ajustados para cenário.',
      targetType: 'favela',
    });

    const service = new OpsAuditService();
    const entries = await service.listEntries({
      faction: faction.abbreviation,
      favela: favela.code,
      latest: 5,
      player: player.nickname,
      source: 'world',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: 'world',
      target: {
        faction: `${faction.name} · ${faction.abbreviation}`,
        favela: `${favela.name} (${favela.code})`,
        player: player.nickname,
      },
    });
  });
});

async function createFaction() {
  const id = randomUUID();
  const abbreviation = `AT${id.slice(0, 6).toUpperCase()}`;
  const name = `Auditoria Teste ${id.slice(0, 8)}`;
  await db.insert(factions).values({
    abbreviation,
    id,
    name,
  });
  return {
    abbreviation,
    id,
    name,
  };
}

async function createPlayer(factionId: string | null) {
  const id = randomUUID();
  const nickname = `audit_${id.slice(0, 8)}`;
  await db.insert(players).values({
    characterCreatedAt: new Date('2026-03-13T00:00:00.000Z'),
    email: `${nickname}@test.local`,
    factionId,
    id,
    nickname,
    passwordHash: 'hash',
    regionId: RegionId.Centro,
    vocation: VocationType.Empreendedor,
  });
  return { id, nickname };
}

async function createFavela(controllingFactionId: string | null) {
  const id = randomUUID();
  const code = `audit_favela_${id.slice(0, 6)}`;
  const name = `Favela Teste ${id.slice(0, 6)}`;
  await db.insert(favelas).values({
    code,
    controllingFactionId,
    difficulty: 4,
    id,
    name,
    population: 4200,
    regionId: RegionId.Centro,
  });
  return { code, id, name };
}

async function createRound() {
  const id = randomUUID();
  await db.insert(round).values({
    endsAt: new Date('2026-03-20T00:00:00.000Z'),
    id,
    number: Number.parseInt(id.replace(/-/g, '').slice(0, 6), 16),
    startedAt: new Date('2026-03-13T00:00:00.000Z'),
    status: 'active',
  });
  return { id };
}
