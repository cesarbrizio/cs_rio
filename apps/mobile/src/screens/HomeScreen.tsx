import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHomeMapScene } from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RootStackParamList } from '../navigation/RootNavigator';
import { GameView, type GameViewPlayerState } from '../components/GameView';
import { type MinimapMarker } from '../components/hud/Minimap';
import { zonaNorteMapData } from '../data/zonaNortePrototypeMap';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { HomeHudPanel } from './home/HomeHudPanel';
import { useHomeHudController } from './home/useHomeHudController';
import { useHomeMapData } from './home/useHomeMapData';

const PROPERTY_MARKER_MIN_X = 24;
const PROPERTY_MARKER_MIN_Y = 32;
const PROPERTY_MARKER_OFFSET_X = 21;
const PROPERTY_MARKER_OFFSET_Y = 17;
const PROPERTY_MARKER_RESERVED_WIDTH = 48;
const PROPERTY_MARKER_RESERVED_HEIGHT = 64;
const RELEVANT_REMOTE_PLAYER_MAX_DISTANCE = 18;
const RELEVANT_REMOTE_PLAYER_MIN_COUNT = 2;
const RELEVANT_REMOTE_PLAYER_MAX_COUNT = 3;

type HomeNavigate = <T extends keyof RootStackParamList>(
  screen: T,
  ...rest: undefined extends RootStackParamList[T]
    ? [params?: RootStackParamList[T]]
    : [params: RootStackParamList[T]]
) => void;

