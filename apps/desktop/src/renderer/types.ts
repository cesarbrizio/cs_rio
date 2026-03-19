import type { GridPoint, ScreenPoint, VisibleTileBounds } from '@engine/types';

export interface SceneEntity {
  accent: string;
  id: string;
  kind: 'local' | 'poi' | 'remote';
  label: string;
  position: GridPoint;
}

export interface StructureOverlay {
  accent: string;
  center: ScreenPoint;
  id: string;
  kind: string;
  label: string;
  leftWall: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  lot: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  roof: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  rightWall: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
}

export interface BenchmarkSnapshot {
  averageFps: number;
  currentFps: number;
  lowestFps: number;
  recommendation: 'evaluate-pixi' | 'keep-canvas' | 'warming';
  sampleCount: number;
}

export interface RendererTelemetry {
  benchmark: BenchmarkSnapshot;
  hoveredTile: GridPoint | null;
  pathLength: number;
  playerTile: GridPoint;
  remoteCount: number;
  selectedTile: GridPoint | null;
  visibleBounds: VisibleTileBounds;
}
