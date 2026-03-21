import {
  type TerritoryFavelaSummary,
  type TribunalCaseSummary,
  type TribunalJudgmentSummary,
  type TribunalPunishment,
} from '@cs-rio/shared';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildControlledTribunalFavelas,
  formatTribunalDeadlineLabel,
  formatTribunalTimestamp,
  pickInitialTribunalFavelaId,
  resolveTribunalCaseStatusLabel,
  resolveTribunalJudgmentReadLabel,
  resolveTribunalPunishmentLabel,
  resolveTribunalPunishmentReadLabel,
  resolveTribunalRegionLabel,
  resolveTribunalResolutionSourceLabel,
  resolveTribunalSeverityLabel,
  resolveTribunalSideLabel,
} from '../features/tribunal';
import { formatApiError, territoryApi, tribunalApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import {
  EmptyCard,
  formatSignedDelta,
  InlineBanner,
  JudgmentResultModal,
  LoadingCard,
  MetricPill,
  ParticipantCard,
  styles,
  SummaryCard,
} from './TribunalScreen.parts';

export function TribunalScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Tribunal'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(
    null,
  );
  const [center, setCenter] = useState<Awaited<ReturnType<typeof tribunalApi.getCenter>> | null>(
    null,
  );
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(
    route.params?.focusFavelaId ?? null,
  );
  const [selectedPunishment, setSelectedPunishment] = useState<TribunalPunishment | null>(null);
  const [lastJudgment, setLastJudgment] = useState<TribunalJudgmentSummary | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isCenterLoading, setIsCenterLoading] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const controlledFavelas = useMemo(() => buildControlledTribunalFavelas(overview), [overview]);
  const selectedFavela = useMemo(
    () => controlledFavelas.find((favela) => favela.id === selectedFavelaId) ?? null,
    [controlledFavelas, selectedFavelaId],
  );
  const activeCase = center?.activeCase?.judgedAt ? null : (center?.activeCase ?? null);
  const latestResolvedCase =
    center?.latestResolvedCase ?? (center?.activeCase?.judgedAt ? center.activeCase : null);
  const latestResolvedOutcome = center?.latestResolvedOutcome ?? null;
  const activeCaseDeadlineLabel = activeCase
    ? formatTribunalDeadlineLabel(activeCase.decisionDeadlineAt, currentTimeMs)
    : null;

  useEffect(() => {
    if (!activeCase) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeCase]);

  useEffect(() => {
    if (!activeCase) {
      setSelectedPunishment(null);
      return;
    }

    setSelectedPunishment((currentPunishment) => {
      if (activeCase.judgedAt && activeCase.punishmentChosen) {
        return activeCase.punishmentChosen;
      }

      if (
        currentPunishment &&
        activeCase.definition.allowedPunishments.includes(currentPunishment)
      ) {
        return currentPunishment;
      }

      return activeCase.antigaoSuggestedPunishment;
    });
  }, [activeCase]);

  const loadTribunalCenter = useCallback(async (favelaId: string) => {
    setIsCenterLoading(true);
    setErrorMessage(null);

    try {
      const response = await tribunalApi.getCenter(favelaId);
      setCenter(response);
    } catch (error) {
      setCenter(null);
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsCenterLoading(false);
    }
  }, []);

  const loadTribunalHub = useCallback(
    async (preferredFavelaId?: string | null) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextOverview = await territoryApi.list();
        const nextControlledFavelas = buildControlledTribunalFavelas(nextOverview);
        const nextFavelaId = pickInitialTribunalFavelaId(nextControlledFavelas, preferredFavelaId);

        setOverview(nextOverview);
        setSelectedFavelaId(nextFavelaId);
        setLastJudgment(null);

        if (nextFavelaId) {
          await loadTribunalCenter(nextFavelaId);
        } else {
          setCenter(null);
        }
      } catch (error) {
        setOverview(null);
        setCenter(null);
        setErrorMessage(formatApiError(error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [loadTribunalCenter],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTribunalHub(route.params?.focusFavelaId ?? null);
      return undefined;
    }, [loadTribunalHub, route.params?.focusFavelaId]),
  );

  const handleSelectFavela = useCallback(
    (favela: TerritoryFavelaSummary) => {
      setSelectedFavelaId(favela.id);
      setFeedbackMessage(null);
      setErrorMessage(null);
      setLastJudgment(null);
      void loadTribunalCenter(favela.id);
    },
    [loadTribunalCenter],
  );

  const handleJudgeCase = useCallback(async () => {
    if (!selectedFavelaId || !selectedPunishment || !activeCase || activeCase.judgedAt) {
      return;
    }

    if (new Date(activeCase.decisionDeadlineAt).getTime() <= Date.now()) {
      const message =
        'O prazo acabou e o comando local deve assumir o caso na próxima sincronização.';
      setBootstrapStatus(message);
      setErrorMessage(message);
      void loadTribunalCenter(selectedFavelaId);
      return;
    }

    setIsJudging(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await tribunalApi.judgeCase(selectedFavelaId, {
        punishment: selectedPunishment,
      });

      setCenter(response);
      setLastJudgment(response.judgment);
      await refreshPlayerProfile();

      const message = `Julgamento concluído: ${resolveTribunalJudgmentReadLabel(response.judgment.read)}.`;
      setBootstrapStatus(message);
      setFeedbackMessage(null);
    } catch (error) {
      const message = formatApiError(error).message;
      setBootstrapStatus(message);
      setErrorMessage(message);
    } finally {
      setIsJudging(false);
    }
  }, [
    activeCase,
    loadTribunalCenter,
    refreshPlayerProfile,
    selectedFavelaId,
    selectedPunishment,
    setBootstrapStatus,
  ]);

  const punishmentInsights = useMemo(() => {
    if (!activeCase) {
      return [];
    }

    const insightMap = new Map(
      activeCase.antigaoAdvice.punishmentInsights.map((insight) => [insight.punishment, insight]),
    );

    return activeCase.definition.allowedPunishments.map((punishment) => ({
      insight: insightMap.get(punishment) ?? null,
      punishment,
    }));
  }, [activeCase]);

  return (
    <InGameScreenLayout
      subtitle="Os casos surgem automaticamente nas favelas dominadas. Você precisa decidir antes do prazo ou o comando local assume e bate o pior martelo possível para os moradores."
      title="Julgar caso"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={() => {
            navigation.navigate('Territory', {
              focusFavelaId: selectedFavelaId ?? undefined,
            });
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir território</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void loadTribunalHub(selectedFavelaId);
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Sincronizar</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Favela" tone={colors.accent} value={selectedFavela?.name ?? '---'} />
        <SummaryCard
          label="Região"
          tone={colors.info}
          value={selectedFavela ? resolveTribunalRegionLabel(selectedFavela.regionId) : '---'}
        />
        <SummaryCard
          label="Status"
          tone={activeCase ? colors.warning : latestResolvedCase ? colors.info : colors.success}
          value={
            activeCase
              ? resolveTribunalCaseStatusLabel(activeCase.status)
              : latestResolvedCase
                ? resolveTribunalCaseStatusLabel(latestResolvedCase.status)
                : 'Sem caso'
          }
        />
        <SummaryCard
          label="Nível"
          tone={colors.success}
          value={`${center?.player.level ?? player?.level ?? 0}`}
        />
      </View>

      {controlledFavelas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favelas sob controle</Text>
          <View style={styles.favelaChipRow}>
            {controlledFavelas.map((favela) => {
              const isSelected = favela.id === selectedFavelaId;
              return (
                <Pressable
                  key={favela.id}
                  onPress={() => {
                    handleSelectFavela(favela);
                  }}
                  style={({ pressed }) => [
                    styles.favelaChip,
                    isSelected ? styles.favelaChipSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.favelaChipLabel,
                      isSelected ? styles.favelaChipLabelSelected : null,
                    ]}
                  >
                    {favela.name}
                  </Text>
                  <Text style={styles.favelaChipMeta}>
                    {resolveTribunalRegionLabel(favela.regionId)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <LoadingCard
          copy="Buscando as favelas controladas e sincronizando o centro do Tribunal."
          title="Carregando Tribunal"
        />
      ) : null}

      {errorMessage ? (
        <InlineBanner
          actionLabel="Tentar de novo"
          message={errorMessage}
          tone="danger"
          onPress={() => {
            void loadTribunalHub(selectedFavelaId);
          }}
        />
      ) : null}

      {feedbackMessage ? <InlineBanner message={feedbackMessage} tone="info" /> : null}

      {activeCase && activeCaseDeadlineLabel ? (
        <InlineBanner
          message={`O caso atual fecha em ${activeCaseDeadlineLabel}. Se você não decidir, o comando local assume e aplica a pior saída para os moradores.`}
          tone="info"
        />
      ) : null}

      {!activeCase && latestResolvedOutcome?.resolutionSource === 'npc' ? (
        <InlineBanner
          message={`Você perdeu o prazo deste tribunal. ${resolveTribunalResolutionSourceLabel(latestResolvedOutcome.resolutionSource)} escolheu ${resolveTribunalPunishmentLabel(latestResolvedOutcome.punishmentChosen).toLowerCase()} e o desfecho ficou registrado abaixo.`}
          tone="danger"
        />
      ) : null}

      {!isLoading && controlledFavelas.length === 0 ? (
        <EmptyCard
          actionLabel="Abrir território"
          copy="Sua facção ainda não controla nenhuma favela apta para abrir o Tribunal. Conquiste território primeiro."
          title="Tribunal indisponível"
          onPress={() => {
            navigation.navigate('Territory');
          }}
        />
      ) : null}

      {!isLoading && controlledFavelas.length > 0 && isCenterLoading ? (
        <LoadingCard
          copy="Carregando o caso ativo, a leitura do Antigão e o contexto dessa favela."
          title="Sincronizando caso"
        />
      ) : null}

      {!isLoading &&
      !isCenterLoading &&
      controlledFavelas.length > 0 &&
      !activeCase &&
      !latestResolvedCase ? (
        <EmptyCard
          actionLabel="Sincronizar"
          copy="Não há caso aberto nesta favela agora. Os tribunais surgem automaticamente; quando um novo caso entrar em pauta, ele aparece aqui e também abre como alerta no jogo."
          title="Aguardando novo tribunal"
          onPress={() => {
            void loadTribunalHub(selectedFavelaId);
          }}
        />
      ) : null}

      {activeCase ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caso em pauta</Text>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{activeCase.definition.label}</Text>
                  <Text style={styles.cardSubtitle}>{activeCase.summary}</Text>
                </View>
                <View style={[styles.statusPill, styles.statusPillRunning]}>
                  <Text style={styles.statusPillLabel}>
                    {resolveTribunalCaseStatusLabel(activeCase.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricPill
                  label="Severidade"
                  value={resolveTribunalSeverityLabel(activeCase.definition.severity)}
                />
                <MetricPill
                  label="Rua apoia"
                  value={resolveTribunalSideLabel(activeCase.communitySupports)}
                />
                <MetricPill
                  label="Verdade"
                  value={resolveTribunalSideLabel(activeCase.truthRead)}
                />
                <MetricPill label="Criado" value={formatTribunalTimestamp(activeCase.createdAt)} />
                <MetricPill
                  label="Prazo"
                  value={
                    activeCaseDeadlineLabel ??
                    formatTribunalTimestamp(activeCase.decisionDeadlineAt)
                  }
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Versões dos lados</Text>
            <View style={styles.participantStack}>
              <ParticipantCard
                label="Acusador"
                participant={activeCase.accuser}
                tone={colors.info}
              />
              <ParticipantCard
                label="Acusado"
                participant={activeCase.accused}
                tone={colors.warning}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leitura do Antigão</Text>
            <View style={styles.card}>
              <Text style={styles.helperHeadline}>{activeCase.antigaoHint}</Text>
              <Text style={styles.helperCopy}>{activeCase.antigaoAdvice.balanceWarning}</Text>
              <View style={styles.metricRow}>
                <MetricPill
                  label="Rua"
                  value={resolveTribunalSideLabel(activeCase.antigaoAdvice.communityRead)}
                />
                <MetricPill
                  label="Verdade"
                  value={resolveTribunalSideLabel(activeCase.antigaoAdvice.truthRead)}
                />
                <MetricPill
                  label="Sugestão"
                  value={resolveTribunalPunishmentLabel(activeCase.antigaoSuggestedPunishment)}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Punição</Text>
            <View style={styles.optionStack}>
              {punishmentInsights.map(({ insight, punishment }) => {
                const isSelected = selectedPunishment === punishment;
                const isDisabled = Boolean(activeCase.judgedAt) || isJudging;
                return (
                  <Pressable
                    key={punishment}
                    disabled={isDisabled}
                    onPress={() => {
                      setSelectedPunishment(punishment);
                    }}
                    style={({ pressed }) => [
                      styles.optionCard,
                      isSelected ? styles.optionCardSelected : null,
                      isDisabled ? styles.optionCardDisabled : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <View style={styles.optionTopRow}>
                      <Text
                        style={[styles.optionTitle, isSelected ? styles.optionTitleSelected : null]}
                      >
                        {resolveTribunalPunishmentLabel(punishment)}
                      </Text>
                      {insight?.recommended ? (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeLabel}>Antigão</Text>
                        </View>
                      ) : null}
                    </View>
                    {insight ? (
                      <>
                        <Text style={styles.optionCopy}>{insight.note}</Text>
                        <View style={styles.metricRow}>
                          <MetricPill
                            label="Leitura"
                            value={resolveTribunalPunishmentReadLabel(insight.read)}
                          />
                          <MetricPill
                            label="Moradores"
                            value={formatSignedDelta(insight.moradoresImpact)}
                          />
                          <MetricPill
                            label="Facção"
                            value={formatSignedDelta(insight.faccaoImpact)}
                          />
                        </View>
                      </>
                    ) : (
                      <Text style={styles.optionCopy}>
                        Sem leitura detalhada para essa punição.
                      </Text>
                    )}

                    {isSelected && !activeCase.judgedAt ? (
                      <View style={styles.inlineActionCard}>
                        <Text style={styles.helperCopy}>
                          Ao bater o martelo, o julgamento fecha na hora. Se você deixar o prazo
                          estourar, o comando local assume e escolhe a pior saída possível para a
                          população.
                        </Text>
                        <Pressable
                          disabled={!selectedPunishment || isJudging}
                          onPress={() => {
                            void handleJudgeCase();
                          }}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            !selectedPunishment || isJudging ? styles.primaryButtonDisabled : null,
                            pressed ? styles.buttonPressed : null,
                          ]}
                        >
                          <Text style={styles.primaryButtonLabel}>
                            {isJudging ? 'Julgando...' : 'Bater o martelo'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.primaryActionRow}>
            <Pressable
              onPress={() => {
                void loadTribunalHub(selectedFavelaId);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonLabel}>Atualizar painel</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {!activeCase && latestResolvedCase && latestResolvedOutcome ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Último desfecho</Text>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{latestResolvedCase.definition.label}</Text>
                  <Text style={styles.cardSubtitle}>{latestResolvedCase.summary}</Text>
                </View>
                <View style={[styles.statusPill, styles.statusPillReady]}>
                  <Text style={styles.statusPillLabel}>
                    {resolveTribunalResolutionSourceLabel(latestResolvedOutcome.resolutionSource)}
                  </Text>
                </View>
              </View>

              <Text style={styles.helperHeadline}>{latestResolvedOutcome.summary}</Text>
              <View style={styles.metricRow}>
                <MetricPill
                  label="Encerrado"
                  value={formatTribunalTimestamp(latestResolvedOutcome.resolvedAt)}
                />
                <MetricPill
                  label="Punição"
                  value={resolveTribunalPunishmentLabel(latestResolvedOutcome.punishmentChosen)}
                />
                <MetricPill
                  label="Moradores"
                  value={formatSignedDelta(latestResolvedOutcome.moradoresImpact)}
                />
                <MetricPill
                  label="Facção"
                  value={formatSignedDelta(latestResolvedOutcome.faccaoImpact)}
                />
                <MetricPill
                  label="Conceito"
                  value={formatSignedDelta(latestResolvedOutcome.conceitoDelta)}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caso encerrado</Text>
            <View style={styles.participantStack}>
              <ParticipantCard
                label="Acusador"
                participant={latestResolvedCase.accuser}
                tone={colors.info}
              />
              <ParticipantCard
                label="Acusado"
                participant={latestResolvedCase.accused}
                tone={colors.warning}
              />
            </View>
          </View>
        </>
      ) : null}

      <JudgmentResultModal
        judgment={lastJudgment}
        onClose={() => {
          setLastJudgment(null);
        }}
        visible={lastJudgment !== null}
      />
    </InGameScreenLayout>
  );
}
