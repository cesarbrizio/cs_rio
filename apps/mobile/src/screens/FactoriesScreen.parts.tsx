import { type DrugFactorySummary } from '@cs-rio/shared';
import { StyleSheet, Text, View } from 'react-native';
import { styles } from './FactoriesScreen.styles';
export { styles } from './FactoriesScreen.styles';

import { colors } from '../theme/colors';

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
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'danger' | 'info' | 'success' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.statusChip,
        tone === 'danger'
          ? styles.statusChipDanger
          : tone === 'warning'
            ? styles.statusChipWarning
            : tone === 'success'
              ? styles.statusChipSuccess
              : styles.statusChipInfo,
      ]}
    >
      <Text style={styles.statusChipLabel}>{label}</Text>
    </View>
  );
}

export function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger'
          ? styles.bannerDanger
          : tone === 'warning'
            ? styles.bannerWarning
            : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

export function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export function resolveFactoryTone(
  factory: DrugFactorySummary,
): 'danger' | 'info' | 'success' | 'warning' {
  if (factory.blockedReason === 'maintenance') {
    return 'danger';
  }

  if (factory.blockedReason === 'components') {
    return 'warning';
  }

  if (factory.storedOutput > 0) {
    return 'success';
  }

  return 'info';
}
