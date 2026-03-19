import {
  type FactionMemberSummary,
  type FactionRank,
  type PvpAmbushResponse,
  type PvpAssaultResponse,
  type PvpCombatTier,
} from '@cs-rio/shared';

import { resolveFactionRankLabel } from './factionHelpers';

export type CombatResult = PvpAmbushResponse | PvpAssaultResponse;

export interface CombatTargetOption {
  disabledReason: string | null;
  id: string;
  isOwnFactionMember: boolean;
  nickname: string;
  subtitle: string;
  title: string;
}

export interface AmbushParticipantOption {
  disabledReason: string | null;
  id: string;
  isEligible: boolean;
  nickname: string;
  rank: FactionRank;
  title: string;
}

export interface CombatRealtimePlayer {
  nickname: string;
  playerId: string;
  title: string;
  vocation: string;
}

const SOLDIER_OR_HIGHER = new Set<FactionRank>(['soldado', 'vapor', 'gerente', 'general', 'patrao']);
const AMBUSH_LEADERS = new Set<FactionRank>(['gerente', 'general', 'patrao']);

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function buildCombatTargets(input: {
  currentPlayerId: string | null | undefined;
  ownFactionMemberIds: string[];
  realtimePlayers: CombatRealtimePlayer[];
}): CombatTargetOption[] {
  const ownFactionMemberIds = new Set(input.ownFactionMemberIds);

  return input.realtimePlayers
    .filter((player) => player.playerId !== input.currentPlayerId)
    .map((player) => {
      const isOwnFactionMember = ownFactionMemberIds.has(player.playerId);

      return {
        disabledReason: isOwnFactionMember ? 'Mesmo bonde' : null,
        id: player.playerId,
        isOwnFactionMember,
        nickname: player.nickname,
        subtitle: `${player.title} · ${player.vocation}`,
        title: player.title,
      } satisfies CombatTargetOption;
    })
    .sort((left, right) => {
      if (left.isOwnFactionMember !== right.isOwnFactionMember) {
        return left.isOwnFactionMember ? 1 : -1;
      }

      return left.nickname.localeCompare(right.nickname, 'pt-BR');
    });
}

export function buildAmbushParticipantOptions(input: {
  currentPlayerId: string | null | undefined;
  members: FactionMemberSummary[];
}): AmbushParticipantOption[] {
  return input.members
    .filter((member) => member.id !== input.currentPlayerId)
    .filter((member) => !member.isNpc)
    .map((member) => {
      const isEligible = SOLDIER_OR_HIGHER.has(member.rank);

      return {
        disabledReason: isEligible ? null : 'So soldado ou superior entra na emboscada.',
        id: member.id,
        isEligible,
        nickname: member.nickname,
        rank: member.rank,
        title: resolveFactionRankLabel(member.rank),
      } satisfies AmbushParticipantOption;
    })
    .sort((left, right) => left.nickname.localeCompare(right.nickname, 'pt-BR'));
}

export function canLeadAmbush(rank: FactionRank | null | undefined): boolean {
  return rank ? AMBUSH_LEADERS.has(rank) : false;
}

export function formatCombatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function resolveCombatTierLabel(tier: PvpCombatTier): string {
  switch (tier) {
    case 'clear_victory':
      return 'Vitoria limpa';
    case 'hard_fail':
      return 'Queda feia';
    case 'narrow_victory':
      return 'Vitoria apertada';
    case 'total_takedown':
      return 'Atropelo total';
    default:
      return tier;
  }
}

export function resolveCombatTierTone(
  tier: PvpCombatTier,
): 'danger' | 'info' | 'success' | 'warning' {
  switch (tier) {
    case 'clear_victory':
      return 'success';
    case 'total_takedown':
      return 'warning';
    case 'hard_fail':
      return 'danger';
    case 'narrow_victory':
      return 'info';
    default:
      return 'info';
  }
}

export function buildCombatResultHighlights(result: CombatResult): string[] {
  const lines = [result.message];

  if (result.loot && result.loot.amount > 0) {
    lines.push(`Espolio puxado: ${formatCombatCurrency(result.loot.amount)} (${result.loot.percentage}% do bolso).`);
  }

  if (result.mode === 'assault' && result.attributeSteal) {
    lines.push(
      `Atributo roubado: +${result.attributeSteal.amount} em ${resolveAttributeLabel(result.attributeSteal.attribute)}.`,
    );
  }

  if (result.mode === 'ambush') {
    lines.push(
      `Bonde com ${result.attackers.length} membros · coordenacao x${result.coordinationMultiplier.toFixed(2)}.`,
    );
  }

  const defenderHospitalization = result.defender.hospitalization;

  if (defenderHospitalization.recommended) {
    lines.push(
      `Alvo deve ir para o hospital por ${defenderHospitalization.durationMinutes} min.`,
    );
  }

  if (result.fatality.eligible) {
    lines.push(`Chance de letalidade: ${Math.round(result.fatality.chance * 100)}%.`);
  }

  lines.push(`Cooldown do alvo: ${formatCombatCooldown(result.targetCooldownSeconds)}.`);
  return lines;
}

export function formatCombatCooldown(seconds: number): string {
  if (seconds >= 3600) {
    return `${Math.ceil(seconds / 3600)}h`;
  }

  if (seconds >= 60) {
    return `${Math.ceil(seconds / 60)} min`;
  }

  return `${seconds}s`;
}

function resolveAttributeLabel(attribute: 'carisma' | 'forca' | 'inteligencia' | 'resistencia'): string {
  switch (attribute) {
    case 'carisma':
      return 'carisma';
    case 'forca':
      return 'forca';
    case 'inteligencia':
      return 'inteligencia';
    case 'resistencia':
      return 'resistencia';
    default:
      return attribute;
  }
}
