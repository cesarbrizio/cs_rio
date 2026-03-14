import { OPERATION_ALIASES, PLAYTEST_CHECKLIST, QUICK_PRESETS, listBuiltInScenarios } from './scenarios/index.js';

function main(): void {
  const scenarios = listBuiltInScenarios()
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');
  const presets = Object.values(QUICK_PRESETS)
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');
  const aliases = Object.values(OPERATION_ALIASES)
    .map((entry) => `  - ${entry.name}: ${entry.description}`)
    .join('\n');
  const checklist = PLAYTEST_CHECKLIST.map((entry) => `  ${entry}`).join('\n');

  console.log(`
Comandos internos disponíveis:
  npm run ops:list     --workspace @cs-rio/server -- --help
  npm run ops:player   --workspace @cs-rio/server -- --help
  npm run ops:world    --workspace @cs-rio/server -- --help
  npm run ops:round    --workspace @cs-rio/server -- --help
  npm run ops:config   --workspace @cs-rio/server -- --help
  npm run ops:scenario --workspace @cs-rio/server -- --help
  npm run ops:quick    --workspace @cs-rio/server -- --help
  npm run ops:alias    --workspace @cs-rio/server -- --help
  npm run ops:starter  --workspace @cs-rio/server -- --player flucesar

Cenários versionados:
${scenarios}

Presets rápidos:
${presets}

Aliases compostos:
${aliases}

Checklist mínimo de playtest:
${checklist}
`);
}

main();
