import { RegionId, type DocksEventStatusResponse, type PoliceEventStatusResponse, type SeasonalEventStatusResponse } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEventFeed,
  resolveEventDestinationLabel,
  resolveEventNotificationTimeLabel,
} from '../src/features/events';

describe('event feed', () => {
  it('prioritizes police danger events over seasonal and docks notices', () => {
    const docks: DocksEventStatusResponse = {
      endsAt: '2026-03-12T02:00:00.000Z',
      isActive: true,
      phase: 'active',
      premiumMultiplier: 1.5,
      regionId: RegionId.Centro,
      remainingSeconds: 7200,
      secondsUntilStart: 0,
      startsAt: '2026-03-12T00:00:00.000Z',
      unlimitedDemand: true,
    };
    const police: PoliceEventStatusResponse = {
      events: [
        {
          banditsArrested: 0,
          banditsKilledEstimate: 4,
          drugsLost: 22,
          endsAt: '2026-03-11T14:00:00.000Z',
          eventType: 'faca_na_caveira',
          favelaId: 'favela-1',
          favelaName: 'Favela do Centro',
          headline:
            'As operações do BOPE não fazem prisioneiros, não tem desenrolo, é faca na caveira! Eles entram, tomam armas, drogas e matam!',
          internalSatisfactionAfter: 40,
          internalSatisfactionBefore: 48,
          policePressureAfter: 55,
          policePressureBefore: 80,
          regionId: RegionId.Centro,
          regionName: 'Centro',
          remainingSeconds: 3600,
          satisfactionAfter: 18,
          satisfactionBefore: 30,
          soldiersLost: 2,
          startedAt: '2026-03-11T13:00:00.000Z',
          weaponsLost: 3,
        },
      ],
      generatedAt: '2026-03-11T13:15:00.000Z',
    };
    const seasonal: SeasonalEventStatusResponse = {
      events: [
        {
          bonusSummary: ['Raves e pontos de venda em Zona Sul e Centro faturam mais com turistas.'],
          endsAt: '2026-03-11T18:00:00.000Z',
          eventType: 'carnaval',
          headline:
            'Carnaval no Rio: turistas na pista, caixa quente na Zona Sul e a polícia distraída atrás do trio.',
          policeMood: 'distracted',
          regionId: RegionId.ZonaSul,
          regionName: 'Zona Sul',
          remainingSeconds: 18000,
          startedAt: '2026-03-11T12:00:00.000Z',
        },
      ],
      generatedAt: '2026-03-11T13:15:00.000Z',
    };

    const feed = buildEventFeed({
      docks,
      police,
      seasonal,
    });

    expect(feed.banner?.title).toBe('Faca na Caveira');
    expect(feed.notifications[1]?.title).toBe('Carnaval em Zona Sul');
    expect(feed.notifications[2]?.title).toBe('Navio nas Docas');
  });

  it('formats time labels in a compact mobile-friendly way', () => {
    expect(resolveEventNotificationTimeLabel(45)).toBe('menos de 1 min');
    expect(resolveEventNotificationTimeLabel(420)).toBe('7 min');
    expect(resolveEventNotificationTimeLabel(7260)).toBe('2 h 1 min');
  });

  it('maps destination labels used by the in-game banner CTA', () => {
    expect(resolveEventDestinationLabel('territory')).toBe('Abrir território');
    expect(resolveEventDestinationLabel('market')).toBe('Abrir mercado');
    expect(resolveEventDestinationLabel('map')).toBe('Abrir mapa');
  });
});
