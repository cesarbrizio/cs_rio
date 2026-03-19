import { cartToIso, screenToTile } from '@engine/coordinates';
import { GameLoop } from '@engine/game-loop';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { CameraState, TileSize } from '@engine/types';
import { isMapStructureKind } from '@shared/map/structureCatalog';

import cityBaseTilesetUrl from '../../../mobile/assets/maps/city_base.png';
import {
  finishToolInteraction,
  useEditorStore,
} from '../state/editorStore';
import { useStructureImageCatalog } from '../structures/useStructureImageCatalog';
import { CanvasRenderer } from './CanvasRenderer';
import { MiniMap } from './MiniMap';
import { ViewportRulers } from './ViewportRulers';
import { WebCameraController } from './WebCameraController';

export interface MapCanvasHandle {
  exportFullMapPng: (fileName: string) => Promise<boolean>;
  exportViewportPng: (fileName: string) => Promise<boolean>;
}

function toCanvasLocalPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
) {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: clientX - bounds.left,
    y: clientY - bounds.top,
  };
}

function buildMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: TileSize) {
  const corners = [
    cartToIso({ x: 0, y: 0 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: 0 }, tileSize),
    cartToIso({ x: 0, y: mapHeight - 1 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: mapHeight - 1 }, tileSize),
  ];
  const xValues = corners.map((corner) => corner.x);
  const yValues = corners.map((corner) => corner.y);

  return {
    maxX: Math.max(...xValues) + tileSize.width,
    maxY: Math.max(...yValues) + tileSize.height,
    minX: Math.min(...xValues) - tileSize.width,
    minY: Math.min(...yValues) - tileSize.height,
  };
}

function buildFullMapCameraState(mapWidth: number, mapHeight: number, tileSize: TileSize): CameraState {
  const bounds = buildMapWorldBounds(mapWidth, mapHeight, tileSize);
  const padding = 48;

  return {
    mode: 'free',
    viewportHeight: Math.max(1, Math.ceil(bounds.maxY - bounds.minY + padding * 2)),
    viewportWidth: Math.max(1, Math.ceil(bounds.maxX - bounds.minX + padding * 2)),
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    zoom: 1,
  };
}

