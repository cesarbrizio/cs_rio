import { type GridPoint } from '@engine/types';
import { type PlayerProfile } from '@cs-rio/shared';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { ContextMenu } from '../../components/hud/ContextMenu';
import { ActionBar, type ActionBarButton } from '../../components/hud/ActionBar';
import { HudToast } from '../../components/hud/HudToast';
import { Minimap, type MinimapMarker } from '../../components/hud/Minimap';
import { StatusBar } from '../../components/hud/StatusBar';
import { type HudContextAction, type HudContextTarget } from '../../features/hudContextActions';
import { type RealtimeConnectionStatus } from '../../services/colyseus';
import { colors } from '../../theme/colors';
import { type RoundPressure, type WorldPulseItem } from './homeTypes';

export interface HomeHudToastConfig {
  accent?: string;
  autoDismissMs?: number;
  ctaLabel: string;
  message: string;
  onCta: () => void;
  onDismiss?: () => void;
}

export interface HomeInfoCardContent {
  detail: string;
  headline: string;
}

interface HomeHudOverlayProps {
  cameraMode: 'follow' | 'free';
  compactRoundLabel: string;
  connectionLabel: string | null;
  connectionStatus: RealtimeConnectionStatus;
  contextTarget: HudContextTarget | null;
  expandedInfoContent: HomeInfoCardContent | null;
  expandedInfoPanel: 'focus' | 'round' | 'world' | null;
  focusChipLabel: string;
  interactionFeedback: {
    accent?: string;
    id: number;
    message: string;
  } | null;
  mapHeight: number;
  mapLabel: string;
  mapWidth: number;
  minimapMarkers: MinimapMarker[];
  onActionBarPress: (buttonId: string) => void;
  onBottomLayout: (event: LayoutChangeEvent) => void;
  onCloseContextMenu: () => void;
  onContextActionPress: (action: HudContextAction, target: HudContextTarget) => void;
  onDismissInteractionFeedback: () => void;
  onOpenMap: () => void;
  onOpenProfile: () => void;
  onRecenter: () => void;
  onToggleCameraMode: () => void;
  onToggleExpandedInfoPanel: (panel: 'focus' | 'round' | 'world') => void;
  onTopLayout: (event: LayoutChangeEvent) => void;
  onlineCount: number;
  player: PlayerProfile | null;
  playerPosition: GridPoint | null;
  quickActions: ActionBarButton[];
  roundPressure: RoundPressure | null;
  topToast: HomeHudToastConfig | null;
  worldPulseItems: WorldPulseItem[];
}

