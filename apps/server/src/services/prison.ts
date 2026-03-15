import {
  type FactionRank,
  type PlayerPoliceHeatTier,
  type PrisonActionResponse,
  type PrisonCenterResponse,
  VocationType,
} from '@cs-rio/shared';
import { eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { factionMembers, factions, players, prisonRecords } from '../db/schema.js';
import { insertFactionBankLedgerEntry } from './faction.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { type PrisonSystemContract, getActivePrisonRecord } from '../systems/PrisonSystem.js';
import { PoliceHeatSystem } from '../systems/PoliceHeatSystem.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';

interface PrisonPlayerRecord {
  carisma: number;
  characterCreatedAt: Date | null;
  conceito: number;
  credits: number;
  factionId: string | null;
  id: string;
  inteligencia: number;
  money: number;
  nickname: string;
  resistencia: number;
  vocation: VocationType;
}

interface PrisonFactionMembershipRecord {
  factionId: string;
  nickname: string;
  playerId: string;
  rank: FactionRank;
}

interface PrisonFactionRecord {
  bankMoney: number;
  id: string;
}

export interface PrisonServiceOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
  prisonSystem: PrisonSystemContract;
  universityReader?: UniversityEffectReaderContract;
}

export interface PrisonServiceContract {
  attemptBribe(playerId: string): Promise<PrisonActionResponse>;
  attemptEscape(playerId: string): Promise<PrisonActionResponse>;
  bailOut(playerId: string): Promise<PrisonActionResponse>;
  close?(): Promise<void>;
  getCenter(playerId: string): Promise<PrisonCenterResponse>;
  rescueFactionMember(playerId: string, targetPlayerId: string): Promise<PrisonActionResponse>;
}

type PrisonErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'forbidden'
  | 'insufficient_resources'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export class PrisonError extends Error {
  constructor(
    public readonly code: PrisonErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PrisonError';
  }
}

