import { cartToIso } from '@engine/coordinates';
import type { GridPoint, ScreenPoint, TileSize, TilemapObject } from '@engine/types';

import type { EditorObjectLayerName } from '../state/editorSelection';
import { buildMarkerLabel, getTilemapObjectFootprint } from './objectLayerEditing';

const LAYER_STYLE_BY_NAME = {
  region_markers: {
    fill: '#3bb8b1',
    stroke: '#0f4f53',
  },
  spawn_points: {
    fill: '#ff9c3c',
    stroke: '#70350d',
  },
} satisfies Record<'region_markers' | 'spawn_points', { fill: string; stroke: string }>;

export interface EditorMarkerOverlay {
  anchor: ScreenPoint;
  fill: string;
  footprint: { h: number; w: number };
  gridPosition: GridPoint;
  label: string;
  layerName: 'region_markers' | 'spawn_points';
  objectId: number;
  sortKey: number;
  stroke: string;
  type: string;
}

function buildMarkerAnchor(
  object: TilemapObject,
  displayTileSize: TileSize,
  mapTileSize: TileSize,
) {
  const footprint = getTilemapObjectFootprint(object, mapTileSize);

  return {
    anchor: cartToIso(
      {
        x: object.gridX + footprint.w / 2,
        y: object.gridY + footprint.h / 2,
      },
      displayTileSize,
    ),
    footprint,
  };
}

export function buildMarkerOverlay(input: {
  displayTileSize: TileSize;
  layerName: 'region_markers' | 'spawn_points';
  mapTileSize: TileSize;
  object: TilemapObject;
}) {
  const { anchor, footprint } = buildMarkerAnchor(
    input.object,
    input.displayTileSize,
    input.mapTileSize,
  );
  const style = LAYER_STYLE_BY_NAME[input.layerName];

  return {
    anchor,
    fill: style.fill,
    footprint,
    gridPosition: {
      x: input.object.gridX,
      y: input.object.gridY,
    },
    label: buildMarkerLabel(input.layerName, input.object),
    layerName: input.layerName,
    objectId: input.object.id,
    sortKey: anchor.y,
    stroke: style.stroke,
    type: input.object.type,
  } satisfies EditorMarkerOverlay;
}

export function buildMarkerOverlays(input: {
  displayTileSize: TileSize;
  layerName: 'region_markers' | 'spawn_points';
  mapTileSize: TileSize;
  objects: TilemapObject[];
}) {
  return input.objects
    .map((object) =>
      buildMarkerOverlay({
        displayTileSize: input.displayTileSize,
        layerName: input.layerName,
        mapTileSize: input.mapTileSize,
        object,
      }),
    )
    .sort((left, right) => left.sortKey - right.sortKey);
}

export function findMarkerOverlayAtTile(
  overlays: EditorMarkerOverlay[],
  tile: GridPoint,
) {
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const overlay = overlays[index];

    if (
      overlay &&
      tile.x >= overlay.gridPosition.x &&
      tile.y >= overlay.gridPosition.y &&
      tile.x < overlay.gridPosition.x + overlay.footprint.w &&
      tile.y < overlay.gridPosition.y + overlay.footprint.h
    ) {
      return overlay;
    }
  }

  return null;
}

export function isMarkerLayerName(
  layerName: EditorObjectLayerName | string,
): layerName is 'region_markers' | 'spawn_points' {
  return layerName === 'spawn_points' || layerName === 'region_markers';
}