export function HomeHudOverlay({
  cameraMode,
  compactRoundLabel,
  connectionLabel,
  connectionStatus,
  contextTarget,
  expandedInfoContent,
  expandedInfoPanel,
  focusChipLabel,
  interactionFeedback,
  mapHeight,
  mapLabel,
  mapWidth,
  minimapMarkers,
  onActionBarPress,
  onBottomLayout,
  onCloseContextMenu,
  onContextActionPress,
  onDismissInteractionFeedback,
  onOpenMap,
  onOpenProfile,
  onRecenter,
  onToggleCameraMode,
  onToggleExpandedInfoPanel,
  onTopLayout,
  onlineCount,
  player,
  playerPosition,
  quickActions,
  roundPressure,
  topToast,
  worldPulseItems,
}: HomeHudOverlayProps): JSX.Element {
  return (
    <View pointerEvents="box-none" style={styles.hudLayer}>
      <View onLayout={onTopLayout} pointerEvents="box-none" style={styles.topSection}>
        <View style={styles.topHudRow}>
          <View style={styles.statusContainer}>
            <StatusBar
              connectionStatus={connectionStatus}
              onOpenProfile={onOpenProfile}
              player={player}
              playerPosition={playerPosition}
            />
          </View>
          <View style={styles.minimapCluster}>
            <Minimap
              mapHeight={mapHeight}
              mapLabel={mapLabel}
              mapWidth={mapWidth}
              markers={minimapMarkers}
              onOpenFullMap={onOpenMap}
              onlineCount={onlineCount}
              playerPosition={playerPosition}
            />
            <View style={styles.cameraActions}>
              <Pressable
                accessibilityLabel="Recentralizar no jogador"
                accessibilityRole="button"
                onPress={onRecenter}
                style={({ pressed }) => [
                  styles.cameraFab,
                  pressed ? styles.cameraFabPressed : null,
                ]}
              >
                <Text style={styles.cameraFabGlyph}>◎</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={cameraMode === 'follow' ? 'Desativar seguir jogador' : 'Seguir jogador'}
                accessibilityRole="button"
                onPress={onToggleCameraMode}
                style={({ pressed }) => [
                  styles.followChip,
                  cameraMode === 'follow' ? styles.followChipActive : null,
                  pressed ? styles.followChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.followChipLabel,
                    cameraMode === 'follow' ? styles.followChipLabelActive : null,
                  ]}
                >
                  {cameraMode === 'follow' ? 'Seguindo' : 'Seguir'}
                </Text>
              </Pressable>
            </View>
            {connectionLabel ? (
              <View style={styles.connectionStrip}>
                <View style={styles.connectionDivider} />
                <Text
                  style={[
                    styles.connectionStripText,
                    connectionStatus === 'disconnected'
                      ? styles.connectionStripTextDanger
                      : styles.connectionStripTextWarning,
                  ]}
                >
                  {connectionLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View pointerEvents="box-none" style={styles.toastArea}>
          {topToast ? (
            <HudToast
              accent={topToast.accent}
              autoDismissMs={topToast.autoDismissMs}
              ctaLabel={topToast.ctaLabel}
              message={topToast.message}
              onCta={topToast.onCta}
              onDismiss={topToast.onDismiss}
            />
          ) : null}
        </View>
      </View>

      <View onLayout={onBottomLayout} pointerEvents="box-none" style={styles.bottomHud}>
        <View style={styles.resourceRow}>
          <View style={[styles.resourcePill, { borderColor: 'rgba(217,95,95,0.3)' }]}>
            <Text style={[styles.resourceLabel, { color: '#d95f5f' }]}>HP</Text>
            <Text style={styles.resourceValue}>{Math.round(player?.resources.hp ?? 0)}</Text>
          </View>
          <View style={[styles.resourcePill, { borderColor: 'rgba(63,163,77,0.3)' }]}>
            <Text style={[styles.resourceLabel, { color: colors.success }]}>STA</Text>
            <Text style={styles.resourceValue}>{Math.round(player?.resources.stamina ?? 0)}</Text>
          </View>
          <View style={[styles.resourcePill, { borderColor: 'rgba(79,142,232,0.3)' }]}>
            <Text style={[styles.resourceLabel, { color: '#4f8ee8' }]}>NRV</Text>
            <Text style={styles.resourceValue}>{Math.round(player?.resources.nerve ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.compactSignalsCard}>
          <View style={styles.worldPulseRow}>
            <Pressable
              accessibilityLabel={compactRoundLabel}
              accessibilityRole="button"
              onPress={() => {
                onToggleExpandedInfoPanel('round');
              }}
              style={({ pressed }) => [
                styles.roundPressureChip,
                pressed ? styles.compactChipPressed : null,
              ]}
            >
              <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                {compactRoundLabel}
              </Text>
            </Pressable>
            {roundPressure ? (
              <Pressable
                accessibilityLabel={roundPressure.labels[0]}
                accessibilityRole="button"
                onPress={() => {
                  onToggleExpandedInfoPanel('round');
                }}
                style={({ pressed }) => [
                  styles.roundPressureChip,
                  pressed ? styles.compactChipPressed : null,
                ]}
              >
                <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                  {roundPressure.labels[0]}
                </Text>
              </Pressable>
            ) : null}
            {worldPulseItems.map((item) => (
              <Pressable
                accessibilityLabel={`${item.label} ${item.value}`}
                accessibilityRole="button"
                key={item.id}
                onPress={() => {
                  onToggleExpandedInfoPanel('world');
                }}
                style={({ pressed }) => [
                  styles.worldPulseChip,
                  pressed ? styles.compactChipPressed : null,
                ]}
              >
                <View style={[styles.worldPulseDot, { backgroundColor: item.accent }]} />
                <Text numberOfLines={1} style={styles.worldPulseLabel}>
                  {item.label}
                </Text>
                <Text numberOfLines={1} style={styles.worldPulseValue}>
                  {item.value}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityLabel={focusChipLabel}
              accessibilityRole="button"
              onPress={() => {
                onToggleExpandedInfoPanel('focus');
              }}
              style={({ pressed }) => [
                styles.roundPressureChip,
                pressed ? styles.compactChipPressed : null,
              ]}
            >
              <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                {focusChipLabel}
              </Text>
            </Pressable>
          </View>
          {expandedInfoPanel && expandedInfoContent ? (
            <View style={styles.expandedInfoCard}>
              <Text numberOfLines={2} style={styles.expandedInfoHeadline}>
                {expandedInfoContent.headline}
              </Text>
              <Text numberOfLines={3} style={styles.expandedInfoDetail}>
                {expandedInfoContent.detail}
              </Text>
            </View>
          ) : null}
        </View>

        {interactionFeedback ? (
          <HudToast
            key={interactionFeedback.id}
            accent={interactionFeedback.accent}
            autoDismissMs={1400}
            message={interactionFeedback.message}
            onDismiss={onDismissInteractionFeedback}
          />
        ) : null}

        <ActionBar buttons={quickActions} onPress={onActionBarPress} />
      </View>

      <ContextMenu
        onActionPress={onContextActionPress}
        onClose={onCloseContextMenu}
        target={contextTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 6,
  },
  topSection: {
    alignItems: 'flex-start',
    gap: 4,
  },
  topHudRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusContainer: {
    flexGrow: 0,
    flexShrink: 1,
    marginRight: 8,
    maxWidth: 218,
  },
  minimapCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectionStrip: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 112,
    width: '100%',
  },
  connectionDivider: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 1,
  },
  connectionStripText: {
    fontSize: 11,
    fontWeight: '800',
  },
  connectionStripTextDanger: {
    color: colors.danger,
  },
  connectionStripTextWarning: {
    color: colors.warning,
  },
  cameraActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cameraFab: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cameraFabPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  cameraFabGlyph: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  followChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  followChipActive: {
    backgroundColor: 'rgba(63, 163, 77, 0.22)',
    borderColor: 'rgba(63, 163, 77, 0.45)',
  },
  followChipPressed: {
    opacity: 0.82,
  },
  followChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  followChipLabelActive: {
    color: colors.success,
  },
  toastArea: {
    gap: 4,
    maxWidth: '72%',
  },
  bottomHud: {
    alignItems: 'stretch',
    gap: 6,
    paddingBottom: 4,
  },
  resourceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resourcePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resourceLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  resourceValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  compactSignalsCard: {
    gap: 8,
    maxWidth: '100%',
  },
  worldPulseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roundPressureChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roundPressureChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  worldPulseChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  worldPulseDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  worldPulseLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  worldPulseValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 112,
  },
  compactChipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  expandedInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  expandedInfoHeadline: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  expandedInfoDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});
