import {
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_EMAIL_PATTERN,
  AUTH_NICKNAME_MAX_LENGTH,
  AUTH_NICKNAME_MIN_LENGTH,
  AUTH_NICKNAME_PATTERN,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  BICHO_MAX_BET,
  BICHO_MIN_BET,
  DEFAULT_TOKEN_MAX_LENGTH,
  MARKET_AUCTION_MAX_DURATION_MINUTES,
  MARKET_AUCTION_MIN_DURATION_MINUTES,
  PRIVATE_MESSAGE_MAX_LENGTH,
  NON_EMPTY_TOKEN_PATTERN,
  RAVE_MAX_PRICE_MULTIPLIER,
  RAVE_MIN_PRICE_MULTIPLIER,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import { type FastifySchema } from 'fastify';

type JsonSchema = Record<string, unknown>;

const BAILE_MAX_BUDGET = 100_000;
const BAILE_MIN_BUDGET = 10_000;
const DEFAULT_DESCRIPTION_MAX_LENGTH = 500;
const DEFAULT_ID_MAX_LENGTH = DEFAULT_TOKEN_MAX_LENGTH;
const DEFAULT_TEXT_MAX_LENGTH = 240;
const FACTION_ABBREVIATION_MAX_LENGTH = 12;
const FACTION_ABBREVIATION_MIN_LENGTH = 2;
const FACTION_NAME_MAX_LENGTH = 120;
const FACTION_NAME_MIN_LENGTH = 3;
const FACTION_WAR_MAX_PREPARATION_BUDGET = 100_000;
const FACTION_WAR_MAX_SOLDIER_COMMITMENT = 20;
const MONEY_MAX = 1_000_000_000;

const FACTION_RANK_VALUES = ['patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria'] as const;
const FACTION_ROBBERY_POLICY_MODE_VALUES = ['allowed', 'forbidden'] as const;
const FACTION_UPGRADE_TYPE_VALUES = [
  'mula_nivel_1',
  'mula_nivel_2',
  'mula_nivel_3',
  'mula_max',
  'bonus_atributos_5',
  'bonus_atributos_10',
  'arsenal_exclusivo',
  'exercito_expandido',
  'qg_fortificado',
] as const;
const FAVELA_BAILE_MC_TIER_VALUES = ['local', 'regional', 'estelar'] as const;
const FAVELA_SERVICE_TYPE_VALUES = ['gatonet', 'tvgato', 'botijao_gas', 'mototaxi', 'van', 'comercio_local'] as const;
const FAVELA_STATE_TRANSITION_ACTION_VALUES = ['declare_war', 'attacker_win', 'defender_hold'] as const;
const FRONT_STORE_KIND_VALUES = ['lava_rapido', 'barbearia', 'igreja', 'acai', 'oficina'] as const;
const GP_TYPE_VALUES = ['novinha', 'experiente', 'premium', 'vip', 'diamante'] as const;
const HOSPITAL_STAT_ITEM_CODE_VALUES = ['cerebrina', 'pocao_carisma', 'creatina', 'deca_durabolin'] as const;
const INVENTORY_ITEM_TYPE_VALUES = [
  'weapon',
  'vest',
  'drug',
  'consumable',
  'boost',
  'component',
  'property_upgrade',
] as const;
const MARKET_AUCTION_ITEM_TYPE_VALUES = ['weapon', 'vest'] as const;
const MARKET_ORDER_SIDE_VALUES = ['buy', 'sell'] as const;
const BICHO_BET_MODE_VALUES = ['cabeca', 'grupo', 'dezena'] as const;
const CONTACT_TYPE_VALUES = ['partner', 'known'] as const;
const DRUG_SALE_CHANNEL_VALUES = ['street', 'boca', 'rave', 'docks'] as const;
const PROPERTY_TYPE_VALUES = [
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
] as const;
const ROBBERY_EXECUTOR_TYPE_VALUES = ['player', 'bandits'] as const;
const ROBBERY_TYPE_VALUES = ['pedestrian', 'cellphones', 'vehicle', 'truck'] as const;
const SLOT_MACHINE_MIN_INSTALL_QUANTITY = 1;
const SLOT_MACHINE_MAX_INSTALL_QUANTITY = 500;
const SOLDIER_TYPE_VALUES = [
  'olheiro',
  'soldado_rua',
  'fogueteiro_alerta',
  'seguranca_armado',
  'mercenario',
] as const;
const TRAINING_TYPE_VALUES = ['basic', 'advanced', 'intensive'] as const;
const TRIBUNAL_PUNISHMENT_VALUES = [
  'aviso',
  'surra',
  'expulsao',
  'matar',
  'esquartejar',
  'queimar_no_pneu',
] as const;
const UNIVERSITY_COURSE_CODE_VALUES = [
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
] as const;
const VEHICLE_ROBBERY_ROUTE_VALUES = ['ransom', 'chop_shop', 'paraguay'] as const;

export const genericErrorResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    category: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
  },
  required: ['message'],
} satisfies JsonSchema;

