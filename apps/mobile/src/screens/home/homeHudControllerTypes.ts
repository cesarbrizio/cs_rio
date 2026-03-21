import type { InputRect } from '@engine/input-handler';
import type { Dispatch, SetStateAction } from 'react';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { EventNotificationItem } from '../../features/events';
import type { RealtimeSnapshot } from '../../services/colyseus';
import type { TutorialState } from '../../stores/tutorialStore';
import type { MinimapMarker } from '../../components/hud/Minimap';
import type { GameViewPlayerState } from '../../components/GameView';
import type { HomeHudPanelProps } from './HomeHudPanel';
import type { ProjectedFavela, RegionClimateSummary, WorldContextSpot, WorldPulseItem } from './homeTypes';
import type { HomeInfoCardContent } from './HomeHudOverlay';
import type { HudContextTarget } from '../../features/hudContextActions';
import type {
  NpcInflationSummary,
  PlayerProfile,
  RoundSummary,
  TerritoryFavelaSummary,
} from '@cs-rio/shared';

export interface TerritoryOverview {
  favelas: TerritoryFavelaSummary[];
}

export interface CriticalUiActionOptions {
  accent?: string;
  bootstrapMessage?: string;
  deferredSideEffect?: () => void;
  feedbackMessage?: string;
  haptic?: 'light' | 'medium';
  immediateSideEffect?: () => void;
  navigate?: () => void;
}

export type HomeNavigate = <T extends keyof RootStackParamList>(
  screen: T,
  ...rest: undefined extends RootStackParamList[T]
    ? [params?: RootStackParamList[T]]
    : [params: RootStackParamList[T]]
) => void;

export interface UseHomeHudControllerInput {
  bootstrapTutorial: (playerId: string) => void;
  completeTutorialStep: (stepId: 'crimes' | 'market' | 'move' | 'territory') => void;
  consumeMapReturnCue: () => { accent?: string; message: string } | null;
  dismissEventBanner: (eventId: string) => void;
  dismissTutorial: () => void;
  eventBanner: EventNotificationItem | null;
  hudPlayerState: GameViewPlayerState | null;
  logout: () => Promise<void>;
  mapHeight: number;
  mapWidth: number;
  minimapMarkers: MinimapMarker[];
  navigateNow: HomeNavigate;
  nearestWorldSpot: {
    distance: number;
    title: string;
  } | null;
  player: PlayerProfile | null;
  realtimeSnapshot: RealtimeSnapshot;
  refreshHomeMapData: (cancelled?: () => boolean) => Promise<void>;
  regionClimate: RegionClimateSummary;
  roundInflation: NpcInflationSummary | null;
  roundSummary: RoundSummary | null;
  selectedMapFavelaId: string | null;
  selectedProjectedFavela: ProjectedFavela | null;
  setBootstrapStatus: (status: string) => void;
  setHudPlayerState: Dispatch<SetStateAction<GameViewPlayerState | null>>;
  setSelectedMapFavelaId: Dispatch<SetStateAction<string | null>>;
  territoryOverview: TerritoryOverview | null;
  tutorial: TutorialState;
  worldContextSpots: WorldContextSpot[];
  worldPulseItems: WorldPulseItem[];
}

export interface HomeHudControllerResult {
  cameraCommand: {
    token: number;
    type: 'follow' | 'free' | 'recenter';
  } | null;
  cameraMode: 'follow' | 'free';
  handleCameraModeChange: (mode: 'follow' | 'free') => void;
  handleEntityTap: (entityId: string) => void;
  handlePlayerStateChange: (playerState: GameViewPlayerState) => void;
  handleTileTap: (tile: { x: number; y: number }) => void;
  handleZoneTap: (zoneId: string) => void;
  hudPanelProps: HomeHudPanelProps;
  hudUiRects: InputRect[];
}

export interface InteractionFeedbackState {
  accent?: string;
  id: number;
  message: string;
}

export interface HudRectState {
  bottom: InputRect | null;
  top: InputRect | null;
}

export interface HomeHudSharedActionDeps {
  navigateNow: HomeNavigate;
  runCriticalUiAction: (options: CriticalUiActionOptions) => void;
  setBootstrapStatus: (status: string) => void;
  setContextTarget: (target: HudContextTarget | null) => void;
  showInteractionFeedback: (message: string, accent?: string) => void;
}

export type HomeInfoContent = HomeInfoCardContent | null;
