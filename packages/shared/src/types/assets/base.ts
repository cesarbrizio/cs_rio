import type { DrugType } from '../../types.js';

export interface ItemDefinition {
  id: string;
  name: string;
  levelRequired: number;
  basePrice: number;
}

export interface WeaponDefinition extends ItemDefinition {
  power: number;
  durability: number;
}

export interface DrugDefinition extends ItemDefinition {
  type: DrugType;
  cansacoRecovery: number;
  brisaBoost: number;
  addictionRate: number;
  disposicaoBoost: number;
}

export interface ComponentDefinition extends ItemDefinition {
  weight: number;
}
