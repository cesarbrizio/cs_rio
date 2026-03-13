import { AnimationController } from '@engine/animation';
import { Camera } from '@engine/camera';
import { cartToIso, roundGridPoint } from '@engine/coordinates';
import { GameLoop } from '@engine/game-loop';
import { InputHandler, type InputRect } from '@engine/input-handler';
import { MovementController } from '@engine/movement';
import { findPath } from '@engine/pathfinding';
import { SpriteSheet } from '@engine/spritesheet';
import { parseTilemap } from '@engine/tilemap-parser';
import { type CameraMode, type CameraState, type GridPoint, type ScreenPoint } from '@engine/types';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Path,
  Picture,
  Skia,
  createPicture,
  useImage,
  useRSXformBuffer,
  useRectBuffer,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import cityBaseTilesetSource from '../../assets/tilesets/city_base.png';
import playerBaseSpriteSource from '../../assets/sprites/player_base.png';
import { useAudio } from '../audio/AudioProvider';
import { shouldPlayWalkSfx } from '../audio/audioFeedback';
import { playerBaseSpriteSheetData } from '../data/playerBaseSpriteSheet';
import {
  type MapEntityKind,
  type MapGroundPatch,
  type MapLandmark,
} from '../data/mapRegionVisuals';
import { colors } from '../theme/colors';

interface GameEntity {
  color?: string;
  id: string;
  kind?: MapEntityKind | 'player';
  label?: string;
  position: GridPoint;
}

interface GameZone {
  accent?: string;
  center: GridPoint;
  id: string;
  label: string;
  ownerLabel?: string;
  radiusTiles?: {
    x: number;
    y: number;
  };
  relation?: 'ally' | 'enemy' | 'neutral';
}

interface GameTrail {
  accent?: string;
  id: string;
  kind: 'alley' | 'avenue' | 'stairs' | 'street';
  label: string;
  points: GridPoint[];
}

interface WorldGroundPatch {
  accent: string;
  centerWorldPoint: ScreenPoint;
  fill: string;
  id: string;
  kind: 'block' | 'blocked' | 'favela-ground' | 'slope' | 'yard';
  label?: string;
  radiusHeight: number;
  radiusWidth: number;
}

interface WorldLandmarkOverlay {
  accent: string;
  id: string;
  label: string;
  positionWorldPoint: ScreenPoint;
  shape: 'gate' | 'plaza' | 'tower' | 'warehouse';
}

export interface GameViewPlayerState {
  animation: string;
  isMoving: boolean;
  position: GridPoint;
}

interface GameViewProps {
  cameraCommand?: {
    token: number;
    type: 'follow' | 'free' | 'recenter';
  } | null;
  entities?: GameEntity[];
  mapData: Record<string, unknown>;
  onCameraModeChange?: (mode: CameraMode) => void;
  onEntityTap?: (entityId: string) => void;
  onPlayerStateChange?: (playerState: GameViewPlayerState) => void;
  onTileTap?: (tile: GridPoint) => void;
  onZoneTap?: (zoneId: string) => void;
  playerState?: {
    position: GridPoint;
  };
  groundPatches?: MapGroundPatch[];
  landmarks?: MapLandmark[];
  selectedZoneId?: string | null;
  showControlsOverlay?: boolean;
  showDebugOverlay?: boolean;
  trails?: GameTrail[];
  uiRects?: InputRect[];
  zones?: GameZone[];
}

interface WorldLabelOverlay {
  accent: string;
  entityId?: string;
  entityKind?: MapEntityKind | 'player';
  id: string;
  kind: 'entity' | 'trail' | 'zone';
  label: string;
  ownerLabel?: string;
  relation?: 'ally' | 'enemy' | 'neutral';
  selected?: boolean;
  zoneId?: string;
  x: number;
  y: number;
}

interface WorldZoneOverlay {
  accent: string;
  centerWorldPoint: ScreenPoint;
  id: string;
  label: string;
  ownerLabel?: string;
  radiusHeight: number;
  radiusWidth: number;
  relation: 'ally' | 'enemy' | 'neutral';
  selected: boolean;
}

interface WorldTrailOverlay {
  accent: string;
  id: string;
  kind: 'alley' | 'avenue' | 'stairs' | 'street';
  label: string;
  labelWorldPoint: ScreenPoint;
  worldPoints: ScreenPoint[];
}

interface DebugState {
  camera: CameraState;
  clipName: string | null;
  fps: number;
  playerPosition: GridPoint;
}

interface WorldTile {
  fill: string;
  height: number;
  sourceRect: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  width: number;
  worldX: number;
  worldY: number;
}

interface WorldTileLayer {
  key: string;
  opacity: number;
  tiles: WorldTile[];
}

const INITIAL_VIEWPORT_SIZE = 1;
const SPRITE_IDLE_FALLBACK = 'idle_s';