function ensurePngFileName(fileName: string) {
  const trimmed = fileName.trim();

  if (trimmed.length === 0) {
    return 'mapa.png';
  }

  return trimmed.toLowerCase().endsWith('.png') ? trimmed : `${trimmed}.png`;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png');
  });

  if (!blob) {
    throw new Error('Falha ao gerar PNG do canvas.');
  }

  return blob;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = ensurePngFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export const MapCanvas = forwardRef<MapCanvasHandle>(function MapCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panKeyPressedRef = useRef(false);
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);
  const activeLayerName = useEditorStore((state) => state.activeLayerName);
  const activeTool = useEditorStore((state) => state.activeTool);
  const hoveredTile = useEditorStore((state) => state.hoveredTile);
  const map = useEditorStore((state) => state.map);
  const mapName = useEditorStore((state) => state.mapName);
  const overlayVisibility = useEditorStore((state) => state.overlayVisibility);
  const selectedSelection = useEditorStore((state) => state.selectedSelection);
  const structureCount = useEditorStore((state) => state.structureOverlays.length);
  const spawnCount = useEditorStore((state) => state.spawnPointOverlays.length);
  const regionCount = useEditorStore((state) => state.regionMarkerOverlays.length);
  const selectedStructureKind = useEditorStore((state) => state.selectedStructureKind);
  const tileRegionSelection = useEditorStore((state) => state.tileRegionSelection);
  const tileSize = useEditorStore((state) => state.tileSize);
  const visibleBounds = useEditorStore((state) => state.renderPlan.visibleBounds);
  const renderer = useMemo(() => new CanvasRenderer(tileSize), [tileSize]);
  const requestedStructureKinds = useMemo(
    () =>
      [
        ...new Set([
          ...map.structures
            .map((structure) => structure.kind)
            .filter((kind) => isMapStructureKind(kind)),
          selectedStructureKind,
        ]),
      ]
        .sort((left, right) => left.localeCompare(right)),
    [map.structures, selectedStructureKind],
  );
  const { imageCatalog: structureImageCatalog } = useStructureImageCatalog(
    requestedStructureKinds,
  );

  useEffect(() => {
    const image = new Image();
    image.decoding = 'async';
    image.src = cityBaseTilesetUrl;

    const handleLoad = () => setTilesetImage(image);
    image.addEventListener('load', handleLoad);

    return () => {
      image.removeEventListener('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        panKeyPressedRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        panKeyPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      panKeyPressedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const controller = new WebCameraController({
      camera: useEditorStore.getState().camera,
      mapHeight: map.height,
      mapWidth: map.width,
      onCameraChange: (nextCameraState) => useEditorStore.getState().syncCameraState(nextCameraState),
      onHoverTileChange: (nextHoveredTile) => useEditorStore.getState().setHoveredTile(nextHoveredTile),
      tileSize: useEditorStore.getState().tileSize,
    });

    controller.attach(canvas);
    return () => controller.detach();
  }, [map.height, map.width]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let activePointerId: number | null = null;
    const resolveTile = (clientX: number, clientY: number) => {
      const state = useEditorStore.getState();
      const localPoint = toCanvasLocalPoint(canvas, clientX, clientY);
      const tile = screenToTile(localPoint, state.cameraState, state.tileSize);

      return tile.x >= 0 &&
        tile.y >= 0 &&
        tile.x < state.map.width &&
        tile.y < state.map.height
        ? tile
        : null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.shiftKey || panKeyPressedRef.current) {
        return;
      }

      const tile = resolveTile(event.clientX, event.clientY);

      if (!tile) {
        return;
      }

      activePointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      useEditorStore.getState().beginToolInteraction(tile);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      const tile = resolveTile(event.clientX, event.clientY);

      if (tile) {
        useEditorStore.getState().updateToolInteraction(tile);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      const state = useEditorStore.getState();
      const tile =
        resolveTile(event.clientX, event.clientY) ??
        state.objectDragSession?.currentGrid ??
        state.toolSession?.session.currentTile;

      activePointerId = null;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (tile) {
        finishToolInteraction(tile);
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerEnd);
    canvas.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerEnd);
      canvas.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      const devicePixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      useEditorStore.getState().setViewport({ width, height });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const gameLoop = new GameLoop();
    const dirtyRef = { current: true };
    const markDirty = () => {
      dirtyRef.current = true;
    };
    const unsubscribe = useEditorStore.subscribe(markDirty);
    markDirty();

    gameLoop.start(() => {
      if (!dirtyRef.current) {
        return;
      }

      dirtyRef.current = false;
      const state = useEditorStore.getState();

      renderer.render(context, {
        cameraState: state.cameraState,
        canvas,
        collisionOverlayTiles: state.collisionOverlayTiles,
        devicePixelRatio: window.devicePixelRatio || 1,
        hoveredTile: state.hoveredTile,
        markerPreview: state.markerPreview,
        previewTiles: state.previewTiles,
        regionMarkerOverlays: state.regionMarkerOverlays,
        renderPlan: state.renderPlan,
        selectedSelection: state.selectedSelection,
        showGrid: state.overlayVisibility.grid,
        spawnPointOverlays: state.spawnPointOverlays,
        structureImageCatalog,
        structureOverlays: state.structureOverlays,
        structurePreview: state.structurePreview,
        tileRegionSelection: state.tileRegionSelection,
        tilesetImage,
      });
    });

    return () => {
      unsubscribe();
      gameLoop.stop();
    };
  }, [renderer, structureImageCatalog, tilesetImage]);

  useImperativeHandle(
    ref,
    () => ({
      exportFullMapPng: async (fileName) => {
        const state = useEditorStore.getState();
        const targetCanvas = document.createElement('canvas');
        const exportCameraState = buildFullMapCameraState(
          state.map.width,
          state.map.height,
          state.tileSize,
        );

        targetCanvas.width = exportCameraState.viewportWidth;
        targetCanvas.height = exportCameraState.viewportHeight;
        const context = targetCanvas.getContext('2d');

        if (!context) {
          return false;
        }

        renderer.render(context, {
          cameraState: exportCameraState,
          canvas: targetCanvas,
          collisionOverlayTiles: state.collisionOverlayTiles,
          devicePixelRatio: 1,
          hoveredTile: null,
          markerPreview: null,
          previewTiles: [],
          regionMarkerOverlays: state.regionMarkerOverlays,
          renderPlan: state.renderer.buildRenderPlan(state.map, exportCameraState),
          selectedSelection: null,
          showGrid: state.overlayVisibility.grid,
          spawnPointOverlays: state.spawnPointOverlays,
          structureImageCatalog,
          structureOverlays: state.structureOverlays,
          structurePreview: null,
          tileRegionSelection: null,
          tilesetImage,
        });

        const blob = await canvasToBlob(targetCanvas);
        downloadBlob(blob, fileName);
        return true;
      },
      exportViewportPng: async (fileName) => {
        const state = useEditorStore.getState();
        const targetCanvas = document.createElement('canvas');

        targetCanvas.width = Math.max(1, Math.floor(state.cameraState.viewportWidth));
        targetCanvas.height = Math.max(1, Math.floor(state.cameraState.viewportHeight));
        const context = targetCanvas.getContext('2d');

        if (!context) {
          return false;
        }

        renderer.render(context, {
          cameraState: state.cameraState,
          canvas: targetCanvas,
          collisionOverlayTiles: state.collisionOverlayTiles,
          devicePixelRatio: 1,
          hoveredTile: state.hoveredTile,
          markerPreview: state.markerPreview,
          previewTiles: state.previewTiles,
          regionMarkerOverlays: state.regionMarkerOverlays,
          renderPlan: state.renderPlan,
          selectedSelection: state.selectedSelection,
          showGrid: state.overlayVisibility.grid,
          spawnPointOverlays: state.spawnPointOverlays,
          structureImageCatalog,
          structureOverlays: state.structureOverlays,
          structurePreview: state.structurePreview,
          tileRegionSelection: state.tileRegionSelection,
          tilesetImage,
        });

        const blob = await canvasToBlob(targetCanvas);
        downloadBlob(blob, fileName);
        return true;
      },
    }),
    [renderer, structureImageCatalog, tilesetImage],
  );

  const cursorClass =
    activeTool === 'select'
      ? 'cursor-select'
      : activeTool === 'place'
        ? 'cursor-place'
        : activeTool === 'delete'
          ? 'cursor-delete'
          : activeTool === 'eyedropper'
            ? 'cursor-eyedropper'
            : 'cursor-paint';

  return (
    <div ref={containerRef} className={`map-stage ${cursorClass}`}>
      <canvas ref={canvasRef} className="map-canvas" />
      <ViewportRulers />
      <MiniMap />

      <div className="map-overlay">
        <div>
          <strong>{mapName}</strong>
          <span>
            Bounds {visibleBounds.minX},{visibleBounds.minY} &rarr; {visibleBounds.maxX},
            {visibleBounds.maxY}
          </span>
        </div>
        <div>
          <strong>{hoveredTile ? `${hoveredTile.x}, ${hoveredTile.y}` : 'Sem hover'}</strong>
          <span>
            {activeTool} &bull; {activeLayerName} &bull; {structureCount} estruturas &bull; {spawnCount} spawns
            &bull; {regionCount} regions
            {overlayVisibility.grid ? ' &bull; grid' : ''}
            {selectedSelection ? ` &bull; selecionado #${selectedSelection.objectId}` : ''}
            {tileRegionSelection ? ' &bull; regiao ativa' : ''}
          </span>
        </div>
      </div>
    </div>
  );
});
