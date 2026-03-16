import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type WarResultCue } from '../features/war-results';
import { colors } from '../theme/colors';

export function WarResultModal({
  cue,
  onClose,
  visible,
}: {
  cue: WarResultCue | null;
  onClose: () => void;
  visible: boolean;
}): JSX.Element | null {
  if (!cue) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={[styles.card, cue.outcomeTone === 'danger' ? styles.cardDanger : null]}>
          <Text style={styles.eyebrow}>Guerra encerrada</Text>
          <Text style={styles.title}>{cue.title}</Text>
          <Text style={styles.copy}>{cue.body}</Text>

          <View style={styles.metrics}>
            <MetricCard label="Vencedor" value={cue.winnerLabel} />
            <MetricCard label="Score" value={cue.scoreLabel} />
            <MetricCard label="Rounds" value={cue.roundsLabel} />
            <MetricCard label="Espólio" value={cue.lootLabel} />
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto territorial</Text>
            <Text style={styles.blockCopy}>{cue.territorialImpact}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Impacto pessoal</Text>
            <Text style={styles.blockCopy}>{cue.personalImpact.label}</Text>
            {cue.personalImpact.directParticipation ? (
              <View style={styles.metrics}>
                <MetricCard
                  label="Conceito"
                  value={`${cue.personalImpact.conceitoDelta >= 0 ? '+' : ''}${cue.personalImpact.conceitoDelta}`}
                />
                <MetricCard label="HP" value={`-${cue.personalImpact.hpLoss}`} />
                <MetricCard label="DIS" value={`-${cue.personalImpact.disposicaoLoss}`} />
                <MetricCard label="CAN" value={`-${cue.personalImpact.cansacoLoss}`} />
              </View>
            ) : null}
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
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
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
