import type { TerritoryOverviewResponse } from '@cs-rio/shared';
import { Camera } from '@engine/camera';
import { cartToIso } from '@engine/coordinates';
import { GameLoop } from '@engine/game-loop';
import { MovementController } from '@engine/movement';
import { findPath } from '@engine/pathfinding';
import type { GridPoint, Size } from '@engine/types';
import {
  useHomeMapScene,
  type EventRuntimeState,
  type UseHomeMapSceneInput,
} from '@cs-rio/ui/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import cityBaseTilesetUrl from '../../../mobile/assets/maps/city_base.png';

import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import { CameraController } from './CameraController';
import { CanvasRenderer } from './CanvasRenderer';
import { buildDemoRemoteEntities, resolveInitialPlayerSpawn } from './demo-entities';
import { buildStructureOverlays } from './structure-overlays';
import type { RendererTelemetry, SceneEntity } from './types';
import { buildInitialCameraState, buildMapWorldBounds } from './world-bounds';

interface GameCanvasProps {
  eventRuntimeState?: EventRuntimeState | null;
  onTelemetryChange?: (telemetry: RendererTelemetry) => void;
  playerFaction?: UseHomeMapSceneInput['playerFaction'];
  playerRegionId?: string | null;
  playerSpawnPosition?: { x: number; y: number } | null;
  relevantRemotePlayers?: UseHomeMapSceneInput['relevantRemotePlayers'];
  selectedMapFavelaId?: string | null;
  territoryOverview?: TerritoryOverviewResponse | null;
}

const DEFAULT_VIEWPORT: Size = {
  height: 720,
  width: 1280,
};

