import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { colyseusService } from '../../services/colyseus';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import type { GameViewPlayerState } from '../../components/GameView';
import type { CriticalUiActionOptions, InteractionFeedbackState } from './homeHudControllerTypes';
import type { WorldContextSpot } from './homeTypes';

export function useHomeHudInteractions({
  hudPlayerState,
  setBootstrapStatus,
  setHudPlayerState,
  worldContextSpots,
}: {
  hudPlayerState: GameViewPlayerState | null;
  setBootstrapStatus: (status: string) => void;
  setHudPlayerState: Dispatch<SetStateAction<GameViewPlayerState | null>>;
  worldContextSpots: WorldContextSpot[];
}) {
  const [interactionFeedback, setInteractionFeedback] =
    useState<InteractionFeedbackState | null>(null);
  const [cameraCommand, setCameraCommand] = useState<{
    token: number;
    type: 'follow' | 'free' | 'recenter';
  } | null>(null);
  const latestHudPlayerStateRef = useRef<GameViewPlayerState | null>(hudPlayerState);
  const cameraCommandTokenRef = useRef(0);

  useEffect(() => {
    latestHudPlayerStateRef.current = hudPlayerState;
  }, [hudPlayerState]);

  const showInteractionFeedback = useCallback((message: string, accent?: string) => {
    setInteractionFeedback({
      accent,
      id: Date.now(),
      message,
    });
  }, []);

  const deferHomeWork = useCallback((task: () => void) => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(task);
    });
  }, []);

  const runCriticalUiAction = useCallback(
    (options: CriticalUiActionOptions) => {
      if (options.haptic === 'light') {
        hapticLight();
      } else {
        hapticMedium();
      }

      if (options.feedbackMessage) {
        showInteractionFeedback(options.feedbackMessage, options.accent);
      }

      options.immediateSideEffect?.();
      options.navigate?.();

      if (options.bootstrapMessage || options.deferredSideEffect) {
        deferHomeWork(() => {
          if (options.bootstrapMessage) {
            setBootstrapStatus(options.bootstrapMessage);
          }

          options.deferredSideEffect?.();
        });
      }
    },
    [deferHomeWork, setBootstrapStatus, showInteractionFeedback],
  );

  const findNearbyWorldContextSpot = useCallback(
    (tile: { x: number; y: number }) => {
      let bestMatch: WorldContextSpot | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const spot of worldContextSpots) {
        const distance = Math.abs(spot.position.x - tile.x) + Math.abs(spot.position.y - tile.y);
        if (distance <= spot.reach && distance < bestDistance) {
          bestMatch = spot;
          bestDistance = distance;
        }
      }

      return bestMatch;
    },
    [worldContextSpots],
  );

  const handlePlayerStateChange = useCallback(
    (playerState: GameViewPlayerState) => {
      const currentState = latestHudPlayerStateRef.current;
      const tileChanged =
        !currentState ||
        Math.round(currentState.position.x) !== Math.round(playerState.position.x) ||
        Math.round(currentState.position.y) !== Math.round(playerState.position.y);
      const motionChanged =
        !currentState ||
        currentState.isMoving !== playerState.isMoving ||
        currentState.animation !== playerState.animation;

      if (tileChanged || motionChanged) {
        const nextHudState = {
          ...playerState,
          position: {
            x: playerState.position.x,
            y: playerState.position.y,
          },
        };

        latestHudPlayerStateRef.current = nextHudState;
        setHudPlayerState(nextHudState);
      }

      colyseusService.sendPlayerMove({
        animation: playerState.animation,
        x: playerState.position.x,
        y: playerState.position.y,
      });
    },
    [setHudPlayerState],
  );

  const issueCameraCommand = useCallback((type: 'follow' | 'free' | 'recenter') => {
    cameraCommandTokenRef.current += 1;
    setCameraCommand({
      token: cameraCommandTokenRef.current,
      type,
    });
  }, []);

  return {
    cameraCommand,
    findNearbyWorldContextSpot,
    handlePlayerStateChange,
    interactionFeedback,
    issueCameraCommand,
    runCriticalUiAction,
    setInteractionFeedback,
    showInteractionFeedback,
  };
}
