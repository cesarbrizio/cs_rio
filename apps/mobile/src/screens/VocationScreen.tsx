import {
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  type PlayerVocationOptionSummary,
  type VocationType,
} from '@cs-rio/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildVocationAvailabilityCopy,
  buildVocationImpactLines,
  formatVocationAttributeLabel,
  formatVocationCreditsCost,
  formatVocationOptionAttributePair,
  formatVocationProgressStageLabel,
  formatVocationStateLabel,
} from '../features/vocation';
import {
  buildVocationScopeLines,
  resolveVocationCenterSubtitle,
} from '../features/vocationScope';
import {
  formatUniversityRemaining,
  formatUniversityVocation,
  summarizeUniversityPassives,
} from '../features/university';
import { formatApiError, playerApi, universityApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

export function VocationScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof playerApi.getVocationCenter>> | null>(null);
  const [universityCenter, setUniversityCenter] = useState<Awaited<ReturnType<typeof universityApi.getCenter>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [changingTo, setChangingTo] = useState<VocationType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'danger' | 'info'>('info');

  const loadCenters = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextCenter, nextUniversityCenter] = await Promise.all([
        playerApi.getVocationCenter(),
        universityApi.getCenter(),
      ]);
      setCenter(nextCenter);
      setUniversityCenter(nextUniversityCenter);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCenters();
      return undefined;
    }, [loadCenters]),
  );

  const currentVocation = center?.status.currentVocation ?? player?.vocation ?? null;
  const currentVocationLabel =
    currentVocation ? formatUniversityVocation(currentVocation) : 'Sem vocação definida';
  const progression = universityCenter?.progression ?? null;
  const passiveLines = useMemo(
    () => summarizeUniversityPassives(universityCenter?.passiveProfile ?? UNIVERSITY_EMPTY_PASSIVE_PROFILE),
    [universityCenter?.passiveProfile],
  );
  const impactLines = useMemo(
    () =>
      buildVocationImpactLines({
        passiveLines,
        progression,
      }),
    [passiveLines, progression],
  );
  const availabilityCopy = center
    ? buildVocationAvailabilityCopy({
        availability: center.availability,
        status: center.status,
      })
    : 'Carregando o estado da vocação.';
  const nextChangeLabel = center
    ? center.status.cooldownRemainingSeconds > 0
      ? formatUniversityRemaining(center.status.cooldownRemainingSeconds)
      : 'Agora'
    : '--';

  const handleOpenUniversity = useCallback(() => {
    navigation.navigate('University');
  }, [navigation]);

  const handleChangeVocation = useCallback(
    async (targetVocation: VocationType) => {
      if (!center) {
        return;
      }

      const option = center.options.find((entry) => entry.id === targetVocation) ?? null;

      if (!option) {
        const message = 'Vocação selecionada não encontrada.';
        setBootstrapStatus(message);
        setResultTone('danger');
        setResultMessage(message);
        return;
      }

      if (option.isCurrent) {
        const message = `${option.label} já é a vocação atual do personagem.`;
        setBootstrapStatus(message);
        setResultTone('danger');
        setResultMessage(message);
        return;
      }

      if (!center.availability.available) {
        const message = center.availability.reason ?? 'A troca de vocação não está disponível agora.';
        setBootstrapStatus(message);
        setResultTone('danger');
        setResultMessage(message);
        return;
      }

      setChangingTo(targetVocation);
      setResultMessage(null);

      try {
        const response = await playerApi.changeVocation({
          vocation: targetVocation,
        });
        setCenter(response.center);

        try {
          const nextUniversityCenter = await universityApi.getCenter();
          setUniversityCenter(nextUniversityCenter);
        } catch {
          // Keep the latest known progression if the secondary refresh fails.
        }

        try {
          await refreshPlayerProfile();
        } catch {
          // The dedicated center should still reflect the backend mutation even if the profile cache refresh fails.
        }

        setBootstrapStatus(response.message);
        setResultTone('info');
        setResultMessage(response.message);
      } catch (error) {
        const message = formatApiError(error).message;
        setBootstrapStatus(message);
        setResultTone('danger');
        setResultMessage(message);
      } finally {
        setChangingTo(null);
      }
    },
    [center, refreshPlayerProfile, setBootstrapStatus],
  );

  return (
    <InGameScreenLayout
      subtitle={resolveVocationCenterSubtitle()}
      title="Central de Vocação"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={handleOpenUniversity}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir universidade</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Vocação"
          tone={colors.accent}
          value={currentVocationLabel}
        />
        <SummaryCard
          label="Status"
          tone={colors.info}
          value={center ? formatVocationStateLabel(center.status) : '--'}
        />
        <SummaryCard
          label="Créditos"
          tone={colors.warning}
          value={formatVocationCreditsCost(center?.player.credits ?? 0)}
        />
        <SummaryCard
          label="Próxima troca"
          tone={colors.success}
          value={nextChangeLabel}
        />
      </View>

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingCopy}>Carregando o centro de vocação...</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <InlineBanner message={errorMessage} tone="danger" />
      ) : null}

      <View style={styles.card}>
        {buildVocationScopeLines(currentVocationLabel).map((line) => (
          <Text key={line} style={styles.listItem}>
            • {line}
          </Text>
        ))}
      </View>

      {center ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardEyebrow}>Estado atual</Text>
              <Text style={styles.cardTitle}>Build ativa e janela de troca</Text>
            </View>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeLabel}>{formatVocationStateLabel(center.status)}</Text>
            </View>
          </View>

          <Text style={styles.detailCopy}>{availabilityCopy}</Text>

          <View style={styles.metricRow}>
            <MetricPill label="Cooldown" value={`${center.cooldownHours}h`} />
            <MetricPill label="Nível" value={`${center.player.level}`} />
            <MetricPill
              label="Custo"
              value={formatVocationCreditsCost(center.availability.creditsCost)}
            />
          </View>

          {center.status.pendingVocation ? (
            <Text style={styles.detailCopy}>
              Próxima vocação pendente: {formatUniversityVocation(center.status.pendingVocation)}.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Impacto real da build</Text>
        <View style={styles.card}>
          {impactLines.map((line) => (
            <Text key={line} style={styles.listItem}>
              • {line}
            </Text>
          ))}
        </View>
      </View>

      {progression ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardEyebrow}>Progressão exclusiva</Text>
              <Text style={styles.cardTitle}>
                {formatUniversityVocation(progression.vocation)} · {progression.completedPerks}/{progression.totalPerks} perks
              </Text>
            </View>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeLabel}>{formatVocationProgressStageLabel(progression)}</Text>
            </View>
          </View>

          <Text style={styles.detailCopy}>
            {progression.nextPerk
              ? `Próximo perk: ${progression.nextPerk.label} — ${progression.nextPerk.effectSummary}`
              : 'A trilha exclusiva desta vocação já foi concluída por completo.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trocar vocação</Text>
        {center?.options.map((option) => (
          <VocationOptionCard
            key={option.id}
            availabilityMessage={center.availability.reason}
            creditsCost={center.availability.creditsCost}
            isChanging={changingTo === option.id}
            onChange={handleChangeVocation}
            option={option}
            optionDisabled={!center.availability.available}
          />
        ))}
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
  message,
  tone,
}: {
  message: string;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
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
          <Text style={styles.modalTitle}>{tone === 'danger' ? 'Ação falhou' : 'Vocação atualizada'}</Text>
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

function VocationOptionCard({
  availabilityMessage,
  creditsCost,
  isChanging,
  onChange,
  option,
  optionDisabled,
}: {
  availabilityMessage: string | null;
  creditsCost: number;
  isChanging: boolean;
  onChange: (targetVocation: VocationType) => void;
  option: PlayerVocationOptionSummary;
  optionDisabled: boolean;
}): JSX.Element {
  const baseAttributes = [
    `Força ${option.baseAttributes.forca}`,
    `Inteligência ${option.baseAttributes.inteligencia}`,
    `Resistência ${option.baseAttributes.resistencia}`,
    `Carisma ${option.baseAttributes.carisma}`,
  ].join(' · ');
  const isDisabled = option.isCurrent || optionDisabled || isChanging;

  return (
    <View style={[styles.optionCard, option.isCurrent ? styles.optionCardCurrent : null]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>{option.label}</Text>
          <Text style={styles.optionMeta}>
            Foco: {formatVocationOptionAttributePair(option)}
          </Text>
        </View>
        <View style={[styles.cardBadge, option.isCurrent ? styles.cardBadgeActive : null]}>
          <Text style={styles.cardBadgeLabel}>{option.isCurrent ? 'Atual' : 'Disponível'}</Text>
        </View>
      </View>

      <Text style={styles.detailCopy}>
        Principal: {formatVocationAttributeLabel(option.primaryAttribute)} · Secundário: {formatVocationAttributeLabel(option.secondaryAttribute)}
      </Text>
      <Text style={styles.detailCopy}>{baseAttributes}</Text>

      {!option.isCurrent && optionDisabled && availabilityMessage ? (
        <Text style={styles.optionWarning}>{availabilityMessage}</Text>
      ) : null}

      <Pressable
        disabled={isDisabled}
        onPress={() => {
          onChange(option.id);
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          isDisabled ? styles.primaryButtonDisabled : null,
          pressed && !isDisabled ? styles.buttonPressed : null,
        ]}
      >
        <Text style={[styles.primaryButtonLabel, isDisabled ? styles.primaryButtonLabelDisabled : null]}>
          {option.isCurrent
            ? 'Vocação atual'
            : isChanging
              ? 'Trocando...'
              : `Trocar por ${formatVocationCreditsCost(creditsCost)}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  bannerDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.16)',
    borderColor: 'rgba(255, 107, 107, 0.26)',
    borderWidth: 1,
  },
  bannerInfo: {
    backgroundColor: 'rgba(91, 164, 255, 0.14)',
    borderColor: 'rgba(91, 164, 255, 0.24)',
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardBadge: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardBadgeActive: {
    backgroundColor: 'rgba(240, 179, 46, 0.18)',
    borderColor: 'rgba(240, 179, 46, 0.26)',
  },
  cardBadgeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    lineHeight: 22,
  },
  detailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
  },
  listItem: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricPill: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalButtonLabel: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  modalCard: {
    borderRadius: 24,
    gap: 14,
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingVertical: 22,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#3a1919',
    borderColor: 'rgba(255, 107, 107, 0.32)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: '#162537',
    borderColor: 'rgba(91, 164, 255, 0.28)',
    borderWidth: 1,
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optionCardCurrent: {
    borderColor: 'rgba(240, 179, 46, 0.28)',
  },
  optionMeta: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  optionWarning: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  primaryButtonLabel: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButtonLabelDisabled: {
    color: colors.text,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 8,
    minWidth: 130,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  topActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
