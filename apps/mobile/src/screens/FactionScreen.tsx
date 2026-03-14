import {
  type FactionCoordinationKind,
  type FactionLeadershipElectionCandidateSummary,
  type FactionMemberSummary,
  type FactionUpgradeType,
} from '@cs-rio/shared';
import {
  useFocusEffect,
  useIsFocused,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  FACTION_SCREEN_TABS,
  type FactionScreenTab,
  formatFactionCurrency,
  resolveFactionCoordinationLabel,
  resolveFactionElectionStatusLabel,
  resolveFactionLedgerEntryLabel,
  resolveFactionRankLabel,
  resolveFactionScreenTabLabel,
  sortFactionMembersForDisplay,
  sortFactionsForDisplay,
} from '../features/faction';
import {
  factionApi,
  factionCrimeApi,
  formatApiError,
} from '../services/api';
import {
  factionRealtimeService,
  type FactionRealtimeSnapshot,
} from '../services/factionRealtime';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

const COORDINATION_KINDS: FactionCoordinationKind[] = ['attack', 'defend', 'gather', 'supply'];
const MANAGEMENT_RANKS = new Set(['patrao', 'general', 'gerente']);
const MODERATION_RANKS = new Set(['patrao', 'general']);

export function FactionScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Faction'>>();
  const isFocused = useIsFocused();
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [activeTab, setActiveTab] = useState<FactionScreenTab>(route.params?.initialTab ?? 'overview');
  const [factionList, setFactionList] = useState<Awaited<ReturnType<typeof factionApi.list>> | null>(null);
  const [membersBook, setMembersBook] = useState<Awaited<ReturnType<typeof factionApi.getMembers>> | null>(null);
  const [bankBook, setBankBook] = useState<Awaited<ReturnType<typeof factionApi.getBank>> | null>(null);
  const [upgradeBook, setUpgradeBook] = useState<Awaited<ReturnType<typeof factionApi.getUpgrades>> | null>(null);
  const [leadershipCenter, setLeadershipCenter] = useState<Awaited<ReturnType<typeof factionApi.getLeadership>> | null>(null);
  const [warCatalog, setWarCatalog] = useState<Awaited<ReturnType<typeof factionCrimeApi.getCatalog>> | null>(null);
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
    () =>
      factionList?.factions.find((entry) => entry.id === currentFactionId) ??
      null,
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
  const getFactionAvailableJoinSlots = useCallback(
    (faction: (typeof sortedFactions)[number]) =>
      (faction as typeof faction & { availableJoinSlots?: number | null }).availableJoinSlots ?? null,
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

      if (!list.playerFactionId) {
        setMembersBook(null);
        setBankBook(null);
        setUpgradeBook(null);
        setLeadershipCenter(null);
        setWarCatalog(null);
        return;
      }

      const [
        nextMembersBook,
        nextBankBook,
        nextUpgradeBook,
        nextLeadershipCenter,
        nextWarCatalog,
      ] = await Promise.allSettled([
        factionApi.getMembers(list.playerFactionId),
        factionApi.getBank(list.playerFactionId),
        factionApi.getUpgrades(list.playerFactionId),
        factionApi.getLeadership(list.playerFactionId),
        factionCrimeApi.getCatalog(list.playerFactionId),
      ]);

      setMembersBook(nextMembersBook.status === 'fulfilled' ? nextMembersBook.value : null);
      setBankBook(nextBankBook.status === 'fulfilled' ? nextBankBook.value : null);
      setUpgradeBook(nextUpgradeBook.status === 'fulfilled' ? nextUpgradeBook.value : null);
      setLeadershipCenter(nextLeadershipCenter.status === 'fulfilled' ? nextLeadershipCenter.value : null);
      setWarCatalog(nextWarCatalog.status === 'fulfilled' ? nextWarCatalog.value : null);
    } catch (error) {
      setLoadErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [currentFaction?.abbreviation, currentFaction?.description, currentFaction?.id, currentFaction?.name]);

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
        Math.min(
          selectedCrime.maximumCrewSize,
          Math.max(selectedCrime.minimumCrewSize, 1),
        ),
      );
    });
  }, [eligibleWarMembers, selectedCrime, selectedCrimeId]);

  const runMutation = useCallback(
    async (
      action: () => Promise<void>,
      successMessage: string,
      options: {
        refreshProfile?: boolean;
      } = {},
    ) => {
      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        await action();

        if (options.refreshProfile !== false) {
          await refreshPlayerProfile();
        }

        await loadFactionHub();
        setFeedbackMessage(successMessage);
        setBootstrapStatus(successMessage);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
      }
    },
    [loadFactionHub, refreshPlayerProfile, setBootstrapStatus],
  );

  const handleRefresh = useCallback(async () => {
    setFeedbackMessage('Hub de facção sincronizado com backend, banco e tempo real.');
    setBootstrapStatus('Hub de facção sincronizado.');
    await Promise.all([loadFactionHub(), refreshPlayerProfile()]);
  }, [loadFactionHub, refreshPlayerProfile, setBootstrapStatus]);

  const handleCreateFaction = useCallback(async () => {
    await runMutation(
      async () => {
        await factionApi.create({
          abbreviation: createAbbreviation.trim().toUpperCase(),
          description: createDescription.trim() || null,
          name: createName.trim(),
        });
        setCreateAbbreviation('');
        setCreateDescription('');
        setCreateName('');
      },
      'Facção criada e vinculada ao personagem.',
    );
  }, [createAbbreviation, createDescription, createName, runMutation]);

  const handleUpdateFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.update(currentFactionId, {
          abbreviation: configAbbreviation.trim().toUpperCase(),
          description: configDescription.trim() || null,
          name: configName.trim(),
        });
      },
      'Configuração da facção atualizada.',
    );
  }, [configAbbreviation, configDescription, configName, currentFactionId, runMutation]);

  const handleLeaveFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.leave(currentFactionId);
      },
      'Você saiu da facção atual.',
    );
  }, [currentFactionId, runMutation]);

  const handleDissolveFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.dissolve(currentFactionId);
      },
      'Facção dissolvida com sucesso.',
    );
  }, [currentFactionId, runMutation]);

  const handleRecruitMember = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.recruit(currentFactionId, {
          nickname: recruitNickname.trim(),
        });
        setRecruitNickname('');
      },
      'Recrutamento enviado para o backend autoritativo.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, recruitNickname, runMutation]);

  const handleJoinFixedFaction = useCallback(async (factionId: string) => {
    await runMutation(
      async () => {
        await factionApi.join(factionId);
      },
      'Você entrou na facção fixa como cria.',
    );
  }, [runMutation]);

  const handleDeposit = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    const parsedAmount = parsePositiveAmount(depositAmount);

    if (!parsedAmount) {
      setErrorMessage('Informe um valor positivo para depositar.');
      return;
    }

    await runMutation(
      async () => {
        await factionApi.deposit(currentFactionId, {
          amount: parsedAmount,
        });
        setDepositAmount('');
      },
      'Depósito efetuado no banco da facção.',
    );
  }, [currentFactionId, depositAmount, runMutation]);

  const handleWithdraw = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    const parsedAmount = parsePositiveAmount(withdrawAmount);

    if (!parsedAmount) {
      setErrorMessage('Informe um valor positivo para sacar.');
      return;
    }

    await runMutation(
      async () => {
        await factionApi.withdraw(currentFactionId, {
          amount: parsedAmount,
        });
        setWithdrawAmount('');
      },
      'Saque efetuado no banco da facção.',
    );
  }, [currentFactionId, runMutation, withdrawAmount]);

  const handleUnlockUpgrade = useCallback(async (upgradeType: FactionUpgradeType) => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.unlockUpgrade(currentFactionId, upgradeType);
      },
      'Upgrade coletivo desbloqueado.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, runMutation]);

  const handleSupportElection = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.supportLeadershipElection(currentFactionId);
      },
      'Seu apoio foi registrado na disputa da facção.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, runMutation]);

  const handleVoteCandidate = useCallback(async (candidatePlayerId: string) => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.voteLeadership(currentFactionId, {
          candidatePlayerId,
        });
      },
      'Voto registrado na eleição da facção.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, runMutation]);

  const handleChallengeLeadership = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        const response = await factionApi.challengeLeadership(currentFactionId);
        const resultLabel = response.result.challengerWon
          ? `${response.result.challengerNickname} tomou a liderança na porrada.`
          : `${response.result.defenderNickname} segurou a liderança.`;
        setFeedbackMessage(resultLabel);
      },
      'Desafio de liderança resolvido.',
    );
  }, [currentFactionId, runMutation]);

  const handleMemberAction = useCallback(async (
    action: 'demote' | 'expel' | 'promote',
    member: FactionMemberSummary,
  ) => {
    if (!currentFactionId) {
      return;
    }

    const operation = async () => {
      if (action === 'promote') {
        await factionApi.promote(currentFactionId, member.id);
        return;
      }

      if (action === 'demote') {
        await factionApi.demote(currentFactionId, member.id);
        return;
      }

      await factionApi.expel(currentFactionId, member.id);
    };

    const labels = {
      demote: `${member.nickname} foi rebaixado na hierarquia.`,
      expel: `${member.nickname} foi removido da facção.`,
      promote: `${member.nickname} subiu na hierarquia.`,
    } as const;

    await runMutation(operation, labels[action], {
      refreshProfile: false,
    });
  }, [currentFactionId, runMutation]);

  const handleLaunchFactionCrime = useCallback(async () => {
    if (!currentFactionId || !selectedCrime) {
      return;
    }

    await runMutation(
      async () => {
        const response = await factionCrimeApi.attempt(currentFactionId, selectedCrime.id, {
          participantIds: selectedParticipantIds,
        });
        setFeedbackMessage(response.message);
      },
      'Crime coletivo executado e sincronizado com a facção.',
    );
  }, [currentFactionId, runMutation, selectedCrime, selectedParticipantIds]);

  const handleSendChat = useCallback(() => {
    if (realtimeSnapshot.status !== 'connected') {
      setErrorMessage('A sala da facção ainda não conectou em tempo real.');
      return;
    }

    if (!chatMessage.trim()) {
      setErrorMessage('Escreva uma mensagem para o chat da facção.');
      return;
    }

    factionRealtimeService.sendChatMessage(chatMessage);
    setChatMessage('');
    setFeedbackMessage('Mensagem enviada para a sala da facção.');
  }, [chatMessage, realtimeSnapshot.status]);

  const handleSendCoordination = useCallback(() => {
    if (realtimeSnapshot.status !== 'connected') {
      setErrorMessage('A sala da facção ainda não conectou em tempo real.');
      return;
    }

    if (!coordinationLabel.trim()) {
      setErrorMessage('Defina um alvo curto para a chamada de coordenação.');
      return;
    }

    factionRealtimeService.sendCoordinationMessage({
      kind: coordinationKind,
      label: coordinationLabel,
    });
    setCoordinationLabel('');
    setFeedbackMessage('Chamada de coordenação publicada para a facção.');
  }, [coordinationKind, coordinationLabel, realtimeSnapshot.status]);

  const renderOverview = () => {
    if (!currentFaction) {
      return (
        <>
          <SectionCard
            subtitle="Sem facção, o celular vira painel de prospecção. Entradas em facções existentes dependem de recrutamento; por aqui você já consegue fundar a sua."
            title="Criar facção"
          >
            <Field label="Nome">
              <TextInput
                onChangeText={setCreateName}
                placeholder="Ex.: Bonde do Asfalto"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={createName}
              />
            </Field>
            <Field label="Sigla">
              <TextInput
                autoCapitalize="characters"
                maxLength={5}
                onChangeText={setCreateAbbreviation}
                placeholder="BDA"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={createAbbreviation}
              />
            </Field>
            <Field label="Descrição">
              <TextInput
                multiline
                onChangeText={setCreateDescription}
                placeholder="Manifesto curto da facção, foco e postura."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
                value={createDescription}
              />
            </Field>
            <ActionButton
              disabled={isMutating}
              label="Fundar facção"
              onPress={() => {
                void handleCreateFaction();
              }}
            />
          </SectionCard>

          <SectionCard
            subtitle="Radar das facções que já estão rodando no servidor. Facções fixas aceitam entrada direta enquanto houver vagas abertas; as demais ainda exigem recrutamento."
            title="Facção em atividade"
          >
            {sortedFactions.length > 0 ? (
              <View style={styles.listColumn}>
                {sortedFactions.map((faction) => (
                    <View key={faction.id} style={styles.listCard}>
                      <View style={styles.cardHeaderStack}>
                        <View style={styles.flexCopy}>
                          <Text style={styles.cardTitle}>
                            {faction.name} · {faction.abbreviation}
                          </Text>
                          <View style={styles.inlineRow}>
                            <Tag label={faction.isFixed ? 'Fixa' : 'Custom'} tone={faction.isFixed ? 'accent' : 'info'} />
                          </View>
                          <Text style={styles.cardCopy}>
                            {faction.memberCount} membros · {faction.points} pontos · líder {faction.npcLeaderName ?? 'humano'}
                          </Text>
                        </View>
                      </View>
                    {faction.description ? <Text style={styles.cardCopy}>{faction.description}</Text> : null}
                    <Text style={styles.cardCopy}>
                      {faction.isFixed
                        ? `Vagas abertas: ${getFactionAvailableJoinSlots(faction) ?? 0}`
                        : 'Entrada apenas por recrutamento.'}
                    </Text>
                    {getFactionCanSelfJoin(faction) ? (
                      <View style={styles.inlineRow}>
                        <ActionButton
                          disabled={isMutating}
                          label="Entrar como cria"
                          onPress={() => {
                            void handleJoinFixedFaction(faction.id);
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState copy="Nenhuma facção cadastrada ainda. Fundar a primeira já destrava toda a hierarquia." />
            )}
          </SectionCard>
        </>
      );
    }

    return (
      <>
        <SectionCard
          subtitle="Resumo executivo da facção atual com configuração, status do controle e a sua posição na hierarquia."
          title={`${currentFaction.name} · ${currentFaction.abbreviation}`}
        >
          <View style={styles.listColumn}>
            <InfoRow label="Seu cargo" value={resolveFactionRankLabel(myRank)} />
            <InfoRow label="Liderança" value={leadershipCenter?.leader.nickname ?? currentFaction.npcLeaderName ?? 'Desconhecida'} />
            <InfoRow label="Banco" value={formatFactionCurrency(currentFaction.bankMoney)} />
            <InfoRow label="Pontos" value={`${currentFaction.points}`} />
            <InfoRow label="Membros" value={`${currentFaction.memberCount}`} />
          </View>
          {currentFaction.description ? (
            <Text style={styles.cardCopy}>{currentFaction.description}</Text>
          ) : null}
          <View style={styles.inlineRow}>
            <Tag label={currentFaction.isFixed ? 'Facção fixa' : 'Facção criada'} tone="accent" />
            <Tag label={currentFaction.isNpcControlled ? 'Líder NPC' : 'Líder humano'} tone="info" />
            <Tag label={currentFaction.isPlayerMember ? 'Seu bonde' : 'Observando'} tone="success" />
          </View>
          <View style={styles.inlineRow}>
            <ActionButton
              disabled={isMutating}
                label="Sair da facção"
              onPress={() => {
                void handleLeaveFaction();
              }}
              tone="danger"
            />
            {currentFaction.canDissolve ? (
              <ActionButton
                disabled={isMutating}
                label="Dissolver"
                onPress={() => {
                  void handleDissolveFaction();
                }}
                tone="warning"
              />
            ) : null}
          </View>
        </SectionCard>

        <SectionCard
          subtitle="Radar das outras facções ativas do servidor para leitura política, comparação de banco e entendimento do cenário."
          title="Facções em atividade"
        >
          {sortedFactions.length > 0 ? (
            <View style={styles.listColumn}>
              {sortedFactions
                .filter((faction) => faction.id !== currentFaction.id)
                .map((faction) => (
                  <View key={faction.id} style={styles.listCard}>
                    <View style={styles.cardHeaderStack}>
                      <View style={styles.flexCopy}>
                        <Text style={styles.cardTitle}>
                          {faction.name} · {faction.abbreviation}
                        </Text>
                        <View style={styles.inlineRow}>
                          <Tag label={faction.isFixed ? 'Fixa' : 'Custom'} tone={faction.isFixed ? 'accent' : 'info'} />
                        </View>
                        <Text style={styles.cardCopy}>
                          {faction.memberCount} membros · banco {formatFactionCurrency(faction.bankMoney)} · líder {faction.npcLeaderName ?? 'humano'}
                        </Text>
                      </View>
                    </View>
                    {faction.description ? <Text style={styles.cardCopy}>{faction.description}</Text> : null}
                    <Text style={styles.cardCopy}>
                      {faction.isFixed
                        ? `Vagas abertas: ${getFactionAvailableJoinSlots(faction) ?? 0}`
                        : 'Entrada apenas por recrutamento.'}
                    </Text>
                    {getFactionCanSelfJoin(faction) ? (
                      <View style={styles.inlineRow}>
                        <ActionButton
                          disabled={isMutating}
                          label="Entrar como cria"
                          onPress={() => {
                            void handleJoinFixedFaction(faction.id);
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
            </View>
          ) : (
            <EmptyState copy="Nenhuma outra facção ativa foi encontrada no servidor." />
          )}
        </SectionCard>

        {currentFaction.canConfigure ? (
          <SectionCard
            subtitle="Ajuste identidade e manifesto da facção sem sair do celular. As validações críticas continuam do lado do servidor."
            title="Configurar facção"
          >
            <Field label="Nome">
              <TextInput
                onChangeText={setConfigName}
                placeholder="Nome da facção"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={configName}
              />
            </Field>
            <Field label="Sigla">
              <TextInput
                autoCapitalize="characters"
                onChangeText={setConfigAbbreviation}
                placeholder="Sigla"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={configAbbreviation}
              />
            </Field>
            <Field label="Descrição">
              <TextInput
                multiline
                onChangeText={setConfigDescription}
                placeholder="Resumo, regras e postura da facção."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
                value={configDescription}
              />
            </Field>
            <ActionButton
              disabled={isMutating}
              label="Salvar configuração"
              onPress={() => {
                void handleUpdateFaction();
              }}
            />
          </SectionCard>
        ) : null}
      </>
    );
  };

  const renderMembers = () => (
    <>
      {canRecruitMembers ? (
        <SectionCard
          subtitle="Recrutamento por nickname real do jogador. A hierarquia segue valendo no backend para evitar abuso."
          title="Recrutar membro"
        >
          <Field label="Nickname">
            <TextInput
              autoCapitalize="none"
              onChangeText={setRecruitNickname}
              placeholder="Nickname do alvo"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={recruitNickname}
            />
          </Field>
          <ActionButton
            disabled={isMutating}
            label="Recrutar"
            onPress={() => {
              void handleRecruitMember();
            }}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        subtitle="Lista unificada com presença em tempo real da sala da facção e a hierarquia autoritativa do backend."
        title="Membros e presença"
      >
        {sortedMembers.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedMembers.map((member) => {
              const isOnline = onlinePlayerIds.includes(member.id);

              return (
                <View key={member.id} style={styles.listCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>
                        {member.nickname}
                        {member.id === player?.id ? ' · você' : ''}
                      </Text>
                      <Text style={styles.cardCopy}>
                        {resolveFactionRankLabel(member.rank)}
                        {' · '}
                        nível {member.level ?? '--'}
                        {' · '}
                        {member.vocation ?? 'sem vocação'}
                      </Text>
                    </View>
                    <Tag label={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'success' : 'neutral'} />
                  </View>
                  <Text style={styles.cardCopy}>
                    Entrou em {formatDateTimeLabel(member.joinedAt)}
                    {member.isLeader ? ' · líder atual' : ''}
                    {member.isNpc ? ' · NPC' : ''}
                  </Text>
                  {canModerateMembers && !member.isLeader && !member.isNpc && member.id !== player?.id ? (
                    <View style={styles.inlineRow}>
                      <MiniButton
                        disabled={isMutating}
                        label="Promover"
                        onPress={() => {
                          void handleMemberAction('promote', member);
                        }}
                        tone="success"
                      />
                      <MiniButton
                        disabled={isMutating}
                        label="Rebaixar"
                        onPress={() => {
                          void handleMemberAction('demote', member);
                        }}
                        tone="warning"
                      />
                      <MiniButton
                        disabled={isMutating}
                        label="Expulsar"
                        onPress={() => {
                          void handleMemberAction('expel', member);
                        }}
                        tone="danger"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Nenhum membro disponível. Crie a facção ou sincronize a lista." />
        )}
      </SectionCard>
    </>
  );

  const renderBank = () => (
    <>
      <SectionCard
        subtitle="Depósitos, saques por cargo e ledger das comissões automáticas que entram dos negócios da facção."
        title="Banco da facção"
      >
        {!bankBook ? (
          <EmptyState copy="Seu cargo não pode acessar o banco da facção." />
        ) : (
          <>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Saldo" tone={colors.warning} value={formatFactionCurrency(bankBook?.faction.bankMoney ?? 0)} />
          <SummaryCard label="Depositar" tone={colors.info} value={bankBook?.permissions.canDeposit ? 'Sim' : 'Não'} />
          <SummaryCard label="Sacar" tone={colors.danger} value={bankBook?.permissions.canWithdraw ? 'Sim' : 'Não'} />
          <SummaryCard label="Entradas" tone={colors.accent} value={`${bankBook?.ledger.length ?? 0}`} />
        </View>
        <View style={styles.formGrid}>
          <Field label="Depósito">
            <TextInput
              keyboardType="numeric"
              onChangeText={setDepositAmount}
              placeholder="5000"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={depositAmount}
            />
          </Field>
          <ActionButton
            disabled={isMutating || !bankBook?.permissions.canDeposit}
            label="Depositar"
            onPress={() => {
              void handleDeposit();
            }}
          />
        </View>
        <View style={styles.formGrid}>
          <Field label="Saque">
            <TextInput
              keyboardType="numeric"
              onChangeText={setWithdrawAmount}
              placeholder="10000"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={withdrawAmount}
            />
          </Field>
          <ActionButton
            disabled={isMutating || !bankBook?.permissions.canWithdraw}
            label="Sacar"
            onPress={() => {
              void handleWithdraw();
            }}
            tone="warning"
          />
        </View>
          </>
        )}
      </SectionCard>

      <SectionCard
        subtitle="Histórico financeiro autoritativo da facção. Comissões de boca, rave, puteiro, fachada e maquininha caem aqui automaticamente."
        title="Ledger"
      >
        {!bankBook ? (
          <EmptyState copy="Ledger indisponível para o seu cargo nesta fase." />
        ) : bankBook.ledger.length ? (
          <View style={styles.listColumn}>
            {bankBook.ledger.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.cardTitle}>{resolveFactionLedgerEntryLabel(entry)}</Text>
                    <Text style={styles.cardCopy}>{entry.description}</Text>
                  </View>
                  <Text
                    style={[
                      styles.metricValue,
                      entry.entryType === 'withdrawal' ? styles.metricValueDanger : styles.metricValueSuccess,
                    ]}
                  >
                    {entry.entryType === 'withdrawal' ? '-' : '+'}
                    {formatFactionCurrency(entry.netAmount)}
                  </Text>
                </View>
                <Text style={styles.cardCopy}>
                  Saldo após {formatFactionCurrency(entry.balanceAfter)}
                  {' · '}
                  {formatDateTimeLabel(entry.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Sem movimentações ainda. As primeiras entradas aparecem quando os negócios lucrativos começarem a render." />
        )}
      </SectionCard>
    </>
  );

  const renderUpgrades = () => (
    <>
      <SectionCard
        subtitle="Centro coletivo com pontos faccionais, efeitos persistentes e desbloqueios de infraestrutura."
        title="Centro de upgrades"
      >
        {upgradeBook ? (
          <View style={styles.summaryGrid}>
            <SummaryCard label="Pontos" tone={colors.accent} value={`${upgradeBook.availablePoints ?? 0}`} />
            <SummaryCard label="Bônus attr." tone={colors.success} value={`${Math.round((upgradeBook.effects.attributeBonusMultiplier ?? 0) * 100)}%`} />
            <SummaryCard label="Mulas" tone={colors.info} value={`${upgradeBook.effects.muleDeliveryTier ?? 0}`} />
            <SummaryCard label="Soldados" tone={colors.warning} value={`${Math.round((upgradeBook.effects.soldierCapacityMultiplier ?? 1) * 100)}%`} />
          </View>
        ) : (
          <EmptyState copy="Seu cargo ainda não pode acessar o centro de upgrades." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Cada desbloqueio consome pontos do banco coletivo. O backend continua validando custo e pré-requisitos."
        title="Catálogo coletivo"
      >
        {!upgradeBook ? (
          <EmptyState copy="Os upgrades ficam visíveis apenas para cargos autorizados." />
        ) : upgradeBook.upgrades.length ? (
          <View style={styles.listColumn}>
            {upgradeBook.upgrades.map((upgrade) => (
              <View key={upgrade.type} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.cardTitle}>{upgrade.label}</Text>
                    <Text style={styles.cardCopy}>{upgrade.effectSummary}</Text>
                  </View>
                  <Tag
                    label={upgrade.isUnlocked ? 'Ativo' : `${upgrade.pointsCost} pts`}
                    tone={upgrade.isUnlocked ? 'success' : 'accent'}
                  />
                </View>
                {upgrade.prerequisiteUpgradeTypes.length > 0 ? (
                  <Text style={styles.cardCopy}>
                    Pré-req.: {upgrade.prerequisiteUpgradeTypes.join(', ')}
                  </Text>
                ) : null}
                {!upgrade.isUnlocked ? (
                  <ActionButton
                    disabled={isMutating || !upgrade.canUnlock}
                    label={upgrade.lockReason ?? 'Desbloquear upgrade'}
                    onPress={() => {
                      void handleUnlockUpgrade(upgrade.type);
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Nenhum upgrade carregado. Atualize o hub para sincronizar o centro coletivo." />
        )}
      </SectionCard>
    </>
  );

  const renderWar = () => (
    <>
      <SectionCard
        subtitle="Sala de guerra em tempo real da facção: presença online, coordenação rápida e feed interno do bonde."
        title="Sala da facção"
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Status" tone={colors.info} value={realtimeSnapshot.status} />
          <SummaryCard label="Online" tone={colors.success} value={`${realtimeSnapshot.members.length}`} />
          <SummaryCard label="Chat" tone={colors.accent} value={`${realtimeSnapshot.chatMessages.length}`} />
          <SummaryCard label="Chamados" tone={colors.warning} value={`${realtimeSnapshot.coordinationCalls.length}`} />
        </View>
        <View style={styles.filterRow}>
          {COORDINATION_KINDS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => {
                setCoordinationKind(entry);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                coordinationKind === entry ? styles.filterChipActive : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  coordinationKind === entry ? styles.filterChipLabelActive : null,
                ]}
              >
                {resolveFactionCoordinationLabel(entry)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          onChangeText={setCoordinationLabel}
          placeholder="Ex.: Segurar boca principal"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={coordinationLabel}
        />
        <ActionButton
          disabled={isMutating || realtimeSnapshot.status !== 'connected'}
          label="Publicar coordenação"
          onPress={handleSendCoordination}
        />
      </SectionCard>

      <SectionCard
        subtitle="Feed curto de coordenação para situações quentes. O mais novo aparece primeiro para resposta rápida."
        title="Chamadas do bonde"
      >
        {sortedRealtimeCoordination.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedRealtimeCoordination.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {resolveFactionCoordinationLabel(entry.kind)} · {entry.label}
                  </Text>
                  <Tag label={entry.nickname} tone="accent" />
                </View>
                <Text style={styles.cardCopy}>{formatDateTimeLabel(entry.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Sem chamadas ainda. Use o composer acima para puxar ataque, defesa, bonde ou suprimento." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Chat interno da facção em tempo real para alinhamento rápido antes de crimes coletivos."
        title="Chat da facção"
      >
        <TextInput
          onChangeText={setChatMessage}
          placeholder="Mensagem curta para o QG..."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          value={chatMessage}
        />
        <ActionButton
          disabled={isMutating || realtimeSnapshot.status !== 'connected'}
          label="Enviar no chat"
          onPress={handleSendChat}
        />
        {sortedRealtimeChat.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedRealtimeChat.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {entry.kind === 'system' ? 'Sistema' : entry.nickname}
                  </Text>
                  <Text style={styles.mutedSmall}>{formatDateTimeLabel(entry.createdAt)}</Text>
                </View>
                <Text style={styles.cardCopy}>{entry.message}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Nenhuma mensagem ainda. Assim que alguém entrar na sala ou mandar chat, o feed aparece aqui." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Crimes coletivos conectados ao backend: escolha o alvo, monte a equipe e dispare do próprio celular."
        title="Operação coletiva"
      >
        {warCatalog?.crimes.length ? (
          <>
            <View style={styles.listColumn}>
              {warCatalog.crimes.map((crime) => (
                <Pressable
                  key={crime.id}
                  onPress={() => {
                    setSelectedCrimeId(crime.id);
                  }}
                  style={({ pressed }) => [
                    styles.listCard,
                    selectedCrime?.id === crime.id ? styles.selectedCard : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.cardHeaderStack}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>{crime.name}</Text>
                      <Text style={styles.cardCopy}>
                        Crew {crime.minimumCrewSize}-{crime.maximumCrewSize} · stamina {crime.staminaCost}% · nervos {crime.nerveCost}
                      </Text>
                    </View>
                    <Tag
                      label={crime.isRunnable ? 'Pronto' : crime.lockReason ?? 'Travado'}
                      tone={crime.isRunnable ? 'success' : 'warning'}
                    />
                  </View>
                </Pressable>
              ))}
            </View>

            {selectedCrime ? (
              <>
                <View style={styles.inlineRowWrap}>
                  {eligibleWarMembers.map((member) => {
                    const isSelected = selectedParticipantIds.includes(member.id);

                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          setSelectedParticipantIds((currentSelection) => {
                            if (currentSelection.includes(member.id)) {
                              return currentSelection.filter((entry) => entry !== member.id);
                            }

                            if (currentSelection.length >= selectedCrime.maximumCrewSize) {
                              return currentSelection;
                            }

                            return [...currentSelection, member.id];
                          });
                        }}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isSelected ? styles.filterChipActive : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipLabel,
                            isSelected ? styles.filterChipLabelActive : null,
                          ]}
                        >
                          {member.nickname}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.cardCopy}>
                  Selecionados: {selectedCrimeParticipants.length} / mínimo {selectedCrime.minimumCrewSize} / máximo {selectedCrime.maximumCrewSize}
                </Text>
                <ActionButton
                  disabled={isMutating || !canLaunchSelectedCrime}
                  label={
                    canLaunchSelectedCrime
                      ? 'Executar crime coletivo'
                      : selectedCrime.lockReason ?? 'Monte um bonde valido para executar'
                  }
                  onPress={() => {
                    void handleLaunchFactionCrime();
                  }}
                />
              </>
            ) : null}
          </>
        ) : (
          <EmptyState copy="Sem catálogo de crimes coletivos carregado. Verifique se o personagem já está apto para coordenar um bonde." />
        )}
      </SectionCard>
    </>
  );

  const renderLeadership = () => (
    <>
      <SectionCard
        subtitle="Painel político da facção com líder atual, eleição, apoios, votos e desafio direto."
        title="Candidatura e disputa"
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Líder" tone={colors.accent} value={leadershipCenter?.leader.nickname ?? '--'} />
          <SummaryCard label="Cargo" tone={colors.info} value={resolveFactionRankLabel(leadershipCenter?.leader.rank ?? null)} />
          <SummaryCard label="NPC" tone={colors.warning} value={leadershipCenter?.leader.isNpc ? 'Sim' : 'Não'} />
          <SummaryCard label="Pode desafiar" tone={colors.danger} value={leadershipCenter?.challenge.canChallenge ? 'Sim' : 'Não'} />
        </View>
        <ActionButton
          disabled={isMutating || !leadershipCenter?.challenge.canChallenge}
          label={leadershipCenter?.challenge.lockReason ?? 'Desafiar liderança'}
          onPress={() => {
            void handleChallengeLeadership();
          }}
          tone="danger"
        />
      </SectionCard>

      <SectionCard
        subtitle="Apoiadores abrem a votação; quando a eleição estiver ativa, cada membro habilitado vota direto pelo celular."
        title="Eleição"
      >
        {leadershipCenter?.election ? (
          <>
            <View style={styles.listColumn}>
              <InfoRow
                label="Status"
                value={resolveFactionElectionStatusLabel(leadershipCenter.election.status)}
              />
              <InfoRow
                label="Apoios"
                value={`${leadershipCenter.election.supportCount}/${leadershipCenter.election.supportThreshold}`}
              />
              <InfoRow
                label="Votos"
                value={`${leadershipCenter.election.totalVotes}`}
              />
              <InfoRow
                label="Cooldown"
                value={
                  leadershipCenter.election.cooldownEndsAt
                    ? formatDateTimeLabel(leadershipCenter.election.cooldownEndsAt)
                    : 'livre'
                }
              />
            </View>

            {!leadershipCenter.election.hasPlayerSupported &&
            leadershipCenter.election.status === 'petitioning' ? (
              <ActionButton
                disabled={isMutating}
                label="Apoiar candidatura"
                onPress={() => {
                  void handleSupportElection();
                }}
              />
            ) : null}

            <View style={styles.listColumn}>
              {leadershipCenter.election.candidates.map((candidate) => (
                <CandidateCard
                  candidate={candidate}
                  canVote={
                    leadershipCenter.election?.status === 'active' &&
                    !leadershipCenter.election.hasPlayerVoted
                  }
                  isMutating={isMutating}
                  key={candidate.playerId}
                  onVote={() => {
                    void handleVoteCandidate(candidate.playerId);
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <EmptyState copy="Nenhuma eleição aberta. O primeiro apoio abre o abaixo-assinado para disputa de liderança." />
            <ActionButton
              disabled={isMutating}
              label="Iniciar abaixo-assinado"
              onPress={() => {
                void handleSupportElection();
              }}
            />
          </>
        )}

        {leadershipCenter?.challenge.lastResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Último desafio</Text>
            <Text style={styles.resultCopy}>
              {leadershipCenter.challenge.lastResult.challengerWon
                ? `${leadershipCenter.challenge.lastResult.challengerNickname} venceu e tomou a liderança.`
                : `${leadershipCenter.challenge.lastResult.defenderNickname} segurou o cargo.`}
            </Text>
            <Text style={styles.resultCopy}>
              Chance {Math.round(leadershipCenter.challenge.lastResult.successChance * 100)}% · resolvido em {formatDateTimeLabel(leadershipCenter.challenge.lastResult.resolvedAt)}
            </Text>
          </View>
        ) : null}
      </SectionCard>
    </>
  );

  return (
    <InGameScreenLayout
      subtitle="Centro unificado de facção: lista de membros, banco, upgrades, sala de guerra e disputa de liderança sem sair do celular."
      title="QG da Facção"
    >
      <View style={styles.topActionRow}>
        <ActionButton
          disabled={isLoading || isMutating}
          label="Atualizar painel"
          onPress={() => {
            void handleRefresh();
          }}
        />
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Facção" tone={colors.accent} value={currentFaction?.abbreviation ?? 'Sem'} />
        <SummaryCard label="Seu cargo" tone={colors.info} value={resolveFactionRankLabel(myRank)} />
        <SummaryCard label="Membros" tone={colors.success} value={`${currentFaction?.memberCount ?? 0}`} />
        <SummaryCard label="Pontos" tone={colors.warning} value={`${currentFaction?.points ?? 0}`} />
      </View>

      <View style={styles.segmentRow}>
        {FACTION_SCREEN_TABS.map((tab) => (
          <Pressable
            disabled={!currentFactionId && tab !== 'overview'}
            key={tab}
            onPress={() => {
              setActiveTab(tab);
            }}
            style={({ pressed }) => [
              styles.segmentButton,
              activeTab === tab ? styles.segmentButtonActive : null,
              !currentFactionId && tab !== 'overview' ? styles.segmentButtonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                activeTab === tab ? styles.segmentLabelActive : null,
                !currentFactionId && tab !== 'overview' ? styles.segmentLabelDisabled : null,
              ]}
            >
              {resolveFactionScreenTabLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && !factionList ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando hub de facção</Text>
          <Text style={styles.loadingCopy}>
            Sincronizando lista de membros, banco, upgrades, crimes coletivos e sala em tempo real.
          </Text>
        </View>
      ) : null}

      {loadErrorMessage ? (
        <Banner copy={loadErrorMessage} tone="danger" />
      ) : null}

      {activeTab === 'overview' ? renderOverview() : null}
      {currentFactionId && activeTab === 'members' ? renderMembers() : null}
      {currentFactionId && activeTab === 'bank' ? renderBank() : null}
      {currentFactionId && activeTab === 'upgrades' ? renderUpgrades() : null}
      {currentFactionId && activeTab === 'war' ? renderWar() : null}
      {currentFactionId && activeTab === 'leadership' ? renderLeadership() : null}

      <MutationResultModal
        message={errorMessage ?? feedbackMessage}
        onClose={() => {
          setErrorMessage(null);
          setFeedbackMessage(null);
        }}
        tone={errorMessage ? 'danger' : 'info'}
        visible={Boolean(errorMessage ?? feedbackMessage)}
      />
    </InGameScreenLayout>
  );
}

function parsePositiveAmount(value: string): number | null {
  const normalized = Number.parseInt(value.replace(/\D+/gu, ''), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function formatDateTimeLabel(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'primary' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'warning' ? styles.actionButtonWarning : null,
        tone === 'danger' ? styles.actionButtonDanger : null,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.actionButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function MiniButton({
  disabled = false,
  label,
  onPress,
  tone = 'info',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'info' | 'success' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        tone === 'danger' ? styles.miniButtonDanger : null,
        tone === 'success' ? styles.miniButtonSuccess : null,
        tone === 'warning' ? styles.miniButtonWarning : null,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.miniButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

function MutationResultModal({
  message,
  onClose,
  tone,
  visible,
}: {
  message: string | null;
  onClose: () => void;
  tone: 'danger' | 'info';
  visible: boolean;
}): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo]}>
          <Text style={styles.modalTitle}>{tone === 'danger' ? 'Ação falhou' : 'Ação executada'}</Text>
          <Text style={styles.modalCopy}>{message}</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CandidateCard({
  candidate,
  canVote,
  isMutating,
  onVote,
}: {
  candidate: FactionLeadershipElectionCandidateSummary;
  canVote: boolean;
  isMutating: boolean;
  onVote: () => void;
}): JSX.Element {
  return (
    <View style={styles.listCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.flexCopy}>
          <Text style={styles.cardTitle}>{candidate.nickname}</Text>
          <Text style={styles.cardCopy}>
            {resolveFactionRankLabel(candidate.rank)} · nível {candidate.level}
          </Text>
        </View>
        <Tag label={`${candidate.votes} votos`} tone="accent" />
      </View>
      {canVote ? (
        <ActionButton
          disabled={isMutating}
          label="Votar neste nome"
          onPress={onVote}
        />
      ) : null}
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function Tag({
  label,
  tone,
}: {
  label: string;
  tone: 'accent' | 'info' | 'neutral' | 'success' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.tag,
        tone === 'accent' ? styles.tagAccent : null,
        tone === 'info' ? styles.tagInfo : null,
        tone === 'success' ? styles.tagSuccess : null,
        tone === 'warning' ? styles.tagWarning : null,
      ]}
    >
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger,
  },
  actionButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actionButtonWarning: {
    backgroundColor: colors.warning,
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.28)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.28)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  cardCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardHeaderStack: {
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterChip: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  filterChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipLabelActive: {
    color: colors.accent,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexCopy: {
    flex: 1,
    gap: 4,
  },
  formGrid: {
    gap: 10,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listColumn: {
    gap: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 360,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricValueDanger: {
    color: colors.danger,
  },
  metricValueSuccess: {
    color: colors.success,
  },
  miniButton: {
    backgroundColor: 'rgba(123, 178, 255, 0.14)',
    borderColor: 'rgba(123, 178, 255, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  miniButtonDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.24)',
  },
  miniButtonLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  miniButtonSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: 'rgba(63, 163, 77, 0.24)',
  },
  miniButtonWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.14)',
    borderColor: 'rgba(255, 184, 77, 0.24)',
  },
  mutedSmall: {
    color: colors.muted,
    fontSize: 11,
  },
  resultCard: {
    backgroundColor: 'rgba(224, 176, 75, 0.08)',
    borderColor: 'rgba(224, 176, 75, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resultCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionBody: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  segmentButton: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  segmentButtonDisabled: {
    opacity: 0.42,
  },
  segmentLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentLabelActive: {
    color: colors.accent,
  },
  segmentLabelDisabled: {
    color: colors.muted,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedCard: {
    borderColor: colors.accent,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  tag: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagAccent: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  tagInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: colors.info,
  },
  tagLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tagSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.12)',
    borderColor: colors.success,
  },
  tagWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.12)',
    borderColor: colors.warning,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  topActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 13, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#3b1f1f',
    borderColor: 'rgba(220, 102, 102, 0.32)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  modalButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  modalButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
