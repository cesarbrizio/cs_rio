import { type ParsedTilemap, type PathNode, type TilePropertyMap, type TilePropertyValue, type TilemapLayer, type TilemapLayerKind, type TilemapObject, type TilemapTile, type TilemapTileset } from './types';

interface RawTileProperty {
  name?: string;
  type?: string;
  value?: unknown;
}

interface RawTilesetTile {
  id?: number;
  properties?: RawTileProperty[];
}

interface RawTileset {
  name?: string;
  firstgid?: number;
  tilecount?: number;
  columns?: number;
  tilewidth?: number;
  tileheight?: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tiles?: RawTilesetTile[];
}

interface RawLayer {
  id?: number;
  name?: string;
  type?: string;
  width?: number;
  height?: number;
  data?: unknown;
  opacity?: number;
  visible?: boolean;
  objects?: RawObject[];
}

interface RawObject {
  id?: number;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: RawTileProperty[];
}

function toTilePropertyValue(value: unknown): TilePropertyValue {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return String(value ?? '');
}

function normalizeProperties(properties: RawTileProperty[] | undefined): TilePropertyMap {
  return (properties ?? []).reduce<TilePropertyMap>((carry, property) => {
    if (!property.name) {
      return carry;
    }

    carry[property.name] = toTilePropertyValue(property.value);
    return carry;
  }, {});
}

function detectLayerKind(name: string): TilemapLayerKind {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.includes('collision')) {
    return 'collision';
  }

  if (normalizedName.includes('spawn')) {
    return 'spawn_points';
  }

  if (normalizedName.includes('region')) {
    return 'regions';
  }

  if (normalizedName.includes('ground') || normalizedName.includes('terrain')) {
    return 'ground';
  }

  if (normalizedName.includes('object') || normalizedName.includes('building')) {
    return 'objects';
  }

  return 'unknown';
}

function normalizeTilesets(input: Record<string, unknown>): TilemapTileset[] {
  const rawTilesets = Array.isArray(input.tilesets) ? (input.tilesets as RawTileset[]) : [];

  return rawTilesets
    .map((tileset, index) => ({
      key: `${tileset.name ?? `tileset_${index}`}_${tileset.firstgid ?? 1}`,
      name: tileset.name ?? `tileset_${index}`,
      firstGid: Number(tileset.firstgid ?? 1),
      tileCount: Number(tileset.tilecount ?? 0),
      columns: Number(tileset.columns ?? 1),
      tileWidth: Number(tileset.tilewidth ?? input.tilewidth ?? 0),
      tileHeight: Number(tileset.tileheight ?? input.tileheight ?? 0),
      image: typeof tileset.image === 'string' ? tileset.image : undefined,
      imageWidth: typeof tileset.imagewidth === 'number' ? tileset.imagewidth : undefined,
      imageHeight: typeof tileset.imageheight === 'number' ? tileset.imageheight : undefined,
      properties: (tileset.tiles ?? []).reduce<Record<number, TilePropertyMap>>((carry, tile) => {
        carry[Number(tile.id ?? 0)] = normalizeProperties(tile.properties);
        return carry;
      }, {}),
    }))
    .sort((left, right) => left.firstGid - right.firstGid);
}

function resolveTileset(gid: number, tilesets: TilemapTileset[]): TilemapTileset | undefined {
  for (let index = tilesets.length - 1; index >= 0; index -= 1) {
    const tileset = tilesets[index];

    if (!tileset) {
      continue;
    }

    if (gid >= tileset.firstGid) {
      return tileset;
    }
  }

  return undefined;
}

function normalizeObjects(rawObjects: RawObject[], tileWidth: number, tileHeight: number): TilemapObject[] {
  return rawObjects.map((object) => ({
    id: Number(object.id ?? 0),
    name: object.name ?? '',
    type: object.type ?? '',
    x: Number(object.x ?? 0),
    y: Number(object.y ?? 0),
    width: Number(object.width ?? 0),
    height: Number(object.height ?? 0),
    gridX: Math.round(Number(object.x ?? 0) / Math.max(tileWidth, 1)),
    gridY: Math.round(Number(object.y ?? 0) / Math.max(tileHeight, 1)),
    properties: normalizeProperties(object.properties),
  }));
}

function normalizeTileLayer(
  layer: RawLayer,
  tilesets: TilemapTileset[],
  mapWidth: number,
): TilemapTile[] {
  const width = Number(layer.width ?? mapWidth);
  const data = Array.isArray(layer.data) ? (layer.data as number[]) : [];
  const tiles: TilemapTile[] = [];

  for (let index = 0; index < data.length; index += 1) {
    const gid = Number(data[index] ?? 0);

    if (gid <= 0) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    const tileset = resolveTileset(gid, tilesets);
    const tileId = tileset ? gid - tileset.firstGid : gid;
    const properties = tileset?.properties[tileId] ?? {};

    tiles.push({
      gid,
      tileId,
      layerId: Number(layer.id ?? 0),
      layerName: layer.name ?? '',
      tilesetKey: tileset?.key ?? 'unknown',
      tilesetName: tileset?.name ?? 'unknown',
      x,
      y,
      properties,
    });
  }

  return tiles;
}

export function parseTilemap(input: Record<string, unknown>): ParsedTilemap {
  const width = Number(input.width ?? 0);
  const height = Number(input.height ?? 0);
  const tileWidth = Number(input.tilewidth ?? 0);
  const tileHeight = Number(input.tileheight ?? 0);
  const tilesets = normalizeTilesets(input);
  const rawLayers = Array.isArray(input.layers) ? (input.layers as RawLayer[]) : [];
  const collisionNodes: PathNode[] = [];
  const collisionSet = new Set<string>();
  const spawnPoints: TilemapObject[] = [];
  const regionMarkers: TilemapObject[] = [];

  const layers = rawLayers.map<TilemapLayer>((layer) => {
    const name = layer.name ?? '';
    const kind = detectLayerKind(name);
    const objects = layer.type === 'objectgroup' ? normalizeObjects(layer.objects ?? [], tileWidth, tileHeight) : [];
    const tiles = layer.type === 'tilelayer' ? normalizeTileLayer(layer, tilesets, width) : [];

    if (kind === 'collision') {
      for (const tile of tiles) {
        collisionSet.add(`${tile.x}:${tile.y}`);
        collisionNodes.push({ x: tile.x, y: tile.y, walkable: false });
      }

      for (const object of objects) {
        collisionSet.add(`${object.gridX}:${object.gridY}`);
        collisionNodes.push({ x: object.gridX, y: object.gridY, walkable: false });
      }
    }

    if (kind === 'spawn_points') {
      spawnPoints.push(...objects);
    }

    if (kind === 'regions') {
      regionMarkers.push(...objects);
    }

    return {
      id: Number(layer.id ?? 0),
      name,
      kind,
      type: layer.type === 'objectgroup' ? 'objectgroup' : 'tilelayer',
      width: Number(layer.width ?? width),
      height: Number(layer.height ?? height),
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
      tiles,
      objects,
    };
  });

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    orientation: typeof input.orientation === 'string' ? input.orientation : 'isometric',
    pixelWidth: width * tileWidth,
    pixelHeight: height * tileHeight,
    layers,
    tilesets,
    collisionNodes,
    collisionSet,
    spawnPoints,
    regionMarkers,
  };
}
