import { RegionId, type TerritoryOverviewResponse } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { buildPendingTerritoryAlertCues } from '../src/notify/territoryAlerts';

describe('territory alert cues', () => {
  it('builds war and x9 alerts for the player faction', () => {
    const overview = buildOverview();

    const cues = buildPendingTerritoryAlertCues({
      overview,
      player: {
        faction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
      } as never,
      seenKeys: new Set<string>(),
    });

    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      kind: 'x9_warning',
      title: 'Parque Uniao: X9 ativo',
      tone: 'warning',
    });
    expect(cues[1]).toMatchObject({
      kind: 'war_declared',
      title: 'Morro da Coroa: guerra declarada',
      tone: 'warning',
    });
  });

  it('ignores seen or unrelated alerts', () => {
    const overview = buildOverview();

    const cues = buildPendingTerritoryAlertCues({
      overview,
      player: {
        faction: {
          abbreviation: 'ADA',
          id: 'faction-ada',
          name: 'Amigos dos Amigos',
        },
      } as never,
      seenKeys: new Set([
        'territory-alert:war:war-1:declared:2026-03-20T02:00:00.000Z',
      ]),
    });

    expect(cues).toHaveLength(0);
  });
});

function buildOverview(): TerritoryOverviewResponse {
  return {
    favelas: [
      {
        bandits: {
          active: 18,
          arrested: 0,
          deadRecent: 0,
          nextReturnAt: null,
          scheduledReturnBatches: 0,
          syncedAt: '2026-03-20T02:00:00.000Z',
          targetActive: 18,
        },
        code: 'coroa',
        contestingFaction: null,
        controllingFaction: {
          abbreviation: 'TCP',
          id: 'faction-tcp',
          name: 'Terceiro Comando',
        },
        difficulty: 22,
        id: 'favela-1',
        name: 'Morro da Coroa',
        population: 24000,
        propina: null,
        propinaValue: 0,
        regionId: RegionId.ZonaNorte,
        satisfaction: 52,
        satisfactionProfile: {
          dailyDeltaEstimate: 0,
          dailyX9RiskPercent: 0,
          factors: [],
          populationPressurePercentPerDay: 0,
          revenueMultiplier: 1,
          tier: 'stable',
        },
        soldiers: {
          active: 12,
          max: 30,
          occupancyPercent: 40,
        },
        stabilizationEndsAt: null,
        state: 'at_war',
        stateControlledUntil: null,
        war: {
          attackerFaction: {
            abbreviation: 'CV',
            id: 'faction-cv',
            name: 'Comando Vermelho',
          },
          attackerPreparation: null,
          attackerScore: 0,
          cooldownEndsAt: null,
          declaredAt: '2026-03-20T02:00:00.000Z',
          declaredByPlayerId: 'player-1',
          defenderFaction: {
            abbreviation: 'TCP',
            id: 'faction-tcp',
            name: 'Terceiro Comando',
          },
          defenderPreparation: null,
          defenderScore: 0,
          endedAt: null,
          favelaId: 'favela-1',
          id: 'war-1',
          lootMoney: 30000,
          nextRoundAt: null,
          preparationEndsAt: '2026-03-20T03:00:00.000Z',
          rounds: [],
          roundsResolved: 0,
          roundsTotal: 3,
          startsAt: '2026-03-20T03:10:00.000Z',
          status: 'declared',
          winnerFactionId: null,
        },
        warDeclaredAt: '2026-03-20T02:00:00.000Z',
        x9: null,
      },
      {
        bandits: {
          active: 25,
          arrested: 0,
          deadRecent: 0,
          nextReturnAt: null,
          scheduledReturnBatches: 0,
          syncedAt: '2026-03-20T04:00:00.000Z',
          targetActive: 25,
        },
        code: 'parque-uniao',
        contestingFaction: null,
        controllingFaction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        difficulty: 18,
        id: 'favela-2',
        name: 'Parque Uniao',
        population: 22000,
        propina: null,
        propinaValue: 0,
        regionId: RegionId.ZonaNorte,
        satisfaction: 39,
        satisfactionProfile: {
          dailyDeltaEstimate: -4,
          dailyX9RiskPercent: 18,
          factors: [],
          populationPressurePercentPerDay: 0,
          revenueMultiplier: 0.84,
          tier: 'warning',
        },
        soldiers: {
          active: 9,
          max: 24,
          occupancyPercent: 37,
        },
        stabilizationEndsAt: null,
        state: 'controlled',
        stateControlledUntil: null,
        war: null,
        warDeclaredAt: null,
        x9: {
          canAttemptDesenrolo: true,
          currentRiskPercent: 22,
          desenroloAttemptedAt: null,
          desenroloBaseMoneyCost: 12000,
          desenroloBasePointsCost: 8,
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
          triggeredAt: '2026-03-20T04:00:00.000Z',
          warningEndsAt: '2026-03-20T05:00:00.000Z',
          weaponsLost: 0,
        },
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
    ],
  };
}
