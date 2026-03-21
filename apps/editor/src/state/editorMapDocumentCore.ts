import type { TilePropertyValue } from '@engine/types';

export interface RawTileLayer {
  data?: unknown;
  height?: unknown;
  id?: unknown;
  name?: unknown;
  opacity?: unknown;
  type?: unknown;
  visible?: unknown;
  width?: unknown;
}

export interface RawObjectLayer {
  id?: unknown;
  name?: unknown;
  objects?: unknown;
  opacity?: unknown;
  type?: unknown;
  visible?: unknown;
}

export type EditorMapLayer = EditorObjectLayerState | EditorTileLayerState;

export interface EditorTileLayerState {
  data: Uint16Array;
  height: number;
  id: number;
  meta: Record<string, unknown>;
  name: string;
  opacity: number;
  type: 'tilelayer';
  visible: boolean;
  width: number;
}

export interface EditorObjectLayerState {
  id: number;
  meta: Record<string, unknown>;
  name: string;
  objects: Array<Record<string, unknown>>;
  opacity: number;
  type: 'objectgroup';
  visible: boolean;
}

export interface EditorTileLayerSummary {
  id: number;
  name: string;
  opacity: number;
  type: 'objectgroup' | 'tilelayer';
  visible: boolean;
}

export interface EditorMapDocument {
  layers: EditorMapLayer[];
  mapMeta: Record<string, unknown>;
}

export interface EditorMapValidationResult {
  errors: string[];
  warnings: string[];
}

export const STRUCTURES_LAYER_NAME = 'structures';
export const REQUIRED_LAYER_NAMES = [
  'collision',
  'region_markers',
  'spawn_points',
  'terrain',
] as const;
export const DEFAULT_LAYER_ORDER = [
  'terrain',
  'buildings',
  'collision',
  'spawn_points',
  'region_markers',
  'structures',
] as const;

export function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function inferTiledPropertyType(value: TilePropertyValue): 'bool' | 'float' | 'int' | 'string' {
  if (typeof value === 'boolean') {
    return 'bool';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }

  return 'string';
}

export function normalizeTileLayer(
  rawLayer: RawTileLayer,
  fallbackName: string,
): EditorTileLayerState {
  const data = Array.isArray(rawLayer.data)
    ? rawLayer.data.map((value) => Number(value ?? 0))
    : [];

  return {
    data: Uint16Array.from(data),
    height: normalizeNumber(rawLayer.height, 0),
    id: normalizeNumber(rawLayer.id, 0),
    meta: {
      ...rawLayer,
      data: undefined,
      height: undefined,
      id: undefined,
      name: undefined,
      opacity: undefined,
      type: undefined,
      visible: undefined,
      width: undefined,
    },
    name: normalizeString(rawLayer.name, fallbackName),
    opacity: normalizeNumber(rawLayer.opacity, 1),
    type: 'tilelayer',
    visible: normalizeBoolean(rawLayer.visible, true),
    width: normalizeNumber(rawLayer.width, 0),
  };
}

export function normalizeObjectLayer(
  rawLayer: RawObjectLayer,
  fallbackName: string,
): EditorObjectLayerState {
  return {
    id: normalizeNumber(rawLayer.id, 0),
    meta: {
      ...rawLayer,
      id: undefined,
      name: undefined,
      objects: undefined,
      opacity: undefined,
      type: undefined,
      visible: undefined,
    },
    name: normalizeString(rawLayer.name, fallbackName),
    objects: Array.isArray(rawLayer.objects)
      ? structuredClone(rawLayer.objects) as Array<Record<string, unknown>>
      : [],
    opacity: normalizeNumber(rawLayer.opacity, 1),
    type: 'objectgroup',
    visible: normalizeBoolean(rawLayer.visible, true),
  };
}
