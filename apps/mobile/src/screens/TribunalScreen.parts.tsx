import { type TribunalCaseSummary, type TribunalJudgmentSummary } from '@cs-rio/shared';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles } from './TribunalScreen.styles';
export { styles } from './TribunalScreen.styles';

import { resolveTribunalJudgmentReadLabel } from '../features/tribunal';
import { colors } from '../theme/colors';

export function EmptyCard({
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

export function InlineBanner({
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

export function LoadingCard({ copy, title }: { copy: string; title: string }): JSX.Element {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingCopy}>{copy}</Text>
    </View>
  );
}

export function MetricPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

export function ParticipantCard({
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

export function SummaryCard({
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

export function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

export function JudgmentResultModal({
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
          <Text style={styles.modalTitle}>{resolveTribunalJudgmentReadLabel(judgment.read)}</Text>
          <Text style={styles.modalCopy}>{judgment.summary}</Text>
          <View style={styles.metricRow}>
            <MetricPill label="Conceito" value={formatSignedDelta(judgment.conceitoDelta)} />
            <MetricPill label="Moradores" value={formatSignedDelta(judgment.moradoresImpact)} />
            <MetricPill label="Facção" value={formatSignedDelta(judgment.faccaoImpact)} />
          </View>
          <View style={styles.metricRow}>
            <MetricPill label="Favela agora" value={`${judgment.favelaSatisfactionAfter}`} />
            <MetricPill
              label="Facção agora"
              value={`${judgment.factionInternalSatisfactionAfter}`}
            />
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
