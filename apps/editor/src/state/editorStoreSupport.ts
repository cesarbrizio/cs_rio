import { cartToIso } from '@engine/coordinates';
import { parseTilemap } from '@engine/tilemap-parser';
import { TilemapRenderer } from '@engine/tilemap-renderer';
import type {
  CameraState,
  GridPoint,
  ParsedMapStructure,
  ParsedTilemap,
  TileSize,
  TilemapObject,
} from '@engine/types';
import type { MapStructureKind } from '@shared/map/types';

import {
  buildMarkerOverlay,
  buildMarkerOverlays,
  isMarkerLayerName,
} from '../objects/buildMarkerOverlays.js';
import {
  buildPlacedTilemapObject,
  clampTilemapObjectGridPosition,
  findTilemapObjectById,
  moveTilemapObjectToGrid,
} from '../objects/objectLayerEditing.js';
import { buildEraseCommand } from '../tools/EraseTool.js';
import { buildPlacedStructure } from '../tools/PlaceTool.js';
import { buildPaintCommand } from '../tools/PaintTool.js';
import {
  buildBrushTiles,
  buildHoverPreview,
  type EditorBrushMode,
  type EditorToolName,
} from '../tools/ToolManager.js';
import {
  createParsedTilemapInput,
  getEditableTileLayerSummaries,
  getObjectLayerRecords,
  readTileGid,
  type EditorMapDocument,
  type EditorTileLayerSummary,
} from './editorMapDocument.js';
import {
  type EditorObjectLayerName,
  getSelectionKindForLayer,
  isEditorObjectLayerName,
  type EditorSelection,
} from './editorSelection.js';
import type { ObjectLayerSnapshotCommand, TilePaintCommand } from './historyManager.js';
import type { TilePaletteItem } from './tilePalette.js';
import type {
  ActiveToolSession,
  EditorRuntime,
  MarkerPreviewState,
  ObjectMoveSession,
  OverlayVisibilityState,
  StructurePreviewState,
} from './editorStoreTypes.js';
import {
  buildSingleStructureOverlay,
  buildStructureOverlays,
} from '../structures/buildStructureOverlays.js';
import {
  clampStructureGridPosition,
  findStructureByObjectId,
  findStructureConflictIds,
  moveStructureToGrid,
} from '../structures/structureEditing.js';

export const EDITOR_TILE_SIZE: TileSize = {
  height: 4,
  width: 8,
};

export const renderer = new TilemapRenderer(EDITOR_TILE_SIZE);

export function isSameTile(left: GridPoint | null, right: GridPoint | null) {
  return left?.x === right?.x && left?.y === right?.y;
}

