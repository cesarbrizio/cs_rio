import { cartToIso } from '@engine/coordinates';
import type { CameraBounds, CameraState, GridPoint, ParsedTilemap, Size, TileSize } from '@engine/types';

export function buildMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: TileSize): CameraBounds {
  const corners = [
    cartToIso({ x: 0, y: 0 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: 0 }, tileSize),
    cartToIso({ x: 0, y: mapHeight - 1 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: mapHeight - 1 }, tileSize),
  ];
  const xValues = corners.map((corner) => corner.x);
  const yValues = corners.map((corner) => corner.y);

  return {
    maxX: Math.max(...xValues) + tileSize.width,
    maxY: Math.max(...yValues) + tileSize.height,
    minX: Math.min(...xValues) - tileSize.width,
    minY: Math.min(...yValues) - tileSize.height,
  };
}

export function buildInitialCameraState(
  map: ParsedTilemap,
  viewport: Size,
  focusTile: GridPoint,
): CameraState {
  const worldFocus = cartToIso(
    focusTile,
    {
      height: map.tileHeight,
      width: map.tileWidth,
    },
  );

  return {
    mode: 'free',
    viewportHeight: viewport.height,
    viewportWidth: viewport.width,
    x: worldFocus.x,
    y: worldFocus.y,
    zoom: 0.9,
  };
}
