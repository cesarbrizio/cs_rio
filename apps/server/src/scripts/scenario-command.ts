import { parseArgs } from 'node:util';

import { listBuiltInScenarios } from './scenarios/index.js';
import {
  parseScenarioCliContext,
  printCommonScenarioVariables,
  SCENARIO_CLI_OPTION_DEFINITIONS,
  type ScenarioCliValues,
} from './scenario-cli-shared.js';
import { ScenarioOpsService, wrapScenarioError } from '../services/scenario-ops.js';
import {
  CLI_GUARD_OPTION_DEFINITIONS,
  enforceCliGuardrails,
  parseCliGuardContext,
  type CliGuardValues,
} from './shared/cli-guards.js';

type ScenarioCommandValues = ScenarioCliValues &
  CliGuardValues & {
  apply?: string;
  file?: string;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      ...SCENARIO_CLI_OPTION_DEFINITIONS,
      ...CLI_GUARD_OPTION_DEFINITIONS,
      apply: { type: 'string' },
      file: { type: 'string' },
    },
  });

  const values = parsed.values as ScenarioCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  if (!values.apply && !values.file) {
    printHelp();
    throw new Error('Informe --apply <cenario> ou --file <arquivo>.');
  }

  const context = parseScenarioCliContext(values, 'ops:scenario');
  const guardContext = parseCliGuardContext(values);
  const service = new ScenarioOpsService();

  try {
    const inspection = await service.inspectScenario({
      actor: context.actor,
      filePath: values.file,
      name: values.apply,
      origin: context.origin,
      variables: context.variables,
    });
    const guardrails = enforceCliGuardrails(
      'ops:scenario',
      guardContext,
      inspection.operationTypes,
    );
    const result = guardContext.dryRun
      ? await service.previewScenario({
          actor: context.actor,
          filePath: values.file,
          name: values.apply,
          origin: context.origin,
          variables: context.variables,
        })
      : await service.applyScenario({
          actor: context.actor,
          filePath: values.file,
          name: values.apply,
          origin: context.origin,
          variables: context.variables,
        });

    console.log(
      JSON.stringify(
        {
          ...result,
          guardrails,
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
  const scenarios = listBuiltInScenarios()
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');

  console.log(`
Uso:
  npm run ops:scenario --workspace @cs-rio/server -- --apply starter-pack --player flucesar
  npm run ops:scenario --workspace @cs-rio/server -- --apply territory-ready --player flucesar --faction-code cv --favela-code complexo_da_penha
  npm run ops:scenario --workspace @cs-rio/server -- --file ./apps/server/src/scripts/scenarios/war-ready.json --player flucesar

Opções:
  --apply <nome-do-cenario>
  --file <caminho-json>

${printCommonScenarioVariables()}
  --dry-run
  --confirm

Cenários disponíveis:
${scenarios}
`);
}

main().catch((error: unknown) => {
  const wrapped = wrapScenarioError(error);
  console.error(`Falha ao executar ops:scenario. ${wrapped.message}`);
  process.exitCode = 1;
});
