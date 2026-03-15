import { type UniversityCenterResponse, type UniversityCourseCode, VocationType } from '@cs-rio/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { NpcInflationPanel } from '../components/NpcInflationPanel';
import {
  formatUniversityCurrency,
  formatUniversityDurationHours,
  formatUniversityRemaining,
  formatUniversityRequirements,
  formatUniversityVocation,
  getLiveUniversityCourseState,
  resolveUniversityCourseStateLabel,
  sortUniversityCourses,
  summarizeUniversityPassives,
} from '../features/university';
import { useNotifications } from '../notifications/NotificationProvider';
import { formatApiError, universityApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function UniversityScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { syncUniversityNotifications } = useNotifications();
  const [center, setCenter] = useState<UniversityCenterResponse | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<UniversityCourseCode | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'danger' | 'info'>('info');
  const activeCourseId = center?.activeCourse?.code ?? null;

  const loadUniversityCenter = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await universityApi.getCenter();
      setCenter(response);
      await syncUniversityNotifications(response.activeCourse);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [syncUniversityNotifications]);

  useFocusEffect(
    useCallback(() => {
      void loadUniversityCenter();
      return undefined;
    }, [loadUniversityCenter]),
  );

  useEffect(() => {
    setNowMs(Date.now());

    if (!activeCourseId) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeCourseId]);

  const sortedCourses = useMemo(
    () => sortUniversityCourses(center?.courses ?? []),
    [center?.courses],
  );

  useEffect(() => {
    if (sortedCourses.length === 0) {
      setSelectedCourseCode(null);
      return;
    }

    const hasSelectedCourse = selectedCourseCode
      ? sortedCourses.some((course) => course.code === selectedCourseCode)
      : false;

    if (!hasSelectedCourse) {
      setSelectedCourseCode(center?.activeCourse?.code ?? sortedCourses[0]?.code ?? null);
    }
  }, [center?.activeCourse?.code, selectedCourseCode, sortedCourses]);

  const selectedCourse = useMemo(
    () =>
      sortedCourses.find((course) => course.code === selectedCourseCode) ??
      center?.activeCourse ??
      sortedCourses[0] ??
      null,
    [center?.activeCourse, selectedCourseCode, sortedCourses],
  );

  const activeCourse = useMemo(() => {
    if (!center?.activeCourse) {
      return null;
    }

    const liveState = getLiveUniversityCourseState(center.activeCourse, nowMs);

    return {
      ...center.activeCourse,
      ...liveState,
    };
  }, [center?.activeCourse, nowMs]);

  const passiveLines = useMemo(
    () => summarizeUniversityPassives(center?.passiveProfile ?? createEmptyPassiveProfileFallback()),
    [center?.passiveProfile],
  );

  const handleEnroll = useCallback(async () => {
    if (!selectedCourse) {
      return;
    }

    if (selectedCourse.isCompleted) {
      const message = 'Esse curso já foi concluído.';
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
      return;
    }

    if (selectedCourse.isInProgress) {
      const message = 'Esse curso já está em andamento.';
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
      return;
    }

    if (selectedCourse.lockReason) {
      const message = selectedCourse.lockReason;
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
      return;
    }

    setIsMutating(true);
    setResultMessage(null);

    try {
      await universityApi.enroll({
        courseCode: selectedCourse.code,
      });
      await Promise.all([loadUniversityCenter(), refreshPlayerProfile()]);

      const message = `${selectedCourse.label} iniciado. Duração ${formatUniversityDurationHours(selectedCourse.durationHours)}.`;
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
  }, [
    loadUniversityCenter,
    refreshPlayerProfile,
    selectedCourse,
    setBootstrapStatus,
  ]);

  const handleOpenTraining = useCallback(() => {
    navigation.navigate('Training');
  }, [navigation]);

  return (
    <InGameScreenLayout
      subtitle="Acompanhe a árvore da sua vocação, veja os passivos ativos e matricule-se em cursos com timer real."
      title="Universidade do Crime"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={handleOpenTraining}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir centro de treino</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Caixa"
          tone={colors.warning}
          value={formatUniversityCurrency(center?.player.resources.money ?? player?.resources.money ?? 0)}
        />
        <SummaryCard
          label="Vocação"
          tone={colors.accent}
          value={formatUniversityVocation(center?.player.vocation ?? player?.vocation ?? VocationType.Cria)}
        />
        <SummaryCard
          label="Concluidos"
          tone={colors.success}
          value={`${center?.completedCourseCodes.length ?? 0}`}
        />
        <SummaryCard
          label="Passivos"
          tone={colors.info}
          value={`${passiveLines.length}`}
        />
      </View>

      <NpcInflationPanel summary={center?.npcInflation ?? null} />

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando universidade</Text>
          <Text style={styles.loadingCopy}>Sincronizando cursos, matrículas e passivos permanentes.</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <InlineBanner
          actionLabel="Tentar de novo"
          message={errorMessage}
          tone="danger"
          onPress={() => {
            void loadUniversityCenter();
          }}
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Curso ativo</Text>
        {activeCourse ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>{activeCourse.label}</Text>
                <Text style={styles.cardSubtitle}>
                  {activeCourse.effectSummary}
                </Text>
              </View>
              <View style={[styles.statusPill, styles.statusPillRunning]}>
                <Text style={styles.statusPillLabel}>Em andamento</Text>
              </View>
            </View>

            <ProgressBar progressRatio={activeCourse.progressRatio} />

            <View style={styles.metricRow}>
              <MetricPill label="Restante" value={formatUniversityRemaining(activeCourse.remainingSeconds)} />
              <MetricPill label="Duração" value={formatUniversityDurationHours(activeCourse.durationHours)} />
              <MetricPill label="Custo" value={formatUniversityCurrency(activeCourse.moneyCost)} />
              <MetricPill label="Nível" value={`${activeCourse.unlockLevel}`} />
            </View>

            <Text style={styles.helperCopy}>
              Início {formatDateLabel(activeCourse.startedAt)} · Término {formatDateLabel(activeCourse.endsAt)}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum curso em andamento</Text>
            <Text style={styles.emptyCopy}>
              Escolha um curso abaixo para converter dinheiro em passivos permanentes da sua vocação.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Árvore da vocação</Text>
        {sortedCourses.map((course) => {
          const isSelected = selectedCourse?.code === course.code;
          const stateLabel = resolveUniversityCourseStateLabel(course);

          return (
            <Pressable
              key={course.code}
              onPress={() => {
                setSelectedCourseCode(course.code);
              }}
              style={({ pressed }) => [
                styles.courseCard,
                isSelected ? styles.courseCardSelected : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{course.label}</Text>
                  <Text style={styles.cardSubtitle}>{course.effectSummary}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    course.isCompleted
                      ? styles.statusPillComplete
                      : course.isInProgress
                        ? styles.statusPillRunning
                        : course.lockReason
                          ? (course.isLocked ? styles.statusPillLocked : styles.statusPillBlocked)
                          : styles.statusPillAvailable,
                  ]}
                >
                  <Text style={styles.statusPillLabel}>{stateLabel}</Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricPill label="Nível" value={`${course.unlockLevel}`} />
                <MetricPill label="Duração" value={formatUniversityDurationHours(course.durationHours)} />
                <MetricPill label="Custo" value={formatUniversityCurrency(course.moneyCost)} />
                <MetricPill label="Reqs" value={`${course.prerequisiteCourseCodes.length}`} />
              </View>

              <Text style={styles.detailCopy}>
                Atributos: {formatUniversityRequirements(course.attributeRequirements)}
              </Text>
              <Text style={course.lockReason ? styles.lockCopy : styles.helperCopy}>
                {course.lockReason ??
                  (course.isCompleted
                    ? `Concluído em ${formatDateLabel(course.completedAt)}`
                    : 'Disponível para matrícula agora.')}
              </Text>

              {isSelected ? (
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>{course.label}</Text>
                  <Text style={styles.detailCopy}>{course.effectSummary}</Text>
                  <Text style={styles.helperCopy}>
                    Nível {course.unlockLevel} · custo {formatUniversityCurrency(course.moneyCost)} · duração {formatUniversityDurationHours(course.durationHours)}
                  </Text>
                  <Text style={styles.helperCopy}>
                    Requisitos de atributo: {formatUniversityRequirements(course.attributeRequirements)}
                  </Text>
                  <Text style={styles.helperCopy}>
                    Pré-requisitos: {course.prerequisiteCourseCodes.length > 0 ? course.prerequisiteCourseCodes.join(', ') : 'nenhum'}
                  </Text>

                  {course.lockReason?.toLowerCase().includes('treino') ? (
                    <Pressable
                      onPress={handleOpenTraining}
                      style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
                    >
                      <Text style={styles.secondaryButtonLabel}>Ir para o treino</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    disabled={
                      isMutating ||
                      course.isCompleted ||
                      course.isInProgress ||
                      Boolean(course.lockReason)
                    }
                    onPress={() => {
                      void handleEnroll();
                    }}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (isMutating ||
                        course.isCompleted ||
                        course.isInProgress ||
                        Boolean(course.lockReason))
                        ? styles.buttonDisabled
                        : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isMutating
                        ? 'Processando...'
                        : course.isCompleted
                          ? 'Curso concluído'
                          : course.isInProgress
                            ? 'Curso em andamento'
                            : 'Matricular agora'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Passivos ativos</Text>
        {passiveLines.length > 0 ? (
          <View style={styles.passiveCard}>
            {passiveLines.map((line) => (
              <Text key={line} style={styles.passiveLine}>
                • {line}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum passivo liberado</Text>
            <Text style={styles.emptyCopy}>
              Os bônus permanentes aparecem aqui assim que o primeiro curso for concluído automaticamente.
            </Text>
          </View>
        )}
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
        <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
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

function createEmptyPassiveProfileFallback() {
  return {
    ...UNIVERSITY_PASSIVE_FALLBACK,
  };
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

const UNIVERSITY_PASSIVE_FALLBACK = {
  business: {
    bocaDemandMultiplier: 1,
    gpRevenueMultiplier: 1,
    launderingReturnMultiplier: 1,
    passiveRevenueMultiplier: 1,
    propertyMaintenanceMultiplier: 1,
  },
  crime: {
    arrestChanceMultiplier: 1,
    lowLevelSoloRewardMultiplier: 1,
    revealsTargetValue: false,
    soloSuccessMultiplier: 1,
  },
  factory: {
    extraDrugSlots: 0,
    productionMultiplier: 1,
  },
  faction: {
    factionCharismaAura: 0,
  },
  market: {
    feeRate: 0.05,
  },
  police: {
    bribeCostMultiplier: 1,
    negotiationSuccessMultiplier: 1,
  },
  pvp: {
    ambushPowerMultiplier: 1,
    assaultPowerMultiplier: 1,
    damageDealtMultiplier: 1,
    lowHpDamageTakenMultiplier: 1,
  },
  social: {
    communityInfluenceMultiplier: 1,
  },
};

const styles = StyleSheet.create({
  topActionRow: {
    alignItems: 'flex-start',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  statusPillComplete: {
    backgroundColor: 'rgba(63, 163, 77, 0.2)',
  },
  statusPillLocked: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
  },
  statusPillBlocked: {
    backgroundColor: 'rgba(255, 184, 77, 0.18)',
  },
  statusPillAvailable: {
    backgroundColor: 'rgba(224, 176, 75, 0.2)',
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
  courseCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  courseCardSelected: {
    borderColor: colors.accent,
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
  passiveCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  passiveLine: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
