import { randomUUID } from 'node:crypto';

import { and, eq, gt, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RegionId, VocationType } from '@cs-rio/shared';

import { db } from '../src/db/client.js';
import {
  bocaDrugStocks,
  bocaOperations,
  factionMembers,
  factions,
  favelas,
  playerInventory,
  playerOperationLogs,
  players,
  prisonRecords,
  properties,
  roundOperationLogs,
  vests,
  weapons,
  worldOperationLogs,
} from '../src/db/schema.js';
import { QUICK_PRESETS } from '../src/scripts/scenarios/index.js';
import { ScenarioOpsService } from '../src/services/scenario-ops.js';

describe('ScenarioOpsService', () => {
  let createdDrugIds: string[];
  let createdFactionIds: string[];
  let createdFavelaIds: string[];
  let createdPlayerIds: string[];
  let createdVestIds: string[];
  let createdWeaponIds: string[];
  let service: ScenarioOpsService;

  beforeEach(() => {
    createdDrugIds = [];
    createdFactionIds = [];
    createdFavelaIds = [];
    createdPlayerIds = [];
    createdVestIds = [];
    createdWeaponIds = [];
    service = new ScenarioOpsService();
  });

  afterEach(async () => {
    await db.delete(roundOperationLogs).where(eq(roundOperationLogs.actor, 'vitest-scenario'));
    await db.delete(worldOperationLogs).where(eq(worldOperationLogs.actor, 'vitest-scenario'));

    if (createdPlayerIds.length > 0) {
      const propertyRows = await db
        .select({ id: properties.id })
        .from(properties)
        .where(inArray(properties.playerId, createdPlayerIds));

      const propertyIds = propertyRows.map((entry) => entry.id);
      if (propertyIds.length > 0) {
        await db.delete(bocaDrugStocks).where(inArray(bocaDrugStocks.propertyId, propertyIds));
        await db.delete(bocaOperations).where(inArray(bocaOperations.propertyId, propertyIds));
        await db.delete(properties).where(inArray(properties.id, propertyIds));
      }

      await db.delete(playerOperationLogs).where(inArray(playerOperationLogs.playerId, createdPlayerIds));
      await db.delete(playerInventory).where(inArray(playerInventory.playerId, createdPlayerIds));
      await db.delete(prisonRecords).where(inArray(prisonRecords.playerId, createdPlayerIds));
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

    if (createdDrugIds.length > 0) {
      await db.delete(drugs).where(inArray(drugs.id, createdDrugIds));
    }

    if (createdVestIds.length > 0) {
      await db.delete(vests).where(inArray(vests.id, createdVestIds));
    }

    if (createdWeaponIds.length > 0) {
      await db.delete(weapons).where(inArray(weapons.id, createdWeaponIds));
    }

    await service.close();
  });

  it('aplica starter-pack com overrides de equipamento e região', async () => {
    const player = await createTestPlayer();
    const weapon = await createTestWeapon();
    const vest = await createTestVest();

    const result = await service.applyScenario({
      actor: 'vitest-scenario',
      name: 'starter-pack',
      origin: 'test',
      variables: {
        bankMoney: 22222,
        conceito: 777,
        level: 4,
        money: 11111,
        player: player.nickname,
        regionId: RegionId.ZonaNorte,
        vestCode: vest.code,
        weaponCode: weapon.code,
      },
    });

    expect(result.name).toBe('starter-pack');
    expect(result.appliedSteps).toHaveLength(1);
    expect(result.resolvedVariables.player).toBe(player.nickname);

    const [updatedPlayer] = await db
      .select({
        bankMoney: players.bankMoney,
        conceito: players.conceito,
        level: players.level,
        money: players.money,
        regionId: players.regionId,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(updatedPlayer?.regionId).toBe(RegionId.ZonaNorte);
    expect(Number(updatedPlayer?.money ?? 0)).toBe(11111);
    expect(Number(updatedPlayer?.bankMoney ?? 0)).toBe(22222);
    expect(updatedPlayer?.level).toBe(4);
    expect(updatedPlayer?.conceito).toBeGreaterThanOrEqual(777);

    const inventory = await db
      .select({
        equippedSlot: playerInventory.equippedSlot,
        itemId: playerInventory.itemId,
        itemType: playerInventory.itemType,
      })
      .from(playerInventory)
      .where(eq(playerInventory.playerId, player.id));

    expect(inventory.some((entry) => entry.itemType === 'weapon' && entry.equippedSlot === 'weapon')).toBe(true);
    expect(inventory.some((entry) => entry.itemType === 'vest' && entry.equippedSlot === 'vest')).toBe(true);
  });

  it('aplica territory-ready com facção, favela e droga temporárias', async () => {
    const player = await createTestPlayer();
    const faction = await createTestFaction();
    const favela = await createTestFavela();
    const weapon = await createTestWeapon();
    const vest = await createTestVest();

    const result = await service.applyScenario({
      actor: 'vitest-scenario',
      name: 'territory-ready',
      origin: 'test',
      variables: {
        bocaDrugCode: 'maconha',
        factionCode: faction.id,
        favelaCode: favela.code,
        player: player.nickname,
        regionId: RegionId.ZonaNorte,
        vestCode: vest.code,
        weaponCode: weapon.code,
      },
    });

    expect(result.appliedSteps).toHaveLength(4);

    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(and(eq(factionMembers.playerId, player.id), eq(factionMembers.factionId, faction.id)))
      .limit(1);

    expect(membership?.rank).toBe('gerente');

    const [favelaRow] = await db
      .select({
        banditsActive: favelas.banditsActive,
        controllingFactionId: favelas.controllingFactionId,
        state: favelas.state,
      })
      .from(favelas)
      .where(eq(favelas.id, favela.id))
      .limit(1);

    expect(favelaRow?.controllingFactionId).toBe(faction.id);
    expect(favelaRow?.state).toBe('controlled');
    expect(favelaRow?.banditsActive).toBeGreaterThan(0);

    const [property] = await db
      .select({
        id: properties.id,
        level: properties.level,
        soldiersCount: properties.soldiersCount,
      })
      .from(properties)
      .where(and(eq(properties.playerId, player.id), eq(properties.favelaId, favela.id), eq(properties.type, 'boca')))
      .limit(1);

    expect(property?.level).toBeGreaterThanOrEqual(2);
    expect(property?.soldiersCount).toBeGreaterThanOrEqual(8);

    const [stock] = await db
      .select({ quantity: bocaDrugStocks.quantity })
      .from(bocaDrugStocks)
      .where(and(eq(bocaDrugStocks.propertyId, property?.id ?? ''), eq(bocaDrugStocks.drugId, '46cddb93-b8f7-4518-a1cf-7d15b18f06df')))
      .limit(1);

    expect(stock?.quantity).toBe(20);
  });

  it('aplica preset quick por invocation e limpa prisão/hospital', async () => {
    const player = await createTestPlayer();
    const now = new Date();

    await db
      .update(players)
      .set({
        regionId: RegionId.Baixada,
      })
      .where(eq(players.id, player.id));

    await db.insert(prisonRecords).values({
      playerId: player.id,
      reason: 'Teste de prisão para no-wait',
      sentencedAt: now,
      releaseAt: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const preset = QUICK_PRESETS['no-wait'];
    if (!preset) {
      throw new Error('Preset no-wait não encontrado.');
    }

    const result = await service.applyInvocation(preset, {
      actor: 'vitest-scenario',
      origin: 'test',
      variables: {
        player: player.nickname,
      },
    });

    expect(result.name).toBe('no-wait');
    expect(result.appliedSteps).toHaveLength(1);

    const [updatedPlayer] = await db
      .select({
        regionId: players.regionId,
        cansaco: players.cansaco,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    const activePrisons = await db
      .select({ id: prisonRecords.id })
      .from(prisonRecords)
      .where(and(eq(prisonRecords.playerId, player.id), gt(prisonRecords.releaseAt, new Date())));

    expect(activePrisons).toHaveLength(0);
    expect(updatedPlayer?.regionId).toBe(RegionId.Centro);
    expect(updatedPlayer?.cansaco).toBe(100);
  });

  async function createTestPlayer(): Promise<{ email: string; id: string; nickname: string }> {
    const id = randomUUID();
    const email = `scenario-player-${randomUUID()}@csrio.test`;
    const nickname = `scenario_${randomUUID().slice(0, 8)}`;
    await db.insert(players).values({
      characterCreatedAt: new Date('2026-03-13T12:00:00.000Z'),
      email,
      id,
      nickname,
      passwordHash: 'hash',
      regionId: RegionId.Centro,
      vocation: VocationType.Empreendedor,
    });
    createdPlayerIds.push(id);
    return { email, id, nickname };
  }

  async function createTestFaction(): Promise<{ abbreviation: string; id: string }> {
    const suffix = randomUUID().slice(0, 6).toUpperCase();
    const [faction] = await db
      .insert(factions)
      .values({
        abbreviation: `S${suffix.slice(0, 3)}`,
        description: 'Facção de cenário de teste',
        initialTerritory: 'Teste',
        isFixed: false,
        name: `Facção Scenario ${suffix}`,
        sortOrder: 999,
        templateCode: `scenario_${suffix.toLowerCase()}`,
        thematicBonus: 'Bônus de teste',
      })
      .returning({
        abbreviation: factions.abbreviation,
        id: factions.id,
      });

    createdFactionIds.push(faction.id);
    return faction;
  }

  async function createTestFavela(): Promise<{ code: string; id: string }> {
    const suffix = randomUUID().slice(0, 8);
    const [favela] = await db
      .insert(favelas)
      .values({
        code: `scenario_favela_${suffix}`,
        difficulty: 4,
        name: `Favela Scenario ${suffix}`,
        population: 4200,
        regionId: RegionId.ZonaNorte,
        sortOrder: 999,
      })
      .returning({
        code: favelas.code,
        id: favelas.id,
      });

    createdFavelaIds.push(favela.id);
    return favela;
  }

  async function createTestWeapon(): Promise<{ code: string; id: string }> {
    const id = randomUUID();
    const code = `scenario_weapon_${randomUUID().slice(0, 8)}`;
    await db.insert(weapons).values({
      code,
      durabilityMax: 120,
      id,
      levelRequired: 1,
      name: `Arma Scenario ${code}`,
      power: 12,
      price: '1000.00',
      weight: 1,
    });
    createdWeaponIds.push(id);
    return { code, id };
  }

  async function createTestVest(): Promise<{ code: string; id: string }> {
    const id = randomUUID();
    const code = `scenario_vest_${randomUUID().slice(0, 8)}`;
    await db.insert(vests).values({
      code,
      defense: 8,
      durabilityMax: 90,
      id,
      levelRequired: 1,
      name: `Colete Scenario ${code}`,
      price: '800.00',
      weight: 1,
    });
    createdVestIds.push(id);
    return { code, id };
  }
});
