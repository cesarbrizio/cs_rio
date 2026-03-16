import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import { resolveMapStructureFamilyReferencePacks } from './map-structure-family-references.mjs';
import { generateMapStructureReplacements } from './map-structure-generation.mjs';
import { resolveMapStructureReplacementPlan } from './map-structure-replacements.mjs';
import { validateMapStructureCatalog } from './map-structure-validation.mjs';
import { ensurePipelineWorkspace, inspectExternalTools, resolvePipelinePaths, runModularStageEightValidation } from './pipeline.mjs';
import { listStyleGuideProfiles, loadProjectConfigs, resolveStyleGuide } from './style-guide.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage() {
  console.log(`
Asset Pipeline CLI

Uso:
  node ./scripts/asset-pipeline/cli.mjs generate --type <asset-type> --ref <file> [--ref <file> ...] --out <file> [--style-guide <name>] [--keep-intermediate]
  node ./scripts/asset-pipeline/cli.mjs style-guide [--type <asset-type>] [--category <category>] [--style-guide <name>]
  node ./scripts/asset-pipeline/cli.mjs catalog-plan
  node ./scripts/asset-pipeline/cli.mjs catalog-families
  node ./scripts/asset-pipeline/cli.mjs catalog-generate
  node ./scripts/asset-pipeline/cli.mjs catalog-validate
  node ./scripts/asset-pipeline/cli.mjs doctor
  node ./scripts/asset-pipeline/cli.mjs help

Exemplos:
  npm run asset:pipeline --workspace @cs-rio/mobile -- generate --type favela-cluster --ref ./assets/examples/favela/Favela_1.jpg --out ./assets/asset-pipeline/output/favela-cluster.svg
  npm run asset:pipeline --workspace @cs-rio/mobile -- style-guide --type favela-cluster --style-guide dense-favela
  npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-plan
  npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-families
  npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-generate
  npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-validate
  npm run asset:pipeline --workspace @cs-rio/mobile -- doctor
`.trim());
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {
    refs: [],
    keepIntermediate: false,
    styleGuide: 'default',
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === '--type') {
      options.type = rest[++index];
      continue;
    }

    if (token === '--ref') {
      const ref = rest[++index];
      if (ref) {
        options.refs.push(ref);
      }
      continue;
    }

    if (token === '--out') {
      options.out = rest[++index];
      continue;
    }

    if (token === '--preview-out') {
      options.previewOut = rest[++index];
      continue;
    }

    if (token === '--style-guide') {
      options.styleGuide = rest[++index] ?? 'default';
      continue;
    }

    if (token === '--category') {
      options.category = rest[++index];
      continue;
    }

    if (token === '--keep-intermediate') {
      options.keepIntermediate = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    if (!options.positionals) {
      options.positionals = [];
    }
    options.positionals.push(token);
  }

  return { command, options };
}

async function runDoctor() {
  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const externalTools = await inspectExternalTools();

  const result = {
    status: 'ok',
    pipelineRoot: paths.pipelineRoot,
    workingDirectories: {
      analysisDir: paths.analysisDir,
      sceneGraphsDir: paths.sceneGraphsDir,
      intermediateDir: paths.intermediateDir,
      outputDir: paths.outputDir,
      previewsDir: paths.previewsDir,
      examplesDir: paths.examplesDir,
      moduleLibraryDir: paths.moduleLibraryDir,
    },
    externalTools,
    note:
      'Etapas 1 a 8 do pipeline modular estao integradas e os exemplos oficiais de favela-cluster e baile ja foram consolidados. O proximo uso do pipeline passa a ser refinamento artistico e expansao da biblioteca modular.',
  };

  console.log(JSON.stringify(result, null, 2));
}

async function runCatalogPlan() {
  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const result = await resolveMapStructureReplacementPlan({
    mobileRoot: paths.mobileRoot,
    pipelinePaths: paths,
  });
  const manifestPath = path.join(paths.analysisDir, 'map-structure-replacement-plan.json');
  await fs.writeFile(`${manifestPath}`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ...result,
        manifestPath,
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runCatalogFamilies() {
  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const result = await resolveMapStructureFamilyReferencePacks({
    mobileRoot: paths.mobileRoot,
    pipelinePaths: paths,
  });
  const manifestPath = path.join(paths.analysisDir, 'map-structure-family-packs.json');
  await fs.writeFile(`${manifestPath}`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ...result,
        manifestPath,
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runCatalogGenerate() {
  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const result = await generateMapStructureReplacements({
    mobileRoot: paths.mobileRoot,
    pipelinePaths: paths,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runCatalogValidate() {
  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const result = await validateMapStructureCatalog({
    mobileRoot: paths.mobileRoot,
    pipelinePaths: paths,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function inferCategoryFromType(type = '') {
  const normalized = type
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (normalized.includes('favela') || normalized.includes('barraco')) {
    return 'favela';
  }
  if (normalized.includes('baile') || normalized.includes('rave')) {
    return 'nightlife';
  }
  if (normalized.includes('hospital')) {
    return 'hospital';
  }
  if (normalized.includes('prison') || normalized.includes('prisao')) {
    return 'prison';
  }
  if (normalized.includes('factory') || normalized.includes('doca')) {
    return 'factory';
  }
  if (normalized.includes('junkyard') || normalized.includes('desmanche')) {
    return 'junkyard';
  }
  if (normalized.includes('luxo') || normalized.includes('mansion')) {
    return 'wealthy';
  }
  return 'poor';
}

async function runStyleGuide(options) {
  const paths = resolvePipelinePaths(__dirname);
  const projectConfigs = await loadProjectConfigs(paths.pipelineRoot, options.styleGuide);
  const category = options.category ?? inferCategoryFromType(options.type);
  const resolvedGuide = resolveStyleGuide(projectConfigs, category, options.styleGuide, options.type ?? '');

  console.log(
    JSON.stringify(
      {
        availableProfiles: listStyleGuideProfiles(projectConfigs),
        category,
        resolvedGuide,
      },
      null,
      2,
    ),
  );
}

async function runGenerate(options) {
  if (!options.type || options.refs.length === 0 || !options.out) {
    console.error('Erro: generate exige --type, pelo menos um --ref e --out.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const paths = resolvePipelinePaths(__dirname);
  await ensurePipelineWorkspace(paths);
  const result = await runModularStageEightValidation({
    cwd: process.cwd(),
    pipelinePaths: paths,
    assetType: options.type,
    referenceFiles: options.refs,
    outputFile: options.out,
    previewFile: options.previewOut,
    styleGuide: options.styleGuide,
    keepIntermediate: options.keepIntermediate,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (options.help || command === 'help') {
    printUsage();
    return;
  }

  if (command === 'doctor') {
    await runDoctor();
    return;
  }

  if (command === 'catalog-plan') {
    await runCatalogPlan();
    return;
  }

  if (command === 'catalog-families') {
    await runCatalogFamilies();
    return;
  }

  if (command === 'catalog-generate') {
    await runCatalogGenerate();
    return;
  }

  if (command === 'catalog-validate') {
    await runCatalogValidate();
    return;
  }

  if (command === 'style-guide') {
    await runStyleGuide(options);
    return;
  }

  if (command === 'generate') {
    await runGenerate(options);
    return;
  }

  console.error(`Comando desconhecido: ${command}`);
  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('[asset-pipeline] erro fatal na CLI base');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
