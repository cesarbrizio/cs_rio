import { Camera } from '@engine/camera';
import { cartToIso } from '@engine/coordinates';
import { parseTilemap } from '@engine/tilemap-parser';
import type { CameraState, GridPoint, ParsedTilemap } from '@engine/types';
import type { MapStructureKind } from '@shared/map/types';

import zonaNorteMapJson from '../../../mobile/assets/maps/zona_norte.json';
import { createEditorMapDocument, createParsedTilemapInput } from './editorMapDocument.js';
import { buildTilePalette } from './tilePalette.js';
import type { OverlayVisibilityState } from './editorStoreTypes.js';
import {
  EDITOR_TILE_SIZE,
  buildEditorRuntime,
  findCollisionPaintGid,
  getDefaultActiveLayerName,
  getMapWorldBounds,
} from './editorStoreSupport.js';

export const mapName = 'Zona Norte';

export const initialMapDocument = createEditorMapDocument(
  zonaNorteMapJson as Record<string, unknown>,
);
export const initialParsedMap = parseTilemap(createParsedTilemapInput(initialMapDocument));
export const initialTilePalette = buildTilePalette(initialParsedMap);

const mapBounds = getMapWorldBounds(
  initialParsedMap.width,
  initialParsedMap.height,
  EDITOR_TILE_SIZE,
);

export const initialCameraState: CameraState = {
  mode: 'free',
  viewportHeight: 720,
  viewportWidth: 1280,
  x: (mapBounds.minX + mapBounds.maxX) / 2,
  y: (mapBounds.minY + mapBounds.maxY) / 2,
  zoom: 0.72,
};

export const initialOverlayVisibility: OverlayVisibilityState = {
  collision: true,
  grid: false,
  regionMarkers: true,
  spawnPoints: true,
};

export const camera = new Camera(initialCameraState, mapBounds);

export const initialRuntime = buildEditorRuntime(
  initialMapDocument,
  camera.getState(),
  initialOverlayVisibility,
);

export const initialSelectedStructureKind = 'boca' as MapStructureKind;
export const initialCollisionPaintGid = findCollisionPaintGid(initialMapDocument);
export const initialActiveLayerName = getDefaultActiveLayerName(initialRuntime.layerSummaries);

export function resetCameraForMap(map: ParsedTilemap) {
  const nextMapBounds = getMapWorldBounds(map.width, map.height, EDITOR_TILE_SIZE);
  const nextCameraCenter = {
    x: (nextMapBounds.minX + nextMapBounds.maxX) / 2,
    y: (nextMapBounds.minY + nextMapBounds.maxY) / 2,
  };

  camera.setBounds(nextMapBounds);
  camera.zoomTo(initialCameraState.zoom);
  camera.panTo(nextCameraCenter);

  return camera.getState();
}

export function focusCameraOnTile(tile: GridPoint) {
  return camera.panTo(
    cartToIso(
      {
        x: tile.x + 0.5,
        y: tile.y + 0.5,
      },
      EDITOR_TILE_SIZE,
    ),
  );
}
