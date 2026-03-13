import {
  FAVELA_SERVICE_DEFINITIONS,
  PROPERTY_DEFINITIONS,
  RegionId,
  type FavelaServiceDefinitionSummary,
  type FavelaServiceType,
  type PropertyDefinitionSummary,
  type PropertyType,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';

export interface TerritoryPropinaPolicyProfile {
  billingIntervalMs: number;
  initialNoticeMs: number;
  severeRevenueMultiplier: number;
  stateTakeoverMaxDays: number;
  stateTakeoverMinDays: number;
  warningRevenueMultiplier: number;
}

export interface TerritoryPropinaRegionProfile {
  baseRatePerResident: number;
}

export interface PropertyEventProfile {
  demandMultipliers?: Record<string, number>;
  investigationMultipliers?: Record<string, number>;
  priceMultipliers?: Record<string, number>;
  revenueMultipliers?: Record<string, number>;
  riskDeathMultipliers?: Record<string, number>;
  riskDstMultipliers?: Record<string, number>;
  riskEscapeMultipliers?: Record<string, number>;
  trafficMultipliers?: Record<string, number>;
  visitorMultipliers?: Record<string, number>;
  clamps?: {
    investigation?: { max: number; min: number };
    revenue?: { max: number; min: number };
    riskDeath?: { max: number; min: number };
    riskDst?: { max: number; min: number };
    riskEscape?: { max: number; min: number };
    traffic?: { max: number; min: number };
  };
}

const DEFAULT_PROPINA_POLICY: TerritoryPropinaPolicyProfile = {
  billingIntervalMs: 5 * 24 * 60 * 60 * 1000,
  initialNoticeMs: 24 * 60 * 60 * 1000,
  severeRevenueMultiplier: 0.5,
  stateTakeoverMaxDays: 7,
  stateTakeoverMinDays: 3,
  warningRevenueMultiplier: 0.8,
};

const DEFAULT_PROPINA_REGION_PROFILES: Record<RegionId, TerritoryPropinaRegionProfile> = {
  [RegionId.ZonaSul]: { baseRatePerResident: 8 },
  [RegionId.ZonaNorte]: { baseRatePerResident: 4 },
  [RegionId.Centro]: { baseRatePerResident: 6 },
  [RegionId.ZonaOeste]: { baseRatePerResident: 5 },
  [RegionId.ZonaSudoeste]: { baseRatePerResident: 7 },
  [RegionId.Baixada]: { baseRatePerResident: 3 },
};

const DEFAULT_PROPERTY_EVENT_PROFILES: Partial<Record<PropertyType, PropertyEventProfile>> = {
  boca: {
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
  front_store: {
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
  puteiro: {
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
  rave: {
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
  slot_machine: {
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
};

let cachedCatalog: ResolvedGameConfigCatalog | null = null;

export function primeEconomyConfigCache(catalog: ResolvedGameConfigCatalog): void {
  cachedCatalog = catalog;
}

export function resolveCachedEconomyPropertyDefinition(
  propertyType: PropertyType,
): PropertyDefinitionSummary {
  return resolveEconomyPropertyDefinition(
    cachedCatalog ?? buildEmptyCatalogFallback(),
    propertyType,
  );
}

export function resolveCachedPropertyEventProfile(propertyType: PropertyType): PropertyEventProfile {
  return resolvePropertyEventProfile(cachedCatalog ?? buildEmptyCatalogFallback(), propertyType);
}

export function resolveCachedFavelaServiceDefinition(
  serviceType: FavelaServiceType,
): FavelaServiceDefinitionSummary {
  return resolveFavelaServiceDefinition(cachedCatalog ?? buildEmptyCatalogFallback(), serviceType);
}

export function resolveCachedAllFavelaServiceDefinitions(): FavelaServiceDefinitionSummary[] {
  return resolveAllFavelaServiceDefinitions(cachedCatalog ?? buildEmptyCatalogFallback());
}

export function resolveCachedTerritoryPropinaPolicy(): TerritoryPropinaPolicyProfile {
  return resolveTerritoryPropinaPolicy(cachedCatalog ?? buildEmptyCatalogFallback());
}

export function resolveCachedTerritoryPropinaRegionProfile(
  regionId: RegionId,
): TerritoryPropinaRegionProfile {
  return resolveTerritoryPropinaRegionProfile(cachedCatalog ?? buildEmptyCatalogFallback(), regionId);
}

export function resolveEconomyPropertyDefinition(
  catalog: ResolvedGameConfigCatalog,
  propertyType: PropertyType,
): PropertyDefinitionSummary {
  const fallback = requirePropertyDefinitionFallback(propertyType);
  const override = findConfigObject<Partial<PropertyDefinitionSummary>>(
    catalog,
    'economy.property_definition',
    'property_type',
    propertyType,
  );

  return {
    ...fallback,
    ...(override ?? {}),
    utility: {
      ...fallback.utility,
      ...(override?.utility ?? {}),
    },
  };
}

export function resolvePropertyEventProfile(
  catalog: ResolvedGameConfigCatalog,
  propertyType: PropertyType,
): PropertyEventProfile {
  const fallback = DEFAULT_PROPERTY_EVENT_PROFILES[propertyType] ?? {};
  const override = findConfigObject<Partial<PropertyEventProfile>>(
    catalog,
    'economy.property_event_profile',
    'property_type',
    propertyType,
  );

  return mergePropertyEventProfile(fallback, override);
}

export function resolveFavelaServiceDefinition(
  catalog: ResolvedGameConfigCatalog,
  serviceType: FavelaServiceType,
): FavelaServiceDefinitionSummary {
  const fallback = requireFavelaServiceDefinitionFallback(serviceType);
  const override = findConfigObject<Partial<FavelaServiceDefinitionSummary>>(
    catalog,
    'territory.service_definition',
    'service_type',
    serviceType,
  );

  return {
    ...fallback,
    ...(override ?? {}),
  };
}

export function resolveAllFavelaServiceDefinitions(
  catalog: ResolvedGameConfigCatalog,
): FavelaServiceDefinitionSummary[] {
  return FAVELA_SERVICE_DEFINITIONS.map((definition) =>
    resolveFavelaServiceDefinition(catalog, definition.type),
  );
}

export function resolveTerritoryPropinaPolicy(
  catalog: ResolvedGameConfigCatalog,
): TerritoryPropinaPolicyProfile {
  const override = findConfigObject<Partial<TerritoryPropinaPolicyProfile>>(
    catalog,
    'territory.propina_policy',
    'global',
    '*',
  );

  return {
    ...DEFAULT_PROPINA_POLICY,
    ...(override ?? {}),
  };
}

export function resolveTerritoryPropinaRegionProfile(
  catalog: ResolvedGameConfigCatalog,
  regionId: RegionId,
): TerritoryPropinaRegionProfile {
  const override = findConfigObject<Partial<TerritoryPropinaRegionProfile>>(
    catalog,
    'territory.propina_region_profile',
    'region',
    regionId,
  );

  return {
    ...DEFAULT_PROPINA_REGION_PROFILES[regionId],
    ...(override ?? {}),
  };
}

export function resolveRegionalEventMultiplier<TEvent extends { eventType: string; regionId: string | null }>(
  events: TEvent[],
  regionId: string,
  multipliers: Record<string, number> | undefined,
): number {
  if (!multipliers) {
    return 1;
  }

  let multiplier = 1;

  for (const [eventType, factor] of Object.entries(multipliers)) {
    if (
      events.some(
        (event) =>
          event.eventType === eventType && (event.regionId === null || event.regionId === regionId),
      )
    ) {
      multiplier *= factor;
    }
  }

  return multiplier;
}

function requirePropertyDefinitionFallback(type: PropertyType): PropertyDefinitionSummary {
  const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === type);

  if (!definition) {
    throw new Error(`Definição de propriedade inexistente: ${type}`);
  }

  return definition;
}

function requireFavelaServiceDefinitionFallback(
  serviceType: FavelaServiceType,
): FavelaServiceDefinitionSummary {
  const definition = FAVELA_SERVICE_DEFINITIONS.find((entry) => entry.type === serviceType);

  if (!definition) {
    throw new Error(`Definição de serviço de favela inexistente: ${serviceType}`);
  }

  return definition;
}

function findConfigObject<TValue extends Record<string, unknown>>(
  catalog: ResolvedGameConfigCatalog,
  key: string,
  scope: 'global' | 'property_type' | 'region' | 'service_type',
  targetKey: string,
): TValue | null {
  const entry = catalog.entries.find(
    (candidate) =>
      candidate.key === key &&
      candidate.scope === scope &&
      candidate.targetKey === targetKey,
  );

  return entry ? (entry.valueJson as TValue) : null;
}

function mergePropertyEventProfile(
  fallback: PropertyEventProfile,
  override: Partial<PropertyEventProfile> | null,
): PropertyEventProfile {
  return {
    clamps: {
      ...fallback.clamps,
      ...(override?.clamps ?? {}),
    },
    demandMultipliers: {
      ...(fallback.demandMultipliers ?? {}),
      ...(override?.demandMultipliers ?? {}),
    },
    investigationMultipliers: {
      ...(fallback.investigationMultipliers ?? {}),
      ...(override?.investigationMultipliers ?? {}),
    },
    priceMultipliers: {
      ...(fallback.priceMultipliers ?? {}),
      ...(override?.priceMultipliers ?? {}),
    },
    revenueMultipliers: {
      ...(fallback.revenueMultipliers ?? {}),
      ...(override?.revenueMultipliers ?? {}),
    },
    riskDeathMultipliers: {
      ...(fallback.riskDeathMultipliers ?? {}),
      ...(override?.riskDeathMultipliers ?? {}),
    },
    riskDstMultipliers: {
      ...(fallback.riskDstMultipliers ?? {}),
      ...(override?.riskDstMultipliers ?? {}),
    },
    riskEscapeMultipliers: {
      ...(fallback.riskEscapeMultipliers ?? {}),
      ...(override?.riskEscapeMultipliers ?? {}),
    },
    trafficMultipliers: {
      ...(fallback.trafficMultipliers ?? {}),
      ...(override?.trafficMultipliers ?? {}),
    },
    visitorMultipliers: {
      ...(fallback.visitorMultipliers ?? {}),
      ...(override?.visitorMultipliers ?? {}),
    },
  };
}

function buildEmptyCatalogFallback(): ResolvedGameConfigCatalog {
  return {
    activeRoundId: null,
    activeSet: null,
    entries: [],
    featureFlags: [],
    resolvedAt: new Date(0).toISOString(),
  };
}
