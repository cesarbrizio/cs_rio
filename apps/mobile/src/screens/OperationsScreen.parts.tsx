import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from './OperationsScreen.styles';

export { styles } from './OperationsScreen.styles';

export function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger' ? styles.bannerDanger : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

export function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}

export function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricCardValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricCardLabel}>{label}</Text>
    </View>
  );
}

export function MetricPill({
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

export function OperationResultModal({
  message,
  onClose,
  title,
}: {
  message: string | null;
  onClose: () => void;
  title: string;
}): JSX.Element {
  return (
    <Modal animationType="fade" transparent visible={Boolean(message)}>
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>Operação concluída</Text>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalCopy}>{message}</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
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
