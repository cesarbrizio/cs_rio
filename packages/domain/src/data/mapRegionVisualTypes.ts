import type { MapEntityKind, MapStructureKind } from '@cs-rio/shared';

export type { MapEntityKind, MapStructureKind } from '@cs-rio/shared';

export interface MapGroundPatch {
  accent?: string;
  center: { x: number; y: number };
  fill: string;
  id: string;
  kind:
    | 'blocked'
    | 'commercial-yard'
    | 'concrete'
    | 'earth'
    | 'favela-core'
    | 'greenery'
    | 'hillside'
    | 'industrial-yard'
    | 'vacant-lot';
  label?: string;
  radiusTiles: { x: number; y: number };
}

export interface MapLandmark {
  accent?: string;
  id: string;
  label: string;
  position: { x: number; y: number };
  shape: 'gate' | 'plaza' | 'tower' | 'warehouse';
}

export interface MapStructure {
  accent?: string;
  footprint: { h: number; w: number };
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  position: { x: number; y: number };
}

export interface MapVisualPreset {
  contextSpots: Array<{
    entityId: string;
    position: { x: number; y: number };
    reach: number;
    title: string;
  }>;
  entities: Array<{
    color?: string;
    id: string;
    kind: MapEntityKind;
    label?: string;
    position: { x: number; y: number };
  }>;
  groundPatches: MapGroundPatch[];
  landmarks: MapLandmark[];
  structures: MapStructure[];
  trails: Array<{
    accent?: string;
    id: string;
    kind: 'alley' | 'avenue' | 'stairs' | 'street';
    label: string;
    points: Array<{ x: number; y: number }>;
  }>;
  zoneSlots: Array<{
    accent: string;
    center: { x: number; y: number };
    id: string;
    radiusTiles: { x: number; y: number };
  }>;
}

export function structure(
  id: string,
  kind: MapStructureKind,
  x: number,
  y: number,
  footprint: { h: number; w: number },
  options: {
    accent?: string;
    interactiveEntityId?: string;
    label?: string;
  } = {},
): MapStructure {
  return {
    accent: options.accent,
    footprint,
    id,
    interactiveEntityId: options.interactiveEntityId,
    kind,
    label: options.label,
    position: { x, y },
  };
}

export interface CompactPresetOptions {
  anchor: { x: number; y: number };
  patchScale?: number;
  positionScale?: number;
  reachScale?: number;
  zoneScale?: number;
}

function compactPoint(
  point: { x: number; y: number },
  anchor: { x: number; y: number },
  scale: number,
) {
  return {
    x: Math.round(anchor.x + (point.x - anchor.x) * scale),
    y: Math.round(anchor.y + (point.y - anchor.y) * scale),
  };
}

function compactRadius(
  radius: { x: number; y: number },
  scale: number,
  minimum: { x: number; y: number },
) {
  return {
    x: Math.max(minimum.x, Math.round(radius.x * scale)),
    y: Math.max(minimum.y, Math.round(radius.y * scale)),
  };
}

export function compactMapPreset(
  preset: MapVisualPreset,
  options: CompactPresetOptions,
): MapVisualPreset {
  const positionScale = options.positionScale ?? 0.36;
  const patchScale = options.patchScale ?? 0.58;
  const zoneScale = options.zoneScale ?? 0.66;
  const reachScale = options.reachScale ?? 0.82;

  return {
    entities: preset.entities.map((entity) => ({
      ...entity,
      position: compactPoint(entity.position, options.anchor, positionScale),
    })),
    contextSpots: preset.contextSpots.map((spot) => ({
      ...spot,
      position: compactPoint(spot.position, options.anchor, positionScale),
      reach: Math.max(4, Math.round(spot.reach * reachScale)),
    })),
    groundPatches: preset.groundPatches.map((patch) => ({
      ...patch,
      center: compactPoint(patch.center, options.anchor, positionScale),
      radiusTiles: compactRadius(patch.radiusTiles, patchScale, { x: 6, y: 4 }),
    })),
    landmarks: preset.landmarks.map((landmark) => ({
      ...landmark,
      position: compactPoint(landmark.position, options.anchor, positionScale),
    })),
    structures: preset.structures.map((structureItem) => ({
      ...structureItem,
      position: compactPoint(structureItem.position, options.anchor, positionScale),
    })),
    trails: preset.trails.map((trail) => ({
      ...trail,
      points: trail.points.map((point) => compactPoint(point, options.anchor, positionScale)),
    })),
    zoneSlots: preset.zoneSlots.map((slot) => ({
      ...slot,
      center: compactPoint(slot.center, options.anchor, positionScale),
      radiusTiles: compactRadius(slot.radiusTiles, zoneScale, { x: 4, y: 3 }),
    })),
  };
}

const INTERACTIVE_STRUCTURE_KINDS = new Set<MapStructureKind>([
  'favela-cluster',
  'boca',
  'baile',
  'rave',
  'hospital',
  'prison',
  'factory',
  'mercado-negro',
  'universidade',
  'docas',
  'desmanche',
]);

export function prunePresetToInteractive(preset: MapVisualPreset): MapVisualPreset {
  return {
    ...preset,
    landmarks: [],
    structures: preset.structures.filter((structureItem) =>
      INTERACTIVE_STRUCTURE_KINDS.has(structureItem.kind),
    ),
    trails: [],
  };
}

export function repositionEntities(
  entities: MapVisualPreset['entities'],
  positions: Record<string, { x: number; y: number }>,
) {
  return entities.map((entity) => {
    const nextPosition = positions[entity.id];

    return nextPosition
      ? {
          ...entity,
          position: nextPosition,
        }
      : entity;
  });
}

export function repositionContextSpots(
  spots: MapVisualPreset['contextSpots'],
  positions: Record<string, { x: number; y: number }>,
) {
  return spots.map((spot) => {
    const nextPosition = positions[spot.entityId];

    return nextPosition
      ? {
          ...spot,
          position: nextPosition,
        }
      : spot;
  });
}

export function repositionStructures(
  structures: MapVisualPreset['structures'],
  positions: Record<string, { x: number; y: number }>,
) {
  return structures.map((structureItem) => {
    const nextPosition = positions[structureItem.id];

    return nextPosition
      ? {
          ...structureItem,
          position: nextPosition,
        }
      : structureItem;
  });
}
