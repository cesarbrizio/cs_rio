import type {
  GridPoint,
  TilePropertyMap,
  TilePropertyValue,
  TileSize,
  TilemapObject,
} from '@engine/types';

import type { EditorObjectLayerName } from '../state/editorSelection';

interface MapBounds {
  height: number;
  width: number;
}

export interface SpawnPointDraft {
  name: string;
  spawnId: string;
  type: string;
}

export interface RegionPropertyDraftEntry {
  key: string;
  value: string;
}

export interface RegionMarkerDraft {
  name: string;
  properties: RegionPropertyDraftEntry[];
  type: string;
}

function slugifyValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeObjectType(value: string, fallback: string) {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : fallback;
}

function buildDefaultObjectName(prefix: string, objectId: number) {
  return `${prefix}_${objectId}`;
}

function buildObjectPoint(
  gridPosition: GridPoint,
  tileSize: TileSize,
) {
  return {
    x: gridPosition.x * tileSize.width,
    y: gridPosition.y * tileSize.height,
  };
}

export function cloneTilemapObject(
  object: TilemapObject,
): TilemapObject {
  return {
    ...object,
    properties: { ...object.properties },
  };
}

export function cloneTilemapObjects(
  objects: TilemapObject[],
): TilemapObject[] {
  return objects.map((object) => cloneTilemapObject(object));
}

export function getTilemapObjectFootprint(
  object: TilemapObject,
  tileSize: TileSize,
) {
  return {
    h: Math.max(1, Math.round(object.height / Math.max(tileSize.height, 1))),
    w: Math.max(1, Math.round(object.width / Math.max(tileSize.width, 1))),
  };
}

export function clampTilemapObjectGridPosition(
  position: GridPoint,
  object: TilemapObject,
  mapBounds: MapBounds,
  tileSize: TileSize,
): GridPoint {
  const footprint = getTilemapObjectFootprint(object, tileSize);

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

export function moveTilemapObjectToGrid(
  object: TilemapObject,
  gridPosition: GridPoint,
  tileSize: TileSize,
): TilemapObject {
  const point = buildObjectPoint(gridPosition, tileSize);

  return {
    ...cloneTilemapObject(object),
    gridX: gridPosition.x,
    gridY: gridPosition.y,
    x: point.x,
    y: point.y,
  };
}

export function deleteTilemapObjectAtId(
  objects: TilemapObject[],
  objectId: number,
) {
  return objects.filter((object) => object.id !== objectId);
}

export function findTilemapObjectById(
  objects: TilemapObject[],
  objectId: number | null,
) {
  if (objectId === null) {
    return null;
  }

  return objects.find((object) => object.id === objectId) ?? null;
}

export function replaceTilemapObject(
  objects: TilemapObject[],
  nextObject: TilemapObject,
) {
  return objects.map((object) =>
    object.id === nextObject.id ? cloneTilemapObject(nextObject) : cloneTilemapObject(object),
  );
}

export function buildPlacedTilemapObject(input: {
  layerName: 'region_markers' | 'spawn_points';
  objectId: number;
  tileSize: TileSize;
  gridPosition: GridPoint;
}): TilemapObject {
  if (input.layerName === 'spawn_points') {
    const name = buildDefaultObjectName('spawn', input.objectId);
    const point = buildObjectPoint(input.gridPosition, input.tileSize);
    const properties: TilePropertyMap = {
      spawnId: name,
    };

    return {
      gridX: input.gridPosition.x,
      gridY: input.gridPosition.y,
      height: input.tileSize.height,
      id: input.objectId,
      name,
      properties,
      type: 'spawn',
      width: input.tileSize.width,
      x: point.x,
      y: point.y,
    };
  }

  const name = buildDefaultObjectName('region', input.objectId);
  const point = buildObjectPoint(input.gridPosition, input.tileSize);
  const properties: TilePropertyMap = {
    label: `Regiao ${input.objectId}`,
  };

  return {
    gridX: input.gridPosition.x,
    gridY: input.gridPosition.y,
    height: input.tileSize.height,
    id: input.objectId,
    name,
    properties,
    type: 'region',
    width: input.tileSize.width,
    x: point.x,
    y: point.y,
  };
}

export function buildSpawnPointDraft(
  object: TilemapObject,
): SpawnPointDraft {
  return {
    name: object.name,
    spawnId:
      typeof object.properties.spawnId === 'string'
        ? object.properties.spawnId
        : object.name,
    type: object.type,
  };
}

export function applySpawnPointDraft(
  object: TilemapObject,
  draft: SpawnPointDraft,
): TilemapObject {
  const name = draft.name.trim();
  const spawnId = draft.spawnId.trim();

  return {
    ...cloneTilemapObject(object),
    name: name.length > 0 ? name : object.name,
    properties: {
      ...object.properties,
      spawnId: spawnId.length > 0 ? spawnId : object.properties.spawnId ?? '',
    },
    type: sanitizeObjectType(draft.type, 'spawn'),
  };
}

function toDraftValue(value: TilePropertyValue) {
  return String(value);
}

function normalizeRegionPropertyEntries(
  properties: TilePropertyMap,
): RegionPropertyDraftEntry[] {
  return Object.entries(properties).map(([key, value]) => ({
    key,
    value: toDraftValue(value),
  }));
}

function normalizeRegionProperties(
  properties: RegionPropertyDraftEntry[],
): TilePropertyMap {
  const normalizedEntries = properties
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.key.length > 0);

  return normalizedEntries.reduce<TilePropertyMap>((carry, entry) => {
    carry[entry.key] = entry.value;
    return carry;
  }, {});
}

export function buildRegionMarkerDraft(
  object: TilemapObject,
): RegionMarkerDraft {
  return {
    name: object.name,
    properties: normalizeRegionPropertyEntries(object.properties),
    type: object.type,
  };
}

export function applyRegionMarkerDraft(
  object: TilemapObject,
  draft: RegionMarkerDraft,
): TilemapObject {
  const name = draft.name.trim();
  const properties = normalizeRegionProperties(draft.properties);

  return {
    ...cloneTilemapObject(object),
    name: name.length > 0 ? name : object.name,
    properties,
    type: sanitizeObjectType(draft.type, 'region'),
  };
}

export function buildMarkerLabel(
  layerName: EditorObjectLayerName,
  object: TilemapObject,
) {
  if (layerName === 'region_markers') {
    const labelProperty = object.properties.label;

    if (typeof labelProperty === 'string' && labelProperty.trim().length > 0) {
      return labelProperty;
    }
  }

  if (object.name.trim().length > 0) {
    return object.name;
  }

  if (layerName === 'spawn_points') {
    const spawnId = object.properties.spawnId;

    if (typeof spawnId === 'string' && spawnId.trim().length > 0) {
      return spawnId;
    }
  }

  return `${slugifyValue(object.type) || 'marker'}-${object.id}`;
}
