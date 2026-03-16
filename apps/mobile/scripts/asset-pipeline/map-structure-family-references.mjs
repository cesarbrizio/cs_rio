import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveMapStructureReplacementPlan } from './map-structure-replacements.mjs';
import { ensureDir, writeJsonFile } from './utils/fs.mjs';

function summarizeByImplementationMode(packs) {
  return packs.reduce((accumulator, pack) => {
    for (const mode of pack.implementationModes) {
      accumulator[mode] = (accumulator[mode] ?? 0) + 1;
    }
    return accumulator;
  }, {});
}

function buildPlanFamilyIndex(entries) {
  const families = new Map();

  for (const entry of entries) {
    if (!families.has(entry.targetFamily)) {
      families.set(entry.targetFamily, {
        family: entry.targetFamily,
        kinds: new Set(),
        assetTypes: new Set(),
        categories: new Set(),
        styleGuides: new Set(),
        implementationModes: new Set(),
        referenceFiles: new Set(),
      });
    }

    const family = families.get(entry.targetFamily);
    family.kinds.add(entry.kind);
    family.assetTypes.add(entry.assetType);
    family.categories.add(entry.targetCategory);
    family.styleGuides.add(entry.styleGuide);
    family.implementationModes.add(entry.implementationMode);
    for (const referenceFile of entry.referenceFiles ?? []) {
      family.referenceFiles.add(referenceFile);
    }
  }

  return families;
}

function collectReferenceGroups(pack) {
  return {
    primary: [...(pack.primaryReferences ?? [])],
    secondary: [...(pack.secondaryReferences ?? [])],
    supporting: [...(pack.supportingReferences ?? [])],
  };
}

function flattenReferenceGroups(referenceGroups) {
  return [
    ...referenceGroups.primary.map((referenceFile) => ({ tier: 'primary', referenceFile })),
    ...referenceGroups.secondary.map((referenceFile) => ({ tier: 'secondary', referenceFile })),
    ...referenceGroups.supporting.map((referenceFile) => ({ tier: 'supporting', referenceFile })),
  ];
}

function buildFamilyPackReadme(pack) {
  const lines = [
    `# ${pack.title}`,
    '',
    `Familia visual: \`${pack.family}\``,
    '',
    `Categoria: \`${pack.category}\``,
    `Style guide: \`${pack.styleGuide}\``,
    `Kinds cobertos: ${pack.kinds.map((kind) => `\`${kind}\``).join(', ')}`,
    '',
    '## Intencao de composicao',
    '',
    pack.compositionIntent,
    '',
    '## Modos de implementacao',
    '',
    pack.implementationModes.map((mode) => `- \`${mode}\``).join('\n'),
    '',
    '## Deve capturar',
    '',
    pack.mustCapture.map((item) => `- ${item}`).join('\n'),
    '',
    '## Deve evitar',
    '',
    pack.avoid.map((item) => `- ${item}`).join('\n'),
    '',
    '## Referencias',
    '',
    ...pack.selectedReferences.map((reference) => `- [${reference.tier}] \`${reference.referenceFile}\``),
  ];

  if (pack.notes.length > 0) {
    lines.push('', '## Notas', '', ...pack.notes.map((note) => `- ${note}`));
  }

  lines.push('');
  return lines.join('\n');
}

async function copyReferencePack({ mobileRoot, referencesDir, selectedReferences }) {
  await ensureDir(referencesDir);

  const copiedReferences = [];
  for (const [index, reference] of selectedReferences.entries()) {
    const absoluteReferenceFile = path.resolve(mobileRoot, reference.referenceFile);
    const prefixedName = `${String(index + 1).padStart(2, '0')}-${path.basename(path.dirname(reference.referenceFile))}-${path.basename(reference.referenceFile)}`;
    const copiedPath = path.join(referencesDir, prefixedName);
    await fs.copyFile(absoluteReferenceFile, copiedPath);
    copiedReferences.push({
      ...reference,
      absoluteReferenceFile,
      copiedPath,
    });
  }

  return copiedReferences;
}

export async function loadMapStructureFamilyReferencePacks(pipelineRoot) {
  const configPath = path.join(pipelineRoot, 'config', 'map-structure-family-references.json');
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    configPath,
    ...parsed,
  };
}

