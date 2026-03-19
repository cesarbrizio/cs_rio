import { Camera } from '@engine/camera';
import { cartToIso } from '@engine/coordinates';
import { parseTilemap } from '@engine/tilemap-parser';
import { TilemapRenderer } from '@engine/tilemap-renderer';
import type {
  CameraState,
  GridPoint,
  ParsedMapStructure,
  ParsedTilemap,
  RenderPlan,
  Size,
  TileSize,
  TilemapObject,
} from '@engine/types';
import {
  getMapStructureDefinition,
  type MapStructureCategory,
} from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';
import { create } from 'zustand';

import zonaNorteMapJson from '../../../mobile/assets/maps/zona_norte.json';
import {
  buildMarkerOverlay,
  buildMarkerOverlays,
  findMarkerOverlayAtTile,
  isMarkerLayerName,
  type EditorMarkerOverlay,
} from '../objects/buildMarkerOverlays';
import {
  applyRegionMarkerDraft,
  applySpawnPointDraft,
  buildPlacedTilemapObject,
  buildRegionMarkerDraft,
  buildSpawnPointDraft,
  clampTilemapObjectGridPosition,
  deleteTilemapObjectAtId,
  findTilemapObjectById,
  moveTilemapObjectToGrid,
  replaceTilemapObject,
  type RegionMarkerDraft,
  type SpawnPointDraft,
} from '../objects/objectLayerEditing';
import { buildEraseCommand } from '../tools/EraseTool';
import { pickTileGid } from '../tools/EyedropperTool';
import { buildPlacedStructure } from '../tools/PlaceTool';
import { buildPaintCommand } from '../tools/PaintTool';
import {
  buildBrushTiles,
  buildHoverPreview,
  createToolSession,
  isTerrainContinuousTool,
  type EditorBrushMode,
  type EditorToolName,
  type ToolSession,
  updateToolSession,
} from '../tools/ToolManager';
import {
  applyHistoryCommand,
  applyTilePaintCommand,
  createEditorMapDocument,
  createParsedTilemapInput,
  getEditableTileLayerSummaries,
  getNextObjectId,
  getObjectLayerRecords,
  readTileGid,
  replaceStructures,
  replaceTilemapObjects,
  setLayerVisibility as setMapLayerVisibility,
  type EditorMapDocument,
  type EditorTileLayerSummary,
} from './editorMapDocument';
import {
  type EditorObjectLayerName,
  getSelectionKindForLayer,
  isEditorObjectLayerName,
  type EditorSelection,
} from './editorSelection';
import {
  EMPTY_HISTORY_STATE,
  mergeTileCommands,
  popRedoCommand,
  popUndoCommand,
  pushHistoryCommand,
  type HistoryState,
  type ObjectLayerSnapshotCommand,
  type TilePaintCommand,
} from './historyManager';
import { buildTilePalette, type TilePaletteItem } from './tilePalette';
import {
  buildTileClipboard,
  buildTileClipboardPasteCommand,
  type TileClipboardData,
  type TileRegionSelection,
} from './tileRegionClipboard';
import {
  applyStructureDraft as buildAppliedStructureDraft,
  buildStructurePropertyDraft,
  clampStructureGridPosition,
  cloneStructures,
  findStructureByObjectId,
  findStructureConflictIds,
  findStructureOverlayAtTile,
  moveStructureToGrid,
  removeStructureByObjectId,
  replaceStructure,
  STRUCTURE_CATEGORY_ORDER,
  type StructurePropertyDraft,
} from '../structures/structureEditing';
import {
  buildSingleStructureOverlay,
  buildStructureOverlays,
  type EditorStructureOverlay,
} from '../structures/buildStructureOverlays';

interface OverlayVisibilityState {
  collision: boolean;
  grid: boolean;
  regionMarkers: boolean;
  spawnPoints: boolean;
}

interface EditorRuntime {
  collisionOverlayTiles: GridPoint[];
  layerSummaries: EditorTileLayerSummary[];
  map: ParsedTilemap;
  regionMarkerOverlays: EditorMarkerOverlay[];
  renderPlan: RenderPlan;
  spawnPointOverlays: EditorMarkerOverlay[];
  structureOverlays: EditorStructureOverlay[];
}

interface ActiveToolSession {
  pendingCommand: TilePaintCommand | null;
  session: ToolSession;
}

interface ObjectMoveSession {
  currentGrid: GridPoint;
  layerName: EditorObjectLayerName;
  objectId: number;
  offset: GridPoint;
  originalGrid: GridPoint;
}

interface MarkerPreviewState {
  layerName: 'region_markers' | 'spawn_points';
  mode: 'move' | 'place';
  overlay: EditorMarkerOverlay;
}

interface StructurePreviewState {
  conflictObjectIds: number[];
  isValid: boolean;
  mode: 'move' | 'place';
  overlay: EditorStructureOverlay;
}

function isSameTile(left: GridPoint | null, right: GridPoint | null) {
  return left?.x === right?.x && left?.y === right?.y;
}

function getMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: TileSize) {
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

function isLayerVisible(document: EditorMapDocument, layerName: string) {
  return document.layers.find((layer) => layer.name === layerName)?.visible ?? true;
}

function isTileLayerActive(document: EditorMapDocument, layerName: string) {
  return document.layers.some(
    (layer) => layer.type === 'tilelayer' && layer.name === layerName,
  );
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

function buildEditorRuntime(
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

  return buildHoverPreview(
    input.activeTool,
    input.brushMode,
    input.hoveredTile,
    {
      height: input.map.height,
      width: input.map.width,
    },
  );
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

function buildToolCommand(input: {
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

function findDefaultSelectedGid(tilePalette: TilePaletteItem[]) {
  return tilePalette.find((item) => item.kind === 'road')?.gid ?? tilePalette[0]?.gid ?? 1;
}

function getDefaultActiveLayerName(layerSummaries: EditorTileLayerSummary[]) {
  return (
    layerSummaries.find((layer) => layer.name === 'terrain')?.name ??
    layerSummaries[0]?.name ??
    'terrain'
  );
}

function findCollisionPaintGid(document: EditorMapDocument) {
  const collisionLayer = document.layers.find(
    (layer) => layer.type === 'tilelayer' && layer.name === 'collision',
  );

  if (!collisionLayer || collisionLayer.type !== 'tilelayer') {
    return 5;
  }

  return [...collisionLayer.data].find((gid) => Number(gid) > 0) ?? 5;
}

function buildSelection(
  layerName: EditorObjectLayerName,
  objectId: number,
): EditorSelection {
  return {
    kind: getSelectionKindForLayer(layerName),
    layerName,
    objectId,
  };
}

function buildObjectLayerCommand(input: {
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

    const previewStructure = moveStructureToGrid(
      structure,
      input.objectDragSession.currentGrid,
    );
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
  const conflictObjectIds = findStructureConflictIds(
    previewStructure,
    input.map.structures,
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
  if (
    input.objectDragSession &&
    isMarkerLayerName(input.objectDragSession.layerName)
  ) {
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
      object: moveTilemapObjectToGrid(
        object,
        input.objectDragSession.currentGrid,
        {
          height: input.map.tileHeight,
          width: input.map.tileWidth,
        },
      ),
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

function resolvePreviews(input: {
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
    }),
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
    }),
  };
}

function getSelectionForHistoryCommand(
  command: TilePaintCommand | ObjectLayerSnapshotCommand,
  currentSelection: EditorSelection | null,
  direction: 'forward' | 'reverse',
) {
  if (command.kind !== 'object_layer_snapshot') {
    return currentSelection;
  }

  return direction === 'forward' ? command.selectionAfter : command.selectionBefore;
}

function createObjectMoveSession(
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

function updateObjectMoveSession(input: {
  map: ParsedTilemap;
  pointerTile: GridPoint;
  session: ObjectMoveSession;
}) {
  if (input.session.layerName === 'structures') {
    const structure = findStructureByObjectId(
      input.map.structures,
      input.session.objectId,
    );

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
    input.session.layerName === 'spawn_points'
      ? input.map.spawnPoints
      : input.map.regionMarkers;
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

function resolveRuntimeState(input: {
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
  const runtime = buildEditorRuntime(
    input.mapDocument,
    input.cameraState,
    input.overlayVisibility,
  );
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

function resetCameraForMap(map: ParsedTilemap) {
  const nextMapBounds = getMapWorldBounds(
    map.width,
    map.height,
    EDITOR_TILE_SIZE,
  );
  const nextCameraCenter = {
    x: (nextMapBounds.minX + nextMapBounds.maxX) / 2,
    y: (nextMapBounds.minY + nextMapBounds.maxY) / 2,
  };

  camera.setBounds(nextMapBounds);
  camera.zoomTo(initialCameraState.zoom);
  camera.panTo(nextCameraCenter);

  return camera.getState();
}

function focusCameraOnTile(tile: GridPoint) {
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

interface EditorStoreState {
  activeLayerName: string;
  activeStructureCategory: MapStructureCategory;
  activeTool: EditorToolName;
  applySelectedRegionMarkerProperties: (draft: RegionMarkerDraft) => boolean;
  applySelectedSpawnPointProperties: (draft: SpawnPointDraft) => boolean;
  applySelectedStructureProperties: (draft: StructurePropertyDraft) => boolean;
  beginToolInteraction: (tile: GridPoint) => void;
  brushMode: EditorBrushMode;
  camera: Camera;
  cameraState: CameraState;
  collisionOverlayTiles: GridPoint[];
  collisionPaintGid: number;
  copySelectedTileRegion: () => TileClipboardData | null;
  deleteSelectedObject: () => boolean;
  focusTile: (tile: GridPoint) => void;
  hoveredTile: GridPoint | null;
  history: HistoryState;
  layerSummaries: EditorTileLayerSummary[];
  loadMapFromRaw: (rawMap: Record<string, unknown>, options?: { mapName?: string }) => void;
  map: ParsedTilemap;
  mapDocument: EditorMapDocument;
  mapName: string;
  markerPreview: MarkerPreviewState | null;
  objectDragSession: ObjectMoveSession | null;
  overlayVisibility: OverlayVisibilityState;
  previewTiles: GridPoint[];
  redo: () => void;
  regionMarkerOverlays: EditorMarkerOverlay[];
  renderPlan: RenderPlan;
  renderer: TilemapRenderer;
  pasteTileClipboard: (tile: GridPoint) => TilePaintCommand | null;
  selectedGid: number;
  selectedSelection: EditorSelection | null;
  selectedStructureKind: MapStructureKind;
  setActiveLayerName: (layerName: string) => void;
  setActiveStructureCategory: (category: MapStructureCategory) => void;
  setActiveTool: (tool: EditorToolName) => void;
  setBrushMode: (brushMode: EditorBrushMode) => void;
  setHoveredTile: (hoveredTile: GridPoint | null) => void;
  setLayerVisibility: (layerName: string, visible: boolean) => void;
  setOverlayVisibility: (
    overlayName: keyof OverlayVisibilityState,
    visible: boolean,
  ) => void;
  setSelectedGid: (gid: number) => void;
  setSelectedSelection: (selection: EditorSelection | null) => void;
  setSelectedStructureKind: (kind: MapStructureKind) => void;
  setViewport: (size: Size) => void;
  spawnPointOverlays: EditorMarkerOverlay[];
  structureOverlays: EditorStructureOverlay[];
  structurePreview: StructurePreviewState | null;
  syncCameraState: (cameraState: CameraState) => void;
  tileClipboard: TileClipboardData | null;
  tilePalette: TilePaletteItem[];
  tileRegionSelection: TileRegionSelection | null;
  tileSize: TileSize;
  toolSession: ActiveToolSession | null;
  undo: () => void;
  updateToolInteraction: (tile: GridPoint) => void;
  zoomByStep: (direction: 'in' | 'out') => void;
}

const EDITOR_TILE_SIZE: TileSize = {
  height: 4,
  width: 8,
};

const mapName = 'Zona Norte';
const initialMapDocument = createEditorMapDocument(
  zonaNorteMapJson as Record<string, unknown>,
);
const initialParsedMap = parseTilemap(createParsedTilemapInput(initialMapDocument));
const initialTilePalette = buildTilePalette(initialParsedMap);
const mapBounds = getMapWorldBounds(
  initialParsedMap.width,
  initialParsedMap.height,
  EDITOR_TILE_SIZE,
);
const renderer = new TilemapRenderer(EDITOR_TILE_SIZE);
const initialCameraState: CameraState = {
  mode: 'free',
  viewportHeight: 720,
  viewportWidth: 1280,
  x: (mapBounds.minX + mapBounds.maxX) / 2,
  y: (mapBounds.minY + mapBounds.maxY) / 2,
  zoom: 0.72,
};
const initialOverlayVisibility: OverlayVisibilityState = {
  collision: true,
  grid: false,
  regionMarkers: true,
  spawnPoints: true,
};
const camera = new Camera(initialCameraState, mapBounds);
const initialRuntime = buildEditorRuntime(
  initialMapDocument,
  camera.getState(),
  initialOverlayVisibility,
);
const initialSelectedStructureKind = 'boca' as MapStructureKind;
const initialCollisionPaintGid = findCollisionPaintGid(initialMapDocument);
const initialActiveLayerName = getDefaultActiveLayerName(initialRuntime.layerSummaries);

export const useEditorStore = create<EditorStoreState>((set) => ({
  activeLayerName: initialActiveLayerName,
  activeStructureCategory: getMapStructureDefinition(initialSelectedStructureKind).category,
  activeTool: 'paint',
  applySelectedRegionMarkerProperties: (draft) => {
    let applied = false;

    set((state) => {
      if (state.selectedSelection?.layerName !== 'region_markers') {
        return state;
      }

      const currentObject = findTilemapObjectById(
        state.map.regionMarkers,
        state.selectedSelection.objectId,
      );

      if (!currentObject) {
        return state;
      }

      const nextObject = applyRegionMarkerDraft(currentObject, draft);
      const nextObjects = replaceTilemapObject(state.map.regionMarkers, nextObject);
      const nextMapDocument = replaceTilemapObjects(
        state.mapDocument,
        'region_markers',
        nextObjects,
      );
      const command = buildObjectLayerCommand({
        afterDocument: nextMapDocument,
        beforeDocument: state.mapDocument,
        layerName: 'region_markers',
        selectionAfter: state.selectedSelection,
        selectionBefore: state.selectedSelection,
      });
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      applied = true;

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    });

    return applied;
  },
  applySelectedSpawnPointProperties: (draft) => {
    let applied = false;

    set((state) => {
      if (state.selectedSelection?.layerName !== 'spawn_points') {
        return state;
      }

      const currentObject = findTilemapObjectById(
        state.map.spawnPoints,
        state.selectedSelection.objectId,
      );

      if (!currentObject) {
        return state;
      }

      const nextObject = applySpawnPointDraft(currentObject, draft);
      const nextObjects = replaceTilemapObject(state.map.spawnPoints, nextObject);
      const nextMapDocument = replaceTilemapObjects(
        state.mapDocument,
        'spawn_points',
        nextObjects,
      );
      const command = buildObjectLayerCommand({
        afterDocument: nextMapDocument,
        beforeDocument: state.mapDocument,
        layerName: 'spawn_points',
        selectionAfter: state.selectedSelection,
        selectionBefore: state.selectedSelection,
      });
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      applied = true;

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    });

    return applied;
  },
  applySelectedStructureProperties: (draft) => {
    let applied = false;

    set((state) => {
      if (state.selectedSelection?.layerName !== 'structures') {
        return state;
      }

      const currentStructure = findStructureByObjectId(
        state.map.structures,
        state.selectedSelection.objectId,
      );

      if (!currentStructure) {
        return state;
      }

      const nextStructure = buildAppliedStructureDraft(currentStructure, draft);
      const clampedPosition = clampStructureGridPosition(
        {
          x: nextStructure.gridX,
          y: nextStructure.gridY,
        },
        nextStructure.footprint,
        {
          height: state.map.height,
          width: state.map.width,
        },
      );
      const normalizedStructure = moveStructureToGrid(nextStructure, clampedPosition);
      const conflictObjectIds = findStructureConflictIds(
        normalizedStructure,
        state.map.structures,
        currentStructure.objectId,
      );

      if (conflictObjectIds.length > 0) {
        return state;
      }

      const nextStructures = replaceStructure(state.map.structures, normalizedStructure);
      const nextMapDocument = replaceStructures(state.mapDocument, nextStructures);
      const selection = buildSelection('structures', normalizedStructure.objectId);
      const command = buildObjectLayerCommand({
        afterDocument: nextMapDocument,
        beforeDocument: state.mapDocument,
        layerName: 'structures',
        selectionAfter: selection,
        selectionBefore: state.selectedSelection,
      });
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: normalizedStructure.kind as MapStructureKind,
        toolSession: state.toolSession,
      });

      applied = true;

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedSelection: selection,
        selectedStructureKind: normalizedStructure.kind as MapStructureKind,
        structurePreview: previews.structurePreview,
      };
    });

    return applied;
  },
  beginToolInteraction: (tile) =>
    set((state) => {
      const activeLayerIsTileLayer = isTileLayerActive(
        state.mapDocument,
        state.activeLayerName,
      );

      if (state.activeTool === 'select' && activeLayerIsTileLayer) {
        return {
          markerPreview: null,
          objectDragSession: null,
          previewTiles: [],
          selectedSelection: null,
          structurePreview: null,
          tileRegionSelection: {
            current: tile,
            layerName: state.activeLayerName,
            start: tile,
          },
          toolSession: null,
        };
      }

      if (state.activeTool === 'eyedropper' && activeLayerIsTileLayer) {
        const sampledGid = pickTileGid({
          layerName: state.activeLayerName,
          point: tile,
          readTileGid: (layerName, point) => readTileGid(state.mapDocument, layerName, point),
        });

        return sampledGid ? { selectedGid: sampledGid } : state;
      }

      if (state.activeTool === 'place' && state.activeLayerName === 'structures') {
        const nextStructure = buildPlacedStructure({
          gridPosition: tile,
          kind: state.selectedStructureKind,
          mapBounds: {
            height: state.map.height,
            width: state.map.width,
          },
          objectId: getNextObjectId(state.mapDocument),
        });

        const nextStructures = [...cloneStructures(state.map.structures), nextStructure];
        const nextMapDocument = replaceStructures(state.mapDocument, nextStructures);
        const selection = buildSelection('structures', nextStructure.objectId);
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: 'structures',
          selectionAfter: selection,
          selectionBefore: state.selectedSelection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: state.toolSession,
        });

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: selection,
          structurePreview: previews.structurePreview,
        };
      }

      if (
        state.activeTool === 'place' &&
        isMarkerLayerName(state.activeLayerName)
      ) {
        const markerLayerName = state.activeLayerName;
        const nextObject = buildPlacedTilemapObject({
          gridPosition: tile,
          layerName: markerLayerName,
          objectId: getNextObjectId(state.mapDocument),
          tileSize: {
            height: state.map.tileHeight,
            width: state.map.tileWidth,
          },
        });
        const objects =
          state.activeLayerName === 'spawn_points'
            ? state.map.spawnPoints
            : state.map.regionMarkers;
        const nextObjects = [...objects, nextObject];
        const nextMapDocument = replaceTilemapObjects(
          state.mapDocument,
          markerLayerName,
          nextObjects,
        );
        const selection = buildSelection(markerLayerName, nextObject.id);
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: markerLayerName,
          selectionAfter: selection,
          selectionBefore: state.selectedSelection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: state.toolSession,
        });

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: selection,
          structurePreview: previews.structurePreview,
        };
      }

      if (state.activeTool === 'delete' && state.activeLayerName === 'structures') {
        const targetOverlay = findStructureOverlayAtTile(state.structureOverlays, tile);

        if (!targetOverlay) {
          return {
            markerPreview: null,
            objectDragSession: null,
            selectedSelection: null,
            structurePreview: null,
          };
        }

        const nextStructures = removeStructureByObjectId(
          state.map.structures,
          targetOverlay.objectId,
        );
        const nextMapDocument = replaceStructures(state.mapDocument, nextStructures);
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: 'structures',
          selectionAfter: null,
          selectionBefore: state.selectedSelection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: state.toolSession,
        });

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: null,
          structurePreview: previews.structurePreview,
        };
      }

      if (
        state.activeTool === 'delete' &&
        isMarkerLayerName(state.activeLayerName)
      ) {
        const markerLayerName = state.activeLayerName;
        const overlays =
          markerLayerName === 'spawn_points'
            ? state.spawnPointOverlays
            : state.regionMarkerOverlays;
        const targetOverlay = findMarkerOverlayAtTile(overlays, tile);

        if (!targetOverlay) {
          return {
            markerPreview: null,
            objectDragSession: null,
            selectedSelection: null,
            structurePreview: null,
          };
        }

        const objects =
          markerLayerName === 'spawn_points'
            ? state.map.spawnPoints
            : state.map.regionMarkers;
        const nextObjects = deleteTilemapObjectAtId(objects, targetOverlay.objectId);
        const nextMapDocument = replaceTilemapObjects(
          state.mapDocument,
          markerLayerName,
          nextObjects,
        );
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: markerLayerName,
          selectionAfter: null,
          selectionBefore: state.selectedSelection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: state.toolSession,
        });

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: null,
          structurePreview: previews.structurePreview,
        };
      }

      if (state.activeTool === 'select' && state.activeLayerName === 'structures') {
        const targetOverlay = findStructureOverlayAtTile(state.structureOverlays, tile);

        if (!targetOverlay) {
          return {
            markerPreview: null,
            objectDragSession: null,
            selectedSelection: null,
            structurePreview: null,
          };
        }

        const targetStructure = findStructureByObjectId(
          state.map.structures,
          targetOverlay.objectId,
        );

        if (!targetStructure) {
          return state;
        }

        const objectDragSession = createObjectMoveSession(
          'structures',
          targetStructure,
          tile,
        );
        const selection = buildSelection('structures', targetStructure.objectId);
        const previews = resolvePreviews({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          hoveredTile: state.hoveredTile,
          map: state.map,
          objectDragSession,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          markerPreview: previews.markerPreview,
          objectDragSession,
          previewTiles: previews.previewTiles,
          selectedSelection: selection,
          structurePreview: previews.structurePreview,
          toolSession: null,
        };
      }

      if (
        state.activeTool === 'select' &&
        isMarkerLayerName(state.activeLayerName)
      ) {
        const markerLayerName = state.activeLayerName;
        const overlays =
          markerLayerName === 'spawn_points'
            ? state.spawnPointOverlays
            : state.regionMarkerOverlays;
        const targetOverlay = findMarkerOverlayAtTile(overlays, tile);

        if (!targetOverlay) {
          return {
            markerPreview: null,
            objectDragSession: null,
            selectedSelection: null,
            structurePreview: null,
          };
        }

        const objects =
          markerLayerName === 'spawn_points'
            ? state.map.spawnPoints
            : state.map.regionMarkers;
        const targetObject = findTilemapObjectById(objects, targetOverlay.objectId);

        if (!targetObject) {
          return state;
        }

        const objectDragSession = createObjectMoveSession(
          markerLayerName,
          targetObject,
          tile,
        );
        const selection = buildSelection(markerLayerName, targetObject.id);
        const previews = resolvePreviews({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          hoveredTile: state.hoveredTile,
          map: state.map,
          objectDragSession,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          markerPreview: previews.markerPreview,
          objectDragSession,
          previewTiles: previews.previewTiles,
          selectedSelection: selection,
          structurePreview: previews.structurePreview,
          toolSession: null,
        };
      }

      if (!activeLayerIsTileLayer || !isTerrainContinuousTool(state.activeTool)) {
        return state;
      }

      const session = createToolSession({
        activeLayerName: state.activeLayerName,
        brushMode: state.brushMode,
        tile,
        tool: state.activeTool,
      });
      const previewTiles = buildBrushTiles(
        session.brushMode,
        session.anchorTile,
        session.currentTile,
        {
          height: state.map.height,
          width: state.map.width,
        },
      );

      if (session.mode === 'deferred') {
        return {
          markerPreview: null,
          objectDragSession: null,
          previewTiles,
          structurePreview: null,
          toolSession: {
            pendingCommand: null,
            session,
          },
        };
      }

      const command = buildToolCommand({
        activeTool: state.activeTool,
        collisionPaintGid: state.collisionPaintGid,
        layerName: session.activeLayerName,
        mapDocument: state.mapDocument,
        selectedGid: state.selectedGid,
        tiles: previewTiles,
      });
      const nextMapDocument = command
        ? applyTilePaintCommand(state.mapDocument, command)
        : state.mapDocument;

      if (nextMapDocument === state.mapDocument) {
        return {
          markerPreview: null,
          objectDragSession: null,
          previewTiles,
          structurePreview: null,
          toolSession: {
            pendingCommand: command,
            session,
          },
        };
      }

      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: {
          pendingCommand: command,
          session,
        },
      });

      return {
        ...runtime,
        collisionPaintGid:
          state.activeLayerName === 'collision'
            ? state.collisionPaintGid
            : findCollisionPaintGid(nextMapDocument),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        toolSession: {
          pendingCommand: command,
          session,
        },
      };
    }),
  brushMode: 'brush_1',
  camera,
  cameraState: camera.getState(),
  collisionOverlayTiles: initialRuntime.collisionOverlayTiles,
  collisionPaintGid: initialCollisionPaintGid,
  copySelectedTileRegion: () => {
    let clipboard: TileClipboardData | null = null;

    set((state) => {
      if (!state.tileRegionSelection) {
        return state;
      }

      clipboard = buildTileClipboard(state.mapDocument, state.tileRegionSelection);

      return clipboard
        ? {
            tileClipboard: clipboard,
          }
        : state;
    });

    return clipboard;
  },
  deleteSelectedObject: () => {
    let deleted = false;

    set((state) => {
      const selection = state.selectedSelection;

      if (!selection) {
        return state;
      }

      if (selection.layerName === 'structures') {
        const nextStructures = removeStructureByObjectId(
          state.map.structures,
          selection.objectId,
        );

        if (nextStructures.length === state.map.structures.length) {
          return state;
        }

        const nextMapDocument = replaceStructures(state.mapDocument, nextStructures);
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: 'structures',
          selectionAfter: null,
          selectionBefore: selection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: state.toolSession,
        });

        deleted = true;

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: null,
          structurePreview: previews.structurePreview,
        };
      }

      const objects =
        selection.layerName === 'spawn_points'
          ? state.map.spawnPoints
          : state.map.regionMarkers;
      const nextObjects = deleteTilemapObjectAtId(objects, selection.objectId);

      if (nextObjects.length === objects.length) {
        return state;
      }

      const nextMapDocument = replaceTilemapObjects(
        state.mapDocument,
        selection.layerName,
        nextObjects,
      );
      const command = buildObjectLayerCommand({
        afterDocument: nextMapDocument,
        beforeDocument: state.mapDocument,
        layerName: selection.layerName,
        selectionAfter: null,
        selectionBefore: selection,
      });
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      deleted = true;

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedSelection: null,
        structurePreview: previews.structurePreview,
      };
    });

    return deleted;
  },
  focusTile: (tile) =>
    set((state) => {
      const nextCameraState = focusCameraOnTile(tile);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: nextCameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: state.mapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        cameraState: nextCameraState,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  hoveredTile: null,
  history: EMPTY_HISTORY_STATE,
  layerSummaries: initialRuntime.layerSummaries,
  loadMapFromRaw: (rawMap, options) =>
    set((state) => {
      const nextMapDocument = createEditorMapDocument(rawMap);
      const nextLayerSummaries = getEditableTileLayerSummaries(nextMapDocument);
      const activeLayerName = getDefaultActiveLayerName(nextLayerSummaries);
      const nextParsedMap = parseTilemap(createParsedTilemapInput(nextMapDocument));
      const nextTilePalette = buildTilePalette(nextParsedMap);
      const nextCameraState = resetCameraForMap(nextParsedMap);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName,
        activeTool: 'paint',
        brushMode: state.brushMode,
        cameraState: nextCameraState,
        hoveredTile: null,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        activeLayerName,
        activeTool: 'paint' as const,
        cameraState: nextCameraState,
        collisionPaintGid: findCollisionPaintGid(nextMapDocument),
        history: EMPTY_HISTORY_STATE,
        hoveredTile: null,
        mapDocument: nextMapDocument,
        mapName: options?.mapName ?? state.mapName,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedGid: findDefaultSelectedGid(nextTilePalette),
        selectedSelection: null,
        structurePreview: previews.structurePreview,
        tileClipboard: null,
        tilePalette: nextTilePalette,
        tileRegionSelection: null,
        toolSession: null,
      };
    }),
  map: initialRuntime.map,
  mapDocument: initialMapDocument,
  mapName,
  markerPreview: null,
  objectDragSession: null,
  overlayVisibility: initialOverlayVisibility,
  pasteTileClipboard: (tile) => {
    let command: TilePaintCommand | null = null;

    set((state) => {
      if (
        !state.tileClipboard ||
        !isTileLayerActive(state.mapDocument, state.activeLayerName)
      ) {
        return state;
      }

      command = buildTileClipboardPasteCommand({
        anchor: tile,
        clipboard: state.tileClipboard,
        document: state.mapDocument,
        layerName: state.activeLayerName,
        mapBounds: {
          height: state.map.height,
          width: state.map.width,
        },
      });

      if (!command) {
        return state;
      }

      const nextMapDocument = applyTilePaintCommand(state.mapDocument, command);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    });

    return command;
  },
  previewTiles: [],
  redo: () =>
    set((state) => {
      const { command, history } = popRedoCommand(state.history);

      if (!command) {
        return state;
      }

      const nextMapDocument = applyHistoryCommand(state.mapDocument, command);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        collisionPaintGid: findCollisionPaintGid(nextMapDocument),
        history,
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedSelection: getSelectionForHistoryCommand(
          command,
          state.selectedSelection,
          'forward',
        ),
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    }),
  regionMarkerOverlays: initialRuntime.regionMarkerOverlays,
  renderPlan: initialRuntime.renderPlan,
  renderer,
  selectedGid: findDefaultSelectedGid(initialTilePalette),
  selectedSelection: null,
  selectedStructureKind: initialSelectedStructureKind,
  setActiveLayerName: (activeLayerName) =>
    set((state) => {
      const layerExists = state.layerSummaries.some((layer) => layer.name === activeLayerName);

      if (!layerExists && !isEditorObjectLayerName(activeLayerName)) {
        return state;
      }

      const previews = resolvePreviews({
        activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        hoveredTile: state.hoveredTile,
        map: state.map,
        objectDragSession: null,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        activeLayerName,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        tileRegionSelection:
          state.tileRegionSelection?.layerName === activeLayerName
            ? state.tileRegionSelection
            : null,
        toolSession: null,
      };
    }),
  setActiveStructureCategory: (activeStructureCategory) => set({ activeStructureCategory }),
  setActiveTool: (activeTool) =>
    set((state) => {
      const previews = resolvePreviews({
        activeLayerName: state.activeLayerName,
        activeTool,
        brushMode: state.brushMode,
        hoveredTile: state.hoveredTile,
        map: state.map,
        objectDragSession: null,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        activeTool,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    }),
  setBrushMode: (brushMode) =>
    set((state) => {
      const previews = resolvePreviews({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode,
        hoveredTile: state.hoveredTile,
        map: state.map,
        objectDragSession: state.objectDragSession,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        brushMode,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  setHoveredTile: (hoveredTile) =>
    set((state) => {
      if (
        state.hoveredTile?.x === hoveredTile?.x &&
        state.hoveredTile?.y === hoveredTile?.y
      ) {
        return state;
      }

      const previews = resolvePreviews({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        hoveredTile,
        map: state.map,
        objectDragSession: state.objectDragSession,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        hoveredTile,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  setLayerVisibility: (layerName, visible) =>
    set((state) => {
      const nextMapDocument = setMapLayerVisibility(state.mapDocument, layerName, visible);

      if (nextMapDocument === state.mapDocument) {
        return state;
      }

      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  setOverlayVisibility: (overlayName, visible) =>
    set((state) => {
      if (state.overlayVisibility[overlayName] === visible) {
        return state;
      }

      const overlayVisibility = {
        ...state.overlayVisibility,
        [overlayName]: visible,
      };
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: state.mapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        markerPreview: previews.markerPreview,
        overlayVisibility,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  setSelectedGid: (selectedGid) => set({ selectedGid }),
  setSelectedSelection: (selectedSelection) => set({ selectedSelection }),
  setSelectedStructureKind: (selectedStructureKind) =>
    set((state) => {
      const previews = resolvePreviews({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        hoveredTile: state.hoveredTile,
        map: state.map,
        objectDragSession: state.objectDragSession,
        selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        activeStructureCategory: getMapStructureDefinition(selectedStructureKind).category,
        selectedStructureKind,
        structurePreview: previews.structurePreview,
      };
    }),
  setViewport: (size) =>
    set((state) => {
      const nextCameraState = camera.setViewport(size);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: nextCameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: state.mapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        cameraState: nextCameraState,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  spawnPointOverlays: initialRuntime.spawnPointOverlays,
  structureOverlays: initialRuntime.structureOverlays,
  structurePreview: null,
  syncCameraState: (cameraState) =>
    set((state) => {
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: state.mapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        cameraState,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
  tileClipboard: null,
  tilePalette: initialTilePalette,
  tileRegionSelection: null,
  tileSize: EDITOR_TILE_SIZE,
  toolSession: null,
  undo: () =>
    set((state) => {
      const { command, history } = popUndoCommand(state.history);

      if (!command) {
        return state;
      }

      const nextMapDocument = applyHistoryCommand(
        state.mapDocument,
        command,
        'reverse',
      );
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        collisionPaintGid: findCollisionPaintGid(nextMapDocument),
        history,
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedSelection: getSelectionForHistoryCommand(
          command,
          state.selectedSelection,
          'reverse',
        ),
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    }),
  updateToolInteraction: (tile) =>
    set((state) => {
      if (state.objectDragSession) {
        const nextObjectDragSession = updateObjectMoveSession({
          map: state.map,
          pointerTile: tile,
          session: state.objectDragSession,
        });

        if (!nextObjectDragSession) {
          return {
            markerPreview: null,
            objectDragSession: null,
            structurePreview: null,
          };
        }

        const previews = resolvePreviews({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          hoveredTile: state.hoveredTile,
          map: state.map,
          objectDragSession: nextObjectDragSession,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          markerPreview: previews.markerPreview,
          objectDragSession: nextObjectDragSession,
          previewTiles: previews.previewTiles,
          structurePreview: previews.structurePreview,
        };
      }

      if (!state.toolSession) {
        if (
          state.activeTool === 'select' &&
          state.tileRegionSelection &&
          state.tileRegionSelection.layerName === state.activeLayerName &&
          isTileLayerActive(state.mapDocument, state.activeLayerName)
        ) {
          if (isSameTile(state.tileRegionSelection.current, tile)) {
            return state;
          }

          return {
            tileRegionSelection: {
              ...state.tileRegionSelection,
              current: tile,
            },
          };
        }

        return state;
      }

      const nextSession = updateToolSession(state.toolSession.session, tile);
      const previewTiles = buildBrushTiles(
        nextSession.brushMode,
        nextSession.anchorTile,
        nextSession.currentTile,
        {
          height: state.map.height,
          width: state.map.width,
        },
      );

      if (nextSession.mode === 'deferred') {
        return {
          previewTiles,
          toolSession: {
            ...state.toolSession,
            session: nextSession,
          },
        };
      }

      const command = buildToolCommand({
        activeTool: state.activeTool,
        collisionPaintGid: state.collisionPaintGid,
        layerName: nextSession.activeLayerName,
        mapDocument: state.mapDocument,
        selectedGid: state.selectedGid,
        tiles: previewTiles,
      });
      const nextMapDocument = command
        ? applyTilePaintCommand(state.mapDocument, command)
        : state.mapDocument;
      const pendingCommand = mergeTileCommands(
        state.toolSession.pendingCommand,
        command,
      );

      if (nextMapDocument === state.mapDocument) {
        return {
          previewTiles,
          toolSession: {
            pendingCommand,
            session: nextSession,
          },
        };
      }

      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: {
          pendingCommand,
          session: nextSession,
        },
      });

      return {
        ...runtime,
        collisionPaintGid:
          nextSession.activeLayerName === 'collision'
            ? state.collisionPaintGid
            : findCollisionPaintGid(nextMapDocument),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        toolSession: {
          pendingCommand,
          session: nextSession,
        },
      };
    }),
  zoomByStep: (direction) =>
    set((state) => {
      const nextCameraState = camera.zoomBy(direction === 'in' ? 1.12 : 0.88);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: nextCameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: state.mapDocument,
        objectDragSession: state.objectDragSession,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: state.toolSession,
      });

      return {
        ...runtime,
        cameraState: nextCameraState,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
      };
    }),
}));

export function finishToolInteraction(tile: GridPoint) {
  useEditorStore.setState((state) => {
    if (
      state.activeTool === 'select' &&
      state.tileRegionSelection &&
      state.tileRegionSelection.layerName === state.activeLayerName &&
      isTileLayerActive(state.mapDocument, state.activeLayerName)
    ) {
      return {
        tileRegionSelection: {
          ...state.tileRegionSelection,
          current: tile,
        },
        toolSession: null,
      };
    }

    if (state.objectDragSession) {
      const nextObjectDragSession = updateObjectMoveSession({
        map: state.map,
        pointerTile: tile,
        session: state.objectDragSession,
      });

      if (!nextObjectDragSession) {
        return {
          markerPreview: null,
          objectDragSession: null,
          structurePreview: null,
        };
      }

      if (
        nextObjectDragSession.currentGrid.x === nextObjectDragSession.originalGrid.x &&
        nextObjectDragSession.currentGrid.y === nextObjectDragSession.originalGrid.y
      ) {
        const previews = resolvePreviews({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          hoveredTile: state.hoveredTile,
          map: state.map,
          objectDragSession: null,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          structurePreview: previews.structurePreview,
          toolSession: null,
        };
      }

      if (nextObjectDragSession.layerName === 'structures') {
        const currentStructure = findStructureByObjectId(
          state.map.structures,
          nextObjectDragSession.objectId,
        );

        if (!currentStructure) {
          return {
            markerPreview: null,
            objectDragSession: null,
            structurePreview: null,
          };
        }

        const movedStructure = moveStructureToGrid(
          currentStructure,
          nextObjectDragSession.currentGrid,
        );
        const conflictObjectIds = findStructureConflictIds(
          movedStructure,
          state.map.structures,
          currentStructure.objectId,
        );

        if (conflictObjectIds.length > 0) {
          const previews = resolvePreviews({
            activeLayerName: state.activeLayerName,
            activeTool: state.activeTool,
            brushMode: state.brushMode,
            hoveredTile: state.hoveredTile,
            map: state.map,
            objectDragSession: null,
            selectedStructureKind: state.selectedStructureKind,
            toolSession: null,
          });

          return {
            markerPreview: previews.markerPreview,
            objectDragSession: null,
            previewTiles: previews.previewTiles,
            structurePreview: previews.structurePreview,
            toolSession: null,
          };
        }

        const nextStructures = replaceStructure(state.map.structures, movedStructure);
        const nextMapDocument = replaceStructures(state.mapDocument, nextStructures);
        const selection = buildSelection('structures', movedStructure.objectId);
        const command = buildObjectLayerCommand({
          afterDocument: nextMapDocument,
          beforeDocument: state.mapDocument,
          layerName: 'structures',
          selectionAfter: selection,
          selectionBefore: state.selectedSelection,
        });
        const { previews, runtime } = resolveRuntimeState({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          cameraState: state.cameraState,
          hoveredTile: state.hoveredTile,
          mapDocument: nextMapDocument,
          objectDragSession: null,
          overlayVisibility: state.overlayVisibility,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          ...runtime,
          history: pushHistoryCommand(state.history, command),
          mapDocument: nextMapDocument,
          markerPreview: previews.markerPreview,
          objectDragSession: null,
          previewTiles: previews.previewTiles,
          selectedSelection: selection,
          structurePreview: previews.structurePreview,
          toolSession: null,
        };
      }

      const objects =
        nextObjectDragSession.layerName === 'spawn_points'
          ? state.map.spawnPoints
          : state.map.regionMarkers;
      const currentObject = findTilemapObjectById(
        objects,
        nextObjectDragSession.objectId,
      );

      if (!currentObject) {
        return {
          markerPreview: null,
          objectDragSession: null,
          structurePreview: null,
        };
      }

      const movedObject = moveTilemapObjectToGrid(
        currentObject,
        nextObjectDragSession.currentGrid,
        {
          height: state.map.tileHeight,
          width: state.map.tileWidth,
        },
      );
      const nextObjects = replaceTilemapObject(objects, movedObject);
      const nextMapDocument = replaceTilemapObjects(
        state.mapDocument,
        nextObjectDragSession.layerName,
        nextObjects,
      );
      const selection = buildSelection(
        nextObjectDragSession.layerName,
        movedObject.id,
      );
      const command = buildObjectLayerCommand({
        afterDocument: nextMapDocument,
        beforeDocument: state.mapDocument,
        layerName: nextObjectDragSession.layerName,
        selectionAfter: selection,
        selectionBefore: state.selectedSelection,
      });
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        objectDragSession: null,
        previewTiles: previews.previewTiles,
        selectedSelection: selection,
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    }

    if (!state.toolSession) {
      return state;
    }

    const nextSession = updateToolSession(state.toolSession.session, tile);
    const previewTiles = buildBrushTiles(
      nextSession.brushMode,
      nextSession.anchorTile,
      nextSession.currentTile,
      {
        height: state.map.height,
        width: state.map.width,
      },
    );

    if (nextSession.mode === 'deferred') {
      const command = buildToolCommand({
        activeTool: state.activeTool,
        collisionPaintGid: state.collisionPaintGid,
        layerName: nextSession.activeLayerName,
        mapDocument: state.mapDocument,
        selectedGid: state.selectedGid,
        tiles: previewTiles,
      });

      if (!command) {
        const previews = resolvePreviews({
          activeLayerName: state.activeLayerName,
          activeTool: state.activeTool,
          brushMode: state.brushMode,
          hoveredTile: state.hoveredTile,
          map: state.map,
          objectDragSession: null,
          selectedStructureKind: state.selectedStructureKind,
          toolSession: null,
        });

        return {
          markerPreview: previews.markerPreview,
          previewTiles: previews.previewTiles,
          structurePreview: previews.structurePreview,
          toolSession: null,
        };
      }

      const nextMapDocument = applyTilePaintCommand(state.mapDocument, command);
      const { previews, runtime } = resolveRuntimeState({
        activeLayerName: state.activeLayerName,
        activeTool: state.activeTool,
        brushMode: state.brushMode,
        cameraState: state.cameraState,
        hoveredTile: state.hoveredTile,
        mapDocument: nextMapDocument,
        objectDragSession: null,
        overlayVisibility: state.overlayVisibility,
        selectedStructureKind: state.selectedStructureKind,
        toolSession: null,
      });

      return {
        ...runtime,
        collisionPaintGid:
          nextSession.activeLayerName === 'collision'
            ? state.collisionPaintGid
            : findCollisionPaintGid(nextMapDocument),
        history: pushHistoryCommand(state.history, command),
        mapDocument: nextMapDocument,
        markerPreview: previews.markerPreview,
        previewTiles: previews.previewTiles,
        structurePreview: previews.structurePreview,
        toolSession: null,
      };
    }

    const previews = resolvePreviews({
      activeLayerName: state.activeLayerName,
      activeTool: state.activeTool,
      brushMode: state.brushMode,
      hoveredTile: state.hoveredTile,
      map: state.map,
      objectDragSession: null,
      selectedStructureKind: state.selectedStructureKind,
      toolSession: null,
    });

    return {
      history: state.toolSession.pendingCommand
        ? pushHistoryCommand(state.history, state.toolSession.pendingCommand)
        : state.history,
      markerPreview: previews.markerPreview,
      previewTiles: previews.previewTiles,
      structurePreview: previews.structurePreview,
      toolSession: null,
    };
  });
}

export function getSelectedStructureDraft() {
  const state = useEditorStore.getState();

  if (state.selectedSelection?.layerName !== 'structures') {
    return null;
  }

  const structure = findStructureByObjectId(
    state.map.structures,
    state.selectedSelection.objectId,
  );

  return structure ? buildStructurePropertyDraft(structure) : null;
}

export function getSelectedSpawnPointDraft() {
  const state = useEditorStore.getState();

  if (state.selectedSelection?.layerName !== 'spawn_points') {
    return null;
  }

  const object = findTilemapObjectById(
    state.map.spawnPoints,
    state.selectedSelection.objectId,
  );

  return object ? buildSpawnPointDraft(object) : null;
}

export function getSelectedRegionMarkerDraft() {
  const state = useEditorStore.getState();

  if (state.selectedSelection?.layerName !== 'region_markers') {
    return null;
  }

  const object = findTilemapObjectById(
    state.map.regionMarkers,
    state.selectedSelection.objectId,
  );

  return object ? buildRegionMarkerDraft(object) : null;
}

export { STRUCTURE_CATEGORY_ORDER };
