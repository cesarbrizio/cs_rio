import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TutorialStepDefinition } from '../features/tutorial';
import { colors } from '../theme/colors';

interface TutorialCoachCardProps {
  onDismiss: () => void;
  onPrimaryAction: () => void;
  remainingMinutes: number | null;
  step: TutorialStepDefinition;
  stepLabel: string;
}

export function TutorialCoachCard({
  onDismiss,
  onPrimaryAction,
  remainingMinutes,
  step,
  stepLabel,
}: TutorialCoachCardProps): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{stepLabel}</Text>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.npcLine}>
        {step.npcName} · {step.npcRole}
      </Text>
      <Text style={styles.copy}>{step.hint}</Text>
      <Text style={styles.meta}>
        {remainingMinutes !== null
          ? `Tutorial ativo pelos próximos ${remainingMinutes} min.`
          : 'Tutorial inicial ativo nesta sessão.'}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onPrimaryAction}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.primaryButtonLabel}>{step.ctaLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Pular por agora</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(17, 17, 17, 0.94)',
    borderColor: 'rgba(224, 176, 75, 0.24)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  copy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  npcLine: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 130,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
});
