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
  ImageSVG,
  Path,
  Skia,
  useImage,
  useRSXformBuffer,
  useRectBuffer,
} from '@shopify/react-native-skia';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import playerBaseSpriteSource from '../../assets/sprites/player_base.png';
import { useAudio } from '../audio/AudioProvider';
import { shouldPlayWalkSfx } from '../audio/audioFeedback';
import { playerBaseSpriteSheetData } from '../data/playerBaseSpriteSheet';
import { useMapStructureSvgCatalog } from '../data/mapStructureSvgCatalog';
import {
  type MapGroundPatch,
  type MapLandmark,
  type MapEntityKind,
  type MapStructureKind,
} from '../data/mapRegionVisuals';
import { getMapStructureDefinition } from '../data/mapStructureCatalog';
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

interface GameStructure {
  accent?: string;
  footprint: { h: number; w: number };
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  position: GridPoint;
}

interface WorldLandmarkOverlay {
  accent: string;
  id: string;
  label: string;
  positionWorldPoint: ScreenPoint;
  shape: 'gate' | 'plaza' | 'tower' | 'warehouse';
}

interface WorldStructureOverlay {
  accent: string;
  basePoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  entityKind?: MapEntityKind;
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  height: number;
  lotPoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  ownerLabel?: string;
  relation?: 'ally' | 'enemy' | 'neutral';
  selected?: boolean;
  topPoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  zoneId?: string;
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
  structures?: GameStructure[];
  trails?: GameTrail[];
  uiRects?: InputRect[];
  zones?: GameZone[];
}

