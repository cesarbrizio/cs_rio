import {
  RegionId,
  type FactionRank,
  type FactionRobberyPolicy,
  type FactionRobberyPolicyMode,
  type ResolvedGameConfigCatalog,
} from '@cs-rio/shared';

const KNOWN_FACTION_RANKS: FactionRank[] = [
  'patrao',
  'general',
  'gerente',
  'vapor',
  'soldado',
  'cria',
];

const DEFAULT_ROUND_TOTAL_GAME_DAYS = 156;
const DEFAULT_ROUND_GAME_DAY_REAL_HOURS = 6;
const DEFAULT_ROUND_TOP_TEN_CREDIT_REWARD = 5;
const DEFAULT_FACTION_INTERNAL_SATISFACTION = 50;

const DEFAULT_CRIME_POLICY = {
  minimumPowerRatio: 0.5,
  prisonMinutesPerLevel: 6,
} as const;

const DEFAULT_FACTION_CRIME_POLICY = {
  coordinationBonusPerExtraMember: 0.03,
  coordinatorRanks: ['patrao', 'general', 'gerente'] as FactionRank[],
  maxBustedChance: 0.85,
  maxCrewSize: 6,
  minBustedChance: 0.08,
  minCrewSize: 2,
} as const;

const DEFAULT_TERRITORY_CONQUEST_POLICY = {
  commandRanks: ['patrao', 'general'] as FactionRank[],
  coordinationBonusPerExtraMember: 0.03,
  managementRanks: ['patrao', 'general', 'gerente'] as FactionRank[],
  maxCrewSize: 6,
  minCrewSize: 2,
  stabilizationHours: 24,
} as const;

const DEFAULT_FACTION_ROBBERY_POLICY: FactionRobberyPolicy = {
  global: 'allowed',
  regions: {},
};

export interface RoundLifecycleConfig {
  gameDayRealHours: number;
  gameDayRealMs: number;
  realDurationMs: number;
  topTenCreditReward: number;
  totalGameDays: number;
}

export interface CrimePolicyProfile {
  minimumPowerRatio: number;
  prisonMinutesPerLevel: number;
}

export interface FactionCrimePolicyProfile {
  coordinationBonusPerExtraMember: number;
  coordinatorRanks: FactionRank[];
  maxBustedChance: number;
  maxCrewSize: number;
  minBustedChance: number;
  minCrewSize: number;
}

export interface TerritoryConquestPolicyProfile {
  commandRanks: FactionRank[];
  coordinationBonusPerExtraMember: number;
  managementRanks: FactionRank[];
  maxCrewSize: number;
  minCrewSize: number;
  stabilizationHours: number;
}

export function buildEmptyResolvedCatalog(): ResolvedGameConfigCatalog {
  return {
    activeRoundId: null,
    activeSet: null,
    entries: [],
    featureFlags: [],
    resolvedAt: new Date(0).toISOString(),
  };
}

export function resolveRoundLifecycleConfig(
  catalog: ResolvedGameConfigCatalog,
): RoundLifecycleConfig {
  const totalGameDays = clampInteger(
    readGlobalScalarNumber(catalog, 'round.total_game_days', DEFAULT_ROUND_TOTAL_GAME_DAYS),
    1,
    10_000,
  );
  const gameDayRealHours = clampNumber(
    readGlobalScalarNumber(
      catalog,
      'round.game_day_real_hours',
      DEFAULT_ROUND_GAME_DAY_REAL_HOURS,
    ),
    1 / 60,
    24 * 365,
  );
  const topTenCreditReward = clampInteger(
    readGlobalScalarNumber(
      catalog,
      'round.top_ten_credit_reward',
      DEFAULT_ROUND_TOP_TEN_CREDIT_REWARD,
    ),
    0,
    1_000_000,
  );
  const gameDayRealMs = Math.round(gameDayRealHours * 60 * 60 * 1000);

  return {
    gameDayRealHours,
    gameDayRealMs,
    realDurationMs: totalGameDays * gameDayRealMs,
    topTenCreditReward,
    totalGameDays,
  };
}

export function resolveFactionInternalSatisfactionDefault(
  catalog: ResolvedGameConfigCatalog,
): number {
  return clampInteger(
    readGlobalScalarNumber(
      catalog,
      'faction.default_internal_satisfaction',
      DEFAULT_FACTION_INTERNAL_SATISFACTION,
    ),
    0,
    100,
  );
}

export function resolveCrimePolicy(catalog: ResolvedGameConfigCatalog): CrimePolicyProfile {
  const override = findGlobalConfigObject<Partial<CrimePolicyProfile>>(catalog, 'crime.policy');

  return {
    minimumPowerRatio: clampNumber(
      readNumber(override?.minimumPowerRatio, DEFAULT_CRIME_POLICY.minimumPowerRatio),
      0.05,
      1,
    ),
    prisonMinutesPerLevel: clampInteger(
      readNumber(
        override?.prisonMinutesPerLevel,
        DEFAULT_CRIME_POLICY.prisonMinutesPerLevel,
      ),
      1,
      1_440,
    ),
  };
}

