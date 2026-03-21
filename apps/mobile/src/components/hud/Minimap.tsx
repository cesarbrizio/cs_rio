import { type GridPoint } from '@engine/types';
import { memo, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { styles } from './Minimap.styles';

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

function MinimapComponent({
  mapHeight,
  mapLabel,
  mapWidth,
  markers,
  onOpenFullMap,
  onlineCount,
  playerPosition,
}: MinimapProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const compactSurface = width < 390 ? 64 : COMPACT_SURFACE;
  const compactPadding = width < 390 ? 6 : COMPACT_PADDING;
  const compactCardWidth = compactSurface + 18;

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

const GridBackdrop = memo(function GridBackdrop(): JSX.Element {
  return (
    <>
      <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
      <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
    </>
  );
});
GridBackdrop.displayName = 'GridBackdrop';

const LegendItem = memo(function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}): JSX.Element {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
});
LegendItem.displayName = 'LegendItem';

export const Minimap = memo(MinimapComponent);
Minimap.displayName = 'Minimap';
