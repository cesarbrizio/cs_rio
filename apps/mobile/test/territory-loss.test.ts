import { RegionId, type TerritoryLossFeedResponse } from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

const secureStoreState = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreState.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.set(key, value);
  }),
}));

import {
  buildPendingTerritoryLossCues,
  buildTerritoryLossCue,
} from '../src/features/territory-loss';
import {
  loadSeenTerritoryLossKeys,
  rememberSeenTerritoryLoss,
} from '../src/features/territory-loss-storage';

describe('territory loss helpers', () => {
  it('builds pending territory loss cues and deduplicates war defeats already covered by war cues', () => {
    const feed: TerritoryLossFeedResponse = {
      cues: [
        {
          body: 'CV perdeu o Morro da Coroa na guerra. Controle agora com TCP.',
          cause: 'war_defeat',
          economicImpact: 'Receitas e serviços da área saem da sua mão.',
          favelaId: 'favela-1',
          favelaName: 'Morro da Coroa',
          key: 'territory-loss:war_defeat:favela-1:faction-cv:faction-tcp:2026-03-11T13:00:00.000Z',
          lostByFactionAbbreviation: 'CV',
          lostByFactionId: 'faction-cv',
          newControllerFactionAbbreviation: 'TCP',
          newControllerFactionId: 'faction-tcp',
          occurredAt: '2026-03-11T13:00:00.000Z',
          politicalImpact: 'CV perdeu presença territorial.',
          regionId: RegionId.ZonaNorte,
          territorialImpact: 'Morro da Coroa saiu do domínio do CV.',
          title: 'Morro da Coroa: guerra perdida',
        },
        {
          body: 'Parque União foi tomado pelo Estado.',
          cause: 'state_takeover',
          economicImpact: 'Caixa e serviços ficaram travados.',
          favelaId: 'favela-2',
          favelaName: 'Parque União',
          key: 'territory-loss:state_takeover:favela-2:faction-cv:state:2026-03-11T14:00:00.000Z',
          lostByFactionAbbreviation: 'CV',
          lostByFactionId: 'faction-cv',
          newControllerFactionAbbreviation: 'Estado',
          newControllerFactionId: null,
          occurredAt: '2026-03-11T14:00:00.000Z',
          politicalImpact: 'A pressão estatal aumentou.',
          regionId: RegionId.ZonaNorte,
          territorialImpact: 'Parque União saiu do domínio da facção.',
          title: 'Parque União: tomada estatal',
        },
      ],
      generatedAt: '2026-03-11T14:05:00.000Z',
    };

    const pending = buildPendingTerritoryLossCues({
      feed,
      seenKeys: new Set<string>(),
      warCues: [{ favelaId: 'favela-1' }],
    });

    expect(pending).toHaveLength(2);
    expect(pending[0]).toMatchObject({
      dedupedByWar: true,
    });
    expect(pending[0]?.cue.causeLabel).toBe('Derrota em guerra');
    expect(pending[1]).toMatchObject({
      dedupedByWar: false,
    });
    expect(pending[1]?.cue.controllerLabel).toBe('Estado');
  });

  it('stores seen territory loss keys by player', async () => {
    secureStoreState.clear();

    const before = await loadSeenTerritoryLossKeys('player-1');
    expect(before.size).toBe(0);

    const after = await rememberSeenTerritoryLoss(
      'player-1',
      'territory-loss:state_takeover:favela-2:faction-cv:state:2026-03-11T14:00:00.000Z',
    );

    expect(after.has('territory-loss:state_takeover:favela-2:faction-cv:state:2026-03-11T14:00:00.000Z')).toBe(true);
    expect(buildTerritoryLossCue({
      body: 'Parque União foi tomado pelo Estado.',
      cause: 'state_takeover',
      economicImpact: 'Caixa e serviços ficaram travados.',
      favelaId: 'favela-2',
      favelaName: 'Parque União',
      key: 'territory-loss:state_takeover:favela-2:faction-cv:state:2026-03-11T14:00:00.000Z',
      lostByFactionAbbreviation: 'CV',
      lostByFactionId: 'faction-cv',
      newControllerFactionAbbreviation: 'Estado',
      newControllerFactionId: null,
      occurredAt: '2026-03-11T14:00:00.000Z',
      politicalImpact: 'A pressão estatal aumentou.',
      regionId: RegionId.ZonaNorte,
      territorialImpact: 'Parque União saiu do domínio da facção.',
      title: 'Parque União: tomada estatal',
    }).controllerLabel).toBe('Estado');
  });
});
