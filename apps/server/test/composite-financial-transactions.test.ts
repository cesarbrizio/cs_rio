import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, RegionId, VocationType } from '@cs-rio/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import {
  factionBankLedger,
  factions,
  marketAuctions,
  playerInventory,
  players,
  transactions,
} from '../src/db/schema.js';
import { insertFactionBankLedgerEntry } from '../src/services/faction.js';
import { DatabaseMarketRepository } from '../src/services/market.js';

const createdFactionIds: string[] = [];
const createdInventoryIds: string[] = [];
const createdPlayerIds: string[] = [];

afterEach(async () => {
  for (const inventoryId of createdInventoryIds) {
    await db.delete(playerInventory).where(eq(playerInventory.id, inventoryId));
  }

  for (const playerId of createdPlayerIds) {
    await db.delete(marketAuctions).where(eq(marketAuctions.playerId, playerId));
    await db.delete(transactions).where(eq(transactions.playerId, playerId));
    await db.delete(playerInventory).where(eq(playerInventory.playerId, playerId));
    await db.delete(players).where(eq(players.id, playerId));
  }

  for (const factionId of createdFactionIds) {
    await db.delete(factionBankLedger).where(eq(factionBankLedger.factionId, factionId));
    await db.delete(factions).where(eq(factions.id, factionId));
  }

  createdFactionIds.length = 0;
  createdInventoryIds.length = 0;
  createdPlayerIds.length = 0;
});

describe('composite financial transactions', () => {
  it('rolls back faction treasury updates when the ledger insert fails inside the same transaction', async () => {
    const factionId = await createTestFaction({
      bankMoney: '1000.00',
    });

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(factions)
          .set({
            bankMoney: '700.00',
          })
          .where(eq(factions.id, factionId));

        await insertFactionBankLedgerEntry(tx as never, {
          balanceAfter: 700,
          commissionAmount: 0,
          createdAt: new Date('2026-03-14T18:00:00.000Z'),
          description: 'Teste de rollback do ledger composto.',
          entryType: 'withdrawal',
          factionId,
          grossAmount: 300,
          netAmount: 300,
          originType: 'invalid_origin' as never,
        });
      }),
    ).rejects.toThrow();

    const [faction] = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
    expect(faction?.bankMoney).toBe('1000.00');

    const ledgerEntries = await db
      .select()
      .from(factionBankLedger)
      .where(eq(factionBankLedger.factionId, factionId));
    expect(ledgerEntries).toHaveLength(0);
  });

  it('rolls back market balance reservation when the transaction ledger fails after the debit', async () => {
    const repository = new DatabaseMarketRepository();
    const playerId = await createTestPlayer({
      money: '2500.00',
    });

    await expect(
      repository.withTransaction(async (marketRepository) => {
        await marketRepository.adjustPlayerMoney(playerId, -500);
        await marketRepository.addTransaction({
          amount: -500,
          description: 'Reserva de saldo para teste de rollback composto.',
          playerId,
          type: `market_${'x'.repeat(81)}`,
        });
      }),
    ).rejects.toThrow();

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    expect(player?.money).toBe('2500.00');

    const ledgerRows = await db.select().from(transactions).where(eq(transactions.playerId, playerId));
    expect(ledgerRows).toHaveLength(0);
  });

  it('rolls back market inventory removal when auction creation fails after the item is removed', async () => {
    const repository = new DatabaseMarketRepository();
    const playerId = await createTestPlayer({
      money: '8000.00',
    });
    const inventoryItemId = await createTestInventoryItem(playerId);

    await expect(
      repository.withTransaction(async (marketRepository) => {
        await marketRepository.removeInventoryItem(playerId, inventoryItemId);
        await marketRepository.createAuction({
          buyoutPrice: null,
          durabilitySnapshot: 85,
          endsAt: new Date('2026-03-14T21:00:00.000Z'),
          itemId: randomUUID(),
          itemType: 'weapon',
          playerId,
          proficiencySnapshot: 0,
          quantity: 1,
          startingBid: 1500,
          status: 'invalid_status' as never,
        });
      }),
    ).rejects.toThrow();

    const [restoredInventoryItem] = await db
      .select()
      .from(playerInventory)
      .where(eq(playerInventory.id, inventoryItemId))
      .limit(1);
    expect(restoredInventoryItem?.playerId).toBe(playerId);

    const auctions = await db
      .select()
      .from(marketAuctions)
      .where(and(eq(marketAuctions.playerId, playerId), eq(marketAuctions.startingBid, '1500.00')));
    expect(auctions).toHaveLength(0);
  });
});

async function createTestFaction(
  overrides: Partial<{
    bankMoney: string;
  }> = {},
): Promise<string> {
  const id = randomUUID();

  await db.insert(factions).values({
    abbreviation: `F${id.slice(0, 4)}`,
    bankMoney: overrides.bankMoney ?? '0.00',
    description: 'Faccao de teste para rollback financeiro composto.',
    id,
    isActive: true,
    isFixed: false,
    name: `Faccao ${id.slice(0, 8)}`,
  });

  createdFactionIds.push(id);
  return id;
}

async function createTestInventoryItem(playerId: string): Promise<string> {
  const id = randomUUID();

  await db.insert(playerInventory).values({
    durability: 85,
    id,
    itemId: randomUUID(),
    itemType: 'weapon',
    playerId,
    proficiency: 0,
    quantity: 1,
  });

  createdInventoryIds.push(id);
  return id;
}

async function createTestPlayer(
  overrides: Partial<{
    money: string;
  }> = {},
): Promise<string> {
  const id = randomUUID();

  await db.insert(players).values({
    appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
    bankInterestSyncedAt: new Date('2026-03-14T12:00:00.000Z'),
    bankMoney: '0.00',
    carisma: 10,
    characterCreatedAt: new Date('2026-03-14T12:00:00.000Z'),
    conceito: 5000,
    createdAt: new Date('2026-03-14T12:00:00.000Z'),
    email: `${id}@test.local`,
    factionId: null,
    forca: 10,
    hp: 100,
    id,
    inteligencia: 10,
    lastLogin: new Date('2026-03-14T12:00:00.000Z'),
    money: overrides.money ?? '10000.00',
    morale: 100,
    nerve: 100,
    nickname: `ctx_${id.slice(0, 10)}`,
    passwordHash: 'test-hash',
    positionX: 0,
    positionY: 0,
    regionId: RegionId.Centro,
    resistencia: 10,
    stamina: 100,
    vocation: VocationType.Cria,
  });

  createdPlayerIds.push(id);
  return id;
}
