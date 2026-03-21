import { colors } from '../../theme/colors';
import type { HomeHudPanelProps } from './HomeHudPanel';
import type { HomeHudToastConfig, HomeInfoCardContent } from './HomeHudOverlay';
import type { HudContextTarget } from '../../features/hudContextActions';
import type { MinimapMarker } from '../../components/hud/Minimap';
import type { GameViewPlayerState } from '../../components/GameView';
import type { PlayerProfile } from '@cs-rio/shared';
import type { WorldPulseItem, RoundPressure } from './homeTypes';
import type { InteractionFeedbackState } from './homeHudControllerTypes';
import type { ActionBarButton } from '../../components/hud/ActionBar';

export function buildHudPanelProps({
  cameraMode,
  compactRoundLabel,
  connectionLabel,
  connectionStatus,
  contextTarget,
  expandedInfoContent,
  expandedInfoPanel,
  focusChipLabel,
  interactionFeedback,
  mapHeight,
  mapLabel,
  mapWidth,
  minimapMarkers,
  onActionBarPress,
  onBottomLayout,
  onContextActionPress,
  onDismissInteractionFeedback,
  onOpenMap,
  onOpenProfile,
  onRecenter,
  onToggleCameraMode,
  onToggleExpandedInfoPanel,
  onTopLayout,
  onlineCount,
  player,
  playerPosition,
  quickActions,
  roundPressure,
  setContextTarget,
  topToast,
  worldPulseItems,
}: {
  cameraMode: 'follow' | 'free';
  compactRoundLabel: string;
  connectionLabel: string | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  contextTarget: HudContextTarget | null;
  expandedInfoContent: HomeInfoCardContent | null;
  expandedInfoPanel: 'focus' | 'round' | 'world' | null;
  focusChipLabel: string;
  interactionFeedback: InteractionFeedbackState | null;
  mapHeight: number;
  mapLabel: string;
  mapWidth: number;
  minimapMarkers: MinimapMarker[];
  onActionBarPress: (buttonId: string) => void;
  onBottomLayout: HomeHudPanelProps['onBottomLayout'];
  onContextActionPress: HomeHudPanelProps['onContextActionPress'];
  onDismissInteractionFeedback: () => void;
  onOpenMap: () => void;
  onOpenProfile: () => void;
  onRecenter: () => void;
  onToggleCameraMode: () => void;
  onToggleExpandedInfoPanel: (panel: 'focus' | 'round' | 'world') => void;
  onTopLayout: HomeHudPanelProps['onTopLayout'];
  onlineCount: number;
  player: PlayerProfile | null;
  playerPosition: GameViewPlayerState['position'] | null;
  quickActions: ActionBarButton[];
  roundPressure: RoundPressure | null;
  setContextTarget: (target: HudContextTarget | null) => void;
  topToast: HomeHudToastConfig | null;
  worldPulseItems: WorldPulseItem[];
}): HomeHudPanelProps {
  return {
    cameraMode,
    compactRoundLabel,
    connectionLabel,
    connectionStatus,
    contextTarget,
    expandedInfoContent,
    expandedInfoPanel,
    focusChipLabel,
    interactionFeedback,
    mapHeight,
    mapLabel,
    mapWidth,
    minimapMarkers,
    onActionBarPress,
    onBottomLayout,
    onCloseContextMenu: () => {
      setContextTarget(null);
    },
    onContextActionPress,
    onDismissInteractionFeedback,
    onOpenMap,
    onOpenProfile,
    onRecenter,
    onToggleCameraMode,
    onToggleExpandedInfoPanel,
    onTopLayout,
    onlineCount,
    player,
    playerPosition,
    quickActions,
    roundPressure,
    topToast,
    worldPulseItems,
  };
}
