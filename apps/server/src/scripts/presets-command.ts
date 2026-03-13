import { parseArgs } from 'node:util';

import { QUICK_PRESETS } from './scenarios/index.js';
import {
  parseScenarioCliContext,
  printCommonScenarioVariables,
  SCENARIO_CLI_OPTION_DEFINITIONS,
  type ScenarioCliValues,
} from './scenario-cli-shared.js';
import { ScenarioOpsError, ScenarioOpsService, wrapScenarioError } from '../services/scenario-ops.js';

type PresetsCommandValues = ScenarioCliValues & {
  preset?: string;
};

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      ...SCENARIO_CLI_OPTION_DEFINITIONS,
      preset: { type: 'string' },
    },
  });

  const values = parsed.values as PresetsCommandValues;

  if (values.help) {
    printHelp();
    return;
  }

  const presetName = values.preset;
  if (!presetName) {
    printHelp();
    throw new ScenarioOpsError('Informe --preset <nome>.');
  }

  const preset = QUICK_PRESETS[presetName];
  if (!preset) {
    throw new ScenarioOpsError(`Preset desconhecido: ${presetName}.`);
  }

  const context = parseScenarioCliContext(values, 'ops:quick');
  const service = new ScenarioOpsService();

  try {
    const result = await service.applyInvocation(preset, {
      actor: context.actor,
      origin: context.origin,
      variables: context.variables,
    });

    console.log(
      JSON.stringify(
        {
          preset: preset.name,
          presetDescription: preset.description,
          scenarioName: preset.scenarioName,
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
  const presets = Object.values(QUICK_PRESETS)
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');

  console.log(`
Uso:
  npm run ops:quick --workspace @cs-rio/server -- --preset no-wait --player flucesar
  npm run ops:quick --workspace @cs-rio/server -- --preset full-combat-kit --player flucesar

Opções:
  --preset <nome>

${printCommonScenarioVariables()}

Presets rápidos:
${presets}
`);
}

main().catch((error: unknown) => {
  const wrapped = wrapScenarioError(error);
  console.error(`Falha ao executar ops:quick. ${wrapped.message}`);
  process.exitCode = 1;
});
