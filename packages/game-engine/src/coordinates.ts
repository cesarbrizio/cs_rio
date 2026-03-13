import { type CameraState, type GridPoint, type ScreenPoint, type TileSize } from './types';

export const DEFAULT_TILE_SIZE: TileSize = {
  width: 128,
  height: 64,
};

export function cartToIso(
  point: GridPoint,
  tileSize: TileSize = DEFAULT_TILE_SIZE,
  origin: ScreenPoint = { x: 0, y: 0 },
): ScreenPoint {
  const halfWidth = tileSize.width / 2;
  const halfHeight = tileSize.height / 2;

  return {
    x: (point.x - point.y) * halfWidth + origin.x,
    y: (point.x + point.y) * halfHeight + origin.y,
  };
}

export function isoToCart(
  point: ScreenPoint,
  tileSize: TileSize = DEFAULT_TILE_SIZE,
  origin: ScreenPoint = { x: 0, y: 0 },
): GridPoint {
  const halfWidth = tileSize.width / 2;
  const halfHeight = tileSize.height / 2;
  const normalizedX = point.x - origin.x;
  const normalizedY = point.y - origin.y;

  return {
    x: (normalizedX / halfWidth + normalizedY / halfHeight) / 2,
    y: (normalizedY / halfHeight - normalizedX / halfWidth) / 2,
  };
}

export function roundGridPoint(point: GridPoint): GridPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

export function cameraScreenToWorld(point: ScreenPoint, camera: CameraState): ScreenPoint {
  return {
    x: camera.x + (point.x - camera.viewportWidth / 2) / camera.zoom,
    y: camera.y + (point.y - camera.viewportHeight / 2) / camera.zoom,
  };
}

export function cameraWorldToScreen(point: ScreenPoint, camera: CameraState): ScreenPoint {
  return {
    x: (point.x - camera.x) * camera.zoom + camera.viewportWidth / 2,
    y: (point.y - camera.y) * camera.zoom + camera.viewportHeight / 2,
  };
}

export function screenToTile(
  point: ScreenPoint,
  camera: CameraState,
  tileSize: TileSize = DEFAULT_TILE_SIZE,
  origin: ScreenPoint = { x: 0, y: 0 },
): GridPoint {
  return roundGridPoint(isoToCart(cameraScreenToWorld(point, camera), tileSize, origin));
}
