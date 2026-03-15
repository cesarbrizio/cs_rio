import { cartToIso } from '@engine/coordinates';
import { type CameraState, type GridPoint, type ScreenPoint } from '@engine/types';
import { Skia } from '@shopify/react-native-skia';

import { type GameEntity, type GameStructure } from './types';

export function createCameraMatrix(cameraState: CameraState): number[] {
  return [
    cameraState.zoom,
    0,
    cameraState.viewportWidth / 2 - cameraState.x * cameraState.zoom,
    0,
    cameraState.zoom,
    cameraState.viewportHeight / 2 - cameraState.y * cameraState.zoom,
    0,
    0,
    1,
  ];
}

export function createDiamondPath(centerX: number, centerY: number, width: number, height: number) {
  const path = Skia.Path.Make();
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  path.moveTo(centerX, centerY - halfHeight);
  path.lineTo(centerX + halfWidth, centerY);
  path.lineTo(centerX, centerY + halfHeight);
  path.lineTo(centerX - halfWidth, centerY);
  path.close();

  return path;
}

export function createRectPath(x: number, y: number, width: number, height: number) {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(x, y, width, height));
  return path;
}

export function createPolygonPath(points: ScreenPoint[]) {
  const path = Skia.Path.Make();

  if (points.length === 0) {
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  path.close();
  return path;
}

export function scalePolygonPoints(
  points: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
  center: ScreenPoint,
  scaleX: number,
  scaleY: number,
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scaleX,
    y: center.y + (point.y - center.y) * scaleY,
  })) as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
}

export function createPolylinePath(points: ScreenPoint[]) {
  const path = Skia.Path.Make();

  if (points.length === 0) {
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  return path;
}

export function createLinePath(start: ScreenPoint, end: ScreenPoint) {
  const path = Skia.Path.Make();
  path.moveTo(start.x, start.y);
  path.lineTo(end.x, end.y);
  return path;
}

export function getMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: { height: number; width: number }) {
  const corners = [
    cartToIso({ x: 0, y: 0 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: 0 }, tileSize),
    cartToIso({ x: 0, y: mapHeight - 1 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: mapHeight - 1 }, tileSize),
  ];

  const xValues = corners.map((corner) => corner.x);
  const yValues = corners.map((corner) => corner.y);

  return {
    minX: Math.min(...xValues) - tileSize.width,
    minY: Math.min(...yValues) - tileSize.height,
    maxX: Math.max(...xValues) + tileSize.width,
    maxY: Math.max(...yValues) + tileSize.height,
  };
}

export function getSceneWorldBounds(input: {
  entities: GameEntity[];
  fallbackBounds: { maxX: number; maxY: number; minX: number; minY: number };
  spawnTile: GridPoint;
  structures: GameStructure[];
  tileSize: { height: number; width: number };
}) {
  const worldPoints: ScreenPoint[] = [cartToIso(input.spawnTile, input.tileSize)];

  for (const entity of input.entities) {
    worldPoints.push(cartToIso(entity.position, input.tileSize));
  }

  for (const structure of input.structures) {
    worldPoints.push(cartToIso(structure.position, input.tileSize));
    worldPoints.push(
      cartToIso(
        {
          x: structure.position.x + structure.footprint.w,
          y: structure.position.y + structure.footprint.h,
        },
        input.tileSize,
      ),
    );
  }

  if (worldPoints.length <= 1) {
    return input.fallbackBounds;
  }

  const xValues = worldPoints.map((point) => point.x);
  const yValues = worldPoints.map((point) => point.y);
  const marginX = input.tileSize.width * 4;
  const marginY = input.tileSize.height * 5;

  return {
    minX: Math.max(input.fallbackBounds.minX, Math.min(...xValues) - marginX),
    minY: Math.max(input.fallbackBounds.minY, Math.min(...yValues) - marginY),
    maxX: Math.min(input.fallbackBounds.maxX, Math.max(...xValues) + marginX),
    maxY: Math.min(input.fallbackBounds.maxY, Math.max(...yValues) + marginY),
  };
}

export function hasCameraChanged(left: CameraState, right: CameraState): boolean {
  return (
    Math.abs(left.x - right.x) > 0.01 ||
    Math.abs(left.y - right.y) > 0.01 ||
    Math.abs(left.zoom - right.zoom) > 0.001 ||
    left.mode !== right.mode ||
    left.viewportWidth !== right.viewportWidth ||
    left.viewportHeight !== right.viewportHeight
  );
}

export function mapDirectionToSprite(direction: string): string {
  const normalizedDirection = direction === 'idle' ? 's' : direction;
  return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].includes(normalizedDirection)
    ? normalizedDirection
    : 's';
}

export function toAlphaHex(input: string, alpha: number): string {
  if (!input.startsWith('#') || (input.length !== 7 && input.length !== 9)) {
    return input;
  }

  const normalizedAlpha = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, '0');

  return `${input.slice(0, 7)}${normalizedAlpha}`;
}

export function projectWorldToScreen(cameraState: CameraState, point: ScreenPoint): ScreenPoint {
  return {
    x: (point.x - cameraState.x) * cameraState.zoom + cameraState.viewportWidth / 2,
    y: (point.y - cameraState.y) * cameraState.zoom + cameraState.viewportHeight / 2,
  };
}

export function isOverlayVisible(
  point: ScreenPoint,
  viewportWidth: number,
  viewportHeight: number,
  margin = 64,
): boolean {
  return (
    point.x >= -margin &&
    point.y >= -margin &&
    point.x <= viewportWidth + margin &&
    point.y <= viewportHeight + margin
  );
}

export function clampOverlayPosition(
  viewportWidth: number,
  viewportHeight: number,
  desiredX: number,
  desiredY: number,
  overlayWidth: number,
  overlayHeight: number,
  padding = 8,
): ScreenPoint {
  return {
    x: Math.max(padding, Math.min(desiredX, viewportWidth - overlayWidth - padding)),
    y: Math.max(padding, Math.min(desiredY, viewportHeight - overlayHeight - padding)),
  };
}
