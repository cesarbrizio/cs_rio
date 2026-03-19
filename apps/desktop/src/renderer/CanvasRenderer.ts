import { cartToIso } from '@engine/coordinates';
import type { CameraState, GridPoint, RenderPlan, TileSize } from '@engine/types';

import { drawIsoDiamond } from './drawIsoDiamond';
import type { SceneEntity, StructureOverlay } from './types';

interface CanvasRendererInput {
  cameraState: CameraState;
  canvas: HTMLCanvasElement;
  destinationTile: GridPoint | null;
  devicePixelRatio: number;
  entities: SceneEntity[];
  hoveredTile: GridPoint | null;
  renderPlan: RenderPlan;
  selectedPath: GridPoint[];
  showGrid: boolean;
  structures: StructureOverlay[];
  tilesetImage: HTMLImageElement | null;
}

const BACKGROUND_FILL = '#081216';
const GRID_STROKE = 'rgba(246, 237, 215, 0.08)';
const PATH_FILL = 'rgba(97, 214, 255, 0.18)';
const PATH_STROKE = '#6fd0ff';
const HOVER_FILL = 'rgba(255, 210, 97, 0.18)';
const HOVER_STROKE = '#ffd261';
const DESTINATION_FILL = 'rgba(245, 108, 141, 0.18)';
const DESTINATION_STROKE = '#f56c8d';

export class CanvasRenderer {
  public constructor(private readonly tileSize: TileSize) {}

