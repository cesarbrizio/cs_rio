import { cartToIso } from '@engine/coordinates';
import type { CameraState, GridPoint, RenderPlan, TileSize } from '@engine/types';
import { getMapStructureDefinition } from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';

import type { EditorMarkerOverlay } from '../objects/buildMarkerOverlays';
import type { EditorSelection } from '../state/editorSelection';
import {
  normalizeTileRegion,
  type TileRegionSelection,
} from '../state/tileRegionClipboard';
import type { EditorStructureOverlay } from '../structures/buildStructureOverlays';
import { drawStructureSelectionOverlay } from './SelectionOverlay';
import { drawIsoDiamond } from './drawIsoDiamond';

interface CanvasRendererInput {
  cameraState: CameraState;
  canvas: HTMLCanvasElement;
  collisionOverlayTiles: GridPoint[];
  devicePixelRatio: number;
  hoveredTile: GridPoint | null;
  markerPreview: {
    layerName: 'region_markers' | 'spawn_points';
    mode: 'move' | 'place';
    overlay: EditorMarkerOverlay;
  } | null;
  previewTiles: GridPoint[];
  regionMarkerOverlays: EditorMarkerOverlay[];
  renderPlan: RenderPlan;
  selectedSelection: EditorSelection | null;
  showGrid: boolean;
  spawnPointOverlays: EditorMarkerOverlay[];
  structureImageCatalog: Partial<Record<MapStructureKind, HTMLImageElement>>;
  structureOverlays: EditorStructureOverlay[];
  structurePreview: {
    conflictObjectIds: number[];
    isValid: boolean;
    mode: 'move' | 'place';
    overlay: EditorStructureOverlay;
  } | null;
  tileRegionSelection: TileRegionSelection | null;
  tilesetImage: HTMLImageElement | null;
}

const BACKGROUND_FILL = '#101717';
const COLLISION_FILL = 'rgba(255, 84, 84, 0.22)';
const COLLISION_STROKE = 'rgba(130, 22, 22, 0.8)';
const HOVER_FILL = 'rgba(255, 196, 77, 0.24)';
const HOVER_STROKE = '#ffc44d';
const PREVIEW_FILL = 'rgba(124, 206, 255, 0.16)';
const PREVIEW_STROKE = '#7cceff';
const SELECTION_FILL = 'rgba(255, 214, 102, 0.12)';
const SELECTION_STROKE = '#ffe08d';
const STRUCTURE_SELECTED_FILL = 'rgba(255, 196, 77, 0.14)';
const STRUCTURE_SELECTED_STROKE = '#ffc44d';
const STRUCTURE_PREVIEW_FILL = 'rgba(124, 206, 255, 0.12)';
const STRUCTURE_PREVIEW_STROKE = '#7cceff';
const STRUCTURE_CONFLICT_FILL = 'rgba(255, 84, 84, 0.16)';
const STRUCTURE_CONFLICT_STROKE = '#ff6b6b';
const STRUCTURE_PLACEHOLDER_FILL = 'rgba(18, 24, 27, 0.22)';
const STRUCTURE_PLACEHOLDER_PILL = 'rgba(10, 16, 18, 0.9)';
const STRUCTURE_PLACEHOLDER_TEXT = '#f6edd7';
const GRID_STROKE = 'rgba(246, 237, 215, 0.1)';

export class CanvasRenderer {
  public constructor(private readonly tileSize: TileSize) {}

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

