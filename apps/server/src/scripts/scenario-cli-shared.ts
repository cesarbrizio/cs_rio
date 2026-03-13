import type { ParseArgsConfig } from 'node:util';

import type { ScenarioVariables } from '../services/scenario-ops.js';

type ParseArgsOption = NonNullable<ParseArgsConfig['options']>[string];

export interface ScenarioCliValues {
  actor?: string;
  'bank-money'?: string;
  'conceito'?: string;
  email?: string;
  'enemy-faction-code'?: string;
  'faction-bank-money'?: string;
  'faction-code'?: string;
  'faction-internal-satisfaction'?: string;
  'faction-points'?: string;
  'favela-bandits'?: string;
  'favela-code'?: string;
  'favela-max-soldiers'?: string;
  'favela-satisfaction'?: string;
  help?: boolean;
  'hospital-minutes'?: string;
  hp?: string;
  'late-game-day'?: string;
  level?: string;
  money?: string;
  nickname?: string;
  origin?: string;
  player?: string;
  'player-favela-code'?: string;
  'player-id'?: string;
  'prison-minutes'?: string;
  'property-cash'?: string;
  'property-level'?: string;
  'property-soldiers'?: string;
  'region-id'?: string;
  'round-id'?: string;
  'round-number'?: string;
  'target-favela-code'?: string;
  var?: string[];
  'vest-code'?: string;
  'weapon-code'?: string;
}

export const SCENARIO_CLI_OPTION_DEFINITIONS: Record<string, ParseArgsOption> = {
  actor: { type: 'string' },
  'bank-money': { type: 'string' },
  conceito: { type: 'string' },
  email: { type: 'string' },
  'enemy-faction-code': { type: 'string' },
  'faction-bank-money': { type: 'string' },
  'faction-code': { type: 'string' },
  'faction-internal-satisfaction': { type: 'string' },
  'faction-points': { type: 'string' },
  'favela-bandits': { type: 'string' },
  'favela-code': { type: 'string' },
  'favela-max-soldiers': { type: 'string' },
  'favela-satisfaction': { type: 'string' },
  help: { type: 'boolean' },
  'hospital-minutes': { type: 'string' },
  hp: { type: 'string' },
  'late-game-day': { type: 'string' },
  level: { type: 'string' },
  money: { type: 'string' },
  nickname: { type: 'string' },
  origin: { type: 'string' },
  player: { type: 'string' },
  'player-favela-code': { type: 'string' },
  'player-id': { type: 'string' },
  'prison-minutes': { type: 'string' },
  'property-cash': { type: 'string' },
  'property-level': { type: 'string' },
  'property-soldiers': { type: 'string' },
  'region-id': { type: 'string' },
  'round-id': { type: 'string' },
  'round-number': { type: 'string' },
  'target-favela-code': { type: 'string' },
  var: { multiple: true, type: 'string' },
  'vest-code': { type: 'string' },
  'weapon-code': { type: 'string' },
};

export interface ScenarioCliContext {
  actor: string;
  origin: string;
  variables: ScenarioVariables;
}

export function parseScenarioCliContext(values: ScenarioCliValues, defaultOrigin: string): ScenarioCliContext {
  const variables: ScenarioVariables = {};

  const playerSelector = values.player ?? values.nickname ?? values.email ?? values['player-id'];
  if (playerSelector) {
    variables.player = playerSelector;
  }

  assignString(variables, 'playerId', values['player-id']);
  assignString(variables, 'nickname', values.nickname);
  assignString(variables, 'email', values.email);
  assignString(variables, 'factionCode', values['faction-code']);
  assignString(variables, 'enemyFactionCode', values['enemy-faction-code']);
  assignString(variables, 'favelaCode', values['favela-code']);
  assignString(variables, 'playerFavelaCode', values['player-favela-code']);
  assignString(variables, 'targetFavelaCode', values['target-favela-code']);
  assignString(variables, 'regionId', values['region-id']);
  assignString(variables, 'roundId', values['round-id']);
  assignString(variables, 'weaponCode', values['weapon-code']);
  assignString(variables, 'vestCode', values['vest-code']);

  assignNumber(variables, 'money', values.money);
  assignNumber(variables, 'bankMoney', values['bank-money']);
  assignNumber(variables, 'level', values.level);
  assignNumber(variables, 'conceito', values.conceito);
  assignNumber(variables, 'hospitalMinutes', values['hospital-minutes']);
  assignNumber(variables, 'prisonMinutes', values['prison-minutes']);
  assignNumber(variables, 'hp', values.hp);
  assignNumber(variables, 'factionBankMoney', values['faction-bank-money']);
  assignNumber(variables, 'factionPoints', values['faction-points']);
  assignNumber(variables, 'factionInternalSatisfaction', values['faction-internal-satisfaction']);
  assignNumber(variables, 'favelaBandits', values['favela-bandits']);
  assignNumber(variables, 'favelaMaxSoldiers', values['favela-max-soldiers']);
  assignNumber(variables, 'favelaSatisfaction', values['favela-satisfaction']);
  assignNumber(variables, 'propertyCash', values['property-cash']);
  assignNumber(variables, 'propertyLevel', values['property-level']);
  assignNumber(variables, 'propertySoldiers', values['property-soldiers']);
  assignNumber(variables, 'lateGameDay', values['late-game-day']);
  assignNumber(variables, 'roundNumber', values['round-number']);

  for (const entry of values.var ?? []) {
    const [rawKey, ...rest] = entry.split('=');
    const key = rawKey?.trim();
    const rawValue = rest.join('=').trim();

    if (!key || rawValue.length === 0) {
      throw new Error(`--var inválido: ${entry}. Use --var chave=valor.`);
    }

    variables[key] = coerceVarValue(rawValue);
  }

  return {
    actor: values.actor ?? process.env.USER ?? 'local',
    origin: values.origin ?? defaultOrigin,
    variables,
  };
}

export function printCommonScenarioVariables(): string {
  return `Variáveis comuns:
  --player <nickname|email|uuid>
  --nickname <valor>
  --email <valor>
  --player-id <uuid>
  --region-id <centro|zona_norte|zona_sul|zona_oeste|zona_sudoeste|baixada>
  --faction-code <sigla/template>
  --enemy-faction-code <sigla/template>
  --favela-code <codigo>
  --player-favela-code <codigo>
  --target-favela-code <codigo>
  --money <n>
  --bank-money <n>
  --level <n>
  --conceito <n>
  --weapon-code <codigo>
  --vest-code <codigo>
  --hospital-minutes <n>
  --prison-minutes <n>
  --hp <n>
  --late-game-day <n>
  --var chave=valor`;
}

function assignNumber(target: ScenarioVariables, key: string, value?: string): void {
  if (!value) {
    return;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} precisa ser numérico.`);
  }
  target[key] = parsed;
}

function assignString(target: ScenarioVariables, key: string, value?: string): void {
  if (!value) {
    return;
  }
  target[key] = value;
}

function coerceVarValue(value: string): boolean | number | string {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== '') {
    return numeric;
  }

  return value;
}
