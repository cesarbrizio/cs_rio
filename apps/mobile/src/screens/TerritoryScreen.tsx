import {
  type FavelaBaileMcTier,
  type FactionWarPrepareInput,
  type TerritoryFavelaSummary,
  type TerritoryOverviewResponse,
} from '@cs-rio/shared';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { WarResultModal } from '../components/WarResultModal';
import {
  buildFavelaAlertLines,
  buildTerritoryHeadlineStats,
  formatTerritoryCountdown,
  formatTerritoryCurrency,
  formatTerritoryTimestamp,
  groupFavelasByRegion,
  resolveBaileStatusLabel,
  resolveFavelaStateLabel,
  resolvePropinaStatusLabel,
  resolveRegionLabel,
  resolveRoundOutcomeLabel,
  resolveSatisfactionTierLabel,
  resolveServiceStatusLabel,
  resolveWarSideForPlayer,
  resolveWarSideLabel,
  resolveWarStatusLabel,
  resolveX9StatusLabel,
} from '../features/territory';
import { rememberSeenWarResult } from '../features/war-result-storage';
import { buildWarResultCue, type WarResultCue } from '../features/war-results';
import { formatApiError, territoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

const BAILE_TIERS: FavelaBaileMcTier[] = ['local', 'regional', 'estelar'];

export function TerritoryScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Territory'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [overview, setOverview] = useState<TerritoryOverviewResponse | null>(null);
  const [servicesBook, setServicesBook] = useState<Awaited<ReturnType<typeof territoryApi.getServices>> | null>(null);
  const [baileBook, setBaileBook] = useState<Awaited<ReturnType<typeof territoryApi.getBaile>> | null>(null);
  const [warBook, setWarBook] = useState<Awaited<ReturnType<typeof territoryApi.getWar>> | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(player?.regionId ?? null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(
    route.params?.focusFavelaId ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [baileBudgetInput, setBaileBudgetInput] = useState('45000');
  const [baileEntryPriceInput, setBaileEntryPriceInput] = useState('120');
  const [selectedBaileTier, setSelectedBaileTier] = useState<FavelaBaileMcTier>('regional');
  const [warBudgetInput, setWarBudgetInput] = useState('25000');
  const [warSoldierCommitmentInput, setWarSoldierCommitmentInput] = useState('6');
  const [expandedActionId, setExpandedActionId] = useState<'conquer' | 'declare-war' | 'propina' | 'x9' | null>(null);
  const [warResultCue, setWarResultCue] = useState<WarResultCue | null>(null);

  const playerFactionId = overview?.playerFactionId ?? player?.faction?.id ?? null;
  const headlineStats = useMemo(
    () => buildTerritoryHeadlineStats(overview),
    [overview],
  );
  const regionGroups = useMemo(
    () => (overview ? groupFavelasByRegion(overview) : []),
    [overview],
  );
  const visibleRegionId = useMemo(() => {
    if (!overview) {
      return selectedRegionId;
    }

    if (selectedRegionId && overview.regions.some((region) => region.regionId === selectedRegionId)) {
      return selectedRegionId;
    }

    return overview.regions[0]?.regionId ?? player?.regionId ?? null;
  }, [overview, player?.regionId, selectedRegionId]);
  const selectedRegion = useMemo(
    () => regionGroups.find((group) => group.region.regionId === visibleRegionId) ?? null,
    [regionGroups, visibleRegionId],
  );
  const selectedFavela = useMemo(
    () =>
      overview?.favelas.find((favela) => favela.id === selectedFavelaId) ??
      selectedRegion?.favelas[0] ??
      null,
    [overview?.favelas, selectedFavelaId, selectedRegion?.favelas],
  );
  const selectedServices = servicesBook?.services ?? [];
  const selectedWar = warBook?.war ?? selectedFavela?.war ?? null;
  const selectedWarSide = useMemo(
    () => resolveWarSideForPlayer(playerFactionId, selectedWar),
    [playerFactionId, selectedWar],
  );
  const selectedWarPreparation = useMemo(() => {
    if (!selectedWar || !selectedWarSide) {
      return null;
    }

    return selectedWarSide === 'attacker'
      ? selectedWar.attackerPreparation
      : selectedWar.defenderPreparation;
  }, [selectedWar, selectedWarSide]);
  const selectedWarResultCue = useMemo(
    () => (selectedFavela ? buildWarResultCue(selectedFavela, player) : null),
    [player, selectedFavela],
  );
  const selectedAlerts = useMemo(
    () => (selectedFavela ? buildFavelaAlertLines(selectedFavela) : []),
    [selectedFavela],
  );
  const canPrepareSelectedWar = Boolean(
    selectedWar &&
      selectedWarSide &&
      (selectedWar.status === 'declared' || selectedWar.status === 'preparing') &&
      !selectedWarPreparation,
  );
  const canAdvanceSelectedWarRound = Boolean(
    selectedWar &&
      selectedWarSide &&
      selectedWar.status === 'active',
  );

  const hasLiveCountdown = Boolean(
    baileBook?.baile.cooldownEndsAt ||
      selectedFavela?.x9?.warningEndsAt ||
      selectedWar?.nextRoundAt ||
      selectedWar?.preparationEndsAt,
  );

  const loadFavelaDetail = useCallback(async (favelaId: string) => {
    setIsDetailLoading(true);
    setServicesBook(null);
    setBaileBook(null);
    setWarBook(null);

    try {
      const [nextServicesBook, nextBaileBook, nextWarBook] = await Promise.allSettled([
        territoryApi.getServices(favelaId),
        territoryApi.getBaile(favelaId),
        territoryApi.getWar(favelaId),
      ]);

      setServicesBook(nextServicesBook.status === 'fulfilled' ? nextServicesBook.value : null);
      setBaileBook(nextBaileBook.status === 'fulfilled' ? nextBaileBook.value : null);
      setWarBook(nextWarBook.status === 'fulfilled' ? nextWarBook.value : null);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const loadTerritoryHub = useCallback(
    async (
      preferredFavelaId: string | null,
      preferredRegionId: string | null,
    ): Promise<string | null> => {
      setIsLoading(true);
      setLoadErrorMessage(null);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const nextOverview = await territoryApi.list();
        const nextRegionId = resolvePreferredRegionId(
          nextOverview,
          preferredRegionId,
          preferredFavelaId,
          player?.regionId ?? null,
        );
        const nextFavelaId = resolvePreferredFavelaId(
          nextOverview,
          nextRegionId,
          preferredFavelaId,
          route.params?.focusFavelaId ?? null,
        );

        setOverview(nextOverview);
        setSelectedRegionId(nextRegionId);
        setSelectedFavelaId(nextFavelaId);

        if (nextFavelaId) {
          await loadFavelaDetail(nextFavelaId);
        } else {
          setServicesBook(null);
          setBaileBook(null);
          setWarBook(null);
        }

        return nextFavelaId;
      } catch (error) {
        setLoadErrorMessage(formatApiError(error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      loadFavelaDetail,
      player?.regionId,
      route.params?.focusFavelaId,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTerritoryHub(route.params?.focusFavelaId ?? null, player?.regionId ?? null);
      return undefined;
    }, [loadTerritoryHub, route.params?.focusFavelaId, player?.regionId]),
  );

  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());

      if (!hasLiveCountdown) {
        return undefined;
      }

      const intervalId = setInterval(() => {
        setNowMs(Date.now());
      }, 60_000);

      return () => {
        clearInterval(intervalId);
      };
    }, [hasLiveCountdown]),
  );

  useEffect(() => {
    const focusFavelaId = route.params?.focusFavelaId ?? null;

    if (!focusFavelaId || focusFavelaId === selectedFavelaId) {
      return;
    }

    const nextFavela = overview?.favelas.find((favela) => favela.id === focusFavelaId) ?? null;

    if (!nextFavela) {
      return;
    }

    setSelectedRegionId(nextFavela.regionId);
    setSelectedFavelaId(nextFavela.id);
    void loadFavelaDetail(nextFavela.id);
  }, [loadFavelaDetail, overview?.favelas, route.params?.focusFavelaId, selectedFavelaId]);

  useEffect(() => {
    setExpandedActionId(null);
  }, [selectedFavelaId]);

  const runMutation = useCallback(
    async (
      action: () => Promise<unknown>,
      fallbackMessage: string,
    ) => {
      const focusFavelaId = selectedFavela?.id ?? selectedFavelaId;

      if (!focusFavelaId) {
        setErrorMessage('Selecione uma favela antes de executar a ação.');
        return;
      }

      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const result = await action();
        await refreshPlayerProfile();
        await loadTerritoryHub(focusFavelaId, selectedFavela?.regionId ?? selectedRegionId);

        const message = extractResponseMessage(result) ?? fallbackMessage;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
      }
    },
    [
      loadTerritoryHub,
      refreshPlayerProfile,
      selectedFavela,
      selectedFavelaId,
      selectedRegionId,
      setBootstrapStatus,
    ],
  );

  const handleSelectRegion = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);

    const nextFavela = overview?.favelas.find((favela) => favela.regionId === regionId) ?? null;

    if (!nextFavela) {
      setSelectedFavelaId(null);
      setServicesBook(null);
      setBaileBook(null);
      setWarBook(null);
      return;
    }

    setSelectedFavelaId(nextFavela.id);
    void loadFavelaDetail(nextFavela.id);
  }, [loadFavelaDetail, overview?.favelas]);

  const handleSelectFavela = useCallback((favela: TerritoryFavelaSummary) => {
    setSelectedRegionId(favela.regionId);
    setSelectedFavelaId(favela.id);
    void loadFavelaDetail(favela.id);
  }, [loadFavelaDetail]);

  const handleConquer = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.conquer(selectedFavela.id),
      `Ataque enviado para tomar ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handleDeclareWar = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.declareWar(selectedFavela.id),
      `Guerra declarada em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handlePrepareWar = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    const parsedInput = parseWarPreparationInput(warBudgetInput, warSoldierCommitmentInput);

    if (!parsedInput) {
      const message = 'Informe budget e comprometimento de soldados validos para a guerra.';
      setErrorMessage(message);
      setBootstrapStatus(message);
      return;
    }

    await runMutation(
      () => territoryApi.prepareWar(selectedFavela.id, parsedInput),
      `Lado ${selectedWarSide ? resolveWarSideLabel(selectedWarSide).toLowerCase() : ''} preparado para a guerra.`,
    );
  }, [
    runMutation,
    selectedFavela,
    selectedWarSide,
    setBootstrapStatus,
    warBudgetInput,
    warSoldierCommitmentInput,
  ]);

  const handleAdvanceWarRound = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const result = await territoryApi.resolveWarRound(selectedFavela.id);
      await refreshPlayerProfile();
      await loadTerritoryHub(selectedFavela.id, selectedFavela.regionId);

      const cue = buildWarResultCue(result.favela, player);

      if (cue && player?.id) {
        await rememberSeenWarResult(player.id, cue.key);
        setWarResultCue(cue);
        setBootstrapStatus(cue.body);
      } else {
        const message =
          extractResponseMessage(result) ?? `Round de guerra resolvido em ${selectedFavela.name}.`;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      }
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setIsMutating(false);
    }
  }, [
    loadTerritoryHub,
    player,
    refreshPlayerProfile,
    selectedFavela,
    setBootstrapStatus,
  ]);

  const handleInstallService = useCallback(async (serviceType: Awaited<ReturnType<typeof territoryApi.getServices>>['services'][number]['definition']['type']) => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.installService(selectedFavela.id, { serviceType }),
      'Servico territorial instalado.',
    );
  }, [runMutation, selectedFavela]);

  const handleUpgradeService = useCallback(async (serviceType: Awaited<ReturnType<typeof territoryApi.getServices>>['services'][number]['definition']['type']) => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.upgradeService(selectedFavela.id, serviceType),
      'Servico territorial melhorado.',
    );
  }, [runMutation, selectedFavela]);

  const handleNegotiatePropina = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.negotiatePropina(selectedFavela.id),
      `Arrego negociado em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handleOrganizeBaile = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    const budget = parsePositiveInteger(baileBudgetInput);
    const entryPrice = parsePositiveInteger(baileEntryPriceInput);

    if (budget === null || entryPrice === null) {
      const message = 'Informe budget e ingresso validos para organizar o baile.';
      setErrorMessage(message);
      setBootstrapStatus(message);
      return;
    }

    await runMutation(
      () =>
        territoryApi.organizeBaile(selectedFavela.id, {
          budget,
          entryPrice,
          mcTier: selectedBaileTier,
        }),
      `Baile organizado em ${selectedFavela.name}.`,
    );
  }, [
    baileBudgetInput,
    baileEntryPriceInput,
    runMutation,
    selectedBaileTier,
    selectedFavela,
    setBootstrapStatus,
  ]);

  const handleX9Desenrolo = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.attemptX9Desenrolo(selectedFavela.id),
      `Desenrolo tentado em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  return (
    <InGameScreenLayout
      subtitle="Mapa vivo das favelas, leitura de satisfação, serviços, baile, pressão policial e guerra no mesmo centro de comando."
      title="Painel Territorial"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard label="Favelas" tone={colors.accent} value={`${headlineStats.totalFavelas}`} />
        <SummaryCard label="Sob controle" tone={colors.success} value={`${headlineStats.playerControlledFavelas}`} />
        <SummaryCard label="Em guerra" tone={colors.danger} value={`${headlineStats.atWarFavelas}`} />
        <SummaryCard label="X9 ativo" tone={colors.warning} value={`${headlineStats.x9ActiveFavelas}`} />
      </View>

      {isLoading && !overview ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Sincronizando território</Text>
          <Text style={styles.loadingCopy}>
            Carregando mapa de favelas, região dominante, serviços e conflitos ativos.
          </Text>
        </View>
      ) : null}

      {loadErrorMessage ? (
        <InlineBanner
          actionLabel="Tentar de novo"
          message={loadErrorMessage}
          tone="danger"
          onPress={() => {
            void loadTerritoryHub(selectedFavelaId, selectedRegionId);
          }}
        />
      ) : null}

      {overview ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa regional</Text>
            <Text style={styles.sectionSubtitle}>
              Toque numa região para focar as favelas dela. Domínio total fortalece receita, proteção e segurança.
            </Text>

            <View style={styles.regionGrid}>
              {regionGroups.map((group) => (
                <Pressable
                  key={group.region.regionId}
                  onPress={() => {
                    handleSelectRegion(group.region.regionId);
                  }}
                  style={({ pressed }) => [
                    styles.regionCard,
                    group.region.regionId === visibleRegionId ? styles.regionCardActive : null,
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <Text style={styles.regionTitle}>{resolveRegionLabel(group.region.regionId)}</Text>
                  <Text style={styles.regionStat}>
                    {group.region.playerFactionControlledFavelas}/{group.region.totalFavelas} sob sua facção
                  </Text>
                  <Text style={styles.regionCopy}>
                    Dominante: {group.region.dominantFaction?.abbreviation ?? '--'} · Guerra: {group.region.atWarFavelas}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa de favelas</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedRegion ? `${resolveRegionLabel(selectedRegion.region.regionId)} · ${selectedRegion.favelas.length} favela(s)` : 'Nenhuma região carregada'}
            </Text>

            <View style={styles.favelaGrid}>
              {selectedRegion?.favelas.map((favela) => (
                <Pressable
                  key={favela.id}
                  onPress={() => {
                    handleSelectFavela(favela);
                  }}
                  style={({ pressed }) => [
                    styles.favelaCard,
                    favela.id === selectedFavela?.id ? styles.favelaCardActive : null,
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <View style={styles.favelaHeader}>
                    <Text style={styles.favelaTitle}>{favela.name}</Text>
                    <StatusTag label={resolveFavelaStateLabel(favela.state)} tone={resolveStateTone(favela.state)} />
                  </View>
                  <Text style={styles.favelaMeta}>
                    {favela.controllingFaction
                      ? `Controle: ${favela.controllingFaction.name}`
                      : 'Controle: sem facção'}
                  </Text>
                  <Text style={styles.favelaMeta}>
                    Dificuldade {favela.difficulty} · Satisfação {favela.satisfaction}
                  </Text>
                  <Text style={styles.favelaMeta}>
                    {resolveSatisfactionTierLabel(favela.satisfactionProfile.tier)} · Pop. {favela.population.toLocaleString('pt-BR')}
                  </Text>

                  {favela.id === selectedFavela?.id ? (
                    <>
                      <View style={styles.actionRow}>
                        {(favela.state === 'neutral' || favela.state === 'state') ? (
                          <ActionButton
                            disabled={isMutating}
                            label="Conquistar"
                            onPress={() => {
                              setExpandedActionId((current) => (current === 'conquer' ? null : 'conquer'));
                            }}
                            tone="accent"
                          />
                        ) : null}
                        {favela.state === 'controlled' &&
                        favela.controllingFaction?.id !== playerFactionId ? (
                          <ActionButton
                            disabled={isMutating}
                            label="Declarar guerra"
                            onPress={() => {
                              setExpandedActionId((current) => (current === 'declare-war' ? null : 'declare-war'));
                            }}
                            tone="danger"
                          />
                        ) : null}
                        {favela.propina?.canNegotiate ? (
                          <ActionButton
                            disabled={isMutating}
                            label="Negociar arrego"
                            onPress={() => {
                              setExpandedActionId((current) => (current === 'propina' ? null : 'propina'));
                            }}
                            tone="warning"
                          />
                        ) : null}
                        {favela.x9?.canAttemptDesenrolo ? (
                          <ActionButton
                            disabled={isMutating}
                            label="Desenrolo"
                            onPress={() => {
                              setExpandedActionId((current) => (current === 'x9' ? null : 'x9'));
                            }}
                            tone="warning"
                          />
                        ) : null}
                      </View>

                      {expandedActionId === 'conquer' ? (
                        <View style={styles.inlineActionCard}>
                          <Text style={styles.detailTitle}>Tomada da favela</Text>
                          <Text style={styles.detailCopy}>
                            A ação vai abrir uma invasão imediata para disputar {favela.name}. Se o backend aceitar, o ataque entra na fila autoritativa na hora.
                          </Text>
                          <View style={styles.actionRow}>
                            <ActionButton
                              disabled={isMutating}
                              label="Confirmar conquista"
                              onPress={() => {
                                setExpandedActionId(null);
                                void handleConquer();
                              }}
                              tone="accent"
                            />
                          </View>
                        </View>
                      ) : null}

                      {expandedActionId === 'declare-war' ? (
                        <View style={styles.inlineActionCard}>
                          <Text style={styles.detailTitle}>Abrir guerra formal</Text>
                          <Text style={styles.detailCopy}>
                            Isso formaliza o conflito por {favela.name}. O backend ainda valida cargo, saldo e elegibilidade antes de aceitar a guerra.
                          </Text>
                          <View style={styles.actionRow}>
                            <ActionButton
                              disabled={isMutating}
                              label="Confirmar guerra"
                              onPress={() => {
                                setExpandedActionId(null);
                                void handleDeclareWar();
                              }}
                              tone="danger"
                            />
                          </View>
                        </View>
                      ) : null}

                      {expandedActionId === 'propina' ? (
                        <View style={styles.inlineActionCard}>
                          <Text style={styles.detailTitle}>Negociar arrego</Text>
                          <Text style={styles.detailCopy}>
                            A negociação tenta aliviar a pressão policial atual em {favela.name}. O efeito e o custo finais continuam sendo decididos pelo backend.
                          </Text>
                          <View style={styles.actionRow}>
                            <ActionButton
                              disabled={isMutating}
                              label="Confirmar arrego"
                              onPress={() => {
                                setExpandedActionId(null);
                                void handleNegotiatePropina();
                              }}
                              tone="warning"
                            />
                          </View>
                        </View>
                      ) : null}

                      {expandedActionId === 'x9' ? (
                        <View style={styles.inlineActionCard}>
                          <Text style={styles.detailTitle}>Tentar desenrolo</Text>
                          <Text style={styles.detailCopy}>
                            O desenrolo tenta neutralizar o evento de X9 em {favela.name}. A tentativa pode falhar e o servidor continua autoritativo no resultado.
                          </Text>
                          <View style={styles.actionRow}>
                            <ActionButton
                              disabled={isMutating}
                              label="Confirmar desenrolo"
                              onPress={() => {
                                setExpandedActionId(null);
                                void handleX9Desenrolo();
                              }}
                              tone="warning"
                            />
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          {selectedFavela ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionTitle}>{selectedFavela.name}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {resolveRegionLabel(selectedFavela.regionId)} · {selectedFavela.controllingFaction?.name ?? 'Sem controle faccional'}
                    </Text>
                  </View>
                  {isDetailLoading ? <ActivityIndicator color={colors.accent} /> : null}
                </View>

                <View style={styles.summaryGrid}>
                  <SummaryCard label="Estado" tone={resolveStateColor(selectedFavela.state)} value={resolveFavelaStateLabel(selectedFavela.state)} />
                  <SummaryCard label="Satisfação" tone={resolveSatisfactionColor(selectedFavela.satisfactionProfile.tier)} value={`${selectedFavela.satisfaction}`} />
                  <SummaryCard label="Moradores" tone={colors.info} value={selectedFavela.population.toLocaleString('pt-BR')} />
                  <SummaryCard label="Propina" tone={selectedFavela.propina ? colors.warning : colors.muted} value={selectedFavela.propina ? resolvePropinaStatusLabel(selectedFavela.propina.status) : '--'} />
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailTitle}>Leitura operacional</Text>
                  <Text style={styles.detailCopy}>
                    Controlador: {selectedFavela.controllingFaction?.name ?? '--'} · Contestação: {selectedFavela.contestingFaction?.name ?? '--'} · Dificuldade {selectedFavela.difficulty}
                  </Text>
                  <Text style={styles.detailCopy}>
                    Receita x{selectedFavela.satisfactionProfile.revenueMultiplier.toFixed(2)} · Pressão populacional {selectedFavela.satisfactionProfile.populationPressurePercentPerDay.toFixed(1)}%/dia · X9 {selectedFavela.satisfactionProfile.dailyX9RiskPercent.toFixed(1)}%/dia
                  </Text>
                  <Text style={styles.detailCopy}>
                    Estabilização até {formatTerritoryTimestamp(selectedFavela.stabilizationEndsAt)} · Guerra declarada {formatTerritoryTimestamp(selectedFavela.warDeclaredAt)}
                  </Text>
                </View>

                {selectedAlerts.length > 0 ? (
                  <View style={styles.alertList}>
                    {selectedAlerts.map((alert) => (
                      <Text key={alert} style={styles.alertItem}>
                        • {alert}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>Clima local</Text>
                    <Text style={styles.detailCopy}>
                      Sem alertas críticos neste momento. A favela está com sinais controlados e leitura previsível.
                    </Text>
                  </View>
                )}

              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Satisfação da favela</Text>
                <Text style={styles.sectionSubtitle}>
                  Tier {resolveSatisfactionTierLabel(selectedFavela.satisfactionProfile.tier)} · delta diário {selectedFavela.satisfactionProfile.dailyDeltaEstimate.toFixed(1)}
                </Text>

                <View style={styles.factorList}>
                  {selectedFavela.satisfactionProfile.factors.map((factor) => (
                    <View key={factor.code} style={styles.factorCard}>
                      <Text style={styles.factorTitle}>{factor.label}</Text>
                      <Text style={styles.factorValue}>
                        {factor.dailyDelta >= 0 ? '+' : ''}
                        {factor.dailyDelta.toFixed(1)}/dia
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Serviços</Text>
                <Text style={styles.sectionSubtitle}>
                  Caixa da facção: {formatTerritoryCurrency(servicesBook?.factionBankMoney ?? 0)} · gerenciamento {servicesBook?.canManage ? 'liberado' : 'restrito'}
                </Text>

                {servicesBook ? (
                  selectedServices.map((service) => (
                    <View key={service.definition.type} style={styles.serviceCard}>
                      <View style={styles.serviceHeader}>
                        <View style={styles.serviceHeaderCopy}>
                          <Text style={styles.serviceTitle}>{service.definition.label}</Text>
                          <Text style={styles.serviceSubtitle}>
                            {resolveServiceStatusLabel(service)} · receita atual {formatTerritoryCurrency(service.currentDailyRevenue)}/dia
                          </Text>
                        </View>
                        <StatusTag
                          label={service.installed ? `Nível ${service.level}` : 'Disponível'}
                          tone={service.active ? 'success' : 'neutral'}
                        />
                      </View>

                      <Text style={styles.serviceCopy}>
                        Mult. total x{service.revenueBreakdown.totalMultiplier.toFixed(2)} · dominação x{service.revenueBreakdown.territoryDominationMultiplier.toFixed(2)} · propina x{service.revenueBreakdown.propinaPenaltyMultiplier.toFixed(2)}
                      </Text>
                      <Text style={styles.serviceCopy}>
                        Receita acumulada {formatTerritoryCurrency(service.grossRevenueTotal)} · upgrade {service.nextUpgradeCost ? formatTerritoryCurrency(service.nextUpgradeCost) : '--'}
                      </Text>

                      <View style={styles.actionRow}>
                        {!service.installed ? (
                          <ActionButton
                            disabled={isMutating || !servicesBook?.canManage}
                            label={`Instalar ${formatTerritoryCurrency(service.definition.installCost)}`}
                            onPress={() => {
                              void handleInstallService(service.definition.type);
                            }}
                            tone="accent"
                          />
                        ) : null}
                        {service.installed && service.isUpgradeable ? (
                          <ActionButton
                            disabled={isMutating || !servicesBook?.canManage}
                            label={`Upgrade ${formatTerritoryCurrency(service.nextUpgradeCost ?? 0)}`}
                            onPress={() => {
                              void handleUpgradeService(service.definition.type);
                            }}
                            tone="info"
                          />
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>Serviços bloqueados nesta favela</Text>
                    <Text style={styles.detailCopy}>
                      Sua facção precisa controlar a favela para operar serviços territoriais.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Baile funk</Text>
                <Text style={styles.sectionSubtitle}>
                  Status {resolveBaileStatusLabel(baileBook?.baile.status ?? 'ready')} · último baile {formatTerritoryTimestamp(baileBook?.baile.lastOrganizedAt ?? null)}
                </Text>

                <View style={styles.detailCard}>
                  <Text style={styles.detailTitle}>Leitura do evento</Text>
                  <Text style={styles.detailCopy}>
                    Cooldown {formatTerritoryCountdown(baileBook?.baile.cooldownEndsAt ?? null, nowMs) ?? '--'} · ativo até {formatTerritoryTimestamp(baileBook?.baile.activeEndsAt ?? null)} · ressaca até {formatTerritoryTimestamp(baileBook?.baile.hangoverEndsAt ?? null)}
                  </Text>
                  <Text style={styles.detailCopy}>
                    Último resultado {baileBook?.baile.resultTier ?? '--'} · boost de stamina {baileBook?.baile.staminaBoostPercent ?? 0}% · delta de satisfação {baileBook?.baile.satisfactionDelta ?? 0}
                  </Text>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Orçamento do baile</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setBaileBudgetInput}
                    placeholder="45000"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={baileBudgetInput}
                  />
                  <Text style={styles.formLabel}>Ingresso</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setBaileEntryPriceInput}
                    placeholder="120"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={baileEntryPriceInput}
                  />
                  <Text style={styles.formLabel}>Nível do MC</Text>
                  <View style={styles.optionRow}>
                    {BAILE_TIERS.map((tier) => (
                      <MiniToggle
                        key={tier}
                        active={selectedBaileTier === tier}
                        label={resolveBaileTierLabel(tier)}
                        onPress={() => {
                          setSelectedBaileTier(tier);
                        }}
                      />
                    ))}
                  </View>

                  <View style={styles.actionRow}>
                    <ActionButton
                      disabled={isMutating || !servicesBook?.canManage}
                      label="Organizar baile"
                      onPress={() => {
                        void handleOrganizeBaile();
                      }}
                      tone="accent"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pressao e conflito</Text>
                <Text style={styles.sectionSubtitle}>
                  Arrego, X9 e guerra convivem aqui. O objetivo e responder cedo, antes que a favela desmonte.
                </Text>

                <View style={styles.pressureGrid}>
                  <View style={styles.pressureCard}>
                    <Text style={styles.pressureTitle}>Propina</Text>
                    <Text style={styles.pressureValue}>
                      {selectedFavela.propina ? resolvePropinaStatusLabel(selectedFavela.propina.status) : '--'}
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Atual {formatTerritoryCurrency(selectedFavela.propina?.currentAmount ?? selectedFavela.propinaValue)}
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Vence {formatTerritoryTimestamp(selectedFavela.propina?.dueAt ?? null)}
                    </Text>
                  </View>

                  <View style={styles.pressureCard}>
                    <Text style={styles.pressureTitle}>X9</Text>
                    <Text style={styles.pressureValue}>
                      {selectedFavela.x9 ? resolveX9StatusLabel(selectedFavela.x9.status) : 'Sem evento'}
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Risco atual {selectedFavela.x9?.currentRiskPercent.toFixed(1) ?? selectedFavela.satisfactionProfile.dailyX9RiskPercent.toFixed(1)}%
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Janela {formatTerritoryCountdown(selectedFavela.x9?.warningEndsAt ?? null, nowMs) ?? '--'}
                    </Text>
                  </View>

                  <View style={styles.pressureCard}>
                    <Text style={styles.pressureTitle}>Guerra</Text>
                    <Text style={styles.pressureValue}>
                      {selectedWar ? resolveWarStatusLabel(selectedWar.status) : 'Sem guerra'}
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Score {selectedWar ? `${selectedWar.attackerScore} x ${selectedWar.defenderScore}` : '--'}
                    </Text>
                    <Text style={styles.pressureCopy}>
                      Próximo passo {selectedWar ? formatTerritoryCountdown(selectedWar.nextRoundAt ?? selectedWar.preparationEndsAt, nowMs) ?? '--' : '--'}
                    </Text>
                  </View>
                </View>

                {selectedWar ? (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>
                      {selectedWarResultCue ? 'Desfecho da guerra' : 'Teatro de guerra'}
                    </Text>
                    <Text style={styles.detailCopy}>
                      {selectedWar.attackerFaction.abbreviation} x {selectedWar.defenderFaction.abbreviation} · seu lado {selectedWarSide ? resolveWarSideLabel(selectedWarSide) : 'Fora do conflito'} · rounds {selectedWar.roundsResolved}/{selectedWar.roundsTotal}
                    </Text>
                    <Text style={styles.detailCopy}>
                      Preparação até {formatTerritoryTimestamp(selectedWar.preparationEndsAt)} · cooldown até {formatTerritoryTimestamp(selectedWar.cooldownEndsAt)}
                    </Text>
                    <Text style={styles.detailCopy}>
                      Espólio {formatTerritoryCurrency(selectedWar.lootMoney)} · vencedor {selectedWar.winnerFactionId ?? '--'}
                    </Text>

                    {selectedWarResultCue ? (
                      <>
                        <Text style={styles.detailCopy}>{selectedWarResultCue.territorialImpact}</Text>
                        <Text style={styles.detailCopy}>{selectedWarResultCue.personalImpact.label}</Text>
                        {selectedWarResultCue.personalImpact.directParticipation ? (
                          <Text style={styles.detailCopy}>
                            Conceito {selectedWarResultCue.personalImpact.conceitoDelta >= 0 ? '+' : ''}
                            {selectedWarResultCue.personalImpact.conceitoDelta} · HP -{selectedWarResultCue.personalImpact.hpLoss} · NRV -{selectedWarResultCue.personalImpact.nerveLoss} · STA -{selectedWarResultCue.personalImpact.staminaLoss}
                          </Text>
                        ) : null}
                      </>
                    ) : null}

                    {selectedWar.rounds.length > 0 ? (
                      <View style={styles.roundList}>
                        {selectedWar.rounds.slice().reverse().map((round) => (
                          <View key={`${round.roundNumber}-${round.resolvedAt}`} style={styles.roundCard}>
                            <Text style={styles.roundTitle}>
                              Round {round.roundNumber} · {resolveRoundOutcomeLabel(round.outcome)}
                            </Text>
                            <Text style={styles.roundCopy}>
                              Poder {Math.round(round.attackerPower)} x {Math.round(round.defenderPower)} · perdas HP {round.attackerHpLoss}/{round.defenderHpLoss}
                            </Text>
                            <Text style={styles.roundCopy}>{round.message}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {canPrepareSelectedWar ? (
                      <View style={styles.formCard}>
                        <Text style={styles.formLabel}>Budget de guerra</Text>
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={setWarBudgetInput}
                          placeholder="25000"
                          placeholderTextColor={colors.muted}
                          style={styles.input}
                          value={warBudgetInput}
                        />
                        <Text style={styles.formLabel}>Comprometimento de soldados</Text>
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={setWarSoldierCommitmentInput}
                          placeholder="6"
                          placeholderTextColor={colors.muted}
                          style={styles.input}
                          value={warSoldierCommitmentInput}
                        />
                        <View style={styles.actionRow}>
                          <ActionButton
                            disabled={isMutating}
                            label="Preparar lado"
                            onPress={() => {
                              void handlePrepareWar();
                            }}
                            tone="danger"
                          />
                        </View>
                      </View>
                    ) : null}

                    {canAdvanceSelectedWarRound ? (
                      <View style={styles.actionRow}>
                        <ActionButton
                          disabled={isMutating}
                          label="Resolver round"
                          onPress={() => {
                            void handleAdvanceWarRound();
                          }}
                          tone="danger"
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <MutationResultModal
        message={errorMessage ?? feedbackMessage}
        onClose={() => {
          setErrorMessage(null);
          setFeedbackMessage(null);
        }}
        tone={errorMessage ? 'danger' : 'info'}
        visible={Boolean(errorMessage ?? feedbackMessage)}
      />
      <WarResultModal
        cue={warResultCue}
        onClose={() => {
          setWarResultCue(null);
        }}
        visible={Boolean(warResultCue)}
      />
    </InGameScreenLayout>
  );
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone: 'accent' | 'danger' | 'info' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'accent' ? styles.actionButtonAccent : null,
        tone === 'danger' ? styles.actionButtonDanger : null,
        tone === 'info' ? styles.actionButtonInfo : null,
        tone === 'warning' ? styles.actionButtonWarning : null,
        pressed ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <Text style={styles.actionButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function InlineBanner({
  actionLabel,
  message,
  onPress,
  tone,
}: {
  actionLabel?: string;
  message: string;
  onPress?: () => void;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.cardPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
            style={({ pressed }) => [styles.modalButton, pressed ? styles.cardPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MiniToggle({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        active ? styles.toggleChipActive : null,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <Text style={[styles.toggleChipLabel, active ? styles.toggleChipLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusTag({
  label,
  tone,
}: {
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.statusTag,
        tone === 'danger' ? styles.statusTagDanger : null,
        tone === 'neutral' ? styles.statusTagNeutral : null,
        tone === 'success' ? styles.statusTagSuccess : null,
        tone === 'warning' ? styles.statusTagWarning : null,
      ]}
    >
      <Text style={styles.statusTagLabel}>{label}</Text>
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

function extractResponseMessage(result: unknown): string | null {
  if (
    typeof result === 'object' &&
    result !== null &&
    'message' in result &&
    typeof result.message === 'string'
  ) {
    return result.message;
  }

  return null;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseWarPreparationInput(
  budgetValue: string,
  soldierCommitmentValue: string,
): FactionWarPrepareInput | null {
  const budget = parsePositiveInteger(budgetValue);
  const soldierCommitment = parsePositiveInteger(soldierCommitmentValue);

  if (budget === null || soldierCommitment === null) {
    return null;
  }

  return {
    budget,
    soldierCommitment,
  };
}

function resolveBaileTierLabel(tier: FavelaBaileMcTier): string {
  switch (tier) {
    case 'local':
      return 'Local';
    case 'regional':
      return 'Regional';
    case 'estelar':
      return 'Estelar';
  }
}

function resolvePreferredFavelaId(
  overview: TerritoryOverviewResponse,
  regionId: string | null,
  preferredFavelaId: string | null,
  routeFavelaId: string | null,
): string | null {
  const candidates = [
    preferredFavelaId,
    routeFavelaId,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (overview.favelas.some((favela) => favela.id === candidate)) {
      return candidate;
    }
  }

  if (regionId) {
    const regionalFavela = overview.favelas.find((favela) => favela.regionId === regionId);

    if (regionalFavela) {
      return regionalFavela.id;
    }
  }

  return overview.favelas[0]?.id ?? null;
}

function resolvePreferredRegionId(
  overview: TerritoryOverviewResponse,
  preferredRegionId: string | null,
  preferredFavelaId: string | null,
  fallbackPlayerRegionId: string | null,
): string | null {
  if (preferredFavelaId) {
    const focusedFavela = overview.favelas.find((favela) => favela.id === preferredFavelaId);

    if (focusedFavela) {
      return focusedFavela.regionId;
    }
  }

  if (
    preferredRegionId &&
    overview.regions.some((region) => region.regionId === preferredRegionId)
  ) {
    return preferredRegionId;
  }

  if (
    fallbackPlayerRegionId &&
    overview.regions.some((region) => region.regionId === fallbackPlayerRegionId)
  ) {
    return fallbackPlayerRegionId;
  }

  return overview.regions[0]?.regionId ?? null;
}

function resolveSatisfactionColor(
  tier: TerritoryFavelaSummary['satisfactionProfile']['tier'],
): string {
  switch (tier) {
    case 'happy':
      return colors.success;
    case 'stable':
      return colors.info;
    case 'restless':
      return colors.warning;
    case 'critical':
    case 'collapsed':
      return colors.danger;
  }
}

function resolveStateColor(state: TerritoryFavelaSummary['state']): string {
  switch (state) {
    case 'controlled':
      return colors.success;
    case 'neutral':
      return colors.info;
    case 'state':
      return colors.warning;
    case 'at_war':
      return colors.danger;
  }
}

function resolveStateTone(
  state: TerritoryFavelaSummary['state'],
): 'danger' | 'neutral' | 'success' | 'warning' {
  switch (state) {
    case 'controlled':
      return 'success';
    case 'neutral':
      return 'neutral';
    case 'state':
      return 'warning';
    case 'at_war':
      return 'danger';
  }
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexGrow: 1,
    minHeight: 44,
    justifyContent: 'center',
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonAccent: {
    backgroundColor: colors.accent,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonInfo: {
    backgroundColor: colors.info,
  },
  actionButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonWarning: {
    backgroundColor: colors.warning,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  alertItem: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  alertList: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  banner: {
    alignItems: 'flex-start',
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  bannerButton: {
    backgroundColor: 'rgba(17, 17, 17, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bannerCopy: {
    color: colors.background,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerDanger: {
    backgroundColor: colors.danger,
  },
  bannerInfo: {
    backgroundColor: colors.info,
  },
  cardPressed: {
    opacity: 0.86,
  },
  detailCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  detailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  factorCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 4,
    padding: 12,
  },
  factorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factorTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  factorValue: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '700',
  },
  favelaCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 6,
    minHeight: 112,
    padding: 12,
  },
  favelaCardActive: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  favelaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  favelaHeader: {
    alignItems: 'flex-start',
    gap: 8,
  },
  favelaMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  favelaTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  inlineActionCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
    padding: 12,
  },
  formCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  formLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 22,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 320,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  modalCardDanger: {
    borderColor: 'rgba(220, 102, 102, 0.4)',
  },
  modalCardInfo: {
    borderColor: 'rgba(123, 178, 255, 0.36)',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pressureCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '31%',
    gap: 4,
    padding: 12,
  },
  pressureCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  pressureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pressureTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pressureValue: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
  },
  regionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 6,
    padding: 14,
  },
  regionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.panelAlt,
  },
  regionCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  regionStat: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  regionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  roundCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  roundCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  roundList: {
    gap: 8,
  },
  roundTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  serviceCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  serviceCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  serviceHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  serviceHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  serviceSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  statusTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusTagDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.2)',
  },
  statusTagLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTagNeutral: {
    backgroundColor: 'rgba(168, 163, 154, 0.18)',
  },
  statusTagSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.2)',
  },
  statusTagWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.2)',
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 6,
    padding: 14,
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
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  toggleChip: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toggleChipLabelActive: {
    color: colors.background,
  },
});
