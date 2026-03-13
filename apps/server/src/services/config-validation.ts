import {
  FAVELA_SERVICE_DEFINITIONS,
  PROPERTY_DEFINITIONS,
  type FactionRank,
  type GameConfigScope,
  RegionId,
  ROBBERY_DEFINITIONS,
  VEHICLE_ROBBERY_ROUTE_DEFINITIONS,
} from '@cs-rio/shared';

import { WorldDefinitionService } from './world-definition.js';

const KNOWN_EVENT_TYPES = [
  'navio_docas',
  'operacao_policial',
  'blitz_pm',
  'faca_na_caveira',
  'saidinha_natal',
  'carnaval',
  'ano_novo_copa',
  'operacao_verao',
  'delacao_premiada',
] as const;

const KNOWN_FACTION_RANKS: FactionRank[] = [
  'patrao',
  'general',
  'gerente',
  'vapor',
  'soldado',
  'cria',
];

const KNOWN_RISK_LABELS = ['alto', 'baixo_medio', 'medio', 'medio_alto'] as const;
const KNOWN_ROBBERY_EXECUTOR_TYPES = ['player', 'bandits'] as const;
const ALLOWED_MUTATION_SCOPES: GameConfigScope[] = [
  'global',
  'region',
  'favela',
  'faction_template',
  'event_type',
  'robbery_type',
  'property_type',
  'service_type',
];

export interface ConfigValidationSummary {
  key: string;
  normalizedTargetKey: string;
  rule: string;
  scope: GameConfigScope;
  validatedAt: string;
}

export interface ConfigValidationServiceOptions {
  now?: () => Date;
  worldDefinitionService?: Pick<
    WorldDefinitionService,
    'listActiveFavelas' | 'listActiveRegions' | 'listFixedFactionTemplates'
  >;
}

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigValidationService {
  private readonly now: () => Date;

  private readonly worldDefinitionService: Pick<
    WorldDefinitionService,
    'listActiveFavelas' | 'listActiveRegions' | 'listFixedFactionTemplates'
  >;

  constructor(options: ConfigValidationServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.worldDefinitionService = options.worldDefinitionService ?? new WorldDefinitionService();
  }

  async validateEntryMutation(input: {
    key: string;
    scope: GameConfigScope;
    targetKey?: string | null;
    valueJson: Record<string, unknown>;
  }): Promise<ConfigValidationSummary> {
    assertAllowedScope(input.scope);

    const normalizedTargetKey = await this.normalizeTargetKeyForScope(input.scope, input.targetKey);
    const validator = ENTRY_VALIDATORS[input.key];

    if (!validator) {
      throw new ConfigValidationError(
        `Chave de configuracao desconhecida para value_json: ${input.key}.`,
      );
    }

    validator.validateScope(input.scope, normalizedTargetKey);
    await validator.validateTarget(normalizedTargetKey, {
      ensureEventType: ensureKnownEventType,
      ensureFactionTemplate: (targetKey) => this.ensureFactionTemplate(targetKey),
      ensureFavela: (targetKey) => this.ensureFavela(targetKey),
      ensurePropertyType: ensureKnownPropertyType,
      ensureRegion: ensureKnownRegionId,
      ensureRobberyRoute: ensureKnownVehicleRouteTargetKey,
      ensureRobberyType: ensureKnownRobberyType,
      ensureServiceType: ensureKnownServiceType,
    });
    validator.validateValue(input.valueJson, normalizedTargetKey);

    return {
      key: input.key,
      normalizedTargetKey,
      rule: validator.rule,
      scope: input.scope,
      validatedAt: this.now().toISOString(),
    };
  }

  async validateFeatureFlagMutation(input: {
    key: string;
    payloadJson: Record<string, unknown>;
    scope: GameConfigScope;
    targetKey?: string | null;
  }): Promise<ConfigValidationSummary> {
    assertAllowedScope(input.scope);

    const normalizedTargetKey = await this.normalizeTargetKeyForScope(input.scope, input.targetKey);
    const validator = resolveFeatureFlagValidator(input.key);

    validator.validateScope(input.scope, normalizedTargetKey);
    await validator.validateTarget(normalizedTargetKey, {
      ensureEventType: ensureKnownEventType,
      ensureRobberyRoute: ensureKnownVehicleRouteTargetKey,
      ensureRobberyType: ensureKnownRobberyType,
    });
    validator.validatePayload(input.payloadJson, normalizedTargetKey);

    return {
      key: input.key,
      normalizedTargetKey,
      rule: validator.rule,
      scope: input.scope,
      validatedAt: this.now().toISOString(),
    };
  }

  private async normalizeTargetKeyForScope(
    scope: GameConfigScope,
    targetKey?: string | null,
  ): Promise<string> {
    const normalized = targetKey?.trim() ? targetKey.trim() : '*';

    if (scope === 'global') {
      if (normalized !== '*') {
        throw new ConfigValidationError(
          'Escopo global exige targetKey "*" ou vazio.',
        );
      }

      return '*';
    }

    if (scope === 'round') {
      throw new ConfigValidationError(
        'Escopo "round" nao deve ser usado nas mutacoes de catalogo. Use roundSelector com um escopo operacional real.',
      );
    }

    if (!normalized || normalized === '*') {
      throw new ConfigValidationError(
        `Escopo ${scope} exige um targetKey explicito e nao aceita "*".`,
      );
    }

    return normalized;
  }

  private async ensureFavela(targetKey: string): Promise<void> {
    const favelas = await this.worldDefinitionService.listActiveFavelas();

    if (!favelas.some((favela) => favela.code === targetKey)) {
      throw new ConfigValidationError(
        `Favela alvo inexistente ou inativa para targetKey "${targetKey}".`,
      );
    }
  }

  private async ensureFactionTemplate(targetKey: string): Promise<void> {
    const templates = await this.worldDefinitionService.listFixedFactionTemplates();

    if (
      !templates.some(
        (template) => template.id === targetKey || template.templateCode === targetKey,
      )
    ) {
      throw new ConfigValidationError(
        `Template de faccao fixa inexistente ou inativo para targetKey "${targetKey}".`,
      );
    }
  }
}

