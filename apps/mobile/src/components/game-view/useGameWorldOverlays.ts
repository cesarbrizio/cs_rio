import { cartToIso } from '@engine/coordinates';
import { type GridPoint } from '@engine/types';
import { useMemo } from 'react';

import { type MapEntityKind, type MapLandmark } from '../../data/mapRegionVisuals';
import { getMapStructureDefinition } from '../../data/mapStructureCatalog';
import { colors } from '../../theme/colors';
import {
  clampOverlayPosition,
  isOverlayVisible,
  projectWorldToScreen,
  scalePolygonPoints,
} from '../game-view/geometry';
import {
  type GameEntity,
  type GameEntityWorldPoint,
  type GameStructure,
  type GameTrail,
  type GameZone,
  type WorldLabelOverlay,
  type WorldLandmarkOverlay,
  type WorldStructureOverlay,
} from '../game-view/types';

interface TileSize {
  height: number;
  width: number;
}

interface UseGameWorldOverlaysInput {
  cameraState: Parameters<typeof projectWorldToScreen>[0];
  entities: GameEntity[];
  landmarks: MapLandmark[];
  playerPath: GridPoint[];
  selectedTile: GridPoint | null;
  selectedZoneId: string | null;
  structures: GameStructure[];
  tileSize: TileSize;
  zones: GameZone[];
}

