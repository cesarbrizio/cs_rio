import {
  type FactionCoordinationKind,
  type FactionCrimeCatalogResponse,
  type FactionListResponse,
  type FactionBankResponse,
  type FactionLeadershipCenterResponse,
  type FactionMemberSummary,
  type FactionMembersResponse,
  type FactionUpgradeType,
  type FactionUpgradeCenterResponse,
  type PlayerProfile,
} from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  sortFactionMembersForDisplay,
  sortFactionsForDisplay,
  summarizeFactionLedger,
} from './factionHelpers';

interface UseFactionControllerInput {
  factionApi: {
    create: (input: {
      abbreviation: string;
      description?: string | null;
      name: string;
    }) => Promise<unknown>;
    deposit: (factionId: string, input: { amount: number; description?: string }) => Promise<unknown>;
    getBank: (factionId: string) => Promise<FactionBankResponse>;
    getLeadership: (factionId: string) => Promise<FactionLeadershipCenterResponse>;
    getMembers: (factionId: string) => Promise<FactionMembersResponse>;
    getUpgrades: (factionId: string) => Promise<FactionUpgradeCenterResponse>;
    join: (factionId: string) => Promise<unknown>;
    leave: (factionId: string) => Promise<unknown>;
    list: () => Promise<FactionListResponse>;
    supportLeadershipElection: (factionId: string) => Promise<unknown>;
    unlockUpgrade: (factionId: string, upgradeType: FactionUpgradeType) => Promise<unknown>;
    voteLeadership: (factionId: string, input: { candidatePlayerId: string }) => Promise<unknown>;
    withdraw: (factionId: string, input: { amount: number; description?: string }) => Promise<unknown>;
  };
  factionCrimeApi: {
    getCatalog: (factionId: string) => Promise<FactionCrimeCatalogResponse>;
  };
  player: PlayerProfile | null;
  realtimeService: Pick<
    {
      connectToFactionRoom: (input: { accessToken: string; factionId: string }) => Promise<unknown>;
      disconnect: () => Promise<unknown>;
      getSnapshot: () => FactionRealtimeSnapshot;
      sendChatMessage: (message: string) => void;
      sendCoordinationMessage: (input: { kind: FactionCoordinationKind; label: string }) => void;
      subscribe: (
        listener: (snapshot: FactionRealtimeSnapshot) => void,
      ) => () => void;
    },
    | 'connectToFactionRoom'
    | 'disconnect'
    | 'getSnapshot'
    | 'sendChatMessage'
    | 'sendCoordinationMessage'
    | 'subscribe'
  >;
  refreshPlayerProfile: () => Promise<unknown>;
  token: string | null;
}

interface FactionRealtimeMemberSnapshot {
  playerId: string;
}

interface FactionRealtimeChatEntrySnapshot {
  createdAt: string;
  id: string;
  message: string;
  nickname: string;
}

interface FactionRealtimeCoordinationSnapshot {
  createdAt: string;
  id: string;
  kind: FactionCoordinationKind;
  label: string;
  nickname: string;
}

interface FactionRealtimeSnapshot {
  chatMessages: FactionRealtimeChatEntrySnapshot[];
  coordinationCalls: FactionRealtimeCoordinationSnapshot[];
  members: FactionRealtimeMemberSnapshot[];
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
}

const MANAGEMENT_RANKS = new Set(['patrao', 'general', 'gerente']);

