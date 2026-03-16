import { roundGridPoint } from '@engine/coordinates';
import { InputHandler, type InputRect } from '@engine/input-handler';
import type { MovementController } from '@engine/movement';
import { findPath } from '@engine/pathfinding';
import type { Camera } from '@engine/camera';
import type { CameraState, GridPoint, ParsedTilemap, ScreenPoint } from '@engine/types';
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
  onCameraModeChangeRef: MutableRefObject<((mode: 'follow' | 'free') => void) | undefined>;
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
  onCameraModeChangeRef,
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
    [
      cameraRef,
      debugPathLengthRef,
      entities,
      map,
      movementRef,
      onCameraModeChangeRef,
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
    [cameraRef, inertiaVelocityRef, isPanningRef, onCameraModeChangeRef, syncCameraDebug],
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
    [cameraRef],
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
