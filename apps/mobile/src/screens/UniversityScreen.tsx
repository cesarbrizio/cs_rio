import {
  type UniversityCenterResponse,
  type UniversityCourseCode,
  VocationType,
} from '@cs-rio/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

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
import {
  resolveUniversityScopeNotice,
  resolveUniversityScopeSubtitle,
  resolveUniversityTrackTitle,
} from '../features/vocationScope';
import { useNotifications } from '../notifications/NotificationProvider';
import { formatApiError, universityApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import {
  createEmptyPassiveProfileFallback,
  formatDateLabel,
  formatUniversityProgressionStatus,
  InlineBanner,
  MetricPill,
  MutationResultModal,
  ProgressBar,
  styles,
  SummaryCard,
} from './UniversityScreen.parts';

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
  const currentVocation = center?.player.vocation ?? player?.vocation ?? VocationType.Cria;
  const currentVocationLabel = formatUniversityVocation(currentVocation);

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
    () =>
      summarizeUniversityPassives(center?.passiveProfile ?? createEmptyPassiveProfileFallback()),
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
  }, [loadUniversityCenter, refreshPlayerProfile, selectedCourse, setBootstrapStatus]);

  const handleOpenVocation = useCallback(() => {
    navigation.navigate('Vocation');
  }, [navigation]);

  return (
    <InGameScreenLayout subtitle={resolveUniversityScopeSubtitle()} title="Estudar">
      <View style={styles.topActionRow}>
        <Pressable
          onPress={handleOpenVocation}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir central de vocação</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Caixa"
          tone={colors.warning}
          value={formatUniversityCurrency(
            center?.player.resources.money ?? player?.resources.money ?? 0,
          )}
        />
        <SummaryCard label="Vocação" tone={colors.accent} value={currentVocationLabel} />
        <SummaryCard
          label="Concluidos"
          tone={colors.success}
          value={`${center?.completedCourseCodes.length ?? 0}`}
        />
        <SummaryCard label="Passivos" tone={colors.info} value={`${passiveLines.length}`} />
      </View>

      <View style={styles.card}>
        <Text style={styles.helperCopy}>{resolveUniversityScopeNotice(currentVocationLabel)}</Text>
      </View>

      {center?.progression ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>{center.progression.trackLabel}</Text>
              <Text style={styles.cardSubtitle}>
                {center.progression.completedPerks}/{center.progression.totalPerks} perks concluídos
                · etapa {center.progression.stage}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                center.progression.masteryUnlocked
                  ? styles.statusPillComplete
                  : styles.statusPillAvailable,
              ]}
            >
              <Text style={styles.statusPillLabel}>
                {center.progression.masteryUnlocked ? 'Maestria' : 'Em progresso'}
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <MetricPill
              label="Conclusão"
              value={`${Math.round(center.progression.completionRatio * 100)}%`}
            />
            <MetricPill
              label="Perk atual"
              value={
                center.progression.currentPerkCode
                  ? center.progression.currentPerkCode.split('_').join(' ')
                  : '--'
              }
            />
            <MetricPill
              label="Próximo"
              value={
                center.progression.nextPerk ? center.progression.nextPerk.label : 'Trilha fechada'
              }
            />
          </View>

          <Text style={styles.helperCopy}>
            {center.progression.nextPerk
              ? `${center.progression.nextPerk.label} · ${formatUniversityProgressionStatus(center.progression.nextPerk.status)} · ${center.progression.nextPerk.effectSummary}`
              : 'Todas as vantagens exclusivas da vocação atual já foram liberadas.'}
          </Text>
        </View>
      ) : null}

      <NpcInflationPanel summary={center?.npcInflation ?? null} />

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando universidade</Text>
          <Text style={styles.loadingCopy}>
            Sincronizando cursos, matrículas e passivos permanentes.
          </Text>
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
                <Text style={styles.cardSubtitle}>{activeCourse.effectSummary}</Text>
              </View>
              <View style={[styles.statusPill, styles.statusPillRunning]}>
                <Text style={styles.statusPillLabel}>Em andamento</Text>
              </View>
            </View>

            <ProgressBar progressRatio={activeCourse.progressRatio} />

            <View style={styles.metricRow}>
              <MetricPill
                label="Restante"
                value={formatUniversityRemaining(activeCourse.remainingSeconds)}
              />
              <MetricPill
                label="Duração"
                value={formatUniversityDurationHours(activeCourse.durationHours)}
              />
              <MetricPill label="Custo" value={formatUniversityCurrency(activeCourse.moneyCost)} />
              <MetricPill label="Nível" value={`${activeCourse.unlockLevel}`} />
            </View>

            <Text style={styles.helperCopy}>
              Início {formatDateLabel(activeCourse.startedAt)} · Término{' '}
              {formatDateLabel(activeCourse.endsAt)}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum curso em andamento</Text>
            <Text style={styles.emptyCopy}>
              Escolha um curso abaixo para converter dinheiro em passivos permanentes compatíveis
              com a sua vocação atual.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{resolveUniversityTrackTitle()}</Text>
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
                          ? course.isLocked
                            ? styles.statusPillLocked
                            : styles.statusPillBlocked
                          : styles.statusPillAvailable,
                  ]}
                >
                  <Text style={styles.statusPillLabel}>{stateLabel}</Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricPill label="Nível" value={`${course.unlockLevel}`} />
                <MetricPill
                  label="Duração"
                  value={formatUniversityDurationHours(course.durationHours)}
                />
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
                    Nível {course.unlockLevel} · custo {formatUniversityCurrency(course.moneyCost)}{' '}
                    · duração {formatUniversityDurationHours(course.durationHours)}
                  </Text>
                  <Text style={styles.helperCopy}>
                    Requisitos de atributo:{' '}
                    {formatUniversityRequirements(course.attributeRequirements)}
                  </Text>
                  <Text style={styles.helperCopy}>
                    Pré-requisitos:{' '}
                    {course.prerequisiteCourseCodes.length > 0
                      ? course.prerequisiteCourseCodes.join(', ')
                      : 'nenhum'}
                  </Text>

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
                      isMutating ||
                      course.isCompleted ||
                      course.isInProgress ||
                      Boolean(course.lockReason)
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
              Os bônus permanentes aparecem aqui assim que o primeiro curso for concluído
              automaticamente.
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
