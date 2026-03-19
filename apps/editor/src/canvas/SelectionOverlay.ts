import type { GridPoint } from '@engine/types';

import type { EditorStructureOverlay } from '../structures/buildStructureOverlays';

interface StructureSelectionStyle {
  fill: string;
  lineDash?: number[];
  lineWidth: number;
  stroke: string;
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  points: EditorStructureOverlay['basePoints'],
) {
  const [firstPoint, ...restPoints] = points;

  if (!firstPoint) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (const point of restPoints) {
    ctx.lineTo(point.x, point.y);
  }

  ctx.closePath();
}

export function drawStructureSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: EditorStructureOverlay,
  style: StructureSelectionStyle,
) {
  ctx.save();
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.lineDash ?? []);
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;

  tracePolygon(ctx, overlay.basePoints);
  ctx.fill();
  ctx.stroke();

  tracePolygon(ctx, overlay.lotPoints);
  ctx.stroke();

  tracePolygon(ctx, overlay.topPoints);
  ctx.stroke();

  ctx.restore();
}

export function isTileInsideStructureOverlay(
  tile: GridPoint,
  overlay: EditorStructureOverlay,
) {
  return (
    tile.x >= overlay.gridPosition.x &&
    tile.y >= overlay.gridPosition.y &&
    tile.x < overlay.gridPosition.x + overlay.footprint.w &&
    tile.y < overlay.gridPosition.y + overlay.footprint.h
  );
}

export function findStructureOverlayAtTile(
  overlays: EditorStructureOverlay[],
  tile: GridPoint,
) {
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const overlay = overlays[index];

    if (overlay && isTileInsideStructureOverlay(tile, overlay)) {
      return overlay;
    }
  }

  return null;
}
