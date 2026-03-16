import { type TrainingCenterResponse, type TrainingType } from '@cs-rio/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { NpcInflationPanel } from '../components/NpcInflationPanel';
import {
  formatTrainingCurrency,
  formatTrainingDuration,
  formatTrainingGains,
  formatTrainingRemaining,
  formatTrainingTypeLabel,
  getLiveTrainingSessionState,
  sortTrainingCatalog,
} from '../features/training';
import { useNotifications } from '../notifications/NotificationProvider';
import { formatApiError, trainingApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function TrainingScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { syncTrainingNotifications } = useNotifications();
  const [center, setCenter] = useState<TrainingCenterResponse | null>(null);
  const [selectedType, setSelectedType] = useState<TrainingType>('basic');
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'danger' | 'info'>('info');
  const [lastClaimResult, setLastClaimResult] = useState<string | null>(null);
  const activeSessionId = center?.activeSession?.id ?? null;

  const loadTrainingCenter = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await trainingApi.getCenter();
      setCenter(response);
      await syncTrainingNotifications(response.activeSession);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [syncTrainingNotifications]);

  useFocusEffect(
    useCallback(() => {
      void loadTrainingCenter();
      return undefined;
    }, [loadTrainingCenter]),
  );

  useEffect(() => {
    setNowMs(Date.now());

    if (!activeSessionId) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeSessionId]);

  useEffect(() => {
    if (!center) {
      return;
    }

    const sortedCatalog = sortTrainingCatalog(center.catalog);
    const hasSelectedType = sortedCatalog.some((entry) => entry.type === selectedType);

    if (!hasSelectedType && sortedCatalog.length > 0) {
      setSelectedType(sortedCatalog[0].type);
    }
  }, [center, selectedType]);

  const sortedCatalog = useMemo(
    () => sortTrainingCatalog(center?.catalog ?? []),
    [center?.catalog],
  );
  const selectedTraining = useMemo(
    () =>
      sortedCatalog.find((entry) => entry.type === selectedType) ??
      sortedCatalog[0] ??
      null,
    [selectedType, sortedCatalog],
  );
  const activeSession = useMemo(() => {
    if (!center?.activeSession) {
      return null;
    }

    const liveState = getLiveTrainingSessionState(center.activeSession, nowMs);

    return {
      ...center.activeSession,
      ...liveState,
    };
  }, [center?.activeSession, nowMs]);

  const handleStartTraining = useCallback(async () => {
    if (!selectedTraining) {
      return;
    }

    if (!selectedTraining.isRunnable) {
      const message = selectedTraining.lockReason ?? 'Esse treino não pode ser iniciado agora.';
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
      return;
    }

    setIsMutating(true);
    setResultMessage(null);
    setLastClaimResult(null);

    try {
      await trainingApi.start({
        type: selectedTraining.type,
      });
      await Promise.all([loadTrainingCenter(), refreshPlayerProfile()]);

      const message = `${selectedTraining.label} iniciado. Resgate em ${formatTrainingDuration(selectedTraining.durationMinutes)}.`;
      setBootstrapStatus(message);
      setResultTone('info');
      setResultMessage(message);
    } catch (error) {
      const message = formatApiError(error).message;
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
    } finally {
      setIsMutating(false);
    }
  }, [loadTrainingCenter, refreshPlayerProfile, selectedTraining, setBootstrapStatus]);

  const handleClaimTraining = useCallback(async () => {
    if (!center?.activeSession) {
      return;
    }

    setIsMutating(true);
    setResultMessage(null);

    try {
      const response = await trainingApi.claim(center.activeSession.id);
      await Promise.all([loadTrainingCenter(), refreshPlayerProfile()]);
      await syncTrainingNotifications(null);

      const resultLabel = `${formatTrainingTypeLabel(response.session.type)} concluído: ${formatTrainingGains(response.appliedGains)}`;
      setBootstrapStatus(resultLabel);
      setResultTone('info');
      setResultMessage('Treino resgatado e atributos aplicados ao personagem.');
      setLastClaimResult(resultLabel);
    } catch (error) {
      const message = formatApiError(error).message;
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
    } finally {
      setIsMutating(false);
    }
  }, [
    center?.activeSession,
    loadTrainingCenter,
    refreshPlayerProfile,
    setBootstrapStatus,
    syncTrainingNotifications,
  ]);

  return (
    <InGameScreenLayout
      subtitle="Selecione o tipo de treino, acompanhe o progresso em tempo real e resgate os ganhos quando a sessão terminar."
      title="Centro de Treino"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={() => {
            navigation.navigate('University');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir universidade</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Caixa"
          tone={colors.warning}
          value={formatTrainingCurrency(center?.player.resources.money ?? player?.resources.money ?? 0)}
        />
        <SummaryCard
          label="Cansaço"
          tone={colors.info}
          value={`${center?.player.resources.cansaco ?? player?.resources.cansaco ?? 0}`}
        />
        <SummaryCard
          label="Básicos"
          tone={colors.accent}
          value={`${center?.completedBasicSessions ?? 0}`}
        />
        <SummaryCard
          label="Próx. mult."
          tone={colors.success}
          value={`${(center?.nextDiminishingMultiplier ?? 1).toFixed(2)}x`}
        />
      </View>

      <NpcInflationPanel summary={center?.npcInflation ?? null} />

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando centro de treino</Text>
          <Text style={styles.loadingCopy}>Sincronizando catálogo, sessão ativa e custos atuais.</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <InlineBanner
          actionLabel="Tentar de novo"
          message={errorMessage}
          tone="danger"
          onPress={() => {
            void loadTrainingCenter();
          }}
        />
      ) : null}

      {lastClaimResult ? <ResultCard label={lastClaimResult} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sessão ativa</Text>
        {activeSession ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>{formatTrainingTypeLabel(activeSession.type)}</Text>
                <Text style={styles.cardSubtitle}>
                  Duração {formatTrainingDuration(Math.round((new Date(activeSession.endsAt).getTime() - new Date(activeSession.startedAt).getTime()) / 60000))}
                  {' · '}
                  Sequência {activeSession.streakIndex + 1}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  activeSession.readyToClaim ? styles.statusPillReady : styles.statusPillRunning,
                ]}
              >
                <Text style={styles.statusPillLabel}>
                  {activeSession.readyToClaim ? 'Pronto' : 'Em andamento'}
                </Text>
              </View>
            </View>

            <ProgressBar progressRatio={activeSession.progressRatio} />

            <View style={styles.metricRow}>
              <MetricPill label="Tempo" value={formatTrainingRemaining(activeSession.remainingSeconds)} />
              <MetricPill label="Custo" value={formatTrainingCurrency(activeSession.costMoney)} />
              <MetricPill label="Cansaço" value={`${activeSession.costCansaco}`} />
              <MetricPill label="Mult." value={`${activeSession.diminishingMultiplier.toFixed(2)}x`} />
            </View>

            <Text style={styles.detailCopy}>
              Ganho previsto: {formatTrainingGains(activeSession.projectedGains)}
            </Text>

            <Pressable
              disabled={!activeSession.readyToClaim || isMutating}
              onPress={() => {
                void handleClaimTraining();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                (!activeSession.readyToClaim || isMutating) ? styles.buttonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                {isMutating ? 'Processando...' : activeSession.readyToClaim ? 'Resgatar treino' : 'Aguardando término'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum treino em andamento</Text>
            <Text style={styles.emptyCopy}>
              Escolha um tipo abaixo para transformar caixa e cansaço em progresso real de atributos.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Catálogo</Text>
        {sortedCatalog.map((training) => {
          const isSelected = selectedTraining?.type === training.type;

          return (
            <Pressable
              key={training.type}
              onPress={() => {
                setSelectedType(training.type);
              }}
              style={({ pressed }) => [
                styles.trainingCard,
                isSelected ? styles.trainingCardSelected : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{training.label}</Text>
                  <Text style={styles.cardSubtitle}>
                    Nível {training.unlockLevel} · {formatTrainingDuration(training.durationMinutes)}
                  </Text>
                </View>
                <View style={[styles.statusPill, training.isLocked ? styles.statusPillLocked : styles.statusPillRunning]}>
                  <Text style={styles.statusPillLabel}>
                    {training.isLocked ? 'Travado' : training.isRunnable ? 'Disponível' : 'Pendente'}
                  </Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricPill label="Custo" value={formatTrainingCurrency(training.moneyCost)} />
                <MetricPill label="Cansaço" value={`${training.cansacoCost}`} />
                <MetricPill label="Básicos" value={`${training.basicSessionsCompleted}/${training.minimumBasicSessionsCompleted}`} />
                <MetricPill label="Próx. mult." value={`${training.nextDiminishingMultiplier.toFixed(2)}x`} />
              </View>

              <Text style={styles.detailCopy}>
                Ganho previsto: {formatTrainingGains(training.projectedGains)}
              </Text>
              <Text style={training.lockReason ? styles.lockCopy : styles.helperCopy}>
                {training.lockReason ?? 'Toque para selecionar esse treino e revisar o investimento.'}
              </Text>

              {isSelected ? (
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>{training.label}</Text>
                  <Text style={styles.detailCopy}>
                    Duração {formatTrainingDuration(training.durationMinutes)} · custo {formatTrainingCurrency(training.moneyCost)} · cansaço {training.cansacoCost}
                  </Text>
                  <Text style={styles.detailCopy}>
                    Ganho previsto agora: {formatTrainingGains(training.projectedGains)}
                  </Text>
                  <Text style={styles.helperCopy}>
                    {training.lockReason ??
                      'Se houver universidade ativa, hospitalização ou sessão pendente, o backend bloqueia o início automaticamente.'}
                  </Text>

                  <Pressable
                    disabled={isMutating || !training.isRunnable}
                    onPress={() => {
                      void handleStartTraining();
                    }}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (!training.isRunnable || isMutating) ? styles.buttonDisabled : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isMutating ? 'Processando...' : `Iniciar ${formatTrainingTypeLabel(training.type)}`}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <MutationResultModal
        message={resultMessage}
        onClose={() => {
          setResultMessage(null);
        }}
        tone={resultTone}
        visible={Boolean(resultMessage)}
      />
    </InGameScreenLayout>
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
        <Pressable onPress={onPress} style={({ pressed }) => [styles.bannerButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ResultCard({ label }: { label: string }): JSX.Element {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultEyebrow}>Resultado aplicado</Text>
      <Text style={styles.resultCopy}>{label}</Text>
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
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ progressRatio }: { progressRatio: number }): JSX.Element {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topActionRow: {
    alignItems: 'flex-start',
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    minWidth: '47%',
    padding: 14,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  banner: {
    borderRadius: 18,
    gap: 10,
    padding: 16,
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.35)',
    borderWidth: 1,
  },
  bannerInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.28)',
    borderWidth: 1,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  resultCard: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: 'rgba(63, 163, 77, 0.35)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  resultEyebrow: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  resultCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusPillRunning: {
    backgroundColor: 'rgba(123, 178, 255, 0.14)',
  },
  statusPillReady: {
    backgroundColor: 'rgba(63, 163, 77, 0.2)',
  },
  statusPillLocked: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
  },
  statusPillLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.accent,
    height: '100%',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: colors.panelAlt,
    borderRadius: 16,
    gap: 3,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  detailCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  helperCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  lockCopy: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: '#14110c',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  emptyCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  trainingCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  trainingCardSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  selectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.accent,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  selectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
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
