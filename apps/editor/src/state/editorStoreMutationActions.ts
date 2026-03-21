import { parseTilemap } from '@engine/tilemap-parser';
import type { MapStructureKind } from '@shared/map/types';

import {
  applyRegionMarkerDraft,
  applySpawnPointDraft,
  deleteTilemapObjectAtId,
  findTilemapObjectById,
  replaceTilemapObject,
} from '../objects/objectLayerEditing.js';
import {
  applyHistoryCommand,
  applyTilePaintCommand,
  createEditorMapDocument,
  createParsedTilemapInput,
  getEditableTileLayerSummaries,
  replaceStructures,
  replaceTilemapObjects,
} from './editorMapDocument.js';
import {
  EMPTY_HISTORY_STATE,
  popRedoCommand,
  popUndoCommand,
  pushHistoryCommand,
} from './historyManager.js';
import { buildTilePalette } from './tilePalette.js';
import { buildTileClipboard, buildTileClipboardPasteCommand } from './tileRegionClipboard.js';
import type { EditorStoreSet, EditorStoreState } from './editorStoreTypes.js';
import {
  applyStructureDraft as buildAppliedStructureDraft,
  clampStructureGridPosition,
  findStructureByObjectId,
  findStructureConflictIds,
  moveStructureToGrid,
  removeStructureByObjectId,
  replaceStructure,
} from '../structures/structureEditing.js';
import {
  buildObjectLayerCommand,
  buildSelection,
  findCollisionPaintGid,
  findDefaultSelectedGid,
  getDefaultActiveLayerName,
  getSelectionForHistoryCommand,
  isTileLayerActive,
  resolveRuntimeState,
} from './editorStoreSupport.js';
import { resetCameraForMap } from './editorStoreInitialState.js';

type EditorStoreMutationActions = Pick<
  EditorStoreState,
  | 'applySelectedRegionMarkerProperties'
  | 'applySelectedSpawnPointProperties'
  | 'applySelectedStructureProperties'
  | 'copySelectedTileRegion'
  | 'deleteSelectedObject'
  | 'loadMapFromRaw'
  | 'pasteTileClipboard'
  | 'redo'
  | 'undo'
>;

export function createEditorStoreMutationActions(set: EditorStoreSet): EditorStoreMutationActions {
  return {
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
    copySelectedTileRegion: () => {
      let clipboard = null;

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
          selection.layerName === 'spawn_points' ? state.map.spawnPoints : state.map.regionMarkers;
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
    pasteTileClipboard: (tile) => {
      let command = null;

      set((state) => {
        if (!state.tileClipboard || !isTileLayerActive(state.mapDocument, state.activeLayerName)) {
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
    undo: () =>
      set((state) => {
        const { command, history } = popUndoCommand(state.history);

        if (!command) {
          return state;
        }

        const nextMapDocument = applyHistoryCommand(state.mapDocument, command, 'reverse');
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
  };
}
