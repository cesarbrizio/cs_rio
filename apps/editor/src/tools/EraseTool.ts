import type { GridPoint } from '@engine/types';

import { buildPaintCommand } from './PaintTool';

interface BuildEraseCommandInput {
  layerName: string;
  readTileGid: (layerName: string, point: GridPoint) => number | null;
  tiles: GridPoint[];
}

export function buildEraseCommand(input: BuildEraseCommandInput) {
  return buildPaintCommand({
    layerName: input.layerName,
    readTileGid: input.readTileGid,
    targetGid: 0,
    tiles: input.tiles,
  });
}
