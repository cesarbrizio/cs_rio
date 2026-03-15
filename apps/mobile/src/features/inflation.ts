import {
  type NpcInflationAffectedService,
  type NpcInflationScheduleEntry,
  type NpcInflationSummary,
  type NpcInflationTier,
} from '@cs-rio/shared';

const SERVICE_LABELS: Record<NpcInflationAffectedService, string> = {
  black_market: 'Mercado Negro',
  hospital: 'Hospital',
  training: 'Treino',
  university: 'Universidade',
};

const TIER_LABELS: Record<NpcInflationTier, string> = {
  high: 'alta',
  low: 'baixa',
  peak: 'máxima',
  rising: 'subindo',
};

export function formatNpcInflationMultiplier(value: number): string {
  return `x${value.toFixed(2)}`;
}

export function formatNpcInflationSurcharge(value: number): string {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
  return `+${rounded}%`;
}

export function formatNpcInflationTier(tier: NpcInflationTier): string {
  return TIER_LABELS[tier];
}

export function formatNpcInflationAffectedServices(summary: NpcInflationSummary): string {
  return summary.affectedServices.map((service) => SERVICE_LABELS[service]).join(' · ');
}

export function buildNpcInflationHeadline(summary: NpcInflationSummary): string {
  if (!summary.roundActive) {
    return 'Sem rodada ativa: inflação neutra';
  }

  return `Inflação ${formatNpcInflationTier(summary.tier)} · ${formatNpcInflationMultiplier(summary.currentMultiplier)}`;
}

export function buildNpcInflationBody(summary: NpcInflationSummary): string {
  if (!summary.roundActive) {
    return 'Sem rodada ativa, os serviços de NPC ficam no preço-base. Quando uma nova rodada começar, a inflação volta a subir com o tempo.';
  }

  if (summary.nextIncreaseInDays === null || summary.nextMultiplier === null) {
    return `Hoje os serviços de NPC estão em ${formatNpcInflationMultiplier(summary.currentMultiplier)} (${formatNpcInflationSurcharge(summary.currentSurchargePercent)} acima do base). Esse é o teto da rodada e só zera quando a próxima rodada começar.`;
  }

  return `Hoje os serviços de NPC estão em ${formatNpcInflationMultiplier(summary.currentMultiplier)} (${formatNpcInflationSurcharge(summary.currentSurchargePercent)} acima do base). O próximo aumento chega em ${formatNpcInflationRelativeDays(summary.nextIncreaseInDays)} e leva os preços para ${formatNpcInflationMultiplier(summary.nextMultiplier)}.`;
}

export function buildNpcInflationDecisionHint(summary: NpcInflationSummary): string {
  if (!summary.roundActive) {
    return 'Sem rodada ativa, não existe pressão de inflação.';
  }

  if (summary.nextIncreaseInDays === null) {
    return 'Se ainda precisar usar serviço de NPC nesta rodada, esse já é o preço mais caro possível.';
  }

  return `Se pretende tratar HP, treinar, estudar ou comprar no fornecedor do Mercado Negro, fazer isso antes do dia ${summary.nextIncreaseGameDay} sai mais barato.`;
}

export function formatNpcInflationRelativeDays(days: number): string {
  if (days <= 0) {
    return 'hoje';
  }

  return days === 1 ? '1 dia' : `${days} dias`;
}

export function formatNpcInflationScheduleEntry(entry: NpcInflationScheduleEntry): string {
  return `Dia ${entry.gameDay} · ${formatNpcInflationMultiplier(entry.multiplier)} · ${formatNpcInflationSurcharge(entry.surchargePercent)}`;
}
