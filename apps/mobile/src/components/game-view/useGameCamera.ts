import { Camera } from '@engine/camera';
import { cartToIso } from '@engine/coordinates';
import type { MovementController } from '@engine/movement';
import type { CameraMode, CameraState, GridPoint, ScreenPoint } from '@engine/types';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  createCameraMatrix,
  getMapWorldBounds,
  getSceneWorldBounds,
} from './geometry';
import {
  type DebugState,
  type GameEntity,
  type GameStructure,
} from './types';

const INITIAL_VIEWPORT_SIZE = 1;
const SPRITE_IDLE_FALLBACK = 'idle_s';

interface SpriteFrameSnapshot {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface UseGameCameraInput {
  cameraCommand?: {
    token: number;
    type: 'follow' | 'free' | 'recenter';
  } | null;
  entities: GameEntity[];
  initialFrame: SpriteFrameSnapshot | null;
  mapHeight: number;
  mapWidth: number;
  movementRef: MutableRefObject<MovementController>;
  onCameraModeChange?: (mode: CameraMode) => void;
  spawnTile: GridPoint;
  structures: GameStructure[];
  tileSize: {
    height: number;
    width: number;
  };
}

interface UseGameCameraResult {
  cameraMatrixValue: ReturnType<typeof useSharedValue<number[]>>;
  cameraRef: MutableRefObject<Camera>;
  debugCameraRef: MutableRefObject<CameraState>;
  debugPathLengthRef: MutableRefObject<number>;
  debugState: DebugState;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
  inertiaVelocityRef: MutableRefObject<ScreenPoint>;
  isPanningRef: MutableRefObject<boolean>;
  onCameraModeChangeRef: MutableRefObject<((mode: CameraMode) => void) | undefined>;
  playerBeaconYValue: ReturnType<typeof useSharedValue<number>>;
  playerFrameValue: ReturnType<typeof useSharedValue<SpriteFrameSnapshot>>;
  playerHaloYValue: ReturnType<typeof useSharedValue<number>>;
  playerMarkerYValue: ReturnType<typeof useSharedValue<number>>;
  playerWorldXValue: ReturnType<typeof useSharedValue<number>>;
  playerWorldYValue: ReturnType<typeof useSharedValue<number>>;
  setDebugState: Dispatch<SetStateAction<DebugState>>;
  syncCameraDebug: (cameraState: CameraState) => void;
}

export function useGameCamera({
  cameraCommand = null,
  entities,
  initialFrame,
  mapHeight,
  mapWidth,
  movementRef,
  onCameraModeChange,
  spawnTile,
  structures,
  tileSize,
}: UseGameCameraInput): UseGameCameraResult {
  const initialWorldPosition = useMemo(() => cartToIso(spawnTile, tileSize), [spawnTile, tileSize]);
  const initialCameraState = useMemo<CameraState>(
    () => ({
      deadZoneHeight: 120,
      deadZoneWidth: 220,
      mode: 'follow',
      viewportHeight: INITIAL_VIEWPORT_SIZE,
      viewportWidth: INITIAL_VIEWPORT_SIZE,
      x: initialWorldPosition.x,
      y: initialWorldPosition.y,
      zoom: 1.72,
    }),
    [initialWorldPosition.x, initialWorldPosition.y],
  );
  const mapBounds = useMemo(
    () =>
      getSceneWorldBounds({
        entities,
        fallbackBounds: getMapWorldBounds(mapWidth, mapHeight, tileSize),
        spawnTile,
        structures,
        tileSize,
      }),
    [entities, mapHeight, mapWidth, spawnTile, structures, tileSize],
  );
  const cameraRef = useRef<Camera>(new Camera(initialCameraState, mapBounds));
  const debugCameraRef = useRef(initialCameraState);
  const debugPathLengthRef = useRef(0);
  const inertiaVelocityRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastCameraCommandTokenRef = useRef<number | null>(null);
  const onCameraModeChangeRef = useRef(onCameraModeChange);
  const cameraMatrixValue = useSharedValue<number[]>(createCameraMatrix(initialCameraState));
  const playerWorldXValue = useSharedValue(initialWorldPosition.x);
  const playerWorldYValue = useSharedValue(initialWorldPosition.y);
  const playerHaloYValue = useSharedValue(initialWorldPosition.y - 10);
  const playerBeaconYValue = useSharedValue(initialWorldPosition.y - 34);
  const playerMarkerYValue = useSharedValue(initialWorldPosition.y - 8);
  const playerFrameValue = useSharedValue<SpriteFrameSnapshot>({
    height: initialFrame?.height ?? 64,
    width: initialFrame?.width ?? 48,
    x: initialFrame?.x ?? 0,
    y: initialFrame?.y ?? 0,
  });
  const [debugState, setDebugState] = useState<DebugState>({
    camera: initialCameraState,
    clipName: SPRITE_IDLE_FALLBACK,
    fps: 0,
    playerPosition: spawnTile,
  });

  useEffect(() => {
    onCameraModeChangeRef.current = onCameraModeChange;
  }, [onCameraModeChange]);

  const syncCameraDebug = useCallback((cameraState: CameraState) => {
    debugCameraRef.current = cameraState;
    cameraMatrixValue.value = createCameraMatrix(cameraState);
  }, [cameraMatrixValue]);

  useEffect(() => {
    cameraRef.current = new Camera(initialCameraState, mapBounds);
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
      height: initialFrame?.height ?? 64,
      width: initialFrame?.width ?? 48,
      x: initialFrame?.x ?? 0,
      y: initialFrame?.y ?? 0,
    };
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
    playerBeaconYValue,
    playerFrameValue,
    playerHaloYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    spawnTile,
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
  }, [cameraCommand, movementRef, syncCameraDebug, tileSize]);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    if (width <= 0 || height <= 0) {
      return;
    }

    syncCameraDebug(cameraRef.current.setViewport({ height, width }));
  }, [syncCameraDebug]);

  return {
    cameraMatrixValue,
    cameraRef,
    debugCameraRef,
    debugPathLengthRef,
    debugState,
    handleViewportLayout,
    inertiaVelocityRef,
    isPanningRef,
    onCameraModeChangeRef,
    playerBeaconYValue,
    playerFrameValue,
    playerHaloYValue,
    playerMarkerYValue,
    playerWorldXValue,
    playerWorldYValue,
    setDebugState,
    syncCameraDebug,
  };
}
