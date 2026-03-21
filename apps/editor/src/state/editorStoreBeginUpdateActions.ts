import { findMarkerOverlayAtTile, isMarkerLayerName } from '../objects/buildMarkerOverlays.js';
import {
  buildPlacedTilemapObject,
  deleteTilemapObjectAtId,
  findTilemapObjectById,
} from '../objects/objectLayerEditing.js';
import { pickTileGid } from '../tools/EyedropperTool.js';
import { buildPlacedStructure } from '../tools/PlaceTool.js';
import {
  buildBrushTiles,
  createToolSession,
  isTerrainContinuousTool,
  updateToolSession,
} from '../tools/ToolManager.js';
import {
  applyTilePaintCommand,
  getNextObjectId,
  readTileGid,
  replaceStructures,
  replaceTilemapObjects,
} from './editorMapDocument.js';
import { mergeTileCommands, pushHistoryCommand } from './historyManager.js';
import type { EditorStoreSet, EditorStoreState } from './editorStoreTypes.js';
import {
  cloneStructures,
  findStructureByObjectId,
  findStructureOverlayAtTile,
  removeStructureByObjectId,
} from '../structures/structureEditing.js';
import {
  buildObjectLayerCommand,
  buildSelection,
  buildToolCommand,
  createObjectMoveSession,
  findCollisionPaintGid,
  isSameTile,
  isTileLayerActive,
  resolvePreviews,
  resolveRuntimeState,
  updateObjectMoveSession,
} from './editorStoreSupport.js';

type EditorStoreBeginUpdateActions = Pick<
  EditorStoreState,
  'beginToolInteraction' | 'updateToolInteraction'
>;

export function createEditorStoreBeginUpdateActions(
  set: EditorStoreSet,
): EditorStoreBeginUpdateActions {
  return {
    beginToolInteraction: (tile) =>
      set((state) => {
        const activeLayerIsTileLayer = isTileLayerActive(state.mapDocument, state.activeLayerName);

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

        if (state.activeTool === 'place' && isMarkerLayerName(state.activeLayerName)) {
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

        if (state.activeTool === 'delete' && isMarkerLayerName(state.activeLayerName)) {
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
            markerLayerName === 'spawn_points' ? state.map.spawnPoints : state.map.regionMarkers;
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

          const objectDragSession = createObjectMoveSession('structures', targetStructure, tile);
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

        if (state.activeTool === 'select' && isMarkerLayerName(state.activeLayerName)) {
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
            markerLayerName === 'spawn_points' ? state.map.spawnPoints : state.map.regionMarkers;
          const targetObject = findTilemapObjectById(objects, targetOverlay.objectId);

          if (!targetObject) {
            return state;
          }

          const objectDragSession = createObjectMoveSession(markerLayerName, targetObject, tile);
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
        const pendingCommand = mergeTileCommands(state.toolSession.pendingCommand, command);

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
  };
}