type EntryValidatorContext = {
  ensureEventType: (targetKey: string) => void;
  ensureFactionTemplate: (targetKey: string) => Promise<void>;
  ensureFavela: (targetKey: string) => Promise<void>;
  ensurePropertyType: (targetKey: string) => void;
  ensureRegion: (targetKey: string) => void;
  ensureRobberyRoute: (targetKey: string) => void;
  ensureRobberyType: (targetKey: string) => void;
  ensureServiceType: (targetKey: string) => void;
};

type EntryValidator = {
  rule: string;
  validateScope: (scope: GameConfigScope, targetKey: string) => void;
  validateTarget: (targetKey: string, context: EntryValidatorContext) => Promise<void>;
  validateValue: (valueJson: Record<string, unknown>, targetKey: string) => void;
};

type FeatureFlagValidator = {
  rule: string;
  validatePayload: (payloadJson: Record<string, unknown>, targetKey: string) => void;
  validateScope: (scope: GameConfigScope, targetKey: string) => void;
  validateTarget: (
    targetKey: string,
    context: Pick<EntryValidatorContext, 'ensureEventType' | 'ensureRobberyRoute' | 'ensureRobberyType'>,
  ) => Promise<void>;
};

const ENTRY_VALIDATORS: Record<string, EntryValidator> = {
  'round.total_game_days': createScalarValueValidator({
    key: 'round.total_game_days',
    rule: 'round.total_game_days/global',
    validateNumber: (value) => assertIntegerInRange(value, 1, 10_000, 'value'),
  }),
  'round.game_day_real_hours': createScalarValueValidator({
    key: 'round.game_day_real_hours',
    rule: 'round.game_day_real_hours/global',
    validateNumber: (value) => assertNumberInRange(value, 0.25, 72, 'value'),
  }),
  'round.top_ten_credit_reward': createScalarValueValidator({
    key: 'round.top_ten_credit_reward',
    rule: 'round.top_ten_credit_reward/global',
    validateNumber: (value) => assertIntegerInRange(value, 0, 100_000, 'value'),
  }),
  'bank.daily_deposit_limit_base': createScalarValueValidator({
    key: 'bank.daily_deposit_limit_base',
    rule: 'bank.daily_deposit_limit_base/global',
    validateNumber: (value) => assertIntegerInRange(value, 0, 1_000_000_000, 'value'),
  }),
  'bank.daily_deposit_limit_per_level': createScalarValueValidator({
    key: 'bank.daily_deposit_limit_per_level',
    rule: 'bank.daily_deposit_limit_per_level/global',
    validateNumber: (value) => assertIntegerInRange(value, 0, 1_000_000_000, 'value'),
  }),
  'bank.daily_interest_rate': createScalarValueValidator({
    key: 'bank.daily_interest_rate',
    rule: 'bank.daily_interest_rate/global',
    validateNumber: (value) => assertRate(value, 'value'),
  }),
  'bank.withdraw_fee_rate': createScalarValueValidator({
    key: 'bank.withdraw_fee_rate',
    rule: 'bank.withdraw_fee_rate/global',
    validateNumber: (value) => assertRate(value, 'value'),
  }),
  'territory.default_police_pressure': createScalarValueValidator({
    key: 'territory.default_police_pressure',
    rule: 'territory.default_police_pressure/global',
    validateNumber: (value) => assertNumberInRange(value, 0, 100, 'value'),
  }),
  'territory.default_favela_satisfaction': createScalarValueValidator({
    key: 'territory.default_favela_satisfaction',
    rule: 'territory.default_favela_satisfaction/global',
    validateNumber: (value) => assertNumberInRange(value, 0, 100, 'value'),
  }),
  'faction.default_internal_satisfaction': createScalarValueValidator({
    key: 'faction.default_internal_satisfaction',
    rule: 'faction.default_internal_satisfaction/global',
    validateNumber: (value) => assertNumberInRange(value, 0, 100, 'value'),
  }),
  'faction.default_robbery_policy': {
    rule: 'faction.default_robbery_policy/global',
    validateScope(scope) {
      assertScope(scope, ['global'], 'faction.default_robbery_policy');
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertFactionRobberyPolicyObject(valueJson);
    },
  },
  'crime.policy': {
    rule: 'crime.policy/global',
    validateScope(scope) {
      assertScope(scope, ['global'], 'crime.policy');
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertNumberInRange(
        readNumberField(valueJson, 'minimumPowerRatio'),
        0.05,
        1,
        'minimumPowerRatio',
      );
      assertIntegerInRange(
        readNumberField(valueJson, 'prisonMinutesPerLevel'),
        1,
        1_440,
        'prisonMinutesPerLevel',
      );
    },
  },
  'faction_crime.policy': {
    rule: 'faction_crime.policy/global',
    validateScope(scope) {
      assertScope(scope, ['global'], 'faction_crime.policy');
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertNumberInRange(
        readNumberField(valueJson, 'coordinationBonusPerExtraMember'),
        0,
        1,
        'coordinationBonusPerExtraMember',
      );
      assertIntegerInRange(readNumberField(valueJson, 'minCrewSize'), 1, 100, 'minCrewSize');
      assertIntegerInRange(readNumberField(valueJson, 'maxCrewSize'), 1, 100, 'maxCrewSize');
      assertNumberInRange(readNumberField(valueJson, 'minBustedChance'), 0, 1, 'minBustedChance');
      assertNumberInRange(readNumberField(valueJson, 'maxBustedChance'), 0, 1, 'maxBustedChance');
      assertFactionRankArray(valueJson.coordinatorRanks, 'coordinatorRanks');

      if (readNumberField(valueJson, 'maxCrewSize') < readNumberField(valueJson, 'minCrewSize')) {
        throw new ConfigValidationError('maxCrewSize precisa ser maior ou igual a minCrewSize.');
      }

      if (
        readNumberField(valueJson, 'maxBustedChance') <
        readNumberField(valueJson, 'minBustedChance')
      ) {
        throw new ConfigValidationError(
          'maxBustedChance precisa ser maior ou igual a minBustedChance.',
        );
      }
    },
  },
  'territory.conquest_policy': {
    rule: 'territory.conquest_policy/global',
    validateScope(scope) {
      assertScope(scope, ['global'], 'territory.conquest_policy');
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertFactionRankArray(valueJson.commandRanks, 'commandRanks');
      assertFactionRankArray(valueJson.managementRanks, 'managementRanks');
      assertNumberInRange(
        readNumberField(valueJson, 'coordinationBonusPerExtraMember'),
        0,
        1,
        'coordinationBonusPerExtraMember',
      );
      assertIntegerInRange(readNumberField(valueJson, 'minCrewSize'), 1, 100, 'minCrewSize');
      assertIntegerInRange(readNumberField(valueJson, 'maxCrewSize'), 1, 100, 'maxCrewSize');
      assertIntegerInRange(
        readNumberField(valueJson, 'stabilizationHours'),
        1,
        24 * 365,
        'stabilizationHours',
      );

      if (readNumberField(valueJson, 'maxCrewSize') < readNumberField(valueJson, 'minCrewSize')) {
        throw new ConfigValidationError('maxCrewSize precisa ser maior ou igual a minCrewSize.');
      }
    },
  },
  'events.police_pressure_delta': {
    rule: 'events.police_pressure_delta/region',
    validateScope(scope) {
      assertScope(scope, ['region'], 'events.police_pressure_delta');
    },
    async validateTarget(targetKey, context) {
      context.ensureRegion(targetKey);
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertNumberInRange(readNumberField(valueJson, 'value'), -100, 100, 'value');

      if ('reason' in valueJson) {
        assertOptionalString(valueJson.reason, 'reason');
      }

      if ('unit' in valueJson) {
        assertOptionalString(valueJson.unit, 'unit');
      }
    },
  },
  'favelas.max_soldiers': {
    rule: 'favelas.max_soldiers/favela',
    validateScope(scope) {
      assertScope(scope, ['favela'], 'favelas.max_soldiers');
    },
    async validateTarget(targetKey, context) {
      await context.ensureFavela(targetKey);
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertIntegerInRange(readNumberField(valueJson, 'value'), 0, 10_000, 'value');

      if ('source' in valueJson) {
        assertOptionalString(valueJson.source, 'source');
      }

      if ('unit' in valueJson) {
        assertOptionalString(valueJson.unit, 'unit');
      }
    },
  },
  'robbery.definition': {
    rule: 'robbery.definition/robbery_type',
    validateScope(scope, targetKey) {
      assertScope(scope, ['robbery_type'], 'robbery.definition');

      if (targetKey.startsWith('vehicle_route:')) {
        throw new ConfigValidationError(
          'robbery.definition aceita apenas tipos base de roubo, nao rotas de veiculo.',
        );
      }
    },
    async validateTarget(targetKey, context) {
      context.ensureRobberyType(targetKey);
    },
    validateValue(valueJson, targetKey) {
      assertPlainObject(valueJson, 'valueJson');
      assertStringEquals(readStringField(valueJson, 'id'), targetKey, 'id');
      assertRequiredString(valueJson.label, 'label');
      assertIntegerInRange(readNumberField(valueJson, 'minimumLevel'), 1, 100, 'minimumLevel');
      assertIntegerInRange(
        readNumberField(valueJson, 'baseCooldownSeconds'),
        1,
        86_400,
        'baseCooldownSeconds',
      );
      assertRate(readNumberField(valueJson, 'baseFactionCommissionRate'), 'baseFactionCommissionRate');
      assertRangeObject(valueJson.baseRewardRange, 'baseRewardRange', {
        integer: true,
        min: 0,
      });
      assertRangeObject(valueJson.baseHeatDeltaRange, 'baseHeatDeltaRange', {
        integer: true,
        min: 0,
      });
      assertIntegerInRange(
        readNumberField(valueJson, 'defaultBanditsCommitted'),
        0,
        100,
        'defaultBanditsCommitted',
      );
      assertIntegerInRange(
        readNumberField(valueJson, 'maxBanditsCommitted'),
        readNumberField(valueJson, 'defaultBanditsCommitted'),
        100,
        'maxBanditsCommitted',
      );
      assertStringEnum(valueJson.riskLabel, KNOWN_RISK_LABELS, 'riskLabel');
      assertExecutorTypes(valueJson.executorTypes);
    },
  },
  'robbery.vehicle_route_definition': {
    rule: 'robbery.vehicle_route_definition/robbery_type',
    validateScope(scope, targetKey) {
      assertScope(scope, ['robbery_type'], 'robbery.vehicle_route_definition');

      if (!targetKey.startsWith('vehicle_route:')) {
        throw new ConfigValidationError(
          'robbery.vehicle_route_definition exige targetKey no formato vehicle_route:<rota>.',
        );
      }
    },
    async validateTarget(targetKey, context) {
      context.ensureRobberyRoute(targetKey);
    },
    validateValue(valueJson, targetKey) {
      assertPlainObject(valueJson, 'valueJson');
      const expectedRouteId = targetKey.replace('vehicle_route:', '');
      assertStringEquals(readStringField(valueJson, 'id'), expectedRouteId, 'id');
      assertRequiredString(valueJson.label, 'label');
      assertRequiredString(valueJson.description, 'description');
      assertRate(readNumberField(valueJson, 'baseFactionCommissionRate'), 'baseFactionCommissionRate');
      assertRangeObject(valueJson.baseRewardRange, 'baseRewardRange', {
        integer: true,
        min: 0,
      });
      assertRangeObject(valueJson.baseHeatDeltaRange, 'baseHeatDeltaRange', {
        integer: true,
        min: 0,
      });
      assertStringEnum(valueJson.riskLabel, KNOWN_RISK_LABELS, 'riskLabel');
    },
  },
  'event.definition': {
    rule: 'event.definition/event_type',
    validateScope(scope) {
      assertScope(scope, ['event_type'], 'event.definition');
    },
    async validateTarget(targetKey, context) {
      context.ensureEventType(targetKey);
    },
    validateValue(valueJson, targetKey) {
      assertPlainObject(valueJson, 'valueJson');
      assertRequiredString(valueJson.headline, 'headline');
      assertRequiredString(valueJson.source, 'source');
      assertIntegerInRange(readNumberField(valueJson, 'durationMs'), 1, 365 * 24 * 60 * 60 * 1000, 'durationMs');

      if ('cooldownMs' in valueJson) {
        assertIntegerInRange(readNumberField(valueJson, 'cooldownMs'), 1, 365 * 24 * 60 * 60 * 1000, 'cooldownMs');
      }

      if ('minNextDelayMs' in valueJson) {
        assertIntegerInRange(
          readNumberField(valueJson, 'minNextDelayMs'),
          1,
          365 * 24 * 60 * 60 * 1000,
          'minNextDelayMs',
        );
      }

      if ('maxNextDelayMs' in valueJson) {
        assertIntegerInRange(
          readNumberField(valueJson, 'maxNextDelayMs'),
          1,
          365 * 24 * 60 * 60 * 1000,
          'maxNextDelayMs',
        );
      }

      if ('minNextDelayMs' in valueJson && 'maxNextDelayMs' in valueJson) {
        const minDelay = readNumberField(valueJson, 'minNextDelayMs');
        const maxDelay = readNumberField(valueJson, 'maxNextDelayMs');

        if (maxDelay < minDelay) {
          throw new ConfigValidationError(
            'maxNextDelayMs precisa ser maior ou igual a minNextDelayMs.',
          );
        }
      }

      if ('regionIds' in valueJson) {
        assertRegionIdArray(valueJson.regionIds, 'regionIds');
      }

      if ('bonusSummary' in valueJson) {
        assertArrayOfStrings(valueJson.bonusSummary, 'bonusSummary');
      }

      if ('policeMood' in valueJson) {
        assertRequiredString(valueJson.policeMood, 'policeMood');
      }

      validateEventNumbers(valueJson);
      validateEventTypeSpecificPayload(targetKey, valueJson);
    },
  },
  'economy.property_definition': {
    rule: 'economy.property_definition/property_type',
    validateScope(scope) {
      assertScope(scope, ['property_type'], 'economy.property_definition');
    },
    async validateTarget(targetKey, context) {
      context.ensurePropertyType(targetKey);
    },
    validateValue(valueJson, targetKey) {
      assertPlainObject(valueJson, 'valueJson');

      if ('type' in valueJson) {
        assertStringEquals(readStringField(valueJson, 'type'), targetKey, 'type');
      }

      if ('basePrice' in valueJson) {
        assertIntegerInRange(readNumberField(valueJson, 'basePrice'), 0, 1_000_000_000, 'basePrice');
      }

      if ('baseDailyMaintenanceCost' in valueJson) {
        assertIntegerInRange(
          readNumberField(valueJson, 'baseDailyMaintenanceCost'),
          0,
          1_000_000_000,
          'baseDailyMaintenanceCost',
        );
      }

      if ('factionCommissionRate' in valueJson) {
        assertRate(readNumberField(valueJson, 'factionCommissionRate'), 'factionCommissionRate');
      }

      if ('label' in valueJson) {
        assertRequiredString(valueJson.label, 'label');
      }

      if ('utility' in valueJson) {
        assertPropertyUtility(valueJson.utility);
      }
    },
  },
  'economy.property_event_profile': {
    rule: 'economy.property_event_profile/property_type',
    validateScope(scope) {
      assertScope(scope, ['property_type'], 'economy.property_event_profile');
    },
    async validateTarget(targetKey, context) {
      context.ensurePropertyType(targetKey);
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertOptionalMultiplierMap(valueJson.demandMultipliers, 'demandMultipliers');
      assertOptionalMultiplierMap(valueJson.investigationMultipliers, 'investigationMultipliers');
      assertOptionalMultiplierMap(valueJson.priceMultipliers, 'priceMultipliers');
      assertOptionalMultiplierMap(valueJson.revenueMultipliers, 'revenueMultipliers');
      assertOptionalMultiplierMap(valueJson.riskDeathMultipliers, 'riskDeathMultipliers');
      assertOptionalMultiplierMap(valueJson.riskDstMultipliers, 'riskDstMultipliers');
      assertOptionalMultiplierMap(valueJson.riskEscapeMultipliers, 'riskEscapeMultipliers');
      assertOptionalMultiplierMap(valueJson.trafficMultipliers, 'trafficMultipliers');
      assertOptionalMultiplierMap(valueJson.visitorMultipliers, 'visitorMultipliers');
      assertOptionalClampsObject(valueJson.clamps, 'clamps');
    },
  },
  'territory.service_definition': {
    rule: 'territory.service_definition/service_type',
    validateScope(scope) {
      assertScope(scope, ['service_type'], 'territory.service_definition');
    },
    async validateTarget(targetKey, context) {
      context.ensureServiceType(targetKey);
    },
    validateValue(valueJson, targetKey) {
      assertPlainObject(valueJson, 'valueJson');

      if ('type' in valueJson) {
        assertStringEquals(readStringField(valueJson, 'type'), targetKey, 'type');
      }

      if ('label' in valueJson) {
        assertRequiredString(valueJson.label, 'label');
      }

      if ('baseDailyRevenuePerResident' in valueJson) {
        assertIntegerInRange(
          readNumberField(valueJson, 'baseDailyRevenuePerResident'),
          0,
          1_000_000,
          'baseDailyRevenuePerResident',
        );
      }

      if ('installCost' in valueJson) {
        assertIntegerInRange(readNumberField(valueJson, 'installCost'), 0, 1_000_000_000, 'installCost');
      }

      if ('maxLevel' in valueJson) {
        assertIntegerInRange(readNumberField(valueJson, 'maxLevel'), 1, 100, 'maxLevel');
      }

      if ('satisfactionGainOnUpgrade' in valueJson) {
        assertIntegerInRange(
          readNumberField(valueJson, 'satisfactionGainOnUpgrade'),
          -100,
          100,
          'satisfactionGainOnUpgrade',
        );
      }

      if ('upgradeRevenueStepMultiplier' in valueJson) {
        assertNumberInRange(
          readNumberField(valueJson, 'upgradeRevenueStepMultiplier'),
          0,
          100,
          'upgradeRevenueStepMultiplier',
        );
      }
    },
  },
  'territory.propina_policy': {
    rule: 'territory.propina_policy/global',
    validateScope(scope) {
      assertScope(scope, ['global'], 'territory.propina_policy');
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertIntegerInRange(readNumberField(valueJson, 'billingIntervalMs'), 1, 365 * 24 * 60 * 60 * 1000, 'billingIntervalMs');
      assertIntegerInRange(readNumberField(valueJson, 'initialNoticeMs'), 1, 365 * 24 * 60 * 60 * 1000, 'initialNoticeMs');
      assertNumberInRange(readNumberField(valueJson, 'warningRevenueMultiplier'), 0, 10, 'warningRevenueMultiplier');
      assertNumberInRange(readNumberField(valueJson, 'severeRevenueMultiplier'), 0, 10, 'severeRevenueMultiplier');
      assertIntegerInRange(readNumberField(valueJson, 'stateTakeoverMinDays'), 0, 365, 'stateTakeoverMinDays');
      assertIntegerInRange(readNumberField(valueJson, 'stateTakeoverMaxDays'), 0, 365, 'stateTakeoverMaxDays');

      if (
        readNumberField(valueJson, 'stateTakeoverMaxDays') <
        readNumberField(valueJson, 'stateTakeoverMinDays')
      ) {
        throw new ConfigValidationError(
          'stateTakeoverMaxDays precisa ser maior ou igual a stateTakeoverMinDays.',
        );
      }
    },
  },
  'territory.propina_region_profile': {
    rule: 'territory.propina_region_profile/region',
    validateScope(scope) {
      assertScope(scope, ['region'], 'territory.propina_region_profile');
    },
    async validateTarget(targetKey, context) {
      context.ensureRegion(targetKey);
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      assertIntegerInRange(readNumberField(valueJson, 'baseRatePerResident'), 0, 100_000, 'baseRatePerResident');
    },
  },
};

