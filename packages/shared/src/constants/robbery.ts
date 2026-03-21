import type {
  RobberyDefinitionSummary,
  VehicleRobberyRouteDefinitionSummary,
} from '../types.js';

export const ROBBERY_DEFINITIONS: RobberyDefinitionSummary[] = [
  {
    baseCooldownSeconds: 45,
    baseFactionCommissionRate: 0.1,
    baseHeatDeltaRange: {
      max: 2,
      min: 1,
    },
    baseRewardRange: {
      max: 1200,
      min: 250,
    },
    defaultBanditsCommitted: 2,
    executorTypes: ['player', 'bandits'],
    id: 'pedestrian',
    label: 'Roubo a pedestres',
    maxBanditsCommitted: 4,
    minimumLevel: 1,
    riskLabel: 'baixo_medio',
  },
  {
    baseCooldownSeconds: 60,
    baseFactionCommissionRate: 0.12,
    baseHeatDeltaRange: {
      max: 3,
      min: 2,
    },
    baseRewardRange: {
      max: 2200,
      min: 600,
    },
    defaultBanditsCommitted: 2,
    executorTypes: ['player', 'bandits'],
    id: 'cellphones',
    label: 'Roubo de celulares',
    maxBanditsCommitted: 5,
    minimumLevel: 2,
    riskLabel: 'medio',
  },
  {
    baseCooldownSeconds: 90,
    baseFactionCommissionRate: 0.17,
    baseHeatDeltaRange: {
      max: 6,
      min: 4,
    },
    baseRewardRange: {
      max: 14000,
      min: 4000,
    },
    defaultBanditsCommitted: 3,
    executorTypes: ['player', 'bandits'],
    id: 'vehicle',
    label: 'Roubo de veiculos',
    maxBanditsCommitted: 6,
    minimumLevel: 4,
    riskLabel: 'medio_alto',
  },
  {
    baseCooldownSeconds: 150,
    baseFactionCommissionRate: 0.22,
    baseHeatDeltaRange: {
      max: 10,
      min: 6,
    },
    baseRewardRange: {
      max: 50000,
      min: 12000,
    },
    defaultBanditsCommitted: 4,
    executorTypes: ['player', 'bandits'],
    id: 'truck',
    label: 'Roubo de caminhao',
    maxBanditsCommitted: 8,
    minimumLevel: 5,
    riskLabel: 'alto',
  },
];

export const VEHICLE_ROBBERY_ROUTE_DEFINITIONS: VehicleRobberyRouteDefinitionSummary[] = [
  {
    baseFactionCommissionRate: 0.2,
    baseHeatDeltaRange: {
      max: 8,
      min: 5,
    },
    baseRewardRange: {
      max: 24000,
      min: 8000,
    },
    description: 'Exige contato para resgate. Regioes mais ricas aumentam retorno, calor e risco.',
    id: 'ransom',
    label: 'Devolucao com resgate',
    riskLabel: 'medio_alto',
  },
  {
    baseFactionCommissionRate: 0.15,
    baseHeatDeltaRange: {
      max: 5,
      min: 3,
    },
    baseRewardRange: {
      max: 7000,
      min: 2500,
    },
    description: 'Fluxo mais estavel de pecas no mercado negro, com calor medio e baixo upside regional.',
    id: 'chop_shop',
    label: 'Desmanche e pecas',
    riskLabel: 'medio',
  },
  {
    baseFactionCommissionRate: 0.18,
    baseHeatDeltaRange: {
      max: 6,
      min: 4,
    },
    baseRewardRange: {
      max: 14000,
      min: 6000,
    },
    description: 'Clonagem e escoamento no Paraguai, rota de maior sofisticacao e risco estrutural alto.',
    id: 'paraguay',
    label: 'Clonagem para o Paraguai',
    riskLabel: 'alto',
  },
] as const;