export const genericObjectResponseSchema = {
  type: 'object',
  additionalProperties: true,
} satisfies JsonSchema;

export const emailSchema = {
  type: 'string',
  format: 'email',
  maxLength: AUTH_EMAIL_MAX_LENGTH,
  pattern: AUTH_EMAIL_PATTERN.source,
} satisfies JsonSchema;

export const nicknameSchema = {
  type: 'string',
  minLength: AUTH_NICKNAME_MIN_LENGTH,
  maxLength: AUTH_NICKNAME_MAX_LENGTH,
  pattern: AUTH_NICKNAME_PATTERN.source,
} satisfies JsonSchema;

export const optionalNicknameSchema = {
  ...nicknameSchema,
  nullable: true,
} satisfies JsonSchema;

export const passwordSchema = {
  type: 'string',
  minLength: AUTH_PASSWORD_MIN_LENGTH,
  maxLength: AUTH_PASSWORD_MAX_LENGTH,
} satisfies JsonSchema;

export const regionIdSchema = enumSchema(Object.values(RegionId));
export const vocationSchema = enumSchema(Object.values(VocationType));
export const playerContactTypeSchema = enumSchema(CONTACT_TYPE_VALUES);
export const inventoryItemTypeSchema = enumSchema(INVENTORY_ITEM_TYPE_VALUES);
export const marketAuctionItemTypeSchema = enumSchema(MARKET_AUCTION_ITEM_TYPE_VALUES);
export const marketOrderSideSchema = enumSchema(MARKET_ORDER_SIDE_VALUES);
export const factionUpgradeTypeSchema = enumSchema(FACTION_UPGRADE_TYPE_VALUES);
export const favelaServiceTypeSchema = enumSchema(FAVELA_SERVICE_TYPE_VALUES);
export const favelaStateTransitionActionSchema = enumSchema(FAVELA_STATE_TRANSITION_ACTION_VALUES);
export const favelaBaileMcTierSchema = enumSchema(FAVELA_BAILE_MC_TIER_VALUES);
export const hospitalStatItemCodeSchema = enumSchema(HOSPITAL_STAT_ITEM_CODE_VALUES);
export const factionRobberyPolicyModeSchema = enumSchema(FACTION_ROBBERY_POLICY_MODE_VALUES);
export const factionRankSchema = enumSchema(FACTION_RANK_VALUES);
export const bichoBetModeSchema = enumSchema(BICHO_BET_MODE_VALUES);
export const drugSaleChannelSchema = enumSchema(DRUG_SALE_CHANNEL_VALUES);
export const frontStoreKindSchema = enumSchema(FRONT_STORE_KIND_VALUES);
export const gpTypeSchema = enumSchema(GP_TYPE_VALUES);
export const propertyTypeSchema = enumSchema(PROPERTY_TYPE_VALUES);
export const robberyExecutorTypeSchema = enumSchema(ROBBERY_EXECUTOR_TYPE_VALUES);
export const robberyTypeSchema = enumSchema(ROBBERY_TYPE_VALUES);
export const soldierTypeSchema = enumSchema(SOLDIER_TYPE_VALUES);
export const trainingTypeSchema = enumSchema(TRAINING_TYPE_VALUES);
export const tribunalPunishmentSchema = enumSchema(TRIBUNAL_PUNISHMENT_VALUES);
export const universityCourseCodeSchema = enumSchema(UNIVERSITY_COURSE_CODE_VALUES);
export const vehicleRobberyRouteSchema = enumSchema(VEHICLE_ROBBERY_ROUTE_VALUES);

