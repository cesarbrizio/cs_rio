import { REGIONS } from '@cs-rio/shared';
import { useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';

import { buildHudContextTarget } from '../../features/hudContextActions';
import {
  getCurrentTutorialStep,
  getTutorialProgress,
  getTutorialRemainingMinutes,
  isTutorialStillActive,
} from '../../features/tutorial';
import { colors } from '../../theme/colors';
import { hapticLight } from '../../utils/haptics';
import { buildHudPanelProps } from './homeHudPanelProps';
import { buildQuickActions } from './homeHudQuickActions';
import {
  buildCompactRoundLabel,
  buildConnectionLabel,
  buildFocusChipLabel,
  buildFocusDetail,
  buildRoundDetail,
  buildRoundPressure,
  buildWorldDetail,
} from './homeHudDetails';
import { buildTopToast } from './homeHudToasts';
import {
  executeActionBarPress,
  executeContextActionPress,
  executeEventBannerPress,
  executeTutorialPrimaryAction,
} from './homeHudActions';
import { useHomeHudInteractions } from './useHomeHudInteractions';
import { useHomeHudLifecycle } from './useHomeHudLifecycle';
import { createHomeHudRuntimeActions } from './homeHudRuntimeActions';
import type {
  HomeHudControllerResult,
  HudRectState,
  UseHomeHudControllerInput,
} from './homeHudControllerTypes';

export function useHomeHudController({
  bootstrapTutorial,
  completeTutorialStep,
  consumeMapReturnCue,
  dismissEventBanner,
  dismissTutorial,
  eventBanner,
  hudPlayerState,
  logout,
  mapHeight,
  mapWidth,
  minimapMarkers,
  navigateNow,
  nearestWorldSpot,
  player,
  realtimeSnapshot,
  refreshHomeMapData,
  regionClimate,
  roundInflation,
  roundSummary,
  selectedMapFavelaId,
  selectedProjectedFavela,
  setBootstrapStatus,
  setHudPlayerState,
  setSelectedMapFavelaId,
  territoryOverview,
  tutorial,
  worldContextSpots,
  worldPulseItems,
}: UseHomeHudControllerInput): HomeHudControllerResult {
  const [contextTarget, setContextTarget] = useState<ReturnType<typeof buildHudContextTarget> | null>(null);
  const [expandedInfoPanel, setExpandedInfoPanel] = useState<'focus' | 'round' | 'world' | null>(
    null,
  );
  const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('follow');
  const [hudUiRectState, setHudUiRectState] = useState<HudRectState>({
    bottom: null,
    top: null,
  });
  const [tutorialNowMs, setTutorialNowMs] = useState(Date.now());
  const {
    cameraCommand,
    findNearbyWorldContextSpot,
    handlePlayerStateChange,
    interactionFeedback,
    issueCameraCommand,
    runCriticalUiAction,
    setInteractionFeedback,
    showInteractionFeedback,
  } = useHomeHudInteractions({
    hudPlayerState,
    setBootstrapStatus,
    setHudPlayerState,
    worldContextSpots,
  });

  const regionLabel = useMemo(
    () => REGIONS.find((region) => region.id === player?.regionId)?.label ?? 'Zona Norte',
    [player?.regionId],
  );
  const tutorialStep = useMemo(
    () => getCurrentTutorialStep(tutorial.completedStepIds),
    [tutorial.completedStepIds],
  );
  const tutorialProgress = useMemo(
    () => getTutorialProgress(tutorial.completedStepIds),
    [tutorial.completedStepIds],
  );
  const tutorialRemainingMinutes = useMemo(
    () => getTutorialRemainingMinutes(tutorial.startedAt, tutorialNowMs),
    [tutorial.startedAt, tutorialNowMs],
  );
  const tutorialActive = useMemo(
    () =>
      isTutorialStillActive(
        tutorial.startedAt,
        tutorial.completedStepIds,
        tutorial.dismissed,
        tutorialNowMs,
      ),
    [tutorial.completedStepIds, tutorial.dismissed, tutorial.startedAt, tutorialNowMs],
  );
  const compactRoundLabel = useMemo(
    () => buildCompactRoundLabel(roundSummary),
    [roundSummary],
  );
  const roundPressure = useMemo(
    () => buildRoundPressure(roundSummary, roundInflation),
    [roundInflation, roundSummary],
  );
  const roundDetail = useMemo(
    () => buildRoundDetail(compactRoundLabel, roundPressure, roundSummary),
    [compactRoundLabel, roundPressure, roundSummary],
  );
  const focusChipLabel = useMemo(
    () => buildFocusChipLabel(player, tutorialActive, tutorialStep),
    [player, tutorialActive, tutorialStep],
  );
  const focusDetail = useMemo(
    () => buildFocusDetail(player, tutorialActive, tutorialStep),
    [player, tutorialActive, tutorialStep],
  );
  const worldDetail = useMemo(
    () =>
      buildWorldDetail({
        eventBanner,
        nearestWorldSpot,
        player,
        regionClimate,
        regionLabel,
        selectedProjectedFavela,
      }),
    [
      eventBanner,
      nearestWorldSpot,
      player,
      regionClimate,
      regionLabel,
      selectedProjectedFavela,
    ],
  );

  useHomeHudLifecycle({
    bootstrapTutorial,
    consumeMapReturnCue,
    issueCameraCommand,
    player,
    refreshHomeMapData,
    selectedMapFavelaId,
    setBootstrapStatus,
    setSelectedMapFavelaId,
    setTutorialNowMs,
    showInteractionFeedback,
    territoryOverview,
    tutorialProgress,
  });

  const quickActions = useMemo(() => buildQuickActions(player), [player]);

  const handleEntityTap = useCallback(
    (entityId: string) => {
      const target = buildHudContextTarget(entityId);
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: `${target.title}: escolha uma acao contextual desse ponto.`,
        deferredSideEffect: () => {
          setContextTarget(target);
        },
        feedbackMessage: `${target.title} selecionado no mapa.`,
        haptic: 'light',
      });
    },
    [runCriticalUiAction],
  );

  const handleZoneTap = useCallback(
    (zoneId: string) => {
      const favela = territoryOverview?.favelas.find((entry) => entry.id === zoneId) ?? null;

      if (!favela) {
        runCriticalUiAction({
          accent: colors.info,
          bootstrapMessage: 'Area territorial ainda sem contexto carregado.',
          feedbackMessage: 'Favela prototipo selecionada.',
          haptic: 'light',
        });
        return;
      }

      setSelectedMapFavelaId(favela.id);
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: `${favela.name}: abrindo o contexto territorial dessa favela.`,
        feedbackMessage: `${favela.name} selecionada no mapa.`,
        haptic: 'light',
        navigate: () => {
          navigateNow('Territory', { focusFavelaId: favela.id });
        },
      });
    },
    [navigateNow, runCriticalUiAction, setSelectedMapFavelaId, territoryOverview?.favelas],
  );

  const handleActionBarPress = useCallback(
    (buttonId: string) => {
      executeActionBarPress(buttonId, {
        completeTutorialStep,
        logout,
        navigateNow,
        playerIsImprisoned: player?.prison.isImprisoned ?? false,
        runCriticalUiAction,
        setBootstrapStatus,
        setContextTarget,
        showInteractionFeedback,
      });
    },
    [
      completeTutorialStep,
      logout,
      navigateNow,
      player?.prison.isImprisoned,
      runCriticalUiAction,
      setBootstrapStatus,
      showInteractionFeedback,
    ],
  );

  const handleContextActionPress = useCallback(
    (action: Parameters<typeof executeContextActionPress>[0], target: Parameters<typeof executeContextActionPress>[1]) => {
      executeContextActionPress(action, target, {
        completeTutorialStep,
        navigateNow,
        runCriticalUiAction,
        setContextTarget,
      });
    },
    [completeTutorialStep, navigateNow, runCriticalUiAction],
  );

  const handleEventBannerPress = useCallback(() => {
    if (eventBanner) {
      executeEventBannerPress(eventBanner, { navigateNow, runCriticalUiAction });
    }
  }, [eventBanner, navigateNow, runCriticalUiAction]);

  const handleDismissEventBanner = useCallback(() => {
    if (eventBanner) {
      dismissEventBanner(eventBanner.id);
    }
  }, [dismissEventBanner, eventBanner]);

  const handleTutorialPrimaryAction = useCallback(() => {
    executeTutorialPrimaryAction(tutorialStep, {
      handleActionBarPress,
      setBootstrapStatus,
      showInteractionFeedback,
    });
  }, [handleActionBarPress, setBootstrapStatus, showInteractionFeedback, tutorialStep]);

  const runtimeActions = useMemo(
    () =>
      createHomeHudRuntimeActions({
        cameraMode,
        issueCameraCommand,
        navigateNow,
        runCriticalUiAction,
      }),
    [cameraMode, issueCameraCommand, navigateNow, runCriticalUiAction],
  );

  const connectionLabel = useMemo(
    () => buildConnectionLabel(realtimeSnapshot.status),
    [realtimeSnapshot.status],
  );
  const topToast = useMemo(
    () =>
      buildTopToast({
        dismissTutorial,
        eventBanner,
        handleDismissEventBanner,
        handleEventBannerPress,
        handleTutorialPrimaryAction,
        onOpenHospital: runtimeActions.openHospital,
        onOpenPrison: runtimeActions.openPrison,
        player,
        tutorialActive,
        tutorialProgress,
        tutorialRemainingMinutes: tutorialRemainingMinutes ?? 0,
        tutorialStep,
      }),
    [
      dismissTutorial,
      eventBanner,
      handleDismissEventBanner,
      handleEventBannerPress,
      handleTutorialPrimaryAction,
      player,
      runtimeActions,
      tutorialActive,
      tutorialProgress,
      tutorialRemainingMinutes,
      tutorialStep,
    ],
  );

  const expandedInfoContent = useMemo(() => {
    if (!expandedInfoPanel) {
      return null;
    }

    return expandedInfoPanel === 'round'
      ? roundDetail
      : expandedInfoPanel === 'world'
        ? worldDetail
        : focusDetail;
  }, [expandedInfoPanel, focusDetail, roundDetail, worldDetail]);

  const updateHudRect = useCallback((key: 'bottom' | 'top', rect: HudRectState['top']) => {
    setHudUiRectState((currentState) => ({
      ...currentState,
      [key]: rect,
    }));
  }, []);

  const handleTopHudLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      updateHudRect('top', { x, y, width, height });
    },
    [updateHudRect],
  );

  const handleBottomHudLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      updateHudRect('bottom', { x, y, width, height });
    },
    [updateHudRect],
  );

  const toggleExpandedInfoPanel = useCallback((panel: 'focus' | 'round' | 'world') => {
    hapticLight();
    setExpandedInfoPanel((currentPanel) => (currentPanel === panel ? null : panel));
  }, []);

  const handleTileTap = useCallback(
    (tile: { x: number; y: number }) => {
      hapticLight();
      completeTutorialStep('move');
      const nearbySpot = findNearbyWorldContextSpot(tile);

      if (nearbySpot) {
        const target = buildHudContextTarget(nearbySpot.entityId);
        setContextTarget(target);
        showInteractionFeedback(`${target.title} ao alcance.`, colors.accent);
        setBootstrapStatus(`${target.title}: toque no contexto para agir nesse ponto do mapa.`);
        return;
      }

      setContextTarget(null);
      showInteractionFeedback('Destino marcado no mapa.', colors.info);
      setBootstrapStatus(`Destino definido para ${tile.x}, ${tile.y}.`);
    },
    [completeTutorialStep, findNearbyWorldContextSpot, setBootstrapStatus, showInteractionFeedback],
  );

  const hudUiRects = useMemo(
    () => [hudUiRectState.top, hudUiRectState.bottom].flatMap((rect) => (rect ? [rect] : [])),
    [hudUiRectState.bottom, hudUiRectState.top],
  );

  const hudPanelProps = useMemo(
    () =>
      buildHudPanelProps({
        cameraMode,
        compactRoundLabel,
        connectionLabel,
        connectionStatus: realtimeSnapshot.status,
        contextTarget,
        expandedInfoContent,
        expandedInfoPanel,
        focusChipLabel,
        interactionFeedback,
        mapHeight,
        mapLabel: regionLabel,
        mapWidth,
        minimapMarkers,
        onActionBarPress: handleActionBarPress,
        onBottomLayout: handleBottomHudLayout,
        onContextActionPress: handleContextActionPress,
        onDismissInteractionFeedback: () => {
          setInteractionFeedback((currentFeedback) => (currentFeedback ? null : currentFeedback));
        },
        onOpenMap: runtimeActions.openMap,
        onOpenProfile: runtimeActions.openProfile,
        onRecenter: runtimeActions.recenterPlayer,
        onToggleCameraMode: runtimeActions.toggleCameraMode,
        onToggleExpandedInfoPanel: toggleExpandedInfoPanel,
        onTopLayout: handleTopHudLayout,
        onlineCount: realtimeSnapshot.players.length,
        player,
        playerPosition: hudPlayerState?.position ?? null,
        quickActions,
        roundPressure,
        setContextTarget,
        topToast,
        worldPulseItems,
      }),
    [
      cameraMode,
      compactRoundLabel,
      connectionLabel,
      contextTarget,
      expandedInfoContent,
      expandedInfoPanel,
      focusChipLabel,
      handleActionBarPress,
      handleBottomHudLayout,
      handleContextActionPress,
      handleTopHudLayout,
      hudPlayerState?.position,
      interactionFeedback,
      mapHeight,
      mapWidth,
      minimapMarkers,
      player,
      quickActions,
      runtimeActions,
      realtimeSnapshot.players.length,
      realtimeSnapshot.status,
      roundPressure,
      toggleExpandedInfoPanel,
      topToast,
      worldPulseItems,
      regionLabel,
    ],
  );

  return {
    cameraCommand,
    cameraMode,
    handleCameraModeChange: setCameraMode,
    handleEntityTap,
    handlePlayerStateChange,
    handleTileTap,
    handleZoneTap,
    hudPanelProps,
    hudUiRects,
  };
}
