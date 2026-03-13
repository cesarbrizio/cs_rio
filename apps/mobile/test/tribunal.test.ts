import { RegionId } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  buildControlledTribunalFavelas,
  formatTribunalTimestamp,
  pickInitialTribunalFavelaId,
  resolveTribunalJudgmentReadLabel,
  resolveTribunalPunishmentLabel,
  resolveTribunalPunishmentReadLabel,
  resolveTribunalRegionLabel,
  resolveTribunalSeverityLabel,
  resolveTribunalSideLabel,
} from '../src/features/tribunal';

describe('tribunal helpers', () => {
  it('filters and orders controlled favelas for the tribunal screen', () => {
    const controlledFavelas = buildControlledTribunalFavelas({
      favelas: [
        {
          code: 'centro-1',
          contestingFaction: null,
          controllingFaction: { abbreviation: 'ADA', id: 'f1', name: 'Amigos' },
          difficulty: 12,
          id: 'favela-centro',
          name: 'Favela do Centro',
          population: 5000,
          bandits: {
            active: 14,
            arrested: 1,
            deadRecent: 0,
            nextReturnAt: '2026-03-12T10:00:00.000Z',
            scheduledReturnBatches: 1,
            syncedAt: '2026-03-11T12:00:00.000Z',
            targetActive: 15,
          },
          propina: null,
          propinaValue: 0,
          regionId: RegionId.Centro,
          satisfaction: 72,
          satisfactionProfile: {
            dailyDeltaEstimate: 0,
            dailyX9RiskPercent: 5,
            factors: [],
            populationPressurePercentPerDay: 0,
            revenueMultiplier: 1,
            tier: 'stable',
          },
          stabilizationEndsAt: null,
          state: 'controlled',
          stateControlledUntil: null,
          soldiers: {
            active: 12,
            max: 30,
            occupancyPercent: 40,
          },
          war: null,
          warDeclaredAt: null,
          x9: null,
        },
        {
          code: 'zn-1',
          contestingFaction: null,
          controllingFaction: { abbreviation: 'TCP', id: 'f2', name: 'TCP' },
          difficulty: 10,
          id: 'favela-rival',
          name: 'Favela Rival',
          population: 4500,
          bandits: {
            active: 12,
            arrested: 0,
            deadRecent: 0,
            nextReturnAt: null,
            scheduledReturnBatches: 0,
            syncedAt: '2026-03-11T12:00:00.000Z',
            targetActive: 12,
          },
          propina: null,
          propinaValue: 0,
          regionId: RegionId.ZonaNorte,
          satisfaction: 60,
          satisfactionProfile: {
            dailyDeltaEstimate: 0,
            dailyX9RiskPercent: 7,
            factors: [],
            populationPressurePercentPerDay: 0,
            revenueMultiplier: 1,
            tier: 'restless',
          },
          stabilizationEndsAt: null,
          state: 'controlled',
          stateControlledUntil: null,
          soldiers: {
            active: 9,
            max: 28,
            occupancyPercent: 32,
          },
          war: null,
          warDeclaredAt: null,
          x9: null,
        },
        {
          code: 'zo-1',
          contestingFaction: null,
          controllingFaction: { abbreviation: 'ADA', id: 'f1', name: 'Amigos' },
          difficulty: 9,
          id: 'favela-zona-oeste',
          name: 'Barraco Azul',
          population: 4300,
          bandits: {
            active: 11,
            arrested: 2,
            deadRecent: 1,
            nextReturnAt: '2026-03-14T09:00:00.000Z',
            scheduledReturnBatches: 1,
            syncedAt: '2026-03-11T12:00:00.000Z',
            targetActive: 13,
          },
          propina: null,
          propinaValue: 0,
          regionId: RegionId.ZonaOeste,
          satisfaction: 66,
          satisfactionProfile: {
            dailyDeltaEstimate: 0,
            dailyX9RiskPercent: 4,
            factors: [],
            populationPressurePercentPerDay: 0,
            revenueMultiplier: 1,
            tier: 'stable',
          },
          stabilizationEndsAt: null,
          state: 'controlled',
          stateControlledUntil: null,
          soldiers: {
            active: 10,
            max: 26,
            occupancyPercent: 38,
          },
          war: null,
          warDeclaredAt: null,
          x9: null,
        },
      ],
      playerFactionId: 'f1',
      regions: [],
    });

    expect(controlledFavelas.map((favela) => favela.id)).toEqual([
      'favela-centro',
      'favela-zona-oeste',
    ]);
    expect(pickInitialTribunalFavelaId(controlledFavelas, 'favela-zona-oeste')).toBe('favela-zona-oeste');
    expect(pickInitialTribunalFavelaId(controlledFavelas, 'nao-existe')).toBe('favela-centro');
  });

  it('formats tribunal labels for mobile copy', () => {
    expect(resolveTribunalPunishmentLabel('queimar_no_pneu')).toBe('Queimar no pneu');
    expect(resolveTribunalPunishmentReadLabel('dureza_arriscada')).toBe('Dureza arriscada');
    expect(resolveTribunalJudgmentReadLabel('brutal_desnecessaria')).toBe('Brutal desnecessária');
    expect(resolveTribunalSeverityLabel('media_alta')).toBe('Média / alta');
    expect(resolveTribunalSideLabel('accuser')).toBe('Acusador');
    expect(resolveTribunalRegionLabel('zona_norte')).toBe('Zona Norte');
  });

  it('formats tribunal timestamps for the UI', () => {
    expect(formatTribunalTimestamp('2026-03-11T12:05:00.000Z')).toBe('11/03, 09:05');
  });
});
