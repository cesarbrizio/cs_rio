import { type CharacterAppearance } from '@cs-rio/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const vocationEnum = pgEnum('vocation', [
  'cria',
  'gerente',
  'soldado',
  'politico',
  'empreendedor',
]);

export const regionEnum = pgEnum('region', [
  'zona_sul',
  'zona_norte',
  'centro',
  'zona_oeste',
  'zona_sudoeste',
  'baixada',
]);

export const crimeTypeEnum = pgEnum('crime_type', ['solo', 'faccao', 'territorial']);
export const inventoryEquipSlotEnum = pgEnum('inventory_equip_slot', ['weapon', 'vest']);
export const bichoBetModeEnum = pgEnum('bicho_bet_mode', ['cabeca', 'grupo', 'dezena']);
export const bichoBetStatusEnum = pgEnum('bicho_bet_status', ['pending', 'won', 'lost']);
export const marketAuctionNotificationTypeEnum = pgEnum('market_auction_notification_type', [
  'outbid',
  'returned',
  'sold',
  'won',
]);
export const marketAuctionStatusEnum = pgEnum('market_auction_status', ['open', 'settled', 'expired']);
export const marketOrderSideEnum = pgEnum('market_order_side', ['buy', 'sell']);
export const marketOrderStatusEnum = pgEnum('market_order_status', ['open', 'filled', 'cancelled']);
export const serviceTypeEnum = pgEnum('service_type', [
  'gatonet',
  'tvgato',
  'botijao_gas',
  'mototaxi',
  'van',
  'comercio_local',
]);
export const itemTypeEnum = pgEnum('item_type', [
  'weapon',
  'vest',
  'drug',
  'consumable',
  'boost',
  'component',
  'property_upgrade',
]);
export const propertyTypeEnum = pgEnum('property_type', [
  'boca',
  'factory',
  'puteiro',
  'rave',
  'house',
  'beach_house',
  'mansion',
  'car',
  'boat',
  'yacht',
  'jet_ski',
  'airplane',
  'helicopter',
  'jewelry',
  'art',
  'luxury',
  'front_store',
  'slot_machine',
]);
export const propertySabotageStateEnum = pgEnum('property_sabotage_state', [
  'normal',
  'damaged',
  'destroyed',
]);
export const propertySabotageOutcomeEnum = pgEnum('property_sabotage_outcome', [
  'damaged',
  'destroyed',
  'failure_clean',
  'failure_hard',
]);
export const propertySabotageOwnerAlertModeEnum = pgEnum('property_sabotage_owner_alert_mode', [
  'anonymous',
  'identified',
]);
export const gpTypeEnum = pgEnum('gp_type', [
  'novinha',
  'experiente',
  'premium',
  'vip',
  'diamante',
]);
export const puteiroGpStatusEnum = pgEnum('puteiro_gp_status', ['active', 'escaped', 'deceased']);
export const frontStoreKindEnum = pgEnum('front_store_kind', [
  'lava_rapido',
  'barbearia',
  'igreja',
  'acai',
  'oficina',
]);
export const frontStoreBatchStatusEnum = pgEnum('front_store_batch_status', [
  'pending',
  'completed',
  'seized',
]);
export const soldierTypeEnum = pgEnum('soldier_type', [
  'olheiro',
  'soldado_rua',
  'fogueteiro_alerta',
  'seguranca_armado',
  'mercenario',
]);
export const trainingTypeEnum = pgEnum('training_type', ['basic', 'advanced', 'intensive']);
export const universityCourseCodeEnum = pgEnum('university_course_code', [
  'mao_leve',
  'corrida_de_fuga',
  'olho_clinico',
  'rei_da_rua',
  'logistica_de_boca',
  'rede_de_distribuicao',
  'quimico_mestre',
  'magnata_do_po',
  'tiro_certeiro',
  'emboscada_perfeita',
  'instinto_de_sobrevivencia',
  'maquina_de_guerra',
  'labia_de_politico',
  'rede_de_contatos',
  'manipulacao_de_massa',
  'poderoso_chefao',
  'engenharia_financeira',
  'faro_para_negocios',
  'mercado_paralelo',
  'imperio_do_crime',
]);
export const factionRankEnum = pgEnum('faction_rank', [
  'patrao',
  'general',
  'gerente',
  'vapor',
  'soldado',
  'cria',
]);
export const factionBankEntryTypeEnum = pgEnum('faction_bank_entry_type', [
  'deposit',
  'withdrawal',
  'business_commission',
  'robbery_commission',
  'service_income',
]);
export const factionBankOriginTypeEnum = pgEnum('faction_bank_origin_type', [
  'manual',
  'bicho',
  'boca',
  'rave',
  'puteiro',
  'front_store',
  'robbery',
  'slot_machine',
  'favela_service',
  'propina',
  'upgrade',
]);
export const playerBankEntryTypeEnum = pgEnum('player_bank_entry_type', [
  'deposit',
  'withdrawal',
  'interest',
]);
export const upgradeTypeEnum = pgEnum('upgrade_type', [
  'mula_nivel_1',
  'mula_nivel_2',
  'mula_nivel_3',
  'mula_max',
  'bonus_atributos_5',
  'bonus_atributos_10',
  'arsenal_exclusivo',
  'exercito_expandido',
  'qg_fortificado',
]);
export const factionLeadershipElectionStatusEnum = pgEnum('faction_leadership_election_status', [
  'petitioning',
  'active',
  'resolved',
]);
export const favelaControlStateEnum = pgEnum('favela_control_state', [
  'neutral',
  'controlled',
  'at_war',
  'state',
]);
export const x9EventStatusEnum = pgEnum('x9_event_status', [
  'warning',
  'pending_desenrolo',
  'jailed',
  'resolved',
]);
export const warStatusEnum = pgEnum('war_status', [
  'declared',
  'preparing',
  'active',
  'attacker_won',
  'defender_won',
  'draw',
  'cancelled',
]);
export const roundStatusEnum = pgEnum('round_status', ['scheduled', 'active', 'finished']);
export const gameConfigStatusEnum = pgEnum('game_config_status', ['active', 'inactive']);
export const gameConfigScopeEnum = pgEnum('game_config_scope', [
  'global',
  'round',
  'region',
  'favela',
  'faction_template',
  'event_type',
  'robbery_type',
  'property_type',
  'service_type',
]);
export const configOperationTypeEnum = pgEnum('config_operation_type', [
  'activate_set',
  'upsert_set_entry',
  'upsert_round_override',
  'upsert_feature_flag',
  'upsert_round_feature_flag',
]);
export const tribunalCaseTypeEnum = pgEnum('tribunal_case_type', [
  'roubo_entre_moradores',
  'talaricagem',
  'divida_jogo',
  'divida_drogas',
  'estupro',
  'agressao',
  'homicidio_nao_autorizado',
]);
export const communitySupportsEnum = pgEnum('community_supports', ['accuser', 'accused']);
export const punishmentEnum = pgEnum('punishment', [
  'aviso',
  'surra',
  'expulsao',
  'matar',
  'esquartejar',
  'queimar_no_pneu',
]);
export const gameEventTypeEnum = pgEnum('game_event_type', [
  'navio_docas',
  'baile_cidade',
  'carnaval',
  'ano_novo_copa',
  'operacao_policial',
  'blitz_pm',
  'faca_na_caveira',
  'seca_drogas',
  'delacao_premiada',
  'saidinha_natal',
  'inspecao_trabalhista',
  'bonecas_china',
  'ressaca_baile',
  'tribunal_trafico',
  'chuva_verao',
  'operacao_verao',
]);
export const chatChannelTypeEnum = pgEnum('chat_channel_type', [
  'global',
  'local',
  'faction',
  'private',
  'trade',
]);
export const contactTypeEnum = pgEnum('contact_type', ['partner', 'known']);
export const assassinationStatusEnum = pgEnum('assassination_status', [
  'open',
  'accepted',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);
export const assassinationNotificationTypeEnum = pgEnum('assassination_notification_type', [
  'accepted',
  'completed',
  'expired',
  'target_warned',
]);
export const hospitalStatItemCodeEnum = pgEnum('hospital_stat_item_code', [
  'cerebrina',
  'pocao_carisma',
  'creatina',
  'deca_durabolin',
]);
export const banditReturnFlavorEnum = pgEnum('bandit_return_flavor', [
  'audiencia_custodia',
  'habeas_corpus',
  'lili_cantou',
]);
export const drugTypeEnum = pgEnum('drug_type', [
  'maconha',
  'lanca',
  'bala',
  'doce',
  'md',
  'cocaina',
  'crack',
]);

export const regions = pgTable('regions', {
  id: regionEnum('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  isDefaultSpawn: boolean('is_default_spawn').notNull().default(false),
  wealthIndex: integer('wealth_index').notNull(),
  wealthLabel: varchar('wealth_label', { length: 32 }).notNull().default('media'),
  densityIndex: integer('density_index').notNull(),
  densityLabel: varchar('density_label', { length: 32 }).notNull().default('media'),
  operationCostMultiplier: numeric('operation_cost_multiplier', {
    precision: 6,
    scale: 2,
  })
    .notNull()
    .default('1.00'),
  spawnPositionX: integer('spawn_position_x').notNull().default(0),
  spawnPositionY: integer('spawn_position_y').notNull().default(0),
  defaultPolicePressure: integer('default_police_pressure').notNull().default(50),
  policePressure: integer('police_pressure').notNull().default(50),
  dominationBonus: text('domination_bonus').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const factions = pgTable('factions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  abbreviation: varchar('abbreviation', { length: 12 }).notNull().unique(),
  templateCode: varchar('template_code', { length: 64 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  isFixed: boolean('is_fixed').notNull().default(false),
  leaderId: uuid('leader_id'),
  initialTerritory: text('initial_territory'),
  thematicBonus: text('thematic_bonus'),
  bankMoney: numeric('bank_money', { precision: 16, scale: 2 }).notNull().default('0'),
  bankDrugs: integer('bank_drugs').notNull().default(0),
  points: integer('points').notNull().default(0),
  internalSatisfaction: integer('internal_satisfaction').notNull().default(50),
  robberyPolicyJson: jsonb('robbery_policy_json').notNull().default({ global: 'allowed', regions: {} }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: varchar('nickname', { length: 32 }).notNull().unique(),
  vocation: vocationEnum('vocation').notNull(),
  level: integer('level').notNull().default(1),
  conceito: integer('conceito').notNull().default(0),
  forca: integer('forca').notNull().default(10),
  inteligencia: integer('inteligencia').notNull().default(10),
  resistencia: integer('resistencia').notNull().default(10),
  carisma: integer('carisma').notNull().default(10),
  cansaco: integer('cansaco').notNull().default(100),
  disposicao: integer('disposicao').notNull().default(100),
  brisa: integer('brisa').notNull().default(100),
  hp: integer('hp').notNull().default(100),
  addiction: integer('addiction').notNull().default(0),
  money: numeric('money', { precision: 16, scale: 2 }).notNull().default('0'),
  bankMoney: numeric('bank_money', { precision: 16, scale: 2 }).notNull().default('0'),
  bankInterestSyncedAt: timestamp('bank_interest_synced_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  credits: integer('credits').notNull().default(0),
  healthPlanCycleKey: varchar('health_plan_cycle_key', { length: 32 }),
  regionId: regionEnum('region_id').notNull(),
  positionX: integer('position_x').notNull().default(0),
  positionY: integer('position_y').notNull().default(0),
  factionId: uuid('faction_id'),
  appearanceJson: jsonb('appearance_json')
    .$type<CharacterAppearance>()
    .notNull()
    .default({
      skin: 'pele_media',
      hair: 'corte_curto',
      outfit: 'camisa_branca',
    }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  characterCreatedAt: timestamp('character_created_at', { withTimezone: true }),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  vocationChangedAt: timestamp('vocation_changed_at', { withTimezone: true }),
  vocationTarget: vocationEnum('vocation_target'),
  vocationTransitionEndsAt: timestamp('vocation_transition_ends_at', { withTimezone: true }),
});

export const playerHospitalStatPurchases = pgTable(
  'player_hospital_stat_purchases',
  {
    playerId: uuid('player_id').notNull(),
    cycleKey: varchar('cycle_key', { length: 32 }).notNull(),
    itemCode: hospitalStatItemCodeEnum('item_code').notNull(),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.cycleKey, table.itemCode] }),
  }),
);

export const playerBankDailyDeposits = pgTable(
  'player_bank_daily_deposits',
  {
    playerId: uuid('player_id').notNull(),
    cycleKey: varchar('cycle_key', { length: 16 }).notNull(),
    depositedAmount: numeric('deposited_amount', { precision: 16, scale: 2 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.cycleKey] }),
  }),
);

export const playerBankLedger = pgTable('player_bank_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  entryType: playerBankEntryTypeEnum('entry_type').notNull(),
  grossAmount: numeric('gross_amount', { precision: 16, scale: 2 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  netAmount: numeric('net_amount', { precision: 16, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 16, scale: 2 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favelas = pgTable('favelas', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  regionId: regionEnum('region_id').notNull(),
  population: integer('population').notNull(),
  difficulty: integer('difficulty').notNull(),
  maxSoldiers: integer('max_soldiers').notNull().default(20),
  baseBanditTarget: integer('base_bandit_target').notNull().default(26),
  banditsActive: integer('bandits_active').notNull().default(0),
  banditsArrested: integer('bandits_arrested').notNull().default(0),
  banditsDeadRecent: integer('bandits_dead_recent').notNull().default(0),
  banditsSyncedAt: timestamp('bandits_synced_at', { withTimezone: true }).notNull().defaultNow(),
  state: favelaControlStateEnum('state').notNull().default('neutral'),
  controllingFactionId: uuid('controlling_faction_id'),
  contestingFactionId: uuid('contesting_faction_id'),
  warDeclaredAt: timestamp('war_declared_at', { withTimezone: true }),
  stabilizationEndsAt: timestamp('stabilization_ends_at', { withTimezone: true }),
  defaultSatisfaction: integer('default_satisfaction').notNull().default(50),
  satisfaction: integer('satisfaction').notNull().default(50),
  satisfactionSyncedAt: timestamp('satisfaction_synced_at', { withTimezone: true }).notNull().defaultNow(),
  lastX9RollAt: timestamp('last_x9_roll_at', { withTimezone: true }).notNull().defaultNow(),
  propinaValue: numeric('propina_value', { precision: 16, scale: 2 }).notNull().default('0'),
  propinaDueDate: timestamp('propina_due_date', { withTimezone: true }),
  propinaDiscountRate: numeric('propina_discount_rate', { precision: 6, scale: 4 })
    .notNull()
    .default('0'),
  propinaLastPaidAt: timestamp('propina_last_paid_at', { withTimezone: true }),
  propinaNegotiatedAt: timestamp('propina_negotiated_at', { withTimezone: true }),
  propinaNegotiatedByPlayerId: uuid('propina_negotiated_by_player_id'),
  stateControlledUntil: timestamp('state_controlled_until', { withTimezone: true }),
});

export const favelaServices = pgTable('favela_services', {
  id: uuid('id').defaultRandom().primaryKey(),
  favelaId: uuid('favela_id').notNull(),
  serviceType: serviceTypeEnum('service_type').notNull(),
  level: integer('level').notNull().default(1),
  active: boolean('active').notNull().default(true),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 }).notNull().default('0'),
  lastRevenueAt: timestamp('last_revenue_at', { withTimezone: true }).notNull().defaultNow(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favelaBanditReturns = pgTable('favela_bandit_returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  favelaId: uuid('favela_id').notNull(),
  quantity: integer('quantity').notNull(),
  returnFlavor: banditReturnFlavorEnum('return_flavor').notNull(),
  releaseAt: timestamp('release_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weapons = pgTable('weapons', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  power: integer('power').notNull(),
  durabilityMax: integer('durability_max').notNull(),
  levelRequired: integer('level_required').notNull(),
  price: numeric('price', { precision: 16, scale: 2 }).notNull(),
  weight: integer('weight').notNull().default(1),
});

export const vests = pgTable('vests', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  defense: integer('defense').notNull(),
  durabilityMax: integer('durability_max').notNull(),
  levelRequired: integer('level_required').notNull(),
  price: numeric('price', { precision: 16, scale: 2 }).notNull(),
  weight: integer('weight').notNull().default(1),
});

export const soldierTemplates = pgTable('soldier_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  type: soldierTypeEnum('type').notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  power: integer('power').notNull(),
  dailyCost: numeric('daily_cost', { precision: 16, scale: 2 }).notNull(),
  levelRequired: integer('level_required').notNull(),
});

export const playerInventory = pgTable('player_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id'),
  quantity: integer('quantity').notNull().default(1),
  durability: integer('durability'),
  proficiency: integer('proficiency').notNull().default(0),
  equippedSlot: inventoryEquipSlotEnum('equipped_slot'),
});

export const crimes = pgTable('crimes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull().unique(),
  crimeType: crimeTypeEnum('crime_type').notNull().default('solo'),
  levelRequired: integer('level_required').notNull(),
  cansacoCost: integer('cansaco_cost').notNull(),
  disposicaoCost: integer('disposicao_cost').notNull().default(0),
  minPower: integer('min_power').notNull(),
  rewardMin: numeric('reward_min', { precision: 16, scale: 2 }).notNull(),
  rewardMax: numeric('reward_max', { precision: 16, scale: 2 }).notNull(),
  conceitoReward: integer('conceito_reward').notNull(),
  arrestChance: integer('arrest_chance').notNull(),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(0),
});

export const drugs = pgTable('drugs', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  type: drugTypeEnum('type').notNull().unique(),
  cansacoRecovery: integer('cansaco_recovery').notNull(),
  brisaBoost: integer('brisa_boost').notNull(),
  price: numeric('price', { precision: 16, scale: 2 }).notNull(),
  addictionRate: numeric('addiction_rate', { precision: 6, scale: 2 }).notNull(),
  disposicaoBoost: integer('disposicao_boost').notNull().default(0),
  productionLevel: integer('production_level').notNull(),
  weight: integer('weight').notNull().default(1),
});

export const components = pgTable('components', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  price: numeric('price', { precision: 16, scale: 2 }).notNull(),
  weight: integer('weight').notNull().default(1),
});

