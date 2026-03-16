import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  REGIONS,
  type NpcInflationSummary,
  type PlayerProfile,
  type RoundSummary,
} from '@cs-rio/shared';
import { type InputRect } from '@engine/input-handler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, type LayoutChangeEvent, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameView, type GameViewPlayerState } from '../components/GameView';
import { type ActionBarButton } from '../components/hud/ActionBar';
import { type MinimapMarker } from '../components/hud/Minimap';
import { zonaNorteMapData } from '../data/zonaNortePrototypeMap';
import {
  resolveEventDestinationLabel,
  resolveEventNotificationAccent,
  resolveEventNotificationTimeLabel,
} from '../features/events';
import {
  buildNpcInflationBody,
  buildNpcInflationDecisionHint,
  buildNpcInflationHeadline,
  formatNpcInflationMultiplier,
} from '../features/inflation';
import {
  buildHudContextTarget,
  type HudContextAction,
  type HudContextTarget,
} from '../features/hudContextActions';
import {
  getCurrentTutorialStep,
  getTutorialProgress,
  getTutorialRemainingMinutes,
  isTutorialStillActive,
} from '../features/tutorial';
import {
  colyseusService,
  type RealtimeSnapshot,
} from '../services/colyseus';
import { eventApi, roundApi, territoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { type RootStackParamList } from '../../App';
import {
  buildFavelaOwnerLabel,
  describeFavelaContext,
  orderBookBadge,
} from './home/homeHelpers';
import {
  type EventRuntimeState,
  type RoundPressure,
  type WorldContextSpot,
} from './home/homeTypes';
import {
  HomeHudOverlay,
  type HomeHudToastConfig,
  type HomeInfoCardContent,
} from './home/HomeHudOverlay';
import { useHomeMapScene } from './home/useHomeMapScene';

interface CriticalUiActionOptions {
  accent?: string;
  bootstrapMessage?: string;
  deferredSideEffect?: () => void;
  feedbackMessage?: string;
  haptic?: 'light' | 'medium';
  immediateSideEffect?: () => void;
  navigate?: () => void;
}

type HomeNavigate = <T extends keyof RootStackParamList>(
  screen: T,
  ...rest: undefined extends RootStackParamList[T]
    ? [params?: RootStackParamList[T]]
    : [params: RootStackParamList[T]]
) => void;

export function HomeScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigateTyped = navigation.navigate as HomeNavigate;
  const dismissEventBanner = useAppStore((state) => state.dismissEventBanner);
  const eventBanner = useAppStore((state) => state.eventBanner);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const bootstrapTutorial = useAppStore((state) => state.bootstrapTutorial);
  const completeTutorialStep = useAppStore((state) => state.completeTutorialStep);
  const consumeMapReturnCue = useAppStore((state) => state.consumeMapReturnCue);
  const dismissTutorial = useAppStore((state) => state.dismissTutorial);
  const tutorial = useAppStore((state) => state.tutorial);
  const logout = useAuthStore((state) => state.logout);
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const [territoryOverview, setTerritoryOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(null);
  const [eventRuntimeState, setEventRuntimeState] = useState<EventRuntimeState | null>(null);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>(
    colyseusService.getSnapshot(),
  );
  const [contextTarget, setContextTarget] = useState<HudContextTarget | null>(null);
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
  const [tutorialNowMs, setTutorialNowMs] = useState(Date.now());
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [roundInflation, setRoundInflation] = useState<NpcInflationSummary | null>(null);
  const [interactionFeedback, setInteractionFeedback] = useState<{
    accent?: string;
    id: number;
    message: string;
  } | null>(null);
  const [expandedInfoPanel, setExpandedInfoPanel] = useState<'focus' | 'round' | 'world' | null>(null);
  const [selectedMapFavelaId, setSelectedMapFavelaId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('follow');
  const [cameraCommand, setCameraCommand] = useState<{
    token: number;
    type: 'follow' | 'free' | 'recenter';
  } | null>(null);
  const [hudUiRectState, setHudUiRectState] = useState<{
    bottom: InputRect | null;
    top: InputRect | null;
  }>({
    bottom: null,
    top: null,
  });
  const latestHudPlayerStateRef = useRef<GameViewPlayerState | null>(hudPlayerState);
  const cameraCommandTokenRef = useRef(0);

  const loadRoundSummary = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await roundApi.getCenter();

      if (!cancelled?.()) {
        setRoundInflation(response.npcInflation);
        setRoundSummary(response.round);
      }
    } catch {
      // Silently fallback — roundPill stays with placeholder text.
    }
  }, []);

  const loadTerritoryOverview = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await territoryApi.list();

      if (!cancelled?.()) {
        setTerritoryOverview(response);
      }
    } catch {
      if (!cancelled?.()) {
        setTerritoryOverview(null);
      }
    }
  }, []);

  const loadEventRuntimeState = useCallback(async (cancelled?: () => boolean) => {
    try {
      const [docks, police, seasonal] = await Promise.all([
        eventApi.getDocksStatus(),
        eventApi.getPoliceStatus(),
        eventApi.getSeasonalStatus(),
      ]);

      if (!cancelled?.()) {
        setEventRuntimeState({
          docks,
          police,
          seasonal,
        });
      }
    } catch {
      if (!cancelled?.()) {
        setEventRuntimeState(null);
      }
    }
  }, []);

  useEffect(() => colyseusService.subscribe(setRealtimeSnapshot), []);

  useEffect(() => {
    if (!player?.hasCharacter || !token) {
      return;
    }

    void colyseusService.connectToRegionRoom({
      accessToken: token,
      regionId: player.regionId,
    });

    return () => {
      void colyseusService.disconnect();
    };
  }, [player?.hasCharacter, player?.regionId, token]);

  useEffect(() => {
    if (!selectedMapFavelaId) {
      return;
    }

    const stillExists = territoryOverview?.favelas.some((favela) => favela.id === selectedMapFavelaId);

    if (!stillExists) {
      setSelectedMapFavelaId(null);
    }
  }, [selectedMapFavelaId, territoryOverview?.favelas]);

  useEffect(() => {
    if (!player?.hasCharacter || !player.id) {
      return;
    }

    bootstrapTutorial(player.id);
  }, [bootstrapTutorial, player?.hasCharacter, player?.id]);

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
      latestHudPlayerStateRef.current = null;
      setHudPlayerState(null);
      return;
    }

    const nextState = {
      animation: 'idle_s',
      isMoving: false,
      position: {
        x: player.location.positionX,
        y: player.location.positionY,
      },
    };

    latestHudPlayerStateRef.current = nextState;
    setHudPlayerState(nextState);
  }, [player?.hasCharacter, player?.location.positionX, player?.location.positionY]);

  const remotePlayers = useMemo(
    () =>
      realtimeSnapshot.players.filter((realtimePlayer) => realtimePlayer.playerId !== player?.id),
    [player?.id, realtimeSnapshot.players],
  );
  const referencePlayerPosition = hudPlayerState?.position ?? playerSpawnState?.position ?? null;
  const relevantRemotePlayers = useMemo(() => {
    if (!referencePlayerPosition) {
      return remotePlayers.slice(0, 2).map((remotePlayer) => ({
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
      .filter((entry, index) => entry.distance <= 18 || index < 2)
      .slice(0, 3);
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
    playerFaction: player?.faction,
    playerRegionId: player?.regionId,
    playerSpawnPosition: playerSpawnState?.position,
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
      ...(player?.properties ?? []).map((property, index) => ({
        id: property.id,
        kind: 'property' as const,
        x: 24 + ((index * 21) % Math.max(map.width - 48, 1)),
        y: 32 + ((index * 17) % Math.max(map.height - 64, 1)),
      })),
    ],
    [map.height, map.width, player?.properties, relevantRemotePlayers, staticWorldEntities],
  );
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
  const compactRoundLabel = useMemo(() => {
    if (!roundSummary) {
      return 'Rodada carregando...';
    }

    return `Rodada #${roundSummary.number} · Dia ${roundSummary.currentGameDay}/${roundSummary.totalGameDays}`;
  }, [roundSummary]);
  const roundPressure = useMemo<RoundPressure | null>(() => {
    if (!roundSummary || !roundInflation) {
      return null;
    }

    return {
      detail: `${buildNpcInflationBody(roundInflation)} ${buildNpcInflationDecisionHint(roundInflation)}`,
      headline: buildNpcInflationHeadline(roundInflation),
      labels: [
        `Inflação ${formatNpcInflationMultiplier(roundInflation.currentMultiplier)}`,
        roundInflation.nextIncreaseInDays === null || roundInflation.nextMultiplier === null
          ? 'Teto da rodada'
          : `Sobe em ${roundInflation.nextIncreaseInDays}d`,
      ],
    };
  }, [roundInflation, roundSummary]);
  const roundDetail = useMemo(() => {
    if (!roundSummary) {
      return {
        detail: 'A rodada ainda está carregando. Assim que o backend responder, o tempo e a pressão aparecem aqui.',
        headline: 'Rodada ativa carregando...',
      };
    }

    return {
      detail: roundPressure
        ? `${roundPressure.headline} ${roundPressure.detail}`
        : 'A rodada está ativa e o ranking segue correndo em tempo real.',
      headline: compactRoundLabel,
    };
  }, [compactRoundLabel, roundPressure, roundSummary]);
  const focusChipLabel = useMemo(() => {
    if (player?.prison.isImprisoned) {
      return 'Foco: prisão';
    }

    if (player?.hospitalization.isHospitalized) {
      return 'Foco: hospital';
    }

    if (tutorialActive && tutorialStep) {
      return `Foco: ${tutorialStep.title}`;
    }

    if (!player?.faction) {
      return 'Foco: primeiro corre';
    }

    return 'Foco: seguir no corre';
  }, [
    player?.faction,
    player?.hospitalization.isHospitalized,
    player?.prison.isImprisoned,
    tutorialActive,
    tutorialStep,
  ]);
  const focusDetail = useMemo(() => {
    if (player?.prison.isImprisoned) {
      return {
        detail: 'Enquanto preso, quase todo o corre trava. A próxima decisão útil está na tela da prisão.',
        headline: 'Seu foco agora é sair da prisão.',
      };
    }

    if (player?.hospitalization.isHospitalized) {
      return {
        detail: 'Internado, seu ritmo cai. Resolver o hospital acelera sua volta para a rua.',
        headline: 'Seu foco agora é fechar a internação.',
      };
    }

    if (tutorialActive && tutorialStep) {
      return {
        detail: 'Feche esse passo para completar o loop básico entre mapa, ação e retorno.',
        headline: tutorialStep.hint,
      };
    }

    if (!player?.faction) {
      return {
        detail: 'Dinheiro, conceito e território aceleram sua entrada real na rodada.',
        headline: 'Faça um crime simples, treine e olhe território.',
      };
    }

    return {
      detail: 'Crime, negócio, combate e território seguem empurrando seu ranking e sua presença na cidade.',
      headline: 'Seu foco agora é seguir no corre.',
    };
  }, [
    player?.faction,
    player?.hospitalization.isHospitalized,
    player?.prison.isImprisoned,
    tutorialActive,
    tutorialStep,
  ]);

  useEffect(() => {
    if (tutorialProgress.completed !== tutorialProgress.total || tutorialProgress.total === 0) {
      return;
    }

    setBootstrapStatus('Tutorial inicial concluído. Agora siga no seu ritmo entre crimes, treino, mercado, facção e território.');
  }, [setBootstrapStatus, tutorialProgress.completed, tutorialProgress.total]);
  const quickActions = useMemo<ActionBarButton[]>(
    () => [
      ...(player?.prison.isImprisoned
        ? [
            {
              badge: 1,
              compactLabel: 'Prisão',
              description: 'Veja o tempo restante da pena e as saídas liberadas.',
              group: 'Meu corre',
              id: 'prison',
              label: 'Ver prisão',
              tone: 'danger' as const,
            },
          ]
        : []),
      {
        badge: player?.hospitalization.isHospitalized ? 1 : 0,
        compactLabel: 'Hospital',
        description: player?.hospitalization.isHospitalized
          ? 'Acompanhe a internação e os serviços liberados.'
          : 'Cure HP, trate vício, plano e cirurgia.',
        group: 'Meu corre',
        id: 'hospital',
        label: 'Ir ao hospital',
        tone: player?.hospitalization.isHospitalized ? 'default' as const : undefined,
      },
      {
        badge: 0,
        compactLabel: 'Corre',
        description: 'Faça seu próximo corre e evolua o personagem.',
        featured: true,
        group: 'Na rua',
        id: 'crimes',
        label: 'Fazer corre',
      },
      {
        badge: realtimeSnapshot.players.filter((entry) => entry.playerId !== player?.id).length,
        compactLabel: 'Caçar',
        description: 'Escolha alvo online, dê porrada ou monte emboscada.',
        group: 'Na rua',
        id: 'combat',
        label: 'Caçar alvo',
      },
      {
        badge: 0,
        compactLabel: 'Treino',
        description: 'Ganhe atributos e destrave novas opções.',
        featured: true,
        group: 'Meu corre',
        id: 'training',
        label: 'Treinar',
      },
      {
        badge: orderBookBadge(player?.inventory.length ?? 0, player?.resources.money ?? 0),
        compactLabel: 'Negócio',
        description: 'Compre, venda e repare equipamento.',
        group: 'Meu corre',
        id: 'market',
        label: 'Negociar',
      },
      {
        badge: 0,
        compactLabel: 'Bicho',
        description: 'Aposta manual da rua. Abra a banca e entre no sorteio atual.',
        group: 'Meu corre',
        id: 'bicho',
        label: 'Jogo do Bicho',
      },
      {
        badge: 0,
        compactLabel: 'Eventos',
        description: 'Veja eventos ativos e o histórico recente dos resultados do mapa.',
        group: 'Na rua',
        id: 'events',
        label: 'Ver eventos',
      },
      {
        badge: player?.inventory.length ?? 0,
        compactLabel: 'Equipar',
        description: 'Equipe armas, coletes e consumíveis.',
        group: 'Meu corre',
        id: 'inventory',
        label: 'Equipar',
      },
      {
        badge: player?.properties.length ?? 0,
        compactLabel: 'Ativos',
        description: 'Gerencie operações que giram caixa e a sua base de imóveis, veículos e proteção.',
        group: 'Meu corre',
        id: 'ops',
        label: 'Gerir ativos',
      },
      {
        badge: 0,
        compactLabel: 'Dominar',
        description: 'Veja domínio, serviços, X9 e guerras.',
        featured: true,
        group: 'Na rua',
        id: 'territory',
        label: 'Dominar área',
      },
      {
        badge: 0,
        compactLabel: 'Julgar',
        description: 'Julgue casos da favela e aplique a punição escolhida.',
        group: 'Na rua',
        id: 'tribunal',
        label: 'Julgar caso',
      },
      {
        badge: 0,
        compactLabel: 'Sabotar',
        description: 'Escolha um alvo rival, veja cooldown e recupere sua base se ela tomar dano.',
        group: 'Na rua',
        id: 'sabotage',
        label: 'Sabotar rival',
      },
      {
        badge: player?.faction ? 1 : 0,
        compactLabel: 'Facção',
        description: 'Membros, banco, upgrades, liderança e o chat interno da facção.',
        group: 'Rede',
        id: 'faction',
        label: 'Falar com a facção',
      },
      {
        badge: 0,
        compactLabel: 'Contatos',
        description: 'Gerencie parceiros, conhecidos e DMs; global, local e comércio ficam fora do recorte atual.',
        group: 'Rede',
        id: 'contacts',
        label: 'Abrir contatos',
      },
      {
        badge: 0,
        compactLabel: 'Estudar',
        description: 'Cursos, perks exclusivos e timers da sua trilha.',
        group: 'Meu corre',
        id: 'university',
        label: 'Estudar',
      },
      {
        badge: 0,
        compactLabel: 'Vocação',
        description: 'Troque a build, veja cooldown e acompanhe o impacto real da sua trilha.',
        group: 'Meu corre',
        id: 'vocation',
        label: 'Gerir vocação',
      },
      {
        badge: 0,
        compactLabel: 'Perfil',
        description: 'Consulte atributos, vocação e equipamentos.',
        group: 'Conta',
        id: 'profile',
        label: 'Ver perfil',
      },
      {
        badge: 0,
        compactLabel: 'Ajustes',
        description: 'Som, preferências e sessão do dispositivo.',
        group: 'Conta',
        id: 'settings',
        label: 'Ajustar jogo',
      },
      {
        badge: 0,
        compactLabel: 'Sair',
        description: 'Encerrar a sessão neste aparelho.',
        group: 'Conta',
        id: 'logout',
        label: 'Sair',
        tone: 'danger',
      },
    ],
    [
      player?.faction,
      player?.hospitalization.isHospitalized,
      player?.id,
      player?.inventory.length,
      player?.prison.isImprisoned,
      player?.properties,
      player?.resources.money,
      realtimeSnapshot.players,
    ],
  );
  const worldDetail = useMemo(() => {
    if (selectedProjectedFavela) {
      return {
        detail: describeFavelaContext(selectedProjectedFavela.favela, player?.faction?.id ?? null),
        headline: `${selectedProjectedFavela.favela.name} · ${buildFavelaOwnerLabel(selectedProjectedFavela.favela)}`,
      };
    }

    const nearbyDetail = nearestWorldSpot
      ? nearestWorldSpot.distance <= 6
        ? `${nearestWorldSpot.title} está logo ao alcance.`
        : `${nearestWorldSpot.title} é o ponto mais próximo do seu corre agora.`
      : 'Ainda falta um ponto forte próximo para puxar sua próxima ação.';
    const factionDetail = player?.faction
      ? `Você está sob a bandeira ${player.faction.abbreviation}.`
      : 'Você ainda está sem proteção de facção.';
    const eventDetail = eventBanner
      ? `${eventBanner.title} está mudando o clima dessa região.`
      : `${regionClimate.pressureLabel}. ${factionDetail}`;

    return {
      detail: `${nearbyDetail} ${eventDetail}`,
      headline: `Na rua · ${regionLabel}`,
    };
  }, [
    eventBanner,
    nearestWorldSpot,
    player?.faction,
    regionClimate.pressureLabel,
    regionLabel,
    selectedProjectedFavela,
  ]);

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
  const navigateNow = useCallback<HomeNavigate>(
    (screen, ...rest) => {
      navigateTyped(screen, ...rest);
    },
    [navigateTyped],
  );
  const runCriticalUiAction = useCallback((options: CriticalUiActionOptions) => {
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
  }, [deferHomeWork, setBootstrapStatus, showInteractionFeedback]);
  const findNearbyWorldContextSpot = useCallback(
    (tile: { x: number; y: number }): WorldContextSpot | null => {
      let bestMatch: WorldContextSpot | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const spot of worldContextSpots) {
        const distance =
          Math.abs(spot.position.x - tile.x) + Math.abs(spot.position.y - tile.y);

        if (distance <= spot.reach && distance < bestDistance) {
          bestMatch = spot;
          bestDistance = distance;
        }
      }

      return bestMatch;
    },
    [worldContextSpots],
  );

  const handlePlayerStateChange = useCallback((playerState: GameViewPlayerState) => {
    const currentState = latestHudPlayerStateRef.current;
    const tileChanged = !currentState
      || Math.round(currentState.position.x) !== Math.round(playerState.position.x)
      || Math.round(currentState.position.y) !== Math.round(playerState.position.y);
    const motionChanged = !currentState
      || currentState.isMoving !== playerState.isMoving
      || currentState.animation !== playerState.animation;

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
  }, []);
  const handleEntityTap = useCallback((entityId: string) => {
    const target = buildHudContextTarget(entityId);
    runCriticalUiAction({
      accent: colors.info,
      bootstrapMessage: `${target.title}: escolha uma ação contextual desse ponto.`,
      deferredSideEffect: () => {
        setContextTarget(target);
      },
      feedbackMessage: `${target.title} selecionado no mapa.`,
      haptic: 'light',
    });
  }, [runCriticalUiAction]);
  const handleZoneTap = useCallback((zoneId: string) => {
    const favela = territoryOverview?.favelas.find((entry) => entry.id === zoneId) ?? null;

    if (!favela) {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Área territorial ainda sem contexto carregado.',
        feedbackMessage: 'Favela protótipo selecionada.',
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
        navigateNow('Territory', {
          focusFavelaId: favela.id,
        });
      },
    });
  }, [navigateNow, runCriticalUiAction, territoryOverview?.favelas]);
  const handleActionBarPress = useCallback((buttonId: string) => {
    if (buttonId === 'prison') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Abrindo a central da prisão.',
        feedbackMessage: 'Prisão selecionada.',
        navigate: () => {
          navigateNow('Prison');
        },
      });
      return;
    }

    if (buttonId === 'hospital') {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo a central do hospital.',
        feedbackMessage: 'Hospital selecionado.',
        navigate: () => {
          navigateNow('Hospital');
        },
      });
      return;
    }

    if (
      player?.prison.isImprisoned &&
      !['profile', 'settings', 'logout'].includes(buttonId)
    ) {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Seu personagem está preso. Veja o timer e as saídas disponíveis na tela da prisão.',
        feedbackMessage: 'Seu personagem está preso. Redirecionando para a prisão.',
        navigate: () => {
          navigateNow('Prison');
        },
      });
      return;
    }

    if (buttonId === 'crimes') {
      runCriticalUiAction({
        accent: colors.accent,
        bootstrapMessage: 'Abrindo crimes para o seu primeiro corre.',
        deferredSideEffect: () => {
          completeTutorialStep('crimes');
        },
        feedbackMessage: 'Crimes selecionados.',
        navigate: () => {
          navigateNow('Crimes');
        },
      });
      return;
    }

    if (buttonId === 'inventory') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo o inventário do personagem.',
        feedbackMessage: 'Inventário selecionado.',
        navigate: () => {
          navigateNow('Inventory');
        },
      });
      return;
    }

    if (buttonId === 'combat') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Abrindo a central de combate PvP.',
        feedbackMessage: 'Combate selecionado.',
        navigate: () => {
          navigateNow('Combat');
        },
      });
      return;
    }

    if (buttonId === 'market') {
      runCriticalUiAction({
        accent: colors.accent,
        bootstrapMessage: 'Abrindo o Mercado Negro.',
        deferredSideEffect: () => {
          completeTutorialStep('market');
        },
        feedbackMessage: 'Mercado Negro selecionado.',
        navigate: () => {
          navigateNow('Market');
        },
      });
      return;
    }

    if (buttonId === 'bicho') {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo a banca do Jogo do Bicho.',
        feedbackMessage: 'Jogo do Bicho selecionado.',
        navigate: () => {
          navigateNow('Bicho');
        },
      });
      return;
    }

    if (buttonId === 'events') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo a central de eventos com ativos e resultados recentes.',
        feedbackMessage: 'Eventos selecionados.',
        navigate: () => {
          navigateNow('Events');
        },
      });
      return;
    }

    if (buttonId === 'ops') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo operações e base logística do personagem.',
        feedbackMessage: 'Ativos selecionados.',
        navigate: () => {
          navigateNow('Operations');
        },
      });
      return;
    }

    if (buttonId === 'training') {
      runCriticalUiAction({
        accent: colors.success,
        bootstrapMessage: 'Abrindo o Centro de Treino.',
        deferredSideEffect: () => {
          completeTutorialStep('training');
        },
        feedbackMessage: 'Treino selecionado.',
        navigate: () => {
          navigateNow('Training');
        },
      });
      return;
    }

    if (buttonId === 'territory') {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo a central de território.',
        deferredSideEffect: () => {
          completeTutorialStep('territory');
        },
        feedbackMessage: 'Território selecionado.',
        navigate: () => {
          navigateNow('Territory');
        },
      });
      return;
    }

    if (buttonId === 'tribunal') {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo o Tribunal do Tráfico.',
        feedbackMessage: 'Tribunal selecionado.',
        navigate: () => {
          navigateNow('Tribunal');
        },
      });
      return;
    }

    if (buttonId === 'sabotage') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Abrindo a central de sabotagem e resposta operacional.',
        feedbackMessage: 'Sabotagem selecionada.',
        navigate: () => {
          navigateNow('Sabotage');
        },
      });
      return;
    }

    if (buttonId === 'faction') {
      runCriticalUiAction({
        accent: colors.accent,
        bootstrapMessage: 'Abrindo o QG da facção.',
        feedbackMessage: 'Facção selecionada.',
        navigate: () => {
          navigateNow('Faction');
        },
      });
      return;
    }

    if (buttonId === 'contacts') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo sua rede de contatos e mensagens privadas.',
        feedbackMessage: 'Contatos selecionados.',
        navigate: () => {
          navigateNow('Contacts');
        },
      });
      return;
    }

    if (buttonId === 'university') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo a Universidade do Crime.',
        feedbackMessage: 'Universidade selecionada.',
        navigate: () => {
          navigateNow('University');
        },
      });
      return;
    }

    if (buttonId === 'vocation') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo a Central de Vocação.',
        feedbackMessage: 'Vocação selecionada.',
        navigate: () => {
          navigateNow('Vocation');
        },
      });
      return;
    }

    if (buttonId === 'profile') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo o perfil completo.',
        feedbackMessage: 'Perfil selecionado.',
        navigate: () => {
          navigateNow('Profile');
        },
      });
      return;
    }

    if (buttonId === 'settings') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo configurações.',
        feedbackMessage: 'Configurações selecionadas.',
        navigate: () => {
          navigateNow('Settings');
        },
      });
      return;
    }

    if (buttonId === 'logout') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Encerrando a sessão deste dispositivo.',
        feedbackMessage: 'Encerrando a sessão…',
        immediateSideEffect: () => {
          void logout();
        },
      });
      return;
    }

    runCriticalUiAction({
      accent: colors.accent,
      bootstrapMessage: `Ação "${buttonId}" selecionada.`,
      feedbackMessage: `Ação "${buttonId}" selecionada.`,
    });
  }, [
    completeTutorialStep,
    logout,
    navigateNow,
    player?.prison.isImprisoned,
    runCriticalUiAction,
  ]);
  const handleContextActionPress = useCallback((
    action: HudContextAction,
    target: HudContextTarget,
  ) => {
    if (target.entityId.includes('mercado') || target.entityId.includes('black_market')) {
      const initialTab = action.id === 'sell' || action.id === 'repair' ? action.id : 'buy';
      runCriticalUiAction({
        accent: colors.accent,
        bootstrapMessage: `Mercado Negro: ${action.label}`,
        deferredSideEffect: () => {
          completeTutorialStep('market');
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Market', {
            initialTab,
          });
        },
      });
      return;
    }

    if (target.entityId.includes('hospital')) {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Hospital');
        },
      });
      return;
    }

    if (target.entityId.includes('treino')) {
      runCriticalUiAction({
        accent: colors.success,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          completeTutorialStep('training');
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Training');
        },
      });
      return;
    }

    if (target.entityId.includes('universidade')) {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('University');
        },
      });
      return;
    }

    if (target.entityId.includes('rave') || target.entityId.includes('baile')) {
      if (action.id === 'vibe') {
        runCriticalUiAction({
          accent: colors.warning,
          bootstrapMessage: `${target.title}: ${action.label}`,
          deferredSideEffect: () => {
            setContextTarget(null);
          },
          feedbackMessage: `${target.title}: ${action.label}.`,
          navigate: () => {
            navigateNow('Operations', {
              focusPropertyType: 'rave',
              initialTab: 'business',
            });
          },
        });
        return;
      }

      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('DrugUse', {
            initialVenue: target.entityId.includes('baile') ? 'baile' : 'rave',
          });
        },
      });
      return;
    }

    if (target.entityId.includes('doca') || target.entityId.includes('porto')) {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Market', {
            initialTab: 'sell',
          });
        },
      });
      return;
    }

    if (target.entityId.includes('desmanche')) {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Market', {
            initialTab: 'sell',
          });
        },
      });
      return;
    }

    if (
      target.entityId.includes('boca') ||
      target.entityId.includes('fabrica') ||
      target.entityId.includes('factory') ||
      target.entityId.includes('laboratorio') ||
      target.entityId.includes('lab')
    ) {
      runCriticalUiAction({
        accent: colors.success,
        bootstrapMessage: `${target.title}: ${action.label}`,
        deferredSideEffect: () => {
          setContextTarget(null);
        },
        feedbackMessage: `${target.title}: ${action.label}.`,
        navigate: () => {
          navigateNow('Operations', {
            focusPropertyType: target.entityId.includes('boca') ? 'boca' : 'factory',
            initialTab: 'business',
          });
        },
      });
      return;
    }

    runCriticalUiAction({
      accent: colors.info,
      bootstrapMessage: `${target.title}: ${action.label}`,
      deferredSideEffect: () => {
        setContextTarget(null);
      },
      feedbackMessage: `${target.title}: ${action.label}.`,
    });
  }, [completeTutorialStep, navigateNow, runCriticalUiAction]);
  const handleEventBannerPress = useCallback(() => {
    if (!eventBanner) {
      return;
    }

    switch (eventBanner.destination) {
      case 'territory':
        runCriticalUiAction({
          accent: resolveEventNotificationAccent(eventBanner.severity),
          bootstrapMessage: `${eventBanner.title}: acompanhando o impacto no território.`,
          feedbackMessage: `${eventBanner.title}: abrindo território.`,
          navigate: () => {
            navigateNow('Territory');
          },
        });
        break;
      case 'market':
        runCriticalUiAction({
          accent: resolveEventNotificationAccent(eventBanner.severity),
          bootstrapMessage: `${eventBanner.title}: abrindo o mercado para reagir ao evento.`,
          feedbackMessage: `${eventBanner.title}: reagindo no mercado.`,
          navigate: () => {
            navigateNow('Market', {
              initialTab: 'sell',
            });
          },
        });
        break;
      case 'map':
        runCriticalUiAction({
          accent: resolveEventNotificationAccent(eventBanner.severity),
          bootstrapMessage: `${eventBanner.title}: abrindo o mapa tático.`,
          feedbackMessage: `${eventBanner.title}: abrindo mapa.`,
          navigate: () => {
            navigateNow('Map');
          },
        });
        break;
    }
  }, [eventBanner, navigateNow, runCriticalUiAction]);
  const handleDismissEventBanner = useCallback(() => {
    if (!eventBanner) {
      return;
    }

    dismissEventBanner(eventBanner.id);
  }, [dismissEventBanner, eventBanner]);

  const handleTutorialPrimaryAction = useCallback(() => {
    if (!tutorialStep) {
      return;
    }

    if (tutorialStep.id === 'move') {
      setBootstrapStatus('Toque no chão do mapa para marcar um destino e completar o primeiro passo.');
      showInteractionFeedback('Toque no mapa para marcar um destino.', colors.accent);
      return;
    }

    if (tutorialStep.actionId) {
      handleActionBarPress(tutorialStep.actionId);
    }
  }, [handleActionBarPress, setBootstrapStatus, showInteractionFeedback, tutorialStep]);

  /* ---------- connection status label (D.2 — offline fallback) ---------- */
  const connectionLabel = useMemo(() => {
    if (realtimeSnapshot.status === 'connected') return null;
    if (realtimeSnapshot.status === 'disconnected') return 'Offline — modo solo';
    if (realtimeSnapshot.status === 'reconnecting') return 'Reconectando...';
    return 'Conectando...';
  }, [realtimeSnapshot.status]);
  const topToast = useMemo<HomeHudToastConfig | null>(() => {
    if (player?.prison.isImprisoned) {
      return {
        accent: colors.danger,
        autoDismissMs: 0,
        ctaLabel: 'Abrir prisão',
        message: `Preso · ${Math.max(1, Math.ceil(player.prison.remainingSeconds / 60))}min restantes`,
        onCta: () => {
          runCriticalUiAction({
            accent: colors.danger,
            bootstrapMessage: 'Abrindo a central da prisão.',
            feedbackMessage: 'Prisão selecionada.',
            navigate: () => {
              navigateNow('Prison');
            },
          });
        },
      };
    }

    if (player?.hospitalization.isHospitalized) {
      return {
        accent: colors.warning,
        autoDismissMs: 0,
        ctaLabel: 'Abrir hospital',
        message: `Internado · ${Math.max(1, Math.ceil(player.hospitalization.remainingSeconds / 60))}min restantes`,
        onCta: () => {
          runCriticalUiAction({
            accent: colors.warning,
            bootstrapMessage: 'Abrindo a central do hospital.',
            feedbackMessage: 'Hospital selecionado.',
            navigate: () => {
              navigateNow('Hospital');
            },
          });
        },
      };
    }

    if (eventBanner) {
      return {
        accent: resolveEventNotificationAccent(eventBanner.severity),
        ctaLabel: resolveEventDestinationLabel(eventBanner.destination),
        message: `${eventBanner.title} · ${eventBanner.regionLabel} · ${resolveEventNotificationTimeLabel(eventBanner.remainingSeconds)}`,
        onCta: handleEventBannerPress,
        onDismiss: handleDismissEventBanner,
      };
    }

    if (tutorialActive && tutorialStep) {
      return {
        accent: colors.accent,
        autoDismissMs: 15000,
        ctaLabel: tutorialStep.ctaLabel,
        message: `Tutorial ${tutorialProgress.current}/${tutorialProgress.total}: ${tutorialStep.title} · ${tutorialRemainingMinutes} min restantes`,
        onCta: handleTutorialPrimaryAction,
        onDismiss: dismissTutorial,
      };
    }

    return null;
  }, [
    dismissTutorial,
    eventBanner,
    handleDismissEventBanner,
    handleEventBannerPress,
    handleTutorialPrimaryAction,
    navigateNow,
    player?.hospitalization.isHospitalized,
    player?.hospitalization.remainingSeconds,
    player?.prison.isImprisoned,
    player?.prison.remainingSeconds,
    runCriticalUiAction,
    tutorialActive,
    tutorialProgress,
    tutorialRemainingMinutes,
    tutorialStep,
  ]);
  const expandedInfoContent = useMemo<HomeInfoCardContent | null>(() => {
    if (!expandedInfoPanel) {
      return null;
    }

    return expandedInfoPanel === 'round'
      ? roundDetail
      : expandedInfoPanel === 'world'
        ? worldDetail
        : focusDetail;
  }, [expandedInfoPanel, focusDetail, roundDetail, worldDetail]);

  const hudUiRects = useMemo(
    () => [hudUiRectState.top, hudUiRectState.bottom].flatMap((rect) => (rect ? [rect] : [])),
    [hudUiRectState.bottom, hudUiRectState.top],
  );

  const updateHudRect = useCallback((key: 'bottom' | 'top', rect: InputRect) => {
    setHudUiRectState((currentState) => ({
      ...currentState,
      [key]: rect,
    }));
  }, []);
  const handleTopHudLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    updateHudRect('top', { x, y, width, height });
  }, [updateHudRect]);
  const handleBottomHudLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    updateHudRect('bottom', { x, y, width, height });
  }, [updateHudRect]);
  const issueCameraCommand = useCallback((type: 'follow' | 'free' | 'recenter') => {
    cameraCommandTokenRef.current += 1;
    setCameraCommand({
      token: cameraCommandTokenRef.current,
      type,
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const nextCue = consumeMapReturnCue();

      if (nextCue) {
        showInteractionFeedback(nextCue.message, nextCue.accent);
        setBootstrapStatus(nextCue.message);
        issueCameraCommand('recenter');
      }

      if (!player?.hasCharacter) {
        return () => {
          cancelled = true;
        };
      }

      const isCancelled = () => cancelled;
      const refreshHomeFeeds = () =>
        Promise.all([
          loadRoundSummary(isCancelled),
          loadTerritoryOverview(isCancelled),
          loadEventRuntimeState(isCancelled),
        ]);

      setTutorialNowMs(Date.now());
      void refreshHomeFeeds();

      const intervalId = setInterval(() => {
        setTutorialNowMs(Date.now());
        void refreshHomeFeeds();
      }, 60_000);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [
      consumeMapReturnCue,
      issueCameraCommand,
      loadEventRuntimeState,
      loadRoundSummary,
      loadTerritoryOverview,
      player?.hasCharacter,
      setBootstrapStatus,
      showInteractionFeedback,
    ]),
  );
  const toggleExpandedInfoPanel = useCallback((panel: 'focus' | 'round' | 'world') => {
    hapticLight();
    setExpandedInfoPanel((currentPanel) => (currentPanel === panel ? null : panel));
  }, []);

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      {/* A.1 — container sem padding, worldShell sem borda */}
      <View style={styles.container}>
        <View style={styles.worldShell}>
          <GameView
            cameraCommand={cameraCommand}
            entities={renderEntities}
            groundPatches={staticGroundPatches}
            landmarks={staticLandmarks}
            mapData={zonaNorteMapData}
            onCameraModeChange={setCameraMode}
            onEntityTap={handleEntityTap}
            onPlayerStateChange={handlePlayerStateChange}
            onTileTap={(tile) => {
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
            }}
            onZoneTap={handleZoneTap}
            playerState={playerSpawnState}
            selectedZoneId={selectedMapFavelaId}
            showControlsOverlay={false}
            showDebugOverlay={false}
            structures={staticStructures}
            trails={staticWorldTrails}
            uiRects={hudUiRects}
            zones={staticWorldZones}
          />

          <HomeHudOverlay
            cameraMode={cameraMode}
            compactRoundLabel={compactRoundLabel}
            connectionLabel={connectionLabel}
            connectionStatus={realtimeSnapshot.status}
            contextTarget={contextTarget}
            expandedInfoContent={expandedInfoContent}
            expandedInfoPanel={expandedInfoPanel}
            focusChipLabel={focusChipLabel}
            interactionFeedback={interactionFeedback}
            mapHeight={map.height}
            mapLabel={regionLabel}
            mapWidth={map.width}
            minimapMarkers={minimapMarkers}
            onActionBarPress={handleActionBarPress}
            onBottomLayout={handleBottomHudLayout}
            onCloseContextMenu={() => {
              setContextTarget(null);
            }}
            onContextActionPress={handleContextActionPress}
            onDismissInteractionFeedback={() => {
              setInteractionFeedback((currentFeedback) => currentFeedback ? null : currentFeedback);
            }}
            onOpenMap={() => {
              runCriticalUiAction({
                accent: colors.info,
                bootstrapMessage: 'Abrindo o mapa tático.',
                feedbackMessage: 'Mapa tático selecionado.',
                navigate: () => {
                  navigateNow('Map');
                },
              });
            }}
            onOpenProfile={() => {
              runCriticalUiAction({
                accent: colors.info,
                bootstrapMessage: 'Abrindo o perfil completo.',
                feedbackMessage: 'Perfil selecionado.',
                navigate: () => {
                  navigateNow('Profile');
                },
              });
            }}
            onRecenter={() => {
              runCriticalUiAction({
                accent: colors.info,
                feedbackMessage: 'Jogador recentralizado.',
                haptic: 'light',
                immediateSideEffect: () => {
                  issueCameraCommand('recenter');
                },
              });
            }}
            onToggleCameraMode={() => {
              const nextMode = cameraMode === 'follow' ? 'free' : 'follow';
              runCriticalUiAction({
                accent: nextMode === 'follow' ? colors.success : colors.muted,
                feedbackMessage:
                  nextMode === 'follow'
                    ? 'Câmera em seguir jogador.'
                    : 'Câmera livre ativada.',
                haptic: 'light',
                immediateSideEffect: () => {
                  issueCameraCommand(nextMode);
                },
              });
            }}
            onToggleExpandedInfoPanel={toggleExpandedInfoPanel}
            onTopLayout={handleTopHudLayout}
            onlineCount={realtimeSnapshot.players.length}
            player={player as PlayerProfile | null}
            playerPosition={hudPlayerState?.position ?? null}
            quickActions={quickActions}
            roundPressure={roundPressure}
            topToast={topToast}
            worldPulseItems={worldPulseItems}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  /* A.1 — safe area e container sem padding */
  safeArea: {
    backgroundColor: '#0f1012',
    flex: 1,
  },
  container: {
    backgroundColor: '#0f1012',
    flex: 1,
    padding: 0,
  },
  /* A.1 — worldShell sem borda/radius */
  worldShell: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
});
