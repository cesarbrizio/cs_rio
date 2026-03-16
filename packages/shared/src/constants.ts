import {
  type BichoAnimalSummary,
  type CharacterAppearance,
  DrugType,
  type DrugSaleChannel,
  type FavelaServiceDefinitionSummary,
  LevelTitle,
  type PropertyDefinitionSummary,
  RegionId,
  type SoldierTemplateSummary,
  VocationType,
  type DrugDefinition,
  type FrontStoreKindTemplateSummary,
  type GpTemplateSummary,
  type PlayerHospitalizationStatus,
  type PlayerPrisonStatus,
  type PlayerAttributes,
  type RobberyDefinitionSummary,
  type VehicleRobberyRouteDefinitionSummary,
  type TribunalCaseDefinitionSummary,
  type TrainingDefinitionSummary,
  type TribunalPunishment,
  type UniversityCourseDefinitionSummary,
  type UniversityPassiveProfile,
  type WeaponDefinition,
  type FactionUpgradeDefinitionSummary,
  type FactionUpgradeEffectsProfile,
  type FactionRobberyPolicy,
} from './types.js';

export const VOCATIONS = [
  {
    id: VocationType.Cria,
    label: 'Cria',
    primaryAttribute: 'forca',
    secondaryAttribute: 'resistencia',
  },
  {
    id: VocationType.Gerente,
    label: 'Gerente',
    primaryAttribute: 'inteligencia',
    secondaryAttribute: 'resistencia',
  },
  {
    id: VocationType.Soldado,
    label: 'Soldado',
    primaryAttribute: 'forca',
    secondaryAttribute: 'inteligencia',
  },
  {
    id: VocationType.Politico,
    label: 'Politico',
    primaryAttribute: 'carisma',
    secondaryAttribute: 'inteligencia',
  },
  {
    id: VocationType.Empreendedor,
    label: 'Empreendedor',
    primaryAttribute: 'inteligencia',
    secondaryAttribute: 'carisma',
  },
] as const;

export const LEVELS = [
  { level: 1, title: LevelTitle.Pivete, conceitoRequired: 0 },
  { level: 2, title: LevelTitle.Aviaozinho, conceitoRequired: 50 },
  { level: 3, title: LevelTitle.Fogueteiro, conceitoRequired: 200 },
  { level: 4, title: LevelTitle.Vapor, conceitoRequired: 500 },
  { level: 5, title: LevelTitle.Soldado, conceitoRequired: 1500 },
  { level: 6, title: LevelTitle.GerenteDeBoca, conceitoRequired: 5000 },
  { level: 7, title: LevelTitle.Frente, conceitoRequired: 15000 },
  { level: 8, title: LevelTitle.DonoDaBoca, conceitoRequired: 50000 },
  { level: 9, title: LevelTitle.LiderDaFaccao, conceitoRequired: 150000 },
  { level: 10, title: LevelTitle.Prefeito, conceitoRequired: 500000 },
] as const;

export const REGIONS = [
  { id: RegionId.ZonaSul, label: 'Zona Sul', density: 'alta', wealth: 'muito alta' },
  { id: RegionId.ZonaNorte, label: 'Zona Norte', density: 'alta', wealth: 'baixa' },
  { id: RegionId.Centro, label: 'Centro', density: 'media', wealth: 'media' },
  { id: RegionId.ZonaOeste, label: 'Zona Oeste', density: 'baixa', wealth: 'media' },
  { id: RegionId.ZonaSudoeste, label: 'Zona Sudoeste', density: 'media', wealth: 'alta' },
  { id: RegionId.Baixada, label: 'Baixada', density: 'media', wealth: 'muito baixa' },
] as const;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  skin: 'pele_media',
  hair: 'corte_curto',
  outfit: 'camisa_branca',
};

export const DEFAULT_PLAYER_HOSPITALIZATION_STATUS: PlayerHospitalizationStatus = {
  endsAt: null,
  isHospitalized: false,
  reason: null,
  remainingSeconds: 0,
  startedAt: null,
  trigger: null,
};

export const DEFAULT_PLAYER_PRISON_STATUS: PlayerPrisonStatus = {
  endsAt: null,
  heatScore: 0,
  heatTier: 'frio',
  isImprisoned: false,
  reason: null,
  remainingSeconds: 0,
  sentencedAt: null,
};

export const DEFAULT_FACTION_ROBBERY_POLICY: FactionRobberyPolicy = {
  global: 'allowed',
  regions: {},
};

export const PLAYER_CONTACT_LIMITS = {
  known: 100,
  partner: 20,
} as const;

