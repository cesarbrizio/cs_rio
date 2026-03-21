import { roundGridPoint } from '@engine/coordinates';
import { InputHandler, type InputRect } from '@engine/input-handler';
import type { MovementController } from '@engine/movement';
import { findPath } from '@engine/pathfinding';
import type { Camera } from '@engine/camera';
import type { CameraMode, CameraState, GridPoint, ParsedTilemap, ScreenPoint } from '@engine/types';
import { useCallback, useEffect, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import type { useAudio } from '../../audio/AudioProvider';
import { shouldPlayWalkSfx } from '../../audio/audioFeedback';
import { type GameEntity } from './types';

interface UseGameInputInput {
  cameraRef: MutableRefObject<Camera>;
  debugPathLengthRef: MutableRefObject<number>;
  entities: GameEntity[];
  isPanningRef: MutableRefObject<boolean>;
  inertiaVelocityRef: MutableRefObject<ScreenPoint>;
  map: ParsedTilemap;
  movementRef: MutableRefObject<MovementController>;
  onCameraModeChange?: (mode: CameraMode) => void;
  onEntityTap?: (entityId: string) => void;
  onTileTap?: (tile: GridPoint) => void;
  playSfx: ReturnType<typeof useAudio>['playSfx'];
  setPlayerPath: Dispatch<SetStateAction<GridPoint[]>>;
  setSelectedTile: Dispatch<SetStateAction<GridPoint | null>>;
  showControlsOverlay: boolean;
  showDebugOverlay: boolean;
  syncCameraDebug: (cameraState: CameraState) => void;
  tileSize: {
    height: number;
    width: number;
  };
  uiRects: InputRect[];
}

interface UseGameInputResult {
  composedGesture: ReturnType<typeof Gesture.Simultaneous>;
  handlePanelLayout: (key: 'controls' | 'debug', event: LayoutChangeEvent) => void;
}

export function useGameInput({
  cameraRef,
  debugPathLengthRef,
  entities,
  isPanningRef,
  inertiaVelocityRef,
  map,
  movementRef,
  onCameraModeChange,
  onEntityTap,
  onTileTap,
  playSfx,
  setPlayerPath,
  setSelectedTile,
  showControlsOverlay,
  showDebugOverlay,
  syncCameraDebug,
  tileSize,
  uiRects,
}: UseGameInputInput): UseGameInputResult {
  const inputHandlerRef = useRef(
    new InputHandler({
      cameraProvider: () => cameraRef.current.getState(),
      tileSize,
    }),
  );
  const lastWalkSfxAtRef = useRef(0);
  const panOriginRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const panStartRef = useRef<CameraState>(cameraRef.current.getState());
  const pinchStartZoomRef = useRef(cameraRef.current.getState().zoom);
  const debugPanelRectRef = useRef<InputRect | null>(null);
  const controlsRectRef = useRef<InputRect | null>(null);

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
      onCameraModeChange?.('follow');
      const nextMovementState = movementRef.current.setPath(path);
      debugPathLengthRef.current = nextMovementState.path.length;
      setPlayerPath(nextMovementState.path);

      const nowMs = Date.now();

      if (shouldPlayWalkSfx(lastWalkSfxAtRef.current, nowMs)) {
        lastWalkSfxAtRef.current = nowMs;
        void playSfx('walk');
      }
    },
    [
      cameraRef,
      debugPathLengthRef,
      entities,
      map,
      movementRef,
      onCameraModeChange,
      onEntityTap,
      onTileTap,
      playSfx,
      setPlayerPath,
      setSelectedTile,
      syncCameraDebug,
    ],
  );

  const handlePan = useCallback((delta: ScreenPoint) => {
    const startState = panStartRef.current;
    syncCameraDebug(
      cameraRef.current.panTo({
        x: startState.x - delta.x / startState.zoom,
        y: startState.y - delta.y / startState.zoom,
      }),
    );
  }, [cameraRef, syncCameraDebug]);

  const handlePinch = useCallback((scale: number, anchor: ScreenPoint) => {
    syncCameraDebug(cameraRef.current.zoomTo(pinchStartZoomRef.current * scale, anchor));
  }, [cameraRef, syncCameraDebug]);

  const handleTapGestureEnd = useCallback((x: number, y: number, success: boolean) => {
    if (!success) {
      return;
    }

    inputHandlerRef.current.handleTap({ x, y });
  }, []);

  const handleLongPressGestureStart = useCallback((x: number, y: number) => {
    inputHandlerRef.current.handleLongPress({ x, y });
  }, []);

  const handlePanGestureStart = useCallback((x: number, y: number) => {
    panOriginRef.current = { x, y };
    panStartRef.current = cameraRef.current.getState();
    inertiaVelocityRef.current = { x: 0, y: 0 };
    isPanningRef.current = true;
    syncCameraDebug(cameraRef.current.setMode('free'));
    onCameraModeChange?.('free');
  }, [cameraRef, inertiaVelocityRef, isPanningRef, onCameraModeChange, syncCameraDebug]);

  const handlePanGestureUpdate = useCallback((
    translationX: number,
    translationY: number,
    velocityX: number,
    velocityY: number,
  ) => {
    inputHandlerRef.current.handlePan(panOriginRef.current, {
      x: translationX,
      y: translationY,
    });
    inertiaVelocityRef.current = {
      x: velocityX,
      y: velocityY,
    };
  }, [inertiaVelocityRef]);

  const handlePanGestureEnd = useCallback((velocityX: number, velocityY: number) => {
    isPanningRef.current = false;
    inertiaVelocityRef.current = {
      x: velocityX,
      y: velocityY,
    };
  }, [inertiaVelocityRef, isPanningRef]);

  const handlePinchGestureStart = useCallback(() => {
    pinchStartZoomRef.current = cameraRef.current.getState().zoom;
  }, [cameraRef]);

  const handlePinchGestureUpdate = useCallback((scale: number, focalX: number, focalY: number) => {
    inputHandlerRef.current.handlePinch(scale, {
      x: focalX,
      y: focalY,
    });
  }, []);

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
  }, [
    handlePan,
    handlePinch,
    resolveDestination,
    setSelectedTile,
    showControlsOverlay,
    showDebugOverlay,
    tileSize,
    uiRects,
  ]);

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
          handleTapGestureEnd(event.x, event.y, success);
        }),
    [handleTapGestureEnd],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .minDuration(350)
        .onStart((event) => {
          handleLongPressGestureStart(event.x, event.y);
        }),
    [handleLongPressGestureStart],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(4)
        .onStart((event) => {
          handlePanGestureStart(event.x, event.y);
        })
        .onUpdate((event) => {
          handlePanGestureUpdate(
            event.translationX,
            event.translationY,
            event.velocityX,
            event.velocityY,
          );
        })
        .onEnd((event) => {
          handlePanGestureEnd(event.velocityX, event.velocityY);
        }),
    [handlePanGestureEnd, handlePanGestureStart, handlePanGestureUpdate],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
          handlePinchGestureStart();
        })
        .onUpdate((event) => {
          handlePinchGestureUpdate(event.scale, event.focalX, event.focalY);
        }),
    [handlePinchGestureStart, handlePinchGestureUpdate],
  );

  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        pinchGesture,
        Gesture.Race(panGesture, Gesture.Exclusive(longPressGesture, tapGesture)),
      ),
    [longPressGesture, panGesture, pinchGesture, tapGesture],
  );

  return {
    composedGesture,
    handlePanelLayout,
  };
}