export function useFactionController({
  factionApi,
  factionCrimeApi,
  player,
  realtimeService,
  refreshPlayerProfile,
  token,
}: UseFactionControllerInput) {
  const [bankBook, setBankBook] = useState<FactionBankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [factionList, setFactionList] = useState<FactionListResponse | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [leadershipCenter, setLeadershipCenter] = useState<FactionLeadershipCenterResponse | null>(null);
  const [membersBook, setMembersBook] = useState<FactionMembersResponse | null>(null);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<FactionRealtimeSnapshot>(
    realtimeService.getSnapshot(),
  );
  const [upgradeBook, setUpgradeBook] = useState<FactionUpgradeCenterResponse | null>(null);
  const [warCatalog, setWarCatalog] = useState<FactionCrimeCatalogResponse | null>(null);

  const currentFactionId = factionList?.playerFactionId ?? player?.faction?.id ?? null;
  const currentFaction = useMemo(
    () => factionList?.factions.find((entry) => entry.id === currentFactionId) ?? null,
    [currentFactionId, factionList?.factions],
  );
  const myRank = currentFaction?.myRank ?? player?.faction?.rank ?? null;
  const canManageFaction = myRank !== null && MANAGEMENT_RANKS.has(myRank);
  const sortedFactions = useMemo(
    () => sortFactionsForDisplay(factionList?.factions ?? [], factionList?.playerFactionId ?? null),
    [factionList?.factions, factionList?.playerFactionId],
  );
  const onlinePlayerIds = useMemo(
    () => realtimeSnapshot.members.map((entry) => entry.playerId),
    [realtimeSnapshot.members],
  );
  const sortedMembers = useMemo<FactionMemberSummary[]>(
    () => sortFactionMembersForDisplay(membersBook?.members ?? [], onlinePlayerIds),
    [membersBook?.members, onlinePlayerIds],
  );
  const bankLedgerSummary = useMemo(
    () => summarizeFactionLedger(bankBook?.ledger ?? []),
    [bankBook?.ledger],
  );

  const loadFactionHub = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const list = await factionApi.list();
      setFactionList(list);

      if (!list.playerFactionId) {
        setMembersBook(null);
        setBankBook(null);
        setUpgradeBook(null);
        setLeadershipCenter(null);
        setWarCatalog(null);
        return;
      }

      const [nextMembers, nextBank, nextUpgrades, nextLeadership, nextWarCatalog] =
        await Promise.allSettled([
          factionApi.getMembers(list.playerFactionId),
          factionApi.getBank(list.playerFactionId),
          factionApi.getUpgrades(list.playerFactionId),
          factionApi.getLeadership(list.playerFactionId),
          factionCrimeApi.getCatalog(list.playerFactionId),
        ]);

      setMembersBook(nextMembers.status === 'fulfilled' ? nextMembers.value : null);
      setBankBook(nextBank.status === 'fulfilled' ? nextBank.value : null);
      setUpgradeBook(nextUpgrades.status === 'fulfilled' ? nextUpgrades.value : null);
      setLeadershipCenter(nextLeadership.status === 'fulfilled' ? nextLeadership.value : null);
      setWarCatalog(nextWarCatalog.status === 'fulfilled' ? nextWarCatalog.value : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a faccao.');
    } finally {
      setIsLoading(false);
    }
  }, [factionApi, factionCrimeApi]);

  useEffect(() => {
    void loadFactionHub();
  }, [loadFactionHub]);

  useEffect(() => realtimeService.subscribe(setRealtimeSnapshot), [realtimeService]);

  useEffect(() => {
    if (!token || !currentFactionId) {
      void realtimeService.disconnect();
      return;
    }

    void realtimeService.connectToFactionRoom({
      accessToken: token,
      factionId: currentFactionId,
    });

    return () => {
      void realtimeService.disconnect();
    };
  }, [currentFactionId, realtimeService, token]);

  const runMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setError(null);
      setIsMutating(true);

      try {
        await operation();
        await refreshPlayerProfile();
        await loadFactionHub();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Falha ao atualizar a faccao.');
      } finally {
        setIsMutating(false);
      }
    },
    [loadFactionHub, refreshPlayerProfile],
  );

  const createFaction = useCallback(
    async (input: { abbreviation: string; description?: string; name: string }) => {
      await runMutation(async () => {
        await factionApi.create({
          abbreviation: input.abbreviation,
          description: input.description ?? null,
          name: input.name,
        });
        setFeedback(`Faccao ${input.name} criada.`);
      });
    },
    [factionApi, runMutation],
  );

  const joinFaction = useCallback(
    async (factionId: string, factionName: string) => {
      await runMutation(async () => {
        await factionApi.join(factionId);
        setFeedback(`Entrada solicitada para ${factionName}.`);
      });
    },
    [factionApi, runMutation],
  );

  const leaveFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(async () => {
      await factionApi.leave(currentFactionId);
      setFeedback('Voce saiu da faccao atual.');
    });
  }, [currentFactionId, factionApi, runMutation]);

  const depositBank = useCallback(
    async (amount: number, description?: string) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(async () => {
        await factionApi.deposit(currentFactionId, { amount, description });
        setFeedback(`Deposito de ${amount.toLocaleString('pt-BR')} realizado.`);
      });
    },
    [currentFactionId, factionApi, runMutation],
  );

  const withdrawBank = useCallback(
    async (amount: number, description?: string) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(async () => {
        await factionApi.withdraw(currentFactionId, { amount, description });
        setFeedback(`Saque de ${amount.toLocaleString('pt-BR')} realizado.`);
      });
    },
    [currentFactionId, factionApi, runMutation],
  );

  const unlockUpgrade = useCallback(
    async (upgradeType: FactionUpgradeType) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(async () => {
        await factionApi.unlockUpgrade(currentFactionId, upgradeType as FactionUpgradeType);
        setFeedback(`Upgrade ${upgradeType} liberado.`);
      });
    },
    [currentFactionId, factionApi, runMutation],
  );

  const supportLeadership = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(async () => {
      await factionApi.supportLeadershipElection(currentFactionId);
      setFeedback('Abaixo-assinado de lideranca atualizado.');
    });
  }, [currentFactionId, factionApi, runMutation]);

  const voteLeadership = useCallback(
    async (candidatePlayerId: string) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(async () => {
        await factionApi.voteLeadership(currentFactionId, { candidatePlayerId });
        setFeedback('Voto registrado na lideranca.');
      });
    },
    [currentFactionId, factionApi, runMutation],
  );

  const sendFactionChat = useCallback(
    (message: string) => {
      if (!message.trim()) {
        return;
      }

      realtimeService.sendChatMessage(message);
      setFeedback('Mensagem enviada para a sala da faccao.');
    },
    [realtimeService],
  );

  const sendCoordination = useCallback(
    (kind: FactionCoordinationKind, label: string) => {
      if (!label.trim()) {
        return;
      }

      realtimeService.sendCoordinationMessage({ kind, label });
      setFeedback('Chamado de coordenacao enviado.');
    },
    [realtimeService],
  );

  return {
    bankBook,
    bankLedgerSummary,
    canManageFaction,
    createFaction,
    currentFaction,
    currentFactionId,
    depositBank,
    error,
    factionList,
    feedback,
    isLoading,
    isMutating,
    joinFaction,
    leadershipCenter,
    leaveFaction,
    loadFactionHub,
    membersBook,
    realtimeSnapshot,
    sendCoordination,
    sendFactionChat,
    sortedFactions,
    sortedMembers,
    supportLeadership,
    unlockUpgrade,
    upgradeBook,
    voteLeadership,
    warCatalog,
    withdrawBank,
  };
}
