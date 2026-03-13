import { parseArgs } from 'node:util';

import { RegionId } from '@cs-rio/shared';

import {
  RoundOpsError,
  RoundOpsService,
  type RoundOpsCommand,
  type RoundOpsSelector,
} from '../services/round-ops.js';
import {
  CLI_GUARD_OPTION_DEFINITIONS,
  enforceCliGuardrails,
  parseCliGuardContext,
  type CliGuardValues,
} from './shared/cli-guards.js';

const CONFIGURABLE_EVENT_TYPES = [
  'navio_docas',
  'operacao_policial',
  'blitz_pm',
  'faca_na_caveira',
  'saidinha_natal',
  'carnaval',
  'ano_novo_copa',
  'operacao_verao',
] as const;

type ConfigurableEventType = (typeof CONFIGURABLE_EVENT_TYPES)[number];

type RoundCommandValues = CliGuardValues & {
  actor?: string;
  help?: boolean;
  origin?: string;
  'round-id'?: string;
  'round-number'?: string;
  'region-id'?: string;
  'favela-code'?: string;
  'favela-id'?: string;

  'set-round-day'?: string;
  'finish-round'?: boolean;
  'start-next-round'?: boolean;
  'snapshot-round-state'?: boolean;
  'trigger-event'?: string;
  'expire-event'?: string;
  'enable-event'?: string;
  'disable-event'?: string;
  'reseed-fixed-factions'?: boolean;
  'reseed-territories'?: boolean;
  'reseed-system-market'?: boolean;
  'rebuild-world-state'?: boolean;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      actor: { type: 'string' },
      help: { type: 'boolean' },
      origin: { type: 'string' },
      'round-id': { type: 'string' },
      'round-number': { type: 'string' },
      'region-id': { type: 'string' },
      'favela-code': { type: 'string' },
      'favela-id': { type: 'string' },
      ...CLI_GUARD_OPTION_DEFINITIONS,

      'set-round-day': { type: 'string' },
      'finish-round': { type: 'boolean' },
      'start-next-round': { type: 'boolean' },
      'snapshot-round-state': { type: 'boolean' },
      'trigger-event': { type: 'string' },
      'expire-event': { type: 'string' },
      'enable-event': { type: 'string' },
      'disable-event': { type: 'string' },
      'reseed-fixed-factions': { type: 'boolean' },
      'reseed-territories': { type: 'boolean' },
      'reseed-system-market': { type: 'boolean' },
      'rebuild-world-state': { type: 'boolean' },
    },
  });

  const values = parsed.values as RoundCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const selector: RoundOpsSelector = {
    favelaCode: values['favela-code'],
    favelaId: values['favela-id'],
    regionId: values['region-id'] ? parseRegion(values['region-id']) : undefined,
    roundId: values['round-id'],
    roundNumber: values['round-number']
      ? parseInteger(values['round-number'], 'round-number')
      : undefined,
  };
  const actor = values.actor ?? process.env.USER ?? 'local';
  const origin = values.origin ?? 'ops:round';
  const commands = buildCommands(values, actor, origin, selector);
  const guardContext = parseCliGuardContext(values);

  if (commands.length === 0) {
    printHelp();
    throw new RoundOpsError('Nenhuma operação de rodada foi informada.');
  }

  const guardrails = enforceCliGuardrails(
    'ops:round',
    guardContext,
    commands.map((command) => command.operation.type),
  );

  const service = new RoundOpsService();

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

function buildCommands(
  values: RoundCommandValues,
  actor: string,
  origin: string,
  selector: RoundOpsSelector,
): RoundOpsCommand[] {
  const commands: RoundOpsCommand[] = [];
  const push = (operation: RoundOpsCommand['operation']) => {
    commands.push({ actor, operation, origin });
  };

  if (values['set-round-day']) {
    push({
      type: 'set-round-day',
      value: parseInteger(values['set-round-day'], 'set-round-day'),
    });
  }
  if (values['finish-round']) push({ type: 'finish-round' });
  if (values['start-next-round']) push({ type: 'start-next-round' });
  if (values['snapshot-round-state']) push({ type: 'snapshot-round-state' });
  if (values['trigger-event']) {
    push({
      type: 'trigger-event',
      eventType: parseEventType(values['trigger-event']),
      favelaCode: selector.favelaCode,
      favelaId: selector.favelaId,
      regionId: selector.regionId,
    });
  }
  if (values['expire-event']) {
    push({
      type: 'expire-event',
      eventType: parseEventType(values['expire-event']),
      favelaCode: selector.favelaCode,
      favelaId: selector.favelaId,
      regionId: selector.regionId,
    });
  }
  if (values['enable-event']) {
    push({ type: 'enable-event', eventType: parseEventType(values['enable-event']) });
  }
  if (values['disable-event']) {
    push({ type: 'disable-event', eventType: parseEventType(values['disable-event']) });
  }
  if (values['reseed-fixed-factions']) push({ type: 'reseed-fixed-factions' });
  if (values['reseed-territories']) push({ type: 'reseed-territories' });
  if (values['reseed-system-market']) push({ type: 'reseed-system-market' });
  if (values['rebuild-world-state']) push({ type: 'rebuild-world-state' });

  return commands;
}

function parseEventType(value: string): ConfigurableEventType {
  if (CONFIGURABLE_EVENT_TYPES.includes(value as ConfigurableEventType)) {
    return value as ConfigurableEventType;
  }

  throw new RoundOpsError(
    `Evento inválido: ${value}. Use um destes: ${CONFIGURABLE_EVENT_TYPES.join(', ')}.`,
  );
}

function parseInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new RoundOpsError(`${label} precisa ser um número inteiro.`);
  }

  return parsed;
}

function parseRegion(value: string): RegionId {
  if (Object.values(RegionId).includes(value as RegionId)) {
    return value as RegionId;
  }

  throw new RoundOpsError(
    `Região inválida: ${value}. Use uma destas: ${Object.values(RegionId).join(', ')}.`,
  );
}

function printHelp(): void {
  console.log(`
Uso:
  npm run ops:round --workspace @cs-rio/server -- --set-round-day 12
  npm run ops:round --workspace @cs-rio/server -- --trigger-event navio_docas --region-id centro
  npm run ops:round --workspace @cs-rio/server -- --expire-event operacao_policial --favela-code complexo_da_penha
  npm run ops:round --workspace @cs-rio/server -- --enable-event carnaval --round-number 2
  npm run ops:round --workspace @cs-rio/server -- --reseed-territories

Seletores:
  --round-id <uuid>
  --round-number <n>
  --region-id <centro|zona_norte|zona_sul|zona_oeste|zona_sudoeste|baixada>
  --favela-code <codigo>
  --favela-id <uuid>
  --dry-run
  --confirm

Operações:
  --set-round-day <n>
  --finish-round
  --start-next-round
  --snapshot-round-state
  --trigger-event <tipo>
  --expire-event <tipo>
  --enable-event <tipo>
  --disable-event <tipo>
  --reseed-fixed-factions
  --reseed-territories
  --reseed-system-market
  --rebuild-world-state

Eventos suportados:
  ${CONFIGURABLE_EVENT_TYPES.join(', ')}
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida.';
  console.error(`Falha ao executar ops:round. ${message}`);
  process.exitCode = 1;
});