export function getMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: TileSize) {
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

export function isLayerVisible(document: EditorMapDocument, layerName: string) {
  return document.layers.find((layer) => layer.name === layerName)?.visible ?? true;
}

export function isTileLayerActive(document: EditorMapDocument, layerName: string) {
  return document.layers.some((layer) => layer.type === 'tilelayer' && layer.name === layerName);
}

function buildCollisionOverlayTiles(map: ParsedTilemap) {
  return [...map.collisionSet].map((key) => {
    const parts = key.split(':');
    const x = Number(parts[0] ?? 0);
    const y = Number(parts[1] ?? 0);

    return {
      x,
      y,
    };
  });
}

export function buildEditorRuntime(
  mapDocument: EditorMapDocument,
  cameraState: CameraState,
  overlayVisibility: OverlayVisibilityState,
) {
  const parsedMap = parseTilemap(createParsedTilemapInput(mapDocument));
  const renderPlan = renderer.buildRenderPlan(parsedMap, cameraState);

  return {
    collisionOverlayTiles:
      overlayVisibility.collision && isLayerVisible(mapDocument, 'collision')
        ? buildCollisionOverlayTiles(parsedMap)
        : [],
    layerSummaries: getEditableTileLayerSummaries(mapDocument),
    map: parsedMap,
    regionMarkerOverlays:
      overlayVisibility.regionMarkers && isLayerVisible(mapDocument, 'region_markers')
        ? buildMarkerOverlays({
            displayTileSize: EDITOR_TILE_SIZE,
            layerName: 'region_markers',
            mapTileSize: {
              height: parsedMap.tileHeight,
              width: parsedMap.tileWidth,
            },
            objects: parsedMap.regionMarkers,
          })
        : [],
    renderPlan: {
      ...renderPlan,
      overlay: renderPlan.overlay.filter((tile) => tile.layerName !== 'collision'),
    },
    spawnPointOverlays:
      overlayVisibility.spawnPoints && isLayerVisible(mapDocument, 'spawn_points')
        ? buildMarkerOverlays({
            displayTileSize: EDITOR_TILE_SIZE,
            layerName: 'spawn_points',
            mapTileSize: {
              height: parsedMap.tileHeight,
              width: parsedMap.tileWidth,
            },
            objects: parsedMap.spawnPoints,
          })
        : [],
    structureOverlays: isLayerVisible(mapDocument, 'structures')
      ? buildStructureOverlays({
          displayTileSize: EDITOR_TILE_SIZE,
          mapTileSize: {
            height: parsedMap.tileHeight,
            width: parsedMap.tileWidth,
          },
          structures: parsedMap.structures,
        })
      : [],
  } satisfies EditorRuntime;
}

function buildTilePreview(input: {
  activeLayerName: string;
  activeTool: EditorToolName;
  brushMode: EditorBrushMode;
  hoveredTile: GridPoint | null;
  map: ParsedTilemap;
  toolSession: ActiveToolSession | null;
}) {
  if (isEditorObjectLayerName(input.activeLayerName)) {
    return [];
  }

  if (input.toolSession) {
    return buildBrushTiles(
      input.toolSession.session.brushMode,
      input.toolSession.session.anchorTile,
      input.toolSession.session.currentTile,
      {
        height: input.map.height,
        width: input.map.width,
      },
    );
  }

  return buildHoverPreview(input.activeTool, input.brushMode, input.hoveredTile, {
    height: input.map.height,
    width: input.map.width,
  });
}

function buildCollisionToggleCommand(input: {
  collisionPaintGid: number;
  layerName: string;
  mapDocument: EditorMapDocument;
  tiles: GridPoint[];
}) {
  const changes = input.tiles.flatMap((tile) => {
    const oldGid = readTileGid(input.mapDocument, input.layerName, tile) ?? 0;
    const newGid = oldGid > 0 ? 0 : input.collisionPaintGid;

    return oldGid === newGid
      ? []
      : [
          {
            newGid,
            oldGid,
            x: tile.x,
            y: tile.y,
          },
        ];
  });

  return changes.length > 0
    ? {
        kind: 'tile_paint' as const,
        layerName: input.layerName,
        tiles: changes,
      }
    : null;
}

export function buildToolCommand(input: {
  activeTool: EditorToolName;
  collisionPaintGid: number;
  layerName: string;
  mapDocument: EditorMapDocument;
  selectedGid: number;
  tiles: GridPoint[];
}) {
  if (input.activeTool === 'erase') {
    return buildEraseCommand({
      layerName: input.layerName,
      readTileGid: (layerName, point) => readTileGid(input.mapDocument, layerName, point),
      tiles: input.tiles,
    });
  }

  if (input.layerName === 'collision' && input.activeTool === 'paint') {
    return buildCollisionToggleCommand({
      collisionPaintGid: input.collisionPaintGid,
      layerName: input.layerName,
      mapDocument: input.mapDocument,
      tiles: input.tiles,
    });
  }

  return buildPaintCommand({
    layerName: input.layerName,
    readTileGid: (layerName, point) => readTileGid(input.mapDocument, layerName, point),
    targetGid: input.selectedGid,
    tiles: input.tiles,
  });
}

export function findDefaultSelectedGid(tilePalette: TilePaletteItem[]) {
  return tilePalette.find((item) => item.kind === 'road')?.gid ?? tilePalette[0]?.gid ?? 1;
}

export function getDefaultActiveLayerName(layerSummaries: EditorTileLayerSummary[]) {
  return (
    layerSummaries.find((layer) => layer.name === 'terrain')?.name ??
    layerSummaries[0]?.name ??
    'terrain'
  );
}

export function findCollisionPaintGid(document: EditorMapDocument) {
  const collisionLayer = document.layers.find(
    (layer) => layer.type === 'tilelayer' && layer.name === 'collision',
  );

  if (!collisionLayer || collisionLayer.type !== 'tilelayer') {
    return 5;
  }

  return [...collisionLayer.data].find((gid) => Number(gid) > 0) ?? 5;
}

export function buildSelection(
  layerName: EditorObjectLayerName,
  objectId: number,
): EditorSelection {
  return {
    kind: getSelectionKindForLayer(layerName),
    layerName,
    objectId,
  };
}

export function buildObjectLayerCommand(input: {
  afterDocument: EditorMapDocument;
  beforeDocument: EditorMapDocument;
  layerName: EditorObjectLayerName;
  selectionAfter: EditorSelection | null;
  selectionBefore: EditorSelection | null;
}): ObjectLayerSnapshotCommand {
  return {
    afterObjects: getObjectLayerRecords(input.afterDocument, input.layerName),
    beforeObjects: getObjectLayerRecords(input.beforeDocument, input.layerName),
    kind: 'object_layer_snapshot',
    layerName: input.layerName,
    selectionAfter: input.selectionAfter,
    selectionBefore: input.selectionBefore,
  };
}

function buildStructurePreview(input: {
  activeLayerName: string;
  activeTool: EditorToolName;
  hoveredTile: GridPoint | null;
  map: ParsedTilemap;
  objectDragSession: ObjectMoveSession | null;
  selectedStructureKind: MapStructureKind;
}) {
  if (input.objectDragSession?.layerName === 'structures') {
    const structure = findStructureByObjectId(
      input.map.structures,
      input.objectDragSession.objectId,
    );

    if (!structure) {
      return null;
    }

    const previewStructure = moveStructureToGrid(structure, input.objectDragSession.currentGrid);
    const conflictObjectIds = findStructureConflictIds(
      previewStructure,
      input.map.structures,
      structure.objectId,
    );
    const overlay = buildSingleStructureOverlay({
      displayTileSize: EDITOR_TILE_SIZE,
      mapTileSize: {
        height: input.map.tileHeight,
        width: input.map.tileWidth,
      },
      structure: previewStructure,
    });

    return overlay
      ? {
          conflictObjectIds,
          isValid: conflictObjectIds.length === 0,
          mode: 'move' as const,
          overlay,
        }
      : null;
  }

  if (
    input.activeLayerName !== 'structures' ||
    input.activeTool !== 'place' ||
    !input.hoveredTile
  ) {
    return null;
  }

  const previewStructure = buildPlacedStructure({
    gridPosition: input.hoveredTile,
    kind: input.selectedStructureKind,
    mapBounds: {
      height: input.map.height,
      width: input.map.width,
    },
    objectId: 0,
  });
  const conflictObjectIds = findStructureConflictIds(previewStructure, input.map.structures);
  const overlay = buildSingleStructureOverlay({
    displayTileSize: EDITOR_TILE_SIZE,
    mapTileSize: {
      height: input.map.tileHeight,
      width: input.map.tileWidth,
    },
    structure: previewStructure,
  });

  return overlay
    ? {
        conflictObjectIds,
        isValid: conflictObjectIds.length === 0,
        mode: 'place' as const,
        overlay,
      }
    : null;
}

function buildMarkerPreview(input: {
  activeLayerName: string;
  activeTool: EditorToolName;
  hoveredTile: GridPoint | null;
  map: ParsedTilemap;
  objectDragSession: ObjectMoveSession | null;
}) {
  if (input.objectDragSession && isMarkerLayerName(input.objectDragSession.layerName)) {
    const objects =
      input.objectDragSession.layerName === 'spawn_points'
        ? input.map.spawnPoints
        : input.map.regionMarkers;
    const object = findTilemapObjectById(objects, input.objectDragSession.objectId);

    if (!object) {
      return null;
    }

    const overlay = buildMarkerOverlay({
      displayTileSize: EDITOR_TILE_SIZE,
      layerName: input.objectDragSession.layerName,
      mapTileSize: {
        height: input.map.tileHeight,
        width: input.map.tileWidth,
      },
      object: moveTilemapObjectToGrid(object, input.objectDragSession.currentGrid, {
        height: input.map.tileHeight,
        width: input.map.tileWidth,
      }),
    });

    return {
      layerName: input.objectDragSession.layerName,
      mode: 'move' as const,
      overlay,
    };
  }

  if (
    input.activeTool !== 'place' ||
    !input.hoveredTile ||
    !isMarkerLayerName(input.activeLayerName)
  ) {
    return null;
  }

  const markerLayerName = input.activeLayerName;

  return {
    layerName: markerLayerName,
    mode: 'place' as const,
    overlay: buildMarkerOverlay({
      displayTileSize: EDITOR_TILE_SIZE,
      layerName: markerLayerName,
      mapTileSize: {
        height: input.map.tileHeight,
        width: input.map.tileWidth,
      },
      object: buildPlacedTilemapObject({
        gridPosition: input.hoveredTile,
        layerName: markerLayerName,
        objectId: 0,
        tileSize: {
          height: input.map.tileHeight,
          width: input.map.tileWidth,
        },
      }),
    }),
  };
}

export function resolvePreviews(input: {
  activeLayerName: string;
  activeTool: EditorToolName;
  brushMode: EditorBrushMode;
  hoveredTile: GridPoint | null;
  map: ParsedTilemap;
  objectDragSession: ObjectMoveSession | null;
  selectedStructureKind: MapStructureKind;
  toolSession: ActiveToolSession | null;
}) {
  return {
    markerPreview: buildMarkerPreview({
      activeLayerName: input.activeLayerName,
      activeTool: input.activeTool,
      hoveredTile: input.hoveredTile,
      map: input.map,
      objectDragSession: input.objectDragSession,
    }) satisfies MarkerPreviewState | null,
    previewTiles: buildTilePreview({
      activeLayerName: input.activeLayerName,
      activeTool: input.activeTool,
      brushMode: input.brushMode,
      hoveredTile: input.hoveredTile,
      map: input.map,
      toolSession: input.toolSession,
    }),
    structurePreview: buildStructurePreview({
      activeLayerName: input.activeLayerName,
      activeTool: input.activeTool,
      hoveredTile: input.hoveredTile,
      map: input.map,
      objectDragSession: input.objectDragSession,
      selectedStructureKind: input.selectedStructureKind,
    }) satisfies StructurePreviewState | null,
  };
}

export function getSelectionForHistoryCommand(
  command: TilePaintCommand | ObjectLayerSnapshotCommand,
  currentSelection: EditorSelection | null,
  direction: 'forward' | 'reverse',
) {
  if (command.kind !== 'object_layer_snapshot') {
    return currentSelection;
  }

  return direction === 'forward' ? command.selectionAfter : command.selectionBefore;
}

export function createObjectMoveSession(
  layerName: EditorObjectLayerName,
  object: ParsedMapStructure | TilemapObject,
  pointerTile: GridPoint,
): ObjectMoveSession {
  const gridX = 'objectId' in object ? object.gridX : object.gridX;
  const gridY = 'objectId' in object ? object.gridY : object.gridY;
  const objectId = 'objectId' in object ? object.objectId : object.id;

  return {
    currentGrid: {
      x: gridX,
      y: gridY,
    },
    layerName,
    objectId,
    offset: {
      x: pointerTile.x - gridX,
      y: pointerTile.y - gridY,
    },
    originalGrid: {
      x: gridX,
      y: gridY,
    },
  };
}

export function updateObjectMoveSession(input: {
  map: ParsedTilemap;
  pointerTile: GridPoint;
  session: ObjectMoveSession;
}) {
  if (input.session.layerName === 'structures') {
    const structure = findStructureByObjectId(input.map.structures, input.session.objectId);

    if (!structure) {
      return null;
    }

    const nextGrid = clampStructureGridPosition(
      {
        x: input.pointerTile.x - input.session.offset.x,
        y: input.pointerTile.y - input.session.offset.y,
      },
      structure.footprint,
      {
        height: input.map.height,
        width: input.map.width,
      },
    );

    return {
      ...input.session,
      currentGrid: nextGrid,
    };
  }

  const objects =
    input.session.layerName === 'spawn_points' ? input.map.spawnPoints : input.map.regionMarkers;
  const object = findTilemapObjectById(objects, input.session.objectId);

  if (!object) {
    return null;
  }

  const nextGrid = clampTilemapObjectGridPosition(
    {
      x: input.pointerTile.x - input.session.offset.x,
      y: input.pointerTile.y - input.session.offset.y,
    },
    object,
    {
      height: input.map.height,
      width: input.map.width,
    },
    {
      height: input.map.tileHeight,
      width: input.map.tileWidth,
    },
  );

  return {
    ...input.session,
    currentGrid: nextGrid,
  };
}

export function resolveRuntimeState(input: {
  activeLayerName: string;
  activeTool: EditorToolName;
  brushMode: EditorBrushMode;
  cameraState: CameraState;
  hoveredTile: GridPoint | null;
  mapDocument: EditorMapDocument;
  objectDragSession: ObjectMoveSession | null;
  overlayVisibility: OverlayVisibilityState;
  selectedStructureKind: MapStructureKind;
  toolSession: ActiveToolSession | null;
}) {
  const runtime = buildEditorRuntime(input.mapDocument, input.cameraState, input.overlayVisibility);
  const previews = resolvePreviews({
    activeLayerName: input.activeLayerName,
    activeTool: input.activeTool,
    brushMode: input.brushMode,
    hoveredTile: input.hoveredTile,
    map: runtime.map,
    objectDragSession: input.objectDragSession,
    selectedStructureKind: input.selectedStructureKind,
    toolSession: input.toolSession,
  });

  return {
    previews,
    runtime,
  };
}
