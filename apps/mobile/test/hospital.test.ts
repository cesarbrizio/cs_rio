import { type NpcInflationSummary } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildHospitalServiceCopy,
  buildHospitalStatItemCopy,
  formatHospitalizationReason,
  formatHospitalRemaining,
  getLiveHospitalizationStatus,
  hasImmediateHospitalActions,
  hasSurgeryChanges,
} from '../src/features/hospital';

describe('hospital helpers', () => {
  it('formats hospitalization timers and reasons', () => {
    expect(formatHospitalRemaining(0)).toBe('Alta imediata');
    expect(formatHospitalRemaining(45)).toBe('45s');
    expect(formatHospitalRemaining(125)).toBe('2m 5s');
    expect(formatHospitalRemaining(7_200)).toBe('2h 0m');

    expect(
      formatHospitalizationReason({
        endsAt: new Date(Date.now() + 60_000).toISOString(),
        isHospitalized: true,
        reason: 'overdose',
        remainingSeconds: 60,
        startedAt: new Date().toISOString(),
        trigger: 'poly_drug_mix',
      }),
    ).toBe('Overdose por mistura de drogas.');
  });

  it('builds service and offer copy and detects immediate actions', () => {
    expect(
      buildHospitalServiceCopy('healthPlan', {
        available: true,
        creditsCost: 10,
        moneyCost: null,
        reason: null,
      }),
    ).toContain('10 créditos');

    expect(
      buildHospitalStatItemCopy({
        available: true,
        costMoney: 50000,
        description: '+100 de Inteligência permanente.',
        itemCode: 'cerebrina',
        label: 'Cerebrina',
        limitPerCycle: 5,
        purchasesInCurrentCycle: 2,
        reason: null,
        remainingInCurrentCycle: 3,
      }),
    ).toContain('restam 3/5');

    expect(
      hasImmediateHospitalActions({
        currentCycleKey: 'pre_alpha_2026_03',
        hospitalization: {
          endsAt: null,
          isHospitalized: false,
          reason: null,
          remainingSeconds: 0,
          startedAt: null,
          trigger: null,
        },
        npcInflation: buildNpcInflationStub(),
        player: {
          addiction: 0,
          appearance: { hair: 'corte_curto', outfit: 'camisa_branca', skin: 'pele_media' },
          credits: 10,
          dstRecoversAt: null,
          hasDst: false,
          healthPlanActive: false,
          healthPlanCycleKey: null,
          hp: 80,
          money: 5000,
          nickname: 'fulano',
        },
        services: {
          detox: { available: false, creditsCost: null, moneyCost: 0, reason: 'Sem vício.' },
          dstTreatment: { available: false, creditsCost: null, moneyCost: 5000, reason: 'Sem DST.' },
          healthPlan: { available: true, creditsCost: 10, moneyCost: null, reason: null },
          surgery: { available: true, creditsCost: 5, moneyCost: null, reason: null },
          treatment: { available: true, creditsCost: null, moneyCost: 1000, reason: null },
        },
        statItems: [],
      }),
    ).toBe(true);
  });

  it('updates live hospitalization and detects surgery changes', () => {
    const live = getLiveHospitalizationStatus(
      {
        endsAt: new Date(Date.now() + 9_500).toISOString(),
        isHospitalized: true,
        reason: 'combat',
        remainingSeconds: 999,
        startedAt: new Date().toISOString(),
        trigger: null,
      },
      Date.now(),
    );

    expect(live.isHospitalized).toBe(true);
    expect(live.remainingSeconds).toBeLessThanOrEqual(10);

    expect(
      hasSurgeryChanges(
        { hair: 'corte_curto', outfit: 'camisa_branca', skin: 'pele_media' },
        'fulano',
        { hair: 'tranca_media', outfit: 'camisa_branca', skin: 'pele_media' },
        'fulano',
      ),
    ).toBe(true);
  });
});

function buildNpcInflationStub(): NpcInflationSummary {
  return {
    affectedServices: ['hospital', 'training', 'university', 'black_market'],
    currentGameDay: 12,
    currentMultiplier: 1.12,
    currentSurchargePercent: 12,
    gameDayDurationHours: 6,
    maxMultiplier: 1.65,
    nextIncreaseGameDay: 13,
    nextIncreaseInDays: 1,
    nextMultiplier: 1.13,
    nextSurchargePercent: 13,
    resetsOnNewRound: true,
    roundActive: true,
    schedule: [
      {
        gameDay: 1,
        multiplier: 1,
        surchargePercent: 0,
      },
    ],
    tier: 'rising' as const,
    totalGameDays: 156,
  };
}
