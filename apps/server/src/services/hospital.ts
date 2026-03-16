import {
  DEFAULT_CHARACTER_APPEARANCE,
  isValidAuthNickname,
  normalizeAuthNickname,
  type CharacterAppearance,
  type HospitalActionResponse,
  type HospitalCenterResponse,
  type HospitalServiceAvailability,
  type HospitalStatItemCode,
  type HospitalStatItemOffer,
  type HospitalStatPurchaseInput,
  type HospitalSurgeryInput,
} from '@cs-rio/shared';
import { and, eq, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { drugs, playerHospitalStatPurchases, players } from '../db/schema.js';
import { DomainError, inferDomainErrorCategory } from '../errors/domain-error.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { resolveHospitalCycleKey } from './hospital-cycle.js';
import {
  buildNpcInflationSummary,
  DatabaseNpcInflationReader,
  inflateNpcMoney,
  type NpcInflationProfile,
  type NpcInflationReaderContract,
} from './npc-inflation.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { DrugToleranceSystem } from '../systems/DrugToleranceSystem.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';

const HEALTH_PLAN_CREDITS_COST = 10;
const HOSPITAL_STAT_LIMIT_PER_CYCLE = 5;
const SURGERY_CREDITS_COST = 5;
const TREATMENT_COST_PER_10_HP = 500;

interface HospitalPlayerRecord {
  addiction: number;
  appearanceJson: CharacterAppearance;
  carisma: number;
  characterCreatedAt: Date | null;
  conceito: number;
  credits: number;
  forca: number;
  healthPlanCycleKey: string | null;
  hp: number;
  id: string;
  inteligencia: number;
  money: number;
  nickname: string;
  resistencia: number;
}

interface HospitalServiceOptions {
  drugToleranceSystem?: DrugToleranceSystem;
  inflationReader?: NpcInflationReaderContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  overdoseSystem?: OverdoseSystem;
}

export interface HospitalServiceContract {
  applyTreatment(playerId: string): Promise<HospitalActionResponse>;
  close?(): Promise<void>;
  detox(playerId: string): Promise<HospitalActionResponse>;
  getCenter(playerId: string): Promise<HospitalCenterResponse>;
  performSurgery(playerId: string, input: HospitalSurgeryInput): Promise<HospitalActionResponse>;
  purchaseHealthPlan(playerId: string): Promise<HospitalActionResponse>;
  purchaseStatItem(
    playerId: string,
    input: HospitalStatPurchaseInput,
  ): Promise<HospitalActionResponse>;
}

type HospitalErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'insufficient_resources'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export function hospitalError(code: HospitalErrorCode, message: string): DomainError {
  return new DomainError('hospital', code, inferDomainErrorCategory(code), message);
}

export class HospitalError extends DomainError {
  constructor(
    code: HospitalErrorCode,
    message: string,
  ) {
    super('hospital', code, inferDomainErrorCategory(code), message);
    this.name = 'HospitalError';
  }
}

const HOSPITAL_STAT_ITEMS: Record<
  HospitalStatItemCode,
  {
    applyToPlayer: (player: HospitalPlayerRecord) => Partial<
      Pick<HospitalPlayerRecord, 'carisma' | 'forca' | 'inteligencia' | 'resistencia'>
    >;
    costMoney: number;
    description: string;
    label: string;
  }
> = {
  cerebrina: {
    applyToPlayer: (player) => ({ inteligencia: player.inteligencia + 100 }),
    costMoney: 50_000,
    description: '+100 de Inteligência permanente.',
    label: 'Cerebrina',
  },
  creatina: {
    applyToPlayer: (player) => ({ resistencia: player.resistencia + 100 }),
    costMoney: 40_000,
    description: '+100 de Resistência permanente.',
    label: 'Creatina',
  },
  deca_durabolin: {
    applyToPlayer: (player) => ({
      forca: player.forca + 150,
      inteligencia: Math.max(0, player.inteligencia - 30),
    }),
    costMoney: 30_000,
    description: '+150 de Força permanente e -30 de Inteligência.',
    label: 'Deca-Durabolin',
  },
  pocao_carisma: {
    applyToPlayer: (player) => ({ carisma: player.carisma + 100 }),
    costMoney: 50_000,
    description: '+100 de Carisma permanente.',
    label: 'Poção do Carisma',
  },
};

export class HospitalService implements HospitalServiceContract {
  private readonly drugToleranceSystem: DrugToleranceSystem;

  private readonly inflationReader: NpcInflationReaderContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly overdoseSystem: OverdoseSystem;

  private readonly ownsDrugToleranceSystem: boolean;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsOverdoseSystem: boolean;

  constructor(options: HospitalServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.inflationReader = options.inflationReader ?? new DatabaseNpcInflationReader(this.now);
    this.ownsDrugToleranceSystem = !options.drugToleranceSystem;
    this.drugToleranceSystem =
      options.drugToleranceSystem ??
      new DrugToleranceSystem({
        keyValueStore: this.keyValueStore,
      });
    this.ownsOverdoseSystem = !options.overdoseSystem;
    this.overdoseSystem =
      options.overdoseSystem ??
      new OverdoseSystem({
        keyValueStore: this.keyValueStore,
      });
  }

  async close(): Promise<void> {
    if (this.ownsDrugToleranceSystem) {
      await this.drugToleranceSystem.close?.();
    }

    if (this.ownsOverdoseSystem) {
      await this.overdoseSystem.close?.();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getCenter(playerId: string): Promise<HospitalCenterResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const cycleKey = resolveHospitalCycleKey(this.now());
    const [hospitalization, inflationProfile, drugIds, purchaseRows] = await Promise.all([
      this.overdoseSystem.getHospitalizationStatus(playerId),
      this.inflationReader.getProfile(),
      this.getAllDrugIds(),
      db
        .select({
          itemCode: playerHospitalStatPurchases.itemCode,
          quantity: playerHospitalStatPurchases.quantity,
        })
        .from(playerHospitalStatPurchases)
        .where(
          and(
            eq(playerHospitalStatPurchases.playerId, playerId),
            eq(playerHospitalStatPurchases.cycleKey, cycleKey),
          ),
        ),
    ]);

    const toleranceInfo = await this.readToleranceSummary(playerId, drugIds);
    const purchases = new Map(
      purchaseRows.map((row) => [row.itemCode as HospitalStatItemCode, row.quantity]),
    );
    const treatmentCost = inflateNpcMoney(resolveTreatmentCost(player.hp), inflationProfile);
    const detoxCost = inflateNpcMoney(resolveDetoxCost(player.conceito), inflationProfile);
    const healthPlanActive = player.healthPlanCycleKey === cycleKey;

    return {
      currentCycleKey: cycleKey,
      hospitalization,
      npcInflation: buildNpcInflationSummary(inflationProfile),
      player: {
        addiction: player.addiction,
        appearance: player.appearanceJson ?? DEFAULT_CHARACTER_APPEARANCE,
        credits: player.credits,
        healthPlanActive,
        healthPlanCycleKey: healthPlanActive ? cycleKey : null,
        hp: player.hp,
        money: player.money,
        nickname: player.nickname,
      },
      services: {
        detox:
          player.addiction > 0 || toleranceInfo.hasTolerance
            ? serviceAvailability({
                available: player.money >= detoxCost,
                moneyCost: detoxCost,
                reason:
                  player.money >= detoxCost
                    ? null
                    : 'Dinheiro insuficiente para desintoxicação.',
              })
            : unavailableService('Nenhum vício ou tolerância relevante para tratar.'),
        healthPlan: healthPlanActive
          ? unavailableService('Plano de saúde já ativo neste ciclo.', HEALTH_PLAN_CREDITS_COST, null)
          : serviceAvailability({
              available: player.credits >= HEALTH_PLAN_CREDITS_COST,
              creditsCost: HEALTH_PLAN_CREDITS_COST,
              reason:
                player.credits >= HEALTH_PLAN_CREDITS_COST
                  ? null
                  : 'Créditos insuficientes para o plano de saúde.',
            }),
        surgery: serviceAvailability({
          available: player.credits >= SURGERY_CREDITS_COST,
          creditsCost: SURGERY_CREDITS_COST,
          reason:
            player.credits >= SURGERY_CREDITS_COST
              ? null
              : 'Créditos insuficientes para a cirurgia plástica.',
        }),
        treatment:
          player.hp < 100
            ? serviceAvailability({
                available: player.money >= treatmentCost,
                moneyCost: treatmentCost,
                reason:
                  player.money >= treatmentCost
                    ? null
                    : 'Dinheiro insuficiente para tratamento.',
              })
            : unavailableService('Vida cheia, nenhum tratamento necessário.'),
      },
      statItems: buildStatOffers({
        currentMoney: player.money,
        inflationProfile,
        purchases,
      }),
    };
  }

  async applyTreatment(playerId: string): Promise<HospitalActionResponse> {
    const player = await this.requireReadyPlayer(playerId);

    if (player.hp >= 100) {
      throw new HospitalError('conflict', 'Vida já está cheia.');
    }

    const treatmentCost = inflateNpcMoney(resolveTreatmentCost(player.hp), await this.inflationReader.getProfile());

    if (player.money < treatmentCost) {
      throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para tratamento.');
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(players)
        .set({
          hp: 100,
          money: sql`round((${players.money} - ${treatmentCost})::numeric, 2)`,
        })
        .where(
          and(
            eq(players.id, playerId),
            sql`(${players.money} - ${treatmentCost}) >= 0`,
          ),
        )
        .returning({
          id: players.id,
        });

      if (!updated) {
        throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para tratamento.');
      }
    });

    return this.buildActionResponse(playerId, {
      action: 'treatment',
      message: 'Tratamento concluído. Sua vida foi restaurada.',
    });
  }

  async detox(playerId: string): Promise<HospitalActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const drugIds = await this.getAllDrugIds();
    const toleranceInfo = await this.readToleranceSummary(playerId, drugIds);

    if (player.addiction <= 0 && !toleranceInfo.hasTolerance) {
      throw new HospitalError('conflict', 'Nenhum vício ou tolerância relevante para tratar.');
    }

    const detoxCost = inflateNpcMoney(resolveDetoxCost(player.conceito), await this.inflationReader.getProfile());

    if (player.money < detoxCost) {
      throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para desintoxicação.');
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(players)
        .set({
          addiction: 0,
          money: sql`round((${players.money} - ${detoxCost})::numeric, 2)`,
        })
        .where(
          and(
            eq(players.id, playerId),
            sql`(${players.money} - ${detoxCost}) >= 0`,
          ),
        )
        .returning({
          id: players.id,
        });

      if (!updated) {
        throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para desintoxicação.');
      }
    });

    await Promise.all([
      ...drugIds.map((drugId) => this.drugToleranceSystem.clear(playerId, drugId)),
      this.overdoseSystem.clearRecentDrugUse(playerId),
    ]);

    return this.buildActionResponse(playerId, {
      action: 'detox',
      message: 'Desintoxicação concluída. Vício e tolerâncias foram zerados.',
    });
  }

  async performSurgery(playerId: string, input: HospitalSurgeryInput): Promise<HospitalActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const nextNickname = input.nickname ? validateNickname(input.nickname) : player.nickname;
    const nextAppearance = input.appearance
      ? sanitizeAppearance(input.appearance)
      : player.appearanceJson ?? DEFAULT_CHARACTER_APPEARANCE;

    if (!input.nickname && !input.appearance) {
      throw new HospitalError('validation', 'Informe nickname ou aparência para a cirurgia.');
    }

    if (player.credits < SURGERY_CREDITS_COST) {
      throw new HospitalError('insufficient_resources', 'Créditos insuficientes para a cirurgia.');
    }

    await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({
          id: players.id,
        })
        .from(players)
        .where(eq(players.nickname, nextNickname))
        .limit(1);

      if (owner && owner.id !== playerId) {
        throw new HospitalError('conflict', 'Este nickname já está em uso.');
      }

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          appearanceJson: nextAppearance,
          credits: sql`${players.credits} - ${SURGERY_CREDITS_COST}`,
          nickname: nextNickname,
        })
        .where(
          and(
            eq(players.id, playerId),
            sql`${players.credits} >= ${SURGERY_CREDITS_COST}`,
          ),
        )
        .returning({
          id: players.id,
        });

      if (!updatedPlayer) {
        throw new HospitalError('insufficient_resources', 'Créditos insuficientes para a cirurgia.');
      }
    });

    return this.buildActionResponse(playerId, {
      action: 'surgery',
      message: 'Cirurgia concluída. Seu visual foi atualizado.',
    });
  }

  async purchaseHealthPlan(playerId: string): Promise<HospitalActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const cycleKey = resolveHospitalCycleKey(this.now());

    if (player.healthPlanCycleKey === cycleKey) {
      throw new HospitalError('conflict', 'Plano de saúde já ativo neste ciclo.');
    }

    if (player.credits < HEALTH_PLAN_CREDITS_COST) {
      throw new HospitalError('insufficient_resources', 'Créditos insuficientes para o plano de saúde.');
    }

    await db.transaction(async (tx) => {
      const [updatedPlayer] = await tx
        .update(players)
        .set({
          credits: sql`${players.credits} - ${HEALTH_PLAN_CREDITS_COST}`,
          healthPlanCycleKey: cycleKey,
        })
        .where(
          and(
            eq(players.id, playerId),
            sql`${players.credits} >= ${HEALTH_PLAN_CREDITS_COST}`,
            sql`coalesce(${players.healthPlanCycleKey}, '') <> ${cycleKey}`,
          ),
        )
        .returning({
          credits: players.credits,
          healthPlanCycleKey: players.healthPlanCycleKey,
          id: players.id,
        });

      if (updatedPlayer) {
        return;
      }

      const [currentPlayer] = await tx
        .select({
          credits: players.credits,
          healthPlanCycleKey: players.healthPlanCycleKey,
          id: players.id,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (currentPlayer?.healthPlanCycleKey === cycleKey) {
        throw new HospitalError('conflict', 'Plano de saúde já ativo neste ciclo.');
      }

      throw new HospitalError('insufficient_resources', 'Créditos insuficientes para o plano de saúde.');
    });

    return this.buildActionResponse(playerId, {
      action: 'health_plan',
      message: 'Plano de saúde ativado para este ciclo.',
    });
  }

  async purchaseStatItem(
    playerId: string,
    input: HospitalStatPurchaseInput,
  ): Promise<HospitalActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const itemCode = validateHospitalStatItemCode(input.itemCode);
    const item = HOSPITAL_STAT_ITEMS[itemCode];
    if (!item) {
      throw new HospitalError('validation', 'Consumível hospitalar inválido.');
    }
    const cycleKey = resolveHospitalCycleKey(this.now());
    const [purchaseRow] = await db
      .select({
        quantity: playerHospitalStatPurchases.quantity,
      })
      .from(playerHospitalStatPurchases)
      .where(
        and(
          eq(playerHospitalStatPurchases.playerId, playerId),
          eq(playerHospitalStatPurchases.cycleKey, cycleKey),
          eq(playerHospitalStatPurchases.itemCode, itemCode),
        ),
      )
      .limit(1);

    const currentPurchases = purchaseRow?.quantity ?? 0;

    if (currentPurchases >= HOSPITAL_STAT_LIMIT_PER_CYCLE) {
      throw new HospitalError('conflict', 'Limite de compras deste item já atingido no ciclo.');
    }

    const inflatedItemCost = inflateNpcMoney(item.costMoney, await this.inflationReader.getProfile());

    if (player.money < inflatedItemCost) {
      throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para comprar este item.');
    }

    const nextStats = item.applyToPlayer(player);
    const now = this.now();

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(players)
        .set({
          ...nextStats,
          money: sql`round((${players.money} - ${inflatedItemCost})::numeric, 2)`,
        })
        .where(
          and(
            eq(players.id, playerId),
            sql`(${players.money} - ${inflatedItemCost}) >= 0`,
          ),
        )
        .returning({
          id: players.id,
        });

      if (!updated) {
        throw new HospitalError('insufficient_resources', 'Dinheiro insuficiente para comprar este item.');
      }

      await tx
        .insert(playerHospitalStatPurchases)
        .values({
          cycleKey,
          itemCode,
          playerId,
          quantity: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          set: {
            quantity: sql`${playerHospitalStatPurchases.quantity} + 1`,
            updatedAt: now,
          },
          target: [
            playerHospitalStatPurchases.playerId,
            playerHospitalStatPurchases.cycleKey,
            playerHospitalStatPurchases.itemCode,
          ],
        });
    });

    return this.buildActionResponse(playerId, {
      action: 'stat_item',
      message: `${item.label} comprado com sucesso.`,
      purchasedItemCode: itemCode,
    });
  }

  private async buildActionResponse(
    playerId: string,
    input: {
      action: HospitalActionResponse['action'];
      message: string;
      purchasedItemCode?: HospitalStatItemCode | null;
    },
  ): Promise<HospitalActionResponse> {
    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
    const center = await this.getCenter(playerId);

    return {
      ...center,
      action: input.action,
      message: input.message,
      purchasedItemCode: input.purchasedItemCode ?? null,
    };
  }

  private async requireReadyPlayer(playerId: string): Promise<HospitalPlayerRecord> {
    const [player] = await db
      .select({
        addiction: players.addiction,
        appearanceJson: players.appearanceJson,
        carisma: players.carisma,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        credits: players.credits,
        forca: players.forca,
        healthPlanCycleKey: players.healthPlanCycleKey,
        hp: players.hp,
        id: players.id,
        inteligencia: players.inteligencia,
        money: players.money,
        nickname: players.nickname,
        resistencia: players.resistencia,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      throw new HospitalError('unauthorized', 'Jogador não encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new HospitalError('character_not_ready', 'Crie seu personagem antes de acessar o hospital.');
    }

    return {
      ...player,
      money: Number(player.money),
    };
  }

  private async getAllDrugIds(): Promise<string[]> {
    const rows = await db
      .select({
        id: drugs.id,
      })
      .from(drugs);

    return rows.map((row) => row.id);
  }

  private async readToleranceSummary(
    playerId: string,
    drugIds: string[],
  ): Promise<{ hasTolerance: boolean }> {
    if (drugIds.length === 0) {
      return { hasTolerance: false };
    }

    const records = await Promise.all(drugIds.map((drugId) => this.drugToleranceSystem.sync(playerId, drugId)));

    return {
      hasTolerance: records.some((record) => record.current > 0),
    };
  }

}

function buildStatOffers(input: {
  currentMoney: number;
  inflationProfile: NpcInflationProfile;
  purchases: Map<HospitalStatItemCode, number>;
}): HospitalStatItemOffer[] {
  return (Object.entries(HOSPITAL_STAT_ITEMS) as Array<
    [HospitalStatItemCode, (typeof HOSPITAL_STAT_ITEMS)[HospitalStatItemCode]]
  >).map(([itemCode, item]) => {
    const typedItemCode = itemCode as HospitalStatItemCode;
    const inflatedCost = inflateNpcMoney(item.costMoney, input.inflationProfile);
    const purchasesInCurrentCycle = input.purchases.get(typedItemCode) ?? 0;
    const remainingInCurrentCycle = Math.max(0, HOSPITAL_STAT_LIMIT_PER_CYCLE - purchasesInCurrentCycle);
    const available =
      remainingInCurrentCycle > 0 && input.currentMoney >= inflatedCost;
    const reason =
      remainingInCurrentCycle <= 0
        ? 'Limite por ciclo atingido.'
        : input.currentMoney >= inflatedCost
          ? null
          : 'Dinheiro insuficiente para este item.';

    return {
      available,
      costMoney: inflatedCost,
      description: item.description,
      itemCode: typedItemCode,
      label: item.label,
      limitPerCycle: HOSPITAL_STAT_LIMIT_PER_CYCLE,
      purchasesInCurrentCycle,
      reason,
      remainingInCurrentCycle,
    };
  });
}

function serviceAvailability(input: {
  available: boolean;
  creditsCost?: number | null;
  moneyCost?: number | null;
  reason?: string | null;
}): HospitalServiceAvailability {
  return {
    available: input.available,
    creditsCost: input.creditsCost ?? null,
    moneyCost: input.moneyCost ?? null,
    reason: input.reason ?? null,
  };
}

function unavailableService(
  reason: string,
  creditsCost: number | null = null,
  moneyCost: number | null = null,
): HospitalServiceAvailability {
  return {
    available: false,
    creditsCost,
    moneyCost,
    reason,
  };
}

function resolveDetoxCost(conceito: number): number {
  return Math.max(0, Math.round(conceito) * 100);
}

function resolveTreatmentCost(hp: number): number {
  const missingHp = Math.max(0, 100 - Math.max(0, Math.min(100, Math.round(hp))));

  if (missingHp <= 0) {
    return 0;
  }

  return Math.ceil(missingHp / 10) * TREATMENT_COST_PER_10_HP;
}

function validateNickname(input: string): string {
  const nickname = normalizeAuthNickname(input);

  if (!isValidAuthNickname(nickname)) {
    throw new HospitalError(
      'validation',
      'Nickname deve ter entre 3 e 16 caracteres usando apenas letras, números e underscore.',
    );
  }

  return nickname;
}

function sanitizeAppearance(input: CharacterAppearance): CharacterAppearance {
  return {
    hair: sanitizeAppearanceField(input.hair, DEFAULT_CHARACTER_APPEARANCE.hair),
    outfit: sanitizeAppearanceField(input.outfit, DEFAULT_CHARACTER_APPEARANCE.outfit),
    skin: sanitizeAppearanceField(input.skin, DEFAULT_CHARACTER_APPEARANCE.skin),
  };
}

function sanitizeAppearanceField(value: string, fallback: string): string {
  const sanitized = typeof value === 'string' ? value.trim() : '';

  if (sanitized.length === 0) {
    return fallback;
  }

  if (!/^[a-z0-9_]{2,32}$/u.test(sanitized)) {
    throw new HospitalError(
      'validation',
      'Aparência deve usar apenas letras minúsculas, números e underscore entre 2 e 32 caracteres.',
    );
  }

  return sanitized;
}

function validateHospitalStatItemCode(input: HospitalStatPurchaseInput['itemCode']): HospitalStatItemCode {
  if (!Object.hasOwn(HOSPITAL_STAT_ITEMS, input)) {
    throw new HospitalError('validation', 'Consumível hospitalar inválido.');
  }

  return input;
}
