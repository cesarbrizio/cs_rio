export interface GridPoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TileSize {
  width: number;
  height: number;
}

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  mode?: CameraMode;
  deadZoneWidth?: number;
  deadZoneHeight?: number;
}

export type CameraMode = 'free' | 'follow';

export interface CameraFollowOptions {
  deadZoneWidth?: number;
  deadZoneHeight?: number;
  lerp?: number;
}

export interface PathNode extends GridPoint {
  walkable?: boolean;
  weight?: number;
}

export interface DepthSortable extends GridPoint {
  widthInTiles?: number;
  heightInTiles?: number;
  sortBias?: number;
}

export type TilePropertyValue = boolean | number | string;

export interface TilePropertyMap {
  [key: string]: TilePropertyValue;
}

export interface TileFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TilemapTileset {
  key: string;
  name: string;
  firstGid: number;
  tileCount: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  properties: Record<number, TilePropertyMap>;
}

export interface TilemapTile extends GridPoint {
  gid: number;
  tileId: number;
  layerId: number;
  layerName: string;
  tilesetKey: string;
  tilesetName: string;
  properties: TilePropertyMap;
}

export interface TilemapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gridX: number;
  gridY: number;
  properties: TilePropertyMap;
}

export interface ParsedMapStructure {
  footprint: { h: number; w: number };
  gridX: number;
  gridY: number;
  id: string;
  interactiveEntityId?: string;
  kind: string;
  label?: string;
  name: string;
  objectId: number;
  properties: TilePropertyMap;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type TilemapLayerKind =
  | 'collision'
  | 'ground'
  | 'objects'
  | 'regions'
  | 'spawn_points'
  | 'structures'
  | 'unknown';

export interface TilemapLayer {
  id: number;
  name: string;
  kind: TilemapLayerKind;
  type: 'objectgroup' | 'tilelayer';
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  tiles: TilemapTile[];
  objects: TilemapObject[];
}

export interface ParsedTilemap {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  orientation: string;
  pixelWidth: number;
  pixelHeight: number;
  layers: TilemapLayer[];
  tilesets: TilemapTileset[];
  collisionNodes: PathNode[];
  collisionSet: Set<string>;
  spawnPoints: TilemapObject[];
  regionMarkers: TilemapObject[];
  structures: ParsedMapStructure[];
}

export interface VisibleTileBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RenderTile {
  key: string;
  layerName: string;
  tilesetKey: string;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  gid: number;
  tileId: number;
  width: number;
  height: number;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  sortKey: number;
  opacity: number;
  fill: string;
  stroke: string;
  sourceRect: TileFrameRect;
}

export interface RenderPlan {
  ground: RenderTile[];
  objects: RenderTile[];
  overlay: RenderTile[];
  batches: Record<string, RenderTile[]>;
  visibleBounds: VisibleTileBounds;
}

export type MovementDirection =
  | 'idle'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';

export interface MovementState {
  position: GridPoint;
  path: GridPoint[];
  isMoving: boolean;
  direction: MovementDirection;
  speedTilesPerSecond: number;
}