export function GameView({
  cameraCommand = null,
  entities = [],
  mapData,
  onCameraModeChange,
  onEntityTap,
  onPlayerStateChange,
  onTileTap,
  onZoneTap,
  playerState,
  groundPatches = [],
  landmarks = [],
  selectedZoneId = null,
  showControlsOverlay = false,
  showDebugOverlay = false,
  trails = [],
  uiRects = [],
  zones = [],
}: GameViewProps): JSX.Element {
  const { playSfx } = useAudio();
  const map = useMemo(() => parseTilemap(mapData), [mapData]);
  const tileSize = useMemo(
    () => ({
      width: map.tileWidth,
      height: map.tileHeight,
    }),
    [map.tileHeight, map.tileWidth],
  );
  const spriteSheet = useMemo(
    () => SpriteSheet.fromAseprite(playerBaseSpriteSheetData, 'player-base'),
    [],
  );
  const mapTilesetImage = useImage(cityBaseTilesetSource);
  const playerImage = useImage(playerBaseSpriteSource);
  const spawnTile = useMemo<GridPoint>(() => {
    if (playerState?.position) {
      return playerState.position;
    }

    const spawnPoint = map.spawnPoints[0];

    if (spawnPoint) {
      return {
        x: spawnPoint.gridX,
        y: spawnPoint.gridY,
      };
    }

    return {
      x: Math.floor(map.width / 2),
      y: Math.floor(map.height / 2),
    };
  }, [map.height, map.spawnPoints, map.width, playerState?.position]);
  const initialWorldPosition = useMemo(() => cartToIso(spawnTile, tileSize), [spawnTile, tileSize]);
  const initialCameraState = useMemo<CameraState>(
    () => ({
      x: initialWorldPosition.x,
      y: initialWorldPosition.y,
      zoom: 1.72,
      viewportWidth: INITIAL_VIEWPORT_SIZE,
      viewportHeight: INITIAL_VIEWPORT_SIZE,
      mode: 'follow',
      deadZoneWidth: 220,
      deadZoneHeight: 120,
    }),
    [initialWorldPosition.x, initialWorldPosition.y],
  );
  const mapBounds = useMemo(() => getMapWorldBounds(map.width, map.height, tileSize), [map.height, map.width, tileSize]);
  const worldTileLayers = useMemo(() => buildWorldTileLayers(map, tileSize), [map, tileSize]);
  const mapPicture = useMemo(
    () => buildMapPicture(worldTileLayers, mapBounds, mapTilesetImage, tileSize),
    [mapBounds, mapTilesetImage, tileSize, worldTileLayers],
  );
  const initialFrame = useMemo(
    () => spriteSheet.getFrame('idle_s_0') ?? spriteSheet.getFrameIds().map((id) => spriteSheet.getFrame(id)).find(Boolean),
    [spriteSheet],
  );
  const cameraRef = useRef<Camera>(new Camera(initialCameraState, mapBounds));
  const movementRef = useRef<MovementController>(new MovementController(spawnTile, 3));
  const animationRef = useRef<AnimationController>(new AnimationController(spriteSheet, SPRITE_IDLE_FALLBACK));
  const inputHandlerRef = useRef(
    new InputHandler({
      cameraProvider: () => cameraRef.current.getState(),
      tileSize,
    }),
  );
  const facingDirectionRef = useRef('s');
  const fpsTimestampRef = useRef(0);
  const inertiaVelocityRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const lastWalkSfxAtRef = useRef(0);
  const isPanningRef = useRef(false);
  const panOriginRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const panStartRef = useRef<CameraState>(initialCameraState);
  const pinchStartZoomRef = useRef(initialCameraState.zoom);
  const debugPanelRectRef = useRef<InputRect | null>(null);
  const controlsRectRef = useRef<InputRect | null>(null);
  const debugCameraRef = useRef(initialCameraState);
  const debugPathLengthRef = useRef(0);
  const lastCameraCommandTokenRef = useRef<number | null>(null);
  const onCameraModeChangeRef = useRef(onCameraModeChange);
  const onPlayerStateChangeRef = useRef(onPlayerStateChange);
  const cameraMatrixValue = useSharedValue<number[]>(createCameraMatrix(initialCameraState));
  const playerWorldXValue = useSharedValue(initialWorldPosition.x);
  const playerWorldYValue = useSharedValue(initialWorldPosition.y);
  const playerHaloYValue = useSharedValue(initialWorldPosition.y - 10);
  const playerBeaconYValue = useSharedValue(initialWorldPosition.y - 34);
  const playerMarkerYValue = useSharedValue(initialWorldPosition.y - 8);
  const playerFrameValue = useSharedValue({
    x: initialFrame?.x ?? 0,
    y: initialFrame?.y ?? 0,
    width: initialFrame?.width ?? 48,
    height: initialFrame?.height ?? 64,
  });
  const [selectedTile, setSelectedTile] = useState<GridPoint | null>(spawnTile);
  const [playerPath, setPlayerPath] = useState<GridPoint[]>([]);
  const [debugState, setDebugState] = useState<DebugState>({
    camera: initialCameraState,
    clipName: SPRITE_IDLE_FALLBACK,
    fps: 0,
    playerPosition: spawnTile,
  });
  const playerSpriteBuffer = useRectBuffer(1, (rect) => {
    'worklet';
    rect.setXYWH(
      playerFrameValue.value.x,
      playerFrameValue.value.y,
      playerFrameValue.value.width,
      playerFrameValue.value.height,
    );
  });
  const playerTransformBuffer = useRSXformBuffer(1, (transform) => {
    'worklet';
    transform.set(
      1,
      0,
      playerWorldXValue.value - playerFrameValue.value.width / 2,
      playerWorldYValue.value - playerFrameValue.value.height + 6,
    );
  });

  useEffect(() => {
    onCameraModeChangeRef.current = onCameraModeChange;
  }, [onCameraModeChange]);

  useEffect(() => {
    onPlayerStateChangeRef.current = onPlayerStateChange;
  }, [onPlayerStateChange]);

  const syncCameraDebug = useCallback((cameraState: CameraState) => {
    debugCameraRef.current = cameraState;
    cameraMatrixValue.value = createCameraMatrix(cameraState);
  }, [cameraMatrixValue]);

  useEffect(() => {
    cameraRef.current = new Camera(initialCameraState, mapBounds);
    movementRef.current = new MovementController(spawnTile, 3);
    animationRef.current = new AnimationController(spriteSheet, SPRITE_IDLE_FALLBACK);
    inputHandlerRef.current = new InputHandler({
      cameraProvider: () => cameraRef.current.getState(),
      tileSize,
    });
    facingDirectionRef.current = 's';
    inertiaVelocityRef.current = { x: 0, y: 0 };
    isPanningRef.current = false;
    debugCameraRef.current = cameraRef.current.getState();
    debugPathLengthRef.current = 0;
    cameraMatrixValue.value = createCameraMatrix(debugCameraRef.current);
    playerWorldXValue.value = initialWorldPosition.x;
    playerWorldYValue.value = initialWorldPosition.y;
    playerHaloYValue.value = initialWorldPosition.y - 10;
    playerBeaconYValue.value = initialWorldPosition.y - 34;
    playerMarkerYValue.value = initialWorldPosition.y - 8;
    playerFrameValue.value = {
      x: initialFrame?.x ?? 0,
      y: initialFrame?.y ?? 0,
      width: initialFrame?.width ?? 48,
      height: initialFrame?.height ?? 64,
    };
    setSelectedTile(spawnTile);
    setPlayerPath([]);
    setDebugState({
      camera: debugCameraRef.current,
      clipName: SPRITE_IDLE_FALLBACK,
      fps: 0,
      playerPosition: spawnTile,
    });
    lastCameraCommandTokenRef.current = null;
    onCameraModeChangeRef.current?.(initialCameraState.mode ?? 'follow');
  }, [
    cameraMatrixValue,
    initialCameraState,
    initialFrame,
    initialWorldPosition.x,
    initialWorldPosition.y,
    mapBounds,
    playerFrameValue,
    playerHaloYValue,
    playerBeaconYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    spawnTile,
    spriteSheet,
    tileSize,
  ]);

  useEffect(() => {
    if (!cameraCommand) {
      return;
    }

    if (lastCameraCommandTokenRef.current === cameraCommand.token) {
      return;
    }

    lastCameraCommandTokenRef.current = cameraCommand.token;

    if (cameraCommand.type === 'free') {
      syncCameraDebug(cameraRef.current.setMode('free'));
      onCameraModeChangeRef.current?.('free');
      return;
    }

    const currentPlayerPosition = movementRef.current.getState().position;
    const worldPoint = cartToIso(currentPlayerPosition, tileSize);

    if (cameraCommand.type === 'recenter') {
      syncCameraDebug(cameraRef.current.panTo(worldPoint));
      onCameraModeChangeRef.current?.(cameraRef.current.getState().mode ?? 'free');
      return;
    }

    syncCameraDebug(cameraRef.current.setMode('follow'));
    syncCameraDebug(cameraRef.current.panTo(worldPoint));
    onCameraModeChangeRef.current?.('follow');
  }, [cameraCommand, syncCameraDebug, tileSize]);

  const resolveDestination = useCallback(
    (tile: GridPoint) => {
      if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) {
        return;
      }

      setSelectedTile(tile);
      onTileTap?.(tile);

      const tappedEntity = entities.find((entity) => {
        const entityTile = roundGridPoint(entity.position);
        return entityTile.x === tile.x && entityTile.y === tile.y;
      });

      if (tappedEntity) {
        onEntityTap?.(tappedEntity.id);
      }

      if (map.collisionSet.has(`${tile.x}:${tile.y}`)) {
        movementRef.current.cancelPath();
        debugPathLengthRef.current = 0;
        setPlayerPath([]);
        return;
      }

      const path = findPath(
        roundGridPoint(movementRef.current.getState().position),
        tile,
        map.collisionNodes,
      );

      if (path.length === 0) {
        return;
      }

      syncCameraDebug(cameraRef.current.setMode('follow'));
      onCameraModeChangeRef.current?.('follow');
      const nextMovementState = movementRef.current.setPath(path);
      debugPathLengthRef.current = nextMovementState.path.length;
      setPlayerPath(nextMovementState.path);

      const nowMs = Date.now();

      if (shouldPlayWalkSfx(lastWalkSfxAtRef.current, nowMs)) {
        lastWalkSfxAtRef.current = nowMs;
        void playSfx('walk');
      }
    },
    [entities, map, onEntityTap, onTileTap, playSfx, syncCameraDebug],
  );

  const handlePan = useCallback((delta: ScreenPoint) => {
    const startState = panStartRef.current;
    syncCameraDebug(
      cameraRef.current.panTo({
        x: startState.x - delta.x / startState.zoom,
        y: startState.y - delta.y / startState.zoom,
      }),
    );
  }, [syncCameraDebug]);

  const handlePinch = useCallback((scale: number, anchor: ScreenPoint) => {
    syncCameraDebug(cameraRef.current.zoomTo(pinchStartZoomRef.current * scale, anchor));
  }, [syncCameraDebug]);

  useEffect(() => {
    const nextUiRects = [
      ...uiRects,
      showDebugOverlay ? debugPanelRectRef.current : null,
      showControlsOverlay ? controlsRectRef.current : null,
    ].flatMap((rect) => (rect ? [rect] : []));

    inputHandlerRef.current.setTileSize(tileSize);
    inputHandlerRef.current.setUiRects(nextUiRects);
    inputHandlerRef.current.setCallbacks({
      onLongPress: (tile) => {
        setSelectedTile(tile);
      },
      onPan: (delta) => {
        handlePan(delta);
      },
      onPinch: (scale, anchor) => {
        handlePinch(scale, anchor);
      },
      onTap: (tile) => {
        resolveDestination(tile);
      },
    });
  }, [handlePan, handlePinch, resolveDestination, showControlsOverlay, showDebugOverlay, tileSize, uiRects]);

  useEffect(() => {
    const loop = new GameLoop();

    loop.start((deltaMs, nextFps) => {
      const nextMovementState = movementRef.current.update(deltaMs);

      if (nextMovementState.direction !== 'idle') {
        facingDirectionRef.current = mapDirectionToSprite(nextMovementState.direction);
      }

      const desiredClip = `${nextMovementState.isMoving ? 'walk' : 'idle'}_${facingDirectionRef.current}`;

      if (animationRef.current.getState().clipName !== desiredClip) {
        animationRef.current.play(desiredClip, {
          reset: true,
        });
      }

      const nextFrameId = animationRef.current.update(deltaMs);
      const nextFrame = nextFrameId ? spriteSheet.getFrame(nextFrameId) : undefined;
      const nextWorldPosition = cartToIso(nextMovementState.position, tileSize);
      let nextCameraState = cameraRef.current.updateFollowTarget(nextWorldPosition);

      if (
        !isPanningRef.current &&
        Math.abs(inertiaVelocityRef.current.x) + Math.abs(inertiaVelocityRef.current.y) > 0 &&
        cameraRef.current.getState().mode === 'free'
      ) {
        inertiaVelocityRef.current = cameraRef.current.applyInertia(inertiaVelocityRef.current, deltaMs);
        nextCameraState = cameraRef.current.getState();
      }

      if (hasCameraChanged(debugCameraRef.current, nextCameraState)) {
        syncCameraDebug(nextCameraState);
      }

      playerWorldXValue.value = nextWorldPosition.x;
      playerWorldYValue.value = nextWorldPosition.y;
      playerHaloYValue.value = nextWorldPosition.y - 10;
      playerBeaconYValue.value = nextWorldPosition.y - 34;
      playerMarkerYValue.value = nextWorldPosition.y - 8;

      if (nextFrame) {
        playerFrameValue.value = {
          x: nextFrame.x,
          y: nextFrame.y,
          width: nextFrame.width,
          height: nextFrame.height,
        };
      }

      if (nextMovementState.path.length !== debugPathLengthRef.current) {
        debugPathLengthRef.current = nextMovementState.path.length;
        setPlayerPath(nextMovementState.path.map((point) => ({ ...point })));
      }

      onPlayerStateChangeRef.current?.({
        animation: desiredClip,
        isMoving: nextMovementState.isMoving,
        position: {
          x: nextMovementState.position.x,
          y: nextMovementState.position.y,
        },
      });

      if (performance.now() - fpsTimestampRef.current > 250) {
        fpsTimestampRef.current = performance.now();
        setDebugState({
          camera: debugCameraRef.current,
          clipName: animationRef.current.getState().clipName,
          fps: Math.round(nextFps),
          playerPosition: {
            x: nextMovementState.position.x,
            y: nextMovementState.position.y,
          },
        });
      }
    });

    return () => {
      loop.stop();
    };
  }, [
    playerBeaconYValue,
    playerFrameValue,
    playerHaloYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    spriteSheet,
    syncCameraDebug,
    tileSize,
  ]);

  const selectedTileWorldPoint = useMemo(
    () => (selectedTile ? cartToIso(selectedTile, tileSize) : null),
    [selectedTile, tileSize],
  );
  const destinationOverlay = useMemo(() => {
    if (!selectedTileWorldPoint) {
      return null;
    }

    const screenPoint = projectWorldToScreen(debugState.camera, {
      x: selectedTileWorldPoint.x,
      y: selectedTileWorldPoint.y - 30,
    });

    if (!isOverlayVisible(screenPoint, debugState.camera.viewportWidth, debugState.camera.viewportHeight, 16)) {
      return null;
    }

    return clampOverlayPosition(
      debugState.camera.viewportWidth,
      debugState.camera.viewportHeight,
      screenPoint.x - 42,
      screenPoint.y - 14,
      84,
      24,
    );
  }, [debugState.camera, selectedTileWorldPoint]);
  const pathWorldPoints = useMemo(
    () => playerPath.map((point) => cartToIso(point, tileSize)),
    [playerPath, tileSize],
  );
  const zoneWorldOverlays = useMemo<WorldZoneOverlay[]>(
    () =>
      zones.map((zone) => {
        const radiusTiles = zone.radiusTiles ?? { x: 5, y: 4 };

        return {
          accent: zone.accent ?? colors.accent,
          centerWorldPoint: cartToIso(zone.center, tileSize),
          id: zone.id,
          label: zone.label,
          ownerLabel: zone.ownerLabel,
          radiusHeight: tileSize.height * radiusTiles.y,
          radiusWidth: tileSize.width * radiusTiles.x,
          relation: zone.relation ?? 'neutral',
          selected: zone.id === selectedZoneId,
        };
      }),
    [selectedZoneId, tileSize, zones],
  );
  const trailWorldOverlays = useMemo<WorldTrailOverlay[]>(
    () =>
      trails
        .filter((trail) => trail.points.length >= 2)
        .map((trail) => {
          const worldPoints = trail.points.map((point) => cartToIso(point, tileSize));
          const midpoint = worldPoints[Math.floor(worldPoints.length / 2)] ?? worldPoints[0];

          return {
            accent: trail.accent ?? colors.info,
            id: trail.id,
            kind: trail.kind,
            label: trail.label,
            labelWorldPoint: midpoint,
            worldPoints,
          };
        }),
    [tileSize, trails],
  );
  const groundWorldPatches = useMemo<WorldGroundPatch[]>(
    () =>
      groundPatches.map((patch) => ({
        accent: patch.accent ?? colors.accent,
        centerWorldPoint: cartToIso(patch.center, tileSize),
        fill: patch.fill,
        id: patch.id,
        kind: patch.kind,
        label: patch.label,
        radiusHeight: tileSize.height * patch.radiusTiles.y,
        radiusWidth: tileSize.width * patch.radiusTiles.x,
      })),
    [groundPatches, tileSize],
  );
  const landmarkWorldOverlays = useMemo<WorldLandmarkOverlay[]>(
    () =>
      landmarks.map((landmark) => ({
        accent: landmark.accent ?? colors.warning,
        id: landmark.id,
        label: landmark.label,
        positionWorldPoint: cartToIso(landmark.position, tileSize),
        shape: landmark.shape,
      })),
    [landmarks, tileSize],
  );
  const entityWorldPoints = useMemo(
    () =>
      entities.map((entity) => ({
        ...entity,
        worldPoint: cartToIso(entity.position, tileSize),
      })),
    [entities, tileSize],
  );
  const spatialLabelOverlays = useMemo<WorldLabelOverlay[]>(() => {
    const labels: WorldLabelOverlay[] = [];

    for (const zone of zoneWorldOverlays) {
      const screenPoint = projectWorldToScreen(debugState.camera, zone.centerWorldPoint);

      if (isOverlayVisible(screenPoint, debugState.camera.viewportWidth, debugState.camera.viewportHeight)) {
        const clampedPosition = clampOverlayPosition(
          debugState.camera.viewportWidth,
          debugState.camera.viewportHeight,
          screenPoint.x - 38,
          screenPoint.y - zone.radiusHeight * debugState.camera.zoom * 0.45 - 18,
          132,
          zone.ownerLabel ? 42 : 22,
        );
        labels.push({
          accent: zone.accent,
          id: `zone:${zone.id}`,
          kind: 'zone',
          label: zone.label,
          ownerLabel: zone.ownerLabel,
          relation: zone.relation,
          selected: zone.selected,
          zoneId: zone.id,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    for (const entity of entityWorldPoints) {
      if (!entity.label) {
        continue;
      }

      const screenPoint = projectWorldToScreen(debugState.camera, {
        x: entity.worldPoint.x,
        y: entity.worldPoint.y - 24,
      });

      if (
        isOverlayVisible(screenPoint, debugState.camera.viewportWidth, debugState.camera.viewportHeight, 0) &&
        screenPoint.x > 56 &&
        screenPoint.y > 36 &&
        screenPoint.x < debugState.camera.viewportWidth - 96 &&
        screenPoint.y < debugState.camera.viewportHeight - 52
      ) {
        const clampedPosition = clampOverlayPosition(
          debugState.camera.viewportWidth,
          debugState.camera.viewportHeight,
          screenPoint.x + 10,
          screenPoint.y - 18,
          124,
          22,
        );
        labels.push({
          accent: entity.color ?? colors.accent,
          entityId: entity.id,
          entityKind: entity.kind,
          id: `entity:${entity.id}`,
          kind: 'entity',
          label: entity.label,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    for (const landmark of landmarkWorldOverlays) {
      const screenPoint = projectWorldToScreen(debugState.camera, {
        x: landmark.positionWorldPoint.x,
        y: landmark.positionWorldPoint.y - 18,
      });

      if (
        isOverlayVisible(screenPoint, debugState.camera.viewportWidth, debugState.camera.viewportHeight) &&
        screenPoint.x > 48 &&
        screenPoint.y > 32 &&
        screenPoint.x < debugState.camera.viewportWidth - 112 &&
        screenPoint.y < debugState.camera.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          debugState.camera.viewportWidth,
          debugState.camera.viewportHeight,
          screenPoint.x - 44,
          screenPoint.y - 16,
          118,
          22,
        );
        labels.push({
          accent: landmark.accent,
          id: `landmark:${landmark.id}`,
          kind: 'entity',
          label: landmark.label,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    return labels;
  }, [debugState.camera, entityWorldPoints, landmarkWorldOverlays, zoneWorldOverlays]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    if (width <= 0 || height <= 0) {
      return;
    }

    syncCameraDebug(cameraRef.current.setViewport({ width, height }));
  }, [syncCameraDebug]);

  const handlePanelLayout = useCallback((key: 'controls' | 'debug', event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    const rect = { x, y, width, height };

    if (key === 'debug') {
      debugPanelRectRef.current = rect;
    } else {
      controlsRectRef.current = rect;
    }

    inputHandlerRef.current.setUiRects(
      [
        ...uiRects,
        showDebugOverlay ? debugPanelRectRef.current : null,
        showControlsOverlay ? controlsRectRef.current : null,
      ].flatMap((item) => (item ? [item] : [])),
    );
  }, [showControlsOverlay, showDebugOverlay, uiRects]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .maxDuration(250)
        .maxDistance(12)
        .onEnd((event, success) => {
          if (!success) {
            return;
          }

          inputHandlerRef.current.handleTap({ x: event.x, y: event.y });
        }),
    [],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .minDuration(350)
        .onStart((event) => {
          inputHandlerRef.current.handleLongPress({ x: event.x, y: event.y });
        }),
    [],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(4)
        .onStart((event) => {
          panOriginRef.current = { x: event.x, y: event.y };
          panStartRef.current = cameraRef.current.getState();
          inertiaVelocityRef.current = { x: 0, y: 0 };
          isPanningRef.current = true;
          syncCameraDebug(cameraRef.current.setMode('free'));
          onCameraModeChangeRef.current?.('free');
        })
        .onUpdate((event) => {
          inputHandlerRef.current.handlePan(panOriginRef.current, {
            x: event.translationX,
            y: event.translationY,
          });
          inertiaVelocityRef.current = {
            x: event.velocityX,
            y: event.velocityY,
          };
        })
        .onEnd((event) => {
          isPanningRef.current = false;
          inertiaVelocityRef.current = {
            x: event.velocityX,
            y: event.velocityY,
          };
        }),
    [syncCameraDebug],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
          pinchStartZoomRef.current = cameraRef.current.getState().zoom;
        })
        .onUpdate((event) => {
          inputHandlerRef.current.handlePinch(event.scale, {
            x: event.focalX,
            y: event.focalY,
          });
        }),
    [],
  );

  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        pinchGesture,
        Gesture.Race(panGesture, Gesture.Exclusive(longPressGesture, tapGesture)),
      ),
    [longPressGesture, panGesture, pinchGesture, tapGesture],
  );

  return (
    <View onLayout={handleLayout} style={styles.wrapper}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.canvasFrame}>
          <Canvas style={styles.canvas}>
            <Group matrix={cameraMatrixValue}>
              {mapPicture ? <Picture picture={mapPicture} /> : null}

              {groundWorldPatches.map((patch) => (
                <Group key={patch.id}>
                  <Path
                    color={resolveGroundPatchFill(patch)}
                    path={createNeighborhoodPatchPath(
                      patch.centerWorldPoint.x,
                      patch.centerWorldPoint.y,
                      patch.radiusWidth,
                      patch.radiusHeight,
                    )}
                  />
                  <Path
                    color={resolveGroundPatchStroke(patch)}
                    path={createNeighborhoodPatchPath(
                      patch.centerWorldPoint.x,
                      patch.centerWorldPoint.y,
                      patch.radiusWidth,
                      patch.radiusHeight,
                    )}
                    style="stroke"
                    strokeWidth={patch.kind === 'blocked' ? 4 : patch.kind === 'favela-ground' ? 3 : 2}
                  />
                  {patch.kind === 'yard' ? (
                    <Path
                      color="rgba(240, 225, 182, 0.14)"
                      path={createNeighborhoodPatchPath(
                        patch.centerWorldPoint.x,
                        patch.centerWorldPoint.y,
                        patch.radiusWidth * 0.82,
                        patch.radiusHeight * 0.82,
                      )}
                    />
                  ) : null}
                  {patch.kind === 'slope' ? (
                    <>
                      {[-0.42, -0.08, 0.26].map((offset) => (
                        <Path
                          key={`${patch.id}:${offset}`}
                          color="rgba(234, 226, 197, 0.18)"
                          path={createLinePath(
                            {
                              x: patch.centerWorldPoint.x - patch.radiusWidth * 0.72,
                              y: patch.centerWorldPoint.y + patch.radiusHeight * offset,
                            },
                            {
                              x: patch.centerWorldPoint.x + patch.radiusWidth * 0.62,
                              y: patch.centerWorldPoint.y + patch.radiusHeight * (offset - 0.24),
                            },
                          )}
                          style="stroke"
                          strokeWidth={3}
                        />
                      ))}
                    </>
                  ) : null}
                  {patch.kind === 'blocked' ? (
                    <>
                      <Path
                        color={toAlphaHex(patch.accent, 0.7)}
                        path={createLinePath(
                          {
                            x: patch.centerWorldPoint.x - patch.radiusWidth * 0.55,
                            y: patch.centerWorldPoint.y - patch.radiusHeight * 0.55,
                          },
                          {
                            x: patch.centerWorldPoint.x + patch.radiusWidth * 0.55,
                            y: patch.centerWorldPoint.y + patch.radiusHeight * 0.55,
                          },
                        )}
                        style="stroke"
                        strokeWidth={3}
                      />
                      <Path
                        color={toAlphaHex(patch.accent, 0.7)}
                        path={createLinePath(
                          {
                            x: patch.centerWorldPoint.x + patch.radiusWidth * 0.55,
                            y: patch.centerWorldPoint.y - patch.radiusHeight * 0.55,
                          },
                          {
                            x: patch.centerWorldPoint.x - patch.radiusWidth * 0.55,
                            y: patch.centerWorldPoint.y + patch.radiusHeight * 0.55,
                          },
                        )}
                        style="stroke"
                        strokeWidth={3}
                      />
                    </>
                  ) : null}
                </Group>
              ))}

              {trailWorldOverlays.map((trail) => (
                <Group key={trail.id}>
                  <Path
                    color={trail.kind === 'avenue' ? 'rgba(18, 18, 18, 0.52)' : 'rgba(18, 18, 18, 0.42)'}
                    path={createPolylinePath(trail.worldPoints)}
                    style="stroke"
                    strokeCap="round"
                    strokeJoin="round"
                    strokeWidth={trail.kind === 'avenue' ? 30 : trail.kind === 'street' ? 22 : trail.kind === 'alley' ? 14 : 18}
                  />
                  <Path
                    color={trail.kind === 'avenue' ? 'rgba(108, 107, 101, 0.88)' : trail.kind === 'street' ? 'rgba(126, 121, 111, 0.82)' : trail.kind === 'alley' ? 'rgba(94, 90, 84, 0.78)' : 'rgba(156, 146, 118, 0.72)'}
                    path={createPolylinePath(trail.worldPoints)}
                    style="stroke"
                    strokeCap="round"
                    strokeJoin="round"
                    strokeWidth={trail.kind === 'avenue' ? 22 : trail.kind === 'street' ? 14 : trail.kind === 'alley' ? 8 : 10}
                  />
                  <Path
                    color={trail.kind === 'avenue' ? 'rgba(234, 223, 188, 0.7)' : trail.kind === 'street' ? 'rgba(222, 212, 184, 0.54)' : trail.kind === 'alley' ? 'rgba(214, 204, 180, 0.28)' : toAlphaHex(trail.accent, 0.44)}
                    path={createPolylinePath(trail.worldPoints)}
                    style="stroke"
                    strokeCap="round"
                    strokeJoin="round"
                    strokeWidth={trail.kind === 'avenue' ? 3.5 : trail.kind === 'street' ? 2.5 : trail.kind === 'stairs' ? 1.75 : 1.5}
                  />
                </Group>
              ))}

              {landmarkWorldOverlays.map((landmark) => (
                <Group key={landmark.id}>
                  <Path
                    color={toAlphaHex(landmark.accent, 0.18)}
                    path={createDiamondPath(
                      landmark.positionWorldPoint.x,
                      landmark.positionWorldPoint.y,
                      landmark.shape === 'warehouse' ? 26 : 22,
                      landmark.shape === 'tower' ? 18 : 16,
                    )}
                  />
                  <Path
                    color={toAlphaHex(landmark.accent, 0.64)}
                    path={createDiamondPath(
                      landmark.positionWorldPoint.x,
                      landmark.positionWorldPoint.y,
                      landmark.shape === 'warehouse' ? 18 : 16,
                      landmark.shape === 'tower' ? 14 : 12,
                    )}
                  />
                  <Circle
                    color={toAlphaHex(landmark.accent, 0.96)}
                    cx={landmark.positionWorldPoint.x}
                    cy={landmark.positionWorldPoint.y - (landmark.shape === 'tower' ? 16 : 10)}
                    r={landmark.shape === 'plaza' ? 4 : 5}
                  />
                </Group>
              ))}

              {zoneWorldOverlays.map((zone) => (
                <Group key={zone.id}>
                  <Path
                    color={`${zone.accent}${zone.selected ? '54' : '36'}`}
                    path={createDiamondPath(
                      zone.centerWorldPoint.x,
                      zone.centerWorldPoint.y,
                      zone.radiusWidth,
                      zone.radiusHeight,
                    )}
                  />
                  <Path
                    color={`${zone.accent}${zone.selected ? 'ff' : '88'}`}
                    path={createDiamondPath(
                      zone.centerWorldPoint.x,
                      zone.centerWorldPoint.y,
                      zone.radiusWidth,
                      zone.radiusHeight,
                    )}
                    style="stroke"
                    strokeWidth={zone.selected ? 5 : 3}
                  />
                  {zone.selected ? (
                    <Circle
                      color={toAlphaHex(zone.accent, 0.94)}
                      cx={zone.centerWorldPoint.x}
                      cy={zone.centerWorldPoint.y - 8}
                      r={7}
                    />
                  ) : null}
                </Group>
              ))}

              {selectedTileWorldPoint ? (
                <>
                  <Path
                    color="rgba(224, 176, 75, 0.22)"
                    path={createDiamondPath(
                      selectedTileWorldPoint.x,
                      selectedTileWorldPoint.y,
                      tileSize.width * 1.36,
                      tileSize.height * 1.36,
                    )}
                  />
                  <Path
                    color="rgba(224, 176, 75, 0.54)"
                    path={createDiamondPath(
                      selectedTileWorldPoint.x,
                      selectedTileWorldPoint.y,
                      tileSize.width * 1.12,
                      tileSize.height * 1.12,
                    )}
                    style="stroke"
                    strokeWidth={4}
                  />
                  <Circle
                    color="rgba(244, 241, 232, 0.76)"
                    cx={selectedTileWorldPoint.x}
                    cy={selectedTileWorldPoint.y - 10}
                    r={5}
                  />
                  <Circle
                    color="rgba(244, 241, 232, 0.28)"
                    cx={selectedTileWorldPoint.x}
                    cy={selectedTileWorldPoint.y - 10}
                    r={11}
                  />
                </>
              ) : null}

              {pathWorldPoints.length > 1 ? (
                <Path
                  color="rgba(244, 225, 174, 0.5)"
                  path={createPolylinePath(pathWorldPoints.map((point) => ({ x: point.x, y: point.y - 10 })))}
                  style="stroke"
                  strokeCap="round"
                  strokeJoin="round"
                  strokeWidth={4}
                />
              ) : null}

              {pathWorldPoints.map((point, index) => (
                <Circle
                  color="rgba(244, 241, 232, 0.58)"
                  cx={point.x}
                  cy={point.y - 10}
                  key={`${point.x}:${point.y}:${index}`}
                  r={index === pathWorldPoints.length - 1 ? 7 : 4}
                />
              ))}

              {entityWorldPoints.map((entity) => (
                <Group key={entity.id}>
                  {renderMapEntityMarker(entity)}
                </Group>
              ))}

              <Circle color="rgba(17, 17, 17, 0.28)" cx={playerWorldXValue} cy={playerWorldYValue} r={18} />
              <Circle color="rgba(63, 163, 77, 0.24)" cx={playerWorldXValue} cy={playerHaloYValue} r={34} />
              <Circle color="rgba(63, 163, 77, 0.42)" cx={playerWorldXValue} cy={playerHaloYValue} r={24} />
              <Circle color="rgba(244, 241, 232, 0.84)" cx={playerWorldXValue} cy={playerBeaconYValue} r={6} />

              {playerImage ? (
                <Atlas image={playerImage} sprites={playerSpriteBuffer} transforms={playerTransformBuffer} />
              ) : (
                <Circle color={colors.success} cx={playerWorldXValue} cy={playerWorldYValue} r={12} />
              )}

              <Circle color="rgba(63, 163, 77, 0.96)" cx={playerWorldXValue} cy={playerMarkerYValue} r={7} />
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {spatialLabelOverlays.length > 0 ? (
        <View pointerEvents="box-none" style={styles.spatialLabelLayer}>
          {spatialLabelOverlays.map((overlay) => (
            overlay.kind === 'zone' && overlay.zoneId && onZoneTap ? (
              <Pressable
                key={overlay.id}
                onPress={() => {
                  onZoneTap(overlay.zoneId!);
                }}
                style={({ pressed }) => [
                  styles.spatialLabel,
                  styles.zoneLabel,
                  overlay.relation === 'ally' ? styles.allyZoneLabel : null,
                  overlay.relation === 'enemy' ? styles.enemyZoneLabel : null,
                  overlay.relation === 'neutral' ? styles.neutralZoneLabel : null,
                  overlay.selected ? styles.selectedZoneLabel : null,
                  pressed ? styles.pressedZoneLabel : null,
                  {
                    borderColor: `${overlay.accent}${overlay.selected ? 'ff' : '88'}`,
                    left: overlay.x,
                    top: overlay.y,
                  },
                ]}
              >
                <Text numberOfLines={2} style={styles.spatialLabelText}>
                  {overlay.label}
                </Text>
                {overlay.ownerLabel ? (
                  <Text numberOfLines={1} style={styles.zoneOwnerText}>
                    {overlay.ownerLabel}
                  </Text>
                ) : null}
              </Pressable>
            ) : overlay.kind === 'entity' && overlay.entityId && onEntityTap ? (
              <Pressable
                key={overlay.id}
                onPress={() => {
                  onEntityTap(overlay.entityId!);
                }}
                style={({ pressed }) => [
                  styles.spatialLabel,
                  styles.entityLabel,
                  overlay.entityKind === 'market' ? styles.marketLabel : null,
                  overlay.entityKind === 'boca' ? styles.bocaLabel : null,
                  overlay.entityKind === 'factory' ? styles.factoryLabel : null,
                  overlay.entityKind === 'party' ? styles.partyLabel : null,
                  overlay.entityKind === 'hospital' ? styles.hospitalLabel : null,
                  overlay.entityKind === 'training' ? styles.trainingLabel : null,
                  overlay.entityKind === 'university' ? styles.universityLabel : null,
                  overlay.entityKind === 'docks' ? styles.docksLabel : null,
                  overlay.entityKind === 'scrapyard' ? styles.scrapyardLabel : null,
                  pressed ? styles.pressedZoneLabel : null,
                  {
                    borderColor: `${overlay.accent}aa`,
                    left: overlay.x,
                    top: overlay.y,
                  },
                ]}
              >
                <Text numberOfLines={1} style={styles.spatialLabelText}>
                  {overlay.label}
                </Text>
              </Pressable>
            ) : (
              <View
                key={overlay.id}
                pointerEvents="none"
                style={[
                  styles.spatialLabel,
                  overlay.kind === 'zone' ? styles.zoneLabel : styles.entityLabel,
                  overlay.kind === 'entity' && overlay.entityKind === 'market' ? styles.marketLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'boca' ? styles.bocaLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'factory' ? styles.factoryLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'party' ? styles.partyLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'hospital' ? styles.hospitalLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'training' ? styles.trainingLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'university' ? styles.universityLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'docks' ? styles.docksLabel : null,
                  overlay.kind === 'entity' && overlay.entityKind === 'scrapyard' ? styles.scrapyardLabel : null,
                  overlay.kind === 'trail' ? styles.trailLabel : null,
                  overlay.kind === 'zone' && overlay.relation === 'ally' ? styles.allyZoneLabel : null,
                  overlay.kind === 'zone' && overlay.relation === 'enemy' ? styles.enemyZoneLabel : null,
                  overlay.kind === 'zone' && overlay.relation === 'neutral' ? styles.neutralZoneLabel : null,
                  overlay.selected ? styles.selectedZoneLabel : null,
                  {
                    borderColor: `${overlay.accent}${overlay.selected ? 'ff' : '88'}`,
                    left: overlay.x,
                    top: overlay.y,
                  },
                ]}
              >
                <Text numberOfLines={1} style={styles.spatialLabelText}>
                  {overlay.label}
                </Text>
                {overlay.kind === 'zone' && overlay.ownerLabel ? (
                  <Text numberOfLines={1} style={styles.zoneOwnerText}>
                    {overlay.ownerLabel}
                  </Text>
                ) : null}
              </View>
            )
          ))}
        </View>
      ) : null}

      {destinationOverlay ? (
        <View
          pointerEvents="none"
          style={[
            styles.destinationOverlay,
            {
              left: destinationOverlay.x,
              top: destinationOverlay.y,
            },
          ]}
        >
          <Text style={styles.destinationOverlayLabel}>Destino</Text>
        </View>
      ) : null}

      {showDebugOverlay ? (
        <View onLayout={(event) => handlePanelLayout('debug', event)} style={styles.debugPanel}>
          <Text style={styles.debugLine}>Mapa {map.width}x{map.height}</Text>
          <Text style={styles.debugLine}>Cam {debugState.camera.mode} {debugState.camera.zoom.toFixed(2)}x</Text>
          <Text style={styles.debugLine}>
            Tile {selectedTile ? `${selectedTile.x},${selectedTile.y}` : '--'}
          </Text>
          <Text style={styles.debugLine}>
            Player {debugState.playerPosition.x.toFixed(1)},{debugState.playerPosition.y.toFixed(1)}
          </Text>
          <Text style={styles.debugLine}>Clip {debugState.clipName ?? '--'}</Text>
          <Text style={styles.debugLine}>FPS {debugState.fps}</Text>
        </View>
      ) : null}

      {showControlsOverlay ? (
        <View onLayout={(event) => handlePanelLayout('controls', event)} style={styles.controls}>
          <Text style={styles.controlText}>
            Toque move. Pressione para marcar tile. Arraste faz pan. Pinch controla zoom.
          </Text>
          <Pressable
            onPress={() => syncCameraDebug(cameraRef.current.setMode('follow'))}
            style={({ pressed }) => [styles.followButton, pressed ? styles.followButtonPressed : null]}
          >
            <Text style={styles.followButtonLabel}>Seguir jogador</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function buildMapPicture(
  layers: WorldTileLayer[],
  bounds: { maxX: number; maxY: number; minX: number; minY: number },
  image: SkImage | null,
  tileSize: { height: number; width: number },
) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return createPicture(
    (canvas) => {
      drawTileLayersAsVector(canvas, layers, tileSize);

      if (image) {
        drawTileLayersAsAtlas(canvas, image, layers);
        return;
      }
    },
    Skia.XYWHRect(bounds.minX, bounds.minY, width, height),
  );
}

function renderMapEntityMarker(entity: GameEntity & { worldPoint: ScreenPoint }) {
  const accent = entity.color ?? '#ff7b54';
  const x = entity.worldPoint.x;
  const y = entity.worldPoint.y - 10;

  if (entity.kind === 'market') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={20} />
        <Path color={`${accent}c8`} path={createDiamondPath(x, y, 26, 18)} />
        <Path color="rgba(25, 18, 10, 0.72)" path={createDiamondPath(x, y, 14, 10)} />
        <Circle color="#f4f1e8" cx={x} cy={y} r={3} />
      </>
    );
  }

  if (entity.kind === 'boca') {
    return (
      <>
        <Circle color={`${accent}24`} cx={x} cy={y} r={21} />
        <Path color={`${accent}d0`} path={createDiamondPath(x, y, 24, 16)} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x - 6} cy={y} r={3} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x} cy={y - 4} r={3} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x + 6} cy={y} r={3} />
      </>
    );
  }

  if (entity.kind === 'factory') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={22} />
        <Path color={`${accent}d6`} path={createRectPath(x - 10, y - 8, 20, 16)} />
        <Path color="rgba(18, 18, 18, 0.72)" path={createRectPath(x - 5, y - 12, 4, 7)} />
        <Path color="rgba(18, 18, 18, 0.72)" path={createRectPath(x + 2, y - 14, 4, 9)} />
      </>
    );
  }

  if (entity.kind === 'party') {
    return (
      <>
        <Circle color={`${accent}1f`} cx={x} cy={y} r={24} />
        <Circle color={`${accent}44`} cx={x} cy={y} r={18} />
        <Circle color={`${accent}cf`} cx={x} cy={y} r={9} />
        <Circle color="#f4f1e8" cx={x - 8} cy={y - 6} r={2} />
        <Circle color="#f4f1e8" cx={x + 7} cy={y - 2} r={2} />
      </>
    );
  }

  if (entity.kind === 'hospital') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={21} />
        <Path color={`${accent}d2`} path={createRectPath(x - 10, y - 10, 20, 20)} />
        <Path color="#f4f1e8" path={createRectPath(x - 2, y - 7, 4, 14)} />
        <Path color="#f4f1e8" path={createRectPath(x - 7, y - 2, 14, 4)} />
      </>
    );
  }

  if (entity.kind === 'training') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={21} />
        <Path color={`${accent}d2`} path={createRectPath(x - 9, y - 2, 18, 4)} />
        <Circle color={`${accent}d8`} cx={x - 12} cy={y} r={4} />
        <Circle color={`${accent}d8`} cx={x + 12} cy={y} r={4} />
      </>
    );
  }

  if (entity.kind === 'university') {
    return (
      <>
        <Circle color={`${accent}1f`} cx={x} cy={y} r={21} />
        <Path color={`${accent}cf`} path={createDiamondPath(x, y - 2, 24, 10)} />
        <Path color="rgba(20, 20, 20, 0.72)" path={createRectPath(x - 8, y - 1, 16, 10)} />
        <Path color="#f4f1e8" path={createRectPath(x - 1, y + 3, 2, 6)} />
      </>
    );
  }

  if (entity.kind === 'docks') {
    return (
      <>
        <Circle color={`${accent}20`} cx={x} cy={y} r={22} />
        <Path color={`${accent}cf`} path={createRectPath(x - 11, y - 8, 22, 14)} />
        <Path color="rgba(16, 22, 30, 0.72)" path={createLinePath({ x: x - 11, y: y + 8 }, { x: x + 11, y: y + 8 })} style="stroke" strokeWidth={3} />
      </>
    );
  }

  if (entity.kind === 'scrapyard') {
    return (
      <>
        <Circle color={`${accent}20`} cx={x} cy={y} r={22} />
        <Path color={`${accent}d0`} path={createRectPath(x - 10, y - 8, 20, 14)} />
        <Path color="rgba(15, 15, 15, 0.78)" path={createRectPath(x - 6, y - 4, 5, 5)} />
        <Path color="rgba(15, 15, 15, 0.78)" path={createRectPath(x + 1, y - 1, 5, 5)} />
      </>
    );
  }

  return (
    <>
      <Circle color={`${accent}33`} cx={x} cy={y} r={18} />
      <Circle color={`${accent}99`} cx={x} cy={y} r={13} />
      <Circle color={accent} cx={x} cy={y} r={8} />
    </>
  );
}

