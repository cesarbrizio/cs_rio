import { parseArgs } from 'node:util';

import { RegionId } from '@cs-rio/shared';

import {
  WorldOpsError,
  WorldOpsService,
  type WorldOpsCommand,
  type WorldOpsSelector,
} from '../services/world-ops.js';
import {
  CLI_GUARD_OPTION_DEFINITIONS,
  enforceCliGuardrails,
  parseCliGuardContext,
  type CliGuardValues,
} from './shared/cli-guards.js';

const FACTION_RANKS = ['patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria'] as const;
const FAVELA_STATES = ['neutral', 'controlled', 'at_war', 'state'] as const;
const PROPERTY_TYPES = [
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

type WorldCommandValues = CliGuardValues & {
  actor?: string;
  email?: string;
  'faction-code'?: string;
  'faction-id'?: string;
  'favela-code'?: string;
  'favela-id'?: string;
  help?: boolean;
  nickname?: string;
  origin?: string;
  player?: string;
  'player-id'?: string;
  'property-id'?: string;
  'region-id'?: string;

  'join-faction'?: string;
  'leave-faction'?: boolean;
  'set-rank'?: string;
  'set-faction-bank-money'?: string;
  'set-faction-points'?: string;
  'set-faction-internal-satisfaction'?: string;

  'set-favela-controller'?: string;
  'neutralize-favela'?: boolean;
  'set-favela-satisfaction'?: string;
  'set-favela-state'?: string;
  'set-bandits'?: string;
  'set-max-soldiers'?: string;

  'grant-property'?: string;
  'set-property-level'?: string;
  'set-property-soldiers'?: string;
  'set-property-cash'?: string;
  'set-factory-output'?: string;
  'set-boca-stock'?: string[];
  'set-rave-stock'?: string[];

  'seed-market-offers'?: boolean;
  'clear-market-offers'?: boolean;
  'restock-system-offers'?: boolean;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      actor: { type: 'string' },
      email: { type: 'string' },
      'faction-code': { type: 'string' },
      'faction-id': { type: 'string' },
      'favela-code': { type: 'string' },
      'favela-id': { type: 'string' },
      help: { type: 'boolean' },
      nickname: { type: 'string' },
      origin: { type: 'string' },
      player: { type: 'string' },
      'player-id': { type: 'string' },
      'property-id': { type: 'string' },
      'region-id': { type: 'string' },
      ...CLI_GUARD_OPTION_DEFINITIONS,

      'join-faction': { type: 'string' },
      'leave-faction': { type: 'boolean' },
      'set-rank': { type: 'string' },
      'set-faction-bank-money': { type: 'string' },
      'set-faction-points': { type: 'string' },
      'set-faction-internal-satisfaction': { type: 'string' },

      'set-favela-controller': { type: 'string' },
      'neutralize-favela': { type: 'boolean' },
      'set-favela-satisfaction': { type: 'string' },
      'set-favela-state': { type: 'string' },
      'set-bandits': { type: 'string' },
      'set-max-soldiers': { type: 'string' },

      'grant-property': { type: 'string' },
      'set-property-level': { type: 'string' },
      'set-property-soldiers': { type: 'string' },
      'set-property-cash': { type: 'string' },
      'set-factory-output': { type: 'string' },
      'set-boca-stock': { multiple: true, type: 'string' },
      'set-rave-stock': { multiple: true, type: 'string' },

      'seed-market-offers': { type: 'boolean' },
      'clear-market-offers': { type: 'boolean' },
      'restock-system-offers': { type: 'boolean' },
    },
  });

  const values = parsed.values as WorldCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const selector: WorldOpsSelector = {
    email: values.email,
    factionCode: values['faction-code'],
    factionId: values['faction-id'],
    favelaCode: values['favela-code'],
    favelaId: values['favela-id'],
    nickname: values.nickname,
    player: values.player,
    playerId: values['player-id'],
    propertyId: values['property-id'],
    regionId: values['region-id'] ? parseRegion(values['region-id']) : undefined,
  };
  const actor = values.actor ?? process.env.USER ?? 'local';
  const origin = values.origin ?? 'ops:world';
  const commands = buildCommands(values, actor, origin);
  const guardContext = parseCliGuardContext(values);

  if (commands.length === 0) {
    printHelp();
    throw new WorldOpsError('Nenhuma operação de mundo informada.');
  }

  const guardrails = enforceCliGuardrails(
    'ops:world',
    guardContext,
    commands.map((command) => command.operation.type),
  );

  const service = new WorldOpsService();

  try {
    if (guardContext.dryRun) {
      const result = await service.previewCommands(selector, commands);
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            context: result.context,
            guardrails,
            operations: result.operations,
          },
          null,
          2,
        ),
      );
      return;
    }

    const result = await service.applyCommands(selector, commands);
    console.log(
      JSON.stringify(
        {
          appliedCount: result.applied.length,
          batchId: result.batchId,
          context: result.context,
          guardrails,
          operations: result.applied,
        },
        null,
        2,
      ),
    );
  } finally {
    await service.close();
  }
}

