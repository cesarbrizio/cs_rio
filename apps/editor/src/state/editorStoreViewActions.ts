import { getMapStructureDefinition } from '@shared/map/structureCatalog';

import { setLayerVisibility as setMapLayerVisibility } from './editorMapDocument.js';
import { isEditorObjectLayerName } from './editorSelection.js';
import { camera, focusCameraOnTile } from './editorStoreInitialState.js';
import { isTileLayerActive, resolvePreviews, resolveRuntimeState } from './editorStoreSupport.js';
import type { EditorStoreSet, EditorStoreState } from './editorStoreTypes.js';

type EditorStoreViewActions = Pick<
  EditorStoreState,
  | 'focusTile'
  | 'setActiveLayerName'
  | 'setActiveStructureCategory'
  | 'setActiveTool'
  | 'setBrushMode'
  | 'setHoveredTile'
  | 'setLayerVisibility'
  | 'setOverlayVisibility'
  | 'setSelectedGid'
  | 'setSelectedSelection'
  | 'setSelectedStructureKind'
  | 'setViewport'
  | 'syncCameraState'
  | 'zoomByStep'
>;

export function createEditorStoreViewActions(set: EditorStoreSet): EditorStoreViewActions {
  return {
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
        if (state.hoveredTile?.x === hoveredTile?.x && state.hoveredTile?.y === hoveredTile?.y) {
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
  };
}
