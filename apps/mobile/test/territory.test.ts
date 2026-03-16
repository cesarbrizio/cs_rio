import { RegionId, type TerritoryOverviewResponse } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildFavelaAlertLines,
  buildFavelaForceSummaryLines,
  buildTerritoryHeadlineStats,
  formatTerritoryCountdown,
  groupFavelasByRegion,
  resolveBaileStatusLabel,
  resolveFavelaStateLabel,
  resolvePropinaStatusLabel,
  resolveSatisfactionTierLabel,
  resolveWarStatusLabel,
  resolveX9StatusLabel,
} from '../src/features/territory';

describe('territory helpers', () => {
  it('groups favelas by region while deriving headline stats', () => {
    const overview = buildOverview();

    expect(groupFavelasByRegion(overview).map((group) => group.favelas.length)).toEqual([2, 1]);
    expect(buildTerritoryHeadlineStats(overview)).toEqual({
      atWarFavelas: 1,
      playerControlledFavelas: 1,
      totalFavelas: 3,
      x9ActiveFavelas: 1,
    });
  });

  it('resolves territory labels and alert lines', () => {
    const favela = buildOverview().favelas[1];

    expect(resolveFavelaStateLabel('at_war')).toBe('Em guerra');
    expect(resolveSatisfactionTierLabel('critical')).toBe('Crítica');
    expect(resolvePropinaStatusLabel('severe')).toBe('Inadimplente');
    expect(resolveX9StatusLabel('warning')).toBe('Aviso');
    expect(resolveWarStatusLabel('active')).toBe('Combate');
    expect(resolveBaileStatusLabel('hangover')).toBe('Ressaca');
    expect(buildFavelaForceSummaryLines(favela)).toEqual([
      'Soldados 41/65 · ocupação 63%',
      'Bandidos 31/34 · 8 presos · 4 baixas recentes · retorno 13/03, 12:00',
    ]);
    expect(buildFavelaAlertLines(favela)).toEqual([
      'Satisfação crítica: a chance de X9 e de perda de receita está alta.',
      'Tem X9 soprando e a incursão pode cair a qualquer momento.',
      'Arrego atrasado está cortando a receita territorial.',
      'A favela está no ciclo quente de guerra e exige resposta rápida.',
    ]);
  });

  it('formats countdown windows for the territory dashboard', () => {
    const nowMs = Date.parse('2026-03-11T12:00:00.000Z');

    expect(formatTerritoryCountdown('2026-03-11T12:45:00.000Z', nowMs)).toBe('45m');
    expect(formatTerritoryCountdown('2026-03-11T15:10:00.000Z', nowMs)).toBe('3h 10m');
    expect(formatTerritoryCountdown('2026-03-13T12:00:00.000Z', nowMs)).toBe('2d');
  });
});

