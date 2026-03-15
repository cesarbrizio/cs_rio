import type {
  FactionAutoPromotionResult,
  FactionMemberSummary,
  FactionNpcProgressionStatus,
  FactionRank,
  FactionSummary,
} from '@cs-rio/shared';

import { ROUND_GAME_DAY_MS } from '../npc-inflation.js';
import { getPromotedRank } from './repository.js';
import type { FactionLeadershipPlayerRecord } from './types.js';

type PromotionTargetRank = Exclude<FactionRank, 'cria' | 'patrao'>;

interface NpcPromotionRule {
  conceitoRequired: number;
  daysRequired: number;
  levelRequired: number;
}

interface NpcProgressionEvaluation {
  status: FactionNpcProgressionStatus;
  targetRank: PromotionTargetRank | null;
}

const NPC_FACTION_PROMOTION_RULES: Record<PromotionTargetRank, NpcPromotionRule> = {
  soldado: {
    conceitoRequired: 200,
    daysRequired: 2,
    levelRequired: 3,
  },
  vapor: {
    conceitoRequired: 1500,
    daysRequired: 5,
    levelRequired: 5,
  },
  gerente: {
    conceitoRequired: 5000,
    daysRequired: 9,
    levelRequired: 6,
  },
  general: {
    conceitoRequired: 50000,
    daysRequired: 14,
    levelRequired: 8,
  },
};

const FACTION_RANK_LIMITS: Partial<Record<FactionRank, number>> = {
  general: 2,
  gerente: 5,
  patrao: 1,
  vapor: 10,
};

export function buildNpcFactionProgressionStatus(input: {
  actorId: string;
  currentRank: FactionRank;
  faction: Pick<FactionSummary, 'id' | 'isFixed' | 'isNpcControlled' | 'leaderId'>;
  joinedAt: string;
  members: FactionMemberSummary[];
  now: Date;
  player: Pick<FactionLeadershipPlayerRecord, 'conceito' | 'level'>;
}): FactionNpcProgressionStatus | null {
  return evaluateNpcFactionProgression(input).status;
}

export function resolveEligibleNpcFactionPromotionRanks(input: {
  actorId: string;
  currentRank: FactionRank;
  faction: Pick<FactionSummary, 'id' | 'isFixed' | 'isNpcControlled' | 'leaderId'>;
  joinedAt: string;
  members: FactionMemberSummary[];
  now: Date;
  player: Pick<FactionLeadershipPlayerRecord, 'conceito' | 'level'>;
}): PromotionTargetRank[] {
  const promotedRanks: PromotionTargetRank[] = [];
  let currentRank = input.currentRank;
  let workingMembers = [...input.members];
  let shouldContinue = true;

  while (shouldContinue) {
    const evaluation = evaluateNpcFactionProgression({
      ...input,
      currentRank,
      members: workingMembers,
    });

    if (!evaluation.targetRank || !evaluation.status.eligibleNow) {
      shouldContinue = false;
      continue;
    }

    promotedRanks.push(evaluation.targetRank);
    currentRank = evaluation.targetRank;
    workingMembers = workingMembers.map((member) =>
      member.id === input.actorId
        ? {
            ...member,
            rank: evaluation.targetRank!,
          }
        : member,
    );
  }

  return promotedRanks;
}

export function buildNpcFactionAutoPromotionResult(input: {
  faction: Pick<FactionSummary, 'abbreviation' | 'id' | 'name'>;
  newRank: FactionRank;
  now: Date;
  previousRank: FactionRank;
}): FactionAutoPromotionResult {
  const rule =
    input.newRank === 'cria' || input.newRank === 'patrao'
      ? null
      : NPC_FACTION_PROMOTION_RULES[input.newRank];
  const reason = rule
    ? `${resolveRankPromotionLabel(input.newRank)} liberado por tempo de facção, nível ${rule.levelRequired}+ e conceito ${rule.conceitoRequired}+.`
    : `${resolveRankPromotionLabel(input.newRank)} liberado automaticamente pela liderança NPC.`;

  return {
    factionAbbreviation: input.faction.abbreviation,
    factionId: input.faction.id,
    factionName: input.faction.name,
    newRank: input.newRank,
    previousRank: input.previousRank,
    promotedAt: input.now.toISOString(),
    promotionReason: reason,
  };
}