export class PrisonService implements PrisonServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly policeHeatSystem: PoliceHeatSystem;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: PrisonServiceOptions) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.policeHeatSystem =
      options.policeHeatSystem ??
      new PoliceHeatSystem({
        keyValueStore: this.keyValueStore,
      });
    this.prisonSystem = options.prisonSystem;
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close?.();
    }
  }

  async getCenter(playerId: string): Promise<PrisonCenterResponse> {
    const player = await getPlayer(playerId);

    if (!player) {
      throw new PrisonError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new PrisonError('character_not_ready', 'Crie seu personagem antes de acessar a prisao.');
    }

    const prison = await this.prisonSystem.getStatus(playerId);

    if (!prison.isImprisoned) {
      return {
        actions: {
          bail: unavailableAction('Jogador livre.'),
          bribe: unavailableAction('Jogador livre.'),
          escape: {
            ...unavailableAction('Jogador livre.'),
            alreadyAttempted: false,
          },
          factionRescue: {
            ...unavailableAction('Jogador livre.'),
            eligibleTarget: false,
          },
        },
        prison,
      };
    }

    const [record, passiveProfile, membership] = await Promise.all([
      getActivePrisonRecord(playerId, this.now()),
      this.universityReader.getPassiveProfile(playerId),
      getFactionMembership(playerId),
    ]);

    if (!record) {
      return {
        actions: {
          bail: unavailableAction('Jogador livre.'),
          bribe: unavailableAction('Jogador livre.'),
          escape: {
            ...unavailableAction('Jogador livre.'),
            alreadyAttempted: false,
          },
          factionRescue: {
            ...unavailableAction('Jogador livre.'),
            eligibleTarget: false,
          },
        },
        prison,
      };
    }

    const bribeCost = resolveBribeCost(player, passiveProfile.police.bribeCostMultiplier);
    const bribeChance = resolveBribeChance(player, prison.heatTier, passiveProfile.police.negotiationSuccessMultiplier);
    const escapeChance = resolveEscapeChance(player, prison.heatTier);
    const rescueCost = resolveFactionRescueCost(prison.remainingSeconds);
    const rescueEligibleTarget = isFactionRescueTargetRank(membership?.rank ?? null);

    return {
      actions: {
        bail: record.allowBail
          ? {
              available: player.credits >= BAIL_CREDITS_COST,
              creditsCost: BAIL_CREDITS_COST,
              factionBankCost: null,
              moneyCost: null,
              reason: player.credits >= BAIL_CREDITS_COST ? null : 'Creditos insuficientes para a fianca.',
              successChancePercent: 100,
            }
          : unavailableAction('Fiança indisponível para esta prisão.'),
        bribe: record.allowBribe
          ? {
              available: player.money >= bribeCost,
              creditsCost: null,
              factionBankCost: null,
              moneyCost: bribeCost,
              reason: player.money >= bribeCost ? null : 'Dinheiro insuficiente para tentar o suborno.',
              successChancePercent: bribeChance,
            }
          : unavailableAction('Suborno indisponível para esta prisão.'),
        escape: record.allowEscape
          ? {
              available: record.escapeAttemptedAt === null,
              alreadyAttempted: record.escapeAttemptedAt !== null,
              creditsCost: null,
              factionBankCost: null,
              moneyCost: null,
              reason: record.escapeAttemptedAt ? 'A fuga ja foi tentada nesta prisao.' : null,
              successChancePercent: escapeChance,
            }
          : {
              ...unavailableAction('Fuga indisponível para esta prisão.'),
              alreadyAttempted: false,
            },
        factionRescue: record.allowFactionRescue
          ? {
              available: rescueEligibleTarget,
              creditsCost: null,
              eligibleTarget: rescueEligibleTarget,
              factionBankCost: rescueCost,
              moneyCost: null,
              reason: rescueEligibleTarget
                ? 'Exige autorizacao de Patrao ou General da faccao.'
                : 'Resgate de facção exige alvo com cargo de gerente ou superior nesta fase.',
              successChancePercent: 100,
            }
          : {
              ...unavailableAction('Resgate da facção indisponível para esta prisão.'),
              eligibleTarget: false,
            },
      },
      prison,
    };
  }

  async attemptBribe(playerId: string): Promise<PrisonActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const [record, prison, passiveProfile] = await Promise.all([
      this.requireActivePrisonRecord(playerId),
      this.prisonSystem.getStatus(playerId),
      this.universityReader.getPassiveProfile(playerId),
    ]);

    if (!record.allowBribe) {
      throw new PrisonError('forbidden', 'Suborno indisponivel para esta prisao.');
    }

    const bribeCost = resolveBribeCost(player, passiveProfile.police.bribeCostMultiplier);

    if (player.money < bribeCost) {
      throw new PrisonError('insufficient_resources', 'Dinheiro insuficiente para tentar o suborno.');
    }

    const successChance = resolveBribeChance(
      player,
      prison.heatTier,
      passiveProfile.police.negotiationSuccessMultiplier,
    );
    const succeeded = Math.random() * 100 < successChance;
    const result = await db.transaction(async (tx) => {
      const [currentPlayer] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!currentPlayer) {
        return null;
      }

      const nextMoney = roundCurrency(Number.parseFloat(String(currentPlayer.money)) - bribeCost);

      if (nextMoney < 0) {
        return null;
      }

      await tx
        .update(players)
        .set({
          money: nextMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      if (succeeded) {
        await tx
          .update(prisonRecords)
          .set({
            releaseAt: this.now(),
            releasedEarlyBy: playerId,
          })
          .where(eq(prisonRecords.id, record.id));
      }

      return {
        moneyRemaining: nextMoney,
      };
    });

    if (!result) {
      throw new PrisonError('conflict', 'Falha ao processar o suborno.');
    }

    await this.invalidatePlayerProfile(playerId);
    const nextPrison = await this.prisonSystem.getStatus(playerId);

    return {
      creditsRemaining: null,
      factionBankMoneyRemaining: null,
      message: succeeded
        ? 'O suborno passou e o jogador foi liberado imediatamente.'
        : 'O suborno falhou; a grana sumiu e a pena continua correndo.',
      method: 'bribe',
      moneyRemaining: result.moneyRemaining,
      prison: nextPrison,
      success: succeeded,
    };
  }

  async bailOut(playerId: string): Promise<PrisonActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const record = await this.requireActivePrisonRecord(playerId);

    if (!record.allowBail) {
      throw new PrisonError('forbidden', 'Fiança indisponivel para esta prisao.');
    }

    if (player.credits < BAIL_CREDITS_COST) {
      throw new PrisonError('insufficient_resources', 'Creditos insuficientes para pagar a fianca.');
    }

    const result = await db.transaction(async (tx) => {
      const [currentPlayer] = await tx
        .select({
          credits: players.credits,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!currentPlayer || currentPlayer.credits < BAIL_CREDITS_COST) {
        return null;
      }

      const nextCredits = currentPlayer.credits - BAIL_CREDITS_COST;

      await tx
        .update(players)
        .set({
          credits: nextCredits,
        })
        .where(eq(players.id, playerId));

      await tx
        .update(prisonRecords)
        .set({
          releaseAt: this.now(),
          releasedEarlyBy: playerId,
        })
        .where(eq(prisonRecords.id, record.id));

      return {
        creditsRemaining: nextCredits,
      };
    });

    if (!result) {
      throw new PrisonError('conflict', 'Falha ao processar a fianca.');
    }

    await this.invalidatePlayerProfile(playerId);

    return {
      creditsRemaining: result.creditsRemaining,
      factionBankMoneyRemaining: null,
      message: 'Fiança paga com créditos; soltura imediata confirmada.',
      method: 'bail',
      moneyRemaining: null,
      prison: await this.prisonSystem.getStatus(playerId),
      success: true,
    };
  }

  async attemptEscape(playerId: string): Promise<PrisonActionResponse> {
    const player = await this.requireReadyPlayer(playerId);
    const record = await this.requireActivePrisonRecord(playerId);

    if (!record.allowEscape) {
      throw new PrisonError('forbidden', 'Fuga indisponivel para esta prisao.');
    }

    if (record.escapeAttemptedAt) {
      throw new PrisonError('conflict', 'A fuga ja foi tentada nesta prisao.');
    }

    const prison = await this.prisonSystem.getStatus(playerId);
    const successChance = resolveEscapeChance(player, prison.heatTier);
    const succeeded = Math.random() * 100 < successChance;
    const attemptedAt = this.now();

    if (succeeded) {
      await db
        .update(prisonRecords)
        .set({
          escapeAttemptedAt: attemptedAt,
          releaseAt: attemptedAt,
          releasedEarlyBy: playerId,
        })
        .where(eq(prisonRecords.id, record.id));
    } else {
      const extensionMs = Math.ceil(prison.remainingSeconds * 1000 * ESCAPE_FAILURE_TIME_MULTIPLIER);
      const nextReleaseAt = new Date(attemptedAt.getTime() + extensionMs);

      await Promise.all([
        db
          .update(prisonRecords)
          .set({
            escapeAttemptedAt: attemptedAt,
            releaseAt: nextReleaseAt,
          })
          .where(eq(prisonRecords.id, record.id)),
        this.policeHeatSystem.addHeat(playerId, ESCAPE_FAILURE_HEAT_DELTA),
      ]);
    }

    await this.invalidatePlayerProfile(playerId);

    return {
      creditsRemaining: null,
      factionBankMoneyRemaining: null,
      message: succeeded
        ? 'A fuga deu certo e a cela ficou para tras.'
        : 'A fuga falhou, a pena aumentou e o calor da policia subiu.',
      method: 'escape',
      moneyRemaining: null,
      prison: await this.prisonSystem.getStatus(playerId),
      success: succeeded,
    };
  }

  async rescueFactionMember(playerId: string, targetPlayerId: string): Promise<PrisonActionResponse> {
    if (playerId === targetPlayerId) {
      throw new PrisonError('forbidden', 'Resgate da faccao exige outro membro autorizado executando a acao.');
    }

    const [rescuer, rescuerMembership, targetMembership, targetPrison] = await Promise.all([
      this.requireReadyPlayer(playerId),
      getFactionMembership(playerId),
      getFactionMembership(targetPlayerId),
      this.requireActivePrisonRecord(targetPlayerId),
    ]);

    if (!rescuerMembership || (rescuerMembership.rank !== 'patrao' && rescuerMembership.rank !== 'general')) {
      throw new PrisonError('forbidden', 'Apenas Patrao ou General podem autorizar resgate da faccao.');
    }

    if (!targetMembership || targetMembership.factionId !== rescuerMembership.factionId) {
      throw new PrisonError('forbidden', 'O alvo precisa pertencer a mesma faccao do autorizador.');
    }

    if (!targetPrison.allowFactionRescue) {
      throw new PrisonError('forbidden', 'Resgate da faccao indisponivel para esta prisao.');
    }

    if (!isFactionRescueTargetRank(targetMembership.rank)) {
      throw new PrisonError(
        'forbidden',
        'Nesta fase, o resgate da faccao so cobre membros com cargo de gerente ou superior.',
      );
    }

    const faction = await getFaction(rescuerMembership.factionId);

    if (!faction) {
      throw new PrisonError('not_found', 'Faccao nao encontrada para autorizar o resgate.');
    }

    const targetStatus = await this.prisonSystem.getStatus(targetPlayerId);
    const rescueCost = resolveFactionRescueCost(targetStatus.remainingSeconds);

    if (faction.bankMoney < rescueCost) {
      throw new PrisonError('insufficient_resources', 'Banco da faccao insuficiente para o resgate.');
    }

    const result = await db.transaction(async (tx) => {
      const [currentFaction] = await tx
        .select({
          bankMoney: factions.bankMoney,
        })
        .from(factions)
        .where(eq(factions.id, rescuerMembership.factionId))
        .limit(1);

      if (!currentFaction) {
        return null;
      }

      const nextBankMoney = roundCurrency(Number.parseFloat(String(currentFaction.bankMoney)) - rescueCost);

      if (nextBankMoney < 0) {
        return null;
      }

      await tx
        .update(factions)
        .set({
          bankMoney: nextBankMoney.toFixed(2),
        })
        .where(eq(factions.id, rescuerMembership.factionId));

      await insertFactionBankLedgerEntry(tx as never, {
        balanceAfter: nextBankMoney,
        commissionAmount: 0,
        createdAt: this.now(),
        description: `Resgate da prisao de ${targetMembership.nickname} autorizado por ${rescuer.nickname}.`,
        entryType: 'withdrawal',
        factionId: rescuerMembership.factionId,
        grossAmount: rescueCost,
        netAmount: rescueCost,
        originType: 'manual',
        playerId: playerId,
      });

      await tx
        .update(prisonRecords)
        .set({
          releaseAt: this.now(),
          releasedEarlyBy: playerId,
        })
        .where(eq(prisonRecords.id, targetPrison.id));

      return {
        factionBankMoneyRemaining: nextBankMoney,
      };
    });

    if (!result) {
      throw new PrisonError('conflict', 'Falha ao processar o resgate da faccao.');
    }

    await this.invalidatePlayerProfile(targetPlayerId);

    return {
      creditsRemaining: null,
      factionBankMoneyRemaining: result.factionBankMoneyRemaining,
      message: `${targetMembership.nickname} foi tirado da cadeia com verba da faccao.`,
      method: 'faction_rescue',
      moneyRemaining: null,
      prison: await this.prisonSystem.getStatus(targetPlayerId),
      success: true,
    };
  }

  private async requireActivePrisonRecord(playerId: string) {
    const record = await getActivePrisonRecord(playerId, this.now());

    if (!record) {
      throw new PrisonError('conflict', 'Jogador nao esta preso.');
    }

    return record;
  }

  private async requireReadyPlayer(playerId: string): Promise<PrisonPlayerRecord> {
    const player = await getPlayer(playerId);

    if (!player) {
      throw new PrisonError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!player.characterCreatedAt) {
      throw new PrisonError('character_not_ready', 'Crie seu personagem antes de acessar a prisao.');
    }

    return player;
  }

  private async invalidatePlayerProfile(playerId: string): Promise<void> {
    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
  }
}

