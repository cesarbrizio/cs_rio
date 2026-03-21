import { parseTilemap } from '@engine/tilemap-parser';
import type {
  GridPoint,
  ParsedMapStructure,
  TilemapObject,
  TilePropertyValue,
} from '@engine/types';

import type {
  HistoryCommand,
  TilePaintCommand,
} from './historyManager';

import {
  DEFAULT_LAYER_ORDER,
  REQUIRED_LAYER_NAMES,
  STRUCTURES_LAYER_NAME,
  type EditorMapLayer,
  type EditorMapDocument,
  type EditorMapValidationResult,
  type EditorObjectLayerState,
  type EditorTileLayerState,
  type EditorTileLayerSummary,
  type RawObjectLayer,
  type RawTileLayer,
  inferTiledPropertyType,
  normalizeBoolean,
  normalizeNumber,
  normalizeObjectLayer,
  normalizeString,
  normalizeTileLayer,
} from './editorMapDocumentCore';
export type {
  EditorMapDocument,
  EditorMapValidationResult,
  EditorObjectLayerState,
  EditorTileLayerState,
  EditorTileLayerSummary,
} from './editorMapDocumentCore';

export function createEditorMapDocument(
  rawMap: Record<string, unknown>,
): EditorMapDocument {
  const clonedMap = structuredClone(rawMap) as Record<string, unknown> & {
    layers?: Array<RawObjectLayer | RawTileLayer>;
  };
  const rawLayers = Array.isArray(clonedMap.layers) ? clonedMap.layers : [];
  const mapMeta = {
    ...clonedMap,
    layers: undefined,
  };

  return {
    layers: rawLayers.map<EditorMapLayer>((rawLayer, index) =>
      rawLayer.type === 'tilelayer'
        ? normalizeTileLayer(rawLayer as RawTileLayer, `layer_${index}`)
        : normalizeObjectLayer(rawLayer as RawObjectLayer, `objects_${index}`),
    ),
    mapMeta,
  };
}

export function createParsedTilemapInput(document: EditorMapDocument) {
  return {
    ...document.mapMeta,
    layers: document.layers.map((layer) =>
      layer.type === 'tilelayer'
        ? {
            ...layer.meta,
            data: Array.from(layer.data),
            height: layer.height,
            id: layer.id,
            name: layer.name,
            opacity: layer.opacity,
            type: layer.type,
            visible: layer.visible,
            width: layer.width,
          }
        : {
            ...layer.meta,
            id: layer.id,
            name: layer.name,
            objects: structuredClone(layer.objects),
            opacity: layer.opacity,
            type: layer.type,
            visible: layer.visible,
          },
    ),
  } satisfies Record<string, unknown>;
}

export function serializeEditorMapDocument(document: EditorMapDocument) {
  return createParsedTilemapInput(document);
}

export function getEditableTileLayerSummaries(
  document: EditorMapDocument,
): EditorTileLayerSummary[] {
  return document.layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
    type: layer.type,
    visible: layer.visible,
  }));
}

function findTileLayer(
  document: EditorMapDocument,
  layerName: string,
) {
  const layerIndex = document.layers.findIndex(
    (layer) => layer.type === 'tilelayer' && layer.name === layerName,
  );
  const layer = document.layers[layerIndex];

  return layer && layer.type === 'tilelayer'
    ? { layer, layerIndex }
    : null;
}

function findObjectLayer(
  document: EditorMapDocument,
  layerName: string,
) {
  const layerIndex = document.layers.findIndex(
    (layer) => layer.type === 'objectgroup' && layer.name === layerName,
  );
  const layer = document.layers[layerIndex];

  return layer && layer.type === 'objectgroup'
    ? { layer, layerIndex }
    : null;
}

function buildValidGidSet(rawMap: Record<string, unknown>) {
  const gidSet = new Set<number>();
  const rawTilesets = Array.isArray(rawMap.tilesets)
    ? rawMap.tilesets as Array<Record<string, unknown>>
    : [];

  for (const tileset of rawTilesets) {
    const firstGid = normalizeNumber(tileset.firstgid, 1);
    const tileCount = Math.max(0, normalizeNumber(tileset.tilecount, 0));

    for (let offset = 0; offset < tileCount; offset += 1) {
      gidSet.add(firstGid + offset);
    }
  }

  return gidSet;
}

