import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  REGIONS,
  type DocksEventStatusResponse,
  type PoliceEventStatusResponse,
  type RoundSummary,
  type SeasonalEventStatusResponse,
  type TerritoryFavelaSummary,
  type TerritoryRegionSummary,
} from '@cs-rio/shared';
import { parseTilemap } from '@engine/tilemap-parser';
import { type InputRect } from '@engine/input-handler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameView, type GameViewPlayerState } from '../components/GameView';
import {
  ActionBar,
  type ActionBarButton,
} from '../components/hud/ActionBar';
import { ContextMenu } from '../components/hud/ContextMenu';
import { HudToast } from '../components/hud/HudToast';
import { Minimap, type MinimapMarker } from '../components/hud/Minimap';
import { StatusBar } from '../components/hud/StatusBar';
import {
  getMapVisualPreset,
  type MapEntityKind,
  type MapStructure,
  resolveZoneAccentFromRelation,
} from '../data/mapRegionVisuals';
import { zonaNorteMapData } from '../data/zonaNortePrototypeMap';
import {
  resolveEventDestinationLabel,
  resolveEventNotificationAccent,
  resolveEventNotificationTimeLabel,
} from '../features/events';
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
import { resolveFavelaStateLabel } from '../features/territory';
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

interface WorldContextSpot {
  entityId: string;
  position: {
    x: number;
    y: number;
  };
  reach: number;
  title: string;
}

interface WorldPulseItem {
  accent: string;
  id: string;
  label: string;
  value: string;
}

interface RoundPressure {
  detail: string;
  headline: string;
  labels: string[];
}

interface EventRuntimeState {
  docks: DocksEventStatusResponse;
  police: PoliceEventStatusResponse;
  seasonal: SeasonalEventStatusResponse;
}

interface ProjectedFavela {
  center: {
    x: number;
    y: number;
  };
  favela: TerritoryFavelaSummary;
}

