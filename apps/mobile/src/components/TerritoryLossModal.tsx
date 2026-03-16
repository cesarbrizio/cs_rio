import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type TerritoryLossCue } from '../features/territory-loss';
import { colors } from '../theme/colors';

export function TerritoryLossModal({
  cue,
  onClose,
  onOpenTarget,
  visible,
}: {
  cue: TerritoryLossCue | null;
  onClose: () => void;
  onOpenTarget: (cue: TerritoryLossCue) => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={[styles.card, cue.outcomeTone === 'danger' ? styles.cardDanger : null]}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{cue.causeLabel}</Text>
            <Text style={styles.timestamp}>{cue.occurredAtLabel}</Text>
          </View>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.body}</Text>

          <View style={styles.metrics}>
            <MetricCard label="Favela" value={cue.favelaName} />
            <MetricCard label="Destino" value={cue.controllerLabel} />
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto territorial</Text>
            <Text style={styles.blockCopy}>{cue.territorialImpact}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto econômico</Text>
            <Text style={styles.blockCopy}>{cue.economicImpact}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto político</Text>
            <Text style={styles.blockCopy}>{cue.politicalImpact}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                onOpenTarget(cue);
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>Abrir território</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.secondaryButtonLabel}>Fechar</Text>
            </Pressable>
          </View>
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
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 440,
    padding: 22,
    width: '100%',
  },
  cardDanger: {
    borderColor: 'rgba(217, 108, 108, 0.34)',
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  timestamp: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
  },
});