function normalizeMapDimension(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getMapTileSize(document: EditorMapDocument) {
  return {
    height: normalizeMapDimension(document.mapMeta.tileheight, 64),
    width: normalizeMapDimension(document.mapMeta.tilewidth, 128),
  };
}

function buildEmptyTileLayerState(input: {
  fallbackId: number;
  height: number;
  name: string;
  templateLayer: EditorTileLayerState | null;
  width: number;
}) {
  return {
    data: new Uint16Array(input.width * input.height),
    height: input.height,
    id: input.templateLayer?.id ?? input.fallbackId,
    meta: input.templateLayer ? { ...input.templateLayer.meta } : {},
    name: input.name,
    opacity: input.templateLayer?.opacity ?? 1,
    type: 'tilelayer' as const,
    visible: input.templateLayer?.visible ?? true,
    width: input.width,
  };
}

function buildEmptyObjectLayerState(input: {
  fallbackId: number;
  name: string;
  templateLayer: EditorObjectLayerState | null;
}) {
  return {
    id: input.templateLayer?.id ?? input.fallbackId,
    meta: input.templateLayer ? { ...input.templateLayer.meta } : {},
    name: input.name,
    objects: [],
    opacity: input.templateLayer?.opacity ?? 1,
    type: 'objectgroup' as const,
    visible: input.templateLayer?.visible ?? true,
  };
}

function buildStructureProperties(
  structure: ParsedMapStructure,
) {
  const properties: Record<string, TilePropertyValue | undefined> = {
    ...structure.properties,
    footprintH: structure.footprint.h,
    footprintW: structure.footprint.w,
    kind: structure.kind,
  };

  if (structure.interactiveEntityId) {
    properties.interactiveEntityId = structure.interactiveEntityId;
  } else {
    delete properties.interactiveEntityId;
  }

  if (structure.label) {
    properties.label = structure.label;
  } else {
    delete properties.label;
  }

  return Object.entries(properties).flatMap(([name, value]) => {
    if (value === undefined) {
      return [];
    }

    return [
      {
        name,
        type: inferTiledPropertyType(value),
        value,
      },
    ];
  });
}

function buildTilemapObjectProperties(
  object: TilemapObject,
) {
  return Object.entries(object.properties).flatMap(([name, value]) => [
    {
      name,
      type: inferTiledPropertyType(value),
      value,
    },
  ]);
}

function serializeStructureObject(
  structure: ParsedMapStructure,
  document: EditorMapDocument,
) {
  const tileSize = getMapTileSize(document);

  return {
    height: structure.footprint.h * tileSize.height,
    id: structure.objectId,
    name: structure.name,
    properties: buildStructureProperties(structure),
    type: structure.type || structure.kind,
    width: structure.footprint.w * tileSize.width,
    x: structure.gridX * tileSize.width,
    y: structure.gridY * tileSize.height,
  } satisfies Record<string, unknown>;
}

function serializeTilemapObject(
  object: TilemapObject,
  document: EditorMapDocument,
) {
  const tileSize = getMapTileSize(document);

  return {
    height: object.height || tileSize.height,
    id: object.id,
    name: object.name,
    properties: buildTilemapObjectProperties(object),
    type: object.type,
    width: object.width || tileSize.width,
    x: object.gridX * tileSize.width,
    y: object.gridY * tileSize.height,
  } satisfies Record<string, unknown>;
}

function cloneStructure(
  structure: ParsedMapStructure,
): ParsedMapStructure {
  return {
    ...structure,
    footprint: { ...structure.footprint },
    properties: { ...structure.properties },
  };
}

function cloneObjectLayerRecords(
  objects: Array<Record<string, unknown>>,
) {
  return structuredClone(objects) as Array<Record<string, unknown>>;
}

function isWithinTileLayer(
  layer: EditorTileLayerState,
  point: GridPoint,
) {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < layer.width &&
    point.y < layer.height
  );
}

function getTileIndex(layer: EditorTileLayerState, point: GridPoint) {
  return point.y * layer.width + point.x;
}

export function readTileGid(
  document: EditorMapDocument,
  layerName: string,
  point: GridPoint,
) {
  const match = findTileLayer(document, layerName);

  if (!match || !isWithinTileLayer(match.layer, point)) {
    return null;
  }

  return Number(match.layer.data[getTileIndex(match.layer, point)] ?? 0);
}

export function setLayerVisibility(
  document: EditorMapDocument,
  layerName: string,
  visible: boolean,
) {
  const layerIndex = document.layers.findIndex((layer) => layer.name === layerName);
  const layer = document.layers[layerIndex];

  if (!layer || layer.visible === visible) {
    return document;
  }

  const nextLayers = document.layers.slice();
  nextLayers[layerIndex] = {
    ...layer,
    visible,
  };

  return {
    ...document,
    layers: nextLayers,
  };
}

