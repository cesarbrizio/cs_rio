import { type UniversityCenterResponse } from '@cs-rio/shared';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles } from './UniversityScreen.styles';
export { styles } from './UniversityScreen.styles';

import { colors } from '../theme/colors';

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
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MutationResultModal({
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
        <View
          style={[
            styles.modalCard,
            tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo,
          ]}
        >
          <Text style={styles.modalTitle}>
            {tone === 'danger' ? 'Ação falhou' : 'Ação executada'}
          </Text>
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
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export function MetricPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ progressRatio }: { progressRatio: number }): JSX.Element {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%` },
        ]}
      />
    </View>
  );
}

export function createEmptyPassiveProfileFallback() {
  return {
    ...UNIVERSITY_PASSIVE_FALLBACK,
  };
}

export function formatDateLabel(value: string | null): string {
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

export function formatUniversityProgressionStatus(
  status: UniversityCenterResponse['progression']['perks'][number]['status'],
): string {
  switch (status) {
    case 'available':
      return 'disponível';
    case 'completed':
      return 'concluído';
    case 'in_progress':
      return 'em andamento';
    default:
      return 'travado';
  }
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
  social: {
    communityInfluenceMultiplier: 1,
  },
};
