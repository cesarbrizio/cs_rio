import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resolveEventNotificationAccent,
  resolveEventNotificationTimeLabel,
  type EventNotificationItem,
} from '../features/events';
import { colors } from '../theme/colors';

interface EventToastOverlayProps {
  notification: EventNotificationItem | null;
  onDismiss: () => void;
}

export function EventToastOverlay({
  notification,
  onDismiss,
}: EventToastOverlayProps): JSX.Element | null {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notification) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      onDismiss();
    }, 5500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [notification, onDismiss]);

  if (!notification) {
    return null;
  }

  const accent = resolveEventNotificationAccent(notification.severity);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: `${accent}88`,
          },
          pressed ? styles.cardPressed : null,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: accent }]}>Evento do jogo</Text>
          <Text style={styles.timer}>
            {resolveEventNotificationTimeLabel(notification.remainingSeconds)}
          </Text>
        </View>
        <Text style={styles.title}>{notification.title}</Text>
        <Text numberOfLines={2} style={styles.body}>
          {notification.body}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    left: 0,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  card: {
    backgroundColor: 'rgba(10, 10, 10, 0.96)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  cardPressed: {
    opacity: 0.88,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  timer: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
});
