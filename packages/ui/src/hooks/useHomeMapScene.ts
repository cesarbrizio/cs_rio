import {
  type PropertySlotSummary,
  type TerritoryFavelaSummary,
  type TerritoryRegionSummary,
} from '@cs-rio/shared';
import {
  colors,
  getMapVisualPreset,
  isMapStructureKind,
  type RealtimeSnapshot,
  type MapStructure,
  zonaNorteMapData,
} from '@cs-rio/domain';
import {
  parseTilemap,
  TilemapRenderer,
  type CameraState,
} from '@cs-rio/game-engine';
import { useMemo } from 'react';

import {
  buildFavelaOwnerLabel,
  buildLiveEntity,
  resolveFavelaRelation,
  resolveLiveZoneAccent,
  shortenPulseValue,
  summarizeRegionClimate,
} from './homeHelpers';
import {
  type EventRuntimeState,
  type ProjectedFavela,
  type WorldContextSpot,
  type WorldPulseItem,
} from './homeTypes';
import { buildStaticStructures } from './useHomeMapSceneSupport';

type RealtimePlayerEntry = RealtimeSnapshot['players'][number];

interface TerritoryOverview {
  favelas: TerritoryFavelaSummary[];
  regions: TerritoryRegionSummary[];
}

interface UseHomeMapSceneInput {
  eventRuntimeState: EventRuntimeState | null;
  hudPlayerPosition: { x: number; y: number } | null | undefined;
  playerId?: string | null | undefined;
  playerFaction: { abbreviation: string; id: string } | null | undefined;
  playerRegionId: string | null | undefined;
  playerSpawnPosition: { x: number; y: number } | null | undefined;
  propertySlots?: PropertySlotSummary[];
  relevantRemotePlayers: Array<{
    distance: number;
    player: RealtimePlayerEntry;
  }>;
  selectedMapFavelaId: string | null;
  territoryOverview: TerritoryOverview | null;
}

export type { EventRuntimeState, ProjectedFavela, WorldContextSpot, WorldPulseItem } from './homeTypes';
export type { UseHomeMapSceneInput };

