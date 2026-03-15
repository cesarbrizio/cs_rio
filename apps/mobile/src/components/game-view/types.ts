import { type GridPoint, type ScreenPoint } from '@engine/types';

import { type MapEntityKind, type MapStructureKind } from '../../data/mapRegionVisuals';

export interface GameEntity {
  color?: string;
  id: string;
  kind?: MapEntityKind | 'player';
  label?: string;
  position: GridPoint;
}

export interface GameZone {
  accent?: string;
  center: GridPoint;
  id: string;
  label: string;
  ownerLabel?: string;
  radiusTiles?: {
    x: number;
    y: number;
  };
  relation?: 'ally' | 'enemy' | 'neutral';
}

export interface GameTrail {
  accent?: string;
  id: string;
  kind: 'alley' | 'avenue' | 'stairs' | 'street';
  label: string;
  points: GridPoint[];
}

export interface GameStructure {
  accent?: string;
  footprint: { h: number; w: number };
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  position: GridPoint;
}

export interface WorldLandmarkOverlay {
  accent: string;
  id: string;
  label: string;
  positionWorldPoint: ScreenPoint;
  shape: 'gate' | 'plaza' | 'tower' | 'warehouse';
}

export interface WorldStructureOverlay {
  accent: string;
  basePoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  entityKind?: MapEntityKind;
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  height: number;
  lotPoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  ownerLabel?: string;
  relation?: 'ally' | 'enemy' | 'neutral';
  selected?: boolean;
  topPoints: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  zoneId?: string;
}

export interface WorldLabelOverlay {
  accent: string;
  anchorX?: number;
  anchorY?: number;
  entityId?: string;
  entityKind?: MapEntityKind | 'player';
  id: string;
  kind: 'entity' | 'trail' | 'zone';
  label: string;
  ownerLabel?: string;
  relation?: 'ally' | 'enemy' | 'neutral';
  selected?: boolean;
  zoneId?: string;
  x: number;
  y: number;
}
