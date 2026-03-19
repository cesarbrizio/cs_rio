import { cartToIso } from '@engine/coordinates';
import type {
  ParsedMapStructure,
  ScreenPoint,
  TileSize,
} from '@engine/types';
import {
  getMapStructureDefinition,
  isMapStructureKind,
} from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';

type DiamondPoints = [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

export interface EditorStructureOverlay {
  basePoints: DiamondPoints;
  footprint: { h: number; w: number };
  gridPosition: { x: number; y: number };
  height: number;
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  lotPoints: DiamondPoints;
  objectId: number;
  sortKey: number;
  spriteBounds: {
    size: number;
    x: number;
    y: number;
  };
  topPoints: DiamondPoints;
}

interface BuildStructureOverlaysInput {
  displayTileSize: TileSize;
  mapTileSize: TileSize;
  structures: ParsedMapStructure[];
}

function scalePolygonPoints(
  points: DiamondPoints,
  center: ScreenPoint,
  scaleX: number,
  scaleY: number,
): DiamondPoints {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scaleX,
    y: center.y + (point.y - center.y) * scaleY,
  })) as DiamondPoints;
}

function buildStructureOverlay(
  structure: ParsedMapStructure,
  displayTileSize: TileSize,
  mapTileSize: TileSize,
): EditorStructureOverlay | null {
  if (!isMapStructureKind(structure.kind)) {
    return null;
  }

  const definition = getMapStructureDefinition(structure.kind);
  const heightScale = displayTileSize.height / Math.max(mapTileSize.height, 1);
  const height = definition.height * heightScale;
  const nw = cartToIso({ x: structure.gridX, y: structure.gridY }, displayTileSize);
  const ne = cartToIso(
    { x: structure.gridX + structure.footprint.w, y: structure.gridY },
    displayTileSize,
  );
  const se = cartToIso(
    {
      x: structure.gridX + structure.footprint.w,
      y: structure.gridY + structure.footprint.h,
    },
    displayTileSize,
  );
  const sw = cartToIso(
    { x: structure.gridX, y: structure.gridY + structure.footprint.h },
    displayTileSize,
  );
  const basePoints: DiamondPoints = [nw, ne, se, sw];
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
  const topPoints: DiamondPoints = [
    { x: nw.x, y: nw.y - height },
    { x: ne.x, y: ne.y - height },
    { x: se.x, y: se.y - height },
    { x: sw.x, y: sw.y - height },
  ];
  const [lotNw, lotNe, lotSe, lotSw] = lotPoints;
  const lotMinX = Math.min(lotNw.x, lotNe.x, lotSe.x, lotSw.x);
  const lotMaxX = Math.max(lotNw.x, lotNe.x, lotSe.x, lotSw.x);
  const lotMinY = Math.min(lotNw.y, lotNe.y, lotSe.y, lotSw.y);
  const lotMaxY = Math.max(lotNw.y, lotNe.y, lotSe.y, lotSw.y);
  const lotWidth = Math.max(1, lotMaxX - lotMinX);
  const lotHeight = Math.max(1, lotMaxY - lotMinY);
  const spriteSize =
    Math.max(lotWidth, lotHeight * 1.8) * definition.placement.sprite.scale +
    height * 1.05;
  const spriteX =
    (lotNw.x + lotSe.x) / 2 -
    spriteSize / 2 +
    lotWidth * definition.placement.sprite.offsetX;
  const spriteY =
    lotMaxY -
    spriteSize * 0.18 +
    lotHeight * definition.placement.sprite.offsetY -
    height * 0.01;

  return {
    basePoints,
    footprint: structure.footprint,
    gridPosition: {
      x: structure.gridX,
      y: structure.gridY,
    },
    height,
    id: structure.id,
    interactiveEntityId: structure.interactiveEntityId,
    kind: structure.kind,
    label: structure.label ?? definition.label,
    lotPoints,
    objectId: structure.objectId,
    sortKey: se.y,
    spriteBounds: {
      size: spriteSize,
      x: spriteX,
      y: spriteY,
    },
    topPoints,
  };
}

export function buildStructureOverlays(
  input: BuildStructureOverlaysInput,
): EditorStructureOverlay[] {
  return input.structures
    .flatMap((structure) => {
      const overlay = buildSingleStructureOverlay({
        displayTileSize: input.displayTileSize,
        mapTileSize: input.mapTileSize,
        structure,
      });

      return overlay ? [overlay] : [];
    })
    .sort((left, right) => left.sortKey - right.sortKey);
}

export function buildSingleStructureOverlay(input: {
  displayTileSize: TileSize;
  mapTileSize: TileSize;
  structure: ParsedMapStructure;
}) {
  return buildStructureOverlay(
    input.structure,
    input.displayTileSize,
    input.mapTileSize,
  );
}
