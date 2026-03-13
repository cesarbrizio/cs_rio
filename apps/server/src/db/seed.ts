import { fileURLToPath } from 'node:url';

import {
  FAVELA_SERVICE_DEFINITIONS,
  PROPERTY_DEFINITIONS,
  RegionId,
  ROBBERY_DEFINITIONS,
  VEHICLE_ROBBERY_ROUTE_DEFINITIONS,
} from '@cs-rio/shared';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../config/env.js';
import {
  resolveFavelaBaseBanditTarget,
  resolveFavelaSoldierCap,
} from '../services/favela-force.js';
import { applyFixedFactionStarterTerritories } from '../services/fixed-faction-territories.js';
import {
  components,
  crimes,
  drugs,
  drugFactoryRecipeComponents,
  drugFactoryRecipes,
  factions,
  favelas,
  featureFlags,
  gameConfigEntries,
  gameConfigSets,
  marketSystemOffers,
  regions,
  soldierTemplates,
  vests,
  weapons,
} from './schema.js';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export const REGION_SEED = [
  {
    id: 'zona_sul',
    name: 'Zona Sul',
    sortOrder: 1,
    isActive: true,
    isDefaultSpawn: false,
    wealthIndex: 95,
    wealthLabel: 'muito alta',
    densityIndex: 90,
    densityLabel: 'alta',
    operationCostMultiplier: '1.25',
    spawnPositionX: 160,
    spawnPositionY: 132,
    defaultPolicePressure: 85,
    policePressure: 85,
    dominationBonus: '+25% nas receitas das favelas da região',
  },
  {
    id: 'zona_norte',
    name: 'Zona Norte',
    sortOrder: 2,
    isActive: true,
    isDefaultSpawn: false,
    wealthIndex: 45,
    wealthLabel: 'baixa',
    densityIndex: 92,
    densityLabel: 'alta',
    operationCostMultiplier: '1.00',
    spawnPositionX: 112,
    spawnPositionY: 88,
    defaultPolicePressure: 65,
    policePressure: 65,
    dominationBonus: '+20% nas receitas e +10% na produção de drogas',
  },
  {
    id: 'centro',
    name: 'Centro',
    sortOrder: 3,
    isActive: true,
    isDefaultSpawn: true,
    wealthIndex: 65,
    wealthLabel: 'média',
    densityIndex: 60,
    densityLabel: 'média',
    operationCostMultiplier: '1.05',
    spawnPositionX: 128,
    spawnPositionY: 116,
    defaultPolicePressure: 70,
    policePressure: 70,
    dominationBonus: '+20% nas receitas e +15% em lavagem de dinheiro',
  },
  {
    id: 'zona_oeste',
    name: 'Zona Oeste',
    sortOrder: 4,
    isActive: true,
    isDefaultSpawn: false,
    wealthIndex: 55,
    wealthLabel: 'média',
    densityIndex: 40,
    densityLabel: 'baixa',
    operationCostMultiplier: '0.95',
    spawnPositionX: 84,
    spawnPositionY: 120,
    defaultPolicePressure: 45,
    policePressure: 45,
    dominationBonus: '+20% nas receitas e +15% em serviços de favela',
  },
  {
    id: 'zona_sudoeste',
    name: 'Zona Sudoeste',
    sortOrder: 5,
    isActive: true,
    isDefaultSpawn: false,
    wealthIndex: 88,
    wealthLabel: 'alta',
    densityIndex: 55,
    densityLabel: 'média',
    operationCostMultiplier: '1.15',
    spawnPositionX: 76,
    spawnPositionY: 148,
    defaultPolicePressure: 60,
    policePressure: 60,
    dominationBonus: '+25% nas receitas e +10% em negócios legítimos',
  },
  {
    id: 'baixada',
    name: 'Baixada',
    sortOrder: 6,
    isActive: true,
    isDefaultSpawn: false,
    wealthIndex: 25,
    wealthLabel: 'muito baixa',
    densityIndex: 55,
    densityLabel: 'média',
    operationCostMultiplier: '0.80',
    spawnPositionX: 44,
    spawnPositionY: 172,
    defaultPolicePressure: 30,
    policePressure: 30,
    dominationBonus: '+15% nas receitas e -20% no custo de manutenção',
  },
] as const;

export const FIXED_FACTIONS = [
  {
    templateCode: 'cv',
    sortOrder: 1,
    isActive: true,
    name: 'Comando Vermelho',
    abbreviation: 'CV',
    description: 'Facção fixa com base histórica em Complexo do Alemão e Rocinha. Bônus temático focado em tráfico de drogas.',
    isFixed: true,
    initialTerritory: 'Complexo do Alemao, Rocinha',
    thematicBonus: '+15% lucro em tráfico de drogas',
  },
  {
    templateCode: 'tcp',
    sortOrder: 2,
    isActive: true,
    name: 'Terceiro Comando Puro',
    abbreviation: 'TCP',
    description: 'Facção fixa com presença forte em São Carlos e Mangueira. Bônus temático focado em defesa territorial.',
    isFixed: true,
    initialTerritory: 'Complexo de Sao Carlos, Mangueira',
    thematicBonus: '+15% poder em defesa territorial',
  },
  {
    templateCode: 'ada',
    sortOrder: 3,
    isActive: true,
    name: 'Amigo dos Amigos',
    abbreviation: 'ADA',
    description: 'Facção fixa com presença inicial em Vidigal e Cantagalo. Bônus temático focado em crimes solo.',
    isFixed: true,
    initialTerritory: 'Vidigal, Cantagalo',
    thematicBonus: '+15% em crimes solo',
  },
  {
    templateCode: 'tc',
    sortOrder: 4,
    isActive: true,
    name: 'Terceiro Comando',
    abbreviation: 'TC',
    description: 'Facção fixa com presença dispersa na Zona Norte. Bônus temático focado em atributos de combate.',
    isFixed: true,
    initialTerritory: 'Territorios dispersos na Zona Norte',
    thematicBonus: '+10% em atributos de combate',
  },
  {
    templateCode: 'milicia',
    sortOrder: 5,
    isActive: true,
    name: 'Milicia',
    abbreviation: 'MIL',
    description: 'Facção fixa com presença forte em Rio das Pedras, Campo Grande e Santa Cruz. Bônus temático focado em serviços de favela.',
    isFixed: true,
    initialTerritory: 'Rio das Pedras, Campo Grande, Santa Cruz',
    thematicBonus: '+20% receita de serviços de favela',
  },
  {
    templateCode: 'lj',
    sortOrder: 6,
    isActive: true,
    name: 'Liga da Justica',
    abbreviation: 'LJ',
    description: 'Facção fixa com presença relevante na Baixada Fluminense. Bônus temático focado em ataques de facção.',
    isFixed: true,
    initialTerritory: 'Baixada Fluminense',
    thematicBonus: '+15% poder em ataques de facção',
  },
  {
    templateCode: 'pcc',
    sortOrder: 7,
    isActive: true,
    name: 'Primeiro Comando da Capital',
    abbreviation: 'PCC',
    description: 'Facção fixa com presença inicial menor em zonas comerciais. Bônus temático focado em lavagem de dinheiro e negócios.',
    isFixed: true,
    initialTerritory: 'Presença menor em zonas comerciais',
    thematicBonus: '+15% em lavagem de dinheiro e negocios',
  },
] as const;

