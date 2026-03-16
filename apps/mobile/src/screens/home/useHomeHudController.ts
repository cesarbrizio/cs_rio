import { useFocusEffect } from '@react-navigation/native';
import {
  REGIONS,
  type NpcInflationSummary,
  type PlayerProfile,
  type RoundSummary,
  type TerritoryFavelaSummary,
} from '@cs-rio/shared';
import { type InputRect } from '@engine/input-handler';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { InteractionManager, type LayoutChangeEvent } from 'react-native';

import { type RootStackParamList } from '../../navigation/RootNavigator';
import {
  resolveEventDestinationLabel,
  resolveEventNotificationAccent,
  resolveEventNotificationTimeLabel,
  type EventNotificationItem,
} from '../../features/events';
import {
  buildNpcInflationBody,
  buildNpcInflationDecisionHint,
  buildNpcInflationHeadline,
  formatNpcInflationMultiplier,
} from '../../features/inflation';
import {
  buildHudContextTarget,
  type HudContextAction,
  type HudContextTarget,
} from '../../features/hudContextActions';
import {
  getCurrentTutorialStep,
  getTutorialProgress,
  getTutorialRemainingMinutes,
  isTutorialStillActive,
} from '../../features/tutorial';
import { colyseusService, type RealtimeSnapshot } from '../../services/colyseus';
import { type TutorialState } from '../../stores/tutorialStore';
import { colors } from '../../theme/colors';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import type { ActionBarButton } from '../../components/hud/ActionBar';
import type { MinimapMarker } from '../../components/hud/Minimap';
import type { GameViewPlayerState } from '../../components/GameView';
import {
  buildFavelaOwnerLabel,
  describeFavelaContext,
  orderBookBadge,
} from './homeHelpers';
import {
  type ProjectedFavela,
  type RegionClimateSummary,
  type RoundPressure,
  type WorldContextSpot,
  type WorldPulseItem,
} from './homeTypes';
import type { HomeHudPanelProps } from './HomeHudPanel';
import type { HomeHudToastConfig, HomeInfoCardContent } from './HomeHudOverlay';

interface TerritoryOverview {
  favelas: TerritoryFavelaSummary[];
}

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

interface UseHomeHudControllerInput {
  bootstrapTutorial: (playerId: string) => void;
  completeTutorialStep: (stepId: 'crimes' | 'market' | 'move' | 'territory' | 'training') => void;
  consumeMapReturnCue: () => { accent?: string; message: string } | null;
  dismissEventBanner: (eventId: string) => void;
  dismissTutorial: () => void;
  eventBanner: EventNotificationItem | null;
  hudPlayerState: GameViewPlayerState | null;
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
  logout: () => Promise<void>;
}

