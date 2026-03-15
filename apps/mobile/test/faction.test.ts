import { VocationType } from '@cs-rio/shared';
import {
  resolveFactionLedgerDisplayedAmount,
  resolveFactionLedgerEntryLabel,
  resolveFactionNpcProgressionCopy,
  resolveFactionNpcProgressionHeadline,
  resolveFactionNpcProgressionMetrics,
  resolveFactionCoordinationLabel,
  resolveFactionElectionStatusLabel,
  resolveFactionScreenTabLabel,
  sortFactionMembersForDisplay,
  sortFactionsForDisplay,
  summarizeFactionLedger,
} from '../src/features/faction';
import { buildFactionPromotionCue } from '../src/features/faction-promotion';
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

  it('builds faction promotion cues for automatic npc ascension', () => {
    const cue = buildFactionPromotionCue({
      factionAbbreviation: 'CV',
      factionId: 'faction-1',
      factionName: 'Comando Vermelho',
      newRank: 'soldado',
      previousRank: 'cria',
      promotedAt: '2026-03-14T12:00:00.000Z',
      promotionReason: 'Soldado liberado por tempo de facção, nível 3+ e conceito 200+.',
    });

    expect(cue?.title).toContain('Soldado');
    expect(cue?.body).toContain('Cria -> Soldado');
    expect(cue?.factionLabel).toBe('Comando Vermelho · CV');
  });

  it('formats npc progression status for blocked and ready states', () => {
    expect(
      resolveFactionNpcProgressionHeadline({
        blockedReason: null,
        currentRank: 'soldado',
        daysInFaction: 6,
        eligibleNow: true,
        minimumConceitoForNextRank: 1500,
        minimumDaysInFactionForNextRank: 5,
        minimumLevelForNextRank: 5,
        nextRank: 'vapor',
        occupiedSlotsForNextRank: 3,
        remainingConceito: 0,
        remainingDaysInFaction: 0,
        remainingLevel: 0,
        slotAvailable: true,
        slotLimitForNextRank: 10,
      }),
    ).toContain('Promoção para Vapor pronta');

    expect(
      resolveFactionNpcProgressionCopy({
        blockedReason: 'Promoção para General bloqueada: não há vaga para General (2/2).',
        currentRank: 'gerente',
        daysInFaction: 18,
        eligibleNow: false,
        minimumConceitoForNextRank: 50000,
        minimumDaysInFactionForNextRank: 14,
        minimumLevelForNextRank: 8,
        nextRank: 'general',
        occupiedSlotsForNextRank: 2,
        remainingConceito: 0,
        remainingDaysInFaction: 0,
        remainingLevel: 0,
        slotAvailable: false,
        slotLimitForNextRank: 2,
      }),
    ).toContain('não há vaga');

    expect(
      resolveFactionNpcProgressionMetrics({
        blockedReason: null,
        currentRank: 'cria',
        daysInFaction: 1,
        eligibleNow: false,
        minimumConceitoForNextRank: 200,
        minimumDaysInFactionForNextRank: 2,
        minimumLevelForNextRank: 3,
        nextRank: 'soldado',
        occupiedSlotsForNextRank: null,
        remainingConceito: 100,
        remainingDaysInFaction: 1,
        remainingLevel: 1,
        slotAvailable: true,
        slotLimitForNextRank: null,
      }).map((entry) => entry.label),
    ).toEqual(['Dias na facção', 'Meta de dias', 'Nível mínimo', 'Conceito mínimo']);
  });

  it('labels and summarizes faction treasury usage correctly', () => {
    expect(
      resolveFactionLedgerEntryLabel({
        balanceAfter: 7000,
        commissionAmount: 70,
        createdAt: '2026-03-14T12:00:00.000Z',
        description: 'Comissão automática recebida de aposta no jogo do bicho de membro.',
        entryType: 'business_commission',
        grossAmount: 1000,
        id: 'ledger-1',
        netAmount: 930,
        originType: 'bicho',
        playerId: 'player-1',
        playerNickname: 'Radar',
        propertyId: null,
      }),
    ).toContain('bicho');

    expect(
      resolveFactionLedgerDisplayedAmount({
        balanceAfter: 7000,
        commissionAmount: 70,
        createdAt: '2026-03-14T12:00:00.000Z',
        description: 'Comissão automática recebida de aposta no jogo do bicho de membro.',
        entryType: 'business_commission',
        grossAmount: 1000,
        id: 'ledger-1',
        netAmount: 930,
        originType: 'bicho',
        playerId: 'player-1',
        playerNickname: 'Radar',
        propertyId: null,
      }),
    ).toBe(70);

    expect(
      summarizeFactionLedger([
        {
          balanceAfter: 10000,
          commissionAmount: 120,
          createdAt: '2026-03-14T12:00:00.000Z',
          description: 'Comissão automática recebida de boca.',
          entryType: 'business_commission',
          grossAmount: 1000,
          id: 'ledger-1',
          netAmount: 880,
          originType: 'boca',
          playerId: 'player-1',
          playerNickname: 'Radar',
          propertyId: 'property-1',
        },
        {
          balanceAfter: 15000,
          commissionAmount: 0,
          createdAt: '2026-03-14T13:00:00.000Z',
          description: 'Caixinha',
          entryType: 'deposit',
          grossAmount: 5000,
          id: 'ledger-2',
          netAmount: 5000,
          originType: 'manual',
          playerId: 'player-2',
          playerNickname: 'Chefe',
          propertyId: null,
        },
        {
          balanceAfter: 11000,
          commissionAmount: 0,
          createdAt: '2026-03-14T14:00:00.000Z',
          description: 'Desbloqueio do upgrade bonus_atributos_5.',
          entryType: 'withdrawal',
          grossAmount: 4000,
          id: 'ledger-3',
          netAmount: 4000,
          originType: 'upgrade',
          playerId: 'player-2',
          playerNickname: 'Chefe',
          propertyId: null,
        },
      ]),
    ).toMatchObject({
      automaticIncome: 120,
      manualDeposits: 5000,
      manualWithdrawals: 0,
      upgradeSpend: 4000,
    });
  });
});
