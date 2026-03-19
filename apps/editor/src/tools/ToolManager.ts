import type { GridPoint } from '@engine/types';

export type EditorToolName =
  | 'delete'
  | 'erase'
  | 'eyedropper'
  | 'paint'
  | 'place'
  | 'select';

export type TerrainContinuousToolName = 'erase' | 'paint';
export type TerrainToolName = 'erase' | 'eyedropper' | 'paint';

export type EditorBrushMode =
  | 'brush_1'
  | 'brush_3'
  | 'brush_5'
  | 'line'
  | 'rectangle';

export interface ToolSession {
  activeLayerName: string;
  anchorTile: GridPoint;
  brushMode: EditorBrushMode;
  currentTile: GridPoint;
  mode: 'continuous' | 'deferred';
  tool: TerrainContinuousToolName;
}

interface MapBounds {
  height: number;
  width: number;
}

function clampTileToMap(point: GridPoint, mapBounds: MapBounds) {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < mapBounds.width &&
    point.y < mapBounds.height
  );
}

function buildSquareBrushTiles(
  center: GridPoint,
  radius: number,
  mapBounds: MapBounds,
) {
  const tiles: GridPoint[] = [];

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const point = {
        x: center.x + offsetX,
        y: center.y + offsetY,
      };

      if (clampTileToMap(point, mapBounds)) {
        tiles.push(point);
      }
    }
  }

  return tiles;
}

function buildLineTiles(
  start: GridPoint,
  end: GridPoint,
  mapBounds: MapBounds,
) {
  const tiles: GridPoint[] = [];
  const deltaX = Math.abs(end.x - start.x);
  const deltaY = Math.abs(end.y - start.y);
  const stepX = start.x < end.x ? 1 : -1;
  const stepY = start.y < end.y ? 1 : -1;
  let currentX = start.x;
  let currentY = start.y;
  let error = deltaX - deltaY;

  let reachedEnd = false;

  while (!reachedEnd) {
    const point = { x: currentX, y: currentY };

    if (clampTileToMap(point, mapBounds)) {
      tiles.push(point);
    }

    if (currentX === end.x && currentY === end.y) {
      reachedEnd = true;
      continue;
    }

    const doubledError = error * 2;

    if (doubledError > -deltaY) {
      error -= deltaY;
      currentX += stepX;
    }

    if (doubledError < deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }

  return tiles;
}

function buildRectangleTiles(
  start: GridPoint,
  end: GridPoint,
  mapBounds: MapBounds,
) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const tiles: GridPoint[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const point = { x, y };

      if (clampTileToMap(point, mapBounds)) {
        tiles.push(point);
      }
    }
  }

  return tiles;
}

export function isContinuousBrushMode(brushMode: EditorBrushMode) {
  return (
    brushMode === 'brush_1' ||
    brushMode === 'brush_3' ||
    brushMode === 'brush_5'
  );
}

export function isTerrainTool(tool: EditorToolName): tool is TerrainToolName {
  return tool === 'paint' || tool === 'erase' || tool === 'eyedropper';
}

export function isTerrainContinuousTool(
  tool: EditorToolName,
): tool is TerrainContinuousToolName {
  return tool === 'paint' || tool === 'erase';
}

export function createToolSession(input: {
  activeLayerName: string;
  brushMode: EditorBrushMode;
  tile: GridPoint;
  tool: TerrainContinuousToolName;
}): ToolSession {
  return {
    activeLayerName: input.activeLayerName,
    anchorTile: input.tile,
    brushMode: input.brushMode,
    currentTile: input.tile,
    mode: isContinuousBrushMode(input.brushMode) ? 'continuous' : 'deferred',
    tool: input.tool,
  };
}

export function updateToolSession(
  session: ToolSession,
  nextTile: GridPoint,
): ToolSession {
  if (
    session.currentTile.x === nextTile.x &&
    session.currentTile.y === nextTile.y
  ) {
    return session;
  }

  return {
    ...session,
    currentTile: nextTile,
  };
}

export function buildBrushTiles(
  brushMode: EditorBrushMode,
  anchorTile: GridPoint,
  currentTile: GridPoint,
  mapBounds: MapBounds,
) {
  if (brushMode === 'brush_1') {
    return buildSquareBrushTiles(currentTile, 0, mapBounds);
  }

  if (brushMode === 'brush_3') {
    return buildSquareBrushTiles(currentTile, 1, mapBounds);
  }

  if (brushMode === 'brush_5') {
    return buildSquareBrushTiles(currentTile, 2, mapBounds);
  }

  if (brushMode === 'line') {
    return buildLineTiles(anchorTile, currentTile, mapBounds);
  }

  return buildRectangleTiles(anchorTile, currentTile, mapBounds);
}

export function buildHoverPreview(
  tool: EditorToolName,
  brushMode: EditorBrushMode,
  hoveredTile: GridPoint | null,
  mapBounds: MapBounds,
) {
  if (!hoveredTile) {
    return [];
  }

  if (!isTerrainTool(tool)) {
    return [];
  }

  if (tool === 'eyedropper' || brushMode === 'line' || brushMode === 'rectangle') {
    return [hoveredTile];
  }

  return buildBrushTiles(brushMode, hoveredTile, hoveredTile, mapBounds);
}
