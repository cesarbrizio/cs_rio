import { parseArgs } from 'node:util';

import { RegionId } from '@cs-rio/shared';
import { and, asc, eq, ilike, or } from 'drizzle-orm';

import { db, pool } from '../db/client.js';
import { factions, favelas, players, regions } from '../db/schema.js';
import { listBuiltInScenarios } from './scenarios/index.js';

const LIST_TYPES = ['players', 'users', 'factions', 'favelas', 'regions', 'scenarios'] as const;
const REGION_IDS: RegionId[] = [
  RegionId.Centro,
  RegionId.ZonaNorte,
  RegionId.ZonaSul,
  RegionId.ZonaOeste,
  RegionId.ZonaSudoeste,
  RegionId.Baixada,
];

type ListType = (typeof LIST_TYPES)[number];

type ListCommandValues = {
  all?: boolean;
  faction?: string;
  'fixed-only'?: boolean;
  help?: boolean;
  json?: boolean;
  limit?: string;
  region?: string;
  search?: string;
  type?: string;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      all: { type: 'boolean' },
      faction: { type: 'string' },
      'fixed-only': { type: 'boolean' },
      help: { type: 'boolean' },
      json: { type: 'boolean' },
      limit: { type: 'string' },
      region: { type: 'string' },
      search: { type: 'string' },
      type: { type: 'string' },
    },
  });

  const values = parsed.values as ListCommandValues;

  if (values.help || !values.type) {
    printHelp();
    return;
  }

  const type = parseType(values.type);
  const limit = values.limit ? parseLimit(values.limit) : 100;

  try {
    const rows = await listEntries({
      faction: values.faction,
      fixedOnly: Boolean(values['fixed-only']),
      includeInactive: Boolean(values.all),
      limit,
      region: values.region ? parseRegion(values.region) : undefined,
      search: values.search,
      type,
    });

    if (values.json) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }

    if (rows.length === 0) {
      console.log('Nenhum resultado encontrado para os filtros informados.');
      return;
    }

    console.table(rows);
  } finally {
    await pool.end();
  }
}

async function listEntries(input: {
  faction?: string;
  fixedOnly: boolean;
  includeInactive: boolean;
  limit: number;
  region?: RegionId;
  search?: string;
  type: ListType;
}): Promise<Record<string, unknown>[]> {
  switch (input.type) {
    case 'players':
    case 'users':
      return listPlayers(input);
    case 'factions':
      return listFactions(input);
    case 'favelas':
      return listFavelas(input);
    case 'regions':
      return listRegions(input);
    case 'scenarios':
      return listScenarios(input.limit, input.search);
  }
}

async function listPlayers(input: {
  faction?: string;
  limit: number;
  region?: RegionId;
  search?: string;
}): Promise<Record<string, unknown>[]> {
  const conditions = [];

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(or(ilike(players.nickname, term), ilike(players.email, term)));
  }

  if (input.region) {
    conditions.push(eq(players.regionId, input.region));
  }

  if (input.faction) {
    const factionId = await resolveFactionId(input.faction);
    conditions.push(eq(players.factionId, factionId));
  }

  const rows = await db
    .select({
      bankMoney: players.bankMoney,
      conceito: players.conceito,
      credits: players.credits,
      email: players.email,
      faction: factions.abbreviation,
      factionId: players.factionId,
      id: players.id,
      level: players.level,
      money: players.money,
      nickname: players.nickname,
      region: regions.name,
      regionId: players.regionId,
      vocation: players.vocation,
    })
    .from(players)
    .leftJoin(factions, eq(players.factionId, factions.id))
    .leftJoin(regions, eq(players.regionId, regions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(players.nickname))
    .limit(input.limit);

  return rows.map((row) => ({
    bankMoney: row.bankMoney,
    conceito: row.conceito,
    credits: row.credits,
    email: row.email,
    faction: row.faction ?? 'sem faccao',
    id: row.id,
    level: row.level,
    money: row.money,
    nickname: row.nickname,
    region: row.region ?? row.regionId,
    vocation: row.vocation,
  }));
}

async function listFactions(input: {
  fixedOnly: boolean;
  includeInactive: boolean;
  limit: number;
  search?: string;
}): Promise<Record<string, unknown>[]> {
  const conditions = [];

  if (!input.includeInactive) {
    conditions.push(eq(factions.isActive, true));
  }

  if (input.fixedOnly) {
    conditions.push(eq(factions.isFixed, true));
  }

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(
      or(
        ilike(factions.name, term),
        ilike(factions.abbreviation, term),
        ilike(factions.templateCode, term),
      ),
    );
  }

  const rows = await db
    .select({
      abbreviation: factions.abbreviation,
      bankMoney: factions.bankMoney,
      id: factions.id,
      internalSatisfaction: factions.internalSatisfaction,
      isActive: factions.isActive,
      isFixed: factions.isFixed,
      name: factions.name,
      points: factions.points,
      sortOrder: factions.sortOrder,
      templateCode: factions.templateCode,
    })
    .from(factions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(factions.sortOrder), asc(factions.name))
    .limit(input.limit);

  return rows;
}

