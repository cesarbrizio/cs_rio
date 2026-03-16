import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatEventResultResolvedLabel,
  resolveEventResultDestinationLabel,
  type EventResultCue,
} from '../features/event-results';
import { resolveEventNotificationAccent } from '../features/events';
import { colors } from '../theme/colors';

export function EventResultModal({
  cue,
  onClose,
  onOpenTarget,
  visible,
}: {
  cue: EventResultCue | null;
  onClose: () => void;
  onOpenTarget: (cue: EventResultCue) => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  const accent = resolveEventNotificationAccent(cue.severity);

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: `${accent}66` }]}>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: accent }]}>Resultado de evento</Text>
            <Text style={styles.timestamp}>{formatEventResultResolvedLabel(cue.resolvedAt)}</Text>
          </View>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.headline}</Text>
          <Text style={styles.outcome}>{cue.body}</Text>

          {cue.metrics.length > 0 ? (
            <View style={styles.metrics}>
              {cue.metrics.map((metric) => (
                <MetricCard key={`${cue.id}:${metric.label}`} label={metric.label} value={metric.value} />
              ))}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto</Text>
            <Text style={styles.blockCopy}>{cue.impactSummary}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                onOpenTarget(cue);
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>
                {resolveEventResultDestinationLabel(cue.destination)}
              </Text>
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
  outcome: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
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
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
});