function buildOverview(): TerritoryOverviewResponse {
  return {
    favelas: [
      {
        code: 'favela-1',
        contestingFaction: null,
        controllingFaction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        difficulty: 18,
        id: 'favela-1',
        name: 'Complexo da Penha',
        population: 32000,
        bandits: {
          active: 44,
          arrested: 3,
          deadRecent: 1,
          nextReturnAt: '2026-03-12T18:00:00.000Z',
          scheduledReturnBatches: 1,
          syncedAt: '2026-03-11T12:00:00.000Z',
          targetActive: 46,
        },
        propina: null,
        propinaValue: 12000,
        regionId: RegionId.ZonaNorte,
        satisfaction: 74,
        satisfactionProfile: {
          dailyDeltaEstimate: 1.5,
          dailyX9RiskPercent: 3.4,
          factors: [],
          populationPressurePercentPerDay: 0.6,
          revenueMultiplier: 1.12,
          tier: 'stable',
        },
        stabilizationEndsAt: null,
        state: 'controlled',
        stateControlledUntil: null,
        soldiers: {
          active: 28,
          max: 60,
          occupancyPercent: 47,
        },
        war: null,
        warDeclaredAt: null,
        x9: null,
      },
      {
        code: 'favela-2',
        contestingFaction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        controllingFaction: {
          abbreviation: 'TCP',
          id: 'faction-tcp',
          name: 'Terceiro Comando',
        },
        difficulty: 24,
        id: 'favela-2',
        name: 'Morro do Juramento',
        population: 25000,
        bandits: {
          active: 31,
          arrested: 8,
          deadRecent: 4,
          nextReturnAt: '2026-03-13T15:00:00.000Z',
          scheduledReturnBatches: 2,
          syncedAt: '2026-03-11T12:00:00.000Z',
          targetActive: 34,
        },
        propina: {
          baseAmount: 18000,
          canNegotiate: true,
          currentAmount: 18000,
          daysOverdue: 3,
          discountRate: 0,
          dueAt: '2026-03-12T12:00:00.000Z',
          lastPaidAt: null,
          negotiatedAt: null,
          negotiatedByPlayerId: null,
          revenuePenaltyMultiplier: 0.8,
          status: 'severe',
        },
        propinaValue: 18000,
        regionId: RegionId.ZonaNorte,
        satisfaction: 29,
        satisfactionProfile: {
          dailyDeltaEstimate: -6,
          dailyX9RiskPercent: 22,
          factors: [],
          populationPressurePercentPerDay: 2.4,
          revenueMultiplier: 0.72,
          tier: 'critical',
        },
        stabilizationEndsAt: null,
        state: 'at_war',
        stateControlledUntil: null,
        soldiers: {
          active: 41,
          max: 65,
          occupancyPercent: 63,
        },
        war: {
          attackerFaction: {
            abbreviation: 'CV',
            id: 'faction-cv',
            name: 'Comando Vermelho',
          },
          attackerPreparation: null,
          attackerScore: 1,
          cooldownEndsAt: null,
          declaredAt: '2026-03-11T09:00:00.000Z',
          declaredByPlayerId: 'player-1',
          defenderFaction: {
            abbreviation: 'TCP',
            id: 'faction-tcp',
            name: 'Terceiro Comando',
          },
          defenderPreparation: null,
          defenderScore: 0,
          endedAt: null,
          favelaId: 'favela-2',
          id: 'war-1',
          lootMoney: 0,
          nextRoundAt: '2026-03-11T12:30:00.000Z',
          preparationEndsAt: '2026-03-11T12:00:00.000Z',
          rounds: [],
          roundsResolved: 1,
          roundsTotal: 3,
          startsAt: '2026-03-11T12:00:00.000Z',
          status: 'active',
          winnerFactionId: null,
        },
        warDeclaredAt: '2026-03-11T09:00:00.000Z',
        x9: {
          canAttemptDesenrolo: true,
          currentRiskPercent: 38,
          desenroloAttemptedAt: null,
          desenroloBaseMoneyCost: 4000,
          desenroloBasePointsCost: 20,
          desenroloMoneySpent: 0,
          desenroloPointsSpent: 0,
          desenroloSucceeded: null,
          drugsLost: 0,
          id: 'x9-1',
          incursionAt: null,
          moneyLost: 0,
          pendingSoldiersReturn: 0,
          resolvedAt: null,
          soldiersArrested: 0,
          soldiersReleaseAt: null,
          status: 'warning',
          triggeredAt: '2026-03-11T11:00:00.000Z',
          warningEndsAt: '2026-03-11T14:00:00.000Z',
          weaponsLost: 0,
        },
      },
      {
        code: 'favela-3',
        contestingFaction: null,
        controllingFaction: null,
        difficulty: 10,
        id: 'favela-3',
        name: 'Parque Uniao',
        population: 17000,
        bandits: {
          active: 18,
          arrested: 0,
          deadRecent: 0,
          nextReturnAt: null,
          scheduledReturnBatches: 0,
          syncedAt: '2026-03-11T12:00:00.000Z',
          targetActive: 18,
        },
        propina: null,
        propinaValue: 8000,
        regionId: RegionId.Centro,
        satisfaction: 61,
        satisfactionProfile: {
          dailyDeltaEstimate: 0.5,
          dailyX9RiskPercent: 5.1,
          factors: [],
          populationPressurePercentPerDay: 0.8,
          revenueMultiplier: 1,
          tier: 'restless',
        },
        stabilizationEndsAt: null,
        state: 'neutral',
        stateControlledUntil: null,
        soldiers: {
          active: 0,
          max: 40,
          occupancyPercent: 0,
        },
        war: null,
        warDeclaredAt: null,
        x9: null,
      },
    ],
    playerFactionId: 'faction-cv',
    regions: [
      {
        atWarFavelas: 1,
        controlledFavelas: 1,
        dominantFaction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        neutralFavelas: 0,
        playerFactionControlledFavelas: 1,
        regionId: RegionId.ZonaNorte,
        stateControlledFavelas: 0,
        totalFavelas: 2,
      },
      {
        atWarFavelas: 0,
        controlledFavelas: 0,
        dominantFaction: null,
        neutralFavelas: 1,
        playerFactionControlledFavelas: 0,
        regionId: RegionId.Centro,
        stateControlledFavelas: 0,
        totalFavelas: 1,
      },
    ],
  };
}
