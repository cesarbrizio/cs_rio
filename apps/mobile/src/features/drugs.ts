import { DrugType, type PlayerInventoryItem, type PlayerProfile } from '@cs-rio/shared';

export type DrugVenue = 'rave' | 'baile';
export type DrugRiskLevel = 'blocked' | 'high' | 'medium' | 'low';

interface DrugCatalogEntry {
  addictionRate: number;
  aliases: string[];
  name: string;
  nerveBoost: number;
  moraleBoost: number;
  staminaRecovery: number;
  type: DrugType;
}

export interface DrugVenueDefinition {
  crowdLabel: string;
  description: string;
  id: DrugVenue;
  label: string;
  maxDrugsLabel: string;
}

export interface ResolvedDrugCatalogEntry extends DrugCatalogEntry {
  estimatedUnitPrice: string;
}

const DRUG_CATALOG: DrugCatalogEntry[] = [
  {
    addictionRate: 0.5,
    aliases: ['maconha'],
    moraleBoost: 1,
    name: 'Maconha',
    nerveBoost: 0,
    staminaRecovery: 1,
    type: DrugType.Maconha,
  },
  {
    addictionRate: 1,
    aliases: ['lanca', 'lança'],
    moraleBoost: 1,
    name: 'Lança',
    nerveBoost: 2,
    staminaRecovery: 2,
    type: DrugType.Lanca,
  },
  {
    addictionRate: 1.5,
    aliases: ['bala'],
    moraleBoost: 2,
    name: 'Bala',
    nerveBoost: 5,
    staminaRecovery: 3,
    type: DrugType.Bala,
  },
  {
    addictionRate: 1,
    aliases: ['doce'],
    moraleBoost: 2,
    name: 'Doce',
    nerveBoost: 0,
    staminaRecovery: 4,
    type: DrugType.Doce,
  },
  {
    addictionRate: 2,
    aliases: ['md'],
    moraleBoost: 2,
    name: 'MD',
    nerveBoost: 3,
    staminaRecovery: 5,
    type: DrugType.MD,
  },
  {
    addictionRate: 3,
    aliases: ['cocaina', 'cocaína'],
    moraleBoost: 3,
    name: 'Cocaína',
    nerveBoost: 10,
    staminaRecovery: 7,
    type: DrugType.Cocaina,
  },
  {
    addictionRate: 5,
    aliases: ['crack'],
    moraleBoost: 3,
    name: 'Crack',
    nerveBoost: 15,
    staminaRecovery: 8,
    type: DrugType.Crack,
  },
];

export const DRUG_VENUES: DrugVenueDefinition[] = [
  {
    crowdLabel: 'Pista premium, fluxo menor e efeito mais calculado.',
    description: 'Contexto de rave para consumo mais controlado, com foco em moral e ritmo.',
    id: 'rave',
    label: 'Rave',
    maxDrugsLabel: 'Até 10 tipos no cardápio',
  },
  {
    crowdLabel: 'Volume alto, pressao social e pico rapido de consumo.',
    description: 'Contexto de baile para consumo em massa, com mais impulso e mais risco.',
    id: 'baile',
    label: 'Baile Funk',
    maxDrugsLabel: 'Até 5 tipos no cardápio',
  },
];

export function buildDrugUseWarnings(
  player: PlayerProfile | null,
  drug: ResolvedDrugCatalogEntry | null,
): string[] {
  if (!player || !drug) {
    return [];
  }

  const warnings: string[] = [];

  if (player.hospitalization.isHospitalized) {
    warnings.push(
      `Você está hospitalizado por overdose por mais ${formatRemainingSeconds(
        player.hospitalization.remainingSeconds,
      )}.`,
    );
  }

  if (player.resources.stamina + drug.staminaRecovery > 100) {
    warnings.push('A estamina prevista pode ultrapassar 100 e disparar overdose por excesso.');
  }

  if (player.resources.addiction >= 95) {
    warnings.push('Seu vício está no limite crítico. Qualquer consumo agora pode causar colapso.');
  } else if (player.resources.addiction >= 80) {
    warnings.push('Seu vício está muito alto. O risco de overdose já é relevante.');
  }

  if (drug.addictionRate >= 3) {
    warnings.push('Essa droga acelera muito o vício e exige uso mais disciplinado.');
  }

  warnings.push('Misturar 3 tipos diferentes em menos de 1h pode causar overdose.');

  return warnings;
}

export function filterConsumableDrugItems(items: PlayerInventoryItem[]): PlayerInventoryItem[] {
  return items
    .filter((item) => item.itemType === 'drug' && item.quantity > 0)
    .sort((left, right) =>
      (left.itemName ?? left.itemId ?? '').localeCompare(right.itemName ?? right.itemId ?? '', 'pt-BR'),
    );
}

export function formatRemainingSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatToleranceMultiplier(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

export function resolveDrugCatalogEntry(
  item: Pick<PlayerInventoryItem, 'itemId' | 'itemName'> | null,
): ResolvedDrugCatalogEntry | null {
  if (!item) {
    return null;
  }

  const normalizedSources = [
    normalizeDrugToken(item.itemName),
    normalizeDrugToken(item.itemId),
  ].filter(Boolean);

  const match = DRUG_CATALOG.find((entry) =>
    normalizedSources.some((source) =>
      entry.aliases.some((alias) => normalizeDrugToken(alias) === source),
    ),
  );

  if (!match) {
    return null;
  }

  return {
    ...match,
    estimatedUnitPrice: `R$ ${Math.round(50 + match.addictionRate * 100 + match.staminaRecovery * 40)}`,
  };
}

export function resolveDrugRiskLevel(
  player: PlayerProfile | null,
  drug: ResolvedDrugCatalogEntry | null,
): {
  copy: string;
  level: DrugRiskLevel;
} {
  if (!player || !drug) {
    return {
      copy: 'Selecione uma droga para ver o risco estimado.',
      level: 'low',
    };
  }

  if (player.hospitalization.isHospitalized) {
    return {
      copy: 'Consumo bloqueado até o fim da hospitalização.',
      level: 'blocked',
    };
  }

  let score = 0;

  if (player.resources.addiction >= 95) {
    score += 3;
  } else if (player.resources.addiction >= 80) {
    score += 2;
  } else if (player.resources.addiction >= 60) {
    score += 1;
  }

  if (player.resources.stamina + drug.staminaRecovery > 100) {
    score += 3;
  }

  if (drug.addictionRate >= 3) {
    score += 1;
  }

  if (score >= 5) {
    return {
      copy: 'Risco alto de overdose. Revise estamina, vício e mistura recente.',
      level: 'high',
    };
  }

  if (score >= 2) {
    return {
      copy: 'Risco moderado. O server ainda considera tolerância e mistura recente.',
      level: 'medium',
    };
  }

  return {
    copy: 'Risco baixo no preview local, mas ainda depende do histórico recente no server.',
    level: 'low',
  };
}

export function resolveDrugVenue(venue: DrugVenue): DrugVenueDefinition {
  return DRUG_VENUES.find((entry) => entry.id === venue) ?? DRUG_VENUES[0]!;
}

function normalizeDrugToken(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/giu, '')
    .toLowerCase();
}
