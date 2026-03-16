import { and, eq, sql, type SQL } from 'drizzle-orm';

import type { DatabaseExecutor } from '../db/client.js';
import { factions, players } from '../db/schema.js';

export type GuardedFinancialMutationStatus = 'insufficient_funds' | 'not_found' | 'updated';

export interface GuardedPlayerResourceMutationResult {
  player: {
    bankMoney: number;
    cansaco: number;
    disposicao: number;
    money: number;
  };
  status: GuardedFinancialMutationStatus;
}

export interface GuardedPlayerCombatMutationResult {
  player: {
    cansaco: number;
    carisma: number;
    conceito: number;
    disposicao: number;
    forca: number;
    hp: number;
    inteligencia: number;
    level: number;
    resistencia: number;
  };
  status: 'not_found' | 'updated';
}

export interface GuardedFactionBankMutationResult {
  faction: {
    bankMoney: number;
  };
  status: GuardedFinancialMutationStatus;
}

interface PlayerResourceDeltaInput {
  bankMoneyDelta?: number;
  cansacoDelta?: number;
  disposicaoDelta?: number;
  moneyDelta?: number;
}

interface PlayerCombatDeltaInput {
  cansacoDelta?: number;
  carismaDelta?: number;
  conceitoDelta?: number;
  disposicaoDelta?: number;
  forcaDelta?: number;
  hpDelta?: number;
  hpMax?: number;
  hpMin?: number;
  inteligenciaDelta?: number;
  resistenciaDelta?: number;
}