export const idSchema = tokenSchema();
export const optionalNullableIdSchema = {
  ...tokenSchema(),
  nullable: true,
} satisfies JsonSchema;

export const appearanceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['hair', 'outfit', 'skin'],
  properties: {
    hair: stringSchema(1, 64),
    outfit: stringSchema(1, 64),
    skin: stringSchema(1, 64),
  },
} satisfies JsonSchema;

export const registerBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'nickname', 'password'],
  properties: {
    email: emailSchema,
    nickname: nicknameSchema,
    password: passwordSchema,
  },
} satisfies JsonSchema;

export const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: emailSchema,
    password: passwordSchema,
  },
} satisfies JsonSchema;

export const refreshBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['refreshToken'],
  properties: {
    refreshToken: stringSchema(16, 4096),
  },
} satisfies JsonSchema;

export const playerCreationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['appearance', 'vocation'],
  properties: {
    appearance: appearanceSchema,
    vocation: vocationSchema,
  },
} satisfies JsonSchema;

export const playerTravelBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['regionId'],
  properties: {
    regionId: regionIdSchema,
  },
} satisfies JsonSchema;

export const playerVocationChangeBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['vocation'],
  properties: {
    vocation: vocationSchema,
  },
} satisfies JsonSchema;

export const marketOrderQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    itemId: stringSchema(),
    itemType: inventoryItemTypeSchema,
  },
} satisfies JsonSchema;

export const marketAuctionQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    itemId: stringSchema(),
    itemType: marketAuctionItemTypeSchema,
  },
} satisfies JsonSchema;

export const marketOrderCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['itemId', 'itemType', 'pricePerUnit', 'quantity', 'side'],
  properties: {
    inventoryItemId: optionalNullableIdSchema,
    itemId: stringSchema(),
    itemType: inventoryItemTypeSchema,
    pricePerUnit: positiveMoneySchema(),
    quantity: positiveIntegerSchema(1, 100_000),
    side: marketOrderSideSchema,
    systemOfferId: optionalNullableIdSchema,
  },
} satisfies JsonSchema;

export const marketAuctionCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['durationMinutes', 'inventoryItemId', 'itemId', 'itemType', 'startingBid'],
  properties: {
    buyoutPrice: nullableSchema(positiveMoneySchema()),
    durationMinutes: positiveIntegerSchema(
      MARKET_AUCTION_MIN_DURATION_MINUTES,
      MARKET_AUCTION_MAX_DURATION_MINUTES,
    ),
    inventoryItemId: stringSchema(),
    itemId: stringSchema(),
    itemType: marketAuctionItemTypeSchema,
    startingBid: positiveMoneySchema(),
  },
} satisfies JsonSchema;

export const marketAuctionBidBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount'],
  properties: {
    amount: positiveMoneySchema(),
  },
} satisfies JsonSchema;

export const factionCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['abbreviation', 'name'],
  properties: {
    abbreviation: stringSchema(FACTION_ABBREVIATION_MIN_LENGTH, FACTION_ABBREVIATION_MAX_LENGTH),
    description: nullableSchema(freeformStringSchema(DEFAULT_DESCRIPTION_MAX_LENGTH)),
    name: stringSchema(FACTION_NAME_MIN_LENGTH, FACTION_NAME_MAX_LENGTH),
  },
} satisfies JsonSchema;

