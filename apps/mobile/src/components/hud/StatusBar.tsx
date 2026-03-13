import { REGIONS, type PlayerProfile } from '@cs-rio/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RealtimeConnectionStatus } from '../../services/colyseus';
import { colors } from '../../theme/colors';

interface StatusBarProps {
  connectionStatus: RealtimeConnectionStatus;
  onOpenProfile?: () => void;
  player: PlayerProfile | null;
  playerPosition: {
    x: number;
    y: number;
  } | null;
}

export function StatusBar({
  connectionStatus,
  onOpenProfile,
  player,
}: StatusBarProps): JSX.Element {
  const regionLabel = useMemo(
    () => REGIONS.find((region) => region.id === player?.regionId)?.label ?? 'Região indefinida',
    [player?.regionId],
  );

  return (
    <Pressable
      android_ripple={{ borderless: true, color: 'rgba(255,255,255,0.1)' }}
      onPress={onOpenProfile}
      style={({ pressed }) => [styles.wrapper, pressed ? styles.wrapperPressed : null]}
    >
      <View style={styles.leftBlock}>
        <Text numberOfLines={1} style={styles.nickname}>
          {player?.nickname ?? 'Sem personagem'}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          Nv.{player?.level ?? '--'} · {regionLabel}
        </Text>
      </View>
      <View style={styles.rightBlock}>
        <Text numberOfLines={1} style={styles.money}>
          R$ {formatMoney(player?.resources.money ?? 0)}
        </Text>
        <View style={[styles.statusDot, dotColor(connectionStatus)]} />
      </View>
    </Pressable>
  );
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function dotColor(status: RealtimeConnectionStatus) {
  if (status === 'connected') {
    return styles.dotConnected;
  }

  if (status === 'disconnected') {
    return styles.dotDanger;
  }

  return styles.dotWarning;
}

const styles = StyleSheet.create({
  dotConnected: {
    backgroundColor: colors.success,
  },
  dotDanger: {
    backgroundColor: colors.danger,
  },
  dotWarning: {
    backgroundColor: colors.warning,
  },
  leftBlock: {
    flex: 1,
    gap: 1,
    paddingRight: 8,
  },
  meta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
  },
  money: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  nickname: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  rightBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  wrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  wrapperPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
});