interface WorldLabelOverlay {
  accent: string;
  anchorX?: number;
  anchorY?: number;
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

interface DebugState {
  camera: CameraState;
  clipName: string | null;
  fps: number;
  playerPosition: GridPoint;
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
  landmarks = [],
  selectedZoneId = null,
  showControlsOverlay = false,
  showDebugOverlay = false,
  structures = [],
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
  const structureSvgCatalog = useMapStructureSvgCatalog();
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
  const mapBounds = useMemo(
    () =>
      getSceneWorldBounds({
        entities,
        fallbackBounds: getMapWorldBounds(map.width, map.height, tileSize),
        spawnTile,
        structures,
        tileSize,
      }),
    [entities, map.height, map.width, spawnTile, structures, tileSize],
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
    cameraRef.current = new Camera(initialCameraState);
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
    syncCameraDebug(cameraRef.current.setBounds(mapBounds));
  }, [mapBounds, syncCameraDebug]);

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
  const structureWorldOverlays = useMemo<WorldStructureOverlay[]>(
    () =>
      structures
        .map((structure) => {
          const linkedEntity = structure.interactiveEntityId
            ? entities.find(
                (entity) =>
                  entity.id === structure.interactiveEntityId && entity.kind !== 'player',
              )
            : null;
          const structureZoneId = structure.id.startsWith('favela-visual:')
            ? structure.id.replace('favela-visual:', '')
            : null;
          const linkedZone = structureZoneId ? zones.find((zone) => zone.id === structureZoneId) : null;
          const definition = getMapStructureDefinition(structure.kind);
          const height = definition.height;
          const nw = cartToIso(structure.position, tileSize);
          const ne = cartToIso(
            { x: structure.position.x + structure.footprint.w, y: structure.position.y },
            tileSize,
          );
          const se = cartToIso(
            {
              x: structure.position.x + structure.footprint.w,
              y: structure.position.y + structure.footprint.h,
            },
            tileSize,
          );
          const sw = cartToIso(
            { x: structure.position.x, y: structure.position.y + structure.footprint.h },
            tileSize,
          );
          const basePoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] = [nw, ne, se, sw];
          const baseCenter = {
            x: (nw.x + se.x) / 2,
            y: (nw.y + se.y) / 2,
          };
          const baseWidth = Math.max(
            1,
            Math.max(nw.x, ne.x, se.x, sw.x) - Math.min(nw.x, ne.x, se.x, sw.x),
          );
          const baseHeight = Math.max(
            1,
            Math.max(nw.y, ne.y, se.y, sw.y) - Math.min(nw.y, ne.y, se.y, sw.y),
          );
          const lotCenter = {
            x: baseCenter.x + baseWidth * definition.placement.lot.offsetX,
            y: baseCenter.y + baseHeight * definition.placement.lot.offsetY,
          };
          const lotPoints = scalePolygonPoints(basePoints, lotCenter, definition.placement.lot.scaleX, definition.placement.lot.scaleY);
          const topPoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] = [
            { x: nw.x, y: nw.y - height },
            { x: ne.x, y: ne.y - height },
            { x: se.x, y: se.y - height },
            { x: sw.x, y: sw.y - height },
          ];

          return {
            accent: structure.accent ?? linkedZone?.accent ?? linkedEntity?.color ?? colors.accent,
            basePoints,
            entityKind: linkedEntity?.kind as MapEntityKind | undefined,
            height,
            id: structure.id,
            interactiveEntityId: structure.interactiveEntityId,
            kind: structure.kind,
            label: structure.label ?? linkedEntity?.label ?? linkedZone?.label ?? definition.label,
            lotPoints,
            ownerLabel: linkedZone?.ownerLabel,
            relation: linkedZone?.relation,
            selected: linkedZone ? linkedZone.id === selectedZoneId : false,
            topPoints,
            zoneId: linkedZone?.id,
          };
        })
        .sort((left, right) => left.basePoints[2].y - right.basePoints[2].y),
    [entities, selectedZoneId, structures, tileSize, zones],
  );
  const structureEntityIds = useMemo(
    () =>
      new Set(
        structureWorldOverlays.flatMap((structure) =>
          structure.interactiveEntityId ? [structure.interactiveEntityId] : [],
        ),
      ),
    [structureWorldOverlays],
  );
  const entityWorldPoints = useMemo(
    () =>
      entities
        .filter((entity) => !structureEntityIds.has(entity.id))
        .map((entity) => ({
          ...entity,
          worldPoint: cartToIso(entity.position, tileSize),
        })),
    [entities, structureEntityIds, tileSize],
  );
  const spatialLabelOverlays = useMemo<WorldLabelOverlay[]>(() => {
    const labels: WorldLabelOverlay[] = [];

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

    for (const structure of structureWorldOverlays) {
      if (!structure.label) {
        continue;
      }

      const roofCenter = {
        x: (structure.topPoints[0].x + structure.topPoints[2].x) / 2,
        y: (structure.topPoints[0].y + structure.topPoints[2].y) / 2,
      };
      const screenPoint = projectWorldToScreen(debugState.camera, {
        x: roofCenter.x,
        y: roofCenter.y - 10,
      });

      if (
        isOverlayVisible(screenPoint, debugState.camera.viewportWidth, debugState.camera.viewportHeight, 0) &&
        screenPoint.x > 56 &&
        screenPoint.y > 32 &&
        screenPoint.x < debugState.camera.viewportWidth - 112 &&
        screenPoint.y < debugState.camera.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          debugState.camera.viewportWidth,
          debugState.camera.viewportHeight,
          screenPoint.x - 56,
          screenPoint.y - (structure.ownerLabel ? 42 : 22),
          132,
          structure.ownerLabel ? 42 : 22,
        );
        labels.push({
          accent: structure.accent,
          anchorX: screenPoint.x,
          anchorY: screenPoint.y + 10,
          entityId: structure.zoneId ? undefined : structure.interactiveEntityId,
          entityKind: structure.entityKind,
          id: `structure:${structure.id}`,
          kind: structure.zoneId ? 'zone' : 'entity',
          label: structure.label,
          ownerLabel: structure.ownerLabel,
          relation: structure.relation,
          selected: structure.selected,
          zoneId: structure.zoneId,
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
  }, [debugState.camera, entityWorldPoints, landmarkWorldOverlays, structureWorldOverlays]);

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
              {null}

              {null}

              {null}

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

              {null}

              {structureWorldOverlays.map((structure) => (
                <Group key={structure.id}>
                  {renderMapStructure(structure, structureSvgCatalog[structure.kind])}
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
            <Fragment key={overlay.id}>
              {overlay.anchorX !== undefined &&
              overlay.anchorY !== undefined &&
              overlay.anchorY > overlay.y + (overlay.ownerLabel ? 34 : 18) ? (
                <>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.spatialLabelConnector,
                      {
                        backgroundColor: `${overlay.accent}bb`,
                        height: Math.max(6, overlay.anchorY - (overlay.y + (overlay.ownerLabel ? 34 : 18))),
                        left: overlay.anchorX - 1,
                        top: overlay.y + (overlay.ownerLabel ? 34 : 18),
                      },
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.spatialLabelConnectorDot,
                      {
                        backgroundColor: `${overlay.accent}dd`,
                        left: overlay.anchorX - 3,
                        top: overlay.anchorY - 3,
                      },
                    ]}
                  />
                </>
              ) : null}
              {overlay.kind === 'zone' && overlay.zoneId && onZoneTap ? (
                <Pressable
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
              )}
            </Fragment>
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

function renderMapStructure(
  structure: WorldStructureOverlay,
  svg: ReturnType<typeof Skia.SVG.MakeFromString>,
) {
  const definition = getMapStructureDefinition(structure.kind);
  const {
    palette: { roof, leftWall, rightWall, outline, detail, detailSoft },
  } = definition;
  const [nw, ne, se, sw] = structure.basePoints;
  const [lnw, lne, lse, lsw] = structure.lotPoints;
  const [tnw, tne, tse, tsw] = structure.topPoints;
  const centerX = (tse.x + tsw.x) / 2;
  const centerY = (tse.y + tsw.y) / 2;
  const width = Math.abs(ne.x - nw.x);
  const depth = Math.abs(sw.y - nw.y);
  const placement = definition.placement;
  const lotCenter = {
    x: (lnw.x + lse.x) / 2,
    y: (lnw.y + lse.y) / 2,
  };
  const lotMinX = Math.min(lnw.x, lne.x, lse.x, lsw.x);
  const lotMaxX = Math.max(lnw.x, lne.x, lse.x, lsw.x);
  const lotMinY = Math.min(lnw.y, lne.y, lse.y, lsw.y);
  const lotMaxY = Math.max(lnw.y, lne.y, lse.y, lsw.y);
  const lotWidth = Math.max(1, lotMaxX - lotMinX);
  const lotHeight = Math.max(1, lotMaxY - lotMinY);
  const spriteSize =
    Math.max(lotWidth, lotHeight * 1.8) * placement.sprite.scale +
    structure.height * 1.05;
  const spriteX = lotCenter.x - spriteSize / 2 + lotWidth * placement.sprite.offsetX;
  const spriteY =
    lotMaxY -
    spriteSize * 0.18 +
    lotHeight * placement.sprite.offsetY -
    structure.height * 0.01;

  return (
    <>
      {svg ? (
        <ImageSVG
          height={spriteSize}
          svg={svg}
          width={spriteSize}
          x={spriteX}
          y={spriteY}
        />
      ) : (
        <>
          <Path color={leftWall} path={createPolygonPath([tnw, tsw, sw, nw])} />
          <Path color={rightWall} path={createPolygonPath([tne, tse, se, ne])} />
          <Path color={roof} path={createPolygonPath([tnw, tne, tse, tsw])} />
          <Path
            color={toAlphaHex('#f4f1e8', 0.16)}
            path={createPolygonPath([
              { x: tnw.x + (tne.x - tnw.x) * 0.08, y: tnw.y + 1 },
              { x: tne.x - (tne.x - tnw.x) * 0.08, y: tne.y + 1 },
              { x: tse.x - (tse.x - tsw.x) * 0.12, y: tse.y - 3 },
              { x: tsw.x + (tse.x - tsw.x) * 0.12, y: tsw.y - 3 },
            ])}
          />
          <Path color={outline} path={createPolygonPath([tnw, tne, tse, tsw])} style="stroke" strokeWidth={2.2} />
          <Path color={toAlphaHex(outline, 0.7)} path={createPolygonPath([tnw, tsw, sw, nw])} style="stroke" strokeWidth={1.6} />
          <Path color={toAlphaHex(outline, 0.7)} path={createPolygonPath([tne, tse, se, ne])} style="stroke" strokeWidth={1.6} />
          {renderStructureDetails(structure, {
            centerX,
            centerY,
            depth,
            detail,
            detailSoft,
            width,
          })}
        </>
      )}
    </>
  );
}

function renderStructureDetails(
  structure: WorldStructureOverlay,
  metrics: {
    centerX: number;
    centerY: number;
    depth: number;
    detail: string;
    detailSoft: string;
    width: number;
  },
) {
  const { centerX, centerY, depth, detail, detailSoft, width } = metrics;
  const definition = getMapStructureDefinition(structure.kind);

  if (definition.detailPreset === 'barraco') {
    return (
      <>
        <Path color={detailSoft} path={createDiamondPath(centerX - 3, centerY - structure.height + 1, 18, 10)} />
        <Path color={detail} path={createRectPath(centerX - 7, centerY - structure.height + 5, 14, 8)} />
        <Path color="rgba(244, 232, 214, 0.42)" path={createRectPath(centerX - 2, centerY - structure.height + 7, 4, 6)} />
        <Path color="rgba(25, 18, 14, 0.74)" path={createRectPath(centerX - 6, centerY - structure.height + 8, 2, 3)} />
        <Path color="rgba(25, 18, 14, 0.74)" path={createRectPath(centerX + 4, centerY - structure.height + 8, 2, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'favela-cluster') {
    return (
      <>
        {[-20, -8, 4, 16].map((offset, index) => (
          <Path
            key={`${structure.id}:roof:${offset}`}
            color={index % 2 === 0 ? detailSoft : detail}
            path={createDiamondPath(centerX + offset, centerY - structure.height + (index % 2 === 0 ? 2 : 10), 22, 12)}
          />
        ))}
        {[-18, -8, 2, 12, 20].map((offset, index) => (
          <Path
            key={`${structure.id}:hut:${offset}`}
            color={index % 2 === 0 ? detail : detailSoft}
            path={createRectPath(centerX + offset - 5, centerY - structure.height + 12 + (index % 2 === 0 ? 0 : 4), 10, 7)}
          />
        ))}
      </>
    );
  }

  if (definition.detailPreset === 'boca') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - 12, centerY - structure.height + 6, 24, 8)} />
        <Path color={detail} path={createRectPath(centerX - 9, centerY - structure.height + 14, 18, 6)} />
        <Circle color={detail} cx={centerX - 8} cy={centerY - structure.height + 9} r={2.5} />
        <Circle color={detail} cx={centerX} cy={centerY - structure.height + 6} r={2.5} />
        <Circle color={detail} cx={centerX + 8} cy={centerY - structure.height + 9} r={2.5} />
        <Path color="rgba(244, 190, 74, 0.76)" path={createRectPath(centerX - 3, centerY - structure.height + 15, 6, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'factory') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - width * 0.22, centerY - structure.height + 4, width * 0.44, 18)} />
        <Path color={detail} path={createRectPath(centerX + width * 0.08, centerY - structure.height - 10, 10, 24)} />
        <Path color={detail} path={createRectPath(centerX - width * 0.16, centerY - structure.height + 14, width * 0.3, 4)} />
        <Circle color={toAlphaHex(detailSoft, 0.7)} cx={centerX + width * 0.12} cy={centerY - structure.height - 12} r={4} />
        <Circle color={toAlphaHex(detailSoft, 0.44)} cx={centerX + width * 0.16} cy={centerY - structure.height - 18} r={6} />
      </>
    );
  }

  if (definition.detailPreset === 'nightlife') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - width * 0.22, centerY - structure.height + 8, width * 0.44, 10)} />
        <Path color={detail} path={createRectPath(centerX - width * 0.1, centerY - structure.height + 4, width * 0.2, 5)} />
        <Circle color={detail} cx={centerX - 12} cy={centerY - structure.height + 2} r={3} />
        <Circle color={detail} cx={centerX} cy={centerY - structure.height - 4} r={3} />
        <Circle color={detail} cx={centerX + 12} cy={centerY - structure.height + 2} r={3} />
        <Path color={toAlphaHex(detailSoft, 0.48)} path={createRectPath(centerX - 2, centerY - structure.height - 10, 4, 8)} />
      </>
    );
  }

  if (definition.detailPreset === 'tower') {
    const baseLeft = centerX - width * 0.22;
    const baseTop = centerY - structure.height + 4;
    const buildingWidth = Math.max(14, width * 0.44);
    const paneWidth = Math.max(4, buildingWidth * 0.16);
    const paneGap = Math.max(3, buildingWidth * 0.07);

    return (
      <>
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((column) => (
            <Path
              key={`${structure.id}:tower:${row}:${column}`}
              color={row === 3 ? detail : detailSoft}
              path={createRectPath(
                baseLeft + column * (paneWidth + paneGap),
                baseTop + row * 9,
                paneWidth,
                5,
              )}
            />
          )),
        )}
        <Path color={detail} path={createRectPath(centerX - 6, centerY - structure.height + 40, 12, 4)} />
        <Path color={toAlphaHex(detailSoft, 0.48)} path={createRectPath(centerX - 4, centerY - structure.height - 8, 8, 6)} />
      </>
    );
  }

  if (definition.detailPreset === 'casa') {
    return (
      <>
        <Path color={detailSoft} path={createDiamondPath(centerX, centerY - structure.height + 2, 22, 12)} />
        <Path color={detail} path={createRectPath(centerX - 10, centerY - structure.height + 8, 20, 10)} />
        <Path color="rgba(244, 232, 214, 0.44)" path={createRectPath(centerX - 2, centerY - structure.height + 10, 4, 8)} />
        <Path color="rgba(35, 28, 22, 0.72)" path={createRectPath(centerX - 7, centerY - structure.height + 11, 3, 3)} />
        <Path color="rgba(35, 28, 22, 0.72)" path={createRectPath(centerX + 4, centerY - structure.height + 11, 3, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'market') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - 14, centerY - structure.height + 6, 28, 8)} />
        <Path color={detail} path={createRectPath(centerX - 12, centerY - structure.height + 14, 24, 7)} />
        <Path color="rgba(244, 199, 98, 0.8)" path={createRectPath(centerX - 10, centerY - structure.height + 10, 20, 4)} />
        <Path color="rgba(244, 241, 232, 0.46)" path={createRectPath(centerX - 8, centerY - structure.height + 16, 6, 4)} />
      </>
    );
  }

  if (
    definition.detailPreset === 'service' ||
    definition.detailPreset === 'prison' ||
    definition.detailPreset === 'training' ||
    definition.detailPreset === 'university'
  ) {
    const left = centerX - width * 0.18;
    const top = centerY - structure.height + 6;
    const paneWidth = Math.max(6, width * 0.08);
    const paneGap = Math.max(4, width * 0.05);

    return (
      <>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => (
            <Path
              key={`${structure.id}:pane:${row}:${column}`}
              color={row === 1 ? detail : detailSoft}
              path={createRectPath(
                left + column * (paneWidth + paneGap),
                top + row * 10,
                paneWidth,
                6,
              )}
            />
          )),
        )}
        {definition.detailPreset === 'service' ? (
          <>
            <Path color="#f4f1e8" path={createRectPath(centerX - 2, centerY - structure.height - 4, 4, 16)} />
            <Path color="#f4f1e8" path={createRectPath(centerX - 9, centerY - structure.height + 2, 18, 4)} />
          </>
        ) : null}
        {definition.detailPreset === 'prison' ? (
          <>
            {[-12, -4, 4, 12].map((offset) => (
              <Path
                key={`${structure.id}:bar:${offset}`}
                color={detail}
                path={createRectPath(centerX + offset, centerY - structure.height + 2, 2, 22)}
              />
            ))}
          </>
        ) : null}
        {definition.detailPreset === 'training' ? (
          <Path color={detail} path={createRectPath(centerX - 12, centerY - structure.height + 20, 24, 4)} />
        ) : null}
      </>
    );
  }

  return (
    <Path color={detailSoft} path={createRectPath(centerX - 8, centerY - structure.height + 8, 16, Math.max(6, depth * 0.26))} />
  );
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

