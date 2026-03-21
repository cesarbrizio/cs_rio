import { Camera } from '@engine/camera';
import { TilemapRenderer } from '@engine/tilemap-renderer';
import type {
  CameraState,
  GridPoint,
  ParsedTilemap,
  RenderPlan,
  Size,
  TileSize,
} from '@engine/types';
import type { MapStructureCategory } from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';
import type { StoreApi } from 'zustand';

import type { EditorMarkerOverlay } from '../objects/buildMarkerOverlays.js';
import type { RegionMarkerDraft, SpawnPointDraft } from '../objects/objectLayerEditing.js';
import type { EditorBrushMode, EditorToolName, ToolSession } from '../tools/ToolManager.js';
import type { EditorMapDocument, EditorTileLayerSummary } from './editorMapDocument.js';
import type { EditorObjectLayerName, EditorSelection } from './editorSelection.js';
import type { HistoryState, TilePaintCommand } from './historyManager.js';
import type { TilePaletteItem } from './tilePalette.js';
import type { TileClipboardData, TileRegionSelection } from './tileRegionClipboard.js';
import type { EditorStructureOverlay } from '../structures/buildStructureOverlays.js';
import type { StructurePropertyDraft } from '../structures/structureEditing.js';

export interface OverlayVisibilityState {
  collision: boolean;
  grid: boolean;
  regionMarkers: boolean;
  spawnPoints: boolean;
}

export interface EditorRuntime {
  collisionOverlayTiles: GridPoint[];
  layerSummaries: EditorTileLayerSummary[];
  map: ParsedTilemap;
  regionMarkerOverlays: EditorMarkerOverlay[];
  renderPlan: RenderPlan;
  spawnPointOverlays: EditorMarkerOverlay[];
  structureOverlays: EditorStructureOverlay[];
}

export interface ActiveToolSession {
  pendingCommand: TilePaintCommand | null;
  session: ToolSession;
}

export interface ObjectMoveSession {
  currentGrid: GridPoint;
  layerName: EditorObjectLayerName;
  objectId: number;
  offset: GridPoint;
  originalGrid: GridPoint;
}

export interface MarkerPreviewState {
  layerName: 'region_markers' | 'spawn_points';
  mode: 'move' | 'place';
  overlay: EditorMarkerOverlay;
}

export interface StructurePreviewState {
  conflictObjectIds: number[];
  isValid: boolean;
  mode: 'move' | 'place';
  overlay: EditorStructureOverlay;
}

export interface EditorStoreState {
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
  setOverlayVisibility: (overlayName: keyof OverlayVisibilityState, visible: boolean) => void;
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

export type EditorStoreSet = StoreApi<EditorStoreState>['setState'];
export type EditorStoreApi = StoreApi<EditorStoreState>;
