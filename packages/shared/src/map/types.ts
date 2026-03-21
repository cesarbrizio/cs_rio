import type { PropertyType, RegionId } from '../types.js';

export type MapEntityKind =
  | 'boca'
  | 'docks'
  | 'factory'
  | 'hospital'
  | 'market'
  | 'party'
  | 'scrapyard'
  | 'university';

export type MapStructureKind =
  | 'barraco-1'
  | 'barraco-2'
  | 'barraco-3'
  | 'barraco-4'
  | 'barraco-5'
  | 'favela-cluster'
  | 'boca'
  | 'baile'
  | 'rave'
  | 'hospital'
  | 'prison'
  | 'factory'
  | 'mercado-negro'
  | 'universidade'
  | 'docas'
  | 'desmanche'
  | 'predio-residencial-simples-1'
  | 'predio-residencial-simples-2'
  | 'predio-residencial-moderno-1'
  | 'predio-residencial-moderno-2'
  | 'predio-comercial-simples-1'
  | 'predio-comercial-simples-2'
  | 'predio-comercial-moderno-1'
  | 'predio-comercial-moderno-2'
  | 'casa-residencial-simples-1'
  | 'casa-residencial-simples-2'
  | 'casa-residencial-moderna-1'
  | 'casa-residencial-moderna-2';

export interface MapPropertySlot {
  favelaId: string | null;
  gridPosition: {
    x: number;
    y: number;
  };
  ownerId?: string | null;
  propertyType: PropertyType;
  regionId: RegionId;
  slotId: string;
  status: 'free' | 'occupied';
  structureId: string;
}