export const factionRecruitBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nickname'],
  properties: {
    nickname: stringSchema(1, 32),
  },
} satisfies JsonSchema;

export const factionBankMovementBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount'],
  properties: {
    amount: positiveMoneySchema(),
    description: nullableSchema(freeformStringSchema(240)),
  },
} satisfies JsonSchema;

export const factionLeadershipVoteBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidatePlayerId'],
  properties: {
    candidatePlayerId: idSchema,
  },
} satisfies JsonSchema;

export const factionUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    abbreviation: stringSchema(FACTION_ABBREVIATION_MIN_LENGTH, FACTION_ABBREVIATION_MAX_LENGTH),
    description: nullableSchema(freeformStringSchema(DEFAULT_DESCRIPTION_MAX_LENGTH)),
    name: stringSchema(FACTION_NAME_MIN_LENGTH, FACTION_NAME_MAX_LENGTH),
  },
} satisfies JsonSchema;

export const factionRobberyPolicyUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    global: factionRobberyPolicyModeSchema,
    regions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        [RegionId.ZonaSul]: factionRobberyPolicyModeSchema,
        [RegionId.ZonaNorte]: factionRobberyPolicyModeSchema,
        [RegionId.Centro]: factionRobberyPolicyModeSchema,
        [RegionId.ZonaOeste]: factionRobberyPolicyModeSchema,
        [RegionId.ZonaSudoeste]: factionRobberyPolicyModeSchema,
        [RegionId.Baixada]: factionRobberyPolicyModeSchema,
      },
    },
  },
} satisfies JsonSchema;

export const favelaStateTransitionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: favelaStateTransitionActionSchema,
  },
} satisfies JsonSchema;

export const favelaConquestBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    participantIds: {
      type: 'array',
      items: idSchema,
      maxItems: 16,
      uniqueItems: true,
    },
  },
} satisfies JsonSchema;

export const favelaServiceInstallBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['serviceType'],
  properties: {
    serviceType: favelaServiceTypeSchema,
  },
} satisfies JsonSchema;

export const factionWarPrepareBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['budget', 'soldierCommitment'],
  properties: {
    budget: nonNegativeMoneySchema(FACTION_WAR_MAX_PREPARATION_BUDGET),
    soldierCommitment: positiveIntegerSchema(0, FACTION_WAR_MAX_SOLDIER_COMMITMENT),
  },
} satisfies JsonSchema;

export const favelaBaileOrganizeBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['budget', 'entryPrice', 'mcTier'],
  properties: {
    budget: numberSchema(BAILE_MIN_BUDGET, BAILE_MAX_BUDGET),
    entryPrice: nonNegativeMoneySchema(10_000),
    mcTier: favelaBaileMcTierSchema,
  },
} satisfies JsonSchema;

export const hospitalSurgeryBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    appearance: appearanceSchema,
    nickname: nicknameSchema,
  },
} satisfies JsonSchema;

export const hospitalStatPurchaseBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['itemCode'],
  properties: {
    itemCode: hospitalStatItemCodeSchema,
  },
} satisfies JsonSchema;

export const playerBankMovementBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount'],
  properties: {
    amount: positiveMoneySchema(),
  },
} satisfies JsonSchema;

export const playerPublicProfileParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nickname'],
  properties: {
    nickname: nicknameSchema,
  },
} satisfies JsonSchema;

export const playerContactCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nickname', 'type'],
  properties: {
    nickname: nicknameSchema,
    type: playerContactTypeSchema,
  },
} satisfies JsonSchema;

export const playerContactParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contactId'],
  properties: {
    contactId: idSchema,
  },
} satisfies JsonSchema;

export const privateMessageParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contactId'],
  properties: {
    contactId: idSchema,
  },
} satisfies JsonSchema;

export const privateMessageSendBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: freeformStringSchema(PRIVATE_MESSAGE_MAX_LENGTH),
  },
} satisfies JsonSchema;

