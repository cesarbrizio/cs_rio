import { DEFAULT_FACTION_ROBBERY_POLICY, VocationType } from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

import { type FactionContactSyncContract } from '../src/services/contact.js';
import { FactionService, type FactionRepository } from '../src/services/faction.js';

describe('FactionService contact sync integration', () => {
  it('syncs partner contacts after joining a fixed faction', async () => {
    const contactSync: FactionContactSyncContract = {
      syncContactsAfterFactionChange: vi.fn(async (playerId, nextFactionId) => ({
        nextFactionId,
        playerId,
        removedContactIds: [],
        removedPartners: 0,
      })),
    };
    const repository = {
      addMember: vi.fn(async () => true),
      findFactionById: vi
        .fn()
        .mockResolvedValueOnce(buildFactionSummary({ canSelfJoin: true, isFixed: true, isPlayerMember: false }))
        .mockResolvedValueOnce(buildFactionSummary({ canSelfJoin: true, isFixed: true, isPlayerMember: true })),
      getPlayer: vi.fn(async () => ({
        characterCreatedAt: new Date('2026-03-16T14:00:00.000Z'),
        factionId: null,
        id: 'player_01',
        money: 0,
        nickname: 'player_01',
      })),
    } as unknown as FactionRepository;
    const service = new FactionService({
      contactSync,
      repository,
    });

    const response = await service.joinFixedFaction('player_01', 'faccao_a');

    expect(response.playerFactionId).toBe('faccao_a');
    expect(contactSync.syncContactsAfterFactionChange).toHaveBeenCalledWith('player_01', 'faccao_a');
  });

  it('syncs partner contacts after leaving a faction', async () => {
    const contactSync: FactionContactSyncContract = {
      syncContactsAfterFactionChange: vi.fn(async (playerId, nextFactionId) => ({
        nextFactionId,
        playerId,
        removedContactIds: ['partner_01'],
        removedPartners: 1,
      })),
    };
    const repository = {
      findFactionById: vi.fn(async () => buildFactionSummary({ isPlayerMember: true })),
      getPlayer: vi.fn(async () => ({
        characterCreatedAt: new Date('2026-03-16T14:00:00.000Z'),
        factionId: 'faccao_a',
        id: 'player_01',
        money: 0,
        nickname: 'player_01',
      })),
      listFactionMembers: vi.fn(async () => [
        {
          factionId: 'faccao_a',
          joinedAt: new Date('2026-03-10T10:00:00.000Z'),
          level: 4,
          nickname: 'player_01',
          playerId: 'player_01',
          rank: 'cria',
          vocation: VocationType.Cria,
        },
      ]),
      removeMember: vi.fn(async () => true),
    } as unknown as FactionRepository;
    const service = new FactionService({
      contactSync,
      repository,
    });

    const response = await service.leaveFaction('player_01', 'faccao_a');

    expect(response).toEqual({
      factionId: 'faccao_a',
      playerFactionId: null,
    });
    expect(contactSync.syncContactsAfterFactionChange).toHaveBeenCalledWith('player_01', null);
  });
});

function buildFactionSummary(input: {
  canSelfJoin?: boolean;
  isFixed?: boolean;
  isPlayerMember?: boolean;
}) {
  return {
    availableJoinSlots: 3,
    abbreviation: 'FA',
    bankMoney: 0,
    canConfigure: true,
    canDissolve: true,
    canSelfJoin: input.canSelfJoin ?? false,
    createdAt: '2026-03-10T10:00:00.000Z',
    description: null,
    id: 'faccao_a',
    internalSatisfaction: 60,
    isFixed: input.isFixed ?? false,
    isNpcControlled: false,
    isPlayerMember: input.isPlayerMember ?? true,
    leaderId: 'lider_01',
    memberCount: 1,
    myRank: input.isPlayerMember === false ? null : 'cria',
    name: 'Faccao A',
    npcLeaderName: null,
    points: 0,
    robberyPolicy: DEFAULT_FACTION_ROBBERY_POLICY,
  };
}