function evaluateNpcFactionProgression(input: {
  actorId: string;
  currentRank: FactionRank;
  faction: Pick<FactionSummary, 'id' | 'isFixed' | 'isNpcControlled' | 'leaderId'>;
  joinedAt: string;
  members: FactionMemberSummary[];
  now: Date;
  player: Pick<FactionLeadershipPlayerRecord, 'conceito' | 'level'>;
}): NpcProgressionEvaluation {
  if (!isNpcControlledFaction(input.faction)) {
    return {
      status: {
        blockedReason: null,
        currentRank: input.currentRank,
        daysInFaction: resolveDaysInFaction(input.joinedAt, input.now),
        eligibleNow: false,
        minimumConceitoForNextRank: null,
        minimumDaysInFactionForNextRank: null,
        minimumLevelForNextRank: null,
        nextRank: null,
        occupiedSlotsForNextRank: null,
        remainingConceito: null,
        remainingDaysInFaction: null,
        remainingLevel: null,
        slotAvailable: false,
        slotLimitForNextRank: null,
      },
      targetRank: null,
    };
  }

  const nextRank = getPromotedRank(input.currentRank);

  if (!nextRank || nextRank === 'patrao' || nextRank === 'cria') {
    return {
      status: {
        blockedReason: 'Você já alcançou o cargo mais alto da trilha automática sob liderança NPC.',
        currentRank: input.currentRank,
        daysInFaction: resolveDaysInFaction(input.joinedAt, input.now),
        eligibleNow: false,
        minimumConceitoForNextRank: null,
        minimumDaysInFactionForNextRank: null,
        minimumLevelForNextRank: null,
        nextRank: null,
        occupiedSlotsForNextRank: null,
        remainingConceito: null,
        remainingDaysInFaction: null,
        remainingLevel: null,
        slotAvailable: true,
        slotLimitForNextRank: null,
      },
      targetRank: null,
    };
  }

  const targetRank = nextRank as PromotionTargetRank;
  const rule = NPC_FACTION_PROMOTION_RULES[targetRank];
  const daysInFaction = resolveDaysInFaction(input.joinedAt, input.now);
  const remainingDays = Math.max(0, rule.daysRequired - daysInFaction);
  const remainingLevel = Math.max(0, rule.levelRequired - input.player.level);
  const remainingConceito = Math.max(0, rule.conceitoRequired - input.player.conceito);
  const slotLimit = FACTION_RANK_LIMITS[targetRank] ?? null;
  const occupiedSlots =
    slotLimit === null
      ? null
      : input.members.filter((member) => !member.isNpc && member.id !== input.actorId && member.rank === targetRank)
          .length;
  const slotAvailable = slotLimit === null ? true : (occupiedSlots ?? 0) < slotLimit;
  const eligibleNow =
    remainingDays === 0 &&
    remainingLevel === 0 &&
    remainingConceito === 0 &&
    slotAvailable;

  return {
    status: {
      blockedReason: eligibleNow
        ? null
        : buildBlockedReason({
            nextRank: targetRank,
            occupiedSlots,
            remainingConceito,
            remainingDays,
            remainingLevel,
            slotAvailable,
            slotLimit,
          }),
      currentRank: input.currentRank,
      daysInFaction,
      eligibleNow,
      minimumConceitoForNextRank: rule.conceitoRequired,
      minimumDaysInFactionForNextRank: rule.daysRequired,
      minimumLevelForNextRank: rule.levelRequired,
      nextRank: targetRank,
      occupiedSlotsForNextRank: occupiedSlots,
      remainingConceito,
      remainingDaysInFaction: remainingDays,
      remainingLevel,
      slotAvailable,
      slotLimitForNextRank: slotLimit,
    },
    targetRank,
  };
}

function buildBlockedReason(input: {
  nextRank: PromotionTargetRank;
  occupiedSlots: number | null;
  remainingConceito: number;
  remainingDays: number;
  remainingLevel: number;
  slotAvailable: boolean;
  slotLimit: number | null;
}): string {
  const blockers: string[] = [];

  if (input.remainingDays > 0) {
    blockers.push(`faltam ${input.remainingDays} dia${input.remainingDays === 1 ? '' : 's'} na facção`);
  }

  if (input.remainingLevel > 0) {
    blockers.push(`faltam ${input.remainingLevel} nível${input.remainingLevel === 1 ? '' : 'eis'}`);
  }

  if (input.remainingConceito > 0) {
    blockers.push(`faltam ${input.remainingConceito} de conceito`);
  }

  if (!input.slotAvailable && input.slotLimit !== null) {
    blockers.push(
      `não há vaga para ${resolveRankPromotionLabel(input.nextRank)} (${input.occupiedSlots ?? input.slotLimit}/${input.slotLimit})`,
    );
  }

  if (blockers.length === 0) {
    return `Promoção para ${resolveRankPromotionLabel(input.nextRank)} ainda indisponível.`;
  }

  return `Promoção para ${resolveRankPromotionLabel(input.nextRank)} bloqueada: ${blockers.join(', ')}.`;
}

function isNpcControlledFaction(
  faction: Pick<FactionSummary, 'isFixed' | 'isNpcControlled' | 'leaderId'>,
): boolean {
  return faction.isFixed && faction.isNpcControlled && faction.leaderId === null;
}

function resolveDaysInFaction(joinedAt: string, now: Date): number {
  const joinedAtMs = new Date(joinedAt).getTime();

  if (!Number.isFinite(joinedAtMs)) {
    return 0;
  }

  const elapsedMs = Math.max(0, now.getTime() - joinedAtMs);
  return Math.floor(elapsedMs / ROUND_GAME_DAY_MS);
}

function resolveRankPromotionLabel(rank: FactionRank): string {
  switch (rank) {
    case 'general':
      return 'General';
    case 'gerente':
      return 'Gerente';
    case 'vapor':
      return 'Vapor';
    case 'soldado':
      return 'Soldado';
    case 'cria':
      return 'Cria';
    case 'patrao':
      return 'Patrão';
    default:
      return rank;
  }
}