export const PRIVATE_MESSAGE_MAX_LENGTH = 240;
export const PRIVATE_MESSAGE_THREAD_HISTORY_LIMIT = 40;
export const VOCATION_CHANGE_COOLDOWN_HOURS = 24;
export const VOCATION_CHANGE_CREDITS_COST = 10;
export const PROPERTY_SABOTAGE_LEVEL_REQUIRED = 5;
export const PROPERTY_SABOTAGE_CANSACO_COST = 40;
export const PROPERTY_SABOTAGE_DISPOSICAO_COST = 20;
export const PROPERTY_SABOTAGE_PROPERTY_COOLDOWN_HOURS = 12;
export const PROPERTY_SABOTAGE_DAMAGE_RECOVERY_HOURS = 6;
export const PROPERTY_SABOTAGE_DAMAGE_RECOVERY_COST_RATE = 0.2;
export const PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_HOURS = 12;
export const PROPERTY_SABOTAGE_DESTRUCTION_RECOVERY_COST_RATE = 0.5;
export const PROPERTY_SABOTAGE_HARD_FAILURE_HEAT_DELTA = 10;
export const PROPERTY_SABOTAGE_SUCCESS_HEAT_DELTA = 5;
export const PROPERTY_SABOTAGE_HARD_FAILURE_PRISON_MINUTES = 60;
export const PROPERTY_SABOTAGE_TARGET_TYPES = [
  'boca',
  'factory',
  'puteiro',
  'rave',
  'slot_machine',
] as const;

export const VOCATION_BASE_ATTRIBUTES: Record<VocationType, PlayerAttributes> = {
  [VocationType.Cria]: {
    forca: 30,
    inteligencia: 10,
    resistencia: 20,
    carisma: 10,
  },
  [VocationType.Gerente]: {
    forca: 10,
    inteligencia: 30,
    resistencia: 20,
    carisma: 10,
  },
  [VocationType.Soldado]: {
    forca: 25,
    inteligencia: 20,
    resistencia: 15,
    carisma: 10,
  },
  [VocationType.Politico]: {
    forca: 10,
    inteligencia: 20,
    resistencia: 10,
    carisma: 30,
  },
  [VocationType.Empreendedor]: {
    forca: 10,
    inteligencia: 25,
    resistencia: 10,
    carisma: 25,
  },
};

export const REGION_SPAWN_POINTS: Record<RegionId, { positionX: number; positionY: number }> = {
  [RegionId.ZonaSul]: {
    positionX: 126,
    positionY: 74,
  },
  [RegionId.ZonaNorte]: {
    positionX: 84,
    positionY: 118,
  },
  [RegionId.Centro]: {
    positionX: 102,
    positionY: 96,
  },
  [RegionId.ZonaOeste]: {
    positionX: 148,
    positionY: 128,
  },
  [RegionId.ZonaSudoeste]: {
    positionX: 164,
    positionY: 88,
  },
  [RegionId.Baixada]: {
    positionX: 58,
    positionY: 152,
  },
};

export const REGION_REALTIME_ROOM_NAMES: Record<RegionId, string> = {
  [RegionId.ZonaSul]: 'room_zona_sul',
  [RegionId.ZonaNorte]: 'room_zona_norte',
  [RegionId.Centro]: 'room_centro',
  [RegionId.ZonaOeste]: 'room_zona_oeste',
  [RegionId.ZonaSudoeste]: 'room_zona_sudoeste',
  [RegionId.Baixada]: 'room_baixada',
};

export const FACTION_REALTIME_ROOM_NAME = 'faction_room';
export const REALTIME_MESSAGE_PLAYER_MOVE = 'player:move';
export const REALTIME_MESSAGE_FACTION_CHAT = 'faction:chat';
export const REALTIME_MESSAGE_FACTION_COORDINATION = 'faction:coordination';
export const REALTIME_MOVEMENT_THROTTLE_MS = 100;
export const REALTIME_MAX_SPEED_TILES_PER_SECOND = 4.5;
export const REALTIME_POSITION_BUFFER_TILES = 0.75;
export const REALTIME_REMOTE_INTERPOLATION_ALPHA = 0.35;
export const FACTION_REALTIME_MAX_CHAT_MESSAGES = 40;
export const FACTION_REALTIME_MAX_COORDINATION_ITEMS = 20;
export const FACTION_REALTIME_MAX_MESSAGE_LENGTH = 240;
export const FACTION_REALTIME_MAX_LABEL_LENGTH = 80;

