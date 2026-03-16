import { AnimationController } from '@engine/animation';
import { cartToIso } from '@engine/coordinates';
import { GameLoop } from '@engine/game-loop';
import { MovementController } from '@engine/movement';
import { SpriteSheet } from '@engine/spritesheet';
import { parseTilemap } from '@engine/tilemap-parser';
import type { InputRect } from '@engine/input-handler';
import { type CameraMode, type GridPoint } from '@engine/types';
import { useImage, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import playerBaseSpriteSource from '../../assets/sprites/player_base.png';
import { useAudio } from '../audio/AudioProvider';
import { playerBaseSpriteSheetData } from '../data/playerBaseSpriteSheet';
import { useMapStructureSvgCatalog } from '../data/mapStructureSvgCatalog';
import {
  type MapGroundPatch,
  type MapLandmark,
  type MapEntityKind,
} from '../data/mapRegionVisuals';
import { getMapStructureDefinition } from '../data/mapStructureCatalog';
import { recordPerformanceFpsSample } from '../features/mobile-observability';
import { colors } from '../theme/colors';
import {
  clampOverlayPosition,
  hasCameraChanged,
  isOverlayVisible,
  mapDirectionToSprite,
  projectWorldToScreen,
  scalePolygonPoints,
} from './game-view/geometry';
import {
  type GameEntity,
  type GameEntityWorldPoint,
  type GameStructure,
  type GameTrail,
  type GameZone,
  type WorldLabelOverlay,
  type WorldLandmarkOverlay,
  type WorldStructureOverlay,
} from './game-view/types';
import { GameCanvasScene } from './game-view/GameCanvasScene';
import { GameOverlayLayer } from './game-view/GameOverlayLayer';
import { useGameCamera } from './game-view/useGameCamera';
import { useGameInput } from './game-view/useGameInput';

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
  groundPatches?: MapGroundPatch[];
  landmarks?: MapLandmark[];
  mapData: Record<string, unknown>;
  onCameraModeChange?: (mode: CameraMode) => void;
  onEntityTap?: (entityId: string) => void;
  onPlayerStateChange?: (playerState: GameViewPlayerState) => void;
  onTileTap?: (tile: GridPoint) => void;
  onZoneTap?: (zoneId: string) => void;
  playerState?: {
    position: GridPoint;
  };
  selectedZoneId?: string | null;
  showControlsOverlay?: boolean;
  showDebugOverlay?: boolean;
  structures?: GameStructure[];
  trails?: GameTrail[];
  uiRects?: InputRect[];
  zones?: GameZone[];
}

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
      height: map.tileHeight,
      width: map.tileWidth,
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
  const initialFrame = useMemo(
    () =>
      spriteSheet.getFrame('idle_s_0') ??
      spriteSheet.getFrameIds().map((id) => spriteSheet.getFrame(id)).find(Boolean) ??
      null,
    [spriteSheet],
  );
  const movementRef = useRef<MovementController>(new MovementController(spawnTile, 3));
  const animationRef = useRef<AnimationController>(
    new AnimationController(spriteSheet, SPRITE_IDLE_FALLBACK),
  );
  const facingDirectionRef = useRef('s');
  const fpsTimestampRef = useRef(0);
  const fpsTelemetryTimestampRef = useRef(0);
  const onPlayerStateChangeRef = useRef(onPlayerStateChange);
  const [selectedTile, setSelectedTile] = useState<GridPoint | null>(spawnTile);
  const [playerPath, setPlayerPath] = useState<GridPoint[]>([]);
  const camera = useGameCamera({
    cameraCommand,
    entities,
    initialFrame,
    mapHeight: map.height,
    mapWidth: map.width,
    movementRef,
    onCameraModeChange,
    spawnTile,
    structures,
    tileSize,
  });
  const { cameraRef, syncCameraDebug } = camera;
  const input = useGameInput({
    cameraRef,
    debugPathLengthRef: camera.debugPathLengthRef,
    entities,
    isPanningRef: camera.isPanningRef,
    inertiaVelocityRef: camera.inertiaVelocityRef,
    map,
    movementRef,
    onCameraModeChangeRef: camera.onCameraModeChangeRef,
    onEntityTap,
    onTileTap,
    playSfx,
    setPlayerPath,
    setSelectedTile,
    showControlsOverlay,
    showDebugOverlay,
    syncCameraDebug: camera.syncCameraDebug,
    tileSize,
    uiRects,
  });
  const playerSpriteBuffer = useRectBuffer(1, (rect) => {
    'worklet';
    rect.setXYWH(
      camera.playerFrameValue.value.x,
      camera.playerFrameValue.value.y,
      camera.playerFrameValue.value.width,
      camera.playerFrameValue.value.height,
    );
  });
  const playerTransformBuffer = useRSXformBuffer(1, (transform) => {
    'worklet';
    transform.set(
      1,
      0,
      camera.playerWorldXValue.value - camera.playerFrameValue.value.width / 2,
      camera.playerWorldYValue.value - camera.playerFrameValue.value.height + 6,
    );
  });

  useEffect(() => {
    onPlayerStateChangeRef.current = onPlayerStateChange;
  }, [onPlayerStateChange]);

  useEffect(() => {
    movementRef.current = new MovementController(spawnTile, 3);
    animationRef.current = new AnimationController(spriteSheet, SPRITE_IDLE_FALLBACK);
    facingDirectionRef.current = 's';
    fpsTelemetryTimestampRef.current = 0;
    setSelectedTile(spawnTile);
    setPlayerPath([]);
  }, [spawnTile, spriteSheet]);

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
      let nextCameraState = camera.cameraRef.current.updateFollowTarget(nextWorldPosition);

      if (
        !camera.isPanningRef.current &&
        Math.abs(camera.inertiaVelocityRef.current.x) + Math.abs(camera.inertiaVelocityRef.current.y) > 0 &&
        camera.cameraRef.current.getState().mode === 'free'
      ) {
        camera.inertiaVelocityRef.current = camera.cameraRef.current.applyInertia(
          camera.inertiaVelocityRef.current,
          deltaMs,
        );
        nextCameraState = camera.cameraRef.current.getState();
      }

      if (hasCameraChanged(camera.debugCameraRef.current, nextCameraState)) {
        camera.syncCameraDebug(nextCameraState);
      }

      camera.playerWorldXValue.value = nextWorldPosition.x;
      camera.playerWorldYValue.value = nextWorldPosition.y;
      camera.playerHaloYValue.value = nextWorldPosition.y - 10;
      camera.playerBeaconYValue.value = nextWorldPosition.y - 34;
      camera.playerMarkerYValue.value = nextWorldPosition.y - 8;

      if (nextFrame) {
        camera.playerFrameValue.value = {
          height: nextFrame.height,
          width: nextFrame.width,
          x: nextFrame.x,
          y: nextFrame.y,
        };
      }

      if (nextMovementState.path.length !== camera.debugPathLengthRef.current) {
        camera.debugPathLengthRef.current = nextMovementState.path.length;
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
        camera.setDebugState({
          camera: camera.debugCameraRef.current,
          clipName: animationRef.current.getState().clipName,
          fps: Math.round(nextFps),
          playerPosition: {
            x: nextMovementState.position.x,
            y: nextMovementState.position.y,
          },
        });
      }

      if (performance.now() - fpsTelemetryTimestampRef.current > 2_500 || Math.round(nextFps) < 35) {
        fpsTelemetryTimestampRef.current = performance.now();
        recordPerformanceFpsSample(Math.round(nextFps));
      }
    });

    return () => {
      loop.stop();
    };
  }, [
    camera,
    spriteSheet,
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

    const screenPoint = projectWorldToScreen(camera.debugState.camera, {
      x: selectedTileWorldPoint.x,
      y: selectedTileWorldPoint.y - 30,
    });

    if (
      !isOverlayVisible(
        screenPoint,
        camera.debugState.camera.viewportWidth,
        camera.debugState.camera.viewportHeight,
        16,
      )
    ) {
      return null;
    }

    return clampOverlayPosition(
      camera.debugState.camera.viewportWidth,
      camera.debugState.camera.viewportHeight,
      screenPoint.x - 42,
      screenPoint.y - 14,
      84,
      24,
    );
  }, [camera.debugState.camera, selectedTileWorldPoint]);
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
          const basePoints: [typeof nw, typeof ne, typeof se, typeof sw] = [nw, ne, se, sw];
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
          const lotPoints = scalePolygonPoints(
            basePoints,
            lotCenter,
            definition.placement.lot.scaleX,
            definition.placement.lot.scaleY,
          );
          const topPoints: [typeof nw, typeof ne, typeof se, typeof sw] = [
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
  ) as GameEntityWorldPoint[];
  const spatialLabelOverlays = useMemo<WorldLabelOverlay[]>(() => {
    const labels: WorldLabelOverlay[] = [];

    for (const entity of entityWorldPoints) {
      if (!entity.label) {
        continue;
      }

      const screenPoint = projectWorldToScreen(camera.debugState.camera, {
        x: entity.worldPoint.x,
        y: entity.worldPoint.y - 24,
      });

      if (
        isOverlayVisible(
          screenPoint,
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
          0,
        ) &&
        screenPoint.x > 56 &&
        screenPoint.y > 36 &&
        screenPoint.x < camera.debugState.camera.viewportWidth - 96 &&
        screenPoint.y < camera.debugState.camera.viewportHeight - 52
      ) {
        const clampedPosition = clampOverlayPosition(
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
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
      const screenPoint = projectWorldToScreen(camera.debugState.camera, {
        x: roofCenter.x,
        y: roofCenter.y - 10,
      });

      if (
        isOverlayVisible(
          screenPoint,
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
          0,
        ) &&
        screenPoint.x > 56 &&
        screenPoint.y > 32 &&
        screenPoint.x < camera.debugState.camera.viewportWidth - 112 &&
        screenPoint.y < camera.debugState.camera.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
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
      const screenPoint = projectWorldToScreen(camera.debugState.camera, {
        x: landmark.positionWorldPoint.x,
        y: landmark.positionWorldPoint.y - 18,
      });

      if (
        isOverlayVisible(
          screenPoint,
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
        ) &&
        screenPoint.x > 48 &&
        screenPoint.y > 32 &&
        screenPoint.x < camera.debugState.camera.viewportWidth - 112 &&
        screenPoint.y < camera.debugState.camera.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          camera.debugState.camera.viewportWidth,
          camera.debugState.camera.viewportHeight,
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
  }, [camera.debugState.camera, entityWorldPoints, landmarkWorldOverlays, structureWorldOverlays]);
  const handleFollowPress = useCallback(() => {
    syncCameraDebug(cameraRef.current.setMode('follow'));
  }, [cameraRef, syncCameraDebug]);

  return (
    <View onLayout={camera.handleViewportLayout} style={styles.wrapper}>
      <GestureDetector gesture={input.composedGesture}>
        <View style={styles.canvasFrame}>
          <GameCanvasScene
            cameraMatrixValue={camera.cameraMatrixValue}
            entityWorldPoints={entityWorldPoints}
            landmarkWorldOverlays={landmarkWorldOverlays}
            pathWorldPoints={pathWorldPoints}
            playerBeaconYValue={camera.playerBeaconYValue}
            playerHaloYValue={camera.playerHaloYValue}
            playerImage={playerImage}
            playerMarkerYValue={camera.playerMarkerYValue}
            playerSpriteBuffer={playerSpriteBuffer}
            playerTransformBuffer={playerTransformBuffer}
            playerWorldXValue={camera.playerWorldXValue}
            playerWorldYValue={camera.playerWorldYValue}
            selectedTileWorldPoint={selectedTileWorldPoint}
            structureSvgCatalog={structureSvgCatalog}
            structureWorldOverlays={structureWorldOverlays}
            tileSize={tileSize}
          />
        </View>
      </GestureDetector>

      <GameOverlayLayer
        debugState={camera.debugState}
        destinationOverlay={destinationOverlay}
        mapHeight={map.height}
        mapWidth={map.width}
        onEntityTap={onEntityTap}
        onFollowPress={handleFollowPress}
        onPanelLayout={input.handlePanelLayout}
        onZoneTap={onZoneTap}
        selectedTileLabel={selectedTile ? `${selectedTile.x},${selectedTile.y}` : '--'}
        showControlsOverlay={showControlsOverlay}
        showDebugOverlay={showDebugOverlay}
        spatialLabelOverlays={spatialLabelOverlays}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvasFrame: {
    flex: 1,
  },
  wrapper: {
    backgroundColor: '#263127',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
});
