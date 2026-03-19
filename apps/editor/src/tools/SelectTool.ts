import type { GridPoint, ParsedMapStructure } from '@engine/types';

import { clampStructureGridPosition } from '../structures/structureEditing';

interface MapBounds {
  height: number;
  width: number;
}

export interface StructureMoveSession {
  currentGrid: GridPoint;
  objectId: number;
  offset: GridPoint;
  originalGrid: GridPoint;
}

export function createStructureMoveSession(
  structure: ParsedMapStructure,
  pointerTile: GridPoint,
): StructureMoveSession {
  return {
    currentGrid: {
      x: structure.gridX,
      y: structure.gridY,
    },
    objectId: structure.objectId,
    offset: {
      x: pointerTile.x - structure.gridX,
      y: pointerTile.y - structure.gridY,
    },
    originalGrid: {
      x: structure.gridX,
      y: structure.gridY,
    },
  };
}

export function updateStructureMoveSession(
  session: StructureMoveSession,
  pointerTile: GridPoint,
  structure: ParsedMapStructure,
  mapBounds: MapBounds,
): StructureMoveSession {
  const nextGrid = clampStructureGridPosition(
    {
      x: pointerTile.x - session.offset.x,
      y: pointerTile.y - session.offset.y,
    },
    structure.footprint,
    mapBounds,
  );

  if (
    nextGrid.x === session.currentGrid.x &&
    nextGrid.y === session.currentGrid.y
  ) {
    return session;
  }

  return {
    ...session,
    currentGrid: nextGrid,
  };
}