const FAVELA_SEED_BASE = [
  { name: 'Rocinha', regionId: 'zona_sul', population: 72000, difficulty: 9 },
  { name: 'Vidigal', regionId: 'zona_sul', population: 23000, difficulty: 7 },
  { name: 'Santa Marta', regionId: 'zona_sul', population: 8200, difficulty: 6 },
  { name: 'Cantagalo', regionId: 'zona_sul', population: 9500, difficulty: 6 },
  { name: 'Pavao-Pavaozinho', regionId: 'zona_sul', population: 9100, difficulty: 6 },
  { name: 'Chapeu Mangueira', regionId: 'zona_sul', population: 4300, difficulty: 5 },
  { name: 'Babilonia', regionId: 'zona_sul', population: 3500, difficulty: 5 },
  { name: 'Complexo do Alemao', regionId: 'zona_norte', population: 69000, difficulty: 10 },
  { name: 'Jacarezinho', regionId: 'zona_norte', population: 40000, difficulty: 9 },
  { name: 'Mangueira', regionId: 'zona_norte', population: 18000, difficulty: 7 },
  { name: 'Mare', regionId: 'zona_norte', population: 140000, difficulty: 10 },
  { name: 'Complexo da Penha', regionId: 'zona_norte', population: 26000, difficulty: 8 },
  { name: 'Manguinhos', regionId: 'zona_norte', population: 32000, difficulty: 8 },
  { name: 'Cidade Alta', regionId: 'zona_norte', population: 15000, difficulty: 7 },
  { name: 'Juramento', regionId: 'zona_norte', population: 8000, difficulty: 6 },
  { name: 'Borel', regionId: 'zona_norte', population: 12000, difficulty: 6 },
  { name: 'Turano', regionId: 'zona_norte', population: 9000, difficulty: 6 },
  { name: 'Salgueiro', regionId: 'zona_norte', population: 7000, difficulty: 5 },
  { name: 'Formiga', regionId: 'zona_norte', population: 6500, difficulty: 5 },
  { name: 'Morro do Adeus', regionId: 'zona_norte', population: 5400, difficulty: 5 },
  { name: 'Vila Cruzeiro', regionId: 'zona_norte', population: 24000, difficulty: 8 },
  { name: 'Barreira do Vasco', regionId: 'zona_norte', population: 4300, difficulty: 4 },
  { name: 'Morro da Providencia', regionId: 'centro', population: 5500, difficulty: 5 },
  { name: 'Santo Cristo', regionId: 'centro', population: 3700, difficulty: 4 },
  { name: 'Morro do Pinto', regionId: 'centro', population: 3100, difficulty: 4 },
  { name: 'Fallet-Fogueteiro', regionId: 'centro', population: 7200, difficulty: 5 },
  { name: 'Morro dos Prazeres', regionId: 'centro', population: 4200, difficulty: 4 },
  { name: 'Escondidinho', regionId: 'centro', population: 2500, difficulty: 3 },
  { name: 'Cidade de Deus', regionId: 'zona_oeste', population: 38000, difficulty: 8 },
  { name: 'Muzema', regionId: 'zona_oeste', population: 9000, difficulty: 5 },
  { name: 'Gardenia Azul', regionId: 'zona_oeste', population: 11000, difficulty: 5 },
  { name: 'Rio das Pedras', regionId: 'zona_oeste', population: 63000, difficulty: 9 },
  { name: 'Cesarao', regionId: 'zona_oeste', population: 17000, difficulty: 6 },
  { name: 'Vila Kennedy', regionId: 'zona_sudoeste', population: 39000, difficulty: 8 },
  { name: 'Vila Alianca', regionId: 'zona_sudoeste', population: 18000, difficulty: 6 },
  { name: 'Antares', regionId: 'zona_sudoeste', population: 12000, difficulty: 5 },
  { name: 'Canal do Anil', regionId: 'zona_sudoeste', population: 6800, difficulty: 4 },
  { name: 'Chatuba de Mesquita', regionId: 'baixada', population: 26000, difficulty: 6 },
  { name: 'Jardim Gramacho', regionId: 'baixada', population: 20000, difficulty: 5 },
  { name: 'Parque Paulista', regionId: 'baixada', population: 9000, difficulty: 4 },
  { name: 'Pantanal', regionId: 'baixada', population: 14000, difficulty: 5 },
  { name: 'Coreia de Mesquita', regionId: 'baixada', population: 7600, difficulty: 4 },
  { name: 'Beira Mar', regionId: 'baixada', population: 8500, difficulty: 4 },
  { name: 'Bom Pastor', regionId: 'baixada', population: 6300, difficulty: 4 },
  { name: 'Morro da Caixa Dagua', regionId: 'baixada', population: 5100, difficulty: 3 },
  { name: 'Morro da Torre', regionId: 'baixada', population: 4700, difficulty: 3 },
  { name: 'Grama', regionId: 'baixada', population: 6200, difficulty: 3 },
  { name: 'Bayer', regionId: 'baixada', population: 6900, difficulty: 4 },
  { name: 'Morro do Dende de Caxias', regionId: 'baixada', population: 5300, difficulty: 4 },
  { name: 'Parque Fluminense', regionId: 'baixada', population: 7800, difficulty: 4 },
] as const;

export const FAVELA_SEED = FAVELA_SEED_BASE.map((favela, index) => ({
  ...favela,
  baseBanditTarget: resolveFavelaBaseBanditTarget(favela),
  defaultSatisfaction: 50,
  isActive: true,
  maxSoldiers: resolveFavelaSoldierCap(favela),
  sortOrder: index + 1,
})) as Array<
  (typeof FAVELA_SEED_BASE)[number] & {
    baseBanditTarget: number;
    defaultSatisfaction: number;
    isActive: boolean;
    maxSoldiers: number;
    sortOrder: number;
  }
>;

export const WEAPON_SEED = [
  ['Canivete', 50, 1, 100, '500', 1],
  ['Soco ingles', 120, 1, 150, '1200', 1],
  ['Faca peixeira', 250, 2, 120, '3000', 2],
  ['Revolver .32', 500, 2, 200, '8000', 2],
  ['Pistola .380', 900, 3, 200, '15000', 3],
  ['Pistola 9mm', 1500, 3, 250, '30000', 3],
  ['Pistola .40', 2500, 4, 250, '60000', 4],
  ['Escopeta', 4000, 5, 180, '120000', 5],
  ['Submetralhadora UZI', 6500, 5, 150, '250000', 5],
  ['Fuzil AK-47', 10000, 6, 300, '500000', 6],
  ['Fuzil AR-15', 15000, 7, 300, '900000', 6],
  ['Fuzil .50', 25000, 8, 200, '2000000', 8],
  ['Lanca-granadas', 40000, 9, 100, '5000000', 9],
  ['Minigun', 60000, 10, 80, '15000000', 12],
] as const;

export const VEST_SEED = [
  ['Colete improvisado', 30, 1, 80, '300', 2],
  ['Colete de couro', 100, 2, 120, '2000', 3],
  ['Colete balistico nivel II', 300, 3, 200, '10000', 4],
  ['Colete balistico nivel IIIA', 600, 4, 250, '30000', 5],
  ['Colete tatico', 1200, 5, 300, '80000', 6],
  ['Colete militar', 2500, 6, 350, '200000', 8],
  ['Blindagem completa', 5000, 7, 300, '600000', 9],
  ['Colete BOPE', 10000, 8, 400, '1500000', 10],
  ['Exoesqueleto tatico', 20000, 9, 250, '5000000', 12],
] as const;

export const DRUG_SEED = [
  ['Maconha', 'maconha', 1, 1, '50', '0.5', 0, 2, 1],
  ['Lanca', 'lanca', 2, 1, '150', '1', 2, 3, 1],
  ['Bala', 'bala', 3, 2, '400', '1.5', 5, 4, 1],
  ['Doce', 'doce', 4, 2, '800', '1', 0, 4, 1],
  ['MD', 'md', 5, 2, '1500', '2', 3, 5, 1],
  ['Cocaina', 'cocaina', 7, 3, '3000', '3', 10, 6, 1],
  ['Crack', 'crack', 8, 3, '5000', '5', 15, 7, 1],
] as const;

export const COMPONENT_SEED = [
  ['fertilizante_hidroponico', 'Fertilizante hidropônico', '120', 1],
  ['embalagem_zip', 'Embalagem zip', '40', 1],
  ['solvente_industrial', 'Solvente industrial', '220', 1],
  ['essencia_sintetica', 'Essência sintética', '320', 1],
  ['capsula_prensada', 'Cápsula prensada', '260', 1],
  ['precursor_quimico', 'Precursor químico', '520', 1],
  ['po_base_refinado', 'Pó base refinado', '700', 1],
  ['bicarbonato_pesado', 'Bicarbonato pesado', '180', 1],
] as const;

