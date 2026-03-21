import type { GridPoint } from '@engine/types';

import {
  findTilemapObjectById,
  moveTilemapObjectToGrid,
  replaceTilemapObject,
} from '../objects/objectLayerEditing.js';
import { buildBrushTiles, updateToolSession } from '../tools/ToolManager.js';
import {
  applyTilePaintCommand,
  replaceStructures,
  replaceTilemapObjects,
} from './editorMapDocument.js';
import { pushHistoryCommand } from './historyManager.js';
import type { EditorStoreApi } from './editorStoreTypes.js';
import {
  findStructureByObjectId,
  findStructureConflictIds,
  moveStructureToGrid,
  replaceStructure,
} from '../structures/structureEditing.js';
import {
  buildObjectLayerCommand,
  buildSelection,
  buildToolCommand,
  findCollisionPaintGid,
  isTileLayerActive,
  resolvePreviews,
  resolveRuntimeState,
  updateObjectMoveSession,
} from './editorStoreSupport.js';

export function finishEditorToolInteraction(store: EditorStoreApi, tile: GridPoint) {
  store.setState((state) => {
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
      const currentObject = findTilemapObjectById(objects, nextObjectDragSession.objectId);

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
      const selection = buildSelection(nextObjectDragSession.layerName, movedObject.id);
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