function resolveFeatureFlagValidator(key: string): FeatureFlagValidator {
  if (key === 'config.dynamic_catalog_enabled') {
    return {
      rule: 'config.dynamic_catalog_enabled/global',
      async validateTarget() {
        return;
      },
      validatePayload(payloadJson) {
        assertPlainObject(payloadJson, 'payloadJson');

        if ('owner' in payloadJson) {
          assertOptionalString(payloadJson.owner, 'owner');
        }

        if ('rollout' in payloadJson) {
          assertOptionalString(payloadJson.rollout, 'rollout');
        }
      },
      validateScope(scope) {
        assertScope(scope, ['global'], key);
      },
    };
  }

  const eventMatch = /^events\.([a-z0-9_]+)\.enabled$/u.exec(key);

  if (eventMatch) {
    const eventType = eventMatch[1]!;
    return {
      rule: 'events.<event_type>.enabled/event_type',
      async validateTarget(targetKey, context) {
        context.ensureEventType(eventType);

        if (targetKey !== eventType) {
          throw new ConfigValidationError(
            `targetKey "${targetKey}" nao corresponde a feature flag ${key}.`,
          );
        }
      },
      validatePayload(payloadJson) {
        assertPlainObject(payloadJson, 'payloadJson');
      },
      validateScope(scope) {
        assertScope(scope, ['event_type'], key);
      },
    };
  }

  const robberyMatch = /^robberies\.([a-z_]+)\.enabled$/u.exec(key);

  if (robberyMatch) {
    const robberyType = robberyMatch[1]!;
    return {
      rule: 'robberies.<robbery_type>.enabled/robbery_type',
      async validateTarget(targetKey, context) {
        context.ensureRobberyType(robberyType);

        if (targetKey !== robberyType) {
          throw new ConfigValidationError(
            `targetKey "${targetKey}" nao corresponde a feature flag ${key}.`,
          );
        }
      },
      validatePayload(payloadJson) {
        assertPlainObject(payloadJson, 'payloadJson');
      },
      validateScope(scope) {
        assertScope(scope, ['robbery_type'], key);
      },
    };
  }

  const vehicleRouteMatch = /^robberies\.vehicle_route\.([a-z_]+)\.enabled$/u.exec(key);

  if (vehicleRouteMatch) {
    const routeId = vehicleRouteMatch[1]!;
    return {
      rule: 'robberies.vehicle_route.<route>.enabled/robbery_type',
      async validateTarget(targetKey, context) {
        const expectedTargetKey = `vehicle_route:${routeId}`;
        context.ensureRobberyRoute(expectedTargetKey);

        if (targetKey !== expectedTargetKey) {
          throw new ConfigValidationError(
            `targetKey "${targetKey}" nao corresponde a feature flag ${key}.`,
          );
        }
      },
      validatePayload(payloadJson) {
        assertPlainObject(payloadJson, 'payloadJson');
      },
      validateScope(scope) {
        assertScope(scope, ['robbery_type'], key);
      },
    };
  }

  throw new ConfigValidationError(`Feature flag desconhecida: ${key}.`);
}

