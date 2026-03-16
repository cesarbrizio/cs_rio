import { VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildVocationAvailabilityCopy,
  buildVocationImpactLines,
  formatVocationAttributeLabel,
  formatVocationOptionAttributePair,
  formatVocationStateLabel,
} from '../src/features/vocation';

describe('vocation helpers', () => {
  it('formats labels for attributes, option focus and status state', () => {
    expect(formatVocationAttributeLabel('forca')).toBe('Força');
    expect(formatVocationAttributeLabel('inteligencia')).toBe('Inteligência');
    expect(
      formatVocationOptionAttributePair({
        baseAttributes: {
          carisma: 10,
          forca: 25,
          inteligencia: 20,
          resistencia: 15,
        },
        id: VocationType.Soldado,
        isCurrent: false,
        label: 'Soldado',
        primaryAttribute: 'forca',
        secondaryAttribute: 'inteligencia',
      }),
    ).toBe('Força + Inteligência');
    expect(
      formatVocationStateLabel({
        changedAt: null,
        cooldownEndsAt: null,
        cooldownRemainingSeconds: 0,
        currentVocation: VocationType.Cria,
        nextChangeAvailableAt: null,
        pendingVocation: null,
        state: 'ready',
        transitionEndsAt: null,
      }),
    ).toBe('Pronta');
  });

  it('builds clear availability copy for ready and cooldown states', () => {
    expect(
      buildVocationAvailabilityCopy({
        availability: {
          available: true,
          creditsCost: 10,
          reason: null,
        },
        status: {
          changedAt: null,
          cooldownEndsAt: null,
          cooldownRemainingSeconds: 0,
          currentVocation: VocationType.Cria,
          nextChangeAvailableAt: null,
          pendingVocation: null,
          state: 'ready',
          transitionEndsAt: null,
        },
      }),
    ).toContain('10 cr');

    expect(
      buildVocationAvailabilityCopy({
        availability: {
          available: false,
          creditsCost: 10,
          reason: 'Cooldown global da troca ainda está ativo.',
        },
        status: {
          changedAt: '2026-03-16T12:00:00.000Z',
          cooldownEndsAt: '2026-03-17T12:00:00.000Z',
          cooldownRemainingSeconds: 3_600,
          currentVocation: VocationType.Cria,
          nextChangeAvailableAt: '2026-03-17T12:00:00.000Z',
          pendingVocation: null,
          state: 'cooldown',
          transitionEndsAt: null,
        },
      }),
    ).toContain('1h');
  });

  it('summarizes progression and active passives for the build panel', () => {
    expect(
      buildVocationImpactLines({
        passiveLines: ['Sucesso em crimes solo x1.10', 'Chance de prisao x0.80'],
        progression: {
          completedPerks: 1,
          completionRatio: 0.25,
          currentPerkCode: null,
          masteryUnlocked: false,
          nextPerk: {
            attributeRequirements: {},
            code: 'rei_da_rua',
            completedAt: null,
            durationHours: 120,
            effectSummary: '+25% recompensa em crimes solo de nivel 1-4.',
            endsAt: null,
            isCompleted: false,
            isInProgress: false,
            isLocked: false,
            isUnlocked: true,
            label: 'Rei da Rua',
            lockReason: null,
            moneyCost: 250000,
            prerequisiteCourseCodes: ['mao_leve'],
            isMasteryPerk: false,
            perkSlot: 2,
            startedAt: null,
            status: 'available',
            unlockLevel: 9,
            vocation: VocationType.Cria,
          },
          passiveProfile: {
            business: {
              bocaDemandMultiplier: 1,
              gpRevenueMultiplier: 1,
              launderingReturnMultiplier: 1,
              passiveRevenueMultiplier: 1,
              propertyMaintenanceMultiplier: 1,
            },
            crime: {
              arrestChanceMultiplier: 1,
              lowLevelSoloRewardMultiplier: 1,
              revealsTargetValue: false,
              soloSuccessMultiplier: 1,
            },
            factory: {
              extraDrugSlots: 0,
              productionMultiplier: 1,
            },
            faction: {
              factionCharismaAura: 0,
            },
            market: {
              feeRate: 0.05,
            },
            police: {
              bribeCostMultiplier: 1,
              negotiationSuccessMultiplier: 1,
            },
            pvp: {
              ambushPowerMultiplier: 1,
              assaultPowerMultiplier: 1,
              damageDealtMultiplier: 1,
              lowHpDamageTakenMultiplier: 1,
            },
            social: {
              communityInfluenceMultiplier: 1,
            },
          },
          perks: [],
          stage: 'developing',
          totalPerks: 4,
          trackLabel: 'Trilha do Cria',
          vocation: VocationType.Cria,
        },
      }),
    ).toEqual([
      'Trilha em evolução · 1/4 perks concluídos.',
      'Próxima vantagem: Rei da Rua — +25% recompensa em crimes solo de nivel 1-4.',
      'Sucesso em crimes solo x1.10',
      'Chance de prisao x0.80',
    ]);
  });
});
