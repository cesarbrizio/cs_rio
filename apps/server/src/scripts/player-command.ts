import { parseArgs } from 'node:util';

import { RegionId, VocationType, type InventoryEquipSlot } from '@cs-rio/shared';

import { PlayerOpsError, PlayerOpsService, type PlayerOpsCommand, type PlayerOpsSelector } from '../services/player-ops.js';
import {
  CLI_GUARD_OPTION_DEFINITIONS,
  enforceCliGuardrails,
  parseCliGuardContext,
  type CliGuardValues,
} from './shared/cli-guards.js';

type PlayerCommandValues = CliGuardValues & {
  actor?: string;
  email?: string;
  'player-id'?: string;
  player?: string;
  nickname?: string;
  origin?: string;
  help?: boolean;
  'set-money'?: string;
  'add-money'?: string;
  'set-bank-money'?: string;
  'add-bank-money'?: string;
  'set-hp'?: string;
  'set-cansaco'?: string;
  'set-disposicao'?: string;
  'set-brisa'?: string;
  'set-addiction'?: string;
  'full-resources'?: boolean;
  'set-conceito'?: string;
  'set-level'?: string;
  'set-vocation'?: string;
  'set-region'?: string;
  'set-position'?: string;
  'move-to-region-spawn'?: boolean;
  'clear-prison'?: boolean;
  'set-prison-minutes'?: string;
  'clear-hospital'?: boolean;
  'set-hospital-minutes'?: string;
  'grant-item'?: string[];
  'remove-item'?: string[];
  'set-item-quantity'?: string[];
  'equip-item'?: string[];
  'unequip-item'?: string[];
  'repair-all'?: boolean;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      actor: { type: 'string' },
      email: { type: 'string' },
      'player-id': { type: 'string' },
      player: { type: 'string' },
      nickname: { type: 'string' },
      origin: { type: 'string' },
      help: { type: 'boolean' },
      ...CLI_GUARD_OPTION_DEFINITIONS,

      'set-money': { type: 'string' },
      'add-money': { type: 'string' },
      'set-bank-money': { type: 'string' },
      'add-bank-money': { type: 'string' },

      'set-hp': { type: 'string' },
      'set-cansaco': { type: 'string' },
      'set-disposicao': { type: 'string' },
      'set-brisa': { type: 'string' },
      'set-addiction': { type: 'string' },
      'full-resources': { type: 'boolean' },

      'set-conceito': { type: 'string' },
      'set-level': { type: 'string' },
      'set-vocation': { type: 'string' },

      'set-region': { type: 'string' },
      'set-position': { type: 'string' },
      'move-to-region-spawn': { type: 'boolean' },

      'clear-prison': { type: 'boolean' },
      'set-prison-minutes': { type: 'string' },
      'clear-hospital': { type: 'boolean' },
      'set-hospital-minutes': { type: 'string' },

      'grant-item': { multiple: true, type: 'string' },
      'remove-item': { multiple: true, type: 'string' },
      'set-item-quantity': { multiple: true, type: 'string' },
      'equip-item': { multiple: true, type: 'string' },
      'unequip-item': { multiple: true, type: 'string' },
      'repair-all': { type: 'boolean' },
    },
  });

  const values = parsed.values as PlayerCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const selector: PlayerOpsSelector = {
    email: values.email,
    nickname: values.nickname,
    player: values.player,
    playerId: values['player-id'],
  };
  const actor = values.actor ?? process.env.USER ?? 'local';
  const origin = values.origin ?? 'ops:player';
  const commands = buildCommands(values, actor, origin);
  const guardContext = parseCliGuardContext(values);

  if (commands.length === 0) {
    printHelp();
    throw new PlayerOpsError('Nenhuma operação informada.');
  }

  const guardrails = enforceCliGuardrails(
    'ops:player',
    guardContext,
    commands.map((command) => command.operation.type),
  );

  const service = new PlayerOpsService();

  try {
    if (guardContext.dryRun) {
      const result = await service.previewCommands(selector, commands);
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            guardrails,
            operations: result.operations,
            player: result.player,
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
          guardrails,
          operations: result.applied,
          player: result.player,
        },
        null,
        2,
      ),
    );
  } finally {
    await service.close();
  }
}

