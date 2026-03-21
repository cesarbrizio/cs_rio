import { type GridPoint } from '@engine/types';
import { type PlayerProfile } from '@cs-rio/shared';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { styles } from './HomeHudOverlay.styles';

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

export interface HomeHudOverlayProps {
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

function HomeHudOverlayComponent({
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
            <Text style={[styles.resourceLabel, { color: colors.success }]}>CAN</Text>
            <Text style={styles.resourceValue}>{Math.round(player?.resources.cansaco ?? 0)}</Text>
          </View>
          <View style={[styles.resourcePill, { borderColor: 'rgba(79,142,232,0.3)' }]}>
            <Text style={[styles.resourceLabel, { color: '#4f8ee8' }]}>DIS</Text>
            <Text style={styles.resourceValue}>{Math.round(player?.resources.disposicao ?? 0)}</Text>
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

export const HomeHudOverlay = memo(HomeHudOverlayComponent);
HomeHudOverlay.displayName = 'HomeHudOverlay';
