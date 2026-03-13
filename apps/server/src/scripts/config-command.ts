import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import {
  ConfigOperationService,
  type ConfigOperationCommand,
} from '../services/config-operations.js';

interface CommandEnvelope {
  actor?: string;
  commands: ConfigOperationCommand[];
  notes?: string;
  origin?: string;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      actor: {
        type: 'string',
      },
      file: {
        type: 'string',
      },
      json: {
        type: 'string',
      },
      notes: {
        type: 'string',
      },
      origin: {
        type: 'string',
      },
    },
  });

  if ((!values.file && !values.json) || (values.file && values.json)) {
    throw new Error('Informe exatamente uma origem de payload: --file <caminho> ou --json <payload>.');
  }

  const rawPayload = values.file
    ? await readFile(values.file, 'utf8')
    : values.json ?? '';

  const parsedPayload = JSON.parse(rawPayload) as CommandEnvelope | ConfigOperationCommand[] | ConfigOperationCommand;
  const envelope = normalizeEnvelope(parsedPayload);
  const service = new ConfigOperationService();
  const commands = envelope.commands.map((command) => ({
    ...command,
    actor: command.actor ?? values.actor ?? envelope.actor,
    notes: command.notes ?? values.notes ?? envelope.notes,
    origin: command.origin ?? values.origin ?? envelope.origin,
  }));

  if (commands.length === 0) {
    throw new Error('Nenhum comando operacional foi informado.');
  }

  const results = await service.applyCommands(commands);
  console.log(
    JSON.stringify(
      {
        applied: results.length,
        results,
      },
      null,
      2,
    ),
  );
}

function normalizeEnvelope(
  payload: CommandEnvelope | ConfigOperationCommand[] | ConfigOperationCommand,
): CommandEnvelope {
  if (Array.isArray(payload)) {
    return {
      commands: payload,
    };
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'commands' in payload &&
    Array.isArray(payload.commands)
  ) {
    return payload;
  }

  return {
    commands: [payload as ConfigOperationCommand],
  };
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida no comando operacional.';
  console.error(message);
  process.exit(1);
});
