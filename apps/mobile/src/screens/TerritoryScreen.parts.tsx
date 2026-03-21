import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from './TerritoryScreen.styles';

export { styles } from './TerritoryScreen.styles';

export function ActionButton({
  disabled = false,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone: 'accent' | 'danger' | 'info' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'accent' ? styles.actionButtonAccent : null,
        tone === 'danger' ? styles.actionButtonDanger : null,
        tone === 'info' ? styles.actionButtonInfo : null,
        tone === 'warning' ? styles.actionButtonWarning : null,
        pressed ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <Text style={styles.actionButtonLabel}>{label}</Text>
    </Pressable>
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
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.cardPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
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
            accessibilityLabel="Fechar resultado territorial"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.modalButton, pressed ? styles.cardPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function MiniToggle({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        active ? styles.toggleChipActive : null,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <Text style={[styles.toggleChipLabel, active ? styles.toggleChipLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusTag({
  label,
  tone,
}: {
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.statusTag,
        tone === 'danger' ? styles.statusTagDanger : null,
        tone === 'neutral' ? styles.statusTagNeutral : null,
        tone === 'success' ? styles.statusTagSuccess : null,
        tone === 'warning' ? styles.statusTagWarning : null,
      ]}
    >
      <Text style={styles.statusTagLabel}>{label}</Text>
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
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
    </View>
  );
}
