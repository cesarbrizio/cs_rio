import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, RegionId, VocationType } from '@cs-rio/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import {
  bocaOperations,
  frontStoreOperations,
  players,
  puteiroOperations,
  properties,
  raveOperations,
  slotMachineOperations,
  transactions,
} from '../src/db/schema.js';
import { DatabaseBocaRepository } from '../src/services/boca.js';
import { applyPlayerCombatDeltas } from '../src/services/financial-updates.js';
import { DatabaseFrontStoreRepository } from '../src/services/front-store.js';
import { DatabasePuteiroRepository } from '../src/services/puteiro.js';
import { DatabaseRaveRepository } from '../src/services/rave.js';
import { DatabaseSlotMachineRepository } from '../src/services/slot-machine.js';

const createdPlayerIds: string[] = [];
const createdPropertyIds: string[] = [];

afterEach(async () => {
  for (const propertyId of createdPropertyIds) {
    await db.delete(bocaOperations).where(eq(bocaOperations.propertyId, propertyId));
    await db.delete(frontStoreOperations).where(eq(frontStoreOperations.propertyId, propertyId));
    await db.delete(puteiroOperations).where(eq(puteiroOperations.propertyId, propertyId));
    await db.delete(properties).where(eq(properties.id, propertyId));
    await db.delete(raveOperations).where(eq(raveOperations.propertyId, propertyId));
    await db.delete(slotMachineOperations).where(eq(slotMachineOperations.propertyId, propertyId));
  }

  for (const playerId of createdPlayerIds) {
    await db.delete(transactions).where(eq(transactions.playerId, playerId));
    await db.delete(players).where(eq(players.id, playerId));
  }

  createdPropertyIds.length = 0;
  createdPlayerIds.length = 0;
});

