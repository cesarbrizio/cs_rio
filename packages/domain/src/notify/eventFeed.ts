import {
  type DocksEventStatusResponse,
  type PoliceEventStatusItem,
  type PoliceEventStatusResponse,
  type SeasonalEventStatusItem,
  type SeasonalEventStatusResponse,
} from '@cs-rio/shared';

export type EventNotificationSeverity = 'danger' | 'info' | 'warning';
export type EventNotificationDestination = 'map' | 'market' | 'territory';

export interface EventNotificationItem {
  body: string;
  destination: EventNotificationDestination;
  id: string;
  regionLabel: string;
  remainingSeconds: number;
  severity: EventNotificationSeverity;
  startedAt: string;
  title: string;
}

export interface EventFeedSnapshot {
  banner: EventNotificationItem | null;
  generatedAt: string;
  notifications: EventNotificationItem[];
}

const SEVERITY_WEIGHT: Record<EventNotificationSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

const CATEGORY_WEIGHT: Record<EventNotificationDestination, number> = {
  territory: 0,
  map: 1,
  market: 2,
};

export function buildEventFeed(input: {
  docks: DocksEventStatusResponse;
  police: PoliceEventStatusResponse;
  seasonal: SeasonalEventStatusResponse;
}): EventFeedSnapshot {
  const notifications = [
    ...input.police.events.map(mapPoliceEventNotification),
    ...input.seasonal.events.map(mapSeasonalEventNotification),
    ...mapDocksEventNotifications(input.docks),
  ].sort((left, right) => {
    const bySeverity = SEVERITY_WEIGHT[left.severity] - SEVERITY_WEIGHT[right.severity];

    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byCategory = CATEGORY_WEIGHT[left.destination] - CATEGORY_WEIGHT[right.destination];

    if (byCategory !== 0) {
      return byCategory;
    }

    return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
  });

  return {
    banner: notifications[0] ?? null,
    generatedAt: latestGeneratedAt([
      input.police.generatedAt,
      input.seasonal.generatedAt,
      input.docks.startsAt,
      input.docks.endsAt,
    ]),
    notifications: notifications.slice(0, 12),
  };
}

function latestGeneratedAt(values: Array<string | null | undefined>): string {
  const timestamps = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function mapPoliceEventNotification(event: PoliceEventStatusItem): EventNotificationItem {
  const regionLabel = event.favelaName
    ? `${event.favelaName} · ${event.regionName}`
    : event.regionName;

  switch (event.eventType) {
    case 'faca_na_caveira':
      return {
        body:
          event.headline ??
          `O BOPE entrou em ${regionLabel}, derrubou pressao policial depois do choque e deixou perdas reais no caixa da favela.`,
        destination: 'territory',
        id: `police:${event.eventType}:${event.regionId}:${event.startedAt}`,
        regionLabel,
        remainingSeconds: event.remainingSeconds,
        severity: 'danger',
        startedAt: event.startedAt,
        title: 'Faca na Caveira',
      };
    case 'operacao_policial':
      return {
        body:
          event.headline ??
          `A pressao subiu em ${regionLabel}. Servicos e satisfacao local ja sentiram o impacto da operacao.`,
        destination: 'territory',
        id: `police:${event.eventType}:${event.regionId}:${event.startedAt}`,
        regionLabel,
        remainingSeconds: event.remainingSeconds,
        severity: 'warning',
        startedAt: event.startedAt,
        title: 'Operacao policial',
      };
    case 'blitz_pm':
      return {
        body:
          event.headline ??
          `A PM montou blitz em ${regionLabel}. O calor na regiao subiu e a circulacao ficou mais sensivel.`,
        destination: 'map',
        id: `police:${event.eventType}:${event.regionId}:${event.startedAt}`,
        regionLabel,
        remainingSeconds: event.remainingSeconds,
        severity: 'warning',
        startedAt: event.startedAt,
        title: 'Blitz da PM',
      };
  }
}

function mapSeasonalEventNotification(event: SeasonalEventStatusItem): EventNotificationItem {
  return {
    body: event.bonusSummary[0] ?? event.headline,
    destination: event.eventType === 'operacao_verao' ? 'territory' : 'map',
    id: `seasonal:${event.eventType}:${event.regionId}:${event.startedAt}`,
    regionLabel: event.regionName,
    remainingSeconds: event.remainingSeconds,
    severity: event.eventType === 'operacao_verao' ? 'warning' : 'info',
    startedAt: event.startedAt,
    title: resolveSeasonalTitle(event),
  };
}

function mapDocksEventNotifications(
  docks: DocksEventStatusResponse,
): EventNotificationItem[] {
  if (!docks.isActive || !docks.startsAt) {
    return [];
  }

  return [
    {
      body: `O porto do Centro esta pagando ${docks.premiumMultiplier.toFixed(1)}x e a demanda ficou liberada nas docas.`,
      destination: 'market',
      id: `docks:active:${docks.startsAt}`,
      regionLabel: 'Centro',
      remainingSeconds: docks.remainingSeconds,
      severity: 'info',
      startedAt: docks.startsAt,
      title: 'Navio nas Docas',
    },
  ];
}

function resolveSeasonalTitle(event: SeasonalEventStatusItem): string {
  switch (event.eventType) {
    case 'carnaval':
      return `Carnaval em ${event.regionName}`;
    case 'ano_novo_copa':
      return `Ano Novo em ${event.regionName}`;
    case 'operacao_verao':
      return `Operacao Verao em ${event.regionName}`;
  }
}