function buildWorldTileLayers(
  map: ReturnType<typeof parseTilemap>,
  tileSize: { height: number; width: number },
): WorldTileLayer[] {
  return map.layers
    .filter((layer) => layer.visible && layer.type === 'tilelayer' && layer.kind !== 'collision')
    .map((layer) => ({
      key: `${layer.id}:${layer.name}`,
      opacity: layer.opacity,
      tiles: layer.tiles.map((tile) => {
        const tileset = map.tilesets.find((entry) => entry.key === tile.tilesetKey);
        const columns = Math.max(tileset?.columns ?? 1, 1);
        const sourceWidth = tileset?.tileWidth ?? tileSize.width;
        const sourceHeight = tileset?.tileHeight ?? tileSize.height;
        const worldPoint = cartToIso(tile, tileSize);

        return {
          fill: typeof tile.properties.color === 'string' ? tile.properties.color : '#3a4f41',
          height: sourceHeight,
          sourceRect: {
            x: (tile.tileId % columns) * sourceWidth,
            y: Math.floor(tile.tileId / columns) * sourceHeight,
            width: sourceWidth,
            height: sourceHeight,
          },
          width: sourceWidth,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
        };
      }),
    }));
}

function createCameraMatrix(cameraState: CameraState): number[] {
  return [
    cameraState.zoom,
    0,
    cameraState.viewportWidth / 2 - cameraState.x * cameraState.zoom,
    0,
    cameraState.zoom,
    cameraState.viewportHeight / 2 - cameraState.y * cameraState.zoom,
    0,
    0,
    1,
  ];
}

