import { RegionId, resolveTerritoryActionVisibility, type TerritoryFavelaSummary } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('shared territory action visibility', () => {
  it('shows conquest only for neutral favelas', () => {
    expect(
      resolveTerritoryActionVisibility({
        favela: buildFavela({
          controllingFaction: null,
          propina: null,
          state: 'neutral',
          x9: null,
        }),
        playerFactionId: 'faction-cv',
      }),
    ).toMatchObject({
      canConquer: true,
      canDeclareWar: false,
      isControlledByPlayerFaction: false,
      isControlledByRivalFaction: false,
      isNeutral: true,
      showBaile: false,
      showNegotiatePropina: false,
      showServices: false,
      showX9Desenrolo: false,
    });
  });

  it('shows management actions only for the controlling player faction', () => {
    expect(
      resolveTerritoryActionVisibility({
        favela: buildFavela({
          controllingFaction: {
            abbreviation: 'CV',
            id: 'faction-cv',
            name: 'Comando Vermelho',
          },
          propina: {
            baseAmount: 12000,
            canNegotiate: true,
            currentAmount: 12000,
            daysOverdue: 2,
            discountRate: 0,
            dueAt: '2026-03-20T12:00:00.000Z',
            lastPaidAt: null,
            negotiatedAt: null,
            negotiatedByPlayerId: null,
            revenuePenaltyMultiplier: 0.85,
            status: 'warning',
          },
          state: 'controlled',
          x9: {
            canAttemptDesenrolo: true,
            currentRiskPercent: 25,
            desenroloAttemptedAt: null,
            desenroloBaseMoneyCost: 5000,
            desenroloBasePointsCost: 12,
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
            status: 'pending_desenrolo',
            triggeredAt: '2026-03-19T12:00:00.000Z',
            warningEndsAt: '2026-03-19T14:00:00.000Z',
            weaponsLost: 0,
          },
        }),
        playerFactionId: 'faction-cv',
      }),
    ).toMatchObject({
      canConquer: false,
      canDeclareWar: false,
      isControlledByPlayerFaction: true,
      isControlledByRivalFaction: false,
      showBaile: true,
      showNegotiatePropina: true,
      showServices: true,
      showX9Desenrolo: true,
    });
  });

  it('shows war only for rival-controlled favelas and hides all actions under state control', () => {
    expect(
      resolveTerritoryActionVisibility({
        favela: buildFavela({
          controllingFaction: {
            abbreviation: 'TCP',
            id: 'faction-tcp',
            name: 'Terceiro Comando Puro',
          },
          propina: null,
          state: 'controlled',
          x9: null,
        }),
        playerFactionId: 'faction-cv',
      }),
    ).toMatchObject({
      canConquer: false,
      canDeclareWar: true,
      isControlledByPlayerFaction: false,
      isControlledByRivalFaction: true,
      showBaile: false,
      showNegotiatePropina: false,
      showServices: false,
      showX9Desenrolo: false,
    });

    expect(
      resolveTerritoryActionVisibility({
        favela: buildFavela({
          controllingFaction: null,
          propina: null,
          state: 'state',
          x9: null,
        }),
        playerFactionId: 'faction-cv',
      }),
    ).toMatchObject({
      canConquer: false,
      canDeclareWar: false,
      isStateControlled: true,
      showBaile: false,
      showNegotiatePropina: false,
      showServices: false,
      showX9Desenrolo: false,
    });
  });
});

function buildFavela(
  overrides: Pick<TerritoryFavelaSummary, 'controllingFaction' | 'propina' | 'state' | 'x9'>,
): TerritoryFavelaSummary {
  return {
    bandits: {
      active: 18,
      arrested: 0,
      deadRecent: 0,
      nextReturnAt: null,
      scheduledReturnBatches: 0,
      syncedAt: '2026-03-19T12:00:00.000Z',
      targetActive: 20,
    },
    code: 'favela-teste',
    contestingFaction: null,
    controllingFaction: overrides.controllingFaction,
    difficulty: 12,
    id: 'favela-teste',
    name: 'Favela Teste',
    population: 12000,
    propina: overrides.propina,
    propinaValue: 12000,
    regionId: RegionId.Centro,
    satisfaction: 62,
    satisfactionProfile: {
      dailyDeltaEstimate: 0.5,
      dailyX9RiskPercent: 12,
      factors: [],
      populationPressurePercentPerDay: 1.2,
      revenueMultiplier: 1,
      tier: 'stable',
    },
    soldiers: {
      active: 10,
      max: 20,
      occupancyPercent: 50,
    },
    stabilizationEndsAt: null,
    state: overrides.state,
    stateControlledUntil: null,
    war: null,
    warDeclaredAt: null,
    x9: overrides.x9,
  };
}
