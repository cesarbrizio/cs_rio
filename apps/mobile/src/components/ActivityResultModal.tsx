import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type AsyncActivityCue } from '../features/activity-results';
import { colors } from '../theme/colors';

export function ActivityResultModal({
  cue,
  onClose,
  onOpenTarget,
  visible,
}: {
  cue: AsyncActivityCue | null;
  onClose: () => void;
  onOpenTarget: (cue: AsyncActivityCue) => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            {cue.kind === 'training' ? 'Treino concluído' : 'Curso concluído'}
          </Text>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.body}</Text>

          {cue.kind === 'training' ? (
            <>
              <View style={styles.metrics}>
                <MetricCard label="Custo" value={cue.costLabel} />
                <MetricCard label="Estamina" value={cue.staminaLabel} />
                <MetricCard label="Streak" value={cue.streakLabel} />
                <MetricCard label="Mult." value={cue.multiplierLabel} />
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Ganhos prontos para resgate</Text>
                <Text style={styles.blockCopy}>{cue.gainsLabel}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.metrics}>
                <MetricCard label="Custo" value={cue.costLabel} />
                <MetricCard label="Duração" value={cue.durationLabel} />
                <MetricCard label="Vocação" value={cue.vocationLabel} />
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Passivo liberado</Text>
                <Text style={styles.blockCopy}>{cue.passiveLabel}</Text>
              </View>
            </>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                onOpenTarget(cue);
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>
                {cue.kind === 'training' ? 'Abrir treino' : 'Abrir universidade'}
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
});