function createDiamondPath(centerX: number, centerY: number, width: number, height: number) {
  const path = Skia.Path.Make();
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  path.moveTo(centerX, centerY - halfHeight);
  path.lineTo(centerX + halfWidth, centerY);
  path.lineTo(centerX, centerY + halfHeight);
  path.lineTo(centerX - halfWidth, centerY);
  path.close();

  return path;
}

function createNeighborhoodPatchPath(centerX: number, centerY: number, width: number, height: number) {
  const path = Skia.Path.Make();
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  path.moveTo(centerX, centerY - halfHeight * 0.98);
  path.lineTo(centerX + halfWidth * 0.68, centerY - halfHeight * 0.34);
  path.lineTo(centerX + halfWidth * 0.9, centerY + halfHeight * 0.18);
  path.lineTo(centerX + halfWidth * 0.42, centerY + halfHeight * 0.72);
  path.lineTo(centerX - halfWidth * 0.16, centerY + halfHeight * 0.92);
  path.lineTo(centerX - halfWidth * 0.78, centerY + halfHeight * 0.4);
  path.lineTo(centerX - halfWidth * 0.9, centerY - halfHeight * 0.14);
  path.lineTo(centerX - halfWidth * 0.36, centerY - halfHeight * 0.78);
  path.close();

  return path;
}