const BAIL_CREDITS_COST = 10;
const ESCAPE_FAILURE_HEAT_DELTA = 10;
const ESCAPE_FAILURE_TIME_MULTIPLIER = 1.5;

function unavailableAction(reason: string) {
  return {
    available: false,
    creditsCost: null,
    factionBankCost: null,
    moneyCost: null,
    reason,
    successChancePercent: null,
  };
}

function resolveBribeCost(player: PrisonPlayerRecord, bribeCostMultiplier: number): number {
  return roundCurrency(Math.max(500, player.conceito * 500) * bribeCostMultiplier);
}

function resolveBribeChance(
  player: PrisonPlayerRecord,
  heatTier: PlayerPoliceHeatTier,
  negotiationMultiplier: number,
): number {
  const baseChance =
    35 +
    Math.floor(player.carisma / 20) +
    (player.vocation === VocationType.Politico ? 10 : 0) -
    resolveBribeHeatPenalty(heatTier);

  return clampPercentage(Math.round(baseChance * negotiationMultiplier), 5, 90);
}

function resolveEscapeChance(
  player: PrisonPlayerRecord,
  heatTier: PlayerPoliceHeatTier,
): number {
  const chance =
    18 +
    Math.floor(player.resistencia / 25) +
    Math.floor(player.inteligencia / 50) +
    (player.vocation === VocationType.Cria || player.vocation === VocationType.Soldado ? 6 : 0) -
    resolveEscapeHeatPenalty(heatTier);

  return clampPercentage(chance, 5, 70);
}

