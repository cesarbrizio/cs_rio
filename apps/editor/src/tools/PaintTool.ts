import type { GridPoint } from '@engine/types';

import type { TilePaintCommand } from '../state/historyManager';

interface BuildPaintCommandInput {
  layerName: string;
  readTileGid: (layerName: string, point: GridPoint) => number | null;
  targetGid: number;
  tiles: GridPoint[];
}

export function buildPaintCommand(
  input: BuildPaintCommandInput,
): TilePaintCommand | null {
  const seenTiles = new Set<string>();
  const changes = input.tiles.flatMap((tile) => {
    const key = `${tile.x}:${tile.y}`;

    if (seenTiles.has(key)) {
      return [];
    }

    seenTiles.add(key);
    const oldGid = input.readTileGid(input.layerName, tile);

    if (oldGid === null || oldGid === input.targetGid) {
      return [];
    }

    return [
      {
        newGid: input.targetGid,
        oldGid,
        x: tile.x,
        y: tile.y,
      },
    ];
  });

  return changes.length > 0
    ? {
        kind: 'tile_paint',
        layerName: input.layerName,
        tiles: changes,
      }
    : null;
}