function createScalarValueValidator(input: {
  key: string;
  rule: string;
  validateNumber: (value: number) => void;
}): EntryValidator {
  return {
    rule: input.rule,
    validateScope(scope) {
      assertScope(scope, ['global'], input.key);
    },
    async validateTarget() {
      return;
    },
    validateValue(valueJson) {
      assertPlainObject(valueJson, 'valueJson');
      input.validateNumber(readNumberField(valueJson, 'value'));

      if ('unit' in valueJson) {
        assertOptionalString(valueJson.unit, 'unit');
      }

      if ('currency' in valueJson) {
        assertOptionalString(valueJson.currency, 'currency');
      }
    },
  };
}

function assertAllowedScope(scope: GameConfigScope): void {
  if (!ALLOWED_MUTATION_SCOPES.includes(scope)) {
    throw new ConfigValidationError(
      `Escopo ${scope} nao e suportado para mutacao operacional nesta etapa.`,
    );
  }
}

function assertScope(
  scope: GameConfigScope,
  allowedScopes: GameConfigScope[],
  key: string,
): void {
  if (!allowedScopes.includes(scope)) {
    throw new ConfigValidationError(
      `A chave ${key} nao aceita o escopo ${scope}. Escopos validos: ${allowedScopes.join(', ')}.`,
    );
  }
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigValidationError(`${label} precisa ser um objeto JSON.`);
  }
}

