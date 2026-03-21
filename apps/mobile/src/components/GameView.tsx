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
  hasCameraChanged,
  mapDirectionToSprite,
} from './game-view/geometry';
import {
  type GameEntity,
  type GameStructure,
  type GameTrail,
  type GameZone,
} from './game-view/types';
import { GameCanvasScene } from './game-view/GameCanvasScene';
import { GameOverlayLayer } from './game-view/GameOverlayLayer';
import { useGameCamera } from './game-view/useGameCamera';
import { useGameInput } from './game-view/useGameInput';
import { useGameWorldOverlays } from './game-view/useGameWorldOverlays';

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
  const {
    cameraMatrixValue,
    cameraRef,
    debugCameraRef,
    debugPathLengthRef,
    debugState,
    handleViewportLayout,
    inertiaVelocityRef,
    isPanningRef,
    notifyCameraModeChange,
    playerBeaconYValue,
    playerFrameValue,
    playerHaloYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    setDebugState,
    syncCameraDebug,
  } = camera;
  const input = useGameInput({
    cameraRef,
    debugPathLengthRef,
    entities,
    isPanningRef,
    inertiaVelocityRef,
    map,
    movementRef,
    onCameraModeChange: notifyCameraModeChange,
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
      let nextCameraState = cameraRef.current.updateFollowTarget(nextWorldPosition);

      if (
        !isPanningRef.current &&
        Math.abs(inertiaVelocityRef.current.x) + Math.abs(inertiaVelocityRef.current.y) > 0 &&
        cameraRef.current.getState().mode === 'free'
      ) {
        inertiaVelocityRef.current = cameraRef.current.applyInertia(
          inertiaVelocityRef.current,
          deltaMs,
        );
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
          height: nextFrame.height,
          width: nextFrame.width,
          x: nextFrame.x,
          y: nextFrame.y,
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

      if (performance.now() - fpsTelemetryTimestampRef.current > 2_500 || Math.round(nextFps) < 35) {
        fpsTelemetryTimestampRef.current = performance.now();
        recordPerformanceFpsSample(Math.round(nextFps));
      }
    });

    return () => {
      loop.stop();
    };
  }, [
    cameraRef,
    debugCameraRef,
    debugPathLengthRef,
    inertiaVelocityRef,
    isPanningRef,
    playerBeaconYValue,
    playerFrameValue,
    playerHaloYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    setDebugState,
    spriteSheet,
    syncCameraDebug,
    tileSize,
  ]);

  const {
    destinationOverlay,
    entityWorldPoints,
    landmarkWorldOverlays,
    pathWorldPoints,
    selectedTileWorldPoint,
    spatialLabelOverlays,
    structureWorldOverlays,
  } = useGameWorldOverlays({
    cameraState: debugState.camera,
    entities,
    landmarks,
    playerPath,
    selectedTile,
    selectedZoneId,
    structures,
    tileSize,
    zones,
  });
  const handleFollowPress = useCallback(() => {
    syncCameraDebug(cameraRef.current.setMode('follow'));
  }, [cameraRef, syncCameraDebug]);

  return (
    <View onLayout={handleViewportLayout} style={styles.wrapper}>
      <GestureDetector gesture={input.composedGesture}>
        <View style={styles.canvasFrame}>
          <GameCanvasScene
            cameraMatrixValue={cameraMatrixValue}
            entityWorldPoints={entityWorldPoints}
            landmarkWorldOverlays={landmarkWorldOverlays}
            pathWorldPoints={pathWorldPoints}
            playerBeaconYValue={playerBeaconYValue}
            playerHaloYValue={playerHaloYValue}
            playerImage={playerImage}
            playerMarkerYValue={playerMarkerYValue}
            playerSpriteBuffer={playerSpriteBuffer}
            playerTransformBuffer={playerTransformBuffer}
            playerWorldXValue={playerWorldXValue}
            playerWorldYValue={playerWorldYValue}
            selectedTileWorldPoint={selectedTileWorldPoint}
            structureSvgCatalog={structureSvgCatalog}
            structureWorldOverlays={structureWorldOverlays}
            tileSize={tileSize}
          />
        </View>
      </GestureDetector>

      <GameOverlayLayer
        debugState={debugState}
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