interface HomeHudControllerResult {
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

export function useHomeHudController({
  bootstrapTutorial,
  completeTutorialStep,
  consumeMapReturnCue,
  dismissEventBanner,
  dismissTutorial,
  eventBanner,
  hudPlayerState,
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
  logout,
}: UseHomeHudControllerInput): HomeHudControllerResult {
  const [contextTarget, setContextTarget] = useState<HudContextTarget | null>(null);
  const [interactionFeedback, setInteractionFeedback] = useState<{
    accent?: string;
    id: number;
    message: string;
  } | null>(null);
  const [expandedInfoPanel, setExpandedInfoPanel] = useState<'focus' | 'round' | 'world' | null>(null);
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
  const [tutorialNowMs, setTutorialNowMs] = useState(Date.now());
  const latestHudPlayerStateRef = useRef<GameViewPlayerState | null>(hudPlayerState);
  const cameraCommandTokenRef = useRef(0);

  useEffect(() => {
    latestHudPlayerStateRef.current = hudPlayerState;
  }, [hudPlayerState]);

  useEffect(() => {
    if (!selectedMapFavelaId) {
      return;
    }

    const stillExists = territoryOverview?.favelas.some((favela) => favela.id === selectedMapFavelaId);

    if (!stillExists) {
      setSelectedMapFavelaId(null);
    }
  }, [selectedMapFavelaId, setSelectedMapFavelaId, territoryOverview?.favelas]);

  useEffect(() => {
    if (!player?.hasCharacter || !player.id) {
      return;
    }

    bootstrapTutorial(player.id);
  }, [bootstrapTutorial, player?.hasCharacter, player?.id]);

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
        `Inflacao ${formatNpcInflationMultiplier(roundInflation.currentMultiplier)}`,
        roundInflation.nextIncreaseInDays === null || roundInflation.nextMultiplier === null
          ? 'Teto da rodada'
          : `Sobe em ${roundInflation.nextIncreaseInDays}d`,
      ],
    };
  }, [roundInflation, roundSummary]);
  const roundDetail = useMemo(() => {
    if (!roundSummary) {
      return {
        detail:
          'A rodada ainda esta carregando. Assim que o backend responder, o tempo e a pressao aparecem aqui.',
        headline: 'Rodada ativa carregando...',
      };
    }

    return {
      detail: roundPressure
        ? `${roundPressure.headline} ${roundPressure.detail}`
        : 'A rodada esta ativa e o ranking segue correndo em tempo real.',
      headline: compactRoundLabel,
    };
  }, [compactRoundLabel, roundPressure, roundSummary]);
  const focusChipLabel = useMemo(() => {
    if (player?.prison.isImprisoned) {
      return 'Foco: prisao';
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
        detail:
          'Enquanto preso, quase todo o corre trava. A proxima decisao util esta na tela da prisao.',
        headline: 'Seu foco agora e sair da prisao.',
      };
    }

    if (player?.hospitalization.isHospitalized) {
      return {
        detail: 'Internado, seu ritmo cai. Resolver o hospital acelera sua volta para a rua.',
        headline: 'Seu foco agora e fechar a internacao.',
      };
    }

    if (tutorialActive && tutorialStep) {
      return {
        detail: 'Feche esse passo para completar o loop basico entre mapa, acao e retorno.',
        headline: tutorialStep.hint,
      };
    }

    if (!player?.faction) {
      return {
        detail: 'Dinheiro, conceito e territorio aceleram sua entrada real na rodada.',
        headline: 'Faca um crime simples, treine e olhe territorio.',
      };
    }

    return {
      detail:
        'Crime, negocio, combate e territorio seguem empurrando seu ranking e sua presenca na cidade.',
      headline: 'Seu foco agora e seguir no corre.',
    };
  }, [
    player?.faction,
    player?.hospitalization.isHospitalized,
    player?.prison.isImprisoned,
    tutorialActive,
    tutorialStep,
  ]);
  const worldDetail = useMemo(() => {
    if (selectedProjectedFavela) {
      return {
        detail: describeFavelaContext(selectedProjectedFavela.favela, player?.faction?.id ?? null),
        headline: `${selectedProjectedFavela.favela.name} · ${buildFavelaOwnerLabel(selectedProjectedFavela.favela)}`,
      };
    }

    const nearbyDetail = nearestWorldSpot
      ? nearestWorldSpot.distance <= 6
        ? `${nearestWorldSpot.title} esta logo ao alcance.`
        : `${nearestWorldSpot.title} e o ponto mais proximo do seu corre agora.`
      : 'Ainda falta um ponto forte proximo para puxar sua proxima acao.';
    const factionDetail = player?.faction
      ? `Voce esta sob a bandeira ${player.faction.abbreviation}.`
      : 'Voce ainda esta sem protecao de faccao.';
    const eventDetail = eventBanner
      ? `${eventBanner.title} esta mudando o clima dessa regiao.`
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

  useEffect(() => {
    if (tutorialProgress.completed !== tutorialProgress.total || tutorialProgress.total === 0) {
      return;
    }

    setBootstrapStatus(
      'Tutorial inicial concluido. Agora siga no seu ritmo entre crimes, treino, mercado, faccao e territorio.',
    );
  }, [setBootstrapStatus, tutorialProgress.completed, tutorialProgress.total]);

  const quickActions = useMemo<ActionBarButton[]>(
    () => [
      ...(player?.prison.isImprisoned
        ? [
            {
              badge: 1,
              compactLabel: 'Prisao',
              description: 'Veja o tempo restante da pena e as saidas liberadas.',
              group: 'Meu corre',
              id: 'prison',
              label: 'Ver prisao',
              tone: 'danger' as const,
            },
          ]
        : []),
      {
        badge: player?.hospitalization.isHospitalized ? 1 : 0,
        compactLabel: 'Hospital',
        description: player?.hospitalization.isHospitalized
          ? 'Acompanhe a internacao e os servicos liberados.'
          : 'Cure HP, trate vicio, plano e cirurgia.',
        group: 'Meu corre',
        id: 'hospital',
        label: 'Ir ao hospital',
        tone: player?.hospitalization.isHospitalized ? ('default' as const) : undefined,
      },
      {
        badge: 0,
        compactLabel: 'Corre',
        description: 'Faca seu proximo corre e evolua o personagem.',
        featured: true,
        group: 'Na rua',
        id: 'crimes',
        label: 'Fazer corre',
      },
      {
        badge: realtimeSnapshot.players.filter((entry) => entry.playerId !== player?.id).length,
        compactLabel: 'Cacar',
        description: 'Escolha alvo online, de porrada ou monte emboscada.',
        group: 'Na rua',
        id: 'combat',
        label: 'Cacar alvo',
      },
      {
        badge: 0,
        compactLabel: 'Treino',
        description: 'Ganhe atributos e destrave novas opcoes.',
        featured: true,
        group: 'Meu corre',
        id: 'training',
        label: 'Treinar',
      },
      {
        badge: orderBookBadge(player?.inventory.length ?? 0, player?.resources.money ?? 0),
        compactLabel: 'Negocio',
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
        description: 'Veja eventos ativos e o historico recente dos resultados do mapa.',
        group: 'Na rua',
        id: 'events',
        label: 'Ver eventos',
      },
      {
        badge: player?.inventory.length ?? 0,
        compactLabel: 'Equipar',
        description: 'Equipe armas, coletes e consumiveis.',
        group: 'Meu corre',
        id: 'inventory',
        label: 'Equipar',
      },
      {
        badge: player?.properties.length ?? 0,
        compactLabel: 'Ativos',
        description:
          'Gerencie operacoes que giram caixa e a sua base de imoveis, veiculos e protecao.',
        group: 'Meu corre',
        id: 'ops',
        label: 'Gerir ativos',
      },
      {
        badge: 0,
        compactLabel: 'Dominar',
        description: 'Veja dominio, servicos, X9 e guerras.',
        featured: true,
        group: 'Na rua',
        id: 'territory',
        label: 'Dominar area',
      },
      {
        badge: 0,
        compactLabel: 'Julgar',
        description: 'Julgue casos da favela e aplique a punicao escolhida.',
        group: 'Na rua',
        id: 'tribunal',
        label: 'Julgar caso',
      },
      {
        badge: 0,
        compactLabel: 'Sabotar',
        description:
          'Escolha um alvo rival, veja cooldown e recupere sua base se ela tomar dano.',
        group: 'Na rua',
        id: 'sabotage',
        label: 'Sabotar rival',
      },
      {
        badge: player?.faction ? 1 : 0,
        compactLabel: 'Faccao',
        description: 'Membros, banco, upgrades, lideranca e o chat interno da faccao.',
        group: 'Rede',
        id: 'faction',
        label: 'Falar com a faccao',
      },
      {
        badge: 0,
        compactLabel: 'Contatos',
        description:
          'Gerencie parceiros, conhecidos e DMs; global, local e comercio ficam fora do recorte atual.',
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
        compactLabel: 'Vocacao',
        description: 'Troque a build, veja cooldown e acompanhe o impacto real da sua trilha.',
        group: 'Meu corre',
        id: 'vocation',
        label: 'Gerir vocacao',
      },
      {
        badge: 0,
        compactLabel: 'Perfil',
        description: 'Consulte atributos, vocacao e equipamentos.',
        group: 'Conta',
        id: 'profile',
        label: 'Ver perfil',
      },
      {
        badge: 0,
        compactLabel: 'Ajustes',
        description: 'Som, preferencias e sessao do dispositivo.',
        group: 'Conta',
        id: 'settings',
        label: 'Ajustar jogo',
      },
      {
        badge: 0,
        compactLabel: 'Sair',
        description: 'Encerrar a sessao neste aparelho.',
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
  }, [setHudPlayerState]);

  const issueCameraCommand = useCallback((type: 'follow' | 'free' | 'recenter') => {
    cameraCommandTokenRef.current += 1;
    setCameraCommand({
      token: cameraCommandTokenRef.current,
      type,
    });
  }, []);

  const handleEntityTap = useCallback((entityId: string) => {
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
  }, [runCriticalUiAction]);

  const handleZoneTap = useCallback((zoneId: string) => {
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
        navigateNow('Territory', {
          focusFavelaId: favela.id,
        });
      },
    });
  }, [navigateNow, runCriticalUiAction, setSelectedMapFavelaId, territoryOverview?.favelas]);

  const handleActionBarPress = useCallback((buttonId: string) => {
    if (buttonId === 'prison') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Abrindo a central da prisao.',
        feedbackMessage: 'Prisao selecionada.',
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

    if (player?.prison.isImprisoned && !['profile', 'settings', 'logout'].includes(buttonId)) {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage:
          'Seu personagem esta preso. Veja o timer e as saidas disponiveis na tela da prisao.',
        feedbackMessage: 'Seu personagem esta preso. Redirecionando para a prisao.',
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
        bootstrapMessage: 'Abrindo o inventario do personagem.',
        feedbackMessage: 'Inventario selecionado.',
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
        bootstrapMessage: 'Abrindo operacoes e base logistica do personagem.',
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
        bootstrapMessage: 'Abrindo a central de territorio.',
        deferredSideEffect: () => {
          completeTutorialStep('territory');
        },
        feedbackMessage: 'Territorio selecionado.',
        navigate: () => {
          navigateNow('Territory');
        },
      });
      return;
    }

    if (buttonId === 'tribunal') {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo o Tribunal do Trafico.',
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
        bootstrapMessage: 'Abrindo o QG da faccao.',
        feedbackMessage: 'Faccao selecionada.',
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
        bootstrapMessage: 'Abrindo a Central de Vocacao.',
        feedbackMessage: 'Vocacao selecionada.',
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
        bootstrapMessage: 'Abrindo configuracoes.',
        feedbackMessage: 'Configuracoes selecionadas.',
        navigate: () => {
          navigateNow('Settings');
        },
      });
      return;
    }

    if (buttonId === 'logout') {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Encerrando a sessao deste dispositivo.',
        feedbackMessage: 'Encerrando a sessao...',
        immediateSideEffect: () => {
          void logout();
        },
      });
      return;
    }

    runCriticalUiAction({
      accent: colors.accent,
      bootstrapMessage: `Acao "${buttonId}" selecionada.`,
      feedbackMessage: `Acao "${buttonId}" selecionada.`,
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
          bootstrapMessage: `${eventBanner.title}: acompanhando o impacto no territorio.`,
          feedbackMessage: `${eventBanner.title}: abrindo territorio.`,
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
          bootstrapMessage: `${eventBanner.title}: abrindo o mapa tatico.`,
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
      setBootstrapStatus(
        'Toque no chao do mapa para marcar um destino e completar o primeiro passo.',
      );
      showInteractionFeedback('Toque no mapa para marcar um destino.', colors.accent);
      return;
    }

    if (tutorialStep.actionId) {
      handleActionBarPress(tutorialStep.actionId);
    }
  }, [handleActionBarPress, setBootstrapStatus, showInteractionFeedback, tutorialStep]);

  const connectionLabel = useMemo(() => {
    if (realtimeSnapshot.status === 'connected') return null;
    if (realtimeSnapshot.status === 'disconnected') return 'Offline - modo solo';
    if (realtimeSnapshot.status === 'reconnecting') return 'Reconectando...';
    return 'Conectando...';
  }, [realtimeSnapshot.status]);

  const topToast = useMemo<HomeHudToastConfig | null>(() => {
    if (player?.prison.isImprisoned) {
      return {
        accent: colors.danger,
        autoDismissMs: 0,
        ctaLabel: 'Abrir prisao',
        message: `Preso · ${Math.max(1, Math.ceil(player.prison.remainingSeconds / 60))}min restantes`,
        onCta: () => {
          runCriticalUiAction({
            accent: colors.danger,
            bootstrapMessage: 'Abrindo a central da prisao.',
            feedbackMessage: 'Prisao selecionada.',
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
      const refreshFeeds = () => refreshHomeMapData(isCancelled);

      setTutorialNowMs(Date.now());
      void refreshFeeds();

      const intervalId = setInterval(() => {
        setTutorialNowMs(Date.now());
        void refreshFeeds();
      }, 60_000);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [
      consumeMapReturnCue,
      issueCameraCommand,
      player?.hasCharacter,
      refreshHomeMapData,
      setBootstrapStatus,
      showInteractionFeedback,
    ]),
  );

  const toggleExpandedInfoPanel = useCallback((panel: 'focus' | 'round' | 'world') => {
    hapticLight();
    setExpandedInfoPanel((currentPanel) => (currentPanel === panel ? null : panel));
  }, []);

  const handleTileTap = useCallback((tile: { x: number; y: number }) => {
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
  }, [
    completeTutorialStep,
    findNearbyWorldContextSpot,
    setBootstrapStatus,
    showInteractionFeedback,
  ]);

  const hudUiRects = useMemo(
    () => [hudUiRectState.top, hudUiRectState.bottom].flatMap((rect) => (rect ? [rect] : [])),
    [hudUiRectState.bottom, hudUiRectState.top],
  );

  const hudPanelProps = useMemo<HomeHudPanelProps>(() => ({
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
    onCloseContextMenu: () => {
      setContextTarget(null);
    },
    onContextActionPress: handleContextActionPress,
    onDismissInteractionFeedback: () => {
      setInteractionFeedback((currentFeedback) =>
        currentFeedback ? null : currentFeedback,
      );
    },
    onOpenMap: () => {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo o mapa tatico.',
        feedbackMessage: 'Mapa tatico selecionado.',
        navigate: () => {
          navigateNow('Map');
        },
      });
    },
    onOpenProfile: () => {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo o perfil completo.',
        feedbackMessage: 'Perfil selecionado.',
        navigate: () => {
          navigateNow('Profile');
        },
      });
    },
    onRecenter: () => {
      runCriticalUiAction({
        accent: colors.info,
        feedbackMessage: 'Jogador recentralizado.',
        haptic: 'light',
        immediateSideEffect: () => {
          issueCameraCommand('recenter');
        },
      });
    },
    onToggleCameraMode: () => {
      const nextMode = cameraMode === 'follow' ? 'free' : 'follow';
      runCriticalUiAction({
        accent: nextMode === 'follow' ? colors.success : colors.muted,
        feedbackMessage:
          nextMode === 'follow'
            ? 'Camera em seguir jogador.'
            : 'Camera livre ativada.',
        haptic: 'light',
        immediateSideEffect: () => {
          issueCameraCommand(nextMode);
        },
      });
    },
    onToggleExpandedInfoPanel: toggleExpandedInfoPanel,
    onTopLayout: handleTopHudLayout,
    onlineCount: realtimeSnapshot.players.length,
    player,
    playerPosition: hudPlayerState?.position ?? null,
    quickActions,
    roundPressure,
    topToast,
    worldPulseItems,
  }), [
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
    issueCameraCommand,
    mapHeight,
    mapWidth,
    minimapMarkers,
    navigateNow,
    player,
    quickActions,
    realtimeSnapshot.players.length,
    realtimeSnapshot.status,
    roundPressure,
    runCriticalUiAction,
    toggleExpandedInfoPanel,
    topToast,
    worldPulseItems,
    regionLabel,
  ]);

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
