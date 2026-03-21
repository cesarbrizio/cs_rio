import { getMapStructureDefinition } from '@shared/map/structureCatalog';
import type { GridPoint } from '@engine/types';
import { create } from 'zustand';

import { STRUCTURE_CATEGORY_ORDER } from '../structures/structureEditing.js';
import { createEditorStoreBeginUpdateActions } from './editorStoreBeginUpdateActions.js';
import { finishEditorToolInteraction } from './editorStoreFinishActions.js';
import {
  camera,
  initialActiveLayerName,
  initialCollisionPaintGid,
  initialMapDocument,
  initialOverlayVisibility,
  initialRuntime,
  initialSelectedStructureKind,
  initialTilePalette,
  mapName,
} from './editorStoreInitialState.js';
import { createEditorStoreMutationActions } from './editorStoreMutationActions.js';
import {
  getSelectedRegionMarkerDraftFromStore,
  getSelectedSpawnPointDraftFromStore,
  getSelectedStructureDraftFromStore,
} from './editorStoreSelectionDrafts.js';
import { EDITOR_TILE_SIZE, findDefaultSelectedGid, renderer } from './editorStoreSupport.js';
import type { EditorStoreState } from './editorStoreTypes.js';
import { createEditorStoreViewActions } from './editorStoreViewActions.js';
import { EMPTY_HISTORY_STATE } from './historyManager.js';

export const useEditorStore = create<EditorStoreState>((set) => ({
  activeLayerName: initialActiveLayerName,
  activeStructureCategory: getMapStructureDefinition(initialSelectedStructureKind).category,
  activeTool: 'paint',
  brushMode: 'brush_1',
  camera,
  cameraState: camera.getState(),
  collisionOverlayTiles: initialRuntime.collisionOverlayTiles,
  collisionPaintGid: initialCollisionPaintGid,
  hoveredTile: null,
  history: EMPTY_HISTORY_STATE,
  layerSummaries: initialRuntime.layerSummaries,
  map: initialRuntime.map,
  mapDocument: initialMapDocument,
  mapName,
  markerPreview: null,
  objectDragSession: null,
  overlayVisibility: initialOverlayVisibility,
  previewTiles: [],
  regionMarkerOverlays: initialRuntime.regionMarkerOverlays,
  renderPlan: initialRuntime.renderPlan,
  renderer,
  selectedGid: findDefaultSelectedGid(initialTilePalette),
  selectedSelection: null,
  selectedStructureKind: initialSelectedStructureKind,
  spawnPointOverlays: initialRuntime.spawnPointOverlays,
  structureOverlays: initialRuntime.structureOverlays,
  structurePreview: null,
  tileClipboard: null,
  tilePalette: initialTilePalette,
  tileRegionSelection: null,
  tileSize: EDITOR_TILE_SIZE,
  toolSession: null,
  ...createEditorStoreMutationActions(set),
  ...createEditorStoreViewActions(set),
  ...createEditorStoreBeginUpdateActions(set),
}));

export function finishToolInteraction(tile: GridPoint) {
  finishEditorToolInteraction(useEditorStore, tile);
}

export function getSelectedStructureDraft() {
  return getSelectedStructureDraftFromStore(useEditorStore);
}

export function getSelectedSpawnPointDraft() {
  return getSelectedSpawnPointDraftFromStore(useEditorStore);
}

export function getSelectedRegionMarkerDraft() {
  return getSelectedRegionMarkerDraftFromStore(useEditorStore);
}

export { STRUCTURE_CATEGORY_ORDER };
