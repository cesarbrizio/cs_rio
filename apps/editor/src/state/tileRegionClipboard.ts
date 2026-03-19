import type { GridPoint } from '@engine/types';

import {
  readTileGid,
  type EditorMapDocument,
} from './editorMapDocument';
import type { TilePaintCommand } from './historyManager';

export interface TileRegionSelection {
  current: GridPoint;
  layerName: string;
  start: GridPoint;
}

export interface TileClipboardData {
  height: number;
  layerName: string;
  tiles: number[];
  width: number;
}

export interface NormalizedTileRegion {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
}

export function normalizeTileRegion(selection: TileRegionSelection): NormalizedTileRegion {
  const minX = Math.min(selection.start.x, selection.current.x);
  const maxX = Math.max(selection.start.x, selection.current.x);
  const minY = Math.min(selection.start.y, selection.current.y);
  const maxY = Math.max(selection.start.y, selection.current.y);

  return {
    height: maxY - minY + 1,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX + 1,
  };
}

export function buildTileClipboard(
  document: EditorMapDocument,
  selection: TileRegionSelection,
): TileClipboardData {
  const region = normalizeTileRegion(selection);
  const tiles: number[] = [];

  for (let y = region.minY; y <= region.maxY; y += 1) {
    for (let x = region.minX; x <= region.maxX; x += 1) {
      tiles.push(readTileGid(document, selection.layerName, { x, y }) ?? 0);
    }
  }

  return {
    height: region.height,
    layerName: selection.layerName,
    tiles,
    width: region.width,
  };
}

export function buildTileClipboardPasteCommand(input: {
  anchor: GridPoint;
  clipboard: TileClipboardData;
  document: EditorMapDocument;
  layerName: string;
  mapBounds: {
    height: number;
    width: number;
  };
}): TilePaintCommand | null {
  const tiles = [];

  for (let offsetY = 0; offsetY < input.clipboard.height; offsetY += 1) {
    for (let offsetX = 0; offsetX < input.clipboard.width; offsetX += 1) {
      const x = input.anchor.x + offsetX;
      const y = input.anchor.y + offsetY;

      if (x < 0 || y < 0 || x >= input.mapBounds.width || y >= input.mapBounds.height) {
        continue;
      }

      const sourceIndex = offsetY * input.clipboard.width + offsetX;
      const newGid = Number(input.clipboard.tiles[sourceIndex] ?? 0);
      const oldGid = readTileGid(input.document, input.layerName, { x, y }) ?? 0;

      if (newGid === oldGid) {
        continue;
      }

      tiles.push({
        newGid,
        oldGid,
        x,
        y,
      });
    }
  }

  return tiles.length > 0
    ? {
        kind: 'tile_paint',
        layerName: input.layerName,
        tiles,
      }
    : null;
}
