import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type FactionPromotionCue } from '../features/faction-promotion';
import { colors } from '../theme/colors';

export function FactionPromotionModal({
  cue,
  onClose,
  visible,
}: {
  cue: FactionPromotionCue | null;
  onClose: () => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Ascensão na facção</Text>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.body}</Text>

          <View style={styles.metrics}>
            <MetricCard label="Facção" value={cue.factionLabel} />
            <MetricCard label="Antes" value={cue.previousRankLabel} />
            <MetricCard label="Agora" value={cue.newRankLabel} />
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Motivo da promoção</Text>
            <Text style={styles.blockCopy}>{cue.promotionReason}</Text>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.buttonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  block: {
    gap: 6,
  },
  blockCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(224, 176, 75, 0.34)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 14,
    flexBasis: '48%',
    gap: 4,
    minWidth: 132,
    padding: 12,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
});
