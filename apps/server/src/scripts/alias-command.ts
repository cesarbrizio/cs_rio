import { parseArgs } from 'node:util';

import { OPERATION_ALIASES } from './scenarios/index.js';
import {
  parseScenarioCliContext,
  printCommonScenarioVariables,
  SCENARIO_CLI_OPTION_DEFINITIONS,
  type ScenarioCliValues,
} from './scenario-cli-shared.js';
import { ScenarioOpsError, ScenarioOpsService, wrapScenarioError } from '../services/scenario-ops.js';

type AliasCommandValues = ScenarioCliValues & {
  run?: string;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      ...SCENARIO_CLI_OPTION_DEFINITIONS,
      run: { type: 'string' },
    },
  });

  const values = parsed.values as AliasCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const aliasName = values.run;
  if (!aliasName) {
    printHelp();
    throw new ScenarioOpsError('Informe --run <alias>.');
  }

  const alias = OPERATION_ALIASES[aliasName];
  if (!alias) {
    throw new ScenarioOpsError(`Alias desconhecido: ${aliasName}.`);
  }

  const context = parseScenarioCliContext(values, 'ops:alias');
  const service = new ScenarioOpsService();

  try {
    const result = await service.applyInvocation(alias, {
      actor: context.actor,
      origin: context.origin,
      variables: context.variables,
    });

    console.log(
      JSON.stringify(
        {
          alias: alias.name,
          aliasDescription: alias.description,
          scenarioName: alias.scenarioName,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await service.close();
  }
}

function printHelp(): void {
  const aliases = Object.values(OPERATION_ALIASES)
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');

  console.log(`
Uso:
  npm run ops:alias --workspace @cs-rio/server -- --run north-war --player flucesar
  npm run ops:alias --workspace @cs-rio/server -- --run hospital-loop --player flucesar

Opções:
  --run <nome>

${printCommonScenarioVariables()}

Aliases compostos:
${aliases}
`);
}

main().catch((error: unknown) => {
  const wrapped = wrapScenarioError(error);
  console.error(`Falha ao executar ops:alias. ${wrapped.message}`);
  process.exitCode = 1;
});
