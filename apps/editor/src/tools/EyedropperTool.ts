import type { GridPoint } from '@engine/types';

interface PickTileGidInput {
  layerName: string;
  point: GridPoint;
  readTileGid: (layerName: string, point: GridPoint) => number | null;
}

export function pickTileGid(input: PickTileGidInput) {
  const gid = input.readTileGid(input.layerName, input.point);

  return gid && gid > 0 ? gid : null;
}
