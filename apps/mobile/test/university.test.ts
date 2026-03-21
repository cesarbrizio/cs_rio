import { VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  formatUniversityCurrency,
  formatUniversityDurationHours,
  formatUniversityRequirements,
  formatUniversityVocation,
  getLiveUniversityCourseState,
  resolveUniversityCourseStateLabel,
  sortUniversityCourses,
  summarizeUniversityPassives,
} from '../src/features/university';

describe('university helpers', () => {
  it('formats core labels for the university UI', () => {
    expect(formatUniversityCurrency(25000)).toBe('R$\u00a025.000');
    expect(formatUniversityDurationHours(24)).toBe('1d');
    expect(formatUniversityDurationHours(72)).toBe('3d');
    expect(formatUniversityRequirements({ forca: 500, inteligencia: 300 })).toBe(
      'Forca 500 · Inteligencia 300',
    );
    expect(formatUniversityRequirements({})).toBe('Sem requisito adicional de atributo.');
    expect(formatUniversityVocation(VocationType.Empreendedor)).toBe('Empreendedor');
  });

  it('derives live progress and visual state labels for courses', () => {
    const activeCourse = {
      attributeRequirements: {},
      code: 'mao_leve' as const,
      completedAt: null,
      durationHours: 24,
      effectSummary: '+10% sucesso em crimes solo.',
      endsAt: '2026-03-12T12:00:00.000Z',
      isCompleted: false,
      isInProgress: true,
      isLocked: false,
      isUnlocked: true,
      label: 'Mao Leve',
      lockReason: 'Curso em andamento.',
      moneyCost: 25000,
      prerequisiteCourseCodes: [],
      startedAt: '2026-03-11T12:00:00.000Z',
      unlockLevel: 7,
      vocation: VocationType.Cria,
    };

    expect(getLiveUniversityCourseState(activeCourse, Date.parse('2026-03-12T00:00:00.000Z'))).toEqual({
      progressRatio: 0.5,
      remainingSeconds: 43_200,
    });
    expect(resolveUniversityCourseStateLabel(activeCourse)).toBe('Em andamento');
    expect(
      resolveUniversityCourseStateLabel({
        ...activeCourse,
        isCompleted: true,
        isInProgress: false,
      }),
    ).toBe('Concluído');
  });

  it('sorts courses and summarizes only active passive modifiers', () => {
    const sorted = sortUniversityCourses([
      {
        attributeRequirements: {},
        code: 'rei_da_rua' as const,
        completedAt: null,
        durationHours: 120,
        effectSummary: '+25% recompensa em crimes solo de nivel 1-4.',
        endsAt: null,
        isCompleted: false,
        isInProgress: false,
        isLocked: true,
        isUnlocked: false,
        label: 'Rei da Rua',
        lockReason: 'Exige concluir Mao Leve.',
        moneyCost: 250000,
        prerequisiteCourseCodes: ['mao_leve'],
        startedAt: null,
        unlockLevel: 9,
        vocation: VocationType.Cria,
      },
      {
        attributeRequirements: {},
        code: 'mao_leve' as const,
        completedAt: '2026-03-11T12:00:00.000Z',
        durationHours: 24,
        effectSummary: '+10% sucesso em crimes solo.',
        endsAt: '2026-03-11T12:00:00.000Z',
        isCompleted: true,
        isInProgress: false,
        isLocked: false,
        isUnlocked: true,
        label: 'Mao Leve',
        lockReason: null,
        moneyCost: 25000,
        prerequisiteCourseCodes: [],
        startedAt: '2026-03-10T12:00:00.000Z',
        unlockLevel: 7,
        vocation: VocationType.Cria,
      },
    ]);

    expect(sorted.map((course) => course.code)).toEqual(['mao_leve', 'rei_da_rua']);

    expect(
      summarizeUniversityPassives({
        business: {
          bocaDemandMultiplier: 1.2,
          gpRevenueMultiplier: 1,
          launderingReturnMultiplier: 1,
          passiveRevenueMultiplier: 1,
          propertyMaintenanceMultiplier: 1,
        },
        crime: {
          arrestChanceMultiplier: 0.8,
          lowLevelSoloRewardMultiplier: 1,
          revealsTargetValue: true,
          soloSuccessMultiplier: 1.1,
        },
        factory: {
          extraDrugSlots: 0,
          productionMultiplier: 1,
        },
        faction: {
          factionCharismaAura: 0,
        },
        market: {
          feeRate: 0.02,
        },
        police: {
          bribeCostMultiplier: 1,
          negotiationSuccessMultiplier: 1,
        },
        social: {
          communityInfluenceMultiplier: 1,
        },
      }),
    ).toEqual([
      'Sucesso em crimes solo x1.10',
      'Chance de prisao x0.80',
      'Valor real dos alvos revelado',
      'Demanda das bocas x1.20',
      'Taxa do Mercado Negro 2%',
    ]);
  });
});