function buildCommands(values: PlayerCommandValues, actor: string, origin: string): PlayerOpsCommand[] {
  const commands: PlayerOpsCommand[] = [];

  const push = (operation: PlayerOpsCommand['operation']) => {
    commands.push({ actor, operation, origin });
  };

  if (values['set-money']) push({ type: 'set-money', value: parseNumber(values['set-money'], 'set-money') });
  if (values['add-money']) push({ type: 'add-money', value: parseNumber(values['add-money'], 'add-money') });
  if (values['set-bank-money']) push({ type: 'set-bank-money', value: parseNumber(values['set-bank-money'], 'set-bank-money') });
  if (values['add-bank-money']) push({ type: 'add-bank-money', value: parseNumber(values['add-bank-money'], 'add-bank-money') });

  if (values['set-hp']) push({ type: 'set-hp', value: parseIntFlag(values['set-hp'], 'set-hp') });
  if (values['set-cansaco']) push({ type: 'set-cansaco', value: parseIntFlag(values['set-cansaco'], 'set-cansaco') });
  if (values['set-disposicao']) push({ type: 'set-disposicao', value: parseIntFlag(values['set-disposicao'], 'set-disposicao') });
  if (values['set-brisa']) push({ type: 'set-brisa', value: parseIntFlag(values['set-brisa'], 'set-brisa') });
  if (values['set-addiction']) push({ type: 'set-addiction', value: parseIntFlag(values['set-addiction'], 'set-addiction') });
  if (values['full-resources']) push({ type: 'full-resources' });

  if (values['set-conceito']) push({ type: 'set-conceito', value: parseIntFlag(values['set-conceito'], 'set-conceito') });
  if (values['set-level']) push({ type: 'set-level', value: parseIntFlag(values['set-level'], 'set-level') });
  if (values['set-vocation']) push({ type: 'set-vocation', value: parseVocation(values['set-vocation']) });

  if (values['set-region']) push({ type: 'set-region', value: parseRegion(values['set-region']) });
  if (values['set-position']) push(parsePositionOperation(values['set-position']));
  if (values['move-to-region-spawn']) push({ type: 'move-to-region-spawn' });

  if (values['clear-prison']) push({ type: 'clear-prison' });
  if (values['set-prison-minutes']) push({ type: 'set-prison-minutes', value: parseNumber(values['set-prison-minutes'], 'set-prison-minutes') });
  if (values['clear-hospital']) push({ type: 'clear-hospital' });
  if (values['set-hospital-minutes']) push({ type: 'set-hospital-minutes', value: parseNumber(values['set-hospital-minutes'], 'set-hospital-minutes') });

  for (const value of values['grant-item'] ?? []) {
    const parsed = parseGrantSpec(value);
    push({ type: 'grant-item', ...parsed });
  }

  for (const value of values['remove-item'] ?? []) {
    push({ type: 'remove-item', value: parseInventoryReference(value) });
  }

  for (const value of values['set-item-quantity'] ?? []) {
    push(parseSetItemQuantityOperation(value));
  }

  for (const value of values['equip-item'] ?? []) {
    push({ type: 'equip-item', value: parseInventoryReference(value) });
  }

  for (const value of values['unequip-item'] ?? []) {
    push({ type: 'unequip-item', value: parseUnequipReference(value) });
  }

  if (values['repair-all']) push({ type: 'repair-all' });

  return commands;
}

function parseInventoryReference(value: string) {
  const parts = value.split(':');
  if (parts.length === 1) {
    return { inventoryItemId: value };
  }
  const [itemType, identifier] = parts;
  if (parts.length === 2 && itemType && identifier && isItemType(itemType)) {
    return { identifier, itemType };
  }
  throw new PlayerOpsError(`Referência de item inválida: ${value}. Use <inventoryId> ou tipo:codigo.`);
}

function parseUnequipReference(value: string): { inventoryItemId: string } | { itemType: 'component' | 'drug' | 'vest' | 'weapon'; identifier: string } | { slot: InventoryEquipSlot } {
  if (value === 'weapon' || value === 'vest') {
    return { slot: value };
  }
  return parseInventoryReference(value);
}