function createRectPath(x: number, y: number, width: number, height: number) {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(x, y, width, height));
  return path;
}

function createPolygonPath(points: ScreenPoint[]) {
  const path = Skia.Path.Make();

  if (points.length === 0) {
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  path.close();
  return path;
}

function scalePolygonPoints(
  points: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
  center: ScreenPoint,
  scaleX: number,
  scaleY: number,
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scaleX,
    y: center.y + (point.y - center.y) * scaleY,
  })) as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
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

function getSceneWorldBounds(input: {
  entities: GameEntity[];
  fallbackBounds: { maxX: number; maxY: number; minX: number; minY: number };
  spawnTile: GridPoint;
  structures: GameStructure[];
  tileSize: { height: number; width: number };
}) {
  const worldPoints: ScreenPoint[] = [cartToIso(input.spawnTile, input.tileSize)];

  for (const entity of input.entities) {
    worldPoints.push(cartToIso(entity.position, input.tileSize));
  }

  for (const structure of input.structures) {
    worldPoints.push(cartToIso(structure.position, input.tileSize));
    worldPoints.push(
      cartToIso(
        {
          x: structure.position.x + structure.footprint.w,
          y: structure.position.y + structure.footprint.h,
        },
        input.tileSize,
      ),
    );
  }

  if (worldPoints.length <= 1) {
    return input.fallbackBounds;
  }

  const xValues = worldPoints.map((point) => point.x);
  const yValues = worldPoints.map((point) => point.y);
  const marginX = input.tileSize.width * 4;
  const marginY = input.tileSize.height * 5;

  return {
    minX: Math.max(input.fallbackBounds.minX, Math.min(...xValues) - marginX),
    minY: Math.max(input.fallbackBounds.minY, Math.min(...yValues) - marginY),
    maxX: Math.min(input.fallbackBounds.maxX, Math.max(...xValues) + marginX),
    maxY: Math.min(input.fallbackBounds.maxY, Math.max(...yValues) + marginY),
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
    backgroundColor: '#263127',
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
  spatialLabelConnector: {
    borderRadius: 999,
    position: 'absolute',
    width: 2,
  },
  spatialLabelConnectorDot: {
    borderRadius: 999,
    height: 6,
    position: 'absolute',
    width: 6,
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