export function resolveFactionCrimePolicy(
  catalog: ResolvedGameConfigCatalog,
): FactionCrimePolicyProfile {
  const override = findGlobalConfigObject<Partial<FactionCrimePolicyProfile>>(
    catalog,
    'faction_crime.policy',
  );
  const minCrewSize = clampInteger(
    readNumber(override?.minCrewSize, DEFAULT_FACTION_CRIME_POLICY.minCrewSize),
    1,
    100,
  );
  const maxCrewSize = Math.max(
    minCrewSize,
    clampInteger(
      readNumber(override?.maxCrewSize, DEFAULT_FACTION_CRIME_POLICY.maxCrewSize),
      1,
      100,
    ),
  );
  const minBustedChance = clampNumber(
    readNumber(
      override?.minBustedChance,
      DEFAULT_FACTION_CRIME_POLICY.minBustedChance,
    ),
    0,
    1,
  );
  const maxBustedChance = Math.max(
    minBustedChance,
    clampNumber(
      readNumber(
        override?.maxBustedChance,
        DEFAULT_FACTION_CRIME_POLICY.maxBustedChance,
      ),
      0,
      1,
    ),
  );

  return {
    coordinationBonusPerExtraMember: clampNumber(
      readNumber(
        override?.coordinationBonusPerExtraMember,
        DEFAULT_FACTION_CRIME_POLICY.coordinationBonusPerExtraMember,
      ),
      0,
      1,
    ),
    coordinatorRanks: sanitizeFactionRanks(
      override?.coordinatorRanks,
      DEFAULT_FACTION_CRIME_POLICY.coordinatorRanks,
    ),
    maxBustedChance,
    maxCrewSize,
    minBustedChance,
    minCrewSize,
  };
}

export function resolveTerritoryConquestPolicy(
  catalog: ResolvedGameConfigCatalog,
): TerritoryConquestPolicyProfile {
  const override = findGlobalConfigObject<Partial<TerritoryConquestPolicyProfile>>(
    catalog,
    'territory.conquest_policy',
  );
  const minCrewSize = clampInteger(
    readNumber(override?.minCrewSize, DEFAULT_TERRITORY_CONQUEST_POLICY.minCrewSize),
    1,
    100,
  );
  const maxCrewSize = Math.max(
    minCrewSize,
    clampInteger(
      readNumber(override?.maxCrewSize, DEFAULT_TERRITORY_CONQUEST_POLICY.maxCrewSize),
      1,
      100,
    ),
  );

  return {
    commandRanks: sanitizeFactionRanks(
      override?.commandRanks,
      DEFAULT_TERRITORY_CONQUEST_POLICY.commandRanks,
    ),
    coordinationBonusPerExtraMember: clampNumber(
      readNumber(
        override?.coordinationBonusPerExtraMember,
        DEFAULT_TERRITORY_CONQUEST_POLICY.coordinationBonusPerExtraMember,
      ),
      0,
      1,
    ),
    managementRanks: sanitizeFactionRanks(
      override?.managementRanks,
      DEFAULT_TERRITORY_CONQUEST_POLICY.managementRanks,
    ),
    maxCrewSize,
    minCrewSize,
    stabilizationHours: clampInteger(
      readNumber(
        override?.stabilizationHours,
        DEFAULT_TERRITORY_CONQUEST_POLICY.stabilizationHours,
      ),
      1,
      24 * 365,
    ),
  };
}

export function resolveDefaultFactionRobberyPolicy(
  catalog: ResolvedGameConfigCatalog,
): FactionRobberyPolicy {
  const override = findGlobalConfigObject<Partial<FactionRobberyPolicy>>(
    catalog,
    'faction.default_robbery_policy',
  );

  return normalizeFactionRobberyPolicy(
    override ?? DEFAULT_FACTION_ROBBERY_POLICY,
    DEFAULT_FACTION_ROBBERY_POLICY,
  );
}

function findGlobalConfigObject<TValue extends Record<string, unknown>>(
  catalog: ResolvedGameConfigCatalog,
  key: string,
): TValue | null {
  const entry = catalog.entries.find(
    (candidate) =>
      candidate.key === key &&
      candidate.scope === 'global' &&
      candidate.targetKey === '*',
  );

  return entry ? (entry.valueJson as TValue) : null;
}

function readGlobalScalarNumber(
  catalog: ResolvedGameConfigCatalog,
  key: string,
  fallback: number,
): number {
  const entry = findGlobalConfigObject<{ value?: unknown }>(catalog, key);
  return readNumber(entry?.value, fallback);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clampNumber(value, min, max));
}

function sanitizeFactionRanks(
  value: unknown,
  fallback: FactionRank[],
): FactionRank[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const filtered = value.filter(
    (entry): entry is FactionRank =>
      typeof entry === 'string' && KNOWN_FACTION_RANKS.includes(entry as FactionRank),
  );

  return filtered.length > 0 ? [...new Set(filtered)] : [...fallback];
}

function normalizeFactionRobberyPolicy(
  policy: Partial<FactionRobberyPolicy>,
  fallback: FactionRobberyPolicy,
): FactionRobberyPolicy {
  const global = isFactionRobberyPolicyMode(policy.global) ? policy.global : fallback.global;
  const regions: Partial<Record<RegionId, FactionRobberyPolicyMode>> = {};

  if (policy.regions && typeof policy.regions === 'object') {
    for (const [regionId, mode] of Object.entries(policy.regions)) {
      if (isRegionId(regionId) && isFactionRobberyPolicyMode(mode)) {
        regions[regionId] = mode;
      }
    }
  }

  return {
    global,
    regions,
  };
}

function isRegionId(value: string): value is RegionId {
  return Object.values(RegionId).includes(value as RegionId);
}

function isFactionRobberyPolicyMode(value: unknown): value is FactionRobberyPolicyMode {
  return value === 'allowed' || value === 'forbidden';
}