export const inventoryGrantBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['itemId', 'itemType', 'quantity'],
  properties: {
    itemId: idSchema,
    itemType: inventoryItemTypeSchema,
    quantity: positiveIntegerSchema(1, 100_000),
  },
} satisfies JsonSchema;

export const inventoryQuantityUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quantity'],
  properties: {
    quantity: positiveIntegerSchema(1, 100_000),
  },
} satisfies JsonSchema;

export const pvpContractCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reward', 'targetPlayerId'],
  properties: {
    reward: positiveMoneySchema(),
    targetPlayerId: idSchema,
  },
} satisfies JsonSchema;

export const pvpAmbushBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    participantIds: {
      type: 'array',
      items: idSchema,
      maxItems: 8,
      uniqueItems: true,
    },
  },
} satisfies JsonSchema;

export const robberyAttemptBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['executorType'],
  properties: {
    banditsCommitted: positiveIntegerSchema(1, 64),
    executorType: robberyExecutorTypeSchema,
    favelaId: optionalNullableIdSchema,
    vehicleRoute: nullableSchema(vehicleRobberyRouteSchema),
  },
} satisfies JsonSchema;

export const factionCrimeAttemptBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['participantIds'],
  properties: {
    participantIds: {
      type: 'array',
      items: idSchema,
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    },
  },
} satisfies JsonSchema;

export const trainingStartBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
    type: trainingTypeSchema,
  },
} satisfies JsonSchema;

export const universityEnrollBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['courseCode'],
  properties: {
    courseCode: universityCourseCodeSchema,
  },
} satisfies JsonSchema;

export const tribunalJudgmentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['punishment'],
  properties: {
    punishment: tribunalPunishmentSchema,
  },
} satisfies JsonSchema;

export const propertyPurchaseBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['regionId', 'type'],
  properties: {
    favelaId: optionalNullableIdSchema,
    regionId: regionIdSchema,
    type: propertyTypeSchema,
  },
} satisfies JsonSchema;

export const propertyHireSoldiersBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quantity', 'type'],
  properties: {
    quantity: positiveIntegerSchema(1, 100),
    type: soldierTypeSchema,
  },
} satisfies JsonSchema;

export const propertySabotageParamsSchema = buildIdParamsSchema('propertyId');

export const bocaStockBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['inventoryItemId', 'quantity'],
  properties: {
    inventoryItemId: idSchema,
    quantity: positiveIntegerSchema(1, 100_000),
  },
} satisfies JsonSchema;

export const raveStockBodySchema = bocaStockBodySchema;

export const ravePricingBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['drugId', 'priceMultiplier'],
  properties: {
    drugId: idSchema,
    priceMultiplier: numberSchema(RAVE_MIN_PRICE_MULTIPLIER, RAVE_MAX_PRICE_MULTIPLIER),
  },
} satisfies JsonSchema;

export const puteiroHireBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quantity', 'type'],
  properties: {
    quantity: positiveIntegerSchema(1, 50),
    type: gpTypeSchema,
  },
} satisfies JsonSchema;

export const frontStoreInvestBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dirtyAmount'],
  properties: {
    dirtyAmount: numberSchema(100, MONEY_MAX),
    storeKind: nullableSchema(frontStoreKindSchema),
  },
} satisfies JsonSchema;

export const slotMachineInstallBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quantity'],
  properties: {
    quantity: positiveIntegerSchema(SLOT_MACHINE_MIN_INSTALL_QUANTITY, SLOT_MACHINE_MAX_INSTALL_QUANTITY),
  },
} satisfies JsonSchema;

export const slotMachineConfigureBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['houseEdge', 'jackpotChance', 'maxBet', 'minBet'],
  properties: {
    houseEdge: numberSchema(0, 1),
    jackpotChance: numberSchema(0, 1),
    maxBet: positiveMoneySchema(),
    minBet: positiveMoneySchema(),
  },
} satisfies JsonSchema;

