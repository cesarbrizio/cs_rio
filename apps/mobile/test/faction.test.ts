import { VocationType } from '@cs-rio/shared';
import {
  resolveFactionCoordinationLabel,
  resolveFactionElectionStatusLabel,
  resolveFactionScreenTabLabel,
  sortFactionMembersForDisplay,
  sortFactionsForDisplay,
} from '../src/features/faction';
import { describe, expect, it } from 'vitest';

describe('faction helpers', () => {
  it('keeps the player faction pinned and sorts the rest by points', () => {
    const factions = sortFactionsForDisplay(
      [
        {
          availableJoinSlots: 16,
          abbreviation: 'TCP',
          bankMoney: 8000,
          canConfigure: false,
          canDissolve: false,
          canSelfJoin: true,
          createdAt: '2026-03-10T00:00:00.000Z',
          description: null,
          id: 'faction-2',
          internalSatisfaction: 52,
          isFixed: true,
          isNpcControlled: false,
          isPlayerMember: false,
          leaderId: null,
          memberCount: 4,
          myRank: null,
          name: 'Terceiro Comando',
          npcLeaderName: null,
          points: 140,
          robberyPolicy: {
            global: 'allowed',
            regions: {},
          },
        },
        {
          availableJoinSlots: 13,
          abbreviation: 'CV',
          bankMoney: 12000,
          canConfigure: true,
          canDissolve: false,
          canSelfJoin: false,
          createdAt: '2026-03-09T00:00:00.000Z',
          description: null,
          id: 'faction-1',
          internalSatisfaction: 66,
          isFixed: true,
          isNpcControlled: false,
          isPlayerMember: true,
          leaderId: 'player-1',
          memberCount: 7,
          myRank: 'general',
          name: 'Comando Vermelho',
          npcLeaderName: null,
          points: 90,
          robberyPolicy: {
            global: 'allowed',
            regions: {},
          },
        },
        {
          availableJoinSlots: 15,
          abbreviation: 'ADA',
          bankMoney: 9000,
          canConfigure: false,
          canDissolve: false,
          canSelfJoin: true,
          createdAt: '2026-03-08T00:00:00.000Z',
          description: null,
          id: 'faction-3',
          internalSatisfaction: 47,
          isFixed: true,
          isNpcControlled: true,
          isPlayerMember: false,
          leaderId: null,
          memberCount: 5,
          myRank: null,
          name: 'Amigos dos Amigos',
          npcLeaderName: 'Lider',
          points: 130,
          robberyPolicy: {
            global: 'allowed',
            regions: {},
          },
        },
      ],
      'faction-1',
    );

    expect(factions.map((entry) => entry.id)).toEqual(['faction-1', 'faction-2', 'faction-3']);
  });

  it('prioritizes online leaders and then rank in the member roster', () => {
    const members = sortFactionMembersForDisplay(
      [
        {
          id: 'player-3',
          isLeader: false,
          isNpc: false,
          joinedAt: '2026-03-01T00:00:00.000Z',
          level: 8,
          nickname: 'Boca',
          rank: 'soldado',
          vocation: VocationType.Soldado,
        },
        {
          id: 'player-1',
          isLeader: true,
          isNpc: false,
          joinedAt: '2026-03-01T00:00:00.000Z',
          level: 12,
          nickname: 'Chefe',
          rank: 'patrao',
          vocation: VocationType.Politico,
        },
        {
          id: 'player-2',
          isLeader: false,
          isNpc: false,
          joinedAt: '2026-03-01T00:00:00.000Z',
          level: 10,
          nickname: 'Radar',
          rank: 'general',
          vocation: VocationType.Soldado,
        },
      ],
      ['player-2', 'player-1'],
    );

    expect(members.map((entry) => entry.id)).toEqual(['player-1', 'player-2', 'player-3']);
  });

  it('resolves tab and coordination labels for the faction hub', () => {
    expect(resolveFactionScreenTabLabel('leadership')).toBe('Candidatura');
    expect(resolveFactionCoordinationLabel('defend')).toBe('Defesa');
    expect(resolveFactionElectionStatusLabel('petitioning')).toBe('Abaixo-assinado');
  });
});