function buildCommands(values: WorldCommandValues, actor: string, origin: string): WorldOpsCommand[] {
  const commands: WorldOpsCommand[] = [];
  const push = (operation: WorldOpsCommand['operation']) => {
    commands.push({ actor, operation, origin });
  };

  if (values['join-faction']) push({ type: 'join-faction', value: values['join-faction'] });
  if (values['leave-faction']) push({ type: 'leave-faction' });
  if (values['set-rank']) push({ type: 'set-rank', value: parseFactionRank(values['set-rank']) });
  if (values['set-faction-bank-money']) {
    push({ type: 'set-faction-bank-money', value: parseNumber(values['set-faction-bank-money'], 'set-faction-bank-money') });
  }
  if (values['set-faction-points']) {
    push({ type: 'set-faction-points', value: parseInteger(values['set-faction-points'], 'set-faction-points') });
  }
  if (values['set-faction-internal-satisfaction']) {
    push({
      type: 'set-faction-internal-satisfaction',
      value: parseInteger(values['set-faction-internal-satisfaction'], 'set-faction-internal-satisfaction'),
    });
  }

  if (values['set-favela-controller']) push({ type: 'set-favela-controller', value: values['set-favela-controller'] });
  if (values['neutralize-favela']) push({ type: 'neutralize-favela' });
  if (values['set-favela-satisfaction']) {
    push({ type: 'set-favela-satisfaction', value: parseInteger(values['set-favela-satisfaction'], 'set-favela-satisfaction') });
  }
  if (values['set-favela-state']) push({ type: 'set-favela-state', value: parseFavelaState(values['set-favela-state']) });
  if (values['set-bandits']) push({ type: 'set-bandits', value: parseInteger(values['set-bandits'], 'set-bandits') });
  if (values['set-max-soldiers']) {
    push({ type: 'set-max-soldiers', value: parseInteger(values['set-max-soldiers'], 'set-max-soldiers') });
  }

  if (values['grant-property']) push({ type: 'grant-property', value: parsePropertyType(values['grant-property']) });
  if (values['set-property-level']) {
    push({ type: 'set-property-level', value: parseInteger(values['set-property-level'], 'set-property-level') });
  }
  if (values['set-property-soldiers']) {
    push({ type: 'set-property-soldiers', value: parseInteger(values['set-property-soldiers'], 'set-property-soldiers') });
  }
  if (values['set-property-cash']) {
    push({ type: 'set-property-cash', value: parseNumber(values['set-property-cash'], 'set-property-cash') });
  }
  if (values['set-factory-output']) {
    push({ type: 'set-factory-output', value: parseInteger(values['set-factory-output'], 'set-factory-output') });
  }

  for (const value of values['set-boca-stock'] ?? []) {
    const parsed = parseBocaStock(value);
    push({ type: 'set-boca-stock', ...parsed });
  }
  for (const value of values['set-rave-stock'] ?? []) {
    const parsed = parseRaveStock(value);
    push({ type: 'set-rave-stock', ...parsed });
  }

  if (values['seed-market-offers']) push({ type: 'seed-market-offers' });
  if (values['clear-market-offers']) push({ type: 'clear-market-offers' });
  if (values['restock-system-offers']) push({ type: 'restock-system-offers' });

  return commands;
}

