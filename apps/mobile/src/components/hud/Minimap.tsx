import { type GridPoint } from '@engine/types';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { projectPointToMinimap } from '../../features/minimap';
import { colors } from '../../theme/colors';

export interface MinimapMarker {
  id: string;
  kind: 'location' | 'player' | 'property';
  x: number;
  y: number;
}

interface MinimapProps {
  mapHeight: number;
  mapLabel: string;
  mapWidth: number;
  onOpenFullMap?: () => void;
  onlineCount: number;
  playerPosition: GridPoint | null;
  markers: MinimapMarker[];
}

const COMPACT_SURFACE = 72;
const COMPACT_PADDING = 8;
const FULL_SURFACE = 280;
const FULL_PADDING = 18;

export function Minimap({
  mapHeight,
  mapLabel,
  mapWidth,
  markers,
  onOpenFullMap,
  onlineCount,
  playerPosition,
}: MinimapProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const { width } = useWindowDimensions();
  const compactSurface = width < 390 ? 64 : COMPACT_SURFACE;
  const compactPadding = width < 390 ? 6 : COMPACT_PADDING;
  const compactCardWidth = compactSurface + 18;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setBlinkOn((current) => !current);
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const compactMarkers = useMemo(
    () =>
      markers.map((marker) => ({
        ...marker,
        ...projectPointToMinimap({
          mapHeight,
          mapWidth,
          padding: compactPadding,
          surfaceHeight: compactSurface,
          surfaceWidth: compactSurface,
          x: marker.x,
          y: marker.y,
        }),
      })),
    [compactPadding, compactSurface, mapHeight, mapWidth, markers],
  );
  const fullMarkers = useMemo(
    () =>
      markers.map((marker) => ({
        ...marker,
        ...projectPointToMinimap({
          mapHeight,
          mapWidth,
          padding: FULL_PADDING,
          surfaceHeight: FULL_SURFACE,
          surfaceWidth: FULL_SURFACE,
          x: marker.x,
          y: marker.y,
        }),
      })),
    [mapHeight, mapWidth, markers],
  );
  const compactPlayer = playerPosition
    ? projectPointToMinimap({
        mapHeight,
        mapWidth,
        padding: compactPadding,
        surfaceHeight: compactSurface,
        surfaceWidth: compactSurface,
        x: playerPosition.x,
        y: playerPosition.y,
      })
    : null;
  const fullPlayer = playerPosition
    ? projectPointToMinimap({
        mapHeight,
        mapWidth,
        padding: FULL_PADDING,
        surfaceHeight: FULL_SURFACE,
        surfaceWidth: FULL_SURFACE,
        x: playerPosition.x,
        y: playerPosition.y,
      })
    : null;

  return (
    <>
      <Pressable
        onPress={() => {
          if (onOpenFullMap) {
            onOpenFullMap();
            return;
          }

          setExpanded(true);
        }}
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>Mapa</Text>
          <Text style={styles.meta}>{onlineCount}</Text>
        </View>
        <Text style={styles.title}>{mapLabel}</Text>
        <View
          style={[
            styles.cardCompact,
            {
              width: compactCardWidth,
            },
          ]}
        >
          <View style={[styles.surface, { height: compactSurface, width: compactSurface }]}>
          <GridBackdrop />
          {compactMarkers.map((marker) => (
            <View
              key={marker.id}
              style={[
                styles.marker,
                marker.kind === 'property' ? styles.propertyMarker : styles.remoteMarker,
                {
                  left: marker.left - 3,
                  top: marker.top - 3,
                },
              ]}
            />
          ))}
          {compactPlayer ? (
            <View
              style={[
                styles.marker,
                styles.localMarker,
                {
                  left: compactPlayer.left - 4,
                  opacity: blinkOn ? 1 : 0.35,
                  top: compactPlayer.top - 4,
                },
              ]}
            />
          ) : null}
          </View>
        </View>
        <Text style={styles.hint}>Ampliar</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={expanded}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{mapLabel}</Text>
                <Text style={styles.modalSubtitle}>
                  Visão tática ampliada da região atual
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setExpanded(false);
                }}
                style={({ pressed }) => [styles.closeButton, pressed ? styles.cardPressed : null]}
              >
                <Text style={styles.closeButtonLabel}>Fechar</Text>
              </Pressable>
            </View>

            <View style={[styles.surface, styles.fullSurface, { height: FULL_SURFACE, width: FULL_SURFACE }]}>
              <GridBackdrop />
              {fullMarkers.map((marker) => (
                <View
                  key={marker.id}
                  style={[
                    styles.marker,
                    marker.kind === 'property' ? styles.propertyMarker : styles.remoteMarker,
                    {
                      left: marker.left - 4,
                      top: marker.top - 4,
                    },
                  ]}
                />
              ))}
              {fullPlayer ? (
                <View
                  style={[
                    styles.marker,
                    styles.localMarker,
                    {
                      left: fullPlayer.left - 5,
                      opacity: blinkOn ? 1 : 0.35,
                      top: fullPlayer.top - 5,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.legendRow}>
              <LegendItem color={colors.success} label="Você" />
              <LegendItem color={colors.accent} label="Jogadores" />
              <LegendItem color="#6db7ff" label="Propriedades" />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function GridBackdrop(): JSX.Element {
  return (
    <>
      <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
      <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 10,
    width: 96,
  },
  cardCompact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  surface: {
    alignItems: 'stretch',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  fullSurface: {
    alignSelf: 'center',
  },
  gridLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    position: 'absolute',
  },
  gridLineVertical: {
    bottom: 0,
    top: 0,
    width: 1,
  },
  gridLineHorizontal: {
    height: 1,
    left: 0,
    right: 0,
  },
  marker: {
    borderRadius: 999,
    height: 8,
    position: 'absolute',
    width: 8,
  },
  localMarker: {
    backgroundColor: colors.success,
    height: 10,
    shadowColor: colors.success,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    width: 10,
  },
  remoteMarker: {
    backgroundColor: colors.accent,
  },
  propertyMarker: {
    backgroundColor: '#6db7ff',
  },
  hint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 12,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendSwatch: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendLabel: {
    color: colors.muted,
    fontSize: 12,
  },
});