export function GameCanvas({
  eventRuntimeState = null,
  onTelemetryChange,
  playerFaction = null,
  playerRegionId = 'zona_norte',
  playerSpawnPosition = null,
  relevantRemotePlayers = [],
  selectedMapFavelaId = null,
  territoryOverview = null,
}: GameCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTelemetryChangeRef = useRef(onTelemetryChange);
  const graphicsSettings = useDesktopRuntimeStore((state) => state.graphicsSettings);
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);
  const {
    buildRenderPlan,
    map,
    renderEntities: worldEntities,
  } = useHomeMapScene({
    eventRuntimeState,
    hudPlayerPosition: null,
    playerFaction,
    playerRegionId,
    playerSpawnPosition,
    relevantRemotePlayers,
    selectedMapFavelaId,
    territoryOverview,
  });

  const tileSizeRef = useRef({
    height: map.tileHeight,
    width: map.tileWidth,
  });
  const resolvedSpawn = useMemo(
    () => playerSpawnPosition ?? resolveInitialPlayerSpawn(map),
    [map, playerSpawnPosition],
  );
  const playerSpawnRef = useRef(resolvedSpawn);
  const fallbackRemoteEntities = useMemo(
    () => buildDemoRemoteEntities(map, resolvedSpawn),
    [map, resolvedSpawn],
  );
  const structureOverlaysRef = useRef(buildStructureOverlays(map, tileSizeRef.current));
  const rendererRef = useRef(new CanvasRenderer(tileSizeRef.current));
  const mapBoundsRef = useRef(buildMapWorldBounds(map.width, map.height, tileSizeRef.current));
  const cameraRef = useRef(
    new Camera(buildInitialCameraState(map, DEFAULT_VIEWPORT, playerSpawnRef.current), mapBoundsRef.current),
  );
  const movementRef = useRef(new MovementController(playerSpawnRef.current, 4));
  const cameraControllerRef = useRef<CameraController | null>(null);
  const viewportRef = useRef<Size>(DEFAULT_VIEWPORT);
  const hoveredTileRef = useRef<GridPoint | null>(null);
  const selectedTileRef = useRef<GridPoint | null>(null);
  const selectedPathRef = useRef<GridPoint[]>([]);
  const telemetryTimerRef = useRef(0);
  const frameAccumulatorRef = useRef(0);
  const benchmarkRef = useRef({
    averageFps: 0,
    currentFps: 0,
    lowestFps: 0,
    samples: [] as number[],
  });
  const [lastError, setLastError] = useState<string | null>(null);

  const buildTelemetry = useCallback(
    (
      visibleBounds: RendererTelemetry['visibleBounds'],
      playerPosition: GridPoint,
    ): RendererTelemetry => {
      const benchmark = benchmarkRef.current;
      const recommendation =
        benchmark.samples.length < 120
          ? 'warming'
          : benchmark.averageFps >= 58
            ? 'keep-canvas'
            : 'evaluate-pixi';

      return {
        benchmark: {
          averageFps: benchmark.averageFps,
          currentFps: benchmark.currentFps,
          lowestFps: benchmark.lowestFps,
          recommendation,
          sampleCount: benchmark.samples.length,
        },
        hoveredTile: hoveredTileRef.current,
        pathLength: selectedPathRef.current.length,
        playerTile: {
          x: Math.round(playerPosition.x),
          y: Math.round(playerPosition.y),
        },
        remoteCount: worldEntities.filter((entity) => entity.kind === 'player').length,
        selectedTile: selectedTileRef.current,
        visibleBounds,
      };
    },
    [worldEntities],
  );

  useEffect(() => {
    onTelemetryChangeRef.current = onTelemetryChange;
  }, [onTelemetryChange]);

  useEffect(() => {
    playerSpawnRef.current = resolvedSpawn;
    movementRef.current = new MovementController(resolvedSpawn, 4);
    selectedPathRef.current = [];
    selectedTileRef.current = null;
    hoveredTileRef.current = null;
    cameraRef.current = new Camera(
      buildInitialCameraState(map, viewportRef.current, resolvedSpawn),
      mapBoundsRef.current,
    );
  }, [map, resolvedSpawn]);

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
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const width = Math.max(480, Math.floor(entry.contentRect.width));
      const height = Math.max(320, Math.floor(entry.contentRect.height));

      viewportRef.current = { height, width };
      cameraRef.current.setViewport(viewportRef.current);
      cameraRef.current.setBounds(mapBoundsRef.current);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const handleCameraChange = () => {
      cameraRef.current.getState();
    };
    const handleHoverTileChange = (hoveredTile: GridPoint | null) => {
      hoveredTileRef.current = hoveredTile;
    };
    const handleRecenter = () => {
      const nextCameraState = cameraRef.current.panTo(
        cartToIso(movementRef.current.getState().position, tileSizeRef.current),
      );

      handleCameraChange();
      return nextCameraState;
    };
    const handleTileActivate = (tile: GridPoint) => {
      selectedTileRef.current = tile;

      if (map.collisionSet.has(`${tile.x}:${tile.y}`)) {
        selectedPathRef.current = [];
        setLastError('Destino bloqueado pela camada de colisao.');
        return;
      }

      const playerPosition = movementRef.current.getState().position;
      const startTile = {
        x: Math.round(playerPosition.x),
        y: Math.round(playerPosition.y),
      };
      const nextPath = findPath(startTile, tile, map.collisionNodes, 12000);

      if (nextPath.length <= 1) {
        selectedPathRef.current = [];
        setLastError('Nao foi possivel gerar caminho ate o tile selecionado.');
        return;
      }

      movementRef.current.setPath(nextPath);
      selectedPathRef.current = nextPath;
      setLastError(null);
    };

    cameraControllerRef.current = new CameraController({
      camera: cameraRef.current,
      mapHeight: map.height,
      mapWidth: map.width,
      onCameraChange: handleCameraChange,
      onHoverTileChange: handleHoverTileChange,
      onRecenter: handleRecenter,
      onTileActivate: handleTileActivate,
      tileSize: tileSizeRef.current,
    });
    cameraControllerRef.current.attach(canvas);

    return () => {
      cameraControllerRef.current?.detach();
      cameraControllerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      setLastError('Nao foi possivel obter o contexto 2D do canvas.');
      return;
    }

    const loop = new GameLoop();

    loop.start((deltaMs, fps) => {
      const frameIntervalMs = 1000 / graphicsSettings.fpsCap;
      const viewport = viewportRef.current;
      const devicePixelRatio = window.devicePixelRatio || 1;

      frameAccumulatorRef.current += deltaMs;

      if (deltaMs !== 0 && frameAccumulatorRef.current < frameIntervalMs) {
        return;
      }

      const effectiveDeltaMs =
        frameAccumulatorRef.current > 0 ? frameAccumulatorRef.current : deltaMs;

      frameAccumulatorRef.current = 0;

      if (canvas.width !== Math.floor(viewport.width * devicePixelRatio) || canvas.height !== Math.floor(viewport.height * devicePixelRatio)) {
        canvas.width = Math.floor(viewport.width * devicePixelRatio);
        canvas.height = Math.floor(viewport.height * devicePixelRatio);
      }

      cameraRef.current.setViewport(viewport);
      cameraControllerRef.current?.update(effectiveDeltaMs);

      const movementState = movementRef.current.update(effectiveDeltaMs);
      const renderPlan = buildRenderPlan(cameraRef.current.getState());
      const entities = buildSceneEntities(
        movementState.position,
        fallbackRemoteEntities,
        worldEntities,
      );

      rendererRef.current.render(context, {
        cameraState: cameraRef.current.getState(),
        canvas,
        destinationTile: selectedTileRef.current,
        devicePixelRatio,
        entities,
        hoveredTile: hoveredTileRef.current,
        renderPlan,
        selectedPath: selectedPathRef.current,
        showGrid: graphicsSettings.detailLevel !== 'low',
        structures: graphicsSettings.detailLevel === 'low' ? [] : structureOverlaysRef.current,
        tilesetImage,
      });

      if (selectedPathRef.current.length > 0 && !movementState.isMoving) {
        selectedPathRef.current = [];
      }

      pushBenchmarkSample(fps);
      telemetryTimerRef.current += effectiveDeltaMs;

      if (telemetryTimerRef.current >= 120) {
        telemetryTimerRef.current = 0;
        const telemetry = buildTelemetry(renderPlan.visibleBounds, movementState.position);

        onTelemetryChangeRef.current?.(telemetry);
      }
    });

    return () => {
      loop.stop();
    };
  }, [buildRenderPlan, buildTelemetry, fallbackRemoteEntities, graphicsSettings.detailLevel, graphicsSettings.fpsCap, map, tilesetImage, worldEntities]);

  return (
    <div className="game-canvas-shell">
      <div className="game-canvas-stage" ref={containerRef}>
        <canvas className="game-canvas" ref={canvasRef} />
        <div className="game-canvas-hud">
          <span>`wheel` zoom</span>
          <span>`WASD` move camera</span>
          <span>`Space` recenter</span>
          <span>`Shift + drag` ou botao do meio para pan</span>
          <span>`Click` para mover o jogador</span>
        </div>
      </div>
      {lastError ? <p className="game-canvas-error">{lastError}</p> : null}
    </div>
  );

  function pushBenchmarkSample(fps: number) {
    const samples = benchmarkRef.current.samples;
    const normalizedFps = Number.isFinite(fps) ? fps : 0;

    samples.push(normalizedFps);

    if (samples.length > 240) {
      samples.shift();
    }

    const total = samples.reduce((carry, sample) => carry + sample, 0);
    benchmarkRef.current.currentFps = normalizedFps;
    benchmarkRef.current.averageFps = samples.length > 0 ? total / samples.length : 0;
    benchmarkRef.current.lowestFps = samples.length > 0 ? Math.min(...samples) : 0;
  }
}

function buildSceneEntities(
  playerPosition: GridPoint,
  fallbackRemoteEntities: SceneEntity[],
  worldEntities: Array<{
    color?: string;
    id: string;
    kind?: string;
    label?: string;
    position: { x: number; y: number };
  }>,
): SceneEntity[] {
  const mappedWorldEntities = worldEntities.map((entity) => ({
    accent: entity.color ?? '#7bb2ff',
    id: entity.id,
    kind: entity.kind === 'player' ? ('remote' as const) : ('poi' as const),
    label: entity.label ?? entity.id,
    position: entity.position,
  }));
  const hasRealtimePlayers = mappedWorldEntities.some((entity) => entity.kind === 'remote');

  return [
    {
      accent: '#f4d06f',
      id: 'local-player',
      kind: 'local',
      label: 'Jogador local',
      position: playerPosition,
    },
    ...mappedWorldEntities,
    ...(hasRealtimePlayers ? [] : fallbackRemoteEntities),
  ];
}
