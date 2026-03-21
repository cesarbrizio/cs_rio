import {
  type FactionCoordinationKind,
} from '@cs-rio/shared';
import { useFocusEffect, useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type RootStackParamList } from '../../App';
import {
  sortFactionMembersForDisplay,
  sortFactionsForDisplay,
  summarizeFactionLedger,
  type FactionScreenTab,
} from '../features/faction';
import { factionApi, factionCrimeApi, formatApiError } from '../services/api';
import { factionRealtimeService, type FactionRealtimeSnapshot } from '../services/factionRealtime';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { useFactionScreenMutations } from './useFactionScreenMutations';

const MANAGEMENT_RANKS = new Set(['patrao', 'general', 'gerente']);
const MODERATION_RANKS = new Set(['patrao', 'general']);

export function useFactionScreenController() {
  const route = useRoute<RouteProp<RootStackParamList, 'Faction'>>();
  const isFocused = useIsFocused();
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [activeTab, setActiveTab] = useState<FactionScreenTab>(
    route.params?.initialTab ?? 'overview',
  );
  const [factionList, setFactionList] = useState<Awaited<
    ReturnType<typeof factionApi.list>
  > | null>(null);
  const [membersBook, setMembersBook] = useState<Awaited<
    ReturnType<typeof factionApi.getMembers>
  > | null>(null);
  const [bankBook, setBankBook] = useState<Awaited<ReturnType<typeof factionApi.getBank>> | null>(
    null,
  );
  const [upgradeBook, setUpgradeBook] = useState<Awaited<
    ReturnType<typeof factionApi.getUpgrades>
  > | null>(null);
  const [leadershipCenter, setLeadershipCenter] = useState<Awaited<
    ReturnType<typeof factionApi.getLeadership>
  > | null>(null);
  const [warCatalog, setWarCatalog] = useState<Awaited<
    ReturnType<typeof factionCrimeApi.getCatalog>
  > | null>(null);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<FactionRealtimeSnapshot>(
    factionRealtimeService.getSnapshot(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createAbbreviation, setCreateAbbreviation] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [configName, setConfigName] = useState('');
  const [configAbbreviation, setConfigAbbreviation] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [recruitNickname, setRecruitNickname] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [coordinationLabel, setCoordinationLabel] = useState('');
  const [coordinationKind, setCoordinationKind] = useState<FactionCoordinationKind>('attack');
  const [selectedCrimeId, setSelectedCrimeId] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  const currentFactionId = factionList?.playerFactionId ?? player?.faction?.id ?? null;
  const currentFaction = useMemo(
    () => factionList?.factions.find((entry) => entry.id === currentFactionId) ?? null,
    [currentFactionId, factionList?.factions],
  );
  const myRank = currentFaction?.myRank ?? player?.faction?.rank ?? null;
  const canRecruitMembers = myRank !== null && MANAGEMENT_RANKS.has(myRank);
  const canModerateMembers = myRank !== null && MODERATION_RANKS.has(myRank);
  const sortedFactions = useMemo(
    () => sortFactionsForDisplay(factionList?.factions ?? [], factionList?.playerFactionId ?? null),
    [factionList?.factions, factionList?.playerFactionId],
  );
  const onlinePlayerIds = useMemo(
    () => realtimeSnapshot.members.map((entry) => entry.playerId),
    [realtimeSnapshot.members],
  );
  const bankLedgerSummary = useMemo(
    () => summarizeFactionLedger(bankBook?.ledger ?? []),
    [bankBook?.ledger],
  );
  const sortedMembers = useMemo(
    () => sortFactionMembersForDisplay(membersBook?.members ?? [], onlinePlayerIds),
    [membersBook?.members, onlinePlayerIds],
  );
  const selectedCrime = useMemo(
    () =>
      warCatalog?.crimes.find((entry) => entry.id === selectedCrimeId) ??
      warCatalog?.crimes[0] ??
      null,
    [selectedCrimeId, warCatalog?.crimes],
  );
  const eligibleWarMembers = useMemo(
    () => (warCatalog?.members ?? []).filter((entry) => entry.lockReason === null),
    [warCatalog?.members],
  );
  const selectedCrimeParticipants = useMemo(
    () => eligibleWarMembers.filter((entry) => selectedParticipantIds.includes(entry.id)),
    [eligibleWarMembers, selectedParticipantIds],
  );
  const canLaunchSelectedCrime = Boolean(
    warCatalog?.coordinatorCanStart &&
    selectedCrime?.isRunnable &&
    selectedCrimeParticipants.length >= (selectedCrime?.minimumCrewSize ?? 99) &&
    selectedCrimeParticipants.length <= (selectedCrime?.maximumCrewSize ?? 0),
  );
  const sortedRealtimeChat = useMemo(
    () => [...realtimeSnapshot.chatMessages].reverse(),
    [realtimeSnapshot.chatMessages],
  );
  const sortedRealtimeCoordination = useMemo(
    () => [...realtimeSnapshot.coordinationCalls].reverse(),
    [realtimeSnapshot.coordinationCalls],
  );
  const latestRealtimeChat = sortedRealtimeChat[0] ?? null;
  const latestRealtimeCoordination = sortedRealtimeCoordination[0] ?? null;
  const getFactionAvailableJoinSlots = useCallback(
    (faction: (typeof sortedFactions)[number]) =>
      (faction as typeof faction & { availableJoinSlots?: number | null }).availableJoinSlots ??
      null,
    [],
  );
  const getFactionCanSelfJoin = useCallback(
    (faction: (typeof sortedFactions)[number]) =>
      (faction as typeof faction & { canSelfJoin?: boolean }).canSelfJoin === true,
    [],
  );

  const loadFactionHub = useCallback(async () => {
    setIsLoading(true);
    setLoadErrorMessage(null);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const list = await factionApi.list();
      setFactionList(list);
      const listCurrentFaction =
        list.factions.find((entry) => entry.id === list.playerFactionId) ?? null;

      if (listCurrentFaction?.autoPromotionResult) {
        await refreshPlayerProfile();
      }

      if (!list.playerFactionId) {
        setMembersBook(null);
        setBankBook(null);
        setUpgradeBook(null);
        setLeadershipCenter(null);
        setWarCatalog(null);
        return;
      }

      const [nextMembersBook, nextBankBook, nextUpgradeBook, nextLeadershipCenter, nextWarCatalog] =
        await Promise.allSettled([
          factionApi.getMembers(list.playerFactionId),
          factionApi.getBank(list.playerFactionId),
          factionApi.getUpgrades(list.playerFactionId),
          factionApi.getLeadership(list.playerFactionId),
          factionCrimeApi.getCatalog(list.playerFactionId),
        ]);

      setMembersBook(nextMembersBook.status === 'fulfilled' ? nextMembersBook.value : null);
      setBankBook(nextBankBook.status === 'fulfilled' ? nextBankBook.value : null);
      setUpgradeBook(nextUpgradeBook.status === 'fulfilled' ? nextUpgradeBook.value : null);
      setLeadershipCenter(
        nextLeadershipCenter.status === 'fulfilled' ? nextLeadershipCenter.value : null,
      );
      setWarCatalog(nextWarCatalog.status === 'fulfilled' ? nextWarCatalog.value : null);
    } catch (error) {
      setLoadErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadFactionHub();
      return undefined;
    }, [loadFactionHub]),
  );

  useEffect(() => factionRealtimeService.subscribe(setRealtimeSnapshot), []);

  useEffect(() => {
    if (!isFocused || !token || !currentFactionId) {
      void factionRealtimeService.disconnect();
      return;
    }

    void factionRealtimeService.connectToFactionRoom({
      accessToken: token,
      factionId: currentFactionId,
    });

    return () => {
      void factionRealtimeService.disconnect();
    };
  }, [currentFactionId, isFocused, token]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    setErrorMessage(null);
    setFeedbackMessage(null);
  }, [activeTab]);

  useEffect(() => {
    if (!currentFactionId && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [activeTab, currentFactionId]);

  useEffect(() => {
    setConfigName(currentFaction?.name ?? '');
    setConfigAbbreviation(currentFaction?.abbreviation ?? '');
    setConfigDescription(currentFaction?.description ?? '');
  }, [
    currentFaction?.abbreviation,
    currentFaction?.description,
    currentFaction?.id,
    currentFaction?.name,
  ]);

  useEffect(() => {
    if (!selectedCrime) {
      setSelectedCrimeId(null);
      setSelectedParticipantIds([]);
      return;
    }

    if (!selectedCrimeId) {
      setSelectedCrimeId(selectedCrime.id);
    }

    setSelectedParticipantIds((currentSelection) => {
      const allowedIds = eligibleWarMembers.map((entry) => entry.id);
      const nextSelection = currentSelection
        .filter((entry) => allowedIds.includes(entry))
        .slice(0, selectedCrime.maximumCrewSize);

      if (nextSelection.length >= Math.min(selectedCrime.minimumCrewSize, allowedIds.length)) {
        return nextSelection;
      }

      return allowedIds.slice(
        0,
        Math.min(selectedCrime.maximumCrewSize, Math.max(selectedCrime.minimumCrewSize, 1)),
      );
    });
  }, [eligibleWarMembers, selectedCrime, selectedCrimeId]);

  const {
    handleChallengeLeadership,
    handleCreateFaction,
    handleDeposit,
    handleDissolveFaction,
    handleJoinFixedFaction,
    handleLaunchFactionCrime,
    handleLeaveFaction,
    handleMemberAction,
    handleRecruitMember,
    handleRefresh,
    handleSendChat,
    handleSendCoordination,
    handleSupportElection,
    handleUnlockUpgrade,
    handleUpdateFaction,
    handleVoteCandidate,
    handleWithdraw,
  } = useFactionScreenMutations({
    chatMessage,
    configAbbreviation,
    configDescription,
    configName,
    coordinationKind,
    coordinationLabel,
    createAbbreviation,
    createDescription,
    createName,
    currentFactionId,
    depositAmount,
    loadFactionHub,
    recruitNickname,
    realtimeStatus: realtimeSnapshot.status,
    refreshPlayerProfile,
    selectedCrime,
    selectedParticipantIds,
    setBootstrapStatus,
    setChatMessage,
    setCoordinationLabel,
    setCreateAbbreviation,
    setCreateDescription,
    setCreateName,
    setDepositAmount,
    setErrorMessage,
    setFeedbackMessage,
    setIsMutating,
    setRecruitNickname,
    setWithdrawAmount,
    withdrawAmount,
  });

  return {
    activeTab,
    bankBook,
    bankLedgerSummary,
    canLaunchSelectedCrime,
    canModerateMembers,
    canRecruitMembers,
    chatMessage,
    configAbbreviation,
    configDescription,
    configName,
    coordinationKind,
    coordinationLabel,
    createAbbreviation,
    createDescription,
    createName,
    currentFaction,
    currentFactionId,
    depositAmount,
    eligibleWarMembers,
    errorMessage,
    factionList,
    feedbackMessage,
    getFactionAvailableJoinSlots,
    getFactionCanSelfJoin,
    handleChallengeLeadership,
    handleCreateFaction,
    handleDeposit,
    handleDissolveFaction,
    handleJoinFixedFaction,
    handleLaunchFactionCrime,
    handleLeaveFaction,
    handleMemberAction,
    handleRecruitMember,
    handleRefresh,
    handleSendChat,
    handleSendCoordination,
    handleSupportElection,
    handleUnlockUpgrade,
    handleUpdateFaction,
    handleVoteCandidate,
    handleWithdraw,
    isLoading,
    isMutating,
    latestRealtimeChat,
    latestRealtimeCoordination,
    leadershipCenter,
    loadErrorMessage,
    membersBook,
    myRank,
    onlinePlayerIds,
    player,
    realtimeSnapshot,
    recruitNickname,
    selectedCrime,
    selectedCrimeId,
    selectedCrimeParticipants,
    selectedParticipantIds,
    setActiveTab,
    setChatMessage,
    setConfigAbbreviation,
    setConfigDescription,
    setConfigName,
    setCoordinationKind,
    setCoordinationLabel,
    setCreateAbbreviation,
    setCreateDescription,
    setCreateName,
    setDepositAmount,
    setErrorMessage,
    setFeedbackMessage,
    setRecruitNickname,
    setSelectedCrimeId,
    setSelectedParticipantIds,
    setWithdrawAmount,
    sortedFactions,
    sortedMembers,
    sortedRealtimeChat,
    sortedRealtimeCoordination,
    upgradeBook,
    warCatalog,
    withdrawAmount,
  };
}

export type FactionScreenController = ReturnType<typeof useFactionScreenController>;