function readNumberField(object: Record<string, unknown>, field: string): number {
  const value = object[field];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConfigValidationError(`Campo ${field} precisa ser numero finito.`);
  }

  return value;
}

function readStringField(object: Record<string, unknown>, field: string): string {
  const value = object[field];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigValidationError(`Campo ${field} precisa ser string nao vazia.`);
  }

  return value.trim();
}

function assertStringEquals(value: string, expected: string, label: string): void {
  if (value !== expected) {
    throw new ConfigValidationError(`Campo ${label} precisa ser "${expected}".`);
  }
}

function assertRequiredString(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigValidationError(`Campo ${label} precisa ser string nao vazia.`);
  }
}

function assertOptionalString(value: unknown, label: string): void {
  if (value !== null && value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    throw new ConfigValidationError(`Campo ${label} precisa ser string nao vazia quando informado.`);
  }
}

function assertArrayOfStrings(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    throw new ConfigValidationError(`Campo ${label} precisa ser array de strings nao vazias.`);
  }
}

function assertStringEnum<TValue extends readonly string[]>(
  value: unknown,
  allowedValues: TValue,
  label: string,
): void {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new ConfigValidationError(
      `Campo ${label} precisa ser um de: ${allowedValues.join(', ')}.`,
    );
  }
}

function assertIntegerInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigValidationError(
      `Campo ${label} precisa ser inteiro entre ${min} e ${max}.`,
    );
  }
}

function assertNumberInRange(value: number, min: number, max: number, label: string): void {
  if (value < min || value > max) {
    throw new ConfigValidationError(
      `Campo ${label} precisa estar entre ${min} e ${max}.`,
    );
  }
}

function assertRate(value: number, label: string): void {
  assertNumberInRange(value, 0, 1, label);
}

function assertRangeObject(
  value: unknown,
  label: string,
  options: {
    integer?: boolean;
    min: number;
  },
): void {
  assertPlainObject(value, label);
  const minValue = readNumberField(value, 'min');
  const maxValue = readNumberField(value, 'max');

  if (options.integer) {
    assertIntegerInRange(minValue, options.min, Number.MAX_SAFE_INTEGER, `${label}.min`);
    assertIntegerInRange(maxValue, options.min, Number.MAX_SAFE_INTEGER, `${label}.max`);
  } else {
    assertNumberInRange(minValue, options.min, Number.MAX_SAFE_INTEGER, `${label}.min`);
    assertNumberInRange(maxValue, options.min, Number.MAX_SAFE_INTEGER, `${label}.max`);
  }

  if (maxValue < minValue) {
    throw new ConfigValidationError(`Campo ${label}.max precisa ser maior ou igual a ${label}.min.`);
  }
}

