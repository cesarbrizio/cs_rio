import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatTribunalCueTimestamp,
  resolveTribunalCueEyebrow,
  resolveTribunalCueTargetLabel,
  type TribunalCue,
} from '../features/tribunal-results';
import {
  formatTribunalDeadlineLabel,
  resolveTribunalPunishmentLabel,
  resolveTribunalResolutionSourceLabel,
} from '../features/tribunal';
import { colors } from '../theme/colors';

export function TribunalResultModal({
  cue,
  onClose,
  onOpenTarget,
  visible,
}: {
  cue: TribunalCue | null;
  onClose: () => void;
  onOpenTarget: (cue: TribunalCue) => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  const outcome = cue.kind === 'resolved' ? cue.outcome : null;
  const isResolved = outcome !== null;

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{resolveTribunalCueEyebrow(cue)}</Text>
            <Text style={styles.timestamp}>{formatTribunalCueTimestamp(cue.occurredAt)}</Text>
          </View>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.headline}</Text>
          <Text style={styles.outcome}>{cue.body}</Text>

          <View style={styles.metrics}>
            <MetricCard label="Favela" value={cue.favela.name} />
            <MetricCard label="Caso" value={cue.case.definition.label} />
            {isResolved ? (
            <MetricCard
              label="Resolvido por"
              value={resolveTribunalResolutionSourceLabel(outcome!.resolutionSource)}
            />
          ) : (
              <MetricCard
                label="Prazo"
                value={formatTribunalDeadlineLabel(cue.case.decisionDeadlineAt)}
              />
            )}
          </View>

          {isResolved ? (
            <>
              <View style={styles.metrics}>
                <MetricCard
                  label="Punição"
                  value={resolveTribunalPunishmentLabel(outcome!.punishmentChosen)}
                />
                <MetricCard label="Moradores" value={formatSignedDelta(outcome!.moradoresImpact)} />
                <MetricCard label="Facção" value={formatSignedDelta(outcome!.faccaoImpact)} />
                <MetricCard label="Conceito" value={formatSignedDelta(outcome!.conceitoDelta)} />
              </View>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Desfecho</Text>
                <Text style={styles.blockCopy}>{outcome!.summary}</Text>
              </View>
            </>
          ) : (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Decisão pendente</Text>
              <Text style={styles.blockCopy}>
                Se você não decidir a tempo, o comando local assume o caso e escolhe a pior saída possível para os moradores.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                onOpenTarget(cue);
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>{resolveTribunalCueTargetLabel()}</Text>
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

function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
  },
});
