import type { ParsedTilemap, TilePropertyValue } from '@engine/types';

export interface TilePaletteItem {
  fill: string;
  gid: number;
  kind: string;
  label: string;
  stroke: string;
}

function normalizeColor(value: TilePropertyValue | undefined, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeLabel(kind: string) {
  return kind.replace(/_/g, ' ');
}

export function buildTilePalette(map: ParsedTilemap): TilePaletteItem[] {
  return map.tilesets.flatMap((tileset) => {
    const tileCount = Math.max(tileset.tileCount, 0);

    return Array.from({ length: tileCount }, (_, tileId) => {
      const properties = tileset.properties[tileId] ?? {};
      const kind =
        typeof properties.kind === 'string' && properties.kind.length > 0
          ? properties.kind
          : `tile_${tileId}`;

      return {
        fill: normalizeColor(properties.color, '#3a4f41'),
        gid: tileset.firstGid + tileId,
        kind,
        label: normalizeLabel(kind),
        stroke: normalizeColor(properties.stroke, '#122018'),
      };
    });
  });
}