function resolveFactionRescueCost(remainingSeconds: number): number {
  const remainingHours = Math.max(1, Math.ceil(remainingSeconds / 3600));
  return roundCurrency(50000 + Math.max(0, remainingHours - 1) * 5000);
}

function resolveBribeHeatPenalty(heatTier: PlayerPoliceHeatTier): number {
  switch (heatTier) {
    case 'marcado':
      return 10;
    case 'quente':
      return 20;
    case 'cacado':
      return 35;
    default:
      return 0;
  }
}

function resolveEscapeHeatPenalty(heatTier: PlayerPoliceHeatTier): number {
  switch (heatTier) {
    case 'marcado':
      return 5;
    case 'quente':
      return 10;
    case 'cacado':
      return 20;
    default:
      return 0;
  }
}

function isFactionRescueTargetRank(rank: FactionRank | null): boolean {
  return rank === 'patrao' || rank === 'general' || rank === 'gerente';
}

function clampPercentage(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getPlayer(playerId: string): Promise<PrisonPlayerRecord | null> {
  const [player] = await db
    .select({
      carisma: players.carisma,
      characterCreatedAt: players.characterCreatedAt,
      conceito: players.conceito,
      credits: players.credits,
      factionId: players.factionId,
      id: players.id,
      inteligencia: players.inteligencia,
      money: players.money,
      nickname: players.nickname,
      resistencia: players.resistencia,
      vocation: players.vocation,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return null;
  }

  return {
    carisma: player.carisma,
    characterCreatedAt: player.characterCreatedAt,
    conceito: player.conceito,
    credits: player.credits,
    factionId: player.factionId,
    id: player.id,
    money: Number.parseFloat(String(player.money)),
    nickname: player.nickname,
    resistencia: player.resistencia,
    inteligencia: player.inteligencia,
    vocation: player.vocation as VocationType,
  };
}

async function getFactionMembership(playerId: string): Promise<PrisonFactionMembershipRecord | null> {
  const [membership] = await db
    .select({
      factionId: factionMembers.factionId,
      nickname: players.nickname,
      playerId: factionMembers.playerId,
      rank: factionMembers.rank,
    })
    .from(factionMembers)
    .innerJoin(players, eq(players.id, factionMembers.playerId))
    .where(eq(factionMembers.playerId, playerId))
    .limit(1);

  return membership ?? null;
}

async function getFaction(factionId: string): Promise<PrisonFactionRecord | null> {
  const [faction] = await db
    .select({
      bankMoney: factions.bankMoney,
      id: factions.id,
    })
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  if (!faction) {
    return null;
  }

  return {
    bankMoney: Number.parseFloat(String(faction.bankMoney)),
    id: faction.id,
  };
}
