import type {
  GridPoint,
  ParsedMapStructure,
} from '@engine/types';
import {
  getMapStructureDefinition,
  type MapStructureCategory,
} from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';

import type { EditorStructureOverlay } from './buildStructureOverlays';

interface MapBounds {
  height: number;
  width: number;
}

export interface StructurePropertyDraft {
  footprintH: number;
  footprintW: number;
  interactiveEntityId: string;
  kind: MapStructureKind;
  label: string;
  name: string;
}

function sanitizeFootprint(value: number) {
  return Math.max(1, Math.round(value));
}

function slugifyStructureName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cloneStructure(
  structure: ParsedMapStructure,
): ParsedMapStructure {
  return {
    ...structure,
    footprint: { ...structure.footprint },
    properties: { ...structure.properties },
  };
}

export function cloneStructures(
  structures: ParsedMapStructure[],
): ParsedMapStructure[] {
  return structures.map((structure) => cloneStructure(structure));
}

export function clampStructureGridPosition(
  position: GridPoint,
  footprint: { h: number; w: number },
  mapBounds: MapBounds,
): GridPoint {
  return {
    x: Math.min(
      Math.max(position.x, 0),
      Math.max(mapBounds.width - footprint.w, 0),
    ),
    y: Math.min(
      Math.max(position.y, 0),
      Math.max(mapBounds.height - footprint.h, 0),
    ),
  };
}

export function createPlacedStructure(input: {
  gridPosition: GridPoint;
  kind: MapStructureKind;
  objectId: number;
}): ParsedMapStructure {
  const definition = getMapStructureDefinition(input.kind);
  const footprint = {
    h: definition.defaultFootprint.h,
    w: definition.defaultFootprint.w,
  };
  const slug = slugifyStructureName(definition.label) || input.kind;

  return {
    footprint,
    gridX: input.gridPosition.x,
    gridY: input.gridPosition.y,
    height: 0,
    id: `${slug}-${input.objectId}`,
    kind: input.kind,
    label: definition.label,
    name: `${slug}-${input.objectId}`,
    objectId: input.objectId,
    properties: {
      footprintH: footprint.h,
      footprintW: footprint.w,
      kind: input.kind,
      label: definition.label,
    },
    type: input.kind,
    width: 0,
    x: 0,
    y: 0,
  };
}

export function moveStructureToGrid(
  structure: ParsedMapStructure,
  gridPosition: GridPoint,
): ParsedMapStructure {
  return {
    ...cloneStructure(structure),
    gridX: gridPosition.x,
    gridY: gridPosition.y,
  };
}

export function applyStructureDraft(
  structure: ParsedMapStructure,
  draft: StructurePropertyDraft,
): ParsedMapStructure {
  const name = draft.name.trim();
  const label = draft.label.trim();
  const interactiveEntityId = draft.interactiveEntityId.trim();

  return {
    ...cloneStructure(structure),
    footprint: {
      h: sanitizeFootprint(draft.footprintH),
      w: sanitizeFootprint(draft.footprintW),
    },
    id: name.length > 0 ? name : structure.id,
    interactiveEntityId: interactiveEntityId.length > 0 ? interactiveEntityId : undefined,
    kind: draft.kind,
    label: label.length > 0 ? label : undefined,
    name: name.length > 0 ? name : structure.name,
    properties: {
      ...structure.properties,
      footprintH: sanitizeFootprint(draft.footprintH),
      footprintW: sanitizeFootprint(draft.footprintW),
      interactiveEntityId: interactiveEntityId.length > 0 ? interactiveEntityId : '',
      kind: draft.kind,
      label: label.length > 0 ? label : '',
    },
    type: draft.kind,
  };
}

export function removeStructureByObjectId(
  structures: ParsedMapStructure[],
  objectId: number,
) {
  return structures.filter((structure) => structure.objectId !== objectId);
}

export function replaceStructure(
  structures: ParsedMapStructure[],
  nextStructure: ParsedMapStructure,
) {
  return structures.map((structure) =>
    structure.objectId === nextStructure.objectId ? cloneStructure(nextStructure) : cloneStructure(structure),
  );
}

function rectanglesOverlap(
  left: ParsedMapStructure,
  right: ParsedMapStructure,
) {
  return !(
    left.gridX + left.footprint.w <= right.gridX ||
    right.gridX + right.footprint.w <= left.gridX ||
    left.gridY + left.footprint.h <= right.gridY ||
    right.gridY + right.footprint.h <= left.gridY
  );
}

export function findStructureConflictIds(
  candidate: ParsedMapStructure,
  structures: ParsedMapStructure[],
  excludedObjectId: number | null = null,
) {
  return structures.flatMap((structure) => {
    if (structure.objectId === excludedObjectId) {
      return [];
    }

    return rectanglesOverlap(candidate, structure) ? [structure.objectId] : [];
  });
}

export function findStructureByObjectId(
  structures: ParsedMapStructure[],
  objectId: number | null,
) {
  if (objectId === null) {
    return null;
  }

  return structures.find((structure) => structure.objectId === objectId) ?? null;
}

export function findStructureOverlayAtTile(
  overlays: EditorStructureOverlay[],
  tile: GridPoint,
) {
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const overlay = overlays[index];

    if (
      overlay &&
      tile.x >= overlay.gridPosition.x &&
      tile.y >= overlay.gridPosition.y &&
      tile.x < overlay.gridPosition.x + overlay.footprint.w &&
      tile.y < overlay.gridPosition.y + overlay.footprint.h
    ) {
      return overlay;
    }
  }

  return null;
}

export function buildStructurePropertyDraft(
  structure: ParsedMapStructure,
): StructurePropertyDraft {
  return {
    footprintH: structure.footprint.h,
    footprintW: structure.footprint.w,
    interactiveEntityId: structure.interactiveEntityId ?? '',
    kind: structure.kind as MapStructureKind,
    label: structure.label ?? '',
    name: structure.name,
  };
}

export const STRUCTURE_CATEGORY_ORDER: MapStructureCategory[] = [
  'clandestino',
  'comercial',
  'equipamento',
  'favela',
  'industrial',
  'institucional',
  'residencial',
];