export function useHomeMapScene({
  eventRuntimeState,
  hudPlayerPosition,
  playerId,
  playerFaction,
  playerRegionId,
  playerSpawnPosition,
  propertySlots = [],
  relevantRemotePlayers,
  selectedMapFavelaId,
  territoryOverview,
}: UseHomeMapSceneInput) {
  const map = useMemo(() => parseTilemap(zonaNorteMapData), []);
  const tileSize = useMemo(
    () => ({
      height: map.tileHeight,
      width: map.tileWidth,
    }),
    [map.tileHeight, map.tileWidth],
  );
  const tilemapRenderer = useMemo(
    () => new TilemapRenderer(tileSize),
    [tileSize],
  );
  const mapVisualPreset = useMemo(
    () => getMapVisualPreset(playerRegionId),
    [playerRegionId],
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
          id: `${playerRegionId ?? 'local'}:base-ground`,
          kind: 'greenery' as const,
          radiusTiles: { x: 20, y: 13 },
        },
        ...focusedGroundPatches,
      ];
    },
    [mapCoreCenter, mapVisualPreset.groundPatches, playerRegionId],
  );
  const staticLandmarks = useMemo(
    () => mapVisualPreset.landmarks,
    [mapVisualPreset.landmarks],
  );
  const mapStructures = useMemo<MapStructure[]>(
    () =>
      map.structures.flatMap((structureItem) =>
        isMapStructureKind(structureItem.kind)
          ? [
              {
                footprint: structureItem.footprint,
                id: structureItem.id,
                interactiveEntityId: structureItem.interactiveEntityId,
                kind: structureItem.kind,
                label: structureItem.label,
                position: {
                  x: structureItem.gridX,
                  y: structureItem.gridY,
                },
              },
            ]
          : [],
      ),
    [map.structures],
  );
  const baseStructures = useMemo(
    () =>
      playerRegionId === 'zona_norte' && mapStructures.length > 0 ? mapStructures : mapVisualPreset.structures,
    [mapStructures, mapVisualPreset.structures, playerRegionId],
  );
  const currentRegionPropertySlots = useMemo(
    () => propertySlots.filter((slot) => slot.regionId === playerRegionId),
    [playerRegionId, propertySlots],
  );
  const currentRegionFavelas = useMemo(
    () => territoryOverview?.favelas?.filter((favela) => favela.regionId === playerRegionId) ?? [],
    [playerRegionId, territoryOverview?.favelas],
  );
  const currentRegionSummary = useMemo<TerritoryRegionSummary | null>(
    () => territoryOverview?.regions.find((region) => region.regionId === playerRegionId) ?? null,
    [playerRegionId, territoryOverview?.regions],
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
    () =>
      buildStaticStructures({
        baseStructures,
        currentRegionPropertySlots,
        playerId,
        projectedFavelas,
      }),
    [baseStructures, currentRegionPropertySlots, playerId, projectedFavelas],
  );
  const regionalPoliceEvents = useMemo(
    () =>
      eventRuntimeState?.police.events.filter((event) => event.regionId === playerRegionId) ?? [],
    [eventRuntimeState?.police.events, playerRegionId],
  );
  const regionalSeasonalEvents = useMemo(
    () =>
      eventRuntimeState?.seasonal.events.filter((event) => event.regionId === playerRegionId) ?? [],
    [eventRuntimeState?.seasonal.events, playerRegionId],
  );
  const activeDocksEvent = useMemo(
    () =>
      eventRuntimeState?.docks.isActive && eventRuntimeState.docks.regionId === playerRegionId
        ? eventRuntimeState.docks
        : null,
    [eventRuntimeState?.docks, playerRegionId],
  );
  const staticWorldZones = useMemo(
    () =>
      projectedFavelas.map(({ center, favela }) => {
        const radiusTiles =
          favela.difficulty >= 8
            ? { x: 4, y: 3 }
            : favela.difficulty >= 6
              ? { x: 4, y: 3 }
              : { x: 3, y: 2 };

        const policeEvent = regionalPoliceEvents.find((event) => event.favelaId === favela.id) ?? null;
        const relation = resolveFavelaRelation(favela, playerFaction?.id);
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
      }),
    [playerFaction?.id, projectedFavelas, regionalPoliceEvents],
  );
  const renderEntities = useMemo(
    () => [
      ...staticWorldEntities.map((entity) =>
        buildLiveEntity({
          activeDocksEvent,
          entity,
          playerFactionId: playerFaction?.id ?? null,
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
      playerFaction?.id,
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
    const position = hudPlayerPosition ?? playerSpawnPosition;

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
  }, [hudPlayerPosition, playerSpawnPosition, worldContextSpots]);
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
        accent: playerFaction ? colors.accent : colors.muted,
        id: 'faction',
        label: 'Facção',
        value: playerFaction ? playerFaction.abbreviation : 'Solo',
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
    playerFaction,
    regionClimate,
    regionalPoliceEvents,
    regionalSeasonalEvents,
    relevantRemotePlayers.length,
  ]);
  const selectedProjectedFavela = useMemo(
    () => projectedFavelas.find((entry) => entry.favela.id === selectedMapFavelaId) ?? null,
    [projectedFavelas, selectedMapFavelaId],
  );
  const buildRenderPlan = useMemo(
    () => (cameraState: CameraState) => tilemapRenderer.buildRenderPlan(map, cameraState),
    [map, tilemapRenderer],
  );

  return {
    activeDocksEvent,
    buildRenderPlan,
    currentRegionSummary,
    map,
    nearestWorldSpot,
    projectedFavelas,
    regionClimate,
    regionalPoliceEvents,
    regionalSeasonalEvents,
    renderEntities,
    selectedProjectedFavela,
    staticGroundPatches,
    staticLandmarks,
    staticStructures,
    staticWorldEntities,
    staticWorldTrails,
    staticWorldZones,
    tileSize,
    worldContextSpots,
    worldPulseItems,
    zoneSlots,
  };
}