export function HomeScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigateNow = navigation.navigate as HomeNavigate;
  const bootstrapTutorial = useAppStore((state) => state.bootstrapTutorial);
  const completeTutorialStep = useAppStore((state) => state.completeTutorialStep);
  const consumeMapReturnCue = useAppStore((state) => state.consumeMapReturnCue);
  const dismissEventBanner = useAppStore((state) => state.dismissEventBanner);
  const dismissTutorial = useAppStore((state) => state.dismissTutorial);
  const eventBanner = useAppStore((state) => state.eventBanner);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const tutorial = useAppStore((state) => state.tutorial);
  const logout = useAuthStore((state) => state.logout);
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const [selectedMapFavelaId, setSelectedMapFavelaId] = useState<string | null>(null);
  const [hudPlayerState, setHudPlayerState] = useState<GameViewPlayerState | null>(
    player?.hasCharacter
      ? {
          animation: 'idle_s',
          isMoving: false,
          position: {
            x: player.location.positionX,
            y: player.location.positionY,
          },
        }
      : null,
  );
  const {
    eventRuntimeState,
    propertySlots,
    realtimeSnapshot,
    refreshHomeMapData,
    roundInflation,
    roundSummary,
    territoryOverview,
  } = useHomeMapData({
    hasCharacter: player?.hasCharacter ?? false,
    regionId: player?.regionId,
    token,
  });

  const playerSpawnState = useMemo(
    () =>
      player?.hasCharacter
        ? {
            position: {
              x: player.location.positionX,
              y: player.location.positionY,
            },
          }
        : undefined,
    [player?.hasCharacter, player?.location.positionX, player?.location.positionY],
  );

  useEffect(() => {
    if (!player?.hasCharacter) {
      setHudPlayerState(null);
      return;
    }

    setHudPlayerState({
      animation: 'idle_s',
      isMoving: false,
      position: {
        x: player.location.positionX,
        y: player.location.positionY,
      },
    });
  }, [player?.hasCharacter, player?.location.positionX, player?.location.positionY]);

  const remotePlayers = useMemo(
    () =>
      realtimeSnapshot.players.filter((realtimePlayer) => realtimePlayer.playerId !== player?.id),
    [player?.id, realtimeSnapshot.players],
  );
  const referencePlayerPosition = hudPlayerState?.position ?? playerSpawnState?.position ?? null;
  const relevantRemotePlayers = useMemo(() => {
    if (!referencePlayerPosition) {
      return remotePlayers.slice(0, RELEVANT_REMOTE_PLAYER_MIN_COUNT).map((remotePlayer) => ({
        distance: Number.POSITIVE_INFINITY,
        player: remotePlayer,
      }));
    }

    return remotePlayers
      .map((remotePlayer) => ({
        distance:
          Math.abs(remotePlayer.x - referencePlayerPosition.x) +
          Math.abs(remotePlayer.y - referencePlayerPosition.y),
        player: remotePlayer,
      }))
      .sort((left, right) => left.distance - right.distance)
      .filter(
        (entry, index) =>
          entry.distance <= RELEVANT_REMOTE_PLAYER_MAX_DISTANCE ||
          index < RELEVANT_REMOTE_PLAYER_MIN_COUNT,
      )
      .slice(0, RELEVANT_REMOTE_PLAYER_MAX_COUNT);
  }, [referencePlayerPosition, remotePlayers]);
  const {
    map,
    nearestWorldSpot,
    regionClimate,
    renderEntities,
    selectedProjectedFavela,
    staticGroundPatches,
    staticLandmarks,
    staticStructures,
    staticWorldEntities,
    staticWorldTrails,
    staticWorldZones,
    worldContextSpots,
    worldPulseItems,
  } = useHomeMapScene({
    eventRuntimeState,
    hudPlayerPosition: hudPlayerState?.position,
    playerId: player?.id,
    playerFaction: player?.faction,
    playerRegionId: player?.regionId,
    playerSpawnPosition: playerSpawnState?.position,
    propertySlots,
    relevantRemotePlayers,
    selectedMapFavelaId,
    territoryOverview,
  });
  const minimapMarkers = useMemo<MinimapMarker[]>(
    () => [
      ...staticWorldEntities.map((entity) => ({
        id: entity.id,
        kind: 'location' as const,
        x: entity.position.x,
        y: entity.position.y,
      })),
      ...relevantRemotePlayers.map(({ player: realtimePlayer }) => ({
        id: realtimePlayer.sessionId,
        kind: 'player' as const,
        x: realtimePlayer.x,
        y: realtimePlayer.y,
      })),
      ...propertySlots
        .filter((slot) => slot.ownerId === player?.id)
        .map((slot) => ({
          id: slot.id,
        kind: 'property' as const,
          x:
            PROPERTY_MARKER_MIN_X +
            (slot.gridPosition.x % Math.max(map.width - PROPERTY_MARKER_RESERVED_WIDTH, 1)),
          y:
            PROPERTY_MARKER_MIN_Y +
            (slot.gridPosition.y % Math.max(map.height - PROPERTY_MARKER_RESERVED_HEIGHT, 1)),
        })),
    ],
    [map.height, map.width, player?.id, propertySlots, relevantRemotePlayers, staticWorldEntities],
  );
  const controller = useHomeHudController({
    bootstrapTutorial,
    completeTutorialStep,
    consumeMapReturnCue,
    dismissEventBanner,
    dismissTutorial,
    eventBanner,
    hudPlayerState,
    mapHeight: map.height,
    mapWidth: map.width,
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
    logout,
  });

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.worldShell}>
          <GameView
            cameraCommand={controller.cameraCommand}
            entities={renderEntities}
            groundPatches={staticGroundPatches}
            landmarks={staticLandmarks}
            mapData={zonaNorteMapData}
            onCameraModeChange={controller.handleCameraModeChange}
            onEntityTap={controller.handleEntityTap}
            onPlayerStateChange={controller.handlePlayerStateChange}
            onTileTap={controller.handleTileTap}
            onZoneTap={controller.handleZoneTap}
            playerState={playerSpawnState}
            selectedZoneId={selectedMapFavelaId}
            showControlsOverlay={false}
            showDebugOverlay={false}
            structures={staticStructures}
            trails={staticWorldTrails}
            uiRects={controller.hudUiRects}
            zones={staticWorldZones}
          />

          <HomeHudPanel {...controller.hudPanelProps} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1012',
    flex: 1,
    padding: 0,
  },
  safeArea: {
    backgroundColor: '#0f1012',
    flex: 1,
  },
  worldShell: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
});