function assertExecutorTypes(value: unknown): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (entry) =>
        typeof entry !== 'string' ||
        !KNOWN_ROBBERY_EXECUTOR_TYPES.includes(
          entry as (typeof KNOWN_ROBBERY_EXECUTOR_TYPES)[number],
        ),
    )
  ) {
    throw new ConfigValidationError(
      `Campo executorTypes precisa conter apenas: ${KNOWN_ROBBERY_EXECUTOR_TYPES.join(', ')}.`,
    );
  }
}

function assertRegionIdArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigValidationError(`Campo ${label} precisa ser array nao vazio de regioes.`);
  }

  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new ConfigValidationError(`Campo ${label} precisa conter apenas ids de regiao.`);
    }

    ensureKnownRegionId(entry);
  }
}

function assertOptionalMultiplierMap(value: unknown, label: string): void {
  if (value === null || value === undefined) {
    return;
  }

  assertPlainObject(value, label);

  for (const [eventType, factor] of Object.entries(value)) {
    ensureKnownEventType(eventType);

    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0 || factor > 10) {
      throw new ConfigValidationError(
        `Campo ${label}.${eventType} precisa ser numero entre 0 e 10.`,
      );
    }
  }
}

function assertOptionalClampsObject(value: unknown, label: string): void {
  if (value === null || value === undefined) {
    return;
  }

  assertPlainObject(value, label);

  for (const [clampKey, clampValue] of Object.entries(value)) {
    assertRangeObject(clampValue, `${label}.${clampKey}`, {
      min: 0,
    });
  }
}

function assertPropertyUtility(value: unknown): void {
  assertPlainObject(value, 'utility');

  if ('inventorySlotsBonus' in value) {
    assertIntegerInRange(readNumberField(value, 'inventorySlotsBonus'), 0, 10_000, 'utility.inventorySlotsBonus');
  }

  if ('inventoryWeightBonus' in value) {
    assertIntegerInRange(readNumberField(value, 'inventoryWeightBonus'), 0, 10_000, 'utility.inventoryWeightBonus');
  }

  if ('staminaRecoveryPerHourBonus' in value) {
    assertIntegerInRange(
      readNumberField(value, 'staminaRecoveryPerHourBonus'),
      0,
      10_000,
      'utility.staminaRecoveryPerHourBonus',
    );
  }

  if ('travelMode' in value && value.travelMode !== null && typeof value.travelMode !== 'string') {
    throw new ConfigValidationError('utility.travelMode precisa ser string ou null.');
  }
}

