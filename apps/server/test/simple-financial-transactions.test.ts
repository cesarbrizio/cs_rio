import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, RegionId, VocationType } from '@cs-rio/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { db } from '../src/db/client.js';
import { players, properties, trainingSessions, universityEnrollments } from '../src/db/schema.js';
import { DatabasePropertyRepository } from '../src/services/property.js';
import { DatabaseTrainingRepository } from '../src/services/training.js';
import { DatabaseUniversityRepository } from '../src/services/university.js';

const createdPlayerIds: string[] = [];

afterEach(async () => {
  if (createdPlayerIds.length === 0) {
    return;
  }

  for (const playerId of createdPlayerIds) {
    await db.delete(trainingSessions).where(eq(trainingSessions.playerId, playerId));
    await db.delete(universityEnrollments).where(eq(universityEnrollments.playerId, playerId));
    await db.delete(properties).where(eq(properties.playerId, playerId));
    await db.delete(players).where(eq(players.id, playerId));
  }

  createdPlayerIds.length = 0;
});

describe('simple financial transactions', () => {
  it('rolls back player debit when creating a training session fails after the update', async () => {
    const repository = new DatabaseTrainingRepository();
    const playerId = await createTestPlayer({
      money: '5000.00',
      cansaco: 100,
    });

    await expect(
      repository.createTrainingSession(playerId, {
        costMoney: 1200,
        costCansaco: 12,
        diminishingMultiplier: 1,
        endsAt: new Date('2026-03-14T16:00:00.000Z'),
        gains: {
          carisma: 1,
          forca: 2,
          inteligencia: 3,
          resistencia: 4,
        },
        startedAt: new Date('2026-03-14T15:00:00.000Z'),
        streakIndex: 0,
        type: 'invalid_training_type' as never,
      }),
    ).rejects.toThrow();

    const player = await getPlayerOrThrow(playerId);
    expect(player.money).toBe('5000.00');
    expect(player.cansaco).toBe(100);

    const sessions = await db.select().from(trainingSessions).where(eq(trainingSessions.playerId, playerId));
    expect(sessions).toHaveLength(0);
  });

  it('rolls back player debit when creating a university enrollment fails after the update', async () => {
    const repository = new DatabaseUniversityRepository();
    const playerId = await createTestPlayer({
      money: '7200.00',
    });

    await expect(
      repository.createEnrollment(playerId, {
        costMoney: 900,
        courseCode: 'invalid_course_code' as never,
        endsAt: new Date('2026-03-14T19:00:00.000Z'),
        startedAt: new Date('2026-03-14T15:00:00.000Z'),
      }),
    ).rejects.toThrow();

    const player = await getPlayerOrThrow(playerId);
    expect(player.money).toBe('7200.00');

    const enrollments = await db
      .select()
      .from(universityEnrollments)
      .where(eq(universityEnrollments.playerId, playerId));
    expect(enrollments).toHaveLength(0);
  });

  it('rolls back player debit when creating a property fails after the update', async () => {
    const repository = new DatabasePropertyRepository();
    const playerId = await createTestPlayer({
      money: '95000.00',
    });

    await expect(
      repository.createProperty({
        favelaId: null,
        playerId,
        regionId: 'invalid_region' as RegionId,
        startedAt: new Date('2026-03-14T15:00:00.000Z'),
        type: 'house',
      }),
    ).rejects.toThrow();

    const player = await getPlayerOrThrow(playerId);
    expect(player.money).toBe('95000.00');

    const ownedProperties = await db.select().from(properties).where(eq(properties.playerId, playerId));
    expect(ownedProperties).toHaveLength(0);
  });
});

async function createTestPlayer(
  overrides: Partial<{
    money: string;
    cansaco: number;
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
    brisa: 100,
    disposicao: 100,
    nickname: `tx_${id.slice(0, 10)}`,
    passwordHash: 'test-hash',
    positionX: 0,
    positionY: 0,
    regionId: RegionId.Centro,
    resistencia: 10,
    cansaco: overrides.cansaco ?? 100,
    vocation: VocationType.Cria,
  });

  createdPlayerIds.push(id);
  return id;
}

async function getPlayerOrThrow(playerId: string) {
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);

  if (!player) {
    throw new Error(`Player ${playerId} not found during test.`);
  }

  return player;
}
