import { Camera } from './camera';
import { DEFAULT_TILE_SIZE, cameraWorldToScreen, cartToIso, isoToCart } from './coordinates';
import { depthSort, getDepthSortKey } from './depth-sort';
import { type CameraState, type ParsedTilemap, type RenderPlan, type RenderTile, type TilePropertyValue, type TileSize, type VisibleTileBounds } from './types';

const DEFAULT_TILE_FILL = '#3a4f41';
const DEFAULT_TILE_STROKE = '#122018';

export class TilemapRenderer {
  private readonly tileSize: TileSize;

  public constructor(tileSize: TileSize = DEFAULT_TILE_SIZE) {
    this.tileSize = tileSize;
  }

  public getVisibleBounds(map: ParsedTilemap, cameraState: CameraState, paddingTiles = 2): VisibleTileBounds {
    const camera = new Camera(cameraState);
    const corners = [
      camera.screenToWorld({ x: 0, y: 0 }),
      camera.screenToWorld({ x: cameraState.viewportWidth, y: 0 }),
      camera.screenToWorld({ x: 0, y: cameraState.viewportHeight }),
      camera.screenToWorld({ x: cameraState.viewportWidth, y: cameraState.viewportHeight }),
    ].map((corner) => isoToCart(corner, this.tileSize));

    const xValues = corners.map((corner) => corner.x);
    const yValues = corners.map((corner) => corner.y);

    return {
      minX: Math.max(0, Math.floor(Math.min(...xValues)) - paddingTiles),
      minY: Math.max(0, Math.floor(Math.min(...yValues)) - paddingTiles),
      maxX: Math.min(map.width - 1, Math.ceil(Math.max(...xValues)) + paddingTiles),
      maxY: Math.min(map.height - 1, Math.ceil(Math.max(...yValues)) + paddingTiles),
    };
  }

  public buildRenderPlan(map: ParsedTilemap, cameraState: CameraState): RenderPlan {
    const visibleBounds = this.getVisibleBounds(map, cameraState);
    const ground: RenderTile[] = [];
    const objects: RenderTile[] = [];
    const overlay: RenderTile[] = [];
    const batches: Record<string, RenderTile[]> = {};

    for (const layer of map.layers) {
      if (!layer.visible || layer.type !== 'tilelayer') {
        continue;
      }

      const bucket = layer.kind === 'ground' ? ground : layer.kind === 'objects' ? objects : overlay;

      for (const tile of layer.tiles) {
        if (
          tile.x < visibleBounds.minX ||
          tile.x > visibleBounds.maxX ||
          tile.y < visibleBounds.minY ||
          tile.y > visibleBounds.maxY
        ) {
          continue;
        }

        const worldPoint = cartToIso(tile, this.tileSize);
        const screenPoint = cameraWorldToScreen(worldPoint, cameraState);
        const fill = normalizeColor(tile.properties.color, DEFAULT_TILE_FILL);
        const stroke = normalizeColor(tile.properties.stroke, DEFAULT_TILE_STROKE);
        const renderTile: RenderTile = {
          key: `${layer.id}:${tile.x}:${tile.y}:${tile.gid}`,
          layerName: layer.name,
          tilesetKey: tile.tilesetKey,
          x: tile.x,
          y: tile.y,
          gridX: tile.x,
          gridY: tile.y,
          gid: tile.gid,
          tileId: tile.tileId,
          width: this.tileSize.width * cameraState.zoom,
          height: this.tileSize.height * cameraState.zoom,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
          screenX: screenPoint.x,
          screenY: screenPoint.y,
          sortKey: getDepthSortKey(tile),
          opacity: layer.opacity,
          fill,
          stroke,
          sourceRect: this.resolveTileSourceRect(map, tile.tilesetKey, tile.tileId),
        };

        bucket.push(renderTile);
        const batch = batches[tile.tilesetKey] ?? [];
        batch.push(renderTile);
        batches[tile.tilesetKey] = batch;
      }
    }

    return {
      ground: depthSort(ground),
      objects: depthSort(objects),
      overlay: depthSort(overlay),
      batches,
      visibleBounds,
    };
  }

  private resolveTileSourceRect(map: ParsedTilemap, tilesetKey: string, tileId: number) {
    const tileset = map.tilesets.find((entry) => entry.key === tilesetKey);
    const tileWidth = tileset?.tileWidth ?? this.tileSize.width;
    const tileHeight = tileset?.tileHeight ?? this.tileSize.height;
    const columns = Math.max(tileset?.columns ?? 1, 1);

    return {
      x: (tileId % columns) * tileWidth,
      y: Math.floor(tileId / columns) * tileHeight,
      width: tileWidth,
      height: tileHeight,
    };
  }
}

function normalizeColor(value: TilePropertyValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