function createRectPath(x: number, y: number, width: number, height: number) {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(x, y, width, height));
  return path;
}

function createPolylinePath(points: ScreenPoint[]) {
  const path = Skia.Path.Make();

  if (points.length === 0) {
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  return path;
}

function createLinePath(start: ScreenPoint, end: ScreenPoint) {
  const path = Skia.Path.Make();
  path.moveTo(start.x, start.y);
  path.lineTo(end.x, end.y);
  return path;
}

function drawTileLayersAsAtlas(canvas: SkCanvas, image: SkImage, layers: WorldTileLayer[]): void {
  const paint = Skia.Paint();

  for (const layer of layers) {
    const sprites = layer.tiles.map((tile) =>
      Skia.XYWHRect(tile.sourceRect.x, tile.sourceRect.y, tile.sourceRect.width, tile.sourceRect.height),
    );
    const transforms = layer.tiles.map((tile) =>
      Skia.RSXform(1, 0, tile.worldX - tile.width / 2, tile.worldY - tile.height / 2),
    );

    if (typeof paint.setAlphaf === 'function') {
        paint.setAlphaf(Math.min(0.34, Math.max(0.16, layer.opacity * 0.28)));
    }

    canvas.drawAtlas(image, sprites, transforms, paint);
  }
}

function drawTileLayersAsVector(
  canvas: SkCanvas,
  layers: WorldTileLayer[],
  tileSize: { height: number; width: number },
): void {
  for (const layer of layers) {
    for (const tile of layer.tiles) {
      const paint = Skia.Paint();

      paint.setColor(Skia.Color(brightenHexColor(tile.fill, 0.24)));

      if (typeof paint.setAlphaf === 'function') {
        paint.setAlphaf(Math.min(0.26, Math.max(0.1, layer.opacity * 0.18)));
      }

      canvas.drawPath(
        createDiamondPath(tile.worldX, tile.worldY, tileSize.width, tileSize.height),
        paint,
      );
    }
  }
}

function resolveGroundPatchFill(patch: WorldGroundPatch): string {
  if (patch.kind === 'blocked') {
    return toAlphaHex('#3a241b', 0.82);
  }

  if (patch.kind === 'slope') {
    return toAlphaHex(brightenHexColor(patch.fill, 0.04), 0.54);
  }

  if (patch.kind === 'favela-ground') {
    return toAlphaHex(brightenHexColor(patch.fill, 0.02), 0.68);
  }

  if (patch.kind === 'yard') {
    return toAlphaHex(brightenHexColor(patch.fill, 0.08), 0.5);
  }

  return toAlphaHex(brightenHexColor(patch.fill, 0.05), 0.58);
}

function resolveGroundPatchStroke(patch: WorldGroundPatch): string {
  if (patch.kind === 'blocked') {
    return toAlphaHex(patch.accent, 0.92);
  }

  if (patch.kind === 'favela-ground') {
    return toAlphaHex(patch.accent, 0.74);
  }

  if (patch.kind === 'slope') {
    return toAlphaHex(patch.accent, 0.48);
  }

  return toAlphaHex(patch.accent, 0.38);
}

function getMapWorldBounds(mapWidth: number, mapHeight: number, tileSize: { height: number; width: number }) {
  const corners = [
    cartToIso({ x: 0, y: 0 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: 0 }, tileSize),
    cartToIso({ x: 0, y: mapHeight - 1 }, tileSize),
    cartToIso({ x: mapWidth - 1, y: mapHeight - 1 }, tileSize),
  ];

  const xValues = corners.map((corner) => corner.x);
  const yValues = corners.map((corner) => corner.y);

  return {
    minX: Math.min(...xValues) - tileSize.width,
    minY: Math.min(...yValues) - tileSize.height,
    maxX: Math.max(...xValues) + tileSize.width,
    maxY: Math.max(...yValues) + tileSize.height,
  };
}

function hasCameraChanged(left: CameraState, right: CameraState): boolean {
  return (
    Math.abs(left.x - right.x) > 0.01 ||
    Math.abs(left.y - right.y) > 0.01 ||
    Math.abs(left.zoom - right.zoom) > 0.001 ||
    left.mode !== right.mode ||
    left.viewportWidth !== right.viewportWidth ||
    left.viewportHeight !== right.viewportHeight
  );
}

function mapDirectionToSprite(direction: string): string {
  const normalizedDirection = direction === 'idle' ? 's' : direction;
  return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].includes(normalizedDirection)
    ? normalizedDirection
    : 's';
}

