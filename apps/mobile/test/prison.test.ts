import { describe, expect, it } from 'vitest';

import {
  buildPrisonActionCopy,
  formatPrisonHeatTier,
  formatPrisonRemaining,
  getLivePrisonStatus,
  hasImmediatePrisonEscapeOptions,
} from '../src/features/prison';

describe('prison helpers', () => {
  it('formats prison timer across ranges', () => {
    expect(formatPrisonRemaining(0)).toBe('Soltura imediata');
    expect(formatPrisonRemaining(45)).toBe('45s');
    expect(formatPrisonRemaining(125)).toBe('2m 5s');
    expect(formatPrisonRemaining(8_100)).toBe('2h 15m');
    expect(formatPrisonRemaining(190_800)).toBe('2d 5h');
  });

  it('formats prison heat tiers and live status', () => {
    expect(formatPrisonHeatTier('quente')).toBe('Quente');

    const live = getLivePrisonStatus(
      {
        endsAt: new Date(Date.now() + 9_500).toISOString(),
        heatScore: 42,
        heatTier: 'marcado',
        isImprisoned: true,
        reason: 'Teste',
        remainingSeconds: 999,
        sentencedAt: new Date().toISOString(),
      },
      Date.now(),
    );

    expect(live.isImprisoned).toBe(true);
    expect(live.remainingSeconds).toBeLessThanOrEqual(10);
  });

  it('summarizes action copy and detects immediate exits', () => {
    expect(
      buildPrisonActionCopy('bail', {
        available: true,
        creditsCost: 10,
        factionBankCost: null,
        moneyCost: null,
        reason: null,
        successChancePercent: 100,
      }),
    ).toContain('10 créditos');

    expect(
      hasImmediatePrisonEscapeOptions({
        actions: {
          bail: {
            available: false,
            creditsCost: 10,
            factionBankCost: null,
            moneyCost: null,
            reason: 'Sem créditos.',
            successChancePercent: 100,
          },
          bribe: {
            available: true,
            creditsCost: null,
            factionBankCost: null,
            moneyCost: 500,
            reason: null,
            successChancePercent: 65,
          },
          escape: {
            alreadyAttempted: false,
            available: false,
            creditsCost: null,
            factionBankCost: null,
            moneyCost: null,
            reason: 'Já tentou.',
            successChancePercent: 33,
          },
          factionRescue: {
            available: false,
            creditsCost: null,
            eligibleTarget: false,
            factionBankCost: 50000,
            moneyCost: null,
            reason: 'Outro membro precisa fazer.',
            successChancePercent: 100,
          },
        },
        prison: {
          endsAt: null,
          heatScore: 0,
          heatTier: 'frio',
          isImprisoned: true,
          reason: 'Teste',
          remainingSeconds: 0,
          sentencedAt: null,
        },
      }),
    ).toBe(true);
  });
});