describe('atomic player state and cash collection', () => {
  it('accumulates concurrent combat deltas without losing damage or conceito', async () => {
    const playerId = await createTestPlayer({
      cansaco: 100,
      conceito: 1000,
      hp: 100,
    });

    await Promise.all([
      applyPlayerCombatDeltas(db, playerId, {
        cansacoDelta: -15,
        conceitoDelta: 20,
        hpDelta: -40,
      }),
      applyPlayerCombatDeltas(db, playerId, {
        cansacoDelta: -20,
        conceitoDelta: 30,
        hpDelta: -60,
      }),
    ]);

    const [player] = await db
      .select({
        cansaco: players.cansaco,
        conceito: players.conceito,
        hp: players.hp,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    expect(player).toMatchObject({
      cansaco: 65,
      conceito: 1050,
      hp: 0,
    });
  });

  it('drains boca cashbox atomically so concurrent collects pay only once', async () => {
    const repository = new DatabaseBocaRepository();
    const playerId = await createTestPlayer({
      money: '1000.00',
    });
    const propertyId = await createTestProperty(playerId, 'boca');

    await db.insert(bocaOperations).values({
      cashBalance: '500.00',
      factionCommissionTotal: '0.00',
      grossRevenueTotal: '0.00',
      lastSaleAt: new Date('2026-03-16T20:00:00.000Z'),
      propertyId,
    });

    const [first, second] = await Promise.all([
      repository.collectCash(playerId, propertyId),
      repository.collectCash(playerId, propertyId),
    ]);

    expect([first, second].filter((entry) => entry !== null)).toHaveLength(1);

    const [player] = await db
      .select({
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const [operation] = await db
      .select({
        cashBalance: bocaOperations.cashBalance,
      })
      .from(bocaOperations)
      .where(eq(bocaOperations.propertyId, propertyId))
      .limit(1);

    expect(player?.money).toBe('1500.00');
    expect(operation?.cashBalance).toBe('0.00');
  });

  it('drains front-store cashbox atomically so concurrent collects credit bank only once', async () => {
    const repository = new DatabaseFrontStoreRepository();
    const playerId = await createTestPlayer({
      bankMoney: '200.00',
    });
    const propertyId = await createTestProperty(playerId, 'front_store');

    await db.insert(frontStoreOperations).values({
      cashBalance: '750.00',
      factionCommissionTotal: '0.00',
      grossRevenueTotal: '0.00',
      investigationsTotal: 0,
      lastRevenueAt: new Date('2026-03-16T20:00:00.000Z'),
      propertyId,
      storeKind: null,
      totalLaunderedClean: '0.00',
      totalSeizedAmount: '0.00',
    });

    const [first, second] = await Promise.all([
      repository.collectCash(playerId, propertyId),
      repository.collectCash(playerId, propertyId),
    ]);

    expect([first, second].filter((entry) => entry !== null)).toHaveLength(1);

    const [player] = await db
      .select({
        bankMoney: players.bankMoney,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const [operation] = await db
      .select({
        cashBalance: frontStoreOperations.cashBalance,
      })
      .from(frontStoreOperations)
      .where(eq(frontStoreOperations.propertyId, propertyId))
      .limit(1);

    expect(player?.bankMoney).toBe('950.00');
    expect(operation?.cashBalance).toBe('0.00');
  });

  it('drains puteiro cashbox atomically so concurrent collects pay only once', async () => {
    const repository = new DatabasePuteiroRepository();
    const playerId = await createTestPlayer({
      money: '1200.00',
    });
    const propertyId = await createTestProperty(playerId, 'puteiro');

    await db.insert(puteiroOperations).values({
      cashBalance: '620.00',
      factionCommissionTotal: '0.00',
      grossRevenueTotal: '0.00',
      lastRevenueAt: new Date('2026-03-16T20:00:00.000Z'),
      propertyId,
      totalDeaths: 0,
      totalDstIncidents: 0,
      totalEscapes: 0,
    });

    const [first, second] = await Promise.all([
      repository.collectCash(playerId, propertyId),
      repository.collectCash(playerId, propertyId),
    ]);

    expect([first, second].filter((entry) => entry !== null)).toHaveLength(1);

    const [player] = await db
      .select({
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const [operation] = await db
      .select({
        cashBalance: puteiroOperations.cashBalance,
      })
      .from(puteiroOperations)
      .where(eq(puteiroOperations.propertyId, propertyId))
      .limit(1);

    expect(player?.money).toBe('1820.00');
    expect(operation?.cashBalance).toBe('0.00');
  });

  it('drains rave cashbox atomically so concurrent collects pay only once', async () => {
    const repository = new DatabaseRaveRepository();
    const playerId = await createTestPlayer({
      money: '900.00',
    });
    const propertyId = await createTestProperty(playerId, 'rave');

    await db.insert(raveOperations).values({
      cashBalance: '430.00',
      factionCommissionTotal: '0.00',
      grossRevenueTotal: '0.00',
      lastSaleAt: new Date('2026-03-16T20:00:00.000Z'),
      propertyId,
    });

    const [first, second] = await Promise.all([
      repository.collectCash(playerId, propertyId),
      repository.collectCash(playerId, propertyId),
    ]);

    expect([first, second].filter((entry) => entry !== null)).toHaveLength(1);

    const [player] = await db
      .select({
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const [operation] = await db
      .select({
        cashBalance: raveOperations.cashBalance,
      })
      .from(raveOperations)
      .where(eq(raveOperations.propertyId, propertyId))
      .limit(1);

    expect(player?.money).toBe('1330.00');
    expect(operation?.cashBalance).toBe('0.00');
  });

  it('drains slot-machine cashbox atomically so concurrent collects pay only once', async () => {
    const repository = new DatabaseSlotMachineRepository();
    const playerId = await createTestPlayer({
      money: '1500.00',
    });
    const propertyId = await createTestProperty(playerId, 'slot_machine');

    await db.insert(slotMachineOperations).values({
      cashBalance: '880.00',
      factionCommissionTotal: '0.00',
      grossRevenueTotal: '0.00',
      houseEdge: '0.2200',
      jackpotChance: '0.0100',
      lastPlayAt: new Date('2026-03-16T20:00:00.000Z'),
      machinesInstalled: 2,
      maxBet: '1000.00',
      minBet: '100.00',
      propertyId,
    });

    const [first, second] = await Promise.all([
      repository.collectCash(playerId, propertyId),
      repository.collectCash(playerId, propertyId),
    ]);

    expect([first, second].filter((entry) => entry !== null)).toHaveLength(1);

    const [player] = await db
      .select({
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const [operation] = await db
      .select({
        cashBalance: slotMachineOperations.cashBalance,
      })
      .from(slotMachineOperations)
      .where(eq(slotMachineOperations.propertyId, propertyId))
      .limit(1);

    expect(player?.money).toBe('2380.00');
    expect(operation?.cashBalance).toBe('0.00');
  });
});

async function createTestPlayer(
  overrides: Partial<{
    bankMoney: string;
    cansaco: number;
    conceito: number;
    hp: number;
    money: string;
  }> = {},
): Promise<string> {
  const id = randomUUID();

  await db.insert(players).values({
    appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
    bankInterestSyncedAt: new Date('2026-03-16T12:00:00.000Z'),
    bankMoney: overrides.bankMoney ?? '0.00',
    carisma: 15,
    characterCreatedAt: new Date('2026-03-16T12:00:00.000Z'),
    conceito: overrides.conceito ?? 5000,
    createdAt: new Date('2026-03-16T12:00:00.000Z'),
    email: `${id}@atomic.test`,
    factionId: null,
    forca: 15,
    hp: overrides.hp ?? 100,
    id,
    inteligencia: 15,
    lastLogin: new Date('2026-03-16T12:00:00.000Z'),
    money: overrides.money ?? '1000.00',
    brisa: 100,
    disposicao: 100,
    nickname: `atomic_${id.slice(0, 10)}`,
    passwordHash: 'test-hash',
    positionX: 0,
    positionY: 0,
    regionId: RegionId.Centro,
    resistencia: 15,
    cansaco: overrides.cansaco ?? 100,
    vocation: VocationType.Cria,
  });

  createdPlayerIds.push(id);
  return id;
}

async function createTestProperty(
  playerId: string,
  type: 'boca' | 'front_store' | 'puteiro' | 'rave' | 'slot_machine',
): Promise<string> {
  const id = randomUUID();

  await db.insert(properties).values({
    id,
    lastMaintenanceAt: new Date('2026-03-16T12:00:00.000Z'),
    playerId,
    regionId: RegionId.Centro,
    type,
  });

  createdPropertyIds.push(id);
  return id;
}
