import path from 'node:path';

import { resolveMapStructureFamilyReferencePacks } from './map-structure-family-references.mjs';
import { resolveMapStructureReplacementPlan } from './map-structure-replacements.mjs';
import { runModularStageEightValidation } from './pipeline.mjs';
import { writeJsonFile } from './utils/fs.mjs';

function summarizeByFamily(results) {
  return results.reduce((accumulator, result) => {
    accumulator[result.targetFamily] = (accumulator[result.targetFamily] ?? 0) + 1;
    return accumulator;
  }, {});
}

function summarizeByStatus(results) {
  return results.reduce((accumulator, result) => {
    const key = result.ok ? 'ok' : 'failed';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function generateMapStructureReplacements({ mobileRoot, pipelinePaths }) {
  const plan = await resolveMapStructureReplacementPlan({
    mobileRoot,
    pipelinePaths,
  });
  const familyPacks = await resolveMapStructureFamilyReferencePacks({
    mobileRoot,
    pipelinePaths,
  });

  const familyPackByFamily = new Map(familyPacks.packs.map((pack) => [pack.family, pack]));
  const results = [];

  for (const entry of plan.entries) {
    const familyPack = familyPackByFamily.get(entry.targetFamily) ?? null;
    const assetType = `${entry.targetFamily} ${entry.kind}`;
    const outputFile = path.join('assets', 'map-structures', `${entry.kind}.svg`);

    const generation = await runModularStageEightValidation({
      cwd: mobileRoot,
      pipelinePaths,
      assetType,
      referenceFiles: entry.referenceFiles,
      outputFile,
      styleGuide: entry.styleGuide,
      keepIntermediate: false,
    });

    results.push({
      kind: entry.kind,
      assetType,
      targetFamily: entry.targetFamily,
      targetCategory: entry.targetCategory,
      styleGuide: entry.styleGuide,
      implementationMode: entry.implementationMode,
      referenceFiles: entry.referenceFiles,
      outputFile: path.resolve(mobileRoot, outputFile),
      previewPath: generation.previewPath ?? null,
      validationManifestPath: generation.validationManifestPath ?? null,
      packDir: familyPack?.packDir ?? null,
      ok: generation.ok,
      stage: generation.stage,
      note: generation.note,
      failedChecks: generation.failedChecks ?? [],
    });
  }

  const manifest = {
    version: 1,
    stage: 'catalog-generate',
    ok: results.every((result) => result.ok),
    totalKinds: results.length,
    summary: summarizeByStatus(results),
    families: summarizeByFamily(results),
    results,
  };

  const manifestPath = path.join(pipelinePaths.analysisDir, 'map-structure-generation-stage3.json');
  await writeJsonFile(manifestPath, manifest);

  return {
    ...manifest,
    manifestPath,
  };
}
