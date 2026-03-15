import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors } from '../../theme/colors';
import { type DebugState, type DestinationOverlay, type WorldLabelOverlay } from './types';

interface GameOverlayLayerProps {
  debugState: DebugState;
  destinationOverlay: DestinationOverlay | null;
  mapHeight: number;
  mapWidth: number;
  onEntityTap?: (entityId: string) => void;
  onFollowPress: () => void;
  onPanelLayout: (key: 'controls' | 'debug', event: LayoutChangeEvent) => void;
  onZoneTap?: (zoneId: string) => void;
  selectedTileLabel: string;
  showControlsOverlay: boolean;
  showDebugOverlay: boolean;
  spatialLabelOverlays: WorldLabelOverlay[];
}

export function GameOverlayLayer({
  debugState,
  destinationOverlay,
  mapHeight,
  mapWidth,
  onEntityTap,
  onFollowPress,
  onPanelLayout,
  onZoneTap,
  selectedTileLabel,
  showControlsOverlay,
  showDebugOverlay,
  spatialLabelOverlays,
}: GameOverlayLayerProps): JSX.Element {
  return (
    <>
      {spatialLabelOverlays.length > 0 ? (
        <View pointerEvents="box-none" style={styles.spatialLabelLayer}>
          {spatialLabelOverlays.map((overlay) => (
            <View key={overlay.id}>
              {overlay.anchorX !== undefined &&
              overlay.anchorY !== undefined &&
              overlay.anchorY > overlay.y + (overlay.ownerLabel ? 34 : 18) ? (
                <>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.spatialLabelConnector,
                      {
                        backgroundColor: `${overlay.accent}bb`,
                        height: Math.max(6, overlay.anchorY - (overlay.y + (overlay.ownerLabel ? 34 : 18))),
                        left: overlay.anchorX - 1,
                        top: overlay.y + (overlay.ownerLabel ? 34 : 18),
                      },
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.spatialLabelConnectorDot,
                      {
                        backgroundColor: `${overlay.accent}dd`,
                        left: overlay.anchorX - 3,
                        top: overlay.anchorY - 3,
                      },
                    ]}
                  />
                </>
              ) : null}
              {overlay.kind === 'zone' && overlay.zoneId && onZoneTap ? (
                <Pressable
                  onPress={() => {
                    onZoneTap(overlay.zoneId!);
                  }}
                  style={({ pressed }) => [
                    styles.spatialLabel,
                    styles.zoneLabel,
                    overlay.relation === 'ally' ? styles.allyZoneLabel : null,
                    overlay.relation === 'enemy' ? styles.enemyZoneLabel : null,
                    overlay.relation === 'neutral' ? styles.neutralZoneLabel : null,
                    overlay.selected ? styles.selectedZoneLabel : null,
                    pressed ? styles.pressedZoneLabel : null,
                    {
                      borderColor: `${overlay.accent}${overlay.selected ? 'ff' : '88'}`,
                      left: overlay.x,
                      top: overlay.y,
                    },
                  ]}
                >
                  <Text numberOfLines={2} style={styles.spatialLabelText}>
                    {overlay.label}
                  </Text>
                  {overlay.ownerLabel ? (
                    <Text numberOfLines={1} style={styles.zoneOwnerText}>
                      {overlay.ownerLabel}
                    </Text>
                  ) : null}
                </Pressable>
              ) : overlay.kind === 'entity' && overlay.entityId && onEntityTap ? (
                <Pressable
                  onPress={() => {
                    onEntityTap(overlay.entityId!);
                  }}
                  style={({ pressed }) => [
                    styles.spatialLabel,
                    styles.entityLabel,
                    overlay.entityKind === 'market' ? styles.marketLabel : null,
                    overlay.entityKind === 'boca' ? styles.bocaLabel : null,
                    overlay.entityKind === 'factory' ? styles.factoryLabel : null,
                    overlay.entityKind === 'party' ? styles.partyLabel : null,
                    overlay.entityKind === 'hospital' ? styles.hospitalLabel : null,
                    overlay.entityKind === 'training' ? styles.trainingLabel : null,
                    overlay.entityKind === 'university' ? styles.universityLabel : null,
                    overlay.entityKind === 'docks' ? styles.docksLabel : null,
                    overlay.entityKind === 'scrapyard' ? styles.scrapyardLabel : null,
                    pressed ? styles.pressedZoneLabel : null,
                    {
                      borderColor: `${overlay.accent}aa`,
                      left: overlay.x,
                      top: overlay.y,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={styles.spatialLabelText}>
                    {overlay.label}
                  </Text>
                </Pressable>
              ) : (
                <View
                  pointerEvents="none"
                  style={[
                    styles.spatialLabel,
                    overlay.kind === 'zone' ? styles.zoneLabel : styles.entityLabel,
                    overlay.kind === 'entity' && overlay.entityKind === 'market' ? styles.marketLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'boca' ? styles.bocaLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'factory' ? styles.factoryLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'party' ? styles.partyLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'hospital' ? styles.hospitalLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'training' ? styles.trainingLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'university' ? styles.universityLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'docks' ? styles.docksLabel : null,
                    overlay.kind === 'entity' && overlay.entityKind === 'scrapyard' ? styles.scrapyardLabel : null,
                    overlay.kind === 'trail' ? styles.trailLabel : null,
                    overlay.kind === 'zone' && overlay.relation === 'ally' ? styles.allyZoneLabel : null,
                    overlay.kind === 'zone' && overlay.relation === 'enemy' ? styles.enemyZoneLabel : null,
                    overlay.kind === 'zone' && overlay.relation === 'neutral' ? styles.neutralZoneLabel : null,
                    overlay.selected ? styles.selectedZoneLabel : null,
                    {
                      borderColor: `${overlay.accent}${overlay.selected ? 'ff' : '88'}`,
                      left: overlay.x,
                      top: overlay.y,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={styles.spatialLabelText}>
                    {overlay.label}
                  </Text>
                  {overlay.kind === 'zone' && overlay.ownerLabel ? (
                    <Text numberOfLines={1} style={styles.zoneOwnerText}>
                      {overlay.ownerLabel}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {destinationOverlay ? (
        <View
          pointerEvents="none"
          style={[
            styles.destinationOverlay,
            {
              left: destinationOverlay.x,
              top: destinationOverlay.y,
            },
          ]}
        >
          <Text style={styles.destinationOverlayLabel}>Destino</Text>
        </View>
      ) : null}

      {showDebugOverlay ? (
        <View onLayout={(event) => onPanelLayout('debug', event)} style={styles.debugPanel}>
          <Text style={styles.debugLine}>Mapa {mapWidth}x{mapHeight}</Text>
          <Text style={styles.debugLine}>Cam {debugState.camera.mode} {debugState.camera.zoom.toFixed(2)}x</Text>
          <Text style={styles.debugLine}>Tile {selectedTileLabel}</Text>
          <Text style={styles.debugLine}>
            Player {debugState.playerPosition.x.toFixed(1)},{debugState.playerPosition.y.toFixed(1)}
          </Text>
          <Text style={styles.debugLine}>Clip {debugState.clipName ?? '--'}</Text>
          <Text style={styles.debugLine}>FPS {debugState.fps}</Text>
        </View>
      ) : null}

      {showControlsOverlay ? (
        <View onLayout={(event) => onPanelLayout('controls', event)} style={styles.controls}>
          <Text style={styles.controlText}>
            Toque move. Pressione para marcar tile. Arraste faz pan. Pinch controla zoom.
          </Text>
          <Pressable
            onPress={onFollowPress}
            style={({ pressed }) => [styles.followButton, pressed ? styles.followButtonPressed : null]}
          >
            <Text style={styles.followButtonLabel}>Seguir jogador</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  spatialLabelLayer: {
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  destinationOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 8, 8, 0.84)',
    borderColor: 'rgba(224, 176, 75, 0.55)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
  },
  destinationOverlayLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  spatialLabel: {
    backgroundColor: 'rgba(10, 10, 10, 0.82)',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 138,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
  },
  spatialLabelConnector: {
    borderRadius: 999,
    position: 'absolute',
    width: 2,
  },
  spatialLabelConnectorDot: {
    borderRadius: 999,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  zoneLabel: {
    backgroundColor: 'rgba(16, 18, 22, 0.9)',
    minWidth: 108,
  },
  allyZoneLabel: {
    backgroundColor: 'rgba(17, 47, 28, 0.92)',
  },
  enemyZoneLabel: {
    backgroundColor: 'rgba(58, 22, 22, 0.92)',
  },
  neutralZoneLabel: {
    backgroundColor: 'rgba(28, 31, 37, 0.92)',
  },
  selectedZoneLabel: {
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  pressedZoneLabel: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  entityLabel: {
    backgroundColor: 'rgba(22, 19, 14, 0.92)',
  },
  marketLabel: {
    backgroundColor: 'rgba(60, 26, 18, 0.94)',
  },
  bocaLabel: {
    backgroundColor: 'rgba(43, 20, 22, 0.94)',
  },
  factoryLabel: {
    backgroundColor: 'rgba(22, 40, 28, 0.94)',
  },
  partyLabel: {
    backgroundColor: 'rgba(46, 24, 54, 0.94)',
  },
  hospitalLabel: {
    backgroundColor: 'rgba(20, 34, 54, 0.94)',
  },
  trainingLabel: {
    backgroundColor: 'rgba(54, 40, 18, 0.94)',
  },
  universityLabel: {
    backgroundColor: 'rgba(18, 36, 52, 0.94)',
  },
  docksLabel: {
    backgroundColor: 'rgba(18, 34, 42, 0.94)',
  },
  scrapyardLabel: {
    backgroundColor: 'rgba(45, 31, 23, 0.94)',
  },
  trailLabel: {
    backgroundColor: 'rgba(14, 28, 35, 0.92)',
  },
  spatialLabelText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  zoneOwnerText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  debugPanel: {
    backgroundColor: 'rgba(17, 17, 17, 0.72)',
    borderBottomRightRadius: 18,
    gap: 2,
    left: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
  },
  debugLine: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  controlText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 12,
  },
  followButton: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  followButtonPressed: {
    opacity: 0.84,
  },
  followButtonLabel: {
    color: '#15110a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
