import fs from 'node:fs/promises';
import path from 'node:path';

function summarizeImplementationModes(entries) {
  return entries.reduce((accumulator, entry) => {
    const key = entry.implementationMode ?? 'unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function summarizeFamilies(entries) {
  return entries.reduce((accumulator, entry) => {
    const key = entry.targetFamily ?? 'unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function loadMapStructureReplacementPlan(pipelineRoot) {
  const configPath = path.join(pipelineRoot, 'config', 'map-structure-replacements.json');
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    configPath,
    ...parsed,
  };
}

export async function resolveMapStructureReplacementPlan({ mobileRoot, pipelinePaths }) {
  const plan = await loadMapStructureReplacementPlan(pipelinePaths.pipelineRoot);
  const seenKinds = new Set();
  const duplicateKinds = [];
  const missingReferences = [];

  const entries = plan.entries.map((entry) => {
    if (seenKinds.has(entry.kind)) {
      duplicateKinds.push(entry.kind);
    }
    seenKinds.add(entry.kind);

    const resolvedReferenceFiles = (entry.referenceFiles ?? []).map((referenceFile) =>
      path.resolve(mobileRoot, referenceFile),
    );

    return {
      ...entry,
      outputSvgPath: path.resolve(mobileRoot, 'assets', 'map-structures', `${entry.kind}.svg`),
      resolvedReferenceFiles,
    };
  });

  for (const entry of entries) {
    for (const referenceFile of entry.resolvedReferenceFiles) {
      try {
        await fs.access(referenceFile);
      } catch {
        missingReferences.push({
          kind: entry.kind,
          referenceFile,
        });
      }
    }
  }

  return {
    version: plan.version,
    description: plan.description,
    configPath: plan.configPath,
    ok: duplicateKinds.length === 0 && missingReferences.length === 0,
    totalKinds: entries.length,
    duplicateKinds,
    missingReferences,
    families: summarizeFamilies(entries),
    implementationModes: summarizeImplementationModes(entries),
    entries,
  };
}
