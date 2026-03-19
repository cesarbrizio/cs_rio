import type { EditorSelection } from './editorSelection';

export interface TileChange {
  newGid: number;
  oldGid: number;
  x: number;
  y: number;
}

export interface TilePaintCommand {
  kind: 'tile_paint';
  layerName: string;
  tiles: TileChange[];
}

export interface ObjectLayerSnapshotCommand {
  afterObjects: Array<Record<string, unknown>>;
  beforeObjects: Array<Record<string, unknown>>;
  kind: 'object_layer_snapshot';
  layerName: 'region_markers' | 'spawn_points' | 'structures';
  selectionAfter: EditorSelection | null;
  selectionBefore: EditorSelection | null;
}

export type HistoryCommand = ObjectLayerSnapshotCommand | TilePaintCommand;

export interface HistoryState {
  redoStack: HistoryCommand[];
  undoStack: HistoryCommand[];
}

export const EMPTY_HISTORY_STATE: HistoryState = {
  redoStack: [],
  undoStack: [],
};

export function pushHistoryCommand(
  history: HistoryState,
  command: HistoryCommand,
): HistoryState {
  return {
    redoStack: [],
    undoStack: [...history.undoStack, command],
  };
}

export function popUndoCommand(history: HistoryState) {
  const command = history.undoStack[history.undoStack.length - 1];

  if (!command) {
    return {
      command: null,
      history,
    };
  }

  return {
    command,
    history: {
      redoStack: [...history.redoStack, command],
      undoStack: history.undoStack.slice(0, -1),
    },
  };
}

export function popRedoCommand(history: HistoryState) {
  const command = history.redoStack[history.redoStack.length - 1];

  if (!command) {
    return {
      command: null,
      history,
    };
  }

  return {
    command,
    history: {
      redoStack: history.redoStack.slice(0, -1),
      undoStack: [...history.undoStack, command],
    },
  };
}

export function mergeTileCommands(
  baseCommand: TilePaintCommand | null,
  nextCommand: TilePaintCommand | null,
): TilePaintCommand | null {
  if (!nextCommand) {
    return baseCommand;
  }

  if (!baseCommand) {
    return nextCommand;
  }

  const changesByTileKey = new Map<string, TileChange>(
    baseCommand.tiles.map((change) => [`${change.x}:${change.y}`, change]),
  );

  for (const change of nextCommand.tiles) {
    const key = `${change.x}:${change.y}`;
    const previousChange = changesByTileKey.get(key);

    if (!previousChange) {
      changesByTileKey.set(key, change);
      continue;
    }

    if (previousChange.oldGid === change.newGid) {
      changesByTileKey.delete(key);
      continue;
    }

    changesByTileKey.set(key, {
      ...previousChange,
      newGid: change.newGid,
    });
  }

  const mergedTiles = [...changesByTileKey.values()];

  return mergedTiles.length > 0
    ? {
        kind: 'tile_paint',
        layerName: baseCommand.layerName,
        tiles: mergedTiles,
      }
    : null;
}
