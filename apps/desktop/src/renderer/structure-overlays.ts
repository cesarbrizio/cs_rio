import { cartToIso } from '@engine/coordinates';
import type { ScreenPoint, TileSize } from '@engine/types';

import type { StructureOverlay } from './types';

const STRUCTURE_ACCENT: Record<string, string> = {
  baile: '#f56c8d',
  boca: '#ff9157',
  desmanche: '#6fd0ff',
  factory: '#7cce9f',
  hospital: '#5cb4ff',
  'mercado-negro': '#f4d06f',
  prison: '#b7a7ff',
  rave: '#ff78c8',
  universidade: '#ffd37e',
};

type OverlaySourceStructure = {
  accent?: string;
  footprint: { h: number; w: number };
  id: string;
  kind: string;
  label?: string;
  position: { x: number; y: number };
};

export function buildStructureOverlays(
  structures: OverlaySourceStructure[],
  tileSize: TileSize,
): StructureOverlay[] {
  return structures.map((structure) => buildStructureOverlay(structure, tileSize));
}

function buildStructureOverlay(structure: OverlaySourceStructure, tileSize: TileSize): StructureOverlay {
  const footprintWidth = structure.footprint.w;
  const footprintHeight = structure.footprint.h;
  const lot = toDiamond(
    structure.position.x,
    structure.position.y,
    footprintWidth,
    footprintHeight,
    tileSize,
  );
  const wallHeight = tileSize.height * 1.35;
  const roof = lot.map((point) => ({
    x: point.x,
    y: point.y - wallHeight,
  })) as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

  return {
    accent: structure.accent ?? STRUCTURE_ACCENT[structure.kind] ?? '#c7a56a',
    center: {
      x: (roof[0].x + roof[2].x) / 2,
      y: (roof[0].y + roof[2].y) / 2,
    },
    id: structure.id,
    kind: structure.kind,
    label: structure.label ?? structure.id,
    leftWall: [roof[0], roof[3], lot[3], lot[0]],
    lot,
    roof,
    rightWall: [roof[1], roof[2], lot[2], lot[1]],
  };
}

function toDiamond(
  gridX: number,
  gridY: number,
  footprintWidth: number,
  footprintHeight: number,
  tileSize: TileSize,
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  const north = cartToIso({ x: gridX, y: gridY }, tileSize);
  const east = cartToIso({ x: gridX + footprintWidth, y: gridY }, tileSize);
  const south = cartToIso(
    { x: gridX + footprintWidth, y: gridY + footprintHeight },
    tileSize,
  );
  const west = cartToIso({ x: gridX, y: gridY + footprintHeight }, tileSize);

  return [north, east, south, west];
}
