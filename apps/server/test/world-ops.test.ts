import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import {
  bocaDrugStocks,
  bocaOperations,
  drugFactories,
  drugs,
  factionMembers,
  factions,
  favelas,
  frontStoreOperations,
  marketSystemOffers,
  players,
  properties,
  puteiroOperations,
  raveDrugLineups,
  raveOperations,
  round,
  slotMachineOperations,
  weapons,
  worldOperationLogs,
} from '../src/db/schema.js';
import { WorldOpsService } from '../src/services/world-ops.js';

class InMemoryKeyValueStore {
  async close(): Promise<void> {}

  async delete(key: string): Promise<void> {
    void key;
  }

  async get(key: string): Promise<string | null> {
    void key;
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    void key;
    void value;
  }
}

describe('WorldOpsService', () => {
  let createdBatchIds: string[];
  let createdDrugIds: string[];
  let createdFactionIds: string[];
  let createdFavelaIds: string[];
  let createdOfferCodes: string[];
  let createdPlayerIds: string[];
  let createdPropertyIds: string[];
  let createdWeaponIds: string[];
  let service: WorldOpsService;

  beforeEach(() => {
    createdBatchIds = [];
    createdDrugIds = [];
    createdFactionIds = [];
    createdFavelaIds = [];
    createdOfferCodes = [];
    createdPlayerIds = [];
    createdPropertyIds = [];
    createdWeaponIds = [];
    service = new WorldOpsService({
      keyValueStore: new InMemoryKeyValueStore(),
    });
  });

  afterEach(async () => {
    if (createdBatchIds.length > 0) {
      await db.delete(worldOperationLogs).where(inArray(worldOperationLogs.batchId, createdBatchIds));
    }

    if (createdPropertyIds.length > 0) {
      await db.delete(bocaDrugStocks).where(inArray(bocaDrugStocks.propertyId, createdPropertyIds));
      await db.delete(raveDrugLineups).where(inArray(raveDrugLineups.propertyId, createdPropertyIds));
      await db.delete(drugFactories).where(inArray(drugFactories.propertyId, createdPropertyIds));
      await db.delete(bocaOperations).where(inArray(bocaOperations.propertyId, createdPropertyIds));
      await db.delete(raveOperations).where(inArray(raveOperations.propertyId, createdPropertyIds));
      await db.delete(puteiroOperations).where(inArray(puteiroOperations.propertyId, createdPropertyIds));
      await db.delete(frontStoreOperations).where(inArray(frontStoreOperations.propertyId, createdPropertyIds));
      await db.delete(slotMachineOperations).where(inArray(slotMachineOperations.propertyId, createdPropertyIds));
      await db.delete(properties).where(inArray(properties.id, createdPropertyIds));
    }

    if (createdOfferCodes.length > 0) {
      await db.delete(marketSystemOffers).where(inArray(marketSystemOffers.code, createdOfferCodes));
    }

    if (createdWeaponIds.length > 0) {
      await db.delete(weapons).where(inArray(weapons.id, createdWeaponIds));
    }

    if (createdDrugIds.length > 0) {
      await db.delete(drugs).where(inArray(drugs.id, createdDrugIds));
    }

    if (createdPlayerIds.length > 0) {
      await db.delete(factionMembers).where(inArray(factionMembers.playerId, createdPlayerIds));
      await db.delete(players).where(inArray(players.id, createdPlayerIds));
    }

    if (createdFavelaIds.length > 0) {
      await db.delete(favelas).where(inArray(favelas.id, createdFavelaIds));
    }

    if (createdFactionIds.length > 0) {
      await db.delete(factionMembers).where(inArray(factionMembers.factionId, createdFactionIds));
      await db.delete(factions).where(inArray(factions.id, createdFactionIds));
    }

    await service.close();
  });

  it('applies faction operations with audit trail', async () => {
    const player = await createTestPlayer();
    const faction = await createTestFaction();

    const result = await service.applyCommands(
      { player: player.nickname },
      [
        { actor: 'vitest', operation: { type: 'join-faction', value: faction.abbreviation }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-rank', value: 'gerente' }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-faction-bank-money', value: 500_000 }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-faction-points', value: 2_500 }, origin: 'test' },
        {
          actor: 'vitest',
          operation: { type: 'set-faction-internal-satisfaction', value: 77 },
          origin: 'test',
        },
      ],
    );
    createdBatchIds.push(result.batchId);

    expect(result.applied).toHaveLength(5);
    expect(result.context.player?.factionId).toBe(faction.id);
    expect(result.context.faction?.bankMoney).toBe(500_000);
    expect(result.context.faction?.points).toBe(2_500);
    expect(result.context.faction?.internalSatisfaction).toBe(77);

    const [membership] = await db
      .select({ rank: factionMembers.rank })
      .from(factionMembers)
      .where(and(eq(factionMembers.playerId, player.id), eq(factionMembers.factionId, faction.id)))
      .limit(1);

    expect(membership?.rank).toBe('gerente');

    const logs = await db
      .select({ id: worldOperationLogs.id })
      .from(worldOperationLogs)
      .where(eq(worldOperationLogs.playerId, player.id));

    expect(logs).toHaveLength(5);

    const left = await service.applyCommands(
      { playerId: player.id },
      [{ actor: 'vitest', operation: { type: 'leave-faction' }, origin: 'test' }],
    );
    createdBatchIds.push(left.batchId);
    expect(left.context.player?.factionId).toBeNull();
  });

  it('applies territory operations to a favela', async () => {
    const faction = await createTestFaction();
    const favela = await createTestFavela();

    const result = await service.applyCommands(
      { factionCode: faction.abbreviation, favelaCode: favela.code },
      [
        { actor: 'vitest', operation: { type: 'set-favela-controller', value: faction.abbreviation }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-favela-state', value: 'at_war' }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-favela-satisfaction', value: 62 }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-bandits', value: 180 }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-max-soldiers', value: 55 }, origin: 'test' },
      ],
    );
    createdBatchIds.push(result.batchId);

    expect(result.context.favela?.controllingFactionId).toBe(faction.id);
    expect(result.context.favela?.satisfaction).toBe(62);
    expect(result.context.favela?.banditsActive).toBe(180);
    expect(result.context.favela?.maxSoldiers).toBe(55);
    expect(result.context.favela?.state).toBe('at_war');

    const neutralized = await service.applyCommands(
      { favelaCode: favela.code },
      [{ actor: 'vitest', operation: { type: 'neutralize-favela' }, origin: 'test' }],
    );
    createdBatchIds.push(neutralized.batchId);

    expect(neutralized.context.favela?.state).toBe('neutral');
    expect(neutralized.context.favela?.controllingFactionId).toBeNull();
  });

  it('grants and configures business properties', async () => {
    const player = await createTestPlayer();
    const favela = await createTestFavela();
    const drug = await createTestDrug();

    const bocaGrant = await service.applyCommands(
      { favelaCode: favela.code, playerId: player.id },
      [{ actor: 'vitest', operation: { type: 'grant-property', value: 'boca' }, origin: 'test' }],
    );
    createdBatchIds.push(bocaGrant.batchId);

    const bocaPropertyId = bocaGrant.context.property?.id;
    expect(bocaPropertyId).toBeTruthy();
    if (!bocaPropertyId) {
      return;
    }

    const bocaConfigured = await service.applyCommands(
      { propertyId: bocaPropertyId },
      [
        { actor: 'vitest', operation: { type: 'set-property-level', value: 3 }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-property-soldiers', value: 12 }, origin: 'test' },
        { actor: 'vitest', operation: { type: 'set-property-cash', value: 3_200 }, origin: 'test' },
        {
          actor: 'vitest',
          operation: { type: 'set-boca-stock', drugCodeOrId: drug.code, quantity: 15 },
          origin: 'test',
        },
      ],
    );
    createdBatchIds.push(bocaConfigured.batchId);

    expect(bocaConfigured.context.property?.level).toBe(3);
    expect(bocaConfigured.context.property?.soldiersCount).toBe(12);
    expect(bocaConfigured.context.property?.cashBalance).toBe(3_200);

    const [bocaStock] = await db
      .select({ quantity: bocaDrugStocks.quantity })
      .from(bocaDrugStocks)
      .where(and(eq(bocaDrugStocks.propertyId, bocaPropertyId), eq(bocaDrugStocks.drugId, drug.id)))
      .limit(1);

    expect(bocaStock?.quantity).toBe(15);

    const factoryGrant = await service.applyCommands(
      { favelaCode: favela.code, playerId: player.id },
      [{ actor: 'vitest', operation: { type: 'grant-property', value: 'factory' }, origin: 'test' }],
    );
    createdBatchIds.push(factoryGrant.batchId);

    const factoryPropertyId = factoryGrant.context.property?.id;
    expect(factoryPropertyId).toBeTruthy();
    if (!factoryPropertyId) {
      return;
    }

    const factoryConfigured = await service.applyCommands(
      { propertyId: factoryPropertyId },
      [{ actor: 'vitest', operation: { type: 'set-factory-output', value: 40 }, origin: 'test' }],
    );
    createdBatchIds.push(factoryConfigured.batchId);

    expect(factoryConfigured.context.property?.storedOutput).toBe(40);

    const raveGrant = await service.applyCommands(
      { favelaCode: favela.code, playerId: player.id },
      [{ actor: 'vitest', operation: { type: 'grant-property', value: 'rave' }, origin: 'test' }],
    );
    createdBatchIds.push(raveGrant.batchId);

    const ravePropertyId = raveGrant.context.property?.id;
    expect(ravePropertyId).toBeTruthy();
    if (!ravePropertyId) {
      return;
    }

    const raveConfigured = await service.applyCommands(
      { propertyId: ravePropertyId },
      [
        {
          actor: 'vitest',
          operation: { type: 'set-rave-stock', drugCodeOrId: drug.code, quantity: 9, priceMultiplier: 1.8 },
          origin: 'test',
        },
      ],
    );
    createdBatchIds.push(raveConfigured.batchId);

    const [raveLineup] = await db
      .select({
        priceMultiplier: raveDrugLineups.priceMultiplier,
        quantity: raveDrugLineups.quantity,
      })
      .from(raveDrugLineups)
      .where(and(eq(raveDrugLineups.propertyId, ravePropertyId), eq(raveDrugLineups.drugId, drug.id)))
      .limit(1);

    expect(raveLineup?.quantity).toBe(9);
    expect(Number.parseFloat(raveLineup?.priceMultiplier ?? '0')).toBeCloseTo(1.8, 2);
  });

  it('manages system market offers', async () => {
    const weapon = await createTestWeapon();
    const [activeRound] = await ensureActiveRound();
    const offerCode = `world-offer-${randomUUID()}`;

    createdOfferCodes.push(offerCode);

    await db.insert(marketSystemOffers).values({
      code: offerCode,
      isActive: true,
      itemId: weapon.id,
      itemType: 'weapon',
      label: 'Oferta de teste',
      lastRestockedGameDay: 0,
      lastRestockedRoundId: activeRound?.id ?? null,
      pricePerUnit: '999.00',
      restockAmount: 3,
      restockIntervalGameDays: 1,
      sortOrder: 999,
      stockAvailable: 2,
      stockMax: 5,
    });

    const cleared = await service.applyCommands({}, [{ actor: 'vitest', operation: { type: 'clear-market-offers' }, origin: 'test' }]);
    createdBatchIds.push(cleared.batchId);

    let [offer] = await db
      .select({
        isActive: marketSystemOffers.isActive,
        stockAvailable: marketSystemOffers.stockAvailable,
      })
      .from(marketSystemOffers)
      .where(eq(marketSystemOffers.code, offerCode))
      .limit(1);

    expect(offer?.stockAvailable).toBe(0);

    const restocked = await service.applyCommands(
      {},
      [{ actor: 'vitest', operation: { type: 'restock-system-offers' }, origin: 'test' }],
    );
    createdBatchIds.push(restocked.batchId);

    [offer] = await db
      .select({
        isActive: marketSystemOffers.isActive,
        stockAvailable: marketSystemOffers.stockAvailable,
      })
      .from(marketSystemOffers)
      .where(eq(marketSystemOffers.code, offerCode))
      .limit(1);

    expect(offer?.stockAvailable).toBe(5);
    expect(offer?.isActive).toBe(true);

    await db
      .update(marketSystemOffers)
      .set({
        isActive: false,
        stockAvailable: 1,
      })
      .where(eq(marketSystemOffers.code, offerCode));

    const seeded = await service.applyCommands({}, [{ actor: 'vitest', operation: { type: 'seed-market-offers' }, origin: 'test' }]);
    createdBatchIds.push(seeded.batchId);

    [offer] = await db
      .select({
        isActive: marketSystemOffers.isActive,
        stockAvailable: marketSystemOffers.stockAvailable,
      })
      .from(marketSystemOffers)
      .where(eq(marketSystemOffers.code, offerCode))
      .limit(1);

    expect(offer?.stockAvailable).toBe(5);
    expect(offer?.isActive).toBe(true);
  });

  async function createTestPlayer() {
    const nickname = `world-player-${randomUUID().slice(0, 8)}`;
    const [player] = await db
      .insert(players)
      .values({
        appearanceJson: {
          hair: 'corte_curto',
          outfit: 'camisa_branca',
          skin: 'pele_media',
        },
        characterCreatedAt: new Date('2026-03-13T00:00:00.000Z'),
        email: `${nickname}@example.com`,
        nickname,
        passwordHash: 'hash',
        regionId: 'centro',
        vocation: 'empreendedor',
      })
      .returning({
        email: players.email,
        id: players.id,
        nickname: players.nickname,
      });

    createdPlayerIds.push(player.id);
    return player;
  }

  async function createTestFaction() {
    const suffix = randomUUID().slice(0, 6).toUpperCase();
    const [faction] = await db
      .insert(factions)
      .values({
        abbreviation: `T${suffix.slice(0, 3)}`,
        description: 'Facção de teste',
        initialTerritory: 'Teste',
        isFixed: false,
        name: `Facção Teste ${suffix}`,
        sortOrder: 999,
        templateCode: `test_${suffix.toLowerCase()}`,
        thematicBonus: 'Bônus de teste',
      })
      .returning({
        abbreviation: factions.abbreviation,
        id: factions.id,
      });

    createdFactionIds.push(faction.id);
    return faction;
  }

  async function createTestFavela() {
    const suffix = randomUUID().slice(0, 8);
    const [favela] = await db
      .insert(favelas)
      .values({
        code: `favela_test_${suffix}`,
        difficulty: 4,
        name: `Favela Teste ${suffix}`,
        population: 4_000,
        regionId: 'zona_norte',
        sortOrder: 999,
      })
      .returning({
        code: favelas.code,
        id: favelas.id,
      });

    createdFavelaIds.push(favela.id);
    return favela;
  }

  async function createTestDrug() {
    const [drug] = await db
      .select({
        code: drugs.code,
        id: drugs.id,
      })
      .from(drugs)
      .limit(1);

    if (!drug) {
      throw new Error('Nenhuma droga seeded encontrada para o teste de world-ops.');
    }

    return drug;
  }

  async function createTestWeapon() {
    const suffix = randomUUID().slice(0, 8);
    const [weapon] = await db
      .insert(weapons)
      .values({
        code: `weapon_test_${suffix}`,
        durabilityMax: 100,
        levelRequired: 1,
        name: `Arma Teste ${suffix}`,
        power: 10,
        price: '100.00',
      })
      .returning({
        code: weapons.code,
        id: weapons.id,
      });

    createdWeaponIds.push(weapon.id);
    return weapon;
  }

  async function ensureActiveRound() {
    const rows = await db
      .select({
        id: round.id,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .limit(1);

    if (rows.length > 0) {
      return rows;
    }

    const [created] = await db
      .insert(round)
      .values({
        endsAt: new Date('2026-04-12T00:00:00.000Z'),
        number: 9999,
        startedAt: new Date('2026-03-13T00:00:00.000Z'),
        status: 'active',
      })
      .returning({
        id: round.id,
      });

    return [created];
  }
});
