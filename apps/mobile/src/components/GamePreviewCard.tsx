import { cartToIso } from '@engine/coordinates';
import { parseTilemap } from '@engine/tilemap-parser';
import { REGIONS, VOCATIONS } from '@shared/constants';
import { StyleSheet, Text, View } from 'react-native';

import { zonaNorteMapData } from '../data/zonaNortePrototypeMap';
import { colors } from '../theme/colors';

const previewPosition = cartToIso({ x: 4, y: 2 });
const prototypeMap = parseTilemap(zonaNorteMapData);

export function GamePreviewCard(): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Slice jogavel de Fase 1</Text>
      <Text style={styles.copy}>
        O mobile agora carrega um mapa isometrico de prototipo, com culling, camera e pathfinding
        em um package de engine separado do app.
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Preview iso</Text>
        <Text style={styles.value}>
          x={previewPosition.x} / y={previewPosition.y}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Vocoes</Text>
        <Text style={styles.value}>{VOCATIONS.length}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Regioes</Text>
        <Text style={styles.value}>{REGIONS.length}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Mapa</Text>
        <Text style={styles.value}>
          {prototypeMap.width}x{prototypeMap.height}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Spawns</Text>
        <Text style={styles.value}>{prototypeMap.spawnPoints.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
