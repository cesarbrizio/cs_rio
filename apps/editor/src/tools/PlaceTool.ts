import type { GridPoint } from '@engine/types';
import type { MapStructureKind } from '@shared/map/types';

import {
  clampStructureGridPosition,
  createPlacedStructure,
} from '../structures/structureEditing';

interface MapBounds {
  height: number;
  width: number;
}

interface BuildPlacedStructureInput {
  gridPosition: GridPoint;
  kind: MapStructureKind;
  mapBounds: MapBounds;
  objectId: number;
}

export function buildPlacedStructure(input: BuildPlacedStructureInput) {
  const placedStructure = createPlacedStructure({
    gridPosition: input.gridPosition,
    kind: input.kind,
    objectId: input.objectId,
  });
  const gridPosition = clampStructureGridPosition(
    {
      x: placedStructure.gridX,
      y: placedStructure.gridY,
    },
    placedStructure.footprint,
    input.mapBounds,
  );

  return {
    ...placedStructure,
    gridX: gridPosition.x,
    gridY: gridPosition.y,
  };
}
