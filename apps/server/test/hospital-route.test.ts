import { randomUUID } from 'node:crypto';

import { DEFAULT_CHARACTER_APPEARANCE, VocationType } from '@cs-rio/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { drugs, players } from '../src/db/schema.js';
import { HospitalService } from '../src/services/hospital.js';
import { DrugToleranceSystem } from '../src/systems/DrugToleranceSystem.js';
import { OverdoseSystem } from '../src/systems/OverdoseSystem.js';

describe('hospital routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let customHospitalService: HospitalService | null;

  beforeEach(async () => {
    customHospitalService = null;
    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (customHospitalService) {
      await customHospitalService.close?.();
      customHospitalService = null;
    }
  });

  it('returns the hospital center with service availability and stat offers', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      addiction: 20,
      credits: 12,
      hasDst: true,
      hp: 63,
      money: '60000.00',
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/hospital',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      player: {
        addiction: 20,
        credits: 12,
        hasDst: true,
        hp: 63,
      },
      services: {
        detox: {
          available: true,
          moneyCost: 0,
        },
        dstTreatment: {
          available: true,
          moneyCost: 5000,
        },
        healthPlan: {
          available: true,
          creditsCost: 10,
        },
        surgery: {
          available: true,
          creditsCost: 5,
        },
        treatment: {
          available: true,
          moneyCost: 2000,
        },
      },
    });
    expect(response.json().statItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          available: true,
          itemCode: 'cerebrina',
          remainingInCurrentCycle: 5,
        }),
      ]),
    );
  });

  it('inflates hospital NPC prices by round day in the center and treatment flow', async () => {
    await app.close();
    customHospitalService = new HospitalService({
      inflationReader: {
        getProfile: async () => ({
          currentRoundDay: 120,
          moneyMultiplier: 1.4,
          roundId: 'round-pre-alpha',
        }),
      },
    });
    app = await createApp({
      hospitalService: customHospitalService,
    });
    await app.ready();

    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      hp: 61,
      money: '7000.00',
    });

    const centerResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'GET',
      url: '/api/hospital',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().services.treatment.moneyCost).toBe(2800);

    const treatmentResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/treatment',
    });

    expect(treatmentResponse.statusCode).toBe(200);
    expect(treatmentResponse.json().player.money).toBe(4200);
  });

  it('heals HP and deducts money when treatment is purchased', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      hp: 61,
      money: '7000.00',
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/treatment',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      action: 'treatment',
      player: {
        hp: 100,
        money: 5000,
      },
    });
  });

  it('clears addiction and drug tolerances during detox', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      addiction: 45,
      conceito: 3,
      money: '5000.00',
    });

    const toleranceSystem = new DrugToleranceSystem();
    try {
      const [drugRow] = await db
        .select({
          id: drugs.id,
        })
        .from(drugs)
        .limit(1);

      expect(drugRow).toBeDefined();
      await toleranceSystem.recordUse(player.id, drugRow!.id, 25);
    } finally {
      await toleranceSystem.close();
    }

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/detox',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      action: 'detox',
      player: {
        addiction: 0,
        money: 4700,
      },
    });
    expect(response.json().services.detox.available).toBe(false);
  });

  it('updates nickname and appearance through surgery', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      credits: 10,
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: {
          hair: 'corte_longo',
          outfit: 'jaqueta_preta',
          skin: 'pele_escura',
        },
        nickname: `Novo_${randomUUID().slice(0, 5)}`,
      },
      url: '/api/hospital/surgery',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      action: 'surgery',
      player: {
        appearance: {
          hair: 'corte_longo',
          outfit: 'jaqueta_preta',
          skin: 'pele_escura',
        },
        credits: 5,
      },
    });
    expect(response.json().player.nickname).toMatch(/^Novo_/);
  });

  it('applies permanent stat items and enforces the cycle purchase cap', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      forca: 20,
      inteligencia: 40,
      money: '400000.00',
    });

    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        headers: {
          authorization: `Bearer ${player.accessToken}`,
        },
        method: 'POST',
        payload: {
          itemCode: 'deca_durabolin',
        },
        url: '/api/hospital/stat-items',
      });

      expect(response.statusCode).toBe(200);
    }

    const sixthResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      payload: {
        itemCode: 'deca_durabolin',
      },
      url: '/api/hospital/stat-items',
    });

    expect(sixthResponse.statusCode).toBe(409);

    const [playerRow] = await db
      .select({
        forca: players.forca,
        inteligencia: players.inteligencia,
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);

    expect(playerRow).toMatchObject({
      forca: 770,
      inteligencia: 0,
      money: '250000.00',
    });
  });

  it('treats DST and activates health plan for future hospitalizations', async () => {
    const player = await registerAndCreateCharacter();
    await updatePlayerState(player.id, {
      credits: 12,
      dstRecoversAt: new Date(Date.now() + 60 * 60 * 1000),
      hasDst: true,
      money: '10000.00',
    });

    const dstResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/dst-treatment',
    });

    expect(dstResponse.statusCode).toBe(200);
    expect(dstResponse.json()).toMatchObject({
      action: 'dst_treatment',
      player: {
        hasDst: false,
        money: 5000,
      },
    });

    const planResponse = await app.inject({
      headers: {
        authorization: `Bearer ${player.accessToken}`,
      },
      method: 'POST',
      url: '/api/hospital/health-plan',
    });

    expect(planResponse.statusCode).toBe(200);
    expect(planResponse.json()).toMatchObject({
      action: 'health_plan',
      player: {
        credits: 2,
        healthPlanActive: true,
      },
    });

    const overdoseSystem = new OverdoseSystem();

    try {
      const hospitalization = await overdoseSystem.hospitalize(player.id, {
        durationMs: 60 * 60 * 1000,
        reason: 'combat',
      });

      expect(hospitalization.isHospitalized).toBe(true);
      expect(hospitalization.remainingSeconds).toBeLessThanOrEqual(15 * 60);
      expect(hospitalization.remainingSeconds).toBeGreaterThan(10 * 60);
    } finally {
      await overdoseSystem.close();
    }
  });
});

async function registerAndCreateCharacter(): Promise<{ accessToken: string; id: string }> {
  const email = `player-${randomUUID()}@csrio.test`;
  const nickname = `P${randomUUID().slice(0, 8)}`;

  const registerApp = await createApp();
  await registerApp.ready();

  try {
    const registerResponse = await registerApp.inject({
      method: 'POST',
      payload: {
        email,
        nickname,
        password: 'segredo123',
      },
      url: '/api/auth/register',
    });
    const session = registerResponse.json();

    const createResponse = await registerApp.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
      payload: {
        appearance: DEFAULT_CHARACTER_APPEARANCE,
        vocation: VocationType.Soldado,
      },
      url: '/api/players/create',
    });

    expect(createResponse.statusCode).toBe(201);

    return {
      accessToken: session.accessToken,
      id: session.player.id,
    };
  } finally {
    await registerApp.close();
  }
}

async function updatePlayerState(
  playerId: string,
  input: Partial<{
    addiction: number;
    carisma: number;
    credits: number;
    dstRecoversAt: Date | null;
    forca: number;
    hasDst: boolean;
    hp: number;
    inteligencia: number;
    money: string;
  }> &
    Partial<{
      conceito: number;
      resistencia: number;
    }>,
): Promise<void> {
  await db.update(players).set(input).where(eq(players.id, playerId));
}