export function getObjectLayerRecords(
  document: EditorMapDocument,
  layerName: string,
) {
  const layerMatch = findObjectLayer(document, layerName);

  return layerMatch ? cloneObjectLayerRecords(layerMatch.layer.objects) : [];
}

export function replaceObjectLayerRecords(
  document: EditorMapDocument,
  layerName: string,
  objects: Array<Record<string, unknown>>,
) {
  const existingLayer = findObjectLayer(document, layerName);
  const nextLayers = document.layers.slice();
  let nextMapMeta = {
    ...document.mapMeta,
  };

  if (existingLayer) {
    nextLayers[existingLayer.layerIndex] = {
      ...existingLayer.layer,
      objects: cloneObjectLayerRecords(objects),
    };
  } else {
    const nextLayerId = normalizeNumber(document.mapMeta.nextlayerid, document.layers.length + 1);
    nextLayers.push({
      id: nextLayerId,
      meta: {},
      name: layerName,
      objects: cloneObjectLayerRecords(objects),
      opacity: 1,
      type: 'objectgroup',
      visible: true,
    });
    nextMapMeta = {
      ...nextMapMeta,
      nextlayerid: nextLayerId + 1,
    };
  }

  const maxObjectId = objects.reduce((highestId, object) => {
    const objectId = typeof object.id === 'number' ? object.id : 0;
    return Math.max(highestId, objectId);
  }, 0);
  const nextObjectId = Math.max(
    normalizeNumber(document.mapMeta.nextobjectid, 1),
    maxObjectId + 1,
  );

  return {
    layers: nextLayers,
    mapMeta: {
      ...nextMapMeta,
      nextobjectid: nextObjectId,
    },
  };
}

export function replaceStructures(
  document: EditorMapDocument,
  structures: ParsedMapStructure[],
) {
  const serializedObjects = structures.map((structure) =>
    serializeStructureObject(cloneStructure(structure), document),
  );

  return replaceObjectLayerRecords(document, STRUCTURES_LAYER_NAME, serializedObjects);
}

export function replaceTilemapObjects(
  document: EditorMapDocument,
  layerName: 'region_markers' | 'spawn_points',
  objects: TilemapObject[],
) {
  const serializedObjects = objects.map((object) =>
    serializeTilemapObject(object, document),
  );

  return replaceObjectLayerRecords(document, layerName, serializedObjects);
}

export function applyHistoryCommand(
  document: EditorMapDocument,
  command: HistoryCommand,
  direction: 'forward' | 'reverse' = 'forward',
) {
  if (command.kind === 'tile_paint') {
    return applyTilePaintCommand(document, command, direction);
  }

  return replaceObjectLayerRecords(
    document,
    command.layerName,
    direction === 'forward' ? command.afterObjects : command.beforeObjects,
  );
}

export function getNextObjectId(document: EditorMapDocument) {
  return normalizeNumber(document.mapMeta.nextobjectid, 1);
}

export function createEmptyMapDocument(input: {
  height: number;
  templateDocument: EditorMapDocument;
  tilesetName?: string;
  width: number;
}) {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const templateLayers = input.templateDocument.layers;
  const tilesets = Array.isArray(input.templateDocument.mapMeta.tilesets)
    ? structuredClone(input.templateDocument.mapMeta.tilesets)
    : [];
  const filteredTilesets =
    typeof input.tilesetName === 'string' && input.tilesetName.trim().length > 0
      ? tilesets.filter((tileset) => {
          const name =
            typeof (tileset as Record<string, unknown>).name === 'string'
              ? (tileset as Record<string, unknown>).name
              : '';

          return name === input.tilesetName;
        })
      : tilesets;
  let fallbackLayerId = 1;

  const layers = DEFAULT_LAYER_ORDER.map((layerName) => {
    const templateLayer = templateLayers.find((layer) => layer.name === layerName) ?? null;
    const nextLayer =
      layerName === 'terrain' || layerName === 'buildings' || layerName === 'collision'
        ? buildEmptyTileLayerState({
            fallbackId: fallbackLayerId,
            height,
            name: layerName,
            templateLayer:
              templateLayer && templateLayer.type === 'tilelayer'
                ? templateLayer
                : null,
            width,
          })
        : buildEmptyObjectLayerState({
            fallbackId: fallbackLayerId,
            name: layerName,
            templateLayer:
              templateLayer && templateLayer.type === 'objectgroup'
                ? templateLayer
                : null,
          });

    fallbackLayerId = Math.max(fallbackLayerId + 1, nextLayer.id + 1);
    return nextLayer;
  });

  return {
    layers,
    mapMeta: {
      ...input.templateDocument.mapMeta,
      height,
      nextlayerid: fallbackLayerId,
      nextobjectid: 1,
      tilesets: filteredTilesets.length > 0 ? filteredTilesets : tilesets,
      width,
    },
  } satisfies EditorMapDocument;
}

