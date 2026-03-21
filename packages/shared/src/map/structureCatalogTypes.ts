import type { PropertyType } from '../types.js';
import type { MapStructureKind } from './types.js';

export type MapStructureCategory =
  | 'clandestino'
  | 'comercial'
  | 'equipamento'
  | 'favela'
  | 'industrial'
  | 'institucional'
  | 'residencial';

export type MapStructureDetailPreset =
  | 'barraco'
  | 'boca'
  | 'casa'
  | 'favela-cluster'
  | 'factory'
  | 'market'
  | 'nightlife'
  | 'prison'
  | 'service'
  | 'tower'
  | 'university';

export type MapStructureLotShape = 'block' | 'compound' | 'diamond' | 'yard';

export interface MapStructurePlacement {
  interactionFootprintScale: number;
  lot: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    shape: MapStructureLotShape;
  };
  sprite: {
    offsetX: number;
    offsetY: number;
    scale: number;
  };
}

export interface MapStructureDefinition {
  category: MapStructureCategory;
  defaultFootprint: { h: number; w: number };
  detailPreset: MapStructureDetailPreset;
  height: number;
  kind: MapStructureKind;
  label: string;
  palette: {
    detail: string;
    detailSoft: string;
    glow: string;
    leftWall: string;
    outline: string;
    rightWall: string;
    roof: string;
  };
  placement: MapStructurePlacement;
  propertyTypeOptions?: PropertyType[];
  purchasable?: boolean;
}