function brightenHexColor(input: string, amount: number): string {
  const normalized = input.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return input;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  const brighten = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value + (255 - value) * amount)));

  return `#${[brighten(red), brighten(green), brighten(blue)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function toAlphaHex(input: string, alpha: number): string {
  if (!input.startsWith('#') || (input.length !== 7 && input.length !== 9)) {
    return input;
  }

  const normalizedAlpha = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, '0');

  return `${input.slice(0, 7)}${normalizedAlpha}`;
}

function projectWorldToScreen(cameraState: CameraState, point: ScreenPoint): ScreenPoint {
  return {
    x: (point.x - cameraState.x) * cameraState.zoom + cameraState.viewportWidth / 2,
    y: (point.y - cameraState.y) * cameraState.zoom + cameraState.viewportHeight / 2,
  };
}

function isOverlayVisible(
  point: ScreenPoint,
  viewportWidth: number,
  viewportHeight: number,
  margin = 64,
): boolean {
  return (
    point.x >= -margin &&
    point.y >= -margin &&
    point.x <= viewportWidth + margin &&
    point.y <= viewportHeight + margin
  );
}

function clampOverlayPosition(
  viewportWidth: number,
  viewportHeight: number,
  desiredX: number,
  desiredY: number,
  overlayWidth: number,
  overlayHeight: number,
  padding = 8,
): ScreenPoint {
  return {
    x: Math.max(padding, Math.min(desiredX, viewportWidth - overlayWidth - padding)),
    y: Math.max(padding, Math.min(desiredY, viewportHeight - overlayHeight - padding)),
  };
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0f1012',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  canvasFrame: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  spatialLabelLayer: {
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  destinationOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 8, 8, 0.84)',
    borderColor: 'rgba(224, 176, 75, 0.55)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
  },
  destinationOverlayLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  spatialLabel: {
    backgroundColor: 'rgba(10, 10, 10, 0.82)',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 138,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
  },
  zoneLabel: {
    backgroundColor: 'rgba(16, 18, 22, 0.9)',
    minWidth: 108,
  },
  allyZoneLabel: {
    backgroundColor: 'rgba(17, 47, 28, 0.92)',
  },
  enemyZoneLabel: {
    backgroundColor: 'rgba(58, 22, 22, 0.92)',
  },
  neutralZoneLabel: {
    backgroundColor: 'rgba(28, 31, 37, 0.92)',
  },
  selectedZoneLabel: {
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  pressedZoneLabel: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  entityLabel: {
    backgroundColor: 'rgba(22, 19, 14, 0.92)',
  },
  marketLabel: {
    backgroundColor: 'rgba(60, 26, 18, 0.94)',
  },
  bocaLabel: {
    backgroundColor: 'rgba(43, 20, 22, 0.94)',
  },
  factoryLabel: {
    backgroundColor: 'rgba(22, 40, 28, 0.94)',
  },
  partyLabel: {
    backgroundColor: 'rgba(46, 24, 54, 0.94)',
  },
  hospitalLabel: {
    backgroundColor: 'rgba(20, 34, 54, 0.94)',
  },
  trainingLabel: {
    backgroundColor: 'rgba(54, 40, 18, 0.94)',
  },
  universityLabel: {
    backgroundColor: 'rgba(18, 36, 52, 0.94)',
  },
  docksLabel: {
    backgroundColor: 'rgba(18, 34, 42, 0.94)',
  },
  scrapyardLabel: {
    backgroundColor: 'rgba(45, 31, 23, 0.94)',
  },
  trailLabel: {
    backgroundColor: 'rgba(14, 28, 35, 0.92)',
  },
  spatialLabelText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  zoneOwnerText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  debugPanel: {
    backgroundColor: 'rgba(17, 17, 17, 0.72)',
    borderBottomRightRadius: 18,
    gap: 2,
    left: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
  },
  debugLine: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  controlText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 12,
  },
  followButton: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  followButtonPressed: {
    opacity: 0.84,
  },
  followButtonLabel: {
    color: '#15110a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