export const DRUG_FACTORY_RECIPE_SEED = [
  {
    baseProduction: 18,
    componentRequirements: [
      ['fertilizante_hidroponico', 2],
      ['embalagem_zip', 1],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '900',
    drugCode: 'maconha',
  },
  {
    baseProduction: 12,
    componentRequirements: [
      ['solvente_industrial', 2],
      ['essencia_sintetica', 1],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '1800',
    drugCode: 'lanca',
  },
  {
    baseProduction: 10,
    componentRequirements: [
      ['capsula_prensada', 2],
      ['essencia_sintetica', 1],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '2800',
    drugCode: 'bala',
  },
  {
    baseProduction: 9,
    componentRequirements: [
      ['capsula_prensada', 2],
      ['precursor_quimico', 1],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '3500',
    drugCode: 'doce',
  },
  {
    baseProduction: 7,
    componentRequirements: [
      ['precursor_quimico', 2],
      ['essencia_sintetica', 2],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '5200',
    drugCode: 'md',
  },
  {
    baseProduction: 5,
    componentRequirements: [
      ['po_base_refinado', 3],
      ['solvente_industrial', 2],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '8000',
    drugCode: 'cocaina',
  },
  {
    baseProduction: 4,
    componentRequirements: [
      ['po_base_refinado', 2],
      ['bicarbonato_pesado', 2],
    ],
    cycleMinutes: 60,
    dailyMaintenanceCost: '10000',
    drugCode: 'crack',
  },
] as const;

export const SOLDIER_TEMPLATE_SEED = [
  ['olheiro', 'Olheiro', 500, '1000', 3],
  ['soldado_rua', 'Soldado de rua', 2000, '5000', 4],
  ['fogueteiro_alerta', 'Fogueteiro de alerta', 5000, '15000', 5],
  ['seguranca_armado', 'Seguranca armado', 10000, '40000', 7],
  ['mercenario', 'Mercenario', 25000, '100000', 9],
] as const;

const SOLO_CRIME_LEVELS = [
  {
    level: 1,
    staminaRange: [5, 15],
    nerveRange: [0, 0],
    rewardRange: [150, 1800],
    minPowerBase: 50,
    arrestChance: 5,
    cooldownSeconds: 180,
    conceitoBase: 6,
    names: [
      'Roubar celular na rua',
      'Furtar turista na praia',
      'Arrastao no onibus',
      'Roubar loja de conveniencia',
    ],
  },
  {
    level: 2,
    staminaRange: [8, 18],
    nerveRange: [0, 0],
    rewardRange: [500, 5000],
    minPowerBase: 150,
    arrestChance: 8,
    cooldownSeconds: 240,
    conceitoBase: 10,
    names: [
      'Assaltar pedestre armado',
      'Roubar bicicleta ou patinete eletrico',
      'Furtar carga de van de entrega',
      'Golpe do falso delivery',
      'Roubar celular no sinal',
    ],
  },
  {
    level: 3,
    staminaRange: [15, 25],
    nerveRange: [5, 10],
    rewardRange: [3000, 18000],
    minPowerBase: 600,
    arrestChance: 12,
    cooldownSeconds: 420,
    conceitoBase: 18,
    names: [
      'Assaltar posto de gasolina',
      'Roubar farmacia',
      'Sequestro relampago',
      'Assalto a onibus',
      'Roubo de moto na pista',
    ],
  },
  {
    level: 4,
    staminaRange: [20, 30],
    nerveRange: [10, 15],
    rewardRange: [12000, 60000],
    minPowerBase: 1800,
    arrestChance: 16,
    cooldownSeconds: 600,
    conceitoBase: 28,
    names: [
      'Roubar joalheria',
      'Assalto a casa de cambio',
      'Roubar carga de caminhao',
      'Sequestro com resgate',
      'Golpe do seguro',
    ],
  },
  {
    level: 5,
    staminaRange: [24, 34],
    nerveRange: [15, 20],
    rewardRange: [30000, 140000],
    minPowerBase: 4500,
    arrestChance: 20,
    cooldownSeconds: 900,
    conceitoBase: 40,
    names: [
      'Assalto a banco de bairro',
      'Roubo de carro-forte',
      'Assalto a shopping',
      'Roubo de carga pesada',
      'Invasao de condominio',
    ],
  },
  {
    level: 6,
    staminaRange: [28, 38],
    nerveRange: [20, 25],
    rewardRange: [80000, 320000],
    minPowerBase: 9000,
    arrestChance: 24,
    cooldownSeconds: 1200,
    conceitoBase: 58,
    names: [
      'Golpe financeiro piramide',
      'Roubo a banco central regional',
      'Assalto ao Aeroporto Galeao',
      'Sequestro de empresario',
      'Roubo de obra de arte',
    ],
  },
  {
    level: 7,
    staminaRange: [32, 44],
    nerveRange: [30, 40],
    rewardRange: [250000, 900000],
    minPowerBase: 18000,
    arrestChance: 28,
    cooldownSeconds: 1800,
    conceitoBase: 80,
    names: [
      'Roubo ao Porto do Rio',
      'Assalto a Casa da Moeda',
      'Golpe na Bolsa de Valores',
      'Roubo ao Maracana',
      'Interceptacao de aviao de carga',
    ],
  },
  {
    level: 8,
    staminaRange: [36, 48],
    nerveRange: [40, 50],
    rewardRange: [800000, 3000000],
    minPowerBase: 32000,
    arrestChance: 32,
    cooldownSeconds: 2400,
    conceitoBase: 110,
    names: [
      'Mega-assalto ao Banco Central',
      'Roubo de ouro do Aeroporto',
      'Sequestro de politico',
      'Assalto ao BNDES',
    ],
  },
  {
    level: 9,
    staminaRange: [40, 50],
    nerveRange: [50, 50],
    rewardRange: [2500000, 8000000],
    minPowerBase: 50000,
    arrestChance: 36,
    cooldownSeconds: 3600,
    conceitoBase: 150,
    names: [
      'Golpe bilionario coordenado',
      'Roubo ao Tesouro Nacional',
      'Sequestro de embaixador',
    ],
  },
  {
    level: 10,
    staminaRange: [50, 50],
    nerveRange: [50, 50],
    rewardRange: [10000000, 25000000],
    minPowerBase: 80000,
    arrestChance: 40,
    cooldownSeconds: 21600,
    conceitoBase: 250,
    names: ['O Grande Golpe'],
  },
] as const;

const FACTION_CRIMES = [
  {
    name: 'Roubo a banco central em bonde',
    levelRequired: 5,
    minPower: 15000,
    rewardMin: '300000',
    rewardMax: '1200000',
    conceitoReward: 120,
  },
  {
    name: 'Assalto ao porto cargas internacionais',
    levelRequired: 5,
    minPower: 25000,
    rewardMin: '600000',
    rewardMax: '2000000',
    conceitoReward: 160,
  },
  {
    name: 'Invasao de base rival',
    levelRequired: 5,
    minPower: 18000,
    rewardMin: '250000',
    rewardMax: '950000',
    conceitoReward: 140,
  },
  {
    name: 'Mega-sequestro',
    levelRequired: 5,
    minPower: 22000,
    rewardMin: '400000',
    rewardMax: '1800000',
    conceitoReward: 150,
  },
  {
    name: 'Heist coordenado',
    levelRequired: 6,
    minPower: 42000,
    rewardMin: '1500000',
    rewardMax: '6000000',
    conceitoReward: 220,
  },
  {
    name: 'Tomada de favela',
    levelRequired: 8,
    minPower: 30000,
    rewardMin: '500000',
    rewardMax: '2500000',
    conceitoReward: 260,
  },
] as const;

export const CRIME_SEED = [
  ...SOLO_CRIME_LEVELS.flatMap((tier) =>
    tier.names.map((name, index) => {
      const progress = tier.names.length === 1 ? 0 : index / (tier.names.length - 1);
      const staminaCost = Math.round(
        tier.staminaRange[0] + (tier.staminaRange[1] - tier.staminaRange[0]) * progress,
      );
      const nerveCost = Math.round(
        tier.nerveRange[0] + (tier.nerveRange[1] - tier.nerveRange[0]) * progress,
      );
      const rewardMin = Math.round(
        tier.rewardRange[0] + (tier.rewardRange[1] - tier.rewardRange[0]) * progress,
      );
      const rewardMax = Math.round(rewardMin * 1.7);

      return {
        code: slugify(name),
        name,
        crimeType: 'solo' as const,
        levelRequired: tier.level,
        staminaCost,
        nerveCost,
        minPower: Math.round(tier.minPowerBase * (1 + progress * 0.75)),
        rewardMin: String(rewardMin),
        rewardMax: String(rewardMax),
        conceitoReward: Math.round(tier.conceitoBase + progress * 12),
        arrestChance: Math.round(tier.arrestChance + progress * 4),
        cooldownSeconds: tier.cooldownSeconds + index * 45,
      };
    }),
  ),
  ...FACTION_CRIMES.map((crime) => ({
    code: slugify(crime.name),
    name: crime.name,
    crimeType: 'faccao' as const,
    levelRequired: crime.levelRequired,
    staminaCost: 30,
    nerveCost: 20,
    minPower: crime.minPower,
    rewardMin: crime.rewardMin,
    rewardMax: crime.rewardMax,
    conceitoReward: crime.conceitoReward,
    arrestChance: 18,
    cooldownSeconds: 3600,
  })),
] as const;

const GAME_CONFIG_SET_SEED = {
  code: 'pre_alpha_default_2026_03',
  description:
    'Conjunto base de configuracao dinamica do pre-alpha. Serve como fonte inicial para balanceamento vivo por rodada.',
  isDefault: true,
  name: 'Pre-Alpha Default 2026.03',
  notes:
    'Bootstrap inicial da Fase 18.1. Os sistemas ainda podem cair em fallback tecnico ate a migracao completa da Fase 18.10.',
  status: 'active' as const,
};

const GAME_CONFIG_ENTRY_SEED = [
  {
    key: 'round.total_game_days',
    notes: 'Total de dias de jogo por rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'game_days',
      value: 156,
    },
  },
  {
    key: 'round.game_day_real_hours',
    notes: 'Quantidade de horas reais equivalente a um dia de jogo.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'hours',
      value: 6,
    },
  },
  {
    key: 'round.top_ten_credit_reward',
    notes: 'Premiacao em creditos para os 10 melhores do ranking da rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'credits',
      value: 5,
    },
  },
  {
    key: 'bank.daily_deposit_limit_base',
    notes: 'Limite base diario de deposito no banco.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      currency: 'BRL',
      value: 500000,
    },
  },
  {
    key: 'bank.daily_deposit_limit_per_level',
    notes: 'Incremento do limite diario de deposito por nivel do jogador.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      currency: 'BRL',
      value: 25000,
    },
  },
  {
    key: 'bank.daily_interest_rate',
    notes: 'Taxa de juros diaria sobre o saldo bancario.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'rate',
      value: 0.01,
    },
  },
  {
    key: 'bank.withdraw_fee_rate',
    notes: 'Taxa percentual cobrada no saque bancario.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'rate',
      value: 0.005,
    },
  },
  {
    key: 'territory.default_police_pressure',
    notes: 'Pressao policial base aplicada as regioes ao resetar a rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'points',
      value: 50,
    },
  },
  {
    key: 'territory.default_favela_satisfaction',
    notes: 'Satisfacao base aplicada as favelas no reset da rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'points',
      value: 50,
    },
  },
  {
    key: 'faction.default_internal_satisfaction',
    notes: 'Satisfacao interna base das faccoes ao resetar a rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      unit: 'points',
      value: 50,
    },
  },
  {
    key: 'faction.default_robbery_policy',
    notes: 'Politica padrao de roubos aplicada a faccoes novas e ao reset de rodada.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      global: 'allowed',
      regions: {},
    },
  },
  {
    key: 'crime.policy',
    notes: 'Parametros globais do sistema de crimes.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      minimumPowerRatio: 0.5,
      prisonMinutesPerLevel: 6,
    },
  },
  {
    key: 'faction_crime.policy',
    notes: 'Parametros globais do crime coletivo de faccao.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      coordinationBonusPerExtraMember: 0.03,
      coordinatorRanks: ['patrao', 'general', 'gerente'],
      maxBustedChance: 0.85,
      maxCrewSize: 6,
      minBustedChance: 0.08,
      minCrewSize: 2,
    },
  },
  {
    key: 'territory.conquest_policy',
    notes: 'Parametros globais de conquista e gestao territorial.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      commandRanks: ['patrao', 'general'],
      coordinationBonusPerExtraMember: 0.03,
      managementRanks: ['patrao', 'general', 'gerente'],
      maxCrewSize: 6,
      minCrewSize: 2,
      stabilizationHours: 24,
    },
  },
  {
    key: 'events.police_pressure_delta',
    notes: 'Exemplo de tuning regional pronto para ser ajustado por rodada sem refactor.',
    scope: 'region' as const,
    targetKey: 'zona_sul',
    valueJson: {
      reason: 'Zona com maior visibilidade e sensibilidade operacional.',
      unit: 'points',
      value: 12,
    },
  },
  {
    key: 'favelas.max_soldiers',
    notes: 'Exemplo de teto de soldados especifico por favela.',
    scope: 'favela' as const,
    targetKey: 'rocinha',
    valueJson: {
      source: 'seed_override_example',
      unit: 'units',
      value: 260,
    },
  },
  {
    key: 'robbery.definition',
    notes: 'Catalogo dinamico do roubo a pedestres.',
    scope: 'robbery_type' as const,
    targetKey: 'pedestrian',
    valueJson: {
      ...ROBBERY_DEFINITIONS.find((definition) => definition.id === 'pedestrian')!,
    },
  },
  {
    key: 'robbery.definition',
    notes: 'Catalogo dinamico do roubo de celulares.',
    scope: 'robbery_type' as const,
    targetKey: 'cellphones',
    valueJson: {
      ...ROBBERY_DEFINITIONS.find((definition) => definition.id === 'cellphones')!,
    },
  },
  {
    key: 'robbery.definition',
    notes: 'Catalogo dinamico do roubo de veiculos.',
    scope: 'robbery_type' as const,
    targetKey: 'vehicle',
    valueJson: {
      ...ROBBERY_DEFINITIONS.find((definition) => definition.id === 'vehicle')!,
    },
  },
  {
    key: 'robbery.definition',
    notes: 'Catalogo dinamico do roubo de caminhao.',
    scope: 'robbery_type' as const,
    targetKey: 'truck',
    valueJson: {
      ...ROBBERY_DEFINITIONS.find((definition) => definition.id === 'truck')!,
    },
  },
  {
    key: 'robbery.vehicle_route_definition',
    notes: 'Catalogo dinamico da rota de resgate de veiculos.',
    scope: 'robbery_type' as const,
    targetKey: 'vehicle_route:ransom',
    valueJson: {
      ...VEHICLE_ROBBERY_ROUTE_DEFINITIONS.find((definition) => definition.id === 'ransom')!,
    },
  },
  {
    key: 'robbery.vehicle_route_definition',
    notes: 'Catalogo dinamico da rota de desmanche de veiculos.',
    scope: 'robbery_type' as const,
    targetKey: 'vehicle_route:chop_shop',
    valueJson: {
      ...VEHICLE_ROBBERY_ROUTE_DEFINITIONS.find((definition) => definition.id === 'chop_shop')!,
    },
  },
  {
    key: 'robbery.vehicle_route_definition',
    notes: 'Catalogo dinamico da rota de clonagem para o Paraguai.',
    scope: 'robbery_type' as const,
    targetKey: 'vehicle_route:paraguay',
    valueJson: {
      ...VEHICLE_ROBBERY_ROUTE_DEFINITIONS.find((definition) => definition.id === 'paraguay')!,
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica do evento Navio nas Docas.',
    scope: 'event_type' as const,
    targetKey: 'navio_docas',
    valueJson: {
      durationMs: 6 * 60 * 60 * 1000,
      headline: 'Navio nas Docas: a janela premium de escoamento abriu no Centro.',
      maxNextDelayMs: 30 * 60 * 60 * 1000,
      minNextDelayMs: 18 * 60 * 60 * 1000,
      premiumMultiplier: 1.5,
      regionIds: [RegionId.Centro],
      source: 'scheduled_docks_ship',
      unlimitedDemand: true,
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica da Operacao Policial.',
    scope: 'event_type' as const,
    targetKey: 'operacao_policial',
    valueJson: {
      banditArrestRateMax: 0.12,
      banditArrestRateMin: 0.05,
      candidateScoreBase: 10,
      candidateScoreDifficultyWeight: 4,
      candidateScorePolicePressureWeight: 0.8,
      candidateScoreSatisfactionWeight: 0.9,
      cooldownMs: 10 * 60 * 60 * 1000,
      durationMs: 2 * 60 * 60 * 1000,
      headline: 'Operação Policial: a pressão subiu e a rua ficou mais quente.',
      lowSatisfactionRollWeight: 1 / 1200,
      lowSatisfactionRollWeightBaseline: 100,
      policePressureRollWeight: 1 / 1000,
      pressureIncreaseBase: 9,
      pressureIncreaseLowSatisfaction: 12,
      pressureIncreaseLowSatisfactionThreshold: 40,
      rollChanceBase: 0.04,
      satisfactionPenaltyBase: 6,
      satisfactionPenaltyLowSatisfaction: 8,
      satisfactionPenaltyThreshold: 35,
      source: 'scheduled_police_operation',
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica da Blitz da PM.',
    scope: 'event_type' as const,
    targetKey: 'blitz_pm',
    valueJson: {
      candidateScoreBase: 10,
      candidateScorePolicePressureWeight: 1,
      cooldownMs: 6 * 60 * 60 * 1000,
      crowdedFavelaThreshold: 2,
      durationMs: 90 * 60 * 1000,
      headline: 'Blitz da PM: o cerco apertou e a circulação ficou mais arriscada.',
      highPressureThreshold: 70,
      operacaoVeraoPressureBonus: 2,
      policePressureRollWeight: 1 / 1100,
      pressureIncreaseBase: 6,
      pressureIncreaseHighPressure: 9,
      rollChanceBase: 0.05,
      satisfactionPenaltyBase: 2,
      satisfactionPenaltyCrowded: 3,
      source: 'scheduled_police_blitz',
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica do BOPE / Faca na Caveira.',
    scope: 'event_type' as const,
    targetKey: 'faca_na_caveira',
    valueJson: {
      banditKillRateMax: 0.17,
      banditKillRateMin: 0.12,
      candidateScoreDifficultyWeight: 5,
      candidateScorePolicePressureWeight: 1.4,
      candidateScoreSatisfactionWeight: 0.6,
      cooldownMs: 14 * 60 * 60 * 1000,
      drugsLossRateMax: 0.65,
      drugsLossRateMin: 0.35,
      durationMs: 75 * 60 * 1000,
      headline:
        'As operações do BOPE não fazem prisioneiros, não tem desenrolo, é faca na caveira! Eles entram, tomam armas, drogas e matam!',
      internalSatisfactionPenalty: 8,
      lowSatisfactionRollWeight: 1 / 450,
      lowSatisfactionRollWeightBaseline: 45,
      minPolicePressure: 60,
      policePressureExcessDivisor: 180,
      pressureFloor: 10,
      pressureReduction: 25,
      rollChanceBase: 0.01,
      satisfactionPenalty: 14,
      soldiersLossRateMax: 0.05,
      soldiersLossRateMin: 0.02,
      source: 'scheduled_bope_operation',
      weaponsLossRateMax: 0.5,
      weaponsLossRateMin: 0.25,
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica da Saidinha de Natal.',
    scope: 'event_type' as const,
    targetKey: 'saidinha_natal',
    valueJson: {
      arrestedBanditsCap: 0.035,
      arrestedBanditsWeight: 0.0012,
      controlledFavelaCap: 0.02,
      controlledFavelaWeight: 0.002,
      cooldownMs: 16 * 24 * 60 * 60 * 1000,
      durationMs: 3 * 60 * 60 * 1000,
      headline:
        'Saidinha de Natal! Os presos elegíveis ganharam a rua de novo e os bandidos voltaram para as favelas.',
      prisonerCap: 0.04,
      prisonerWeight: 0.004,
      rollChanceBase: 0.005,
      source: 'scheduled_saidinha_natal',
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica do evento sazonal Carnaval.',
    scope: 'event_type' as const,
    targetKey: 'carnaval',
    valueJson: {
      bonusSummary: [
        'Raves e pontos de venda em Zona Sul e Centro faturam mais com turistas.',
        'Puteiros ficam mais cheios e lucrativos nas áreas quentes do evento.',
        'Polícia mais distraída reduz a frequência de blitz e operação policial nas regiões afetadas.',
      ],
      cooldownMs: 14 * 24 * 60 * 60 * 1000,
      durationMs: 42 * 60 * 60 * 1000,
      headline:
        'Carnaval no Rio: turistas na pista, caixa quente na Zona Sul e a polícia distraída atrás do trio.',
      policeMood: 'distracted',
      policeRollMultiplier: 0.55,
      regionIds: [RegionId.ZonaSul, RegionId.Centro],
      rollChance: 0.02,
      source: 'scheduled_carnaval',
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica do evento sazonal Ano Novo em Copa.',
    scope: 'event_type' as const,
    targetKey: 'ano_novo_copa',
    valueJson: {
      bonusSummary: [
        'Zona Sul e Centro entram em pico de demanda noturna.',
        'Raves, tráfego e casas de entretenimento recebem bônus moderado de receita.',
        'A PM fica mais dispersa durante a virada, reduzindo a pressão imediata.',
      ],
      cooldownMs: 11 * 24 * 60 * 60 * 1000,
      durationMs: 18 * 60 * 60 * 1000,
      headline:
        'Ano Novo em Copa: a virada lotou a Zona Sul e o Centro, com consumo em alta e policiamento espalhado.',
      policeMood: 'distracted',
      policeRollMultiplier: 0.72,
      regionIds: [RegionId.ZonaSul, RegionId.Centro],
      rollChance: 0.025,
      source: 'scheduled_ano_novo_copa',
    },
  },
  {
    key: 'event.definition',
    notes: 'Definicao dinamica do evento sazonal Operacao Verao.',
    scope: 'event_type' as const,
    targetKey: 'operacao_verao',
    valueJson: {
      bonusSummary: [
        'Fachadas da Zona Sul recebem fluxo extra da temporada.',
        'A polícia reforça a orla e aumenta o risco territorial na região.',
        'O evento prepara o terreno para crimes mais arriscados e lucrativos na fase econômica seguinte.',
      ],
      cooldownMs: 9 * 24 * 60 * 60 * 1000,
      durationMs: 24 * 60 * 60 * 1000,
      headline:
        'Operação Verão: a PM reforçou a Zona Sul e o clima esquentou para quem insiste em operar na temporada.',
      policeMood: 'reinforced',
      policeRollMultiplier: 1.28,
      regionIds: [RegionId.ZonaSul],
      rollChance: 0.03,
      source: 'scheduled_operacao_verao',
    },
  },
] as const;

const ECONOMY_GAME_CONFIG_ENTRY_SEED = [
  ...PROPERTY_DEFINITIONS.map((definition) => ({
    key: 'economy.property_definition',
    notes: `Perfil economico dinamico da propriedade ${definition.label}.`,
    scope: 'property_type' as const,
    targetKey: definition.type,
    valueJson: {
      assetClass: definition.assetClass,
      baseDailyMaintenanceCost: definition.baseDailyMaintenanceCost,
      basePrice: definition.basePrice,
      factionCommissionRate: definition.factionCommissionRate,
      label: definition.label,
      utility: definition.utility,
    },
  })),
  {
    key: 'economy.property_event_profile',
    notes: 'Multiplicadores econômicos da boca por evento.',
    scope: 'property_type' as const,
    targetKey: 'boca',
    valueJson: {
      demandMultipliers: {
        blitz_pm: 0.75,
        faca_na_caveira: 0.3,
        operacao_policial: 0.55,
      },
      priceMultipliers: {
        faca_na_caveira: 1.12,
        operacao_policial: 1.07,
        seca_drogas: 1.18,
      },
    },
  },
  {
    key: 'economy.property_event_profile',
    notes: 'Multiplicadores econômicos da rave por evento.',
    scope: 'property_type' as const,
    targetKey: 'rave',
    valueJson: {
      priceMultipliers: {
        ano_novo_copa: 1.05,
        baile_cidade: 1.08,
        carnaval: 1.14,
        operacao_policial: 0.95,
      },
      visitorMultipliers: {
        ano_novo_copa: 1.35,
        baile_cidade: 2.2,
        blitz_pm: 0.78,
        carnaval: 2.6,
        faca_na_caveira: 0.32,
        operacao_policial: 0.58,
      },
    },
  },
  {
    key: 'economy.property_event_profile',
    notes: 'Multiplicadores econômicos do puteiro por evento.',
    scope: 'property_type' as const,
    targetKey: 'puteiro',
    valueJson: {
      clamps: {
        revenue: { max: 4.5, min: 0.35 },
        riskDeath: { max: 2, min: 0.5 },
        riskDst: { max: 2.5, min: 0.5 },
        riskEscape: { max: 2, min: 0.5 },
      },
      revenueMultipliers: {
        ano_novo_copa: 1.7,
        blitz_pm: 0.9,
        bonecas_china: 2,
        carnaval: 3,
        faca_na_caveira: 0.48,
        operacao_policial: 0.82,
        ressaca_baile: 0.5,
      },
      riskDeathMultipliers: {
        faca_na_caveira: 1.55,
        operacao_policial: 1.28,
      },
      riskDstMultipliers: {
        bonecas_china: 1.18,
        carnaval: 1.25,
      },
      riskEscapeMultipliers: {
        blitz_pm: 1.1,
        carnaval: 1.16,
        faca_na_caveira: 1.4,
        operacao_policial: 1.22,
      },
    },
  },
  {
    key: 'economy.property_event_profile',
    notes: 'Multiplicadores econômicos da loja de fachada por evento.',
    scope: 'property_type' as const,
    targetKey: 'front_store',
    valueJson: {
      clamps: {
        investigation: { max: 2, min: 0.5 },
        revenue: { max: 1.6, min: 0.5 },
      },
      investigationMultipliers: {
        blitz_pm: 1.2,
        carnaval: 0.9,
        faca_na_caveira: 1.75,
        operacao_policial: 1.4,
      },
      revenueMultipliers: {
        blitz_pm: 0.92,
        carnaval: 1.2,
        faca_na_caveira: 0.68,
        operacao_policial: 0.82,
        operacao_verao: 1.1,
      },
    },
  },
  {
    key: 'economy.property_event_profile',
    notes: 'Multiplicadores econômicos da maquininha por evento.',
    scope: 'property_type' as const,
    targetKey: 'slot_machine',
    valueJson: {
      clamps: {
        traffic: { max: 1.75, min: 0.5 },
      },
      trafficMultipliers: {
        ano_novo_copa: 1.18,
        baile_cidade: 1.12,
        blitz_pm: 0.88,
        carnaval: 1.25,
        faca_na_caveira: 0.5,
        operacao_policial: 0.72,
      },
    },
  },
  ...FAVELA_SERVICE_DEFINITIONS.map((definition) => ({
    key: 'territory.service_definition',
    notes: `Definicao dinamica do servico territorial ${definition.label}.`,
    scope: 'service_type' as const,
    targetKey: definition.type,
    valueJson: {
      ...definition,
    },
  })),
  {
    key: 'territory.propina_policy',
    notes: 'Politica base da propina territorial.',
    scope: 'global' as const,
    targetKey: '*',
    valueJson: {
      billingIntervalMs: 5 * 24 * 60 * 60 * 1000,
      initialNoticeMs: 24 * 60 * 60 * 1000,
      severeRevenueMultiplier: 0.5,
      stateTakeoverMaxDays: 7,
      stateTakeoverMinDays: 3,
      warningRevenueMultiplier: 0.8,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador na Zona Sul.',
    scope: 'region' as const,
    targetKey: RegionId.ZonaSul,
    valueJson: {
      baseRatePerResident: 8,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador na Zona Norte.',
    scope: 'region' as const,
    targetKey: RegionId.ZonaNorte,
    valueJson: {
      baseRatePerResident: 4,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador no Centro.',
    scope: 'region' as const,
    targetKey: RegionId.Centro,
    valueJson: {
      baseRatePerResident: 6,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador na Zona Oeste.',
    scope: 'region' as const,
    targetKey: RegionId.ZonaOeste,
    valueJson: {
      baseRatePerResident: 5,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador na Zona Sudoeste.',
    scope: 'region' as const,
    targetKey: RegionId.ZonaSudoeste,
    valueJson: {
      baseRatePerResident: 7,
    },
  },
  {
    key: 'territory.propina_region_profile',
    notes: 'Base da propina por morador na Baixada.',
    scope: 'region' as const,
    targetKey: RegionId.Baixada,
    valueJson: {
      baseRatePerResident: 3,
    },
  },
] as const;

const FEATURE_FLAG_SEED = [
  {
    key: 'config.dynamic_catalog_enabled',
    notes: 'Liga o catalogo dinamico de configuracao do pre-alpha.',
    payloadJson: {
      owner: 'server',
      rollout: 'pre_alpha',
    },
    scope: 'global' as const,
    status: 'active' as const,
    targetKey: '*',
  },
  {
    key: 'events.navio_docas.enabled',
    notes: 'Evento de docas habilitado para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'navio_docas',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'navio_docas',
  },
  {
    key: 'events.operacao_policial.enabled',
    notes: 'Operacao Policial habilitada para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'operacao_policial',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'operacao_policial',
  },
  {
    key: 'events.blitz_pm.enabled',
    notes: 'Blitz da PM habilitada para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'blitz_pm',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'blitz_pm',
  },
  {
    key: 'events.faca_na_caveira.enabled',
    notes: 'Evento BOPE habilitado para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'faca_na_caveira',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'faca_na_caveira',
  },
  {
    key: 'events.saidinha_natal.enabled',
    notes: 'Saidinha de Natal habilitada para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'saidinha_natal',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'saidinha_natal',
  },
  {
    key: 'events.carnaval.enabled',
    notes: 'Evento sazonal de Carnaval habilitado para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'carnaval',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'carnaval',
  },
  {
    key: 'events.ano_novo_copa.enabled',
    notes: 'Evento sazonal de Ano Novo em Copa habilitado para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'ano_novo_copa',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'ano_novo_copa',
  },
  {
    key: 'events.operacao_verao.enabled',
    notes: 'Operacao Verao habilitada para a rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'operacao_verao',
    },
    scope: 'event_type' as const,
    status: 'active' as const,
    targetKey: 'operacao_verao',
  },
  {
    key: 'events.delacao_premiada.enabled',
    notes: 'Exemplo de evento persistido, mas desligado nesta rodada.',
    payloadJson: {
      category: 'event',
      eventType: 'delacao_premiada',
    },
    scope: 'event_type' as const,
    status: 'inactive' as const,
    targetKey: 'delacao_premiada',
  },
  {
    key: 'robberies.pedestrian.enabled',
    notes: 'Roubo a pedestres liberado no recorte atual.',
    payloadJson: {
      robberyType: 'pedestrian',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'pedestrian',
  },
  {
    key: 'robberies.cellphones.enabled',
    notes: 'Roubo de celulares liberado no recorte atual.',
    payloadJson: {
      robberyType: 'cellphones',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'cellphones',
  },
  {
    key: 'robberies.vehicle.enabled',
    notes: 'Roubo de veiculos liberado no recorte atual.',
    payloadJson: {
      robberyType: 'vehicle',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'vehicle',
  },
  {
    key: 'robberies.truck.enabled',
    notes: 'Roubo de caminhao liberado no recorte atual.',
    payloadJson: {
      robberyType: 'truck',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'truck',
  },
  {
    key: 'robberies.vehicle_route.ransom.enabled',
    notes: 'Rota de resgate de veiculo liberada na rodada.',
    payloadJson: {
      route: 'ransom',
      robberyType: 'vehicle',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'vehicle_route:ransom',
  },
  {
    key: 'robberies.vehicle_route.chop_shop.enabled',
    notes: 'Rota de desmanche de veiculo liberada na rodada.',
    payloadJson: {
      route: 'chop_shop',
      robberyType: 'vehicle',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'vehicle_route:chop_shop',
  },
  {
    key: 'robberies.vehicle_route.paraguay.enabled',
    notes: 'Rota de clonagem para o Paraguai liberada na rodada.',
    payloadJson: {
      route: 'paraguay',
      robberyType: 'vehicle',
    },
    scope: 'robbery_type' as const,
    status: 'active' as const,
    targetKey: 'vehicle_route:paraguay',
  },
] as const;

export const MARKET_SYSTEM_OFFER_SEED = [
  {
    code: 'system_weapon_canivete',
    itemCode: 'canivete',
    itemType: 'weapon' as const,
    label: 'Fornecedor da rodada · Canivete',
    pricePerUnit: '80',
    restockAmount: 4,
    restockIntervalGameDays: 1,
    sortOrder: 10,
    stockAvailable: 8,
    stockMax: 8,
  },
  {
    code: 'system_weapon_faca_peixeira',
    itemCode: 'faca_peixeira',
    itemType: 'weapon' as const,
    label: 'Fornecedor da rodada · Faca peixeira',
    pricePerUnit: '420',
    restockAmount: 3,
    restockIntervalGameDays: 1,
    sortOrder: 11,
    stockAvailable: 6,
    stockMax: 6,
  },
  {
    code: 'system_weapon_revolver_32',
    itemCode: 'revolver_32',
    itemType: 'weapon' as const,
    label: 'Fornecedor da rodada · Revólver .32',
    pricePerUnit: '9500',
    restockAmount: 2,
    restockIntervalGameDays: 2,
    sortOrder: 12,
    stockAvailable: 4,
    stockMax: 4,
  },
  {
    code: 'system_weapon_pistola_380',
    itemCode: 'pistola_380',
    itemType: 'weapon' as const,
    label: 'Fornecedor da rodada · Pistola .380',
    pricePerUnit: '18000',
    restockAmount: 1,
    restockIntervalGameDays: 3,
    sortOrder: 13,
    stockAvailable: 2,
    stockMax: 2,
  },
  {
    code: 'system_vest_colete_improvisado',
    itemCode: 'colete_improvisado',
    itemType: 'vest' as const,
    label: 'Fornecedor da rodada · Colete improvisado',
    pricePerUnit: '500',
    restockAmount: 4,
    restockIntervalGameDays: 1,
    sortOrder: 20,
    stockAvailable: 8,
    stockMax: 8,
  },
  {
    code: 'system_vest_colete_de_couro',
    itemCode: 'colete_de_couro',
    itemType: 'vest' as const,
    label: 'Fornecedor da rodada · Colete de couro',
    pricePerUnit: '2500',
    restockAmount: 3,
    restockIntervalGameDays: 1,
    sortOrder: 21,
    stockAvailable: 6,
    stockMax: 6,
  },
  {
    code: 'system_vest_colete_balistico_nivel_ii',
    itemCode: 'colete_balistico_nivel_ii',
    itemType: 'vest' as const,
    label: 'Fornecedor da rodada · Colete balístico nível II',
    pricePerUnit: '12000',
    restockAmount: 2,
    restockIntervalGameDays: 2,
    sortOrder: 22,
    stockAvailable: 4,
    stockMax: 4,
  },
  {
    code: 'system_drug_maconha',
    itemCode: 'maconha',
    itemType: 'drug' as const,
    label: 'Fornecedor da rodada · Maconha',
    pricePerUnit: '65',
    restockAmount: 20,
    restockIntervalGameDays: 1,
    sortOrder: 30,
    stockAvailable: 40,
    stockMax: 40,
  },
  {
    code: 'system_drug_lanca',
    itemCode: 'lanca',
    itemType: 'drug' as const,
    label: 'Fornecedor da rodada · Lança',
    pricePerUnit: '180',
    restockAmount: 16,
    restockIntervalGameDays: 1,
    sortOrder: 31,
    stockAvailable: 32,
    stockMax: 32,
  },
  {
    code: 'system_drug_bala',
    itemCode: 'bala',
    itemType: 'drug' as const,
    label: 'Fornecedor da rodada · Bala',
    pricePerUnit: '450',
    restockAmount: 12,
    restockIntervalGameDays: 2,
    sortOrder: 32,
    stockAvailable: 24,
    stockMax: 24,
  },
  {
    code: 'system_drug_cocaina',
    itemCode: 'cocaina',
    itemType: 'drug' as const,
    label: 'Fornecedor da rodada · Cocaína',
    pricePerUnit: '3400',
    restockAmount: 6,
    restockIntervalGameDays: 3,
    sortOrder: 33,
    stockAvailable: 12,
    stockMax: 12,
  },
  {
    code: 'system_component_embalagem_zip',
    itemCode: 'embalagem_zip',
    itemType: 'component' as const,
    label: 'Fornecedor da rodada · Embalagem zip',
    pricePerUnit: '45',
    restockAmount: 24,
    restockIntervalGameDays: 1,
    sortOrder: 40,
    stockAvailable: 48,
    stockMax: 48,
  },
  {
    code: 'system_component_fertilizante_hidroponico',
    itemCode: 'fertilizante_hidroponico',
    itemType: 'component' as const,
    label: 'Fornecedor da rodada · Fertilizante hidropônico',
    pricePerUnit: '130',
    restockAmount: 18,
    restockIntervalGameDays: 1,
    sortOrder: 41,
    stockAvailable: 36,
    stockMax: 36,
  },
  {
    code: 'system_component_solvente_industrial',
    itemCode: 'solvente_industrial',
    itemType: 'component' as const,
    label: 'Fornecedor da rodada · Solvente industrial',
    pricePerUnit: '240',
    restockAmount: 12,
    restockIntervalGameDays: 2,
    sortOrder: 42,
    stockAvailable: 24,
    stockMax: 24,
  },
] as const;

export async function seedDatabase(): Promise<void> {
  const pool = new Pool({
    connectionString: env.databaseUrl,
  });
  const db = drizzle(pool);

  try {
    await db.insert(regions).values([...REGION_SEED]).onConflictDoUpdate({
      target: regions.id,
      set: {
        defaultPolicePressure: sql`excluded.default_police_pressure`,
        densityIndex: sql`excluded.density_index`,
        densityLabel: sql`excluded.density_label`,
        dominationBonus: sql`excluded.domination_bonus`,
        isActive: sql`excluded.is_active`,
        isDefaultSpawn: sql`excluded.is_default_spawn`,
        name: sql`excluded.name`,
        operationCostMultiplier: sql`excluded.operation_cost_multiplier`,
        policePressure: sql`excluded.police_pressure`,
        sortOrder: sql`excluded.sort_order`,
        spawnPositionX: sql`excluded.spawn_position_x`,
        spawnPositionY: sql`excluded.spawn_position_y`,
        wealthIndex: sql`excluded.wealth_index`,
        wealthLabel: sql`excluded.wealth_label`,
      },
    });
    await db.insert(factions).values([...FIXED_FACTIONS]).onConflictDoUpdate({
      target: factions.abbreviation,
      set: {
        description: sql`excluded.description`,
        initialTerritory: sql`excluded.initial_territory`,
        isActive: sql`excluded.is_active`,
        isFixed: sql`excluded.is_fixed`,
        name: sql`excluded.name`,
        sortOrder: sql`excluded.sort_order`,
        templateCode: sql`excluded.template_code`,
        thematicBonus: sql`excluded.thematic_bonus`,
      },
    });
    await db
      .insert(favelas)
      .values(
        FAVELA_SEED.map((favela) => ({
          banditsActive: favela.baseBanditTarget,
          banditsSyncedAt: new Date(),
          baseBanditTarget: favela.baseBanditTarget,
          code: slugify(favela.name),
          defaultSatisfaction: favela.defaultSatisfaction,
          isActive: favela.isActive,
          maxSoldiers: favela.maxSoldiers,
          name: favela.name,
          regionId: favela.regionId,
          population: favela.population,
          difficulty: favela.difficulty,
          satisfaction: favela.defaultSatisfaction,
          sortOrder: favela.sortOrder,
          propinaValue: '0',
        })),
      )
      .onConflictDoUpdate({
        target: favelas.code,
        set: {
          banditsActive: sql`excluded.bandits_active`,
          banditsArrested: 0,
          baseBanditTarget: sql`excluded.base_bandit_target`,
          banditsDeadRecent: 0,
          banditsSyncedAt: sql`excluded.bandits_synced_at`,
          defaultSatisfaction: sql`excluded.default_satisfaction`,
          difficulty: sql`excluded.difficulty`,
          isActive: sql`excluded.is_active`,
          maxSoldiers: sql`excluded.max_soldiers`,
          name: sql`excluded.name`,
          population: sql`excluded.population`,
          propinaValue: sql`excluded.propina_value`,
          regionId: sql`excluded.region_id`,
          satisfaction: sql`excluded.satisfaction`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
    await db
      .insert(weapons)
      .values(
        WEAPON_SEED.map(([name, power, levelRequired, durabilityMax, price, weight]) => ({
          code: slugify(name),
          name,
          power,
          levelRequired,
          durabilityMax,
          price,
          weight,
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(vests)
      .values(
        VEST_SEED.map(([name, defense, levelRequired, durabilityMax, price, weight]) => ({
          code: slugify(name),
          name,
          defense,
          levelRequired,
          durabilityMax,
          price,
          weight,
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(drugs)
      .values(
        DRUG_SEED.map(
          ([name, type, staminaRecovery, moralBoost, price, addictionRate, nerveBoost, productionLevel, weight]) => ({
            code: slugify(name),
            name,
            type,
            staminaRecovery,
            moralBoost,
            price,
            addictionRate,
            nerveBoost,
            productionLevel,
            weight,
          }),
        ),
      )
      .onConflictDoNothing();
    await db
      .insert(components)
      .values(
        COMPONENT_SEED.map(([code, name, price, weight]) => ({
          code,
          name,
          price,
          weight,
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(soldierTemplates)
      .values(
        SOLDIER_TEMPLATE_SEED.map(([type, name, power, dailyCost, levelRequired]) => ({
          code: slugify(name),
          type,
          name,
          power,
          dailyCost,
          levelRequired,
        })),
      )
      .onConflictDoNothing();
    const seededDrugs = await db
      .select({
        code: drugs.code,
        id: drugs.id,
      })
      .from(drugs);
    const seededWeapons = await db
      .select({
        code: weapons.code,
        id: weapons.id,
      })
      .from(weapons);
    const seededVests = await db
      .select({
        code: vests.code,
        id: vests.id,
      })
      .from(vests);
    const seededComponents = await db
      .select({
        code: components.code,
        id: components.id,
      })
      .from(components);
    const drugIdsByCode = new Map(seededDrugs.map((entry) => [entry.code, entry.id]));
    const weaponIdsByCode = new Map(seededWeapons.map((entry) => [entry.code, entry.id]));
    const vestIdsByCode = new Map(seededVests.map((entry) => [entry.code, entry.id]));
    const componentIdsByCode = new Map(seededComponents.map((entry) => [entry.code, entry.id]));

    await db
      .insert(drugFactoryRecipes)
      .values(
        DRUG_FACTORY_RECIPE_SEED.flatMap((recipe) => {
          const drugId = drugIdsByCode.get(recipe.drugCode);

          if (!drugId) {
            return [];
          }

          return [
            {
              baseProduction: recipe.baseProduction,
              cycleMinutes: recipe.cycleMinutes,
              dailyMaintenanceCost: recipe.dailyMaintenanceCost,
              drugId,
            },
          ];
        }),
      )
      .onConflictDoNothing();
    await db
      .insert(drugFactoryRecipeComponents)
      .values(
        DRUG_FACTORY_RECIPE_SEED.flatMap((recipe) => {
          const drugId = drugIdsByCode.get(recipe.drugCode);

          if (!drugId) {
            return [];
          }

          return recipe.componentRequirements.flatMap(([componentCode, quantityRequired]) => {
            const componentId = componentIdsByCode.get(componentCode);

            if (!componentId) {
              return [];
            }

            return [
              {
                componentId,
                drugId,
                quantityRequired,
              },
            ];
          });
        }),
      )
      .onConflictDoNothing();
    await db.insert(crimes).values([...CRIME_SEED]).onConflictDoNothing();

    await db
      .insert(gameConfigSets)
      .values({
        ...GAME_CONFIG_SET_SEED,
      })
      .onConflictDoUpdate({
        set: {
          description: GAME_CONFIG_SET_SEED.description,
          isDefault: GAME_CONFIG_SET_SEED.isDefault,
          name: GAME_CONFIG_SET_SEED.name,
          notes: GAME_CONFIG_SET_SEED.notes,
          status: GAME_CONFIG_SET_SEED.status,
          updatedAt: new Date(),
        },
        target: gameConfigSets.code,
      });

    const [activeConfigSet] = await db
      .select({
        id: gameConfigSets.id,
      })
      .from(gameConfigSets)
      .where(eq(gameConfigSets.code, GAME_CONFIG_SET_SEED.code))
      .limit(1);

    if (!activeConfigSet) {
      throw new Error('Falha ao localizar o conjunto padrao de configuracao dinamica.');
    }

    await db
      .insert(gameConfigEntries)
      .values(
        [...GAME_CONFIG_ENTRY_SEED, ...ECONOMY_GAME_CONFIG_ENTRY_SEED].map((entry) => ({
          configSetId: activeConfigSet.id,
          effectiveFrom: new Date('2026-03-12T00:00:00.000Z'),
          key: entry.key,
          notes: entry.notes,
          scope: entry.scope,
          status: 'active' as const,
          targetKey: entry.targetKey,
          valueJson: entry.valueJson,
        })),
      )
      .onConflictDoUpdate({
        set: {
          effectiveFrom: new Date('2026-03-12T00:00:00.000Z'),
          notes: sql`excluded.notes`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
          valueJson: sql`excluded.value_json`,
        },
        target: [
          gameConfigEntries.configSetId,
          gameConfigEntries.scope,
          gameConfigEntries.targetKey,
          gameConfigEntries.key,
        ],
      });

    await db
      .insert(featureFlags)
      .values(
        FEATURE_FLAG_SEED.map((featureFlag) => ({
          configSetId: activeConfigSet.id,
          effectiveFrom: new Date('2026-03-12T00:00:00.000Z'),
          key: featureFlag.key,
          notes: featureFlag.notes,
          payloadJson: featureFlag.payloadJson,
          scope: featureFlag.scope,
          status: featureFlag.status,
          targetKey: featureFlag.targetKey,
        })),
      )
      .onConflictDoUpdate({
        set: {
          effectiveFrom: new Date('2026-03-12T00:00:00.000Z'),
          notes: sql`excluded.notes`,
          payloadJson: sql`excluded.payload_json`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
        },
        target: [featureFlags.configSetId, featureFlags.scope, featureFlags.targetKey, featureFlags.key],
      });

    await db
      .insert(marketSystemOffers)
      .values(
        MARKET_SYSTEM_OFFER_SEED.flatMap((offer) => {
          const itemId =
            offer.itemType === 'weapon'
              ? weaponIdsByCode.get(offer.itemCode)
              : offer.itemType === 'vest'
                ? vestIdsByCode.get(offer.itemCode)
                : offer.itemType === 'drug'
                  ? drugIdsByCode.get(offer.itemCode)
                  : componentIdsByCode.get(offer.itemCode);

          if (!itemId) {
            return [];
          }

          return [
            {
              code: offer.code,
              isActive: true,
              itemId,
              itemType: offer.itemType,
              label: offer.label,
              lastRestockedGameDay: 1,
              lastRestockedRoundId: null,
              pricePerUnit: offer.pricePerUnit,
              restockAmount: offer.restockAmount,
              restockIntervalGameDays: offer.restockIntervalGameDays,
              sortOrder: offer.sortOrder,
              stockAvailable: offer.stockAvailable,
              stockMax: offer.stockMax,
            },
          ];
        }),
      )
      .onConflictDoUpdate({
        target: marketSystemOffers.code,
        set: {
          isActive: sql`excluded.is_active`,
          itemId: sql`excluded.item_id`,
          itemType: sql`excluded.item_type`,
          label: sql`excluded.label`,
          pricePerUnit: sql`excluded.price_per_unit`,
          restockAmount: sql`excluded.restock_amount`,
          restockIntervalGameDays: sql`excluded.restock_interval_game_days`,
          sortOrder: sql`excluded.sort_order`,
          stockAvailable: sql`excluded.stock_available`,
          stockMax: sql`excluded.stock_max`,
          updatedAt: new Date(),
        },
      });

    await applyFixedFactionStarterTerritories(db as never, new Date());
  } finally {
    await pool.end();
  }
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  seedDatabase()
    .then(() => {
      console.log('Seed concluido com sucesso.');
    })
    .catch((error) => {
      console.error('Falha ao executar seed.', error);
      process.exitCode = 1;
    });
}
