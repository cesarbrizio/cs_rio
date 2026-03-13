import {
  type FactionBankLedgerEntry,
  type FactionCoordinationKind,
  type FactionLeadershipElectionStatus,
  type FactionMemberSummary,
  type FactionRank,
  type FactionSummary,
} from '@cs-rio/shared';

export const FACTION_SCREEN_TABS = [
  'overview',
  'members',
  'bank',
  'upgrades',
  'war',
  'leadership',
] as const;

export type FactionScreenTab = (typeof FACTION_SCREEN_TABS)[number];

const FACTION_RANK_PRIORITY: Record<FactionRank, number> = {
  patrao: 0,
  general: 1,
  gerente: 2,
  vapor: 3,
  soldado: 4,
  cria: 5,
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function formatFactionCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function resolveFactionScreenTabLabel(tab: FactionScreenTab): string {
  switch (tab) {
    case 'overview':
      return 'Visao geral';
    case 'members':
      return 'Membros';
    case 'bank':
      return 'Banco';
    case 'upgrades':
      return 'Upgrades';
    case 'war':
      return 'Guerra';
    case 'leadership':
      return 'Candidatura';
    default:
      return tab;
  }
}

export function resolveFactionRankLabel(rank: FactionRank | null): string {
  switch (rank) {
    case 'patrao':
      return 'Patrao';
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
    default:
      return 'Sem cargo';
  }
}

export function resolveFactionCoordinationLabel(kind: FactionCoordinationKind): string {
  switch (kind) {
    case 'attack':
      return 'Ataque';
    case 'defend':
      return 'Defesa';
    case 'gather':
      return 'Bonde';
    case 'supply':
      return 'Suprimento';
    default:
      return kind;
  }
}

export function resolveFactionElectionStatusLabel(
  status: FactionLeadershipElectionStatus,
): string {
  switch (status) {
    case 'petitioning':
      return 'Abaixo-assinado';
    case 'active':
      return 'Votação aberta';
    case 'resolved':
      return 'Resolvida';
    default:
      return status;
  }
}

export function resolveFactionLedgerEntryLabel(entry: FactionBankLedgerEntry): string {
  if (entry.entryType === 'deposit') {
    return `Depósito de ${entry.playerNickname ?? 'membro'}`;
  }

  if (entry.entryType === 'withdrawal') {
    if (entry.originType === 'favela_service') {
      return 'Investimento em serviços de favela';
    }

    return `Saque de ${entry.playerNickname ?? 'liderança'}`;
  }

  if (entry.entryType === 'service_income') {
    return 'Receita automática de serviços de favela';
  }

  switch (entry.originType) {
    case 'boca':
      return 'Comissão automática de boca';
    case 'rave':
      return 'Comissão automática de rave';
    case 'puteiro':
      return 'Comissão automática de puteiro';
    case 'front_store':
      return 'Comissão automática de fachada';
    case 'slot_machine':
      return 'Comissão automática de maquininha';
    default:
      return 'Comissão automática';
  }
}

export function sortFactionsForDisplay(
  factions: FactionSummary[],
  playerFactionId: string | null,
): FactionSummary[] {
  return [...factions].sort((left, right) => {
    const leftIsPlayerFaction = left.id === playerFactionId ? 0 : 1;
    const rightIsPlayerFaction = right.id === playerFactionId ? 0 : 1;

    if (leftIsPlayerFaction !== rightIsPlayerFaction) {
      return leftIsPlayerFaction - rightIsPlayerFaction;
    }

    if (left.points !== right.points) {
      return right.points - left.points;
    }

    if (left.memberCount !== right.memberCount) {
      return right.memberCount - left.memberCount;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });
}

export function sortFactionMembersForDisplay(
  members: FactionMemberSummary[],
  onlinePlayerIds: string[] = [],
): FactionMemberSummary[] {
  const onlineSet = new Set(onlinePlayerIds);

  return [...members].sort((left, right) => {
    const leftIsOnline = onlineSet.has(left.id) ? 0 : 1;
    const rightIsOnline = onlineSet.has(right.id) ? 0 : 1;

    if (leftIsOnline !== rightIsOnline) {
      return leftIsOnline - rightIsOnline;
    }

    const leftIsLeader = left.isLeader ? 0 : 1;
    const rightIsLeader = right.isLeader ? 0 : 1;

    if (leftIsLeader !== rightIsLeader) {
      return leftIsLeader - rightIsLeader;
    }

    if (FACTION_RANK_PRIORITY[left.rank] !== FACTION_RANK_PRIORITY[right.rank]) {
      return FACTION_RANK_PRIORITY[left.rank] - FACTION_RANK_PRIORITY[right.rank];
    }

    return left.nickname.localeCompare(right.nickname, 'pt-BR');
  });
}