export function useGameWorldOverlays({
  cameraState,
  entities,
  landmarks,
  playerPath,
  selectedTile,
  selectedZoneId,
  structures,
  tileSize,
  zones,
}: UseGameWorldOverlaysInput) {
  const selectedTileWorldPoint = useMemo(
    () => (selectedTile ? cartToIso(selectedTile, tileSize) : null),
    [selectedTile, tileSize],
  );
  const destinationOverlay = useMemo(() => {
    if (!selectedTileWorldPoint) {
      return null;
    }

    const screenPoint = projectWorldToScreen(cameraState, {
      x: selectedTileWorldPoint.x,
      y: selectedTileWorldPoint.y - 30,
    });

    if (
      !isOverlayVisible(
        screenPoint,
        cameraState.viewportWidth,
        cameraState.viewportHeight,
        16,
      )
    ) {
      return null;
    }

    return clampOverlayPosition(
      cameraState.viewportWidth,
      cameraState.viewportHeight,
      screenPoint.x - 42,
      screenPoint.y - 14,
      84,
      24,
    );
  }, [cameraState, selectedTileWorldPoint]);
  const pathWorldPoints = useMemo(
    () => playerPath.map((point) => cartToIso(point, tileSize)),
    [playerPath, tileSize],
  );
  const landmarkWorldOverlays = useMemo<WorldLandmarkOverlay[]>(
    () =>
      landmarks.map((landmark) => ({
        accent: landmark.accent ?? colors.warning,
        id: landmark.id,
        label: landmark.label,
        positionWorldPoint: cartToIso(landmark.position, tileSize),
        shape: landmark.shape,
      })),
    [landmarks, tileSize],
  );
  const structureWorldOverlays = useMemo<WorldStructureOverlay[]>(
    () =>
      structures
        .map((structure) => {
          const linkedEntity = structure.interactiveEntityId
            ? entities.find(
                (entity) =>
                  entity.id === structure.interactiveEntityId && entity.kind !== 'player',
              )
            : null;
          const structureZoneId = structure.id.startsWith('favela-visual:')
            ? structure.id.replace('favela-visual:', '')
            : null;
          const linkedZone = structureZoneId ? zones.find((zone) => zone.id === structureZoneId) : null;
          const definition = getMapStructureDefinition(structure.kind);
          const height = definition.height;
          const nw = cartToIso(structure.position, tileSize);
          const ne = cartToIso(
            { x: structure.position.x + structure.footprint.w, y: structure.position.y },
            tileSize,
          );
          const se = cartToIso(
            {
              x: structure.position.x + structure.footprint.w,
              y: structure.position.y + structure.footprint.h,
            },
            tileSize,
          );
          const sw = cartToIso(
            { x: structure.position.x, y: structure.position.y + structure.footprint.h },
            tileSize,
          );
          const basePoints: [typeof nw, typeof ne, typeof se, typeof sw] = [nw, ne, se, sw];
          const baseCenter = {
            x: (nw.x + se.x) / 2,
            y: (nw.y + se.y) / 2,
          };
          const baseWidth = Math.max(
            1,
            Math.max(nw.x, ne.x, se.x, sw.x) - Math.min(nw.x, ne.x, se.x, sw.x),
          );
          const baseHeight = Math.max(
            1,
            Math.max(nw.y, ne.y, se.y, sw.y) - Math.min(nw.y, ne.y, se.y, sw.y),
          );
          const lotCenter = {
            x: baseCenter.x + baseWidth * definition.placement.lot.offsetX,
            y: baseCenter.y + baseHeight * definition.placement.lot.offsetY,
          };
          const lotPoints = scalePolygonPoints(
            basePoints,
            lotCenter,
            definition.placement.lot.scaleX,
            definition.placement.lot.scaleY,
          );
          const topPoints: [typeof nw, typeof ne, typeof se, typeof sw] = [
            { x: nw.x, y: nw.y - height },
            { x: ne.x, y: ne.y - height },
            { x: se.x, y: se.y - height },
            { x: sw.x, y: sw.y - height },
          ];

          return {
            accent: structure.accent ?? linkedZone?.accent ?? linkedEntity?.color ?? colors.accent,
            basePoints,
            entityKind: linkedEntity?.kind as MapEntityKind | undefined,
            height,
            id: structure.id,
            interactiveEntityId: structure.interactiveEntityId,
            kind: structure.kind,
            label: structure.label ?? linkedEntity?.label ?? linkedZone?.label ?? definition.label,
            lotPoints,
            ownerLabel: linkedZone?.ownerLabel,
            relation: linkedZone?.relation,
            selected: linkedZone ? linkedZone.id === selectedZoneId : false,
            topPoints,
            zoneId: linkedZone?.id,
          };
        })
        .sort((left, right) => left.basePoints[2].y - right.basePoints[2].y),
    [entities, selectedZoneId, structures, tileSize, zones],
  );
  const structureEntityIds = useMemo(
    () =>
      new Set(
        structureWorldOverlays.flatMap((structure) =>
          structure.interactiveEntityId ? [structure.interactiveEntityId] : [],
        ),
      ),
    [structureWorldOverlays],
  );
  const entityWorldPoints = useMemo(
    () =>
      entities
        .filter((entity) => !structureEntityIds.has(entity.id))
        .map((entity) => ({
          ...entity,
          worldPoint: cartToIso(entity.position, tileSize),
        })),
    [entities, structureEntityIds, tileSize],
  ) as GameEntityWorldPoint[];
  const spatialLabelOverlays = useMemo<WorldLabelOverlay[]>(() => {
    const labels: WorldLabelOverlay[] = [];

    for (const entity of entityWorldPoints) {
      if (!entity.label) {
        continue;
      }

      const screenPoint = projectWorldToScreen(cameraState, {
        x: entity.worldPoint.x,
        y: entity.worldPoint.y - 24,
      });

      if (
        isOverlayVisible(
          screenPoint,
          cameraState.viewportWidth,
          cameraState.viewportHeight,
          0,
        ) &&
        screenPoint.x > 56 &&
        screenPoint.y > 36 &&
        screenPoint.x < cameraState.viewportWidth - 96 &&
        screenPoint.y < cameraState.viewportHeight - 52
      ) {
        const clampedPosition = clampOverlayPosition(
          cameraState.viewportWidth,
          cameraState.viewportHeight,
          screenPoint.x + 10,
          screenPoint.y - 18,
          124,
          22,
        );
        labels.push({
          accent: entity.color ?? colors.accent,
          entityId: entity.id,
          entityKind: entity.kind,
          id: `entity:${entity.id}`,
          kind: 'entity',
          label: entity.label,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    for (const structure of structureWorldOverlays) {
      if (!structure.label) {
        continue;
      }

      const roofCenter = {
        x: (structure.topPoints[0].x + structure.topPoints[2].x) / 2,
        y: (structure.topPoints[0].y + structure.topPoints[2].y) / 2,
      };
      const screenPoint = projectWorldToScreen(cameraState, {
        x: roofCenter.x,
        y: roofCenter.y - 10,
      });

      if (
        isOverlayVisible(
          screenPoint,
          cameraState.viewportWidth,
          cameraState.viewportHeight,
          0,
        ) &&
        screenPoint.x > 56 &&
        screenPoint.y > 32 &&
        screenPoint.x < cameraState.viewportWidth - 112 &&
        screenPoint.y < cameraState.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          cameraState.viewportWidth,
          cameraState.viewportHeight,
          screenPoint.x - 56,
          screenPoint.y - (structure.ownerLabel ? 42 : 22),
          132,
          structure.ownerLabel ? 42 : 22,
        );
        labels.push({
          accent: structure.accent,
          anchorX: screenPoint.x,
          anchorY: screenPoint.y + 10,
          entityId: structure.zoneId ? undefined : structure.interactiveEntityId,
          entityKind: structure.entityKind,
          id: `structure:${structure.id}`,
          kind: structure.zoneId ? 'zone' : 'entity',
          label: structure.label,
          ownerLabel: structure.ownerLabel,
          relation: structure.relation,
          selected: structure.selected,
          zoneId: structure.zoneId,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    for (const landmark of landmarkWorldOverlays) {
      const screenPoint = projectWorldToScreen(cameraState, {
        x: landmark.positionWorldPoint.x,
        y: landmark.positionWorldPoint.y - 18,
      });

      if (
        isOverlayVisible(
          screenPoint,
          cameraState.viewportWidth,
          cameraState.viewportHeight,
        ) &&
        screenPoint.x > 48 &&
        screenPoint.y > 32 &&
        screenPoint.x < cameraState.viewportWidth - 112 &&
        screenPoint.y < cameraState.viewportHeight - 44
      ) {
        const clampedPosition = clampOverlayPosition(
          cameraState.viewportWidth,
          cameraState.viewportHeight,
          screenPoint.x - 44,
          screenPoint.y - 16,
          118,
          22,
        );
        labels.push({
          accent: landmark.accent,
          id: `landmark:${landmark.id}`,
          kind: 'entity',
          label: landmark.label,
          x: clampedPosition.x,
          y: clampedPosition.y,
        });
      }
    }

    return labels;
  }, [cameraState, entityWorldPoints, landmarkWorldOverlays, structureWorldOverlays]);

  return {
    destinationOverlay,
    entityWorldPoints,
    landmarkWorldOverlays,
    pathWorldPoints,
    selectedTileWorldPoint,
    spatialLabelOverlays,
    structureWorldOverlays,
  };
}