export async function applyPlayerResourceDeltas(
  executor: DatabaseExecutor,
  playerId: string,
  input: PlayerResourceDeltaInput,
): Promise<GuardedPlayerResourceMutationResult> {
  const bankMoneyDelta = input.bankMoneyDelta ?? 0;
  const cansacoDelta = input.cansacoDelta ?? 0;
  const disposicaoDelta = input.disposicaoDelta ?? 0;
  const moneyDelta = input.moneyDelta ?? 0;

  const guards: SQL[] = [eq(players.id, playerId)];
  const values: Partial<Record<'bankMoney' | 'cansaco' | 'disposicao' | 'money', SQL>> = {};

  if (moneyDelta !== 0) {
    values.money = sql`round((${players.money} + ${moneyDelta})::numeric, 2)`;

    if (moneyDelta < 0) {
      guards.push(sql`(${players.money} + ${moneyDelta}) >= 0`);
    }
  }

  if (bankMoneyDelta !== 0) {
    values.bankMoney = sql`round((${players.bankMoney} + ${bankMoneyDelta})::numeric, 2)`;

    if (bankMoneyDelta < 0) {
      guards.push(sql`(${players.bankMoney} + ${bankMoneyDelta}) >= 0`);
    }
  }

  if (cansacoDelta !== 0) {
    values.cansaco = sql`${players.cansaco} + ${cansacoDelta}`;

    if (cansacoDelta < 0) {
      guards.push(sql`(${players.cansaco} + ${cansacoDelta}) >= 0`);
    }
  }

  if (disposicaoDelta !== 0) {
    values.disposicao = sql`${players.disposicao} + ${disposicaoDelta}`;

    if (disposicaoDelta < 0) {
      guards.push(sql`(${players.disposicao} + ${disposicaoDelta}) >= 0`);
    }
  }

  if (Object.keys(values).length === 0) {
    const [player] = await executor
      .select({
        bankMoney: players.bankMoney,
        cansaco: players.cansaco,
        disposicao: players.disposicao,
        money: players.money,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    return player
      ? {
          player: mapPlayerResourceRow(player),
          status: 'updated',
        }
      : {
          player: {
            bankMoney: 0,
            cansaco: 0,
            disposicao: 0,
            money: 0,
          },
          status: 'not_found',
        };
  }

  const [updated] = await executor
    .update(players)
    .set(values)
    .where(and(...guards))
    .returning({
      bankMoney: players.bankMoney,
      cansaco: players.cansaco,
      disposicao: players.disposicao,
      money: players.money,
    });

  if (updated) {
    return {
      player: mapPlayerResourceRow(updated),
      status: 'updated',
    };
  }

  const [existing] = await executor
    .select({
      id: players.id,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  return {
    player: {
      bankMoney: 0,
      cansaco: 0,
      disposicao: 0,
      money: 0,
    },
    status: existing ? 'insufficient_funds' : 'not_found',
  };
}

export async function applyPlayerCombatDeltas(
  executor: DatabaseExecutor,
  playerId: string,
  input: PlayerCombatDeltaInput,
): Promise<GuardedPlayerCombatMutationResult> {
  const cansacoDelta = input.cansacoDelta ?? 0;
  const carismaDelta = input.carismaDelta ?? 0;
  const conceitoDelta = input.conceitoDelta ?? 0;
  const disposicaoDelta = input.disposicaoDelta ?? 0;
  const forcaDelta = input.forcaDelta ?? 0;
  const hpDelta = input.hpDelta ?? 0;
  const hpMax = input.hpMax ?? 100;
  const hpMin = input.hpMin ?? 0;
  const inteligenciaDelta = input.inteligenciaDelta ?? 0;
  const resistenciaDelta = input.resistenciaDelta ?? 0;
  const values: Partial<
    Record<
      | 'cansaco'
      | 'carisma'
      | 'conceito'
      | 'disposicao'
      | 'forca'
      | 'hp'
      | 'inteligencia'
      | 'resistencia',
      SQL
    >
  > = {};

  if (carismaDelta !== 0) {
    values.carisma = sql`GREATEST(0, ${players.carisma} + ${carismaDelta})`;
  }

  if (conceitoDelta !== 0) {
    values.conceito = sql`GREATEST(0, ${players.conceito} + ${conceitoDelta})`;
  }

  if (forcaDelta !== 0) {
    values.forca = sql`GREATEST(0, ${players.forca} + ${forcaDelta})`;
  }

  if (hpDelta !== 0) {
    values.hp = sql`LEAST(${hpMax}, GREATEST(${hpMin}, ${players.hp} + ${hpDelta}))`;
  }

  if (inteligenciaDelta !== 0) {
    values.inteligencia = sql`GREATEST(0, ${players.inteligencia} + ${inteligenciaDelta})`;
  }

  if (resistenciaDelta !== 0) {
    values.resistencia = sql`GREATEST(0, ${players.resistencia} + ${resistenciaDelta})`;
  }

  if (cansacoDelta !== 0) {
    values.cansaco = sql`LEAST(100, GREATEST(0, ${players.cansaco} + ${cansacoDelta}))`;
  }

  if (disposicaoDelta !== 0) {
    values.disposicao = sql`LEAST(100, GREATEST(0, ${players.disposicao} + ${disposicaoDelta}))`;
  }

  if (Object.keys(values).length === 0) {
    const [player] = await executor
      .select({
        cansaco: players.cansaco,
        carisma: players.carisma,
        conceito: players.conceito,
        disposicao: players.disposicao,
        forca: players.forca,
        hp: players.hp,
        inteligencia: players.inteligencia,
        level: players.level,
        resistencia: players.resistencia,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    return player
      ? {
          player,
          status: 'updated',
        }
      : {
          player: emptyCombatPlayerState(),
          status: 'not_found',
        };
  }

  const [updated] = await executor
    .update(players)
    .set(values)
    .where(eq(players.id, playerId))
    .returning({
      cansaco: players.cansaco,
      carisma: players.carisma,
      conceito: players.conceito,
      disposicao: players.disposicao,
      forca: players.forca,
      hp: players.hp,
      inteligencia: players.inteligencia,
      level: players.level,
      resistencia: players.resistencia,
    });

  return updated
    ? {
        player: updated,
        status: 'updated',
      }
    : {
        player: emptyCombatPlayerState(),
        status: 'not_found',
      };
}

export async function applyFactionBankDelta(
  executor: DatabaseExecutor,
  factionId: string,
  input: {
    bankMoneyDelta: number;
    pointsDelta?: number;
  },
): Promise<GuardedFactionBankMutationResult> {
  const bankMoneyDelta = input.bankMoneyDelta;
  const pointsDelta = input.pointsDelta ?? 0;
  const guards: SQL[] = [eq(factions.id, factionId)];
  const values: Partial<Record<'bankMoney' | 'points', SQL>> = {
    bankMoney: sql`round((${factions.bankMoney} + ${bankMoneyDelta})::numeric, 2)`,
  };

  if (bankMoneyDelta < 0) {
    guards.push(sql`(${factions.bankMoney} + ${bankMoneyDelta}) >= 0`);
  }

  if (pointsDelta !== 0) {
    values.points = sql`${factions.points} + ${pointsDelta}`;

    if (pointsDelta < 0) {
      guards.push(sql`(${factions.points} + ${pointsDelta}) >= 0`);
    }
  }

  const [updated] = await executor
    .update(factions)
    .set(values)
    .where(and(...guards))
    .returning({
      bankMoney: factions.bankMoney,
    });

  if (updated) {
    return {
      faction: {
        bankMoney: roundCurrency(Number.parseFloat(String(updated.bankMoney))),
      },
      status: 'updated',
    };
  }

  const [existing] = await executor
    .select({
      id: factions.id,
    })
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  return {
    faction: {
      bankMoney: 0,
    },
    status: existing ? 'insufficient_funds' : 'not_found',
  };
}

function mapPlayerResourceRow(row: {
  bankMoney: unknown;
  cansaco: number;
  disposicao: number;
  money: unknown;
}) {
  return {
    bankMoney: roundCurrency(Number.parseFloat(String(row.bankMoney))),
    cansaco: row.cansaco,
    disposicao: row.disposicao,
    money: roundCurrency(Number.parseFloat(String(row.money))),
  };
}

function emptyCombatPlayerState() {
  return {
    cansaco: 0,
    carisma: 0,
    conceito: 0,
    disposicao: 0,
    forca: 0,
    hp: 0,
    inteligencia: 0,
    level: 0,
    resistencia: 0,
  };
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}
