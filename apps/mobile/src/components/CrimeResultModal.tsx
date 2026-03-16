import { type CrimeAttemptResponse } from '@cs-rio/shared';
import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAudio } from '../audio/AudioProvider';
import { resolveCrimeResultSfx } from '../audio/audioFeedback';
import { FeedbackBurst } from '../components/FeedbackBurst';
import {
  formatCrimeChance,
  formatCrimeCurrency,
  resolveCrimeResultHeadline,
  resolveCrimeResultTone,
} from '../features/crimes';
import { resolveCrimeVisualEffectVariant } from '../features/visualFeedback';
import { colors } from '../theme/colors';

interface CrimeResultModalProps {
  onClose: () => void;
  onPrisonAction?: (actionId: 'advogado' | 'aguardar') => void;
  result: CrimeAttemptResponse | null;
  visible: boolean;
}

function CrimeResultModalComponent({
  onClose,
  onPrisonAction,
  result,
  visible,
}: CrimeResultModalProps): JSX.Element | null {
  const { playSfx } = useAudio();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !result) {
      opacity.setValue(0);
      scale.setValue(0.92);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        friction: 8,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, result, scale, visible]);

  useEffect(() => {
    if (!visible || !result) {
      return;
    }

    void playSfx(resolveCrimeResultSfx(result));
  }, [playSfx, result, visible]);

  if (!result) {
    return null;
  }

  const tone = resolveCrimeResultTone(result);
  const theme = toneStyles[tone];
  const effectVariant = resolveCrimeVisualEffectVariant(result);
  const effectTriggerKey = [
    result.crimeName,
    result.success ? '1' : '0',
    result.arrested ? '1' : '0',
    String(result.leveledUp),
    String(result.moneyDelta),
    String(result.conceitoDelta),
    String(result.level),
  ].join(':');

  return (
    <Modal animationType="none" transparent visible={visible}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={[styles.hero, theme.hero]}>
            <FeedbackBurst triggerKey={effectTriggerKey} variant={effectVariant} />
            <Text style={styles.eyebrow}>{resolveCrimeResultHeadline(result)}</Text>
            <Text style={styles.title}>{result.crimeName}</Text>
            <Text style={styles.copy}>{result.message}</Text>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              label="Dinheiro"
              tone={theme.value}
              value={`${result.moneyDelta >= 0 ? '+' : ''}${formatCrimeCurrency(result.moneyDelta)}`}
            />
            <MetricCard
              label="Conceito"
              tone={theme.value}
              value={`${result.conceitoDelta >= 0 ? '+' : ''}${result.conceitoDelta}`}
            />
            <MetricCard label="Chance" tone={colors.text} value={formatCrimeChance(result.chance * 100)} />
            <MetricCard label="Calor" tone={colors.text} value={`${result.heatBefore} → ${result.heatAfter}`} />
          </View>

          <View style={styles.resourceBlock}>
            <Text style={styles.sectionTitle}>Recursos após a ação</Text>
            <Text style={styles.resourceCopy}>
              HP {result.resources.hp} · Cansaço {result.resources.cansaco} · Disposição {result.resources.disposicao}
            </Text>
            <Text style={styles.resourceCopy}>
              Conceito {result.resources.conceito} · Dinheiro {formatCrimeCurrency(result.resources.money)}
            </Text>
            {result.drop ? (
              <Text style={styles.resourceHighlight}>
                Drop obtido: {result.drop.itemName} x{result.drop.quantity}
              </Text>
            ) : null}
            {result.leveledUp ? (
              <Text style={styles.resourceHighlight}>
                Level up para {result.level}. Próximo marco:{' '}
                {result.nextConceitoRequired !== null ? result.nextConceitoRequired : 'máximo'}
              </Text>
            ) : null}
          </View>

          {result.arrested ? (
            <View style={styles.prisonBlock}>
              <Text style={styles.sectionTitle}>Saídas imediatas</Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => {
                    onPrisonAction?.('advogado');
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.secondaryButtonLabel}>Pagar advogado</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onPrisonAction?.('aguardar');
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.secondaryButtonLabel}>Aguardar soltura</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const MetricCard = memo(function MetricCard({
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
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
    </View>
  );
});
MetricCard.displayName = 'CrimeResultMetricCard';

export const CrimeResultModal = memo(CrimeResultModalComponent);
CrimeResultModal.displayName = 'CrimeResultModal';

const toneStyles = {
  danger: {
    hero: {
      backgroundColor: 'rgba(164, 63, 63, 0.18)',
      borderColor: 'rgba(220, 102, 102, 0.4)',
    },
    value: '#f49d9d',
  },
  success: {
    hero: {
      backgroundColor: 'rgba(63, 163, 77, 0.16)',
      borderColor: 'rgba(86, 212, 103, 0.38)',
    },
    value: '#8ce29b',
  },
  warning: {
    hero: {
      backgroundColor: 'rgba(224, 176, 75, 0.14)',
      borderColor: 'rgba(224, 176, 75, 0.32)',
    },
    value: colors.accent,
  },
} as const;

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 460,
    padding: 18,
    width: '100%',
  },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  copy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    flexGrow: 1,
    gap: 6,
    minWidth: '46%',
    padding: 14,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  resourceBlock: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  resourceCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  resourceHighlight: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  prisonBlock: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
