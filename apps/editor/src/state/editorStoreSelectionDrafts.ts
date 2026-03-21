import {
  buildRegionMarkerDraft,
  buildSpawnPointDraft,
  findTilemapObjectById,
} from '../objects/objectLayerEditing.js';
import {
  buildStructurePropertyDraft,
  findStructureByObjectId,
} from '../structures/structureEditing.js';
import type { EditorStoreApi } from './editorStoreTypes.js';

export function getSelectedStructureDraftFromStore(store: EditorStoreApi) {
  const state = store.getState();

  if (state.selectedSelection?.layerName !== 'structures') {
    return null;
  }

  const structure = findStructureByObjectId(state.map.structures, state.selectedSelection.objectId);

  return structure ? buildStructurePropertyDraft(structure) : null;
}

export function getSelectedSpawnPointDraftFromStore(store: EditorStoreApi) {
  const state = store.getState();

  if (state.selectedSelection?.layerName !== 'spawn_points') {
    return null;
  }

  const object = findTilemapObjectById(state.map.spawnPoints, state.selectedSelection.objectId);

  return object ? buildSpawnPointDraft(object) : null;
}

export function getSelectedRegionMarkerDraftFromStore(store: EditorStoreApi) {
  const state = store.getState();

  if (state.selectedSelection?.layerName !== 'region_markers') {
    return null;
  }

  const object = findTilemapObjectById(state.map.regionMarkers, state.selectedSelection.objectId);

  return object ? buildRegionMarkerDraft(object) : null;
}
