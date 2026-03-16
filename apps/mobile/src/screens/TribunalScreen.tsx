import {
  type TerritoryFavelaSummary,
  type TribunalCaseSummary,
  type TribunalJudgmentSummary,
  type TribunalPunishment,
} from '@cs-rio/shared';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

export function TribunalScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Tribunal'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof tribunalApi.getCenter>> | null>(null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(route.params?.focusFavelaId ?? null);
  const [selectedPunishment, setSelectedPunishment] = useState<TribunalPunishment | null>(null);
  const [lastJudgment, setLastJudgment] = useState<TribunalJudgmentSummary | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isCenterLoading, setIsCenterLoading] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const controlledFavelas = useMemo(
    () => buildControlledTribunalFavelas(overview),
    [overview],
  );
  const selectedFavela = useMemo(
    () => controlledFavelas.find((favela) => favela.id === selectedFavelaId) ?? null,
    [controlledFavelas, selectedFavelaId],
  );
  const activeCase = center?.activeCase?.judgedAt ? null : (center?.activeCase ?? null);
  const latestResolvedCase = center?.latestResolvedCase ?? (center?.activeCase?.judgedAt ? center.activeCase : null);
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
      const message = 'O prazo acabou e o comando local deve assumir o caso na próxima sincronização.';
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
      title="Tribunal do Tráfico"
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
        <SummaryCard
          label="Favela"
          tone={colors.accent}
          value={selectedFavela?.name ?? '---'}
        />
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

      {!isLoading && !isCenterLoading && controlledFavelas.length > 0 && !activeCase && !latestResolvedCase ? (
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
                <View
                  style={[
                    styles.statusPill,
                    styles.statusPillRunning,
                  ]}
                >
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
                <MetricPill
                  label="Criado"
                  value={formatTribunalTimestamp(activeCase.createdAt)}
                />
                <MetricPill
                  label="Prazo"
                  value={activeCaseDeadlineLabel ?? formatTribunalTimestamp(activeCase.decisionDeadlineAt)}
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
                        style={[
                          styles.optionTitle,
                          isSelected ? styles.optionTitleSelected : null,
                        ]}
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
                          <MetricPill label="Leitura" value={resolveTribunalPunishmentReadLabel(insight.read)} />
                          <MetricPill label="Moradores" value={formatSignedDelta(insight.moradoresImpact)} />
                          <MetricPill label="Facção" value={formatSignedDelta(insight.faccaoImpact)} />
                        </View>
                      </>
                    ) : (
                      <Text style={styles.optionCopy}>Sem leitura detalhada para essa punição.</Text>
                    )}

                    {isSelected && !activeCase.judgedAt ? (
                      <View style={styles.inlineActionCard}>
                        <Text style={styles.helperCopy}>
                          Ao bater o martelo, o julgamento fecha na hora. Se você deixar o prazo estourar, o comando local assume e escolhe a pior saída possível para a população.
                        </Text>
                        <Pressable
                          disabled={!selectedPunishment || isJudging}
                          onPress={() => {
                            void handleJudgeCase();
                          }}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            (!selectedPunishment || isJudging) ? styles.primaryButtonDisabled : null,
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

function EmptyCard({
  actionLabel,
  copy,
  disabled = false,
  onPress,
  title,
}: {
  actionLabel: string;
  copy: string;
  disabled?: boolean;
  onPress: () => void;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.loadingCard}>
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingCopy}>{copy}</Text>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          disabled ? styles.primaryButtonDisabled : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text style={styles.primaryButtonLabel}>{actionLabel}</Text>
      </Pressable>
    </View>
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
  const isDanger = tone === 'danger';

  return (
    <View style={[styles.banner, isDanger ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={[styles.bannerCopy, isDanger ? styles.bannerCopyDanger : null]}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LoadingCard({
  copy,
  title,
}: {
  copy: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingCopy}>{copy}</Text>
    </View>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function ParticipantCard({
  label,
  participant,
  tone,
}: {
  label: string;
  participant: TribunalCaseSummary['accuser'];
  tone: string;
}): JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.participantHeader}>
        <Text style={[styles.participantTag, { color: tone }]}>{label}</Text>
        <Text style={styles.cardTitle}>{participant.name}</Text>
      </View>
      <Text style={styles.cardSubtitle}>{participant.statement}</Text>
      <View style={styles.metricRow}>
        <MetricPill label="Carisma rua" value={`${participant.charismaCommunity}`} />
        <MetricPill label="Carisma facção" value={`${participant.charismaFaction}`} />
      </View>
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
      <Text style={[styles.summaryLabel, { color: tone }]}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function JudgmentResultModal({
  judgment,
  onClose,
  visible,
}: {
  judgment: TribunalJudgmentSummary | null;
  onClose: () => void;
  visible: boolean;
}): JSX.Element | null {
  if (!judgment) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>Resultado do julgamento</Text>
          <Text style={styles.modalTitle}>
            {resolveTribunalJudgmentReadLabel(judgment.read)}
          </Text>
          <Text style={styles.modalCopy}>{judgment.summary}</Text>
          <View style={styles.metricRow}>
            <MetricPill label="Conceito" value={formatSignedDelta(judgment.conceitoDelta)} />
            <MetricPill label="Moradores" value={formatSignedDelta(judgment.moradoresImpact)} />
            <MetricPill label="Facção" value={formatSignedDelta(judgment.faccaoImpact)} />
          </View>
          <View style={styles.metricRow}>
            <MetricPill label="Favela agora" value={`${judgment.favelaSatisfactionAfter}`} />
            <MetricPill label="Facção agora" value={`${judgment.factionInternalSatisfactionAfter}`} />
            <MetricPill label="Conceito total" value={`${judgment.conceitoAfter}`} />
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerCopyDanger: {
    color: '#ffd5d5',
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.4)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.32)',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  favelaChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  favelaChipLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  favelaChipLabelSelected: {
    color: colors.background,
  },
  favelaChipMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  favelaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  favelaChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  helperCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  helperHeadline: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  inlineActionCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 13, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  modalEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: colors.success,
    fontSize: 22,
    fontWeight: '800',
  },
  metricPill: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricPillLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metricPillValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionCardDisabled: {
    opacity: 0.7,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  optionCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  optionStack: {
    gap: 12,
  },
  optionTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    paddingRight: 12,
  },
  optionTitleSelected: {
    color: colors.accent,
  },
  optionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  participantHeader: {
    gap: 6,
  },
  participantStack: {
    gap: 12,
  },
  participantTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  primaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 180,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  recommendedBadge: {
    backgroundColor: 'rgba(224, 176, 75, 0.14)',
    borderColor: 'rgba(224, 176, 75, 0.28)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recommendedBadgeLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  resultCard: {
    backgroundColor: 'rgba(63, 163, 77, 0.12)',
    borderColor: 'rgba(63, 163, 77, 0.28)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resultCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  resultTitle: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillLabel: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusPillReady: {
    backgroundColor: colors.success,
  },
  statusPillRunning: {
    backgroundColor: colors.warning,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  topActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
