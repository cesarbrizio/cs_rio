import { parseArgs } from 'node:util';

import {
  formatAuditLine,
  OpsAuditService,
  type OpsAuditFilters,
} from '../services/ops-audit.js';

type AuditCommandValues = {
  actor?: string;
  'batch-id'?: string;
  command?: string;
  faction?: string;
  favela?: string;
  help?: boolean;
  json?: boolean;
  latest?: string;
  player?: string;
  'round-id'?: string;
  source?: string;
};

const SUPPORTED_SOURCES = ['config', 'player', 'round', 'world'] as const;

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      actor: { type: 'string' },
      'batch-id': { type: 'string' },
      command: { type: 'string' },
      faction: { type: 'string' },
      favela: { type: 'string' },
      help: { type: 'boolean' },
      json: { type: 'boolean' },
      latest: { type: 'string' },
      player: { type: 'string' },
      'round-id': { type: 'string' },
      source: { type: 'string' },
    },
  });

  const values = parsed.values as AuditCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const filters: OpsAuditFilters = {
    actor: values.actor,
    batchId: values['batch-id'],
    command: values.command,
    faction: values.faction,
    favela: values.favela,
    latest: values.latest ? parseLatest(values.latest) : undefined,
    player: values.player,
    roundId: values['round-id'],
    source: values.source ? parseSource(values.source) : undefined,
  };

  const service = new OpsAuditService();
  const entries = await service.listEntries(filters);

  if (values.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log('Nenhuma entrada de auditoria encontrada para os filtros informados.');
    return;
  }

  for (const entry of entries) {
    console.log(formatAuditLine(entry));
  }
}

function parseLatest(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--latest inválido: ${value}. Use um inteiro positivo.`);
  }

  return parsed;
}

function parseSource(value: string): OpsAuditFilters['source'] {
  if (SUPPORTED_SOURCES.includes(value as (typeof SUPPORTED_SOURCES)[number])) {
    return value as OpsAuditFilters['source'];
  }

  throw new Error(
    `--source inválido: ${value}. Use um destes: ${SUPPORTED_SOURCES.join(', ')}.`,
  );
}

function printHelp(): void {
  console.log(`
Uso:
  npm run ops:audit --workspace @cs-rio/server -- --latest 20
  npm run ops:audit --workspace @cs-rio/server -- --player flucesar
  npm run ops:audit --workspace @cs-rio/server -- --faction cv --latest 50
  npm run ops:audit --workspace @cs-rio/server -- --source world --json

Filtros:
  --latest <n>
  --source <config|player|round|world>
  --player <nickname|email|uuid>
  --faction <sigla|nome|uuid>
  --favela <codigo|nome|uuid>
  --round-id <uuid>
  --command <origem>
  --actor <operador>
  --batch-id <uuid>
  --json
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida.';
  console.error(`Falha ao executar ops:audit. ${message}`);
  process.exitCode = 1;
});
