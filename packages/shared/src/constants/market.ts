import {
  type BichoAnimalSummary,
  DrugType,
  type DrugDefinition,
  type DrugSaleChannel,
  RegionId,
  type WeaponDefinition,
} from '../types.js';

export const MARKET_AUCTION_MAX_DURATION_MINUTES = 720;
export const MARKET_AUCTION_MIN_BID_INCREMENT_FLAT = 25;
export const MARKET_AUCTION_MIN_BID_INCREMENT_RATE = 0.05;
export const MARKET_AUCTION_MIN_DURATION_MINUTES = 15;
export const MARKET_ORDER_FEE_RATE = 0.05;
export const MARKET_ORDER_DEFAULT_EXPIRY_HOURS = 24;
export const DRUG_SALE_DOCKS_REGION_ID = RegionId.Centro;
export const DRUG_SALE_STREET_CANSACO_COST = 5;
export const DRUG_SALE_CHANNELS: Array<{
  commissionRate: number;
  id: DrugSaleChannel;
  label: string;
  minLevel: number;
  propertyTypeRequired: 'boca' | 'rave' | null;
  cansacoCost: number;
}> = [
  {
    commissionRate: 0.05,
    id: 'street',
    label: 'Tráfico Direto',
    minLevel: 2,
    propertyTypeRequired: null,
    cansacoCost: DRUG_SALE_STREET_CANSACO_COST,
  },
  {
    commissionRate: 0,
    id: 'boca',
    label: 'Boca de Fumo',
    minLevel: 4,
    propertyTypeRequired: 'boca',
    cansacoCost: 0,
  },
  {
    commissionRate: 0,
    id: 'rave',
    label: 'Rave/Baile',
    minLevel: 4,
    propertyTypeRequired: 'rave',
    cansacoCost: 0,
  },
  {
    commissionRate: 0,
    id: 'docks',
    label: 'Docas',
    minLevel: 4,
    propertyTypeRequired: null,
    cansacoCost: 0,
  },
] as const;

export const DRUGS: DrugDefinition[] = [
  {
    id: 'maconha',
    name: 'Maconha',
    type: DrugType.Maconha,
    levelRequired: 2,
    basePrice: 50,
    cansacoRecovery: 1,
    brisaBoost: 1,
    addictionRate: 0.5,
    disposicaoBoost: 0,
  },
  {
    id: 'lanca',
    name: 'Lanca',
    type: DrugType.Lanca,
    levelRequired: 3,
    basePrice: 150,
    cansacoRecovery: 2,
    brisaBoost: 1,
    addictionRate: 1,
    disposicaoBoost: 2,
  },
  {
    id: 'bala',
    name: 'Bala',
    type: DrugType.Bala,
    levelRequired: 4,
    basePrice: 400,
    cansacoRecovery: 3,
    brisaBoost: 2,
    addictionRate: 1.5,
    disposicaoBoost: 5,
  },
] as const;

export const BICHO_ANIMALS: BichoAnimalSummary[] = [
  { groupNumbers: [1, 2, 3, 4], label: 'Avestruz', number: 1 },
  { groupNumbers: [5, 6, 7, 8], label: 'Aguia', number: 2 },
  { groupNumbers: [9, 10, 11, 12], label: 'Burro', number: 3 },
  { groupNumbers: [13, 14, 15, 16], label: 'Borboleta', number: 4 },
  { groupNumbers: [17, 18, 19, 20], label: 'Cachorro', number: 5 },
  { groupNumbers: [21, 22, 23, 24], label: 'Cabra', number: 6 },
  { groupNumbers: [25, 26, 27, 28], label: 'Carneiro', number: 7 },
  { groupNumbers: [29, 30, 31, 32], label: 'Camelo', number: 8 },
  { groupNumbers: [33, 34, 35, 36], label: 'Cobra', number: 9 },
  { groupNumbers: [37, 38, 39, 40], label: 'Coelho', number: 10 },
  { groupNumbers: [41, 42, 43, 44], label: 'Cavalo', number: 11 },
  { groupNumbers: [45, 46, 47, 48], label: 'Elefante', number: 12 },
  { groupNumbers: [49, 50, 51, 52], label: 'Galo', number: 13 },
  { groupNumbers: [53, 54, 55, 56], label: 'Gato', number: 14 },
  { groupNumbers: [57, 58, 59, 60], label: 'Jacare', number: 15 },
  { groupNumbers: [61, 62, 63, 64], label: 'Leao', number: 16 },
  { groupNumbers: [65, 66, 67, 68], label: 'Macaco', number: 17 },
  { groupNumbers: [69, 70, 71, 72], label: 'Porco', number: 18 },
  { groupNumbers: [73, 74, 75, 76], label: 'Pavao', number: 19 },
  { groupNumbers: [77, 78, 79, 80], label: 'Peru', number: 20 },
  { groupNumbers: [81, 82, 83, 84], label: 'Touro', number: 21 },
  { groupNumbers: [85, 86, 87, 88], label: 'Tigre', number: 22 },
  { groupNumbers: [89, 90, 91, 92], label: 'Urso', number: 23 },
  { groupNumbers: [93, 94, 95, 96], label: 'Veado', number: 24 },
  { groupNumbers: [97, 98, 99, 0], label: 'Vaca', number: 25 },
] as const;

export const WEAPONS: WeaponDefinition[] = [
  {
    id: 'canivete',
    name: 'Canivete',
    levelRequired: 1,
    basePrice: 500,
    power: 50,
    durability: 100,
  },
  {
    id: 'revolver_32',
    name: 'Revolver .32',
    levelRequired: 2,
    basePrice: 8000,
    power: 500,
    durability: 200,
  },
  {
    id: 'ak_47',
    name: 'Fuzil AK-47',
    levelRequired: 6,
    basePrice: 500000,
    power: 10000,
    durability: 300,
  },
] as const;