export function validateSerializedMap(
  rawMap: Record<string, unknown>,
): EditorMapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const width = normalizeMapDimension(rawMap.width, 0);
  const height = normalizeMapDimension(rawMap.height, 0);
  const requiredTileCount = width * height;
  const validGids = buildValidGidSet(rawMap);
  const rawLayers = Array.isArray(rawMap.layers)
    ? rawMap.layers as Array<Record<string, unknown>>
    : [];

  if (width <= 0 || height <= 0) {
    errors.push('Dimensoes invalidas do mapa.');
  }

  for (const layerName of REQUIRED_LAYER_NAMES) {
    if (!rawLayers.some((layer) => layer.name === layerName)) {
      errors.push(`Layer obrigatoria ausente: ${layerName}.`);
    }
  }

  if (validGids.size === 0) {
    errors.push('Nenhum tileset valido encontrado para validar GIDs.');
  }

  for (const rawLayer of rawLayers) {
    if (rawLayer.type !== 'tilelayer') {
      continue;
    }

    const layerName = normalizeString(rawLayer.name, 'layer');
    const layerWidth = normalizeMapDimension(rawLayer.width, width);
    const layerHeight = normalizeMapDimension(rawLayer.height, height);
    const data = Array.isArray(rawLayer.data)
      ? rawLayer.data.map((gid) => Number(gid ?? 0))
      : [];

    if (layerWidth !== width || layerHeight !== height) {
      errors.push(`Layer ${layerName} tem dimensoes inconsistentes com o mapa.`);
    }

    if (data.length !== requiredTileCount) {
      errors.push(
        `Layer ${layerName} possui ${data.length} tiles, esperado ${requiredTileCount}.`,
      );
    }

    const invalidGids = [...new Set(
      data.filter((gid) => gid > 0 && !validGids.has(gid)),
    )];

    if (invalidGids.length > 0) {
      errors.push(
        `Layer ${layerName} contem GIDs invalidos: ${invalidGids.slice(0, 8).join(', ')}.`,
      );
    }
  }

  try {
    const parsedMap = parseTilemap(rawMap);

    if (parsedMap.layers.length === 0) {
      errors.push('parseTilemap() retornou zero layers.');
    }

    if (parsedMap.width !== width || parsedMap.height !== height) {
      errors.push('parseTilemap() retornou dimensoes divergentes do documento serializado.');
    }
  } catch (error) {
    errors.push(
      `Falha no round-trip com parseTilemap(): ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }.`,
    );
  }

  if (!rawLayers.some((layer) => layer.name === 'structures')) {
    warnings.push('Layer structures ausente; o editor criara a objectgroup ao persistir estruturas.');
  }

  if (!rawLayers.some((layer) => layer.name === 'buildings')) {
    warnings.push('Layer buildings ausente; o viewer continuara funcional, mas o mapa perde a layer de objetos de tile.');
  }

  return {
    errors,
    warnings,
  };
}

export function validateEditorMapDocument(
  document: EditorMapDocument,
) {
  return validateSerializedMap(serializeEditorMapDocument(document));
}

export function applyTilePaintCommand(
  document: EditorMapDocument,
  command: TilePaintCommand,
  direction: 'forward' | 'reverse' = 'forward',
) {
  const match = findTileLayer(document, command.layerName);

  if (!match || command.tiles.length === 0) {
    return document;
  }

  const nextData = match.layer.data.slice();
  let hasChanges = false;

  for (const change of command.tiles) {
    const point = { x: change.x, y: change.y };

    if (!isWithinTileLayer(match.layer, point)) {
      continue;
    }

    const nextGid = direction === 'forward' ? change.newGid : change.oldGid;
    const index = getTileIndex(match.layer, point);

    if (nextData[index] === nextGid) {
      continue;
    }

    nextData[index] = nextGid;
    hasChanges = true;
  }

  if (!hasChanges) {
    return document;
  }

  const nextLayers = document.layers.slice();
  nextLayers[match.layerIndex] = {
    ...match.layer,
    data: nextData,
  };

  return {
    ...document,
    layers: nextLayers,
  };
}