async function listFavelas(input: {
  includeInactive: boolean;
  limit: number;
  region?: RegionId;
  search?: string;
}): Promise<Record<string, unknown>[]> {
  const conditions = [];

  if (!input.includeInactive) {
    conditions.push(eq(favelas.isActive, true));
  }

  if (input.region) {
    conditions.push(eq(favelas.regionId, input.region));
  }

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(or(ilike(favelas.name, term), ilike(favelas.code, term)));
  }

  const rows = await db
    .select({
      code: favelas.code,
      controller: factions.abbreviation,
      difficulty: favelas.difficulty,
      id: favelas.id,
      maxSoldiers: favelas.maxSoldiers,
      name: favelas.name,
      population: favelas.population,
      region: regions.name,
      regionId: favelas.regionId,
      satisfaction: favelas.satisfaction,
      sortOrder: favelas.sortOrder,
      state: favelas.state,
    })
    .from(favelas)
    .leftJoin(factions, eq(favelas.controllingFactionId, factions.id))
    .leftJoin(regions, eq(favelas.regionId, regions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(favelas.regionId), asc(favelas.sortOrder), asc(favelas.name))
    .limit(input.limit);

  return rows.map((row) => ({
    code: row.code,
    controller: row.controller ?? 'neutra',
    difficulty: row.difficulty,
    id: row.id,
    maxSoldiers: row.maxSoldiers,
    name: row.name,
    population: row.population,
    region: row.region ?? row.regionId,
    satisfaction: row.satisfaction,
    state: row.state,
  }));
}

async function listRegions(input: {
  includeInactive: boolean;
  limit: number;
  search?: string;
}): Promise<Record<string, unknown>[]> {
  const conditions = [];

  if (!input.includeInactive) {
    conditions.push(eq(regions.isActive, true));
  }

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(or(ilike(regions.id, term), ilike(regions.name, term)));
  }

  const rows = await db
    .select({
      defaultSpawn: regions.isDefaultSpawn,
      density: regions.densityLabel,
      dominationBonus: regions.dominationBonus,
      id: regions.id,
      isActive: regions.isActive,
      name: regions.name,
      policePressure: regions.policePressure,
      spawnX: regions.spawnPositionX,
      spawnY: regions.spawnPositionY,
      wealth: regions.wealthLabel,
    })
    .from(regions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(regions.sortOrder), asc(regions.name))
    .limit(input.limit);

  return rows;
}

async function listScenarios(limit: number, search?: string): Promise<Record<string, unknown>[]> {
  const term = search?.toLowerCase().trim();

  return listBuiltInScenarios()
    .filter((entry) => {
      if (!term) return true;
      return entry.name.toLowerCase().includes(term) || entry.description.toLowerCase().includes(term);
    })
    .slice(0, limit)
    .map((entry) => ({
      description: entry.description,
      name: entry.name,
    }));
}

async function resolveFactionId(selector: string): Promise<string> {
  const upper = selector.toUpperCase();

  const [row] = await db
    .select({ id: factions.id })
    .from(factions)
    .where(
      or(
        eq(factions.id, selector),
        eq(factions.abbreviation, upper),
        eq(factions.name, selector),
        eq(factions.templateCode, selector),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error(`Facção não encontrada para filtro: ${selector}`);
  }

  return row.id;
}

function parseType(value: string): ListType {
  if (LIST_TYPES.includes(value as ListType)) {
    return value as ListType;
  }

  throw new Error(`--type inválido: ${value}. Use um destes: ${LIST_TYPES.join(', ')}.`);
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 5000) {
    throw new Error(`--limit inválido: ${value}. Use um inteiro entre 1 e 5000.`);
  }
  return parsed;
}

function parseRegion(value: string): RegionId {
  if (REGION_IDS.includes(value as RegionId)) {
    return value as RegionId;
  }

  throw new Error(`--region inválido: ${value}. Use um destes: ${REGION_IDS.join(', ')}.`);
}

function printHelp(): void {
  console.log(`
Uso:
  npm run ops:list --workspace @cs-rio/server -- --type players
  npm run ops:list --workspace @cs-rio/server -- --type factions
  npm run ops:list --workspace @cs-rio/server -- --type favelas --region zona_norte
  npm run ops:list --workspace @cs-rio/server -- --type players --faction cv
  npm run ops:list --workspace @cs-rio/server -- --type scenarios

Tipos:
  --type <players|users|factions|favelas|regions|scenarios>

Filtros:
  --search <texto>
  --region <centro|zona_norte|zona_sul|zona_oeste|zona_sudoeste|baixada>
  --faction <sigla|nome|template|uuid>
  --fixed-only
  --all
  --limit <n>
  --json

Notas:
  - players/users: lista contas jogáveis com região e facção atual.
  - factions: lista facções por nome, sigla e UUID.
  - favelas: lista nome, código, região, estado e controlador.
  - regions: lista regiões ativas e seus metadados.
  - scenarios: lista cenários built-in disponíveis para ops:scenario.
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida.';
  console.error(`Falha ao executar ops:list. ${message}`);
  process.exitCode = 1;
});
