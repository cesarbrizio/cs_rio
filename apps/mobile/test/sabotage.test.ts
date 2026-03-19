import {
  PROPERTY_SABOTAGE_CANSACO_COST,
  PROPERTY_SABOTAGE_DISPOSICAO_COST,
  RegionId,
  type PropertySabotageCenterResponse,
} from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

const secureStoreState = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreState.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.set(key, value);
  }),
}));

import {
  buildOwnedSabotageRecoveryCards,
  buildPendingSabotageCues,
  buildSabotageCue,
  formatSabotageAvailabilityCost,
  formatSabotageCooldown,
  formatSabotageRecoveryStatus,
} from '../src/features/sabotage';
import {
  loadSeenSabotageCueKeys,
  rememberSeenSabotageCue,
} from '../src/features/sabotage-storage';

describe('sabotage helpers', () => {
  it('builds pending sabotage cues for attacker and defender perspectives', () => {
    const center: PropertySabotageCenterResponse = {
      availability: {
        available: true,
        cansacoCost: PROPERTY_SABOTAGE_CANSACO_COST,
        disposicaoCost: PROPERTY_SABOTAGE_DISPOSICAO_COST,
        levelRequired: 5,
        reason: null,
      },
      player: {
        factionId: 'faction-cv',
        id: 'player-attacker',
        level: 7,
        nickname: 'MenorLiso',
        regionId: RegionId.Centro,
        resources: {
          cansaco: 100,
          disposicao: 100,
        },
      },
      recentLogs: [
        {
          attackRatio: 1.65,
          attackScore: 140,
          attackerFactionId: 'faction-cv',
          attackerPlayerId: 'player-attacker',
          createdAt: '2026-03-16T10:00:00.000Z',
          defenseScore: 85,
          favelaId: 'favela-1',
          heatDelta: 5,
          id: 'log-1',
          outcome: 'destroyed',
          ownerAlertMode: 'anonymous',
          ownerFactionId: 'faction-tcp',
          ownerPlayerId: 'player-owner',
          prisonMinutes: null,
          propertyId: 'prop-1',
          regionId: RegionId.Centro,
          type: 'boca',
        },
        {
          attackRatio: 1.2,
          attackScore: 100,
          attackerFactionId: 'faction-tcp',
          attackerPlayerId: 'player-rival',
          createdAt: '2026-03-16T11:00:00.000Z',
          defenseScore: 82,
          favelaId: 'favela-1',
          heatDelta: 5,
          id: 'log-2',
          outcome: 'damaged',
          ownerAlertMode: 'anonymous',
          ownerFactionId: 'faction-cv',
          ownerPlayerId: 'player-attacker',
          prisonMinutes: null,
          propertyId: 'prop-2',
          regionId: RegionId.Centro,
          type: 'puteiro',
        },
      ],
      targets: [],
    };

    const pending = buildPendingSabotageCues({
      center,
      nowMs: new Date('2026-03-16T12:00:00.000Z').getTime(),
      playerId: 'player-attacker',
      seenKeys: new Set<string>(),
    });

    expect(pending).toHaveLength(2);
    expect(pending[0]).toMatchObject({
      key: 'sabotage:attack:log-1:2026-03-16T10:00:00.000Z',
      outcomeTone: 'success',
      perspective: 'attack',
      propertyId: 'prop-1',
    });
    expect(pending[1]).toMatchObject({
      key: 'sabotage:defense:log-2:2026-03-16T11:00:00.000Z',
      outcomeTone: 'danger',
      perspective: 'defense',
      propertyId: 'prop-2',
    });
    expect(
      buildSabotageCue(
        center.recentLogs[0]!,
        'player-attacker',
        new Date('2026-03-16T12:00:00.000Z').getTime(),
      )?.recoveryHint,
    ).toContain('Reconstrução');
    expect(formatSabotageAvailabilityCost(center.availability)).toBe('40 Cansaço · 20 Disposição');
    expect(formatSabotageCooldown(4_200)).toContain('1h');
  });

  it('filters damaged owned properties and formats recovery state', () => {
    const cards = buildOwnedSabotageRecoveryCards([
      {
        id: 'prop-normal',
        sabotageStatus: {
          blocked: false,
          operationalMultiplier: 1,
          recoveryCost: null,
          recoveryReady: false,
          recoveryReadyAt: null,
          resolvedAt: null,
          state: 'normal',
        },
        type: 'house',
      },
      {
        id: 'prop-destroyed',
        sabotageStatus: {
          blocked: true,
          operationalMultiplier: 0,
          recoveryCost: 12500,
          recoveryReady: true,
          recoveryReadyAt: '2026-03-16T11:00:00.000Z',
          resolvedAt: '2026-03-16T10:00:00.000Z',
          state: 'destroyed',
        },
        type: 'boca',
      },
    ] as never);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe('prop-destroyed');
    expect(formatSabotageRecoveryStatus(cards[0]!)).toBe('Reparo liberado agora');
  });

  it('stores seen sabotage cue keys per player', async () => {
    secureStoreState.clear();

    const before = await loadSeenSabotageCueKeys('player-1');
    expect(before.size).toBe(0);

    const after = await rememberSeenSabotageCue(
      'player-1',
      'sabotage:defense:log-1:2026-03-16T10:00:00.000Z',
    );

    expect(after.has('sabotage:defense:log-1:2026-03-16T10:00:00.000Z')).toBe(true);
  });
});
