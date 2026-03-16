import fs from 'node:fs/promises';
import path from 'node:path';
import { inferAssetFamily } from './utils/asset-family.mjs';

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readOptionalJson(filePath, fallbackValue) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallbackValue;
    }
    throw error;
  }
}

function mergeDeep(baseValue, overrideValue) {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue ?? baseValue;
  }

  if (
    baseValue &&
    typeof baseValue === 'object' &&
    overrideValue &&
    typeof overrideValue === 'object'
  ) {
    const keys = new Set([...Object.keys(baseValue), ...Object.keys(overrideValue)]);
    const merged = {};
    for (const key of keys) {
      merged[key] = mergeDeep(baseValue[key], overrideValue[key]);
    }
    return merged;
  }

  return overrideValue ?? baseValue;
}

export async function loadProjectConfigs(pipelineRoot, styleGuideName = 'default') {
  const configRoot = path.join(pipelineRoot, 'config');
  const styleGuide = await readJson(path.join(configRoot, 'style-guide.json'));
  const familyGuideExtension = await readOptionalJson(path.join(configRoot, 'map-structure-family-guides.json'), {
    familyGuides: {},
  });
  const materials = await readJson(path.join(configRoot, 'materials.json'));
  const perspective = await readJson(path.join(configRoot, 'perspective.json'));
  const validation = await readJson(path.join(configRoot, 'validation.json'));

  return {
    selectedStyleGuide: styleGuideName,
    styleGuide: {
      ...styleGuide,
      familyGuides: {
        ...(styleGuide.familyGuides ?? {}),
        ...(familyGuideExtension.familyGuides ?? {}),
      },
    },
    materials,
    perspective,
    validation,
  };
}

export function listStyleGuideProfiles(projectConfigs) {
  return Object.keys(projectConfigs.styleGuide.profiles ?? {});
}

export function resolveStyleGuide(projectConfigs, category = 'poor', styleGuideName = 'default', assetType = '') {
  const profiles = projectConfigs.styleGuide.profiles ?? {};
  const categoryOverrides = projectConfigs.styleGuide.categoryOverrides ?? {};
  const familyGuides = projectConfigs.styleGuide.familyGuides ?? {};
  const categoryOverride = categoryOverrides[category] ?? {};
  const family = inferAssetFamily(assetType, category);
  const familyGuide = familyGuides[family] ?? {};
  const requestedProfile = profiles[styleGuideName];
  const profileName = requestedProfile
    ? styleGuideName
    : familyGuide.preferredProfile && profiles[familyGuide.preferredProfile]
      ? familyGuide.preferredProfile
    : categoryOverride.preferredProfile && profiles[categoryOverride.preferredProfile]
      ? categoryOverride.preferredProfile
      : 'default';
  const resolvedProfile = profiles[profileName];

  if (!resolvedProfile) {
    throw new Error(`Style guide desconhecido: ${styleGuideName}`);
  }

  return {
    name: projectConfigs.styleGuide.name,
    version: projectConfigs.styleGuide.version,
    selectedStyleGuide: styleGuideName,
    resolvedProfile: profileName,
    projection: projectConfigs.styleGuide.projection ?? projectConfigs.perspective.projection,
    principles: projectConfigs.styleGuide.principles ?? [],
    outlinePolicy: mergeDeep(projectConfigs.styleGuide.outlinePolicy ?? {}, resolvedProfile.outlinePolicy ?? {}),
    visual: mergeDeep(
      mergeDeep(resolvedProfile.visual ?? {}, categoryOverride.visual ?? {}),
      familyGuide.visual ?? {},
    ),
    family,
    familyGuide,
    modulePolicy: familyGuide.modulePolicy ?? {},
    compositionPolicy: familyGuide.compositionPolicy ?? {},
    variationPolicy: familyGuide.variationPolicy ?? {},
    visualRules: familyGuide.visualRules ?? [],
    category,
    categoryOverride,
    description: resolvedProfile.description ?? null,
  };
}
