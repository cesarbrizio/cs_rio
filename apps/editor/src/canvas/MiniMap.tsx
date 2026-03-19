import { useEffect, useMemo, useRef } from 'react';

import type {
  EditorMapDocument,
  EditorTileLayerState,
} from '../state/editorMapDocument';
import type { TilePaletteItem } from '../state/tilePalette';
import { useEditorStore } from '../state/editorStore';

function getTileLayer(document: EditorMapDocument, layerName: string) {
  const layer = document.layers.find(
    (entry) => entry.type === 'tilelayer' && entry.name === layerName,
  );

  return layer && layer.type === 'tilelayer' ? layer : null;
}

function buildPaletteByGid(tilePalette: TilePaletteItem[]) {
  return new Map(tilePalette.map((item) => [item.gid, item]));
}

function drawTileLayer(
  ctx: CanvasRenderingContext2D,
  layer: EditorTileLayerState | null,
  paletteByGid: Map<number, TilePaletteItem>,
  alpha = 1,
) {
  if (!layer || !layer.visible) {
    return;
  }

  for (let y = 0; y < layer.height; y += 1) {
    for (let x = 0; x < layer.width; x += 1) {
      const gid = Number(layer.data[y * layer.width + x] ?? 0);

      if (gid <= 0) {
        continue;
      }

      const paletteItem = paletteByGid.get(gid);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = paletteItem?.fill ?? '#415a46';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusTile = useEditorStore((state) => state.focusTile);
  const map = useEditorStore((state) => state.map);
  const mapDocument = useEditorStore((state) => state.mapDocument);
  const tilePalette = useEditorStore((state) => state.tilePalette);
  const visibleBounds = useEditorStore((state) => state.renderPlan.visibleBounds);
  const paletteByGid = useMemo(() => buildPaletteByGid(tilePalette), [tilePalette]);
  const terrainLayer = useMemo(() => getTileLayer(mapDocument, 'terrain'), [mapDocument]);
  const buildingsLayer = useMemo(() => getTileLayer(mapDocument, 'buildings'), [mapDocument]);
  const collisionLayer = useMemo(() => getTileLayer(mapDocument, 'collision'), [mapDocument]);
  const previewWidth = 184;
  const previewHeight = Math.max(
    92,
    Math.round((map.height / Math.max(map.width, 1)) * previewWidth),
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.width = Math.max(1, map.width);
    canvas.height = Math.max(1, map.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0c1114';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTileLayer(ctx, terrainLayer, paletteByGid, 1);
    drawTileLayer(ctx, buildingsLayer, paletteByGid, 0.9);

    if (collisionLayer?.visible) {
      for (let y = 0; y < collisionLayer.height; y += 1) {
        for (let x = 0; x < collisionLayer.width; x += 1) {
          const gid = Number(collisionLayer.data[y * collisionLayer.width + x] ?? 0);

          if (gid <= 0) {
            continue;
          }

          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#b24848';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    for (const structure of map.structures) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffe08d';
      ctx.fillRect(
        structure.gridX,
        structure.gridY,
        Math.max(1, structure.footprint.w),
        Math.max(1, structure.footprint.h),
      );
    }

    for (const spawn of map.spawnPoints) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#7cceff';
      ctx.fillRect(spawn.gridX, spawn.gridY, 1, 1);
    }

    for (const region of map.regionMarkers) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff8bd3';
      ctx.fillRect(region.gridX, region.gridY, 1, 1);
    }

    ctx.globalAlpha = 1;
  }, [buildingsLayer, collisionLayer, map, paletteByGid, terrainLayer]);

  const viewportStyle = {
    height: `${(Math.max(1, visibleBounds.maxY - visibleBounds.minY + 1) / Math.max(map.height, 1)) * 100}%`,
    left: `${(visibleBounds.minX / Math.max(map.width, 1)) * 100}%`,
    top: `${(visibleBounds.minY / Math.max(map.height, 1)) * 100}%`,
    width: `${(Math.max(1, visibleBounds.maxX - visibleBounds.minX + 1) / Math.max(map.width, 1)) * 100}%`,
  };

  return (
    <div className="minimap-shell">
      <div className="minimap-head">
        <strong>Minimap</strong>
        <span>{map.width}x{map.height}</span>
      </div>

      <button
        type="button"
        className="minimap-button"
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const tileX = Math.max(
            0,
            Math.min(
              map.width - 1,
              Math.floor(((event.clientX - bounds.left) / bounds.width) * map.width),
            ),
          );
          const tileY = Math.max(
            0,
            Math.min(
              map.height - 1,
              Math.floor(((event.clientY - bounds.top) / bounds.height) * map.height),
            ),
          );

          focusTile({ x: tileX, y: tileY });
        }}
      >
        <canvas
          ref={canvasRef}
          className="minimap-canvas"
          style={{
            height: `${previewHeight}px`,
            width: `${previewWidth}px`,
          }}
        />
        <div className="minimap-viewport" style={viewportStyle} />
      </button>
    </div>
  );
}