  private drawCollisionOverlay(
    ctx: CanvasRenderingContext2D,
    tiles: GridPoint[],
  ) {
    ctx.fillStyle = COLLISION_FILL;
    ctx.strokeStyle = COLLISION_STROKE;

    for (const tile of tiles) {
      const worldPoint = cartToIso(tile, this.tileSize);

      drawIsoDiamond(
        ctx,
        worldPoint.x,
        worldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.fill();

      drawIsoDiamond(
        ctx,
        worldPoint.x,
        worldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.stroke();
    }
  }

  private drawGridOverlay(
    ctx: CanvasRenderingContext2D,
    visibleBounds: RenderPlan['visibleBounds'],
  ) {
    const minX = Math.max(0, visibleBounds.minX - 1);
    const maxX = visibleBounds.maxX + 1;
    const minY = Math.max(0, visibleBounds.minY - 1);
    const maxY = visibleBounds.maxY + 1;

    ctx.save();
    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 0.8 / Math.max(ctx.getTransform().a, 0.001);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const worldPoint = cartToIso({ x, y }, this.tileSize);
        drawIsoDiamond(
          ctx,
          worldPoint.x,
          worldPoint.y,
          this.tileSize.width,
          this.tileSize.height,
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawTileRegionSelection(
    ctx: CanvasRenderingContext2D,
    selection: TileRegionSelection,
  ) {
    const region = normalizeTileRegion(selection);
    const nw = cartToIso({ x: region.minX, y: region.minY }, this.tileSize);
    const ne = cartToIso({ x: region.minX + region.width, y: region.minY }, this.tileSize);
    const se = cartToIso(
      { x: region.minX + region.width, y: region.minY + region.height },
      this.tileSize,
    );
    const sw = cartToIso({ x: region.minX, y: region.minY + region.height }, this.tileSize);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nw.x, nw.y);
    ctx.lineTo(ne.x, ne.y);
    ctx.lineTo(se.x, se.y);
    ctx.lineTo(sw.x, sw.y);
    ctx.closePath();
    ctx.fillStyle = SELECTION_FILL;
    ctx.fill();
    ctx.strokeStyle = SELECTION_STROKE;
    ctx.lineWidth = 1.1 / Math.max(ctx.getTransform().a, 0.001);
    ctx.setLineDash([
      5 / Math.max(ctx.getTransform().a, 0.001),
      3 / Math.max(ctx.getTransform().a, 0.001),
    ]);
    ctx.stroke();
    ctx.restore();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const appliedRadius = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + appliedRadius, y);
    ctx.lineTo(x + width - appliedRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + appliedRadius);
    ctx.lineTo(x + width, y + height - appliedRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - appliedRadius, y + height);
    ctx.lineTo(x + appliedRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - appliedRadius);
    ctx.lineTo(x, y + appliedRadius);
    ctx.quadraticCurveTo(x, y, x + appliedRadius, y);
    ctx.closePath();
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    overlay: EditorMarkerOverlay,
    options?: {
      alpha?: number;
      highlighted?: boolean;
    },
  ) {
    const alpha = options?.alpha ?? 1;
    const radius = Math.max(this.tileSize.height * 0.95, 4);
    const stemHeight = radius * 2.3;
    const markerCenterY = overlay.anchor.y - radius * 1.2;
    const fontSize = Math.max(this.tileSize.height * 2.2, 10);
    const label = overlay.label.trim().length > 0 ? overlay.label : overlay.type;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.lineWidth = 1 / Math.max(ctx.getTransform().a, 0.001);
    ctx.strokeStyle = overlay.stroke;
    ctx.beginPath();
    ctx.moveTo(overlay.anchor.x, overlay.anchor.y);
    ctx.lineTo(overlay.anchor.x, markerCenterY + radius * 0.55);
    ctx.stroke();

    ctx.fillStyle = overlay.fill;
    ctx.beginPath();
    ctx.arc(overlay.anchor.x, markerCenterY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = options?.highlighted ? '#ffe0a8' : overlay.stroke;
    ctx.beginPath();
    ctx.arc(overlay.anchor.x, markerCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (options?.highlighted) {
      ctx.globalAlpha = Math.min(1, alpha + 0.18);
      ctx.strokeStyle = '#ffe0a8';
      ctx.beginPath();
      ctx.arc(overlay.anchor.x, markerCenterY, radius + stemHeight * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    ctx.font = `600 ${fontSize}px "Avenir Next", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pillPaddingX = 8;
    const pillHeight = fontSize + 8;
    const pillWidth = Math.max(ctx.measureText(label).width + pillPaddingX * 2, 34);
    const pillX = overlay.anchor.x - pillWidth / 2;
    const pillY = markerCenterY - stemHeight - pillHeight;

    this.drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = 'rgba(10, 16, 18, 0.88)';
    ctx.fill();
    ctx.strokeStyle = options?.highlighted ? '#ffe0a8' : overlay.stroke;
    ctx.stroke();

    ctx.fillStyle = '#f6edd7';
    ctx.fillText(label, overlay.anchor.x, pillY + pillHeight / 2 + 0.5);

    ctx.restore();
  }

  private drawStructurePlaceholder(
    ctx: CanvasRenderingContext2D,
    overlay: EditorStructureOverlay,
    alpha = 1,
  ) {
    const definition = getMapStructureDefinition(overlay.kind);
    const label = overlay.label ?? definition.label ?? overlay.kind;
    const zoom = Math.max(ctx.getTransform().a, 0.001);
    const fontSize = Math.max(this.tileSize.height * 2.2, 10);
    const pillHeight = fontSize + 8;

    ctx.save();
    ctx.globalAlpha = alpha;
    drawStructureSelectionOverlay(ctx, overlay, {
      fill: STRUCTURE_PLACEHOLDER_FILL,
      lineDash: [5 / zoom, 3 / zoom],
      lineWidth: 1.2 / zoom,
      stroke: definition.palette.glow,
    });
    ctx.font = `600 ${fontSize}px "Avenir Next", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pillWidth = Math.max(ctx.measureText(label).width + 14, 48);
    const pillX = overlay.spriteBounds.x + overlay.spriteBounds.size / 2 - pillWidth / 2;
    const pillY = overlay.spriteBounds.y + overlay.spriteBounds.size * 0.08;

    this.drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = STRUCTURE_PLACEHOLDER_PILL;
    ctx.fill();
    ctx.strokeStyle = definition.palette.glow;
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
    ctx.fillStyle = STRUCTURE_PLACEHOLDER_TEXT;
    ctx.fillText(label, pillX + pillWidth / 2, pillY + pillHeight / 2 + 0.5);
    ctx.restore();
  }

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
    this.drawTileCollection(ctx, input.renderPlan.overlay, input.tilesetImage);

    if (input.showGrid) {
      this.drawGridOverlay(ctx, input.renderPlan.visibleBounds);
    }

    this.drawCollisionOverlay(ctx, input.collisionOverlayTiles);

    ctx.globalAlpha = 1;

    for (const structure of input.structureOverlays) {
      const image = input.structureImageCatalog[structure.kind];

      if (image) {
        ctx.drawImage(
          image,
          structure.spriteBounds.x,
          structure.spriteBounds.y,
          structure.spriteBounds.size,
          structure.spriteBounds.size,
        );
        continue;
      }

      this.drawStructurePlaceholder(ctx, structure);
    }

    if (input.structurePreview) {
      const image = input.structureImageCatalog[input.structurePreview.overlay.kind];

      if (image) {
        ctx.globalAlpha = input.structurePreview.mode === 'place' ? 0.52 : 0.48;
        ctx.drawImage(
          image,
          input.structurePreview.overlay.spriteBounds.x,
          input.structurePreview.overlay.spriteBounds.y,
          input.structurePreview.overlay.spriteBounds.size,
          input.structurePreview.overlay.spriteBounds.size,
        );
      } else {
        this.drawStructurePlaceholder(
          ctx,
          input.structurePreview.overlay,
          input.structurePreview.mode === 'place' ? 0.68 : 0.58,
        );
      }

      drawStructureSelectionOverlay(ctx, input.structurePreview.overlay, {
        fill: input.structurePreview.isValid
          ? STRUCTURE_PREVIEW_FILL
          : STRUCTURE_CONFLICT_FILL,
        lineDash: [3 / Math.max(input.cameraState.zoom, 0.001), 2 / Math.max(input.cameraState.zoom, 0.001)],
        lineWidth: 1.2 / Math.max(input.cameraState.zoom, 0.001),
        stroke: input.structurePreview.isValid
          ? STRUCTURE_PREVIEW_STROKE
          : STRUCTURE_CONFLICT_STROKE,
      });
    }

    const selectedStructure =
      input.selectedSelection?.layerName === 'structures'
        ? input.structureOverlays.find(
            (structure) => structure.objectId === input.selectedSelection?.objectId,
          )
        : null;

    if (selectedStructure) {
      drawStructureSelectionOverlay(ctx, selectedStructure, {
        fill: STRUCTURE_SELECTED_FILL,
        lineWidth: 1.1 / Math.max(input.cameraState.zoom, 0.001),
        stroke: STRUCTURE_SELECTED_STROKE,
      });
    }

    const markerOverlays = [
      ...input.spawnPointOverlays,
      ...input.regionMarkerOverlays,
    ].sort((left, right) => left.sortKey - right.sortKey);
    const selectedMarker =
      input.selectedSelection?.layerName === 'spawn_points' ||
      input.selectedSelection?.layerName === 'region_markers'
        ? markerOverlays.find(
            (overlay) =>
              overlay.layerName === input.selectedSelection?.layerName &&
              overlay.objectId === input.selectedSelection?.objectId,
          ) ?? null
        : null;

    for (const marker of markerOverlays) {
      this.drawMarker(ctx, marker, {
        highlighted:
          selectedMarker?.layerName === marker.layerName &&
          selectedMarker.objectId === marker.objectId,
      });
    }

    if (input.markerPreview) {
      this.drawMarker(ctx, input.markerPreview.overlay, {
        alpha: input.markerPreview.mode === 'place' ? 0.68 : 0.58,
      });
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = PREVIEW_FILL;
    ctx.strokeStyle = PREVIEW_STROKE;

    for (const previewTile of input.previewTiles) {
      const previewWorldPoint = cartToIso(previewTile, this.tileSize);

      drawIsoDiamond(
        ctx,
        previewWorldPoint.x,
        previewWorldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.fill();

      drawIsoDiamond(
        ctx,
        previewWorldPoint.x,
        previewWorldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.stroke();
    }

    if (input.hoveredTile) {
      const hoveredWorldPoint = cartToIso(input.hoveredTile, this.tileSize);
      ctx.globalAlpha = 1;
      ctx.fillStyle = HOVER_FILL;
      drawIsoDiamond(
        ctx,
        hoveredWorldPoint.x,
        hoveredWorldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.fill();

      ctx.strokeStyle = HOVER_STROKE;
      drawIsoDiamond(
        ctx,
        hoveredWorldPoint.x,
        hoveredWorldPoint.y,
        this.tileSize.width,
        this.tileSize.height,
      );
      ctx.stroke();
    }

    if (input.tileRegionSelection) {
      this.drawTileRegionSelection(ctx, input.tileRegionSelection);
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
