import {
  type FactionSummary,
} from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildFactionPromotionCue,
  buildFactionPromotionCueFromSummary,
} from '../src/notify/factionPromotions';

describe('faction promotion cues', () => {
  it('builds a promotion cue from the auto-promotion payload', () => {
    const cue = buildFactionPromotionCue({
      factionAbbreviation: 'CV',
      factionId: 'faction-cv',
      factionName: 'Comando Vermelho',
      newRank: 'gerente',
      previousRank: 'soldado',
      promotedAt: '2026-03-20T03:00:00.000Z',
      promotionReason: 'Voce fechou os requisitos de conceito e tempo de casa.',
    });

    expect(cue).toMatchObject({
      body: 'Soldado -> Gerente. Voce fechou os requisitos de conceito e tempo de casa.',
      factionLabel: 'Comando Vermelho · CV',
      key: 'faction-promotion:faction-cv:soldado:gerente:2026-03-20T03:00:00.000Z',
      title: 'Gerente liberado em CV',
    });
  });

  it('reads the cue from the faction summary when available', () => {
    const faction = {
      autoPromotionResult: {
        factionAbbreviation: 'ADA',
        factionId: 'faction-ada',
        factionName: 'Amigos dos Amigos',
        newRank: 'general',
        previousRank: 'gerente',
        promotedAt: '2026-03-20T04:00:00.000Z',
        promotionReason: 'O topo intermediario foi liberado nesta rodada.',
      },
    } satisfies Pick<FactionSummary, 'autoPromotionResult'>;

    const cue = buildFactionPromotionCueFromSummary(faction);

    expect(cue?.newRankLabel).toBe('General');
    expect(cue?.previousRankLabel).toBe('Gerente');
  });
});