interface RegionClimateSummary {
  accent: string;
  detail: string;
  label: string;
  pressureLabel: string;
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

export function HomeScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const map = useMemo(() => parseTilemap(zonaNorteMapData), []);
  const mapVisualPreset = useMemo(
    () => getMapVisualPreset(player?.regionId),
    [player?.regionId],
  );
  const staticWorldEntities = useMemo(
    () => mapVisualPreset.entities,
    [mapVisualPreset.entities],
  );
  const zoneSlots = useMemo(
    () =>
      mapVisualPreset.zoneSlots.map((slot) => ({
        ...slot,
        radiusTiles: {
          x: Math.max(3, Math.round(slot.radiusTiles.x * 0.5)),
          y: Math.max(2, Math.round(slot.radiusTiles.y * 0.5)),
        },
      })),
    [mapVisualPreset.zoneSlots],
  );
  const staticWorldTrails = useMemo(
    () => mapVisualPreset.trails,
    [mapVisualPreset.trails],
  );
  const mapCoreCenter = useMemo(() => {
    if (zoneSlots.length > 0) {
      const total = zoneSlots.reduce(
        (accumulator, slot) => ({
          x: accumulator.x + slot.center.x,
          y: accumulator.y + slot.center.y,
        }),
        { x: 0, y: 0 },
      );

      return {
        x: Math.round(total.x / zoneSlots.length),
        y: Math.round(total.y / zoneSlots.length),
      };
    }

    return {
      x: Math.floor(map.width / 2),
      y: Math.floor(map.height / 2),
    };
  }, [map.height, map.width, zoneSlots]);
  const staticGroundPatches = useMemo(
    () => {
      const focusedGroundPatches = mapVisualPreset.groundPatches
        .filter((patch) =>
          patch.kind === 'favela-core'
          || patch.kind === 'commercial-yard'
          || patch.kind === 'industrial-yard'
          || patch.kind === 'blocked',
        )
        .map((patch) => ({
          ...patch,
          radiusTiles: {
            x: Math.max(4, Math.round(patch.radiusTiles.x * 0.68)),
            y: Math.max(3, Math.round(patch.radiusTiles.y * 0.68)),
          },
        }));

      return [
        {
          accent: '#567052',
          center: mapCoreCenter,
          fill: '#50664a',
          id: `${player?.regionId ?? 'local'}:base-ground`,
          kind: 'greenery' as const,
          radiusTiles: { x: 20, y: 13 },
        },
        ...focusedGroundPatches,
      ];
    },
    [mapCoreCenter, mapVisualPreset.groundPatches, player?.regionId],
  );
  const staticLandmarks = useMemo(
    () => mapVisualPreset.landmarks,
    [mapVisualPreset.landmarks],
  );
  const presetStructures = useMemo(
    () => mapVisualPreset.structures,
    [mapVisualPreset.structures],
  );
  const [territoryOverview, setTerritoryOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(null);
  const [eventRuntimeState, setEventRuntimeState] = useState<EventRuntimeState | null>(null);
  const currentRegionFavelas = useMemo(
    () => territoryOverview?.favelas?.filter((favela) => favela.regionId === player?.regionId) ?? [],
    [player?.regionId, territoryOverview?.favelas],
  );
  const currentRegionSummary = useMemo<TerritoryRegionSummary | null>(
    () => territoryOverview?.regions.find((region) => region.regionId === player?.regionId) ?? null,
    [player?.regionId, territoryOverview?.regions],
  );
  const projectedFavelas = useMemo<ProjectedFavela[]>(
    () =>
      zoneSlots.flatMap((slot, index) => {
        const favela = currentRegionFavelas[index];

        if (!favela) {
          return [];
        }

        return [
          {
            center: slot.center,
            favela,
          },
        ];
      }),
    [currentRegionFavelas, zoneSlots],
  );
  const staticStructures = useMemo<MapStructure[]>(
    () => {
      const nonFavelaStructures = presetStructures.filter(
        (structure) => structure.kind !== 'favela-cluster',
      );
      const dynamicFavelaStructures = projectedFavelas.map(({ center, favela }) => {
        const footprint =
          favela.difficulty >= 8
            ? { w: 5, h: 4 }
            : favela.difficulty >= 6
              ? { w: 5, h: 4 }
              : { w: 4, h: 3 };

        return {
          footprint,
          id: `favela-visual:${favela.id}`,
          kind: 'favela-cluster' as const,
          label: favela.name,
          position: {
            x: center.x - Math.floor(footprint.w / 2),
            y: center.y - Math.floor(footprint.h / 2),
          },
        };
      });

      return [...nonFavelaStructures, ...dynamicFavelaStructures];
    },
    [presetStructures, projectedFavelas],
  );
  const regionalPoliceEvents = useMemo(
    () =>
      eventRuntimeState?.police.events.filter((event) => event.regionId === player?.regionId) ?? [],
    [eventRuntimeState?.police.events, player?.regionId],
  );
  const regionalSeasonalEvents = useMemo(
    () =>
      eventRuntimeState?.seasonal.events.filter((event) => event.regionId === player?.regionId) ?? [],
    [eventRuntimeState?.seasonal.events, player?.regionId],
  );
  const activeDocksEvent = useMemo(
    () =>
      eventRuntimeState?.docks.isActive && eventRuntimeState.docks.regionId === player?.regionId
        ? eventRuntimeState.docks
        : null,
    [eventRuntimeState?.docks, player?.regionId],
  );
  const staticWorldZones = useMemo(
    () => {
      return projectedFavelas.map(({ center, favela }) => {
        const radiusTiles =
          favela.difficulty >= 8
            ? { x: 4, y: 3 }
            : favela.difficulty >= 6
              ? { x: 4, y: 3 }
              : { x: 3, y: 2 };

        const policeEvent = regionalPoliceEvents.find((event) => event.favelaId === favela.id) ?? null;
        const relation = resolveFavelaRelation(favela, player?.faction?.id);
        const accent = resolveLiveZoneAccent({
          favela,
          policeEventType: policeEvent?.eventType ?? null,
          relation,
        });

        return {
          accent,
          center,
          id: favela.id,
          label: favela.name,
          ownerLabel: buildFavelaOwnerLabel(favela),
          radiusTiles,
          relation,
        };
      });
    },
    [player?.faction?.id, projectedFavelas, regionalPoliceEvents],
  );
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

  /* C.1/C.2 — fetch round info on mount and every 60s */
  useEffect(() => {
    if (!player?.hasCharacter) return;

    let cancelled = false;

    const fetchRound = async () => {
      try {
        const response = await roundApi.getCenter();
        if (!cancelled) setRoundSummary(response.round);
      } catch {
        // Silently fallback — roundPill stays with placeholder text
      }
    };

    void fetchRound();
    const intervalId = setInterval(() => { void fetchRound(); }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [player?.hasCharacter]);

  useEffect(() => {
    if (!player?.hasCharacter) {
      return;
    }

    let cancelled = false;

    const fetchTerritory = async () => {
      try {
        const response = await territoryApi.list();

        if (!cancelled) {
          setTerritoryOverview(response);
        }
      } catch {
        if (!cancelled) {
          setTerritoryOverview(null);
        }
      }
    };

    void fetchTerritory();
    const intervalId = setInterval(() => {
      void fetchTerritory();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [player?.hasCharacter, player?.regionId]);

  useEffect(() => {
    if (!player?.hasCharacter) {
      return;
    }

    let cancelled = false;

    const fetchEvents = async () => {
      try {
        const [docks, police, seasonal] = await Promise.all([
          eventApi.getDocksStatus(),
          eventApi.getPoliceStatus(),
          eventApi.getSeasonalStatus(),
        ]);

        if (!cancelled) {
          setEventRuntimeState({
            docks,
            police,
            seasonal,
          });
        }
      } catch {
        if (!cancelled) {
          setEventRuntimeState(null);
        }
      }
    };

    void fetchEvents();
    const intervalId = setInterval(() => {
      void fetchEvents();
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [player?.hasCharacter, player?.regionId]);

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

  useEffect(() => {
    if (!tutorial.startedAt) {
      return;
    }

    setTutorialNowMs(Date.now());

    const intervalId = setInterval(() => {
      setTutorialNowMs(Date.now());
    }, 30_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [tutorial.startedAt]);

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
    if (!roundSummary) {
      return null;
    }

    const daysRemaining = Math.max(
      0,
      roundSummary.totalGameDays - roundSummary.currentGameDay,
    );
    const earlyWindow = roundSummary.currentGameDay <= Math.max(3, Math.ceil(roundSummary.totalGameDays * 0.2));
    const lateWindow = daysRemaining <= Math.max(3, Math.ceil(roundSummary.totalGameDays * 0.15));

    if (earlyWindow) {
      return {
        detail: 'Ainda dá tempo de crescer barato, ocupar espaço e montar base antes da pressão subir.',
        headline: 'Começo de rodada: expansão rápida vale mais do que segurar caixa.',
        labels: ['Inflação baixa', 'Mapa aberto'],
      };
    }

    if (lateWindow) {
      return {
        detail: 'O fim da rodada está perto. Cada ação agora mexe mais no ranking e no conceito final.',
        headline: 'Fechamento chegando: o ranking ficou urgente.',
        labels: ['Ranking pesa', 'Tempo curto'],
      };
    }

    return {
      detail: 'Os eventos já começaram a girar e a economia aperta mais do que no início da rodada.',
      headline: 'Meio de rodada: inflação e eventos começam a pesar.',
      labels: ['Eventos vivos', 'Custos subindo'],
    };
  }, [roundSummary]);
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
          : 'Cure HP, trate vício, DST, plano e cirurgia.',
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
        badge: player?.inventory.length ?? 0,
        compactLabel: 'Equipar',
        description: 'Equipe armas, coletes e consumíveis.',
        group: 'Meu corre',
        id: 'inventory',
        label: 'Equipar',
      },
      {
        badge: player?.properties.length ?? 0,
        compactLabel: 'Negócios',
        description: 'Gerencie negócios, patrimônio e soldados.',
        group: 'Meu corre',
        id: 'ops',
        label: 'Tocar negócios',
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
        badge: player?.faction ? 1 : 0,
        compactLabel: 'Facção',
        description: 'Membros, banco, upgrades e liderança.',
        group: 'Rede',
        id: 'faction',
        label: 'Falar com a facção',
      },
      {
        badge: 0,
        compactLabel: 'Estudar',
        description: 'Cursos para bônus passivos e progressão.',
        group: 'Meu corre',
        id: 'university',
        label: 'Estudar',
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
      player?.properties.length,
      player?.resources.money,
      realtimeSnapshot.players,
    ],
  );
  const renderEntities = useMemo(
    () => [
      ...staticWorldEntities.map((entity) =>
        buildLiveEntity({
          activeDocksEvent,
          entity,
          playerFactionId: player?.faction?.id ?? null,
          projectedFavelas,
          regionalSeasonalEvents,
        }),
      ),
      ...relevantRemotePlayers.map(({ distance, player: realtimePlayer }) => ({
        color: distance <= 8 ? colors.info : '#f0dd8f',
        id: `player:${realtimePlayer.sessionId}`,
        kind: 'player' as const,
        label: distance <= 8 ? realtimePlayer.nickname : undefined,
        position: {
          x: realtimePlayer.x,
          y: realtimePlayer.y,
        },
      })),
    ],
    [
      activeDocksEvent,
      player?.faction?.id,
      projectedFavelas,
      regionalSeasonalEvents,
      relevantRemotePlayers,
      staticWorldEntities,
    ],
  );
  const worldContextSpots = useMemo<WorldContextSpot[]>(
    () =>
      mapVisualPreset.contextSpots.map((spot) => ({
        entityId: spot.entityId,
        position: spot.position,
        reach: spot.reach,
        title: spot.title,
      })),
    [mapVisualPreset.contextSpots],
  );
  const nearestWorldSpot = useMemo(() => {
    const position = hudPlayerState?.position ?? playerSpawnState?.position;

    if (!position) {
      return null;
    }

    let bestMatch: WorldContextSpot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const spot of worldContextSpots) {
      const distance =
        Math.abs(spot.position.x - position.x) + Math.abs(spot.position.y - position.y);

      if (distance < bestDistance) {
        bestMatch = spot;
        bestDistance = distance;
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      distance: bestDistance,
      title: bestMatch.title,
    };
  }, [hudPlayerState?.position, playerSpawnState?.position, worldContextSpots]);
  const regionClimate = useMemo(
    () =>
      summarizeRegionClimate({
        activeDocksEvent,
        policeEvents: regionalPoliceEvents,
        regionSummary: currentRegionSummary,
        seasonalEvents: regionalSeasonalEvents,
      }),
    [activeDocksEvent, currentRegionSummary, regionalPoliceEvents, regionalSeasonalEvents],
  );
  const worldPulseItems = useMemo<WorldPulseItem[]>(() => {
    const items: WorldPulseItem[] = [
      {
        accent: player?.faction ? colors.accent : colors.muted,
        id: 'faction',
        label: 'Facção',
        value: player?.faction ? player.faction.abbreviation : 'Solo',
      },
      {
        accent: regionClimate.accent,
        id: 'climate',
        label: 'Rua',
        value: regionClimate.label,
      },
    ];

    if (currentRegionSummary) {
      items.push({
        accent: currentRegionSummary.atWarFavelas > 0 ? colors.danger : colors.info,
        id: 'control',
        label: 'Domínio',
        value: `${currentRegionSummary.playerFactionControlledFavelas}/${currentRegionSummary.totalFavelas}`,
      });
    }

    const primaryEvent =
      regionalPoliceEvents[0]?.headline ??
      regionalSeasonalEvents[0]?.headline ??
      (activeDocksEvent ? 'Navio nas Docas' : null);

    if (primaryEvent) {
      items.push({
        accent:
          regionalPoliceEvents.length > 0
            ? colors.warning
            : activeDocksEvent
              ? colors.info
              : colors.accent,
        id: 'event',
        label: 'Evento',
        value: shortenPulseValue(primaryEvent),
      });
    }

    if (relevantRemotePlayers.length > 0) {
      items.push({
        accent: colors.info,
        id: 'presence',
        label: 'Movimento',
        value: `${relevantRemotePlayers.length} por perto`,
      });
    }

    if (nearestWorldSpot) {
      items.push({
        accent: colors.warning,
        id: 'nearby',
        label: nearestWorldSpot.distance <= 6 ? 'Perto' : 'Rumo',
        value: nearestWorldSpot.title,
      });
    }

    return items.slice(0, 4);
  }, [
    activeDocksEvent,
    currentRegionSummary,
    nearestWorldSpot,
    player?.faction,
    regionClimate,
    regionalPoliceEvents,
    regionalSeasonalEvents,
    relevantRemotePlayers.length,
  ]);
  const selectedProjectedFavela = useMemo(
    () => projectedFavelas.find((entry) => entry.favela.id === selectedMapFavelaId) ?? null,
    [projectedFavelas, selectedMapFavelaId],
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
  const navigateNow = useCallback((
    screen: keyof RootStackParamList,
    params?: RootStackParamList[keyof RootStackParamList],
  ) => {
    const navigator = navigation as unknown as {
      navigate: (screenName: string, screenParams?: object) => void;
    };

    navigator.navigate(screen, params as object | undefined);
  }, [navigation]);
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

    if (buttonId === 'ops') {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo negócios e patrimônio.',
        feedbackMessage: 'Patrimônio selecionado.',
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
  const issueCameraCommand = useCallback((type: 'follow' | 'free' | 'recenter') => {
    cameraCommandTokenRef.current += 1;
    setCameraCommand({
      token: cameraCommandTokenRef.current,
      type,
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      const nextCue = consumeMapReturnCue();

      if (nextCue) {
        showInteractionFeedback(nextCue.message, nextCue.accent);
        setBootstrapStatus(nextCue.message);
        issueCameraCommand('recenter');
      }
    }, [consumeMapReturnCue, issueCameraCommand, setBootstrapStatus, showInteractionFeedback]),
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

          {/* A.2 — hudLayer redesenhado: só bordas */}
          <View pointerEvents="box-none" style={styles.hudLayer}>
            {/* === TOPO: StatusBar compacto + Minimap === */}
            <View
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                updateHudRect('top', { x, y, width, height });
              }}
              pointerEvents="box-none"
              style={styles.topSection}
            >
              <View style={styles.topHudRow}>
                <View style={styles.statusContainer}>
                  <StatusBar
                    connectionStatus={realtimeSnapshot.status}
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
                    player={player}
                    playerPosition={hudPlayerState?.position ?? null}
                  />
                </View>
                <View style={styles.minimapCluster}>
                  <Minimap
                    mapHeight={map.height}
                    mapLabel={regionLabel}
                    mapWidth={map.width}
                    markers={minimapMarkers}
                    onOpenFullMap={() => {
                      runCriticalUiAction({
                        accent: colors.info,
                        bootstrapMessage: 'Abrindo o mapa tático.',
                        feedbackMessage: 'Mapa tático selecionado.',
                        navigate: () => {
                          navigateNow('Map');
                        },
                      });
                    }}
                    onlineCount={realtimeSnapshot.players.length}
                    playerPosition={hudPlayerState?.position ?? null}
                  />
                  <View style={styles.cameraActions}>
                    <Pressable
                      accessibilityLabel="Recentralizar no jogador"
                      onPress={() => {
                        runCriticalUiAction({
                          accent: colors.info,
                          feedbackMessage: 'Jogador recentralizado.',
                          haptic: 'light',
                          immediateSideEffect: () => {
                            issueCameraCommand('recenter');
                          },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.cameraFab,
                        pressed ? styles.cameraFabPressed : null,
                      ]}
                    >
                      <Text style={styles.cameraFabGlyph}>◎</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
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
                      style={({ pressed }) => [
                        styles.followChip,
                        cameraMode === 'follow' ? styles.followChipActive : null,
                        pressed ? styles.followChipPressed : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.followChipLabel,
                          cameraMode === 'follow' ? styles.followChipLabelActive : null,
                        ]}
                      >
                        {cameraMode === 'follow' ? 'Seguindo' : 'Seguir'}
                      </Text>
                    </Pressable>
                  </View>
                  {connectionLabel ? (
                    <View style={styles.connectionStrip}>
                      <View style={styles.connectionDivider} />
                      <Text
                        style={[
                          styles.connectionStripText,
                          realtimeSnapshot.status === 'disconnected'
                            ? styles.connectionStripTextDanger
                            : styles.connectionStripTextWarning,
                        ]}
                      >
                        {connectionLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* A.3 — Toasts compactos em vez de cards grandes */}
              <View pointerEvents="box-none" style={styles.toastArea}>
                {player?.prison.isImprisoned ? (
                  <HudToast
                    accent={colors.danger}
                    autoDismissMs={0}
                    ctaLabel="Abrir prisão"
                    message={`Preso · ${Math.max(1, Math.ceil(player.prison.remainingSeconds / 60))}min restantes`}
                    onCta={() => {
                      runCriticalUiAction({
                        accent: colors.danger,
                        bootstrapMessage: 'Abrindo a central da prisão.',
                        feedbackMessage: 'Prisão selecionada.',
                        navigate: () => {
                          navigateNow('Prison');
                        },
                      });
                    }}
                  />
                ) : player?.hospitalization.isHospitalized ? (
                  <HudToast
                    accent={colors.warning}
                    autoDismissMs={0}
                    ctaLabel="Abrir hospital"
                    message={`Internado · ${Math.max(1, Math.ceil(player.hospitalization.remainingSeconds / 60))}min restantes`}
                    onCta={() => {
                      runCriticalUiAction({
                        accent: colors.warning,
                        bootstrapMessage: 'Abrindo a central do hospital.',
                        feedbackMessage: 'Hospital selecionado.',
                        navigate: () => {
                          navigateNow('Hospital');
                        },
                      });
                    }}
                  />
                ) : eventBanner ? (
                  <HudToast
                    accent={resolveEventNotificationAccent(eventBanner.severity)}
                    ctaLabel={resolveEventDestinationLabel(eventBanner.destination)}
                    message={`${eventBanner.title} · ${eventBanner.regionLabel} · ${resolveEventNotificationTimeLabel(eventBanner.remainingSeconds)}`}
                    onCta={handleEventBannerPress}
                    onDismiss={handleDismissEventBanner}
                  />
                ) : tutorialActive && tutorialStep ? (
                  <HudToast
                    accent={colors.accent}
                    autoDismissMs={15000}
                    ctaLabel={tutorialStep.ctaLabel}
                    message={`Tutorial ${tutorialProgress.current}/${tutorialProgress.total}: ${tutorialStep.title} · ${tutorialRemainingMinutes} min restantes`}
                    onCta={handleTutorialPrimaryAction}
                    onDismiss={dismissTutorial}
                  />
                ) : null}
              </View>
            </View>

            {/* === FUNDO: Recursos + Feedback + ActionBar === */}
            <View
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                updateHudRect('bottom', { x, y, width, height });
              }}
              pointerEvents="box-none"
              style={styles.bottomHud}
            >
              {/* C.2 — Resource bar + round indicator */}
              <View style={styles.resourceRow}>
                <View style={[styles.resourcePill, { borderColor: 'rgba(217,95,95,0.3)' }]}>
                  <Text style={[styles.resourceLabel, { color: '#d95f5f' }]}>HP</Text>
                  <Text style={styles.resourceValue}>{Math.round(player?.resources.hp ?? 0)}</Text>
                </View>
                <View style={[styles.resourcePill, { borderColor: 'rgba(63,163,77,0.3)' }]}>
                  <Text style={[styles.resourceLabel, { color: colors.success }]}>STA</Text>
                  <Text style={styles.resourceValue}>{Math.round(player?.resources.stamina ?? 0)}</Text>
                </View>
                <View style={[styles.resourcePill, { borderColor: 'rgba(79,142,232,0.3)' }]}>
                  <Text style={[styles.resourceLabel, { color: '#4f8ee8' }]}>NRV</Text>
                  <Text style={styles.resourceValue}>{Math.round(player?.resources.nerve ?? 0)}</Text>
                </View>
              </View>

              <View style={styles.compactSignalsCard}>
                <View style={styles.worldPulseRow}>
                  <Pressable
                    onPress={() => {
                      toggleExpandedInfoPanel('round');
                    }}
                    style={({ pressed }) => [
                      styles.roundPressureChip,
                      pressed ? styles.compactChipPressed : null,
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                      {compactRoundLabel}
                    </Text>
                  </Pressable>
                  {roundPressure ? (
                    <Pressable
                      onPress={() => {
                        toggleExpandedInfoPanel('round');
                      }}
                      style={({ pressed }) => [
                        styles.roundPressureChip,
                        pressed ? styles.compactChipPressed : null,
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                        {roundPressure.labels[0]}
                      </Text>
                    </Pressable>
                  ) : null}
                  {worldPulseItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        toggleExpandedInfoPanel('world');
                      }}
                      style={({ pressed }) => [
                        styles.worldPulseChip,
                        pressed ? styles.compactChipPressed : null,
                      ]}
                    >
                      <View style={[styles.worldPulseDot, { backgroundColor: item.accent }]} />
                      <Text numberOfLines={1} style={styles.worldPulseLabel}>
                        {item.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.worldPulseValue}>
                        {item.value}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      toggleExpandedInfoPanel('focus');
                    }}
                    style={({ pressed }) => [
                      styles.roundPressureChip,
                      pressed ? styles.compactChipPressed : null,
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.roundPressureChipLabel}>
                      {focusChipLabel}
                    </Text>
                  </Pressable>
                </View>
                {expandedInfoPanel ? (
                  <View style={styles.expandedInfoCard}>
                    <Text numberOfLines={2} style={styles.expandedInfoHeadline}>
                      {expandedInfoPanel === 'round'
                        ? roundDetail.headline
                        : expandedInfoPanel === 'world'
                          ? worldDetail.headline
                          : focusDetail.headline}
                    </Text>
                    <Text numberOfLines={3} style={styles.expandedInfoDetail}>
                      {expandedInfoPanel === 'round'
                        ? roundDetail.detail
                        : expandedInfoPanel === 'world'
                          ? worldDetail.detail
                          : focusDetail.detail}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Feedback — single line */}
              {interactionFeedback ? (
                <HudToast
                  key={interactionFeedback.id}
                  accent={interactionFeedback.accent}
                  autoDismissMs={1400}
                  message={interactionFeedback.message}
                  onDismiss={() => {
                    setInteractionFeedback((currentFeedback) =>
                      currentFeedback?.id === interactionFeedback.id ? null : currentFeedback,
                    );
                  }}
                />
              ) : null}

              {/* ActionBar compacto */}
              <ActionBar buttons={quickActions} onPress={handleActionBarPress} />
            </View>

            <ContextMenu
              onActionPress={handleContextActionPress}
              onClose={() => {
                setContextTarget(null);
              }}
              target={contextTarget}
            />
          </View>
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
  /* A.2 — hudLayer edge-to-edge */
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 6,
  },
  /* --- Topo --- */
  topSection: {
    alignItems: 'flex-start',
    gap: 4,
  },
  topHudRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusContainer: {
    flexGrow: 0,
    flexShrink: 1,
    marginRight: 8,
    maxWidth: 218,
  },
  minimapCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectionStrip: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 112,
    width: '100%',
  },
  connectionDivider: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 1,
  },
  connectionStripText: {
    fontSize: 11,
    fontWeight: '800',
  },
  connectionStripTextDanger: {
    color: colors.danger,
  },
  connectionStripTextWarning: {
    color: colors.warning,
  },
  cameraActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cameraFab: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cameraFabPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  cameraFabGlyph: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  followChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  followChipActive: {
    backgroundColor: 'rgba(63, 163, 77, 0.22)',
    borderColor: 'rgba(63, 163, 77, 0.45)',
  },
  followChipPressed: {
    opacity: 0.82,
  },
  followChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  followChipLabelActive: {
    color: colors.success,
  },
  /* A.3 — área de toasts */
  toastArea: {
    maxWidth: '72%',
    gap: 4,
  },
  /* --- Fundo --- */
  bottomHud: {
    alignItems: 'stretch',
    gap: 6,
    paddingBottom: 4,
  },
  /* C.2 — barra de recursos + rodada */
  resourceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resourcePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resourceLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  resourceValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  roundPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderColor: 'rgba(224, 176, 75, 0.2)',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roundLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  roundBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    borderColor: 'rgba(224, 176, 75, 0.24)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roundBannerHeadline: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  roundBannerSubline: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
  },
  roundPressureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  roundPressureChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roundPressureChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  roundPressureHeadline: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    marginTop: 4,
  },
  roundPressureDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  streetSceneCard: {
    backgroundColor: 'rgba(6, 8, 10, 0.62)',
    borderColor: 'rgba(224, 176, 75, 0.18)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  streetSceneEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  streetSceneHeadline: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  streetSceneDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  worldPulseCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactSignalsCard: {
    gap: 8,
    maxWidth: '100%',
  },
  compactChipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  expandedInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  expandedInfoHeadline: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  expandedInfoDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  worldPulseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  worldPulseChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  worldPulseDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  worldPulseLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  worldPulseValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 112,
  },
  nextMoveCard: {
    gap: 2,
  },
  nextMoveLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nextMoveHeadline: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  nextMoveReason: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  /* Feedback single-line */
  feedbackText: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 8,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    maxWidth: '78%',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

function orderBookBadge(inventoryCount: number, money: number): number {
  if (money >= 10000) {
    return Math.max(1, Math.min(9, Math.ceil(inventoryCount / 5)));
  }

  return inventoryCount > 0 ? 1 : 0;
}

function resolveFavelaRelation(
  favela: TerritoryFavelaSummary,
  playerFactionId: string | null | undefined,
): 'ally' | 'enemy' | 'neutral' {
  if (!favela.controllingFaction?.id || !playerFactionId) {
    return 'neutral';
  }

  return favela.controllingFaction.id === playerFactionId ? 'ally' : 'enemy';
}

function buildFavelaOwnerLabel(favela: TerritoryFavelaSummary): string {
  if (favela.state === 'at_war') {
    const attacker = favela.war?.attackerFaction.abbreviation ?? favela.contestingFaction?.abbreviation ?? '--';
    const defender = favela.war?.defenderFaction.abbreviation ?? favela.controllingFaction?.abbreviation ?? '--';

    return `GUERRA · ${attacker} × ${defender}`;
  }

  if (favela.state === 'controlled' && favela.controllingFaction) {
    return `CONTROLADA · ${favela.controllingFaction.abbreviation}`;
  }

  return resolveFavelaStateLabel(favela.state).toUpperCase();
}

function resolveLiveZoneAccent(input: {
  favela: TerritoryFavelaSummary;
  policeEventType: DocksEventStatusResponse['phase'] | PoliceEventStatusResponse['events'][number]['eventType'] | null;
  relation: 'ally' | 'enemy' | 'neutral';
}): string {
  if (input.favela.state === 'at_war') {
    return colors.danger;
  }

  if (input.policeEventType === 'faca_na_caveira') {
    return colors.danger;
  }

  if (input.policeEventType === 'operacao_policial' || input.policeEventType === 'blitz_pm') {
    return colors.warning;
  }

  if (input.favela.x9?.status === 'warning' || input.favela.x9?.status === 'pending_desenrolo') {
    return colors.warning;
  }

  return resolveZoneAccentFromRelation(input.relation);
}

function summarizeRegionClimate(input: {
  activeDocksEvent: DocksEventStatusResponse | null;
  policeEvents: PoliceEventStatusResponse['events'];
  regionSummary: TerritoryRegionSummary | null;
  seasonalEvents: SeasonalEventStatusResponse['events'];
}): RegionClimateSummary {
  if (input.policeEvents.some((event) => event.eventType === 'faca_na_caveira')) {
    return {
      accent: colors.danger,
      detail: 'BOPE entrou pesado. A rua está sob choque e o mapa exige cautela máxima.',
      label: 'Rua em choque',
      pressureLabel: 'Pressão máxima na região',
    };
  }

  if (
    input.policeEvents.length > 0 ||
    (input.regionSummary?.atWarFavelas ?? 0) > 0 ||
    input.seasonalEvents.some((event) => event.eventType === 'operacao_verao')
  ) {
    return {
      accent: colors.warning,
      detail: 'Polícia, guerra ou operação ativa estão aquecendo a região.',
      label: 'Rua quente',
      pressureLabel: 'Pressão alta na região',
    };
  }

  if (input.activeDocksEvent || input.seasonalEvents.length > 0) {
    return {
      accent: colors.accent,
      detail: 'Eventos ativos estão mudando o ritmo da região e abrindo oportunidade.',
      label: 'Rua viva',
      pressureLabel: 'Clima vivo na região',
    };
  }

  return {
    accent: colors.success,
    detail: 'A região está relativamente estável. Dá para rodar o corre com menos ruído.',
    label: 'Rua firme',
    pressureLabel: 'Pressão baixa na região',
  };
}

function buildLiveEntity(input: {
  activeDocksEvent: DocksEventStatusResponse | null;
  entity: {
    color?: string;
    id: string;
    kind: MapEntityKind;
    label?: string;
    position: {
      x: number;
      y: number;
    };
  };
  playerFactionId: string | null;
  projectedFavelas: ProjectedFavela[];
  regionalSeasonalEvents: SeasonalEventStatusResponse['events'];
}): {
  color?: string;
  id: string;
  kind: MapEntityKind;
  label?: string;
  position: {
    x: number;
    y: number;
  };
} {
  const nearestFavela = findProjectedFavelaForPoint(input.projectedFavelas, input.entity.position);
  const nearestRelation = nearestFavela
    ? resolveFavelaRelation(nearestFavela.favela, input.playerFactionId)
    : 'neutral';
  const nearestAccent = nearestFavela
    ? resolveLiveZoneAccent({
        favela: nearestFavela.favela,
        policeEventType: null,
        relation: nearestRelation,
      })
    : input.entity.color ?? colors.accent;

  if (input.entity.kind === 'docks') {
    return {
      ...input.entity,
      color: input.activeDocksEvent ? colors.info : input.entity.color,
      label: input.activeDocksEvent ? 'Docas · Navio ativo' : 'Docas',
    };
  }

  if (input.entity.kind === 'party') {
    const activeSeasonalParty = input.regionalSeasonalEvents.find(
      (event) => event.eventType === 'carnaval' || event.eventType === 'ano_novo_copa',
    );

    if (activeSeasonalParty) {
      return {
        ...input.entity,
        color: colors.accent,
        label: 'Baile · Lado cheio',
      };
    }
  }

  if (input.entity.kind === 'boca') {
    return {
      ...input.entity,
      color: nearestAccent,
      label: nearestFavela ? `Boca · ${buildPoiStateLabel(nearestFavela.favela)}` : 'Boca',
    };
  }

  if (input.entity.kind === 'factory') {
    return {
      ...input.entity,
      color: nearestAccent,
      label: nearestFavela ? `Fábrica · ${buildPoiStateLabel(nearestFavela.favela)}` : 'Fábrica',
    };
  }

  if (input.entity.kind === 'scrapyard') {
    return {
      ...input.entity,
      label: 'Desmanche · discreto',
    };
  }

  if (input.entity.kind === 'market') {
    return {
      ...input.entity,
      label: 'Mercado Negro · aberto',
    };
  }

  if (input.entity.kind === 'hospital') {
    return {
      ...input.entity,
      label: 'Hospital · suporte',
    };
  }

  if (input.entity.kind === 'training') {
    return {
      ...input.entity,
      label: 'Treino · liberado',
    };
  }

  if (input.entity.kind === 'university') {
    return {
      ...input.entity,
      label: 'Universidade · aberta',
    };
  }

  return input.entity;
}

function buildPoiStateLabel(favela: TerritoryFavelaSummary): string {
  if (favela.state === 'at_war') {
    return 'em disputa';
  }

  if (favela.controllingFaction) {
    return favela.controllingFaction.abbreviation;
  }

  return 'neutra';
}

function findProjectedFavelaForPoint(
  projectedFavelas: ProjectedFavela[],
  point: {
    x: number;
    y: number;
  },
): ProjectedFavela | null {
  let bestMatch: ProjectedFavela | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const projectedFavela of projectedFavelas) {
    const distance =
      Math.abs(projectedFavela.center.x - point.x) +
      Math.abs(projectedFavela.center.y - point.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = projectedFavela;
    }
  }

  return bestMatch;
}

function shortenPulseValue(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 15)}...`;
}

function describeFavelaContext(
  favela: TerritoryFavelaSummary,
  playerFactionId: string | null,
): string {
  const relation =
    favela.controllingFaction?.id && playerFactionId
      ? favela.controllingFaction.id === playerFactionId
        ? 'Sua facção controla essa área.'
        : `Área sob ${favela.controllingFaction.abbreviation}.`
      : 'Favela ainda sem facção dominante.';
  const war =
    favela.state === 'at_war'
      ? 'Guerra declarada. O confronto já está quente aqui.'
      : null;
  const x9 =
    favela.x9?.status === 'warning' || favela.x9?.status === 'pending_desenrolo'
      ? 'X9 ativo nessa favela.'
      : null;

  return [
    relation,
    `Dificuldade ${favela.difficulty} · Pop. ${favela.population.toLocaleString('pt-BR')}.`,
    `Soldados ${favela.soldiers.active}/${favela.soldiers.max} · Bandidos ${favela.bandits.active}.`,
    `Satisfação ${favela.satisfaction} · ${favela.satisfactionProfile.tier}.`,
    war,
    x9,
  ]
    .filter(Boolean)
    .join(' ');
}