export const INVENTORY_BASE_MAX_SLOTS = 20;
export const INVENTORY_BASE_MAX_WEIGHT = 60;
export const INVENTORY_HOUSE_BONUS_SLOTS = 6;
export const INVENTORY_HOUSE_BONUS_WEIGHT = 18;
export const INVENTORY_REPAIR_MIN_COST = 25;
export const TRAINING_REST_WINDOW_MS = 60 * 60 * 1000;
export const TRAINING_DIMINISH_STEP = 0.1;
export const TRAINING_MIN_MULTIPLIER = 0.5;
export const TRAINING_BASE_ATTRIBUTE_POINTS = 60;
export const PROPERTY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const PROPERTY_SWITCH_FACTION_COOLDOWN_HOURS = 24;
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
export const FAVELA_SERVICE_OPERATION_CYCLE_MINUTES = 360;
export const BOCA_OPERATION_CYCLE_MINUTES = 60;
export const RAVE_OPERATION_CYCLE_MINUTES = 90;
export const PUTEIRO_OPERATION_CYCLE_MINUTES = 180;
export const PUTEIRO_MAX_ACTIVE_GPS = 5;
export const PUTEIRO_DST_RECOVERY_CYCLES = 4;
export const FRONT_STORE_OPERATION_CYCLE_MINUTES = 240;
export const FRONT_STORE_LAUNDERING_DURATION_HOURS = 6;
export const FRONT_STORE_INVESTIGATION_BLOCK_HOURS = 12;
export const SLOT_MACHINE_OPERATION_CYCLE_MINUTES = 240;
export const SLOT_MACHINE_INSTALL_COST = 5000;
export const SLOT_MACHINE_DEFAULT_HOUSE_EDGE = 0.22;
export const SLOT_MACHINE_MIN_HOUSE_EDGE = 0.15;
export const SLOT_MACHINE_MAX_HOUSE_EDGE = 0.3;
export const SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE = 0.01;
export const SLOT_MACHINE_MIN_JACKPOT_CHANCE = 0.005;
export const SLOT_MACHINE_MAX_JACKPOT_CHANCE = 0.02;
export const SLOT_MACHINE_MIN_BET = 100;
export const SLOT_MACHINE_MAX_BET = 100000;
export const SLOT_MACHINE_DEFAULT_MIN_BET = 100;
export const SLOT_MACHINE_DEFAULT_MAX_BET = 1000;
export const BICHO_DRAW_INTERVAL_MINUTES = 30;
export const BICHO_MIN_BET = 100;
export const BICHO_MAX_BET = 100000;
export const BICHO_PAYOUT_MULTIPLIERS = {
  cabeca: 18,
  dezena: 60,
  grupo: 5,
} as const;
export const RAVE_DEFAULT_PRICE_MULTIPLIER = 1.55;
export const RAVE_MAX_PRICE_MULTIPLIER = 2.8;
export const RAVE_MIN_PRICE_MULTIPLIER = 1.1;
export const PROPERTY_DOMINATION_TIER_THRESHOLDS = {
  absolute: 1,
  dominant: 0.75,
  none: 0,
  partial: 0.25,
  strong: 0.5,
} as const;
export const FAVELA_SERVICE_DEFINITIONS: FavelaServiceDefinitionSummary[] = [
  {
    baseDailyRevenuePerResident: 500,
    installCost: 50000,
    label: 'GatoNet',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'gatonet',
    upgradeRevenueStepMultiplier: 0.4,
  },
  {
    baseDailyRevenuePerResident: 300,
    installCost: 30000,
    label: 'TV Gato',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'tvgato',
    upgradeRevenueStepMultiplier: 0.4,
  },
  {
    baseDailyRevenuePerResident: 400,
    installCost: 40000,
    label: 'Botijao de Gas',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'botijao_gas',
    upgradeRevenueStepMultiplier: 0.4,
  },
  {
    baseDailyRevenuePerResident: 350,
    installCost: 35000,
    label: 'Mototaxi',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'mototaxi',
    upgradeRevenueStepMultiplier: 0.4,
  },
  {
    baseDailyRevenuePerResident: 450,
    installCost: 45000,
    label: 'Van',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'van',
    upgradeRevenueStepMultiplier: 0.4,
  },
  {
    baseDailyRevenuePerResident: 600,
    installCost: 60000,
    label: 'Comercio Local',
    maxLevel: 3,
    satisfactionGainOnUpgrade: 5,
    type: 'comercio_local',
    upgradeRevenueStepMultiplier: 0.4,
  },
] as const;
export const PROPERTY_DEFINITIONS: PropertyDefinitionSummary[] = [
  {
    assetClass: 'real_estate',
    baseDailyMaintenanceCost: 150,
    basePrice: 5000,
    baseProtectionScore: 40,
    factionCommissionRate: 0,
    label: 'Casa',
    maxLevel: 3,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 4,
    type: 'house',
    unlockLevel: 1,
    utility: {
      inventorySlotsBonus: INVENTORY_HOUSE_BONUS_SLOTS,
      inventoryWeightBonus: INVENTORY_HOUSE_BONUS_WEIGHT,
      cansacoRecoveryPerHourBonus: 2,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 600,
    basePrice: 25000,
    baseProtectionScore: 55,
    factionCommissionRate: 0.12,
    label: 'Boca de Fumo',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'direct',
    soldierCapacity: 10,
    type: 'boca',
    unlockLevel: 4,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 1200,
    basePrice: 40000,
    baseProtectionScore: 60,
    factionCommissionRate: 0.1,
    label: 'Rave / Baile',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'direct',
    soldierCapacity: 8,
    type: 'rave',
    unlockLevel: 4,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 1800,
    basePrice: 75000,
    baseProtectionScore: 70,
    factionCommissionRate: 0.1,
    label: 'Puteiro',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'direct',
    soldierCapacity: 10,
    type: 'puteiro',
    unlockLevel: 6,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 900,
    basePrice: 50000,
    baseProtectionScore: 52,
    factionCommissionRate: 0.06,
    label: 'Loja de Fachada',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'direct',
    soldierCapacity: 6,
    type: 'front_store',
    unlockLevel: 6,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 450,
    basePrice: 30000,
    baseProtectionScore: 48,
    factionCommissionRate: 0.07,
    label: 'Maquininha de Caca-Niquel',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'direct',
    soldierCapacity: 4,
    type: 'slot_machine',
    unlockLevel: 5,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'business',
    baseDailyMaintenanceCost: 0,
    basePrice: 0,
    baseProtectionScore: 65,
    factionCommissionRate: 0.08,
    label: 'Fabrica',
    maxLevel: 3,
    profitable: true,
    purchaseMode: 'specialized',
    soldierCapacity: 8,
    type: 'factory',
    unlockLevel: 3,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'real_estate',
    baseDailyMaintenanceCost: 480,
    basePrice: 85000,
    baseProtectionScore: 50,
    factionCommissionRate: 0,
    label: 'Casa de Praia',
    maxLevel: 3,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 4,
    type: 'beach_house',
    unlockLevel: 4,
    utility: {
      inventorySlotsBonus: 8,
      inventoryWeightBonus: 24,
      cansacoRecoveryPerHourBonus: 3,
      travelMode: null,
    },
  },
  {
    assetClass: 'real_estate',
    baseDailyMaintenanceCost: 1600,
    basePrice: 250000,
    baseProtectionScore: 78,
    factionCommissionRate: 0,
    label: 'Mansao',
    maxLevel: 3,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 8,
    type: 'mansion',
    unlockLevel: 7,
    utility: {
      inventorySlotsBonus: 12,
      inventoryWeightBonus: 36,
      cansacoRecoveryPerHourBonus: 4,
      travelMode: null,
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 180,
    basePrice: 18000,
    baseProtectionScore: 18,
    factionCommissionRate: 0,
    label: 'Carro',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'car',
    unlockLevel: 2,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'ground',
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 520,
    basePrice: 70000,
    baseProtectionScore: 28,
    factionCommissionRate: 0,
    label: 'Barco',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'boat',
    unlockLevel: 4,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'sea',
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 2400,
    basePrice: 450000,
    baseProtectionScore: 58,
    factionCommissionRate: 0,
    label: 'Iate',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 2,
    type: 'yacht',
    unlockLevel: 8,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'sea',
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 260,
    basePrice: 40000,
    baseProtectionScore: 16,
    factionCommissionRate: 0,
    label: 'Jet Ski',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'jet_ski',
    unlockLevel: 3,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'sea',
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 3200,
    basePrice: 600000,
    baseProtectionScore: 34,
    factionCommissionRate: 0,
    label: 'Aviao',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'airplane',
    unlockLevel: 9,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'air',
    },
  },
  {
    assetClass: 'vehicle',
    baseDailyMaintenanceCost: 2600,
    basePrice: 420000,
    baseProtectionScore: 32,
    factionCommissionRate: 0,
    label: 'Helicoptero',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'helicopter',
    unlockLevel: 8,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: 'air',
    },
  },
  {
    assetClass: 'luxury',
    baseDailyMaintenanceCost: 350,
    basePrice: 55000,
    baseProtectionScore: 20,
    factionCommissionRate: 0,
    label: 'Joias',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'jewelry',
    unlockLevel: 3,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'luxury',
    baseDailyMaintenanceCost: 950,
    basePrice: 180000,
    baseProtectionScore: 26,
    factionCommissionRate: 0,
    label: 'Arte',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'art',
    unlockLevel: 6,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
  {
    assetClass: 'luxury',
    baseDailyMaintenanceCost: 700,
    basePrice: 120000,
    baseProtectionScore: 24,
    factionCommissionRate: 0,
    label: 'Luxo',
    maxLevel: 1,
    profitable: false,
    purchaseMode: 'direct',
    soldierCapacity: 0,
    type: 'luxury',
    unlockLevel: 5,
    utility: {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
      travelMode: null,
    },
  },
] as const;

export const GP_TEMPLATES: GpTemplateSummary[] = [
  {
    baseDailyRevenue: 2000,
    label: 'Novinha',
    purchasePrice: 10000,
    cansacoRestorePercent: 10,
    type: 'novinha',
  },
  {
    baseDailyRevenue: 5000,
    label: 'Experiente',
    purchasePrice: 30000,
    cansacoRestorePercent: 12,
    type: 'experiente',
  },
  {
    baseDailyRevenue: 12000,
    label: 'Premium',
    purchasePrice: 80000,
    cansacoRestorePercent: 15,
    type: 'premium',
  },
  {
    baseDailyRevenue: 25000,
    label: 'VIP',
    purchasePrice: 200000,
    cansacoRestorePercent: 18,
    type: 'vip',
  },
  {
    baseDailyRevenue: 50000,
    label: 'Diamante',
    purchasePrice: 500000,
    cansacoRestorePercent: 20,
    type: 'diamante',
  },
] as const;

export const FRONT_STORE_KIND_TEMPLATES: FrontStoreKindTemplateSummary[] = [
  {
    baseDailyLegitRevenue: 1800,
    baseInvestigationRisk: 0.11,
    baseLaunderingCapacityPerDay: 26000,
    cleanReturnMultiplier: 1.07,
    kind: 'lava_rapido',
    label: 'Lava-Rapido',
  },
  {
    baseDailyLegitRevenue: 1300,
    baseInvestigationRisk: 0.08,
    baseLaunderingCapacityPerDay: 18000,
    cleanReturnMultiplier: 1.05,
    kind: 'barbearia',
    label: 'Barbearia',
  },
  {
    baseDailyLegitRevenue: 900,
    baseInvestigationRisk: 0.05,
    baseLaunderingCapacityPerDay: 22000,
    cleanReturnMultiplier: 1.04,
    kind: 'igreja',
    label: 'Igreja',
  },
  {
    baseDailyLegitRevenue: 1500,
    baseInvestigationRisk: 0.09,
    baseLaunderingCapacityPerDay: 21000,
    cleanReturnMultiplier: 1.06,
    kind: 'acai',
    label: 'Loja de Acai',
  },
  {
    baseDailyLegitRevenue: 2100,
    baseInvestigationRisk: 0.13,
    baseLaunderingCapacityPerDay: 30000,
    cleanReturnMultiplier: 1.08,
    kind: 'oficina',
    label: 'Oficina Mecanica',
  },
] as const;
export const TRAINING_ATTRIBUTE_WEIGHTS: Record<VocationType, PlayerAttributes> = {
  [VocationType.Cria]: {
    forca: 0.4,
    inteligencia: 0.15,
    resistencia: 0.3,
    carisma: 0.15,
  },
  [VocationType.Gerente]: {
    forca: 0.15,
    inteligencia: 0.4,
    resistencia: 0.3,
    carisma: 0.15,
  },
  [VocationType.Soldado]: {
    forca: 0.35,
    inteligencia: 0.25,
    resistencia: 0.25,
    carisma: 0.15,
  },
  [VocationType.Politico]: {
    forca: 0.1,
    inteligencia: 0.25,
    resistencia: 0.15,
    carisma: 0.5,
  },
  [VocationType.Empreendedor]: {
    forca: 0.1,
    inteligencia: 0.35,
    resistencia: 0.15,
    carisma: 0.4,
  },
};
export const TRAINING_DEFINITIONS: TrainingDefinitionSummary[] = [
  {
    durationMinutes: 30,
    label: 'Treino Basico',
    minimumBasicSessionsCompleted: 0,
    moneyCost: 1000,
    rewardMultiplier: 1,
    cansacoCost: 15,
    type: 'basic',
    unlockLevel: 3,
  },
  {
    durationMinutes: 60,
    label: 'Treino Avancado',
    minimumBasicSessionsCompleted: 30,
    moneyCost: 10000,
    rewardMultiplier: 2,
    cansacoCost: 30,
    type: 'advanced',
    unlockLevel: 3,
  },
  {
    durationMinutes: 120,
    label: 'Treino Intensivo',
    minimumBasicSessionsCompleted: 0,
    moneyCost: 50000,
    rewardMultiplier: 3,
    cansacoCost: 45,
    type: 'intensive',
    unlockLevel: 7,
  },
] as const;
export const UNIVERSITY_EMPTY_PASSIVE_PROFILE: UniversityPassiveProfile = {
  business: {
    bocaDemandMultiplier: 1,
    gpRevenueMultiplier: 1,
    launderingReturnMultiplier: 1,
    passiveRevenueMultiplier: 1,
    propertyMaintenanceMultiplier: 1,
  },
  crime: {
    arrestChanceMultiplier: 1,
    lowLevelSoloRewardMultiplier: 1,
    revealsTargetValue: false,
    soloSuccessMultiplier: 1,
  },
  factory: {
    extraDrugSlots: 0,
    productionMultiplier: 1,
  },
  faction: {
    factionCharismaAura: 0,
  },
  market: {
    feeRate: 0.05,
  },
  police: {
    bribeCostMultiplier: 1,
    negotiationSuccessMultiplier: 1,
  },
  pvp: {
    ambushPowerMultiplier: 1,
    assaultPowerMultiplier: 1,
    damageDealtMultiplier: 1,
    lowHpDamageTakenMultiplier: 1,
  },
  social: {
    communityInfluenceMultiplier: 1,
  },
};
export const FACTION_EMPTY_UPGRADE_EFFECTS: FactionUpgradeEffectsProfile = {
  attributeBonusMultiplier: 1,
  canAccessExclusiveArsenal: false,
  hasFortifiedHeadquarters: false,
  muleDeliveryTier: 0,
  soldierCapacityMultiplier: 1,
};
export const FACTION_UPGRADE_DEFINITIONS: FactionUpgradeDefinitionSummary[] = [
  {
    bankMoneyCost: 5000,
    effectSummary: 'Entrega 1.000 unidades de droga a cada 10 dias de jogo.',
    label: 'Mula de Drogas Nível 1',
    pointsCost: 5000,
    prerequisiteUpgradeTypes: [],
    type: 'mula_nivel_1',
  },
  {
    bankMoneyCost: 20000,
    effectSummary: 'Entrega 10.000 unidades de droga a cada 10 dias de jogo.',
    label: 'Mula de Drogas Nível 2',
    pointsCost: 20000,
    prerequisiteUpgradeTypes: ['mula_nivel_1'],
    type: 'mula_nivel_2',
  },
  {
    bankMoneyCost: 100000,
    effectSummary: 'Entrega 100.000 unidades de droga a cada 10 dias de jogo.',
    label: 'Mula de Drogas Nível 3',
    pointsCost: 100000,
    prerequisiteUpgradeTypes: ['mula_nivel_2'],
    type: 'mula_nivel_3',
  },
  {
    bankMoneyCost: 500000,
    effectSummary: 'Entrega 250.000.000 unidades de droga a cada 10 dias de jogo.',
    label: 'Mula de Drogas Nível MAX',
    pointsCost: 500000,
    prerequisiteUpgradeTypes: ['mula_nivel_3'],
    type: 'mula_max',
  },
  {
    bankMoneyCost: 10000,
    effectSummary: '+5% em todos os atributos dos membros da facção.',
    label: 'Bônus de Atributos +5%',
    pointsCost: 10000,
    prerequisiteUpgradeTypes: [],
    type: 'bonus_atributos_5',
  },
  {
    bankMoneyCost: 50000,
    effectSummary: '+10% em todos os atributos dos membros da facção.',
    label: 'Bônus de Atributos +10%',
    pointsCost: 50000,
    prerequisiteUpgradeTypes: ['bonus_atributos_5'],
    type: 'bonus_atributos_10',
  },
  {
    bankMoneyCost: 30000,
    effectSummary: 'Libera acesso ao arsenal exclusivo da facção.',
    label: 'Arsenal Exclusivo',
    pointsCost: 30000,
    prerequisiteUpgradeTypes: [],
    type: 'arsenal_exclusivo',
  },
  {
    bankMoneyCost: 25000,
    effectSummary: '+50% de capacidade de soldados nas propriedades e territórios.',
    label: 'Exército Expandido',
    pointsCost: 25000,
    prerequisiteUpgradeTypes: [],
    type: 'exercito_expandido',
  },
  {
    bankMoneyCost: 40000,
    effectSummary: 'Sede da facção com defesa extra.',
    label: 'QG Fortificado',
    pointsCost: 40000,
    prerequisiteUpgradeTypes: [],
    type: 'qg_fortificado',
  },
] as const;
export const TRIBUNAL_CASE_DEFINITIONS: TribunalCaseDefinitionSummary[] = [
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Roubo entre moradores',
    severity: 'media',
    type: 'roubo_entre_moradores',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Talaricagem',
    severity: 'media',
    type: 'talaricagem',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Divida de jogo',
    severity: 'baixa_media',
    type: 'divida_jogo',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Divida de drogas',
    severity: 'media_alta',
    type: 'divida_drogas',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Estupro',
    severity: 'muito_alta',
    type: 'estupro',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Agressao',
    severity: 'media',
    type: 'agressao',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Homicidio nao autorizado',
    severity: 'muito_alta',
    type: 'homicidio_nao_autorizado',
  },
] as const;
export const TRIBUNAL_PUNISHMENT_LABELS: Record<TribunalPunishment, string> = {
  aviso: 'Liberar com aviso',
  surra: 'Dar uma surra',
  expulsao: 'Expulsar da favela',
  matar: 'Matar',
  esquartejar: 'Esquartejar',
  queimar_no_pneu: 'Queimar no pneu',
};
export const UNIVERSITY_COURSE_DEFINITIONS: UniversityCourseDefinitionSummary[] = [
  {
    attributeRequirements: {},
    code: 'mao_leve',
    durationHours: 24,
    effectSummary: '+10% sucesso em crimes solo.',
    label: 'Mao Leve',
    moneyCost: 25000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Cria,
  },
  {
    attributeRequirements: {
      forca: 500,
    },
    code: 'corrida_de_fuga',
    durationHours: 48,
    effectSummary: '-20% chance de prisao em falhas.',
    label: 'Corrida de Fuga',
    moneyCost: 60000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Cria,
  },
  {
    attributeRequirements: {},
    code: 'olho_clinico',
    durationHours: 72,
    effectSummary: 'Revela valor real dos alvos antes do crime.',
    label: 'Olho Clinico',
    moneyCost: 120000,
    prerequisiteCourseCodes: [],
    unlockLevel: 8,
    vocation: VocationType.Cria,
  },
  {
    attributeRequirements: {},
    code: 'rei_da_rua',
    durationHours: 120,
    effectSummary: '+25% recompensa em crimes solo de nivel 1-4.',
    label: 'Rei da Rua',
    moneyCost: 250000,
    prerequisiteCourseCodes: ['mao_leve', 'corrida_de_fuga', 'olho_clinico'],
    unlockLevel: 9,
    vocation: VocationType.Cria,
  },
  {
    attributeRequirements: {},
    code: 'logistica_de_boca',
    durationHours: 24,
    effectSummary: 'Fabricas produzem 15% mais.',
    label: 'Logistica de Boca',
    moneyCost: 25000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Gerente,
  },
  {
    attributeRequirements: {
      inteligencia: 500,
    },
    code: 'rede_de_distribuicao',
    durationHours: 48,
    effectSummary: 'Bocas vendem 20% mais por ciclo.',
    label: 'Rede de Distribuicao',
    moneyCost: 60000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Gerente,
  },
  {
    attributeRequirements: {},
    code: 'quimico_mestre',
    durationHours: 72,
    effectSummary: 'Desbloqueia um segundo slot de producao por fabrica.',
    label: 'Quimico Mestre',
    moneyCost: 120000,
    prerequisiteCourseCodes: [],
    unlockLevel: 8,
    vocation: VocationType.Gerente,
  },
  {
    attributeRequirements: {},
    code: 'magnata_do_po',
    durationHours: 120,
    effectSummary: '+30% em toda producao de drogas.',
    label: 'Magnata do Po',
    moneyCost: 250000,
    prerequisiteCourseCodes: ['logistica_de_boca', 'rede_de_distribuicao', 'quimico_mestre'],
    unlockLevel: 9,
    vocation: VocationType.Gerente,
  },
  {
    attributeRequirements: {},
    code: 'tiro_certeiro',
    durationHours: 24,
    effectSummary: '+15% dano em PvP.',
    label: 'Tiro Certeiro',
    moneyCost: 25000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Soldado,
  },
  {
    attributeRequirements: {
      forca: 500,
    },
    code: 'emboscada_perfeita',
    durationHours: 48,
    effectSummary: '+20% poder em emboscadas.',
    label: 'Emboscada Perfeita',
    moneyCost: 60000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Soldado,
  },
  {
    attributeRequirements: {},
    code: 'instinto_de_sobrevivencia',
    durationHours: 72,
    effectSummary: '-30% dano recebido quando HP < 25%.',
    label: 'Instinto de Sobrevivencia',
    moneyCost: 120000,
    prerequisiteCourseCodes: [],
    unlockLevel: 8,
    vocation: VocationType.Soldado,
  },
  {
    attributeRequirements: {},
    code: 'maquina_de_guerra',
    durationHours: 120,
    effectSummary: '+25% em Poder de Assalto total.',
    label: 'Maquina de Guerra',
    moneyCost: 250000,
    prerequisiteCourseCodes: ['tiro_certeiro', 'emboscada_perfeita', 'instinto_de_sobrevivencia'],
    unlockLevel: 9,
    vocation: VocationType.Soldado,
  },
  {
    attributeRequirements: {},
    code: 'labia_de_politico',
    durationHours: 24,
    effectSummary: '+20% sucesso em negociacoes com PM.',
    label: 'Labia de Politico',
    moneyCost: 25000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Politico,
  },
  {
    attributeRequirements: {
      carisma: 500,
    },
    code: 'rede_de_contatos',
    durationHours: 48,
    effectSummary: '+15% lucro com GPs e -20% custo de suborno.',
    label: 'Rede de Contatos',
    moneyCost: 60000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Politico,
  },
  {
    attributeRequirements: {},
    code: 'manipulacao_de_massa',
    durationHours: 72,
    effectSummary: '+25% influencia em satisfacao dos moradores.',
    label: 'Manipulacao de Massa',
    moneyCost: 120000,
    prerequisiteCourseCodes: [],
    unlockLevel: 8,
    vocation: VocationType.Politico,
  },
  {
    attributeRequirements: {},
    code: 'poderoso_chefao',
    durationHours: 120,
    effectSummary: '+5% de carisma para toda a faccao.',
    label: 'Poderoso Chefao',
    moneyCost: 250000,
    prerequisiteCourseCodes: ['labia_de_politico', 'rede_de_contatos', 'manipulacao_de_massa'],
    unlockLevel: 9,
    vocation: VocationType.Politico,
  },
  {
    attributeRequirements: {},
    code: 'engenharia_financeira',
    durationHours: 24,
    effectSummary: '+10% retorno em lavagem de dinheiro.',
    label: 'Engenharia Financeira',
    moneyCost: 25000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Empreendedor,
  },
  {
    attributeRequirements: {
      inteligencia: 500,
    },
    code: 'faro_para_negocios',
    durationHours: 48,
    effectSummary: '-15% custo de manutencao de todas as propriedades.',
    label: 'Faro para Negocios',
    moneyCost: 60000,
    prerequisiteCourseCodes: [],
    unlockLevel: 7,
    vocation: VocationType.Empreendedor,
  },
  {
    attributeRequirements: {},
    code: 'mercado_paralelo',
    durationHours: 72,
    effectSummary: 'Taxa do Mercado Negro reduzida de 5% para 2%.',
    label: 'Mercado Paralelo',
    moneyCost: 120000,
    prerequisiteCourseCodes: [],
    unlockLevel: 8,
    vocation: VocationType.Empreendedor,
  },
  {
    attributeRequirements: {},
    code: 'imperio_do_crime',
    durationHours: 120,
    effectSummary: '+20% renda passiva em todos os negocios.',
    label: 'Imperio do Crime',
    moneyCost: 250000,
    prerequisiteCourseCodes: ['engenharia_financeira', 'faro_para_negocios', 'mercado_paralelo'],
    unlockLevel: 9,
    vocation: VocationType.Empreendedor,
  },
] as const;
export const SOLDIER_TEMPLATES: SoldierTemplateSummary[] = [
  {
    dailyCost: 1000,
    label: 'Olheiro',
    power: 500,
    type: 'olheiro',
    unlockLevel: 3,
  },
  {
    dailyCost: 5000,
    label: 'Soldado de rua',
    power: 2000,
    type: 'soldado_rua',
    unlockLevel: 4,
  },
  {
    dailyCost: 15000,
    label: 'Fogueteiro de alerta',
    power: 5000,
    type: 'fogueteiro_alerta',
    unlockLevel: 5,
  },
  {
    dailyCost: 40000,
    label: 'Seguranca armado',
    power: 10000,
    type: 'seguranca_armado',
    unlockLevel: 7,
  },
  {
    dailyCost: 100000,
    label: 'Mercenario',
    power: 25000,
    type: 'mercenario',
    unlockLevel: 9,
  },
] as const;
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