function parseGrantSpec(value: string) {
  const parts = value.split(':');
  const [itemType, codeOrId, quantity] = parts;
  if (parts.length !== 3 || !itemType || !codeOrId || !quantity || !isItemType(itemType)) {
    throw new PlayerOpsError(`grant-item inválido: ${value}. Use tipo:codigo:quantidade.`);
  }
  return {
    codeOrId,
    itemType,
    quantity: parseIntFlag(quantity, 'grant-item'),
  };
}

function parseSetItemQuantityOperation(value: string): PlayerOpsCommand['operation'] {
  const parts = value.split(':');
  const [first, second, third] = parts;
  if (parts.length === 2) {
    return {
      quantity: parseIntFlag(requireSegment(second, value), 'set-item-quantity'),
      type: 'set-item-quantity',
      value: { inventoryItemId: requireSegment(first, value) },
    };
  }
  if (parts.length === 3 && first && second && third && isItemType(first)) {
    return {
      quantity: parseIntFlag(third, 'set-item-quantity'),
      type: 'set-item-quantity',
      value: { identifier: second, itemType: first },
    };
  }
  throw new PlayerOpsError(
    `set-item-quantity inválido: ${value}. Use <inventoryId>:qtd ou tipo:codigo:qtd.`,
  );
}

function parsePositionOperation(value: string): PlayerOpsCommand['operation'] {
  const parts = value.split(',');
  const [x, y] = parts;
  if (parts.length !== 2) {
    throw new PlayerOpsError('set-position deve usar o formato x,y');
  }
  return {
    type: 'set-position',
    x: parseIntFlag(requireSegment(x, value), 'set-position'),
    y: parseIntFlag(requireSegment(y, value), 'set-position'),
  };
}

function parseVocation(value: string): VocationType {
  if (Object.values(VocationType).includes(value as VocationType)) {
    return value as VocationType;
  }
  throw new PlayerOpsError(`Vocação inválida: ${value}.`);
}

function parseRegion(value: string): RegionId {
  if (Object.values(RegionId).includes(value as RegionId)) {
    return value as RegionId;
  }
  throw new PlayerOpsError(`Região inválida: ${value}.`);
}

function parseNumber(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new PlayerOpsError(`${label} exige número válido.`);
  }
  return parsed;
}

function parseIntFlag(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new PlayerOpsError(`${label} exige inteiro válido.`);
  }
  return parsed;
}

function requireSegment(value: string | undefined, rawValue: string): string {
  if (!value) {
    throw new PlayerOpsError(`Valor inválido: ${rawValue}.`);
  }
  return value;
}

function isItemType(value: string): value is 'component' | 'drug' | 'vest' | 'weapon' {
  return value === 'component' || value === 'drug' || value === 'vest' || value === 'weapon';
}

function printHelp(): void {
  console.log(`Uso:
  npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-money 500000 --full-resources

Seletores:
  --player <nickname|email|playerId>
  --player-id <uuid>
  --nickname <nickname>
  --email <email>
  --dry-run
  --confirm

Operações comuns:
  --set-money <valor>
  --set-bank-money <valor>
  --add-money <valor>
  --add-bank-money <valor>
  --set-hp <0-100>
  --set-cansaco <0-100>
  --set-disposicao <0-100>
  --set-brisa <0-100>
  --set-addiction <0-100>
  --full-resources
  --set-conceito <inteiro>
  --set-level <1-10>
  --set-vocation <cria|gerente|soldado|politico|empreendedor>
  --set-region <zona_sul|zona_norte|centro|zona_oeste|zona_sudoeste|baixada>
  --set-position <x,y>
  --move-to-region-spawn
  --clear-prison
  --set-prison-minutes <minutos>
  --clear-hospital
  --set-hospital-minutes <minutos>
  --grant-item <tipo:codigo:quantidade>
  --remove-item <inventoryId|tipo:codigo>
  --set-item-quantity <inventoryId:qtd|tipo:codigo:qtd>
  --equip-item <inventoryId|tipo:codigo>
  --unequip-item <weapon|vest|inventoryId|tipo:codigo>
  --repair-all
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Falha inesperada em ops:player.');
  process.exitCode = 1;
});
