import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

interface HudToastProps {
  accent?: string;
  autoDismissMs?: number;
  ctaLabel?: string;
  message: string;
  onCta?: () => void;
  onDismiss?: () => void;
}

export function HudToast({
  accent,
  autoDismissMs = 8000,
  ctaLabel,
  message,
  onCta,
  onDismiss,
}: HudToastProps): JSX.Element {
  const normalizedMessage = message.trim();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!normalizedMessage) {
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 200,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 200,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    if (autoDismissMs <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: 300,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        onDismiss?.();
      });
    }, autoDismissMs);

    return () => {
      clearTimeout(timer);
    };
  }, [autoDismissMs, normalizedMessage, onDismiss, opacity, translateY]);

  if (!normalizedMessage) {
    return <></>;
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        accent ? { borderColor: `${accent}44` } : null,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {accent ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
      <Text numberOfLines={2} style={styles.message}>
        {normalizedMessage}
      </Text>
      {ctaLabel && onCta ? (
        <Pressable
          android_ripple={{ borderless: true, color: 'rgba(255,255,255,0.15)' }}
          onPress={onCta}
          style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          hitSlop={8}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Text style={styles.dismissLabel}>x</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cta: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ctaLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  ctaPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dismiss: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dismissLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  message: {
    color: colors.text,
    fontSize: 12,
    flexShrink: 1,
    lineHeight: 16,
  },
  toast: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 34,
    minWidth: 96,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
