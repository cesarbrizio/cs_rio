import { RegionId, type TerritoryOverviewResponse } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { buildPendingWarResultCues, buildWarResultCue, isResolvedWarStatus } from '../src/features/war-results';

describe('war result helpers', () => {
  it('builds a cue with territorial and personal impact for resolved wars', () => {
    const overview = buildOverview();
    const cue = buildWarResultCue(
      overview.favelas[0],
      {
        faction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        regionId: RegionId.ZonaNorte,
      } as never,
      new Date('2026-03-14T15:00:00.000Z').getTime(),
    );

    expect(cue?.winnerLabel).toBe('CV venceu');
    expect(cue?.territorialImpact).toContain('tomou Complexo da Penha');
    expect(cue?.personalImpact.directParticipation).toBe(true);
    expect(cue?.personalImpact.conceitoDelta).toBe(120);
    expect(cue?.personalImpact.hpLoss).toBe(34);
    expect(cue?.scoreLabel).toBe('2 x 1');
  });

  it('filters out seen or unrelated war resolutions', () => {
    const overview = buildOverview();
    const cues = buildPendingWarResultCues({
      nowMs: new Date('2026-03-14T15:00:00.000Z').getTime(),
      overview,
      player: {
        faction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        regionId: RegionId.ZonaSul,
      } as never,
      seenKeys: new Set([`war:war-1:attacker_won:2026-03-14T14:10:00.000Z`]),
    });

    expect(cues).toHaveLength(0);
  });

  it('recognizes only final war statuses as resolved', () => {
    expect(isResolvedWarStatus('active')).toBe(false);
    expect(isResolvedWarStatus('attacker_won')).toBe(true);
    expect(isResolvedWarStatus('defender_won')).toBe(true);
    expect(isResolvedWarStatus('draw')).toBe(true);
    expect(isResolvedWarStatus('cancelled')).toBe(true);
  });
});

function buildOverview(): TerritoryOverviewResponse {
  return {
    favelas: [
      {
        bandits: {
          active: 20,
          arrested: 0,
          deadRecent: 0,
          nextReturnAt: null,
          scheduledReturnBatches: 0,
          syncedAt: '2026-03-14T14:00:00.000Z',
          targetActive: 20,
        },
        code: 'penha',
        contestingFaction: null,
        controllingFaction: {
          abbreviation: 'CV',
          id: 'faction-cv',
          name: 'Comando Vermelho',
        },
        difficulty: 20,
        id: 'favela-1',
        name: 'Complexo da Penha',
        population: 30000,
        propina: null,
        propinaValue: 0,
        regionId: RegionId.ZonaNorte,
        satisfaction: 61,
        satisfactionProfile: {
          dailyDeltaEstimate: 0,
          dailyX9RiskPercent: 0,
          factors: [],
          populationPressurePercentPerDay: 0,
          revenueMultiplier: 1,
          tier: 'stable',
        },
        soldiers: {
          active: 10,
          max: 30,
          occupancyPercent: 33,
        },
        stabilizationEndsAt: '2026-03-16T12:00:00.000Z',
        state: 'controlled',
        stateControlledUntil: null,
        war: {
          attackerFaction: {
            abbreviation: 'CV',
            id: 'faction-cv',
            name: 'Comando Vermelho',
          },
          attackerPreparation: null,
          attackerScore: 2,
          cooldownEndsAt: '2026-03-15T14:10:00.000Z',
          declaredAt: '2026-03-14T12:00:00.000Z',
          declaredByPlayerId: 'player-1',
          defenderFaction: {
            abbreviation: 'TCP',
            id: 'faction-tcp',
            name: 'Terceiro Comando',
          },
          defenderPreparation: null,
          defenderScore: 1,
          endedAt: '2026-03-14T14:10:00.000Z',
          favelaId: 'favela-1',
          id: 'war-1',
          lootMoney: 42000,
          nextRoundAt: null,
          preparationEndsAt: null,
          rounds: [
            {
              attackerHpLoss: 14,
              attackerNerveLoss: 9,
              attackerPower: 400,
              attackerStaminaLoss: 11,
              defenderHpLoss: 18,
              defenderNerveLoss: 10,
              defenderPower: 350,
              defenderStaminaLoss: 12,
              message: 'Round 1',
              outcome: 'attacker',
              resolvedAt: '2026-03-14T13:10:00.000Z',
              roundNumber: 1,
            },
            {
              attackerHpLoss: 20,
              attackerNerveLoss: 11,
              attackerPower: 420,
              attackerStaminaLoss: 16,
              defenderHpLoss: 24,
              defenderNerveLoss: 12,
              defenderPower: 330,
              defenderStaminaLoss: 18,
              message: 'Round 2',
              outcome: 'attacker',
              resolvedAt: '2026-03-14T14:10:00.000Z',
              roundNumber: 2,
            },
          ],
          roundsResolved: 2,
          roundsTotal: 3,
          startsAt: '2026-03-14T12:30:00.000Z',
          status: 'attacker_won',
          winnerFactionId: 'faction-cv',
        },
        warDeclaredAt: '2026-03-14T12:00:00.000Z',
        x9: null,
      },
    ],
    playerFactionId: 'faction-cv',
    regions: [
      {
        atWarFavelas: 0,
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
        totalFavelas: 1,
      },
    ],
  };
}
