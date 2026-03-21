import {
  type CharacterAppearance,
  type FactionRobberyPolicy,
  LevelTitle,
  type PlayerAttributes,
  type PlayerHospitalizationStatus,
  type PlayerPrisonStatus,
  RegionId,
  VocationType,
} from '../types.js';

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
