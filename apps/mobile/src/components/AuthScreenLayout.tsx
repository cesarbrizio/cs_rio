import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

interface AuthScreenLayoutProps {
  actionLabel: string;
  children: ReactNode;
  footerCopy: string;
  footerLabel: string;
  helperText?: string;
  isLoading?: boolean;
  onActionPress: () => void;
  onFooterPress: () => void;
  subtitle: string;
  title: string;
}

export function AuthScreenLayout({
  actionLabel,
  children,
  footerCopy,
  footerLabel,
  helperText,
  isLoading = false,
  onActionPress,
  onFooterPress,
  subtitle,
  title,
}: AuthScreenLayoutProps): JSX.Element {
  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CS RIO</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
        </View>

        <View style={styles.card}>{children}</View>

        <Pressable
          accessibilityLabel={isLoading ? `${actionLabel}. Processando.` : actionLabel}
          accessibilityRole="button"
          disabled={isLoading}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || isLoading ? styles.primaryButtonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isLoading ? 'Processando...' : actionLabel}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel={`${footerCopy} ${footerLabel}`}
          accessibilityRole="button"
          onPress={onFooterPress}
          style={styles.footerLink}
        >
          <Text style={styles.footerCopy}>{footerCopy}</Text>
          <Text style={styles.footerLabel}>{footerLabel}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  header: {
    gap: 12,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonPressed: {
    opacity: 0.84,
  },
  primaryButtonLabel: {
    color: '#14110c',
    fontSize: 15,
    fontWeight: '800',
  },
  footerLink: {
    alignItems: 'center',
    gap: 4,
  },
  footerCopy: {
    color: colors.muted,
    fontSize: 14,
  },
  footerLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