function validateEventNumbers(valueJson: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(valueJson)) {
    if (typeof value !== 'number') {
      continue;
    }

    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('rate') || lowerKey.includes('chance') || lowerKey.includes('weight') || lowerKey.includes('multiplier')) {
      if (!Number.isFinite(value) || value < 0 || value > 10) {
        throw new ConfigValidationError(`Campo ${key} precisa ser numero entre 0 e 10.`);
      }

      continue;
    }

    if (!Number.isFinite(value)) {
      throw new ConfigValidationError(`Campo ${key} precisa ser numero finito.`);
    }
  }
}

function validateEventTypeSpecificPayload(
  eventType: string,
  valueJson: Record<string, unknown>,
): void {
  switch (eventType) {
    case 'navio_docas':
      assertRegionIdArray(valueJson.regionIds, 'regionIds');
      assertNumberInRange(readNumberField(valueJson, 'premiumMultiplier'), 0, 10, 'premiumMultiplier');
      if (typeof valueJson.unlimitedDemand !== 'boolean') {
        throw new ConfigValidationError('Campo unlimitedDemand precisa ser boolean.');
      }
      return;
    case 'operacao_policial':
    case 'blitz_pm':
    case 'faca_na_caveira':
    case 'saidinha_natal':
      assertNumberInRange(readNumberField(valueJson, 'rollChanceBase'), 0, 1, 'rollChanceBase');
      return;
    case 'carnaval':
    case 'ano_novo_copa':
    case 'operacao_verao':
      assertRegionIdArray(valueJson.regionIds, 'regionIds');
      assertArrayOfStrings(valueJson.bonusSummary, 'bonusSummary');
      assertRequiredString(valueJson.policeMood, 'policeMood');
      assertNumberInRange(readNumberField(valueJson, 'rollChance'), 0, 1, 'rollChance');
      assertNumberInRange(readNumberField(valueJson, 'policeRollMultiplier'), 0, 10, 'policeRollMultiplier');
      return;
    case 'delacao_premiada':
      return;
    default:
      throw new ConfigValidationError(`Tipo de evento desconhecido para schema: ${eventType}.`);
  }
}

function ensureKnownRegionId(targetKey: string): void {
  if (!Object.values(RegionId).includes(targetKey as RegionId)) {
    throw new ConfigValidationError(`Regiao alvo invalida: ${targetKey}.`);
  }
}

function ensureKnownPropertyType(targetKey: string): void {
  if (!PROPERTY_DEFINITIONS.some((definition) => definition.type === targetKey)) {
    throw new ConfigValidationError(`Tipo de propriedade invalido: ${targetKey}.`);
  }
}

function ensureKnownServiceType(targetKey: string): void {
  if (!FAVELA_SERVICE_DEFINITIONS.some((definition) => definition.type === targetKey)) {
    throw new ConfigValidationError(`Tipo de servico territorial invalido: ${targetKey}.`);
  }
}

function ensureKnownRobberyType(targetKey: string): void {
  if (!ROBBERY_DEFINITIONS.some((definition) => definition.id === targetKey)) {
    throw new ConfigValidationError(`Tipo de roubo invalido: ${targetKey}.`);
  }
}

function ensureKnownVehicleRouteTargetKey(targetKey: string): void {
  const routeId = targetKey.replace(/^vehicle_route:/u, '');

  if (!VEHICLE_ROBBERY_ROUTE_DEFINITIONS.some((definition) => definition.id === routeId)) {
    throw new ConfigValidationError(`Rota de roubo de veiculo invalida: ${targetKey}.`);
  }
}

function ensureKnownEventType(targetKey: string): void {
  if (!KNOWN_EVENT_TYPES.includes(targetKey as (typeof KNOWN_EVENT_TYPES)[number])) {
    throw new ConfigValidationError(`Tipo de evento invalido: ${targetKey}.`);
  }
}

function assertFactionRankArray(value: unknown, fieldName: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigValidationError(`Campo ${fieldName} precisa ser um array nao vazio.`);
  }

  const invalid = value.filter(
    (entry) => typeof entry !== 'string' || !KNOWN_FACTION_RANKS.includes(entry as FactionRank),
  );

  if (invalid.length > 0) {
    throw new ConfigValidationError(
      `Campo ${fieldName} aceita apenas ranks validos: ${KNOWN_FACTION_RANKS.join(', ')}.`,
    );
  }
}

function assertFactionRobberyPolicyObject(valueJson: Record<string, unknown>): void {
  assertRequiredString(valueJson.global, 'global');

  if (valueJson.global !== 'allowed' && valueJson.global !== 'forbidden') {
    throw new ConfigValidationError('Campo global aceita apenas "allowed" ou "forbidden".');
  }

  if (valueJson.regions === undefined) {
    return;
  }

  if (!valueJson.regions || typeof valueJson.regions !== 'object' || Array.isArray(valueJson.regions)) {
    throw new ConfigValidationError('Campo regions precisa ser um objeto simples.');
  }

  for (const [regionId, mode] of Object.entries(valueJson.regions)) {
    ensureKnownRegionId(regionId);

    if (mode !== 'allowed' && mode !== 'forbidden') {
      throw new ConfigValidationError(
        `Policy de roubo invalida para a regiao ${regionId}. Use "allowed" ou "forbidden".`,
      );
    }
  }
}

export { ConfigValidationError };
