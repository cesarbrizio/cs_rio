import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScenarioInvocationDefinition } from '../../services/scenario-ops.js';

const scenariosDir = path.dirname(fileURLToPath(import.meta.url));

export const BUILT_IN_SCENARIOS = [
  {
    description: 'Pacote inicial de desenvolvimento para abrir o loop básico do jogador.',
    name: 'starter-pack',
  },
  {
    description: 'Jogador, facção e uma favela preparados para testar território.',
    name: 'territory-ready',
  },
  {
    description: 'Fornecedor da rodada reabastecido e jogador pronto para o mercado.',
    name: 'market-ready',
  },
  {
    description: 'Kit e progressão prontos para testar porrada e emboscada.',
    name: 'pvp-ready',
  },
  {
    description: 'Jogador colocado na prisão para validar o loop carcerário.',
    name: 'prison-ready',
  },
  {
    description: 'Jogador colocado no hospital para validar tratamento e consumíveis.',
    name: 'hospital-ready',
  },
  {
    description: 'Facção e favela preparadas para gerar e julgar casos do tribunal.',
    name: 'tribunal-ready',
  },
  {
    description: 'Dois lados armados e banco pronto para testar declaração de guerra.',
    name: 'war-ready',
  },
  {
    description: 'Preset enxuto para zerar espera de recursos e status do player.',
    name: 'no-wait',
  },
  {
    description: 'Coloca a rodada ativa no late game para testar inflação e urgência.',
    name: 'round-late-game',
  },
  {
    description: 'Hospital curto e repetível para validar o loop de ida e volta.',
    name: 'hospital-loop',
  },
] as const;

export const QUICK_PRESETS: Record<string, ScenarioInvocationDefinition> = {
  'full-combat-kit': {
    defaults: {
      bankMoney: 250000,
      conceito: 8000,
      level: 6,
      money: 350000,
      regionId: 'zona_norte',
      vestCode: 'colete_militar',
      weaponCode: 'fuzil_ak_47',
    },
    description: 'Kit forte de combate, recursos cheios e região agressiva.',
    name: 'full-combat-kit',
    scenarioName: 'pvp-ready',
  },
  'god-lite': {
    defaults: {
      bankMoney: 500000,
      conceito: 20000,
      level: 7,
      money: 750000,
      regionId: 'centro',
      vestCode: 'colete_militar',
      weaponCode: 'fuzil_ar_15',
    },
    description: 'Pacote forte, mas ainda verossímil, para explorar o jogo sem sofrimento.',
    name: 'god-lite',
    scenarioName: 'starter-pack',
  },
  'market-fill': {
    defaults: {
      bankMoney: 50000,
      level: 3,
      money: 200000,
      regionId: 'centro',
    },
    description: 'Mercado pronto para compra e venda imediata.',
    name: 'market-fill',
    scenarioName: 'market-ready',
  },
  'no-wait': {
    description: 'Zera espera de recursos e remove prisão/hospital rapidamente.',
    name: 'no-wait',
    scenarioName: 'no-wait',
  },
  'territory-check': {
    defaults: {
      factionCode: 'cv',
      favelaCode: 'complexo_da_penha',
      regionId: 'zona_norte',
    },
    description: 'Território pronto para leitura, toque e operação local.',
    name: 'territory-check',
    scenarioName: 'territory-ready',
  },
};

export const OPERATION_ALIASES: Record<string, ScenarioInvocationDefinition> = {
  'hospital-loop': {
    defaults: {
      hospitalMinutes: 5,
      hp: 25,
      money: 20000,
      regionId: 'centro',
    },
    description: 'Abre um ciclo curto e repetível de hospital para testar retorno ao mapa.',
    name: 'hospital-loop',
    scenarioName: 'hospital-loop',
  },
  'north-war': {
    defaults: {
      enemyFactionCode: 'tcp',
      factionCode: 'cv',
      playerFavelaCode: 'cidade_alta',
      regionId: 'zona_norte',
      targetFavelaCode: 'complexo_da_penha',
    },
    description: 'Deixa uma guerra pronta para ser declarada na Zona Norte.',
    name: 'north-war',
    scenarioName: 'war-ready',
  },
  'round-late-game': {
    defaults: {
      lateGameDay: 120,
    },
    description: 'Avança a rodada para o late game de forma controlada.',
    name: 'round-late-game',
    scenarioName: 'round-late-game',
  },
  'tribunal-ready': {
    defaults: {
      factionCode: 'cv',
      favelaCode: 'morro_da_providencia',
      regionId: 'centro',
    },
    description: 'Prepara a facção e a favela para abrir o Tribunal do Tráfico.',
    name: 'tribunal-ready',
    scenarioName: 'tribunal-ready',
  },
};

export const PLAYTEST_CHECKLIST = [
  '1. Suba Postgres/Redis e rode db:push + db:seed.',
  '2. Suba o server em watch: npm run dev --workspace @cs-rio/server.',
  '3. Aplique um cenário curto: ops:starter, ops:quick ou ops:alias.',
  '4. Confira o JSON de retorno e valide o batch no log do terminal.',
  '5. Abra o app, execute o fluxo alvo e rehidrate o estado se necessário.',
] as const;

export function getBuiltInScenarioPath(name: string): string {
  return path.join(scenariosDir, `${name}.json`);
}

export function listBuiltInScenarios(): Array<{ description: string; filePath: string; name: string }> {
  return BUILT_IN_SCENARIOS.map((entry) => ({
    ...entry,
    filePath: getBuiltInScenarioPath(entry.name),
  }));
}