export const drugFactoryRecipes = pgTable('drug_factory_recipes', {
  drugId: uuid('drug_id').notNull().primaryKey(),
  baseProduction: integer('base_production').notNull(),
  cycleMinutes: integer('cycle_minutes').notNull().default(60),
  dailyMaintenanceCost: numeric('daily_maintenance_cost', { precision: 16, scale: 2 }).notNull(),
});

export const drugFactoryRecipeComponents = pgTable(
  'drug_factory_recipe_components',
  {
    drugId: uuid('drug_id').notNull(),
    componentId: uuid('component_id').notNull(),
    quantityRequired: integer('quantity_required').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.drugId, table.componentId] }),
  }),
);

export const properties = pgTable('properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  type: propertyTypeEnum('type').notNull(),
  regionId: regionEnum('region_id').notNull(),
  favelaId: uuid('favela_id'),
  level: integer('level').notNull().default(1),
  soldiersCount: integer('soldiers_count').notNull().default(0),
  lastMaintenanceAt: timestamp('last_maintenance_at', { withTimezone: true }).notNull().defaultNow(),
  suspended: boolean('suspended').notNull().default(false),
  sabotageState: propertySabotageStateEnum('sabotage_state').notNull().default('normal'),
  sabotageResolvedAt: timestamp('sabotage_resolved_at', { withTimezone: true }),
  sabotageRecoveryReadyAt: timestamp('sabotage_recovery_ready_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trainingSessions = pgTable('training_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  type: trainingTypeEnum('type').notNull(),
  costMoney: numeric('cost_money', { precision: 16, scale: 2 }).notNull(),
  costCansaco: integer('cost_cansaco').notNull(),
  diminishingMultiplier: numeric('diminishing_multiplier', { precision: 6, scale: 4 }).notNull(),
  streakIndex: integer('streak_index').notNull().default(0),
  forcaGain: integer('forca_gain').notNull(),
  inteligenciaGain: integer('inteligencia_gain').notNull(),
  resistenciaGain: integer('resistencia_gain').notNull(),
  carismaGain: integer('carisma_gain').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const universityEnrollments = pgTable('university_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  courseCode: universityCourseCodeEnum('course_code').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const drugFactories = pgTable('drug_factories', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  drugId: uuid('drug_id').notNull(),
  storedOutput: integer('stored_output').notNull().default(0),
  lastCycleAt: timestamp('last_cycle_at', { withTimezone: true }).notNull(),
  lastMaintenanceAt: timestamp('last_maintenance_at', { withTimezone: true }).notNull(),
  impulseMultiplier: numeric('impulse_multiplier', { precision: 6, scale: 2 })
    .notNull()
    .default('1.00'),
  suspended: boolean('suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bocaOperations = pgTable('boca_operations', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  cashBalance: numeric('cash_balance', { precision: 16, scale: 2 }).notNull().default('0'),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  factionCommissionTotal: numeric('faction_commission_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  lastSaleAt: timestamp('last_sale_at', { withTimezone: true }).notNull(),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bocaDrugStocks = pgTable(
  'boca_drug_stocks',
  {
    propertyId: uuid('property_id').notNull(),
    drugId: uuid('drug_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.propertyId, table.drugId] }),
  }),
);

export const raveOperations = pgTable('rave_operations', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  cashBalance: numeric('cash_balance', { precision: 16, scale: 2 }).notNull().default('0'),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  factionCommissionTotal: numeric('faction_commission_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  lastSaleAt: timestamp('last_sale_at', { withTimezone: true }).notNull(),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const raveDrugLineups = pgTable(
  'rave_drug_lineups',
  {
    propertyId: uuid('property_id').notNull(),
    drugId: uuid('drug_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
    priceMultiplier: numeric('price_multiplier', { precision: 6, scale: 2 }).notNull().default('1.55'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.propertyId, table.drugId] }),
  }),
);

export const puteiroOperations = pgTable('puteiro_operations', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  cashBalance: numeric('cash_balance', { precision: 16, scale: 2 }).notNull().default('0'),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  factionCommissionTotal: numeric('faction_commission_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  totalEscapes: integer('total_escapes').notNull().default(0),
  totalDeaths: integer('total_deaths').notNull().default(0),
  totalDstIncidents: integer('total_dst_incidents').notNull().default(0),
  lastRevenueAt: timestamp('last_revenue_at', { withTimezone: true }).notNull(),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const puteiroGps = pgTable('puteiro_gps', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  type: gpTypeEnum('type').notNull(),
  status: puteiroGpStatusEnum('status').notNull().default('active'),
  hasDst: boolean('has_dst').notNull().default(false),
  dstRecoversAt: timestamp('dst_recovers_at', { withTimezone: true }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  lastIncidentAt: timestamp('last_incident_at', { withTimezone: true }),
});

export const frontStoreOperations = pgTable('front_store_operations', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  storeKind: frontStoreKindEnum('store_kind'),
  cashBalance: numeric('cash_balance', { precision: 16, scale: 2 }).notNull().default('0'),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  factionCommissionTotal: numeric('faction_commission_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  totalLaunderedClean: numeric('total_laundered_clean', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  totalSeizedAmount: numeric('total_seized_amount', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  investigationsTotal: integer('investigations_total').notNull().default(0),
  lastRevenueAt: timestamp('last_revenue_at', { withTimezone: true }).notNull(),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
  investigationActiveUntil: timestamp('investigation_active_until', { withTimezone: true }),
  lastInvestigationAt: timestamp('last_investigation_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const frontStoreBatches = pgTable('front_store_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  investedAmount: numeric('invested_amount', { precision: 16, scale: 2 }).notNull(),
  expectedCleanReturn: numeric('expected_clean_return', { precision: 16, scale: 2 }).notNull(),
  resolvedCleanAmount: numeric('resolved_clean_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  seizedAmount: numeric('seized_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  investigationRisk: numeric('investigation_risk', { precision: 6, scale: 4 }).notNull(),
  status: frontStoreBatchStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completesAt: timestamp('completes_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const slotMachineOperations = pgTable('slot_machine_operations', {
  propertyId: uuid('property_id').notNull().primaryKey(),
  machinesInstalled: integer('machines_installed').notNull().default(0),
  houseEdge: numeric('house_edge', { precision: 6, scale: 4 }).notNull().default('0.2200'),
  jackpotChance: numeric('jackpot_chance', { precision: 6, scale: 4 }).notNull().default('0.0100'),
  minBet: numeric('min_bet', { precision: 16, scale: 2 }).notNull().default('100.00'),
  maxBet: numeric('max_bet', { precision: 16, scale: 2 }).notNull().default('1000.00'),
  cashBalance: numeric('cash_balance', { precision: 16, scale: 2 }).notNull().default('0'),
  grossRevenueTotal: numeric('gross_revenue_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  factionCommissionTotal: numeric('faction_commission_total', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  lastPlayAt: timestamp('last_play_at', { withTimezone: true }).notNull(),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bichoDraws = pgTable('bicho_draws', {
  id: uuid('id').defaultRandom().primaryKey(),
  sequence: integer('sequence').notNull(),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  winningAnimalNumber: integer('winning_animal_number'),
  winningDozen: integer('winning_dozen'),
  totalBetAmount: numeric('total_bet_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  totalPayoutAmount: numeric('total_payout_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bichoBets = pgTable('bicho_bets', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  drawId: uuid('draw_id').notNull(),
  mode: bichoBetModeEnum('mode').notNull(),
  animalNumber: integer('animal_number'),
  dozen: integer('dozen'),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  payout: numeric('payout', { precision: 16, scale: 2 }).notNull().default('0'),
  status: bichoBetStatusEnum('status').notNull().default('pending'),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});

export const drugFactoryComponentStocks = pgTable(
  'drug_factory_component_stocks',
  {
    propertyId: uuid('property_id').notNull(),
    componentId: uuid('component_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.propertyId, table.componentId] }),
  }),
);

export const soldiers = pgTable('soldiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  type: soldierTypeEnum('type').notNull(),
  power: integer('power').notNull(),
  dailyCost: numeric('daily_cost', { precision: 16, scale: 2 }).notNull(),
  hiredAt: timestamp('hired_at', { withTimezone: true }).notNull().defaultNow(),
});

export const propertySabotageLogs = pgTable('property_sabotage_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  attackerPlayerId: uuid('attacker_player_id').notNull(),
  attackerFactionId: uuid('attacker_faction_id'),
  ownerPlayerId: uuid('owner_player_id').notNull(),
  ownerFactionId: uuid('owner_faction_id'),
  regionId: regionEnum('region_id').notNull(),
  favelaId: uuid('favela_id'),
  type: propertyTypeEnum('type').notNull(),
  outcome: propertySabotageOutcomeEnum('outcome').notNull(),
  ownerAlertMode: propertySabotageOwnerAlertModeEnum('owner_alert_mode').notNull(),
  attackScore: numeric('attack_score', { precision: 10, scale: 2 }).notNull(),
  defenseScore: numeric('defense_score', { precision: 10, scale: 2 }).notNull(),
  attackRatio: numeric('attack_ratio', { precision: 10, scale: 4 }).notNull(),
  heatDelta: integer('heat_delta').notNull().default(0),
  prisonMinutes: integer('prison_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const marketOrders = pgTable('market_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  side: marketOrderSideEnum('side').notNull(),
  status: marketOrderStatusEnum('status').notNull().default('open'),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  quantity: integer('quantity').notNull(),
  remainingQuantity: integer('remaining_quantity').notNull(),
  pricePerUnit: numeric('price_per_unit', { precision: 16, scale: 2 }).notNull(),
  durabilitySnapshot: integer('durability_snapshot'),
  proficiencySnapshot: integer('proficiency_snapshot').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const marketSystemOffers = pgTable(
  'market_system_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 120 }).notNull().unique(),
    itemType: itemTypeEnum('item_type').notNull(),
    itemId: uuid('item_id').notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    pricePerUnit: numeric('price_per_unit', { precision: 16, scale: 2 }).notNull(),
    stockAvailable: integer('stock_available').notNull().default(0),
    stockMax: integer('stock_max').notNull(),
    restockAmount: integer('restock_amount').notNull(),
    restockIntervalGameDays: integer('restock_interval_game_days').notNull().default(1),
    lastRestockedRoundId: uuid('last_restocked_round_id'),
    lastRestockedGameDay: integer('last_restocked_game_day').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nonNegativeStockAvailableCheck: check(
      'market_system_offers_stock_available_non_negative_chk',
      sql`${table.stockAvailable} >= 0`,
    ),
    positiveRestockAmountCheck: check(
      'market_system_offers_restock_amount_positive_chk',
      sql`${table.restockAmount} > 0`,
    ),
    positiveRestockIntervalCheck: check(
      'market_system_offers_restock_interval_positive_chk',
      sql`${table.restockIntervalGameDays} > 0`,
    ),
    positiveStockMaxCheck: check(
      'market_system_offers_stock_max_positive_chk',
      sql`${table.stockMax} > 0`,
    ),
    validStockWindowCheck: check(
      'market_system_offers_stock_available_within_max_chk',
      sql`${table.stockAvailable} <= ${table.stockMax}`,
    ),
  }),
);

export const marketAuctions = pgTable('market_auctions', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  status: marketAuctionStatusEnum('status').notNull().default('open'),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  startingBid: numeric('starting_bid', { precision: 16, scale: 2 }).notNull(),
  currentBid: numeric('current_bid', { precision: 16, scale: 2 }),
  buyoutPrice: numeric('buyout_price', { precision: 16, scale: 2 }),
  leadingBidderId: uuid('leading_bidder_id'),
  durabilitySnapshot: integer('durability_snapshot'),
  proficiencySnapshot: integer('proficiency_snapshot').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});

export const marketAuctionBids = pgTable('market_auction_bids', {
  id: uuid('id').defaultRandom().primaryKey(),
  auctionId: uuid('auction_id').notNull(),
  bidderPlayerId: uuid('bidder_player_id').notNull(),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const marketAuctionNotifications = pgTable('market_auction_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  auctionId: uuid('auction_id').notNull(),
  type: marketAuctionNotificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const round = pgTable('round', {
  id: uuid('id').defaultRandom().primaryKey(),
  number: integer('number').notNull().unique(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: roundStatusEnum('status').notNull().default('scheduled'),
});

export const gameConfigSets = pgTable('game_config_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  status: gameConfigStatusEnum('status').notNull().default('active'),
  isDefault: boolean('is_default').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameConfigEntries = pgTable(
  'game_config_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    configSetId: uuid('config_set_id').notNull(),
    scope: gameConfigScopeEnum('scope').notNull().default('global'),
    targetKey: varchar('target_key', { length: 120 }).notNull().default('*'),
    key: varchar('key', { length: 160 }).notNull(),
    valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull().default({}),
    status: gameConfigStatusEnum('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    effectiveWindowCheck: check(
      'game_config_entries_effective_window_chk',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    nonBlankTargetKeyCheck: check(
      'game_config_entries_target_key_non_blank_chk',
      sql`char_length(btrim(${table.targetKey})) > 0`,
    ),
    uniqueConfigKey: uniqueIndex('game_config_entries_config_scope_target_key_key_idx').on(
      table.configSetId,
      table.scope,
      table.targetKey,
      table.key,
    ),
  }),
);

export const roundConfigOverrides = pgTable(
  'round_config_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id').notNull(),
    scope: gameConfigScopeEnum('scope').notNull().default('global'),
    targetKey: varchar('target_key', { length: 120 }).notNull().default('*'),
    key: varchar('key', { length: 160 }).notNull(),
    valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull().default({}),
    status: gameConfigStatusEnum('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    effectiveWindowCheck: check(
      'round_config_overrides_effective_window_chk',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    nonBlankTargetKeyCheck: check(
      'round_config_overrides_target_key_non_blank_chk',
      sql`char_length(btrim(${table.targetKey})) > 0`,
    ),
    uniqueRoundOverrideKey: uniqueIndex('round_config_overrides_round_scope_target_key_key_idx').on(
      table.roundId,
      table.scope,
      table.targetKey,
      table.key,
    ),
  }),
);

export const roundFeatureFlagOverrides = pgTable(
  'round_feature_flag_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id').notNull(),
    scope: gameConfigScopeEnum('scope').notNull().default('global'),
    targetKey: varchar('target_key', { length: 120 }).notNull().default('*'),
    key: varchar('key', { length: 160 }).notNull(),
    status: gameConfigStatusEnum('status').notNull().default('inactive'),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    effectiveWindowCheck: check(
      'round_feature_flag_overrides_effective_window_chk',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    nonBlankTargetKeyCheck: check(
      'round_feature_flag_overrides_target_key_non_blank_chk',
      sql`char_length(btrim(${table.targetKey})) > 0`,
    ),
    uniqueRoundFeatureFlagOverrideKey: uniqueIndex(
      'round_feature_flag_overrides_round_scope_target_key_key_idx',
    ).on(table.roundId, table.scope, table.targetKey, table.key),
  }),
);

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    configSetId: uuid('config_set_id').notNull(),
    scope: gameConfigScopeEnum('scope').notNull().default('global'),
    targetKey: varchar('target_key', { length: 120 }).notNull().default('*'),
    key: varchar('key', { length: 160 }).notNull(),
    status: gameConfigStatusEnum('status').notNull().default('inactive'),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    effectiveWindowCheck: check(
      'feature_flags_effective_window_chk',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    nonBlankTargetKeyCheck: check(
      'feature_flags_target_key_non_blank_chk',
      sql`char_length(btrim(${table.targetKey})) > 0`,
    ),
    uniqueFeatureFlagKey: uniqueIndex('feature_flags_config_scope_target_key_key_idx').on(
      table.configSetId,
      table.scope,
      table.targetKey,
      table.key,
    ),
  }),
);

export const configRuntimeState = pgTable('config_runtime_state', {
  singletonKey: varchar('singleton_key', { length: 32 }).notNull().primaryKey(),
  version: integer('version').notNull().default(0),
  lastOperationId: uuid('last_operation_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const configOperationLogs = pgTable('config_operation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  operationType: configOperationTypeEnum('operation_type').notNull(),
  actor: varchar('actor', { length: 120 }).notNull().default('local'),
  origin: varchar('origin', { length: 120 }).notNull().default('manual_cli'),
  configSetId: uuid('config_set_id'),
  roundId: uuid('round_id'),
  affectedRecordId: uuid('affected_record_id'),
  scope: gameConfigScopeEnum('scope'),
  targetKey: varchar('target_key', { length: 120 }),
  key: varchar('key', { length: 160 }),
  status: gameConfigStatusEnum('status'),
  summary: text('summary').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  validationJson: jsonb('validation_json').$type<Record<string, unknown>>(),
  beforeJson: jsonb('before_json').$type<Record<string, unknown>>(),
  afterJson: jsonb('after_json').$type<Record<string, unknown>>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playerOperationLogs = pgTable('player_operation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  playerId: uuid('player_id').notNull(),
  actor: varchar('actor', { length: 120 }).notNull().default('local'),
  origin: varchar('origin', { length: 120 }).notNull().default('manual_cli'),
  operationType: varchar('operation_type', { length: 80 }).notNull(),
  summary: text('summary').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  beforeJson: jsonb('before_json').$type<Record<string, unknown>>(),
  afterJson: jsonb('after_json').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const worldOperationLogs = pgTable('world_operation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  actor: varchar('actor', { length: 120 }).notNull().default('local'),
  origin: varchar('origin', { length: 120 }).notNull().default('manual_cli'),
  operationType: varchar('operation_type', { length: 80 }).notNull(),
  targetType: varchar('target_type', { length: 80 }).notNull(),
  playerId: uuid('player_id'),
  factionId: uuid('faction_id'),
  favelaId: uuid('favela_id'),
  propertyId: uuid('property_id'),
  summary: text('summary').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  beforeJson: jsonb('before_json').$type<Record<string, unknown>>(),
  afterJson: jsonb('after_json').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roundOperationLogs = pgTable('round_operation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  actor: varchar('actor', { length: 120 }).notNull().default('local'),
  origin: varchar('origin', { length: 120 }).notNull().default('manual_cli'),
  operationType: varchar('operation_type', { length: 80 }).notNull(),
  roundId: uuid('round_id'),
  eventType: gameEventTypeEnum('event_type'),
  regionId: regionEnum('region_id'),
  favelaId: uuid('favela_id'),
  summary: text('summary').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  beforeJson: jsonb('before_json').$type<Record<string, unknown>>(),
  afterJson: jsonb('after_json').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roundRankings = pgTable(
  'round_rankings',
  {
    roundId: uuid('round_id').notNull(),
    playerId: uuid('player_id').notNull(),
    finalConceito: integer('final_conceito').notNull(),
    finalRank: integer('final_rank').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roundId, table.playerId] }),
  }),
);

export const factionMembers = pgTable(
  'faction_members',
  {
    playerId: uuid('player_id').notNull(),
    factionId: uuid('faction_id').notNull(),
    rank: factionRankEnum('rank').notNull().default('cria'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.factionId] }),
  }),
);

export const factionUpgrades = pgTable(
  'faction_upgrades',
  {
    factionId: uuid('faction_id').notNull(),
    upgradeType: upgradeTypeEnum('upgrade_type').notNull(),
    level: integer('level').notNull().default(1),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.factionId, table.upgradeType] }),
  }),
);

export const factionBankLedger = pgTable('faction_bank_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  factionId: uuid('faction_id').notNull(),
  playerId: uuid('player_id'),
  propertyId: uuid('property_id'),
  entryType: factionBankEntryTypeEnum('entry_type').notNull(),
  originType: factionBankOriginTypeEnum('origin_type').notNull(),
  grossAmount: numeric('gross_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  commissionAmount: numeric('commission_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  netAmount: numeric('net_amount', { precision: 16, scale: 2 }).notNull().default('0'),
  balanceAfter: numeric('balance_after', { precision: 16, scale: 2 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const factionLeadershipElections = pgTable('faction_leadership_elections', {
  id: uuid('id').defaultRandom().primaryKey(),
  factionId: uuid('faction_id').notNull(),
  requestedByPlayerId: uuid('requested_by_player_id'),
  status: factionLeadershipElectionStatusEnum('status').notNull().default('petitioning'),
  supportThreshold: integer('support_threshold').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  cooldownEndsAt: timestamp('cooldown_ends_at', { withTimezone: true }),
  winnerPlayerId: uuid('winner_player_id'),
});

export const factionLeadershipElectionSupports = pgTable(
  'faction_leadership_election_supports',
  {
    electionId: uuid('election_id').notNull(),
    playerId: uuid('player_id').notNull(),
    supportedAt: timestamp('supported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.electionId, table.playerId] }),
  }),
);

export const factionLeadershipElectionVotes = pgTable(
  'faction_leadership_election_votes',
  {
    electionId: uuid('election_id').notNull(),
    voterPlayerId: uuid('voter_player_id').notNull(),
    candidatePlayerId: uuid('candidate_player_id').notNull(),
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.electionId, table.voterPlayerId] }),
  }),
);

export const factionLeadershipChallenges = pgTable('faction_leadership_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  factionId: uuid('faction_id').notNull(),
  challengerPlayerId: uuid('challenger_player_id').notNull(),
  challengerWon: boolean('challenger_won').notNull(),
  challengerPower: integer('challenger_power').notNull(),
  defenderPlayerId: uuid('defender_player_id'),
  defenderWasNpc: boolean('defender_was_npc').notNull().default(false),
  defenderPower: integer('defender_power').notNull(),
  successChancePercent: integer('success_chance_percent').notNull(),
  challengerHpDelta: integer('challenger_hp_delta').notNull(),
  challengerConceitoDelta: integer('challenger_conceito_delta').notNull(),
  defenderHpDelta: integer('defender_hp_delta').notNull(),
  defenderConceitoDelta: integer('defender_conceito_delta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }).notNull(),
  cooldownEndsAt: timestamp('cooldown_ends_at', { withTimezone: true }).notNull(),
});

export const factionWars = pgTable('faction_wars', {
  id: uuid('id').defaultRandom().primaryKey(),
  attackerFactionId: uuid('attacker_faction_id').notNull(),
  defenderFactionId: uuid('defender_faction_id').notNull(),
  favelaId: uuid('favela_id').notNull(),
  status: warStatusEnum('status').notNull().default('declared'),
  declaredByPlayerId: uuid('declared_by_player_id'),
  declaredAt: timestamp('declared_at', { withTimezone: true }).notNull().defaultNow(),
  preparationEndsAt: timestamp('preparation_ends_at', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  nextRoundAt: timestamp('next_round_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  cooldownEndsAt: timestamp('cooldown_ends_at', { withTimezone: true }),
  winnerFactionId: uuid('winner_faction_id'),
  attackerPreparationJson: jsonb('attacker_preparation_json').notNull().default({}),
  defenderPreparationJson: jsonb('defender_preparation_json').notNull().default({}),
  roundResultsJson: jsonb('round_results_json').notNull().default([]),
  attackerScore: integer('attacker_score').notNull().default(0),
  defenderScore: integer('defender_score').notNull().default(0),
  roundsResolved: integer('rounds_resolved').notNull().default(0),
  roundsTotal: integer('rounds_total').notNull().default(3),
  lootMoney: numeric('loot_money', { precision: 16, scale: 2 }).notNull().default('0'),
});

export const propinaPayments = pgTable('propina_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  factionId: uuid('faction_id').notNull(),
  favelaId: uuid('favela_id').notNull(),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  nextDue: timestamp('next_due', { withTimezone: true }).notNull(),
});

export const favelaBailes = pgTable('favela_bailes', {
  id: uuid('id').defaultRandom().primaryKey(),
  favelaId: uuid('favela_id').notNull(),
  factionId: uuid('faction_id').notNull(),
  organizedByPlayerId: uuid('organized_by_player_id').notNull(),
  budget: numeric('budget', { precision: 16, scale: 2 }).notNull(),
  entryPrice: numeric('entry_price', { precision: 16, scale: 2 }).notNull(),
  mcTier: varchar('mc_tier', { length: 24 }).notNull(),
  resultTier: varchar('result_tier', { length: 24 }).notNull(),
  satisfactionDelta: integer('satisfaction_delta').notNull(),
  factionPointsDelta: integer('faction_points_delta').notNull(),
  cansacoBoostPercent: integer('cansaco_boost_percent').notNull(),
  incidentCode: varchar('incident_code', { length: 40 }),
  organizedAt: timestamp('organized_at', { withTimezone: true }).notNull().defaultNow(),
  baileEndsAt: timestamp('baile_ends_at', { withTimezone: true }),
  hangoverEndsAt: timestamp('hangover_ends_at', { withTimezone: true }),
  cooldownEndsAt: timestamp('cooldown_ends_at', { withTimezone: true }).notNull(),
});

export const x9Events = pgTable('x9_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  favelaId: uuid('favela_id').notNull(),
  status: x9EventStatusEnum('status').notNull().default('warning'),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  warningEndsAt: timestamp('warning_ends_at', { withTimezone: true }),
  incursionAt: timestamp('incursion_at', { withTimezone: true }),
  soldiersArrested: integer('soldiers_arrested').notNull().default(0),
  soldiersReleaseAt: timestamp('soldiers_release_at', { withTimezone: true }),
  drugsLost: integer('drugs_lost').notNull().default(0),
  weaponsLost: integer('weapons_lost').notNull().default(0),
  moneyLost: numeric('money_lost', { precision: 16, scale: 2 }).notNull().default('0'),
  soldierImpactJson: jsonb('soldier_impact_json').notNull().default([]),
  desenroloBaseMoneyCost: numeric('desenrolo_base_money_cost', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  desenroloBasePointsCost: integer('desenrolo_base_points_cost').notNull().default(0),
  desenroloMoneySpent: numeric('desenrolo_money_spent', { precision: 16, scale: 2 })
    .notNull()
    .default('0'),
  desenroloPointsSpent: integer('desenrolo_points_spent').notNull().default(0),
  desenroloNegotiatorPlayerId: uuid('desenrolo_negotiator_player_id'),
  desenroloAttemptedAt: timestamp('desenrolo_attempted_at', { withTimezone: true }),
  desenroloSucceeded: boolean('desenrolo_succeeded'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const tribunalCases = pgTable('tribunal_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  favelaId: uuid('favela_id').notNull(),
  caseType: tribunalCaseTypeEnum('case_type').notNull(),
  accuserName: varchar('accuser_name', { length: 120 }).notNull(),
  accusedName: varchar('accused_name', { length: 120 }).notNull(),
  accuserCharismaCommunity: integer('accuser_charisma_community').notNull(),
  accuserCharismaFaction: integer('accuser_charisma_faction').notNull(),
  accusedCharismaCommunity: integer('accused_charisma_community').notNull(),
  accusedCharismaFaction: integer('accused_charisma_faction').notNull(),
  accuserStatement: text('accuser_statement').notNull(),
  accusedStatement: text('accused_statement').notNull(),
  communitySupports: communitySupportsEnum('community_supports').notNull(),
  truthSide: communitySupportsEnum('truth_side').notNull(),
  antigaoHint: text('antigao_hint').notNull(),
  antigaoSuggestedPunishment: punishmentEnum('antigao_suggested_punishment').notNull(),
  punishmentChosen: punishmentEnum('punishment_chosen'),
  moralMoradoresImpact: integer('moral_moradores_impact'),
  moralFacaoImpact: integer('moral_facao_impact'),
  conceitoImpact: integer('conceito_impact'),
  judgedBy: uuid('judged_by'),
  judgedAt: timestamp('judged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameEvents = pgTable('game_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: gameEventTypeEnum('event_type').notNull(),
  regionId: regionEnum('region_id'),
  favelaId: uuid('favela_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  dataJson: jsonb('data_json').notNull().default({}),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelType: chatChannelTypeEnum('channel_type').notNull(),
  channelId: varchar('channel_id', { length: 120 }).notNull(),
  senderId: uuid('sender_id').notNull(),
  message: text('message').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable(
  'contacts',
  {
    playerId: uuid('player_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    type: contactTypeEnum('type').notNull(),
    since: timestamp('since', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.contactId] }),
  }),
);

export const assassinationContracts = pgTable('assassination_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  requesterId: uuid('requester_id').notNull(),
  targetId: uuid('target_id').notNull(),
  reward: numeric('reward', { precision: 16, scale: 2 }).notNull(),
  acceptedBy: uuid('accepted_by'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  status: assassinationStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const assassinationContractNotifications = pgTable('assassination_contract_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  contractId: uuid('contract_id').notNull(),
  playerId: uuid('player_id').notNull(),
  type: assassinationNotificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const prisonRecords = pgTable('prison_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  reason: text('reason').notNull(),
  sentencedAt: timestamp('sentenced_at', { withTimezone: true }).notNull(),
  releaseAt: timestamp('release_at', { withTimezone: true }).notNull(),
  allowBribe: boolean('allow_bribe').notNull().default(true),
  allowBail: boolean('allow_bail').notNull().default(true),
  allowEscape: boolean('allow_escape').notNull().default(true),
  allowFactionRescue: boolean('allow_faction_rescue').notNull().default(true),
  escapeAttemptedAt: timestamp('escape_attempted_at', { withTimezone: true }),
  releasedEarlyBy: uuid('released_early_by'),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull(),
  type: varchar('type', { length: 80 }).notNull(),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