  public render(ctx: CanvasRenderingContext2D, input: CanvasRendererInput) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, input.canvas.width, input.canvas.height);
    ctx.fillStyle = BACKGROUND_FILL;
    ctx.fillRect(0, 0, input.canvas.width, input.canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(
      input.devicePixelRatio * input.cameraState.zoom,
      0,
      0,
      input.devicePixelRatio * input.cameraState.zoom,
      input.devicePixelRatio *
        (input.cameraState.viewportWidth / 2 - input.cameraState.x * input.cameraState.zoom),
      input.devicePixelRatio *
        (input.cameraState.viewportHeight / 2 - input.cameraState.y * input.cameraState.zoom),
    );
    ctx.lineWidth = 1 / Math.max(input.cameraState.zoom, 0.001);

    this.drawTileCollection(ctx, input.renderPlan.ground, input.tilesetImage);
    this.drawTileCollection(ctx, input.renderPlan.objects, input.tilesetImage);
    this.drawStructureCollection(ctx, input.structures);
    this.drawTileCollection(ctx, input.renderPlan.overlay, input.tilesetImage);

    if (input.showGrid) {
      this.drawGridOverlay(ctx, input.renderPlan.visibleBounds);
    }

    this.drawPathOverlay(ctx, input.selectedPath, PATH_FILL, PATH_STROKE);

    if (input.destinationTile) {
      this.drawSingleTile(ctx, input.destinationTile, DESTINATION_FILL, DESTINATION_STROKE);
    }

    if (input.hoveredTile) {
      this.drawSingleTile(ctx, input.hoveredTile, HOVER_FILL, HOVER_STROKE);
    }

    this.drawEntities(ctx, input.entities);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawTileCollection(
    ctx: CanvasRenderingContext2D,
    tiles: RenderPlan['ground'],
    tilesetImage: HTMLImageElement | null,
  ) {
    for (const tile of tiles) {
      ctx.globalAlpha = tile.opacity;
      ctx.fillStyle = tile.fill;
      drawIsoDiamond(ctx, tile.worldX, tile.worldY, this.tileSize.width, this.tileSize.height);
      ctx.fill();

      if (tilesetImage) {
        ctx.drawImage(
          tilesetImage,
          tile.sourceRect.x,
          tile.sourceRect.y,
          tile.sourceRect.width,
          tile.sourceRect.height,
          tile.worldX - this.tileSize.width / 2,
          tile.worldY - this.tileSize.height / 2,
          this.tileSize.width,
          this.tileSize.height,
        );
      }

      ctx.strokeStyle = tile.stroke;
      drawIsoDiamond(ctx, tile.worldX, tile.worldY, this.tileSize.width, this.tileSize.height);
      ctx.stroke();
    }
  }

  private drawGridOverlay(
    ctx: CanvasRenderingContext2D,
    visibleBounds: RenderPlan['visibleBounds'],
  ) {
    ctx.save();
    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 0.8 / Math.max(ctx.getTransform().a, 0.001);

    for (let y = visibleBounds.minY; y <= visibleBounds.maxY; y += 1) {
      for (let x = visibleBounds.minX; x <= visibleBounds.maxX; x += 1) {
        const worldPoint = cartToIso({ x, y }, this.tileSize);
        drawIsoDiamond(ctx, worldPoint.x, worldPoint.y, this.tileSize.width, this.tileSize.height);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawPathOverlay(
    ctx: CanvasRenderingContext2D,
    path: GridPoint[],
    fill: string,
    stroke: string,
  ) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    for (const tile of path.slice(1)) {
      this.drawSingleTile(ctx, tile, fill, stroke);
    }

    ctx.restore();
  }

  private drawSingleTile(
    ctx: CanvasRenderingContext2D,
    tile: GridPoint,
    fill: string,
    stroke: string,
  ) {
    const worldPoint = cartToIso(tile, this.tileSize);

    ctx.fillStyle = fill;
    drawIsoDiamond(ctx, worldPoint.x, worldPoint.y, this.tileSize.width, this.tileSize.height);
    ctx.fill();

    ctx.strokeStyle = stroke;
    drawIsoDiamond(ctx, worldPoint.x, worldPoint.y, this.tileSize.width, this.tileSize.height);
    ctx.stroke();
  }

  private drawStructureCollection(ctx: CanvasRenderingContext2D, structures: StructureOverlay[]) {
    for (const structure of structures) {
      this.drawStructure(ctx, structure);
    }
  }

  private drawStructure(ctx: CanvasRenderingContext2D, structure: StructureOverlay) {
    const fill = `${structure.accent}30`;
    const roofFill = `${structure.accent}c8`;
    const outline = 'rgba(14, 22, 26, 0.68)';

    ctx.save();

    this.fillPolygon(ctx, structure.lot, fill, `${structure.accent}66`);
    this.fillPolygon(ctx, structure.leftWall, `${structure.accent}80`, outline);
    this.fillPolygon(ctx, structure.rightWall, `${structure.accent}95`, outline);
    this.fillPolygon(ctx, structure.roof, roofFill, outline);

    ctx.fillStyle = '#f6edd7';
    ctx.font = `${Math.max(this.tileSize.height * 0.34, 13)}px "IBM Plex Sans", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(structure.label, structure.center.x, structure.center.y - 10);

    ctx.restore();
  }

  private fillPolygon(
    ctx: CanvasRenderingContext2D,
    points: [DOMPointLike, DOMPointLike, DOMPointLike, DOMPointLike],
    fill: string,
    stroke: string,
  ) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  private drawEntities(ctx: CanvasRenderingContext2D, entities: SceneEntity[]) {
    const sortedEntities = [...entities].sort(
      (left, right) =>
        left.position.x + left.position.y - (right.position.x + right.position.y) ||
        left.label.localeCompare(right.label),
    );

    for (const entity of sortedEntities) {
      this.drawEntity(ctx, entity);
    }
  }

  private drawEntity(ctx: CanvasRenderingContext2D, entity: SceneEntity) {
    const worldPoint = cartToIso(entity.position, this.tileSize);
    const markerY = worldPoint.y - this.tileSize.height * 0.7;
    const radius =
      entity.kind === 'local'
        ? this.tileSize.height * 0.34
        : entity.kind === 'poi'
          ? this.tileSize.height * 0.22
          : this.tileSize.height * 0.28;
    const outline = entity.kind === 'local' ? '#f6edd7' : 'rgba(8, 18, 22, 0.8)';
    const haloRadius = entity.kind === 'local' ? radius * 2.1 : radius * 1.8;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(worldPoint.x, worldPoint.y + this.tileSize.height * 0.22, radius * 1.35, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${entity.accent}66`;
    ctx.lineWidth = 2 / Math.max(ctx.getTransform().a, 0.001);
    ctx.beginPath();
    ctx.arc(worldPoint.x, markerY, haloRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (entity.kind === 'poi') {
      ctx.fillStyle = entity.accent;
      drawIsoDiamond(ctx, worldPoint.x, markerY, radius * 2.3, radius * 1.5);
      ctx.fill();
      ctx.strokeStyle = outline;
      drawIsoDiamond(ctx, worldPoint.x, markerY, radius * 2.3, radius * 1.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = entity.accent;
      ctx.beginPath();
      ctx.arc(worldPoint.x, markerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = outline;
      ctx.beginPath();
      ctx.arc(worldPoint.x, markerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#081216';
    ctx.font = `${Math.max(radius * 0.9, 13)}px "IBM Plex Sans", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.kind === 'local' ? 'VOCE' : entity.kind === 'poi' ? 'POI' : 'NPC', worldPoint.x, markerY + 1);

    const labelWidth = Math.max(ctx.measureText(entity.label).width + 18, 60);
    const labelHeight = Math.max(radius * 1.1, 22);
    const labelX = worldPoint.x - labelWidth / 2;
    const labelY = markerY - radius - labelHeight - 10;

    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, labelHeight / 2);
    ctx.fillStyle = 'rgba(8, 18, 22, 0.84)';
    ctx.fill();
    ctx.strokeStyle = `${entity.accent}88`;
    ctx.stroke();

    ctx.fillStyle = '#f6edd7';
    ctx.font = `${Math.max(radius * 0.72, 12)}px "IBM Plex Sans", "Segoe UI", sans-serif`;
    ctx.fillText(entity.label, worldPoint.x, labelY + labelHeight / 2 + 0.5);

    ctx.restore();
  }
}

interface DOMPointLike {
  x: number;
  y: number;
}