export async function resolveMapStructureFamilyReferencePacks({ mobileRoot, pipelinePaths }) {
  const plan = await resolveMapStructureReplacementPlan({ mobileRoot, pipelinePaths });
  const familyConfig = await loadMapStructureFamilyReferencePacks(pipelinePaths.pipelineRoot);
  const planFamilies = buildPlanFamilyIndex(plan.entries);
  const seenFamilies = new Set();
  const duplicateFamilies = [];
  const orphanFamilies = [];
  const missingFamilies = [];
  const missingReferences = [];
  const packs = [];
  const examplesRoot = path.join(pipelinePaths.examplesDir, 'catalog-families');

  for (const pack of familyConfig.families) {
    if (seenFamilies.has(pack.family)) {
      duplicateFamilies.push(pack.family);
      continue;
    }
    seenFamilies.add(pack.family);

    const planFamily = planFamilies.get(pack.family);
    if (!planFamily) {
      orphanFamilies.push(pack.family);
      continue;
    }

    const referenceGroups = collectReferenceGroups(pack);
    const selectedReferences = flattenReferenceGroups(referenceGroups);
    const duplicateReferenceFiles = selectedReferences.reduce((accumulator, reference) => {
      const count = accumulator.counts.get(reference.referenceFile) ?? 0;
      accumulator.counts.set(reference.referenceFile, count + 1);
      if (count >= 1) {
        accumulator.duplicates.add(reference.referenceFile);
      }
      return accumulator;
    }, { counts: new Map(), duplicates: new Set() }).duplicates;

    const resolvedReferenceFiles = selectedReferences.map((reference) => ({
      ...reference,
      absoluteReferenceFile: path.resolve(mobileRoot, reference.referenceFile),
    }));

    for (const reference of resolvedReferenceFiles) {
      try {
        await fs.access(reference.absoluteReferenceFile);
      } catch {
        missingReferences.push({
          family: pack.family,
          referenceFile: reference.referenceFile,
          absoluteReferenceFile: reference.absoluteReferenceFile,
        });
      }
    }

    const planReferenceFiles = [...planFamily.referenceFiles];
    const uncoveredPlanReferences = planReferenceFiles.filter(
      (referenceFile) => !selectedReferences.some((selectedReference) => selectedReference.referenceFile === referenceFile),
    );

    const packDir = path.join(examplesRoot, pack.family);
    const referencesDir = path.join(packDir, 'references');
    await fs.rm(packDir, { recursive: true, force: true });
    await ensureDir(packDir);

    const copiedReferences = missingReferences.some((reference) => reference.family === pack.family)
      ? []
      : await copyReferencePack({
          mobileRoot,
          referencesDir,
          selectedReferences,
        });

    const normalizedPack = {
      family: pack.family,
      title: pack.title,
      category: pack.category,
      styleGuide: pack.styleGuide,
      kinds: [...planFamily.kinds].sort(),
      assetTypes: [...planFamily.assetTypes].sort(),
      planCategories: [...planFamily.categories].sort(),
      implementationModes: [...planFamily.implementationModes].sort(),
      planReferenceFiles: planReferenceFiles.sort(),
      selectedReferences,
      unresolvedDuplicateReferenceFiles: [...duplicateReferenceFiles].sort(),
      uncoveredPlanReferences,
      compositionIntent: pack.compositionIntent,
      mustCapture: [...(pack.mustCapture ?? [])],
      avoid: [...(pack.avoid ?? [])],
      notes: [...(pack.notes ?? [])],
      packDir,
      referencesDir,
      copiedReferences,
    };

    const packManifestPath = path.join(packDir, 'family-pack.json');
    const readmePath = path.join(packDir, 'README.md');
    await writeJsonFile(packManifestPath, normalizedPack);
    await fs.writeFile(readmePath, `${buildFamilyPackReadme(normalizedPack)}\n`, 'utf8');

    packs.push({
      ...normalizedPack,
      packManifestPath,
      readmePath,
    });
  }

  for (const family of [...planFamilies.keys()].sort()) {
    if (!seenFamilies.has(family)) {
      missingFamilies.push(family);
    }
  }

  return {
    version: familyConfig.version,
    description: familyConfig.description,
    configPath: familyConfig.configPath,
    replacementPlanConfigPath: plan.configPath,
    ok:
      duplicateFamilies.length === 0 &&
      orphanFamilies.length === 0 &&
      missingFamilies.length === 0 &&
      missingReferences.length === 0 &&
      packs.every(
        (pack) => pack.unresolvedDuplicateReferenceFiles.length === 0 && pack.uncoveredPlanReferences.length === 0,
      ),
    totalFamilies: packs.length,
    duplicateFamilies,
    orphanFamilies,
    missingFamilies,
    missingReferences,
    implementationModes: summarizeByImplementationMode(packs),
    packs,
    examplesRoot,
  };
}