export const bichoPlaceBetBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount', 'mode'],
  properties: {
    amount: numberSchema(BICHO_MIN_BET, BICHO_MAX_BET),
    animalNumber: {
      type: 'integer',
      minimum: 1,
      maximum: 25,
      nullable: true,
    },
    dozen: {
      type: 'integer',
      nullable: true,
    },
    mode: bichoBetModeSchema,
  },
  allOf: [
    {
      if: {
        properties: {
          mode: {
            enum: ['cabeca', 'grupo'],
          },
        },
      },
      then: {
        required: ['animalNumber'],
      },
    },
    {
      if: {
        properties: {
          mode: {
            const: 'dezena',
          },
        },
      },
      then: {
        required: ['dozen'],
      },
    },
  ],
} satisfies JsonSchema;

export const drugFactoryCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['drugId'],
  properties: {
    drugId: idSchema,
  },
} satisfies JsonSchema;

export const drugFactoryStockBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['inventoryItemId', 'quantity'],
  properties: {
    inventoryItemId: idSchema,
    quantity: positiveIntegerSchema(1, 100_000),
  },
} satisfies JsonSchema;

export const drugSaleBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['channel', 'inventoryItemId', 'quantity'],
  properties: {
    channel: drugSaleChannelSchema,
    inventoryItemId: idSchema,
    propertyId: optionalNullableIdSchema,
    quantity: positiveIntegerSchema(1, 100_000),
  },
  allOf: [
    {
      if: {
        properties: {
          channel: {
            enum: ['boca', 'rave'],
          },
        },
      },
      then: {
        required: ['propertyId'],
      },
    },
  ],
} satisfies JsonSchema;

export function buildIdParamsSchema(...names: string[]): JsonSchema {
  const properties = Object.fromEntries(names.map((name) => [name, tokenSchema()]));

  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: names,
  };
}

export function buildStandardResponseSchema(
  successStatus: 200 | 201 = 200,
  successSchema: JsonSchema = genericObjectResponseSchema,
): NonNullable<FastifySchema['response']> {
  return {
    [successStatus]: successSchema,
    400: genericErrorResponseSchema,
    401: genericErrorResponseSchema,
    403: genericErrorResponseSchema,
    404: genericErrorResponseSchema,
    409: genericErrorResponseSchema,
    413: genericErrorResponseSchema,
    422: genericErrorResponseSchema,
    429: genericErrorResponseSchema,
    500: genericErrorResponseSchema,
    503: genericErrorResponseSchema,
  };
}

function enumSchema(values: readonly string[]): JsonSchema {
  return {
    type: 'string',
    enum: [...values],
  };
}

function numberSchema(minimum: number, maximum = MONEY_MAX): JsonSchema {
  return {
    type: 'number',
    minimum,
    maximum,
  };
}

function positiveIntegerSchema(minimum = 1, maximum = MONEY_MAX): JsonSchema {
  return {
    type: 'integer',
    minimum,
    maximum,
  };
}

function positiveMoneySchema(maximum = MONEY_MAX): JsonSchema {
  return numberSchema(0.01, maximum);
}

function nonNegativeMoneySchema(maximum = MONEY_MAX): JsonSchema {
  return numberSchema(0, maximum);
}

function stringSchema(minLength = 1, maxLength = DEFAULT_ID_MAX_LENGTH): JsonSchema {
  return {
    type: 'string',
    minLength,
    maxLength,
  };
}

function freeformStringSchema(maxLength = DEFAULT_TEXT_MAX_LENGTH): JsonSchema {
  return {
    type: 'string',
    maxLength,
    $comment: 'cs_rio:sanitize:freeform',
  };
}

function nullableSchema(schema: JsonSchema): JsonSchema {
  return {
    ...schema,
    nullable: true,
  };
}

function tokenSchema(minLength = 1, maxLength = DEFAULT_ID_MAX_LENGTH): JsonSchema {
  return {
    type: 'string',
    minLength,
    maxLength,
    pattern: NON_EMPTY_TOKEN_PATTERN.source,
  };
}