function parseRegion(value: string): RegionId {
  if (Object.values(RegionId).includes(value as RegionId)) {
    return value as RegionId;
  }
  throw new WorldOpsError(`Região inválida: ${value}.`);
}

function parseFactionRank(value: string) {
  if (FACTION_RANKS.includes(value as (typeof FACTION_RANKS)[number])) {
    return value as (typeof FACTION_RANKS)[number];
  }
  throw new WorldOpsError(`Rank inválido: ${value}.`);
}

function parseFavelaState(value: string) {
  if (FAVELA_STATES.includes(value as (typeof FAVELA_STATES)[number])) {
    return value as (typeof FAVELA_STATES)[number];
  }
  throw new WorldOpsError(`Estado de favela inválido: ${value}.`);
}

function parsePropertyType(value: string) {
  if (PROPERTY_TYPES.includes(value as (typeof PROPERTY_TYPES)[number])) {
    return value as (typeof PROPERTY_TYPES)[number];
  }
  throw new WorldOpsError(`Tipo de propriedade inválido: ${value}.`);
}

function parseBocaStock(value: string): { drugCodeOrId: string; quantity: number } {
  const [drugCodeOrId, quantity] = value.split(':');
  if (!drugCodeOrId || !quantity) {
    throw new WorldOpsError(`set-boca-stock inválido: ${value}. Use droga:quantidade.`);
  }
  return {
    drugCodeOrId,
    quantity: parseInteger(quantity, 'set-boca-stock'),
  };
}

function parseRaveStock(value: string): { drugCodeOrId: string; priceMultiplier?: number; quantity: number } {
  const parts = value.split(':');
  const [drugCodeOrId, quantity, multiplier] = parts;
  if (!drugCodeOrId || !quantity || parts.length > 3) {
    throw new WorldOpsError(`set-rave-stock inválido: ${value}. Use droga:quantidade[:multiplicador].`);
  }
  return {
    drugCodeOrId,
    priceMultiplier: multiplier ? parseNumber(multiplier, 'set-rave-stock') : undefined,
    quantity: parseInteger(quantity, 'set-rave-stock'),
  };
}

function parseNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new WorldOpsError(`${flag} exige um número válido.`);
  }
  return parsed;
}

function parseInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new WorldOpsError(`${flag} exige um número inteiro.`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`
Uso:
  npm run ops:world --workspace @cs-rio/server -- [selector] [operations]

Seletores:
  --player <nickname|email|uuid>
  --player-id <uuid>
  --nickname <nickname>
  --email <email>
  --faction-id <uuid>
  --faction-code <sigla|templateCode|nome>
  --favela-id <uuid>
  --favela-code <codigo>
  --property-id <uuid>
  --region-id <region>
  --dry-run
  --confirm

Facção:
  --join-faction <sigla|uuid|templateCode>
  --leave-faction
  --set-rank <patrao|general|gerente|vapor|soldado|cria>
  --set-faction-bank-money <valor>
  --set-faction-points <valor>
  --set-faction-internal-satisfaction <0-100>

Território:
  --set-favela-controller <sigla|uuid|neutral>
  --neutralize-favela
  --set-favela-satisfaction <0-100>
  --set-favela-state <neutral|controlled|at_war|state>
  --set-bandits <qtd>
  --set-max-soldiers <qtd>

Propriedades e negócios:
  --grant-property <tipo>
  --set-property-level <nivel>
  --set-property-soldiers <qtd>
  --set-property-cash <valor>
  --set-factory-output <qtd>
  --set-boca-stock <droga:quantidade>
  --set-rave-stock <droga:quantidade[:multiplicador]>

Mercado:
  --seed-market-offers
  --clear-market-offers
  --restock-system-offers
`);
}

main().catch((error: unknown) => {
  if (error instanceof WorldOpsError) {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
