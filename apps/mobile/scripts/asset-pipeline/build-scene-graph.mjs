import { createSceneGraphRoot } from './utils/scene-graph.mjs';

function normalizeToken(token) {
  return token
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickDensity(category) {
  if (category === 'favela') {
    return 'high';
  }
  if (category === 'nightlife') {
    return 'medium';
  }
  return 'medium-low';
}

function pickDominantHeight(category) {
  if (category === 'favela') {
    return 'mid-rise-irregular';
  }
  if (category === 'nightlife') {
    return 'low-rise-open-core';
  }
  return 'mixed';
}

function inferRequiredModules(analysis, styleGuide) {
  const fromAnalysis = Array.isArray(analysis.requiredModules) ? analysis.requiredModules : [];
  const styleModules = [
    ...(styleGuide?.modulePolicy?.primaryModules ?? []),
    ...(styleGuide?.modulePolicy?.secondaryModules ?? []),
    ...(styleGuide?.modulePolicy?.detailModules ?? []),
  ];
  const forbidden = new Set(styleGuide?.modulePolicy?.forbiddenModules ?? analysis.forbiddenModules ?? []);
  const normalizedType = String(analysis.assetType ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (normalizedType.includes('favela-cluster')) {
    return [...new Set(['cluster-core-dense', 'cluster-step-left', 'cluster-step-right', 'cluster-roofline', 'cluster-service-strip', 'water-tank', 'stair', ...styleModules])]
      .filter((moduleName) => !forbidden.has(moduleName));
  }

  if (normalizedType.includes('barraco')) {
    return [...new Set(['barraco-unit', 'barraco-stacked', 'barraco-corner', 'barraco-roof-patch', 'external-pipe', ...styleModules])]
      .filter((moduleName) => !forbidden.has(moduleName));
  }

  if (normalizedType.includes('baile')) {
    return [...new Set(['favela-side-block-left', 'favela-side-block-right', 'street-segment', 'stage', 'truss', 'crowd-mass', 'speaker-stack', 'wires', ...styleModules])]
      .filter((moduleName) => !forbidden.has(moduleName));
  }

  if (fromAnalysis.length > 0) {
    return [...new Set([...fromAnalysis, ...styleModules])].filter((moduleName) => !forbidden.has(moduleName));
  }

  if (analysis.category === 'favela') {
    return [...new Set(['wide-building', 'building-3f', 'narrow-building', 'corrugated-roof', 'water-tank', 'stair', 'small-window', 'side-wall', ...styleModules])]
      .filter((moduleName) => !forbidden.has(moduleName));
  }

  if (analysis.category === 'nightlife') {
    return [...new Set(['favela-side-block-left', 'favela-side-block-right', 'street-segment', 'stage', 'truss', 'crowd-mass', 'speaker-stack', 'wires', ...styleModules])]
      .filter((moduleName) => !forbidden.has(moduleName));
  }

  return [...new Set(['anchor-shadow', ...styleModules])].filter((moduleName) => !forbidden.has(moduleName));
}

function buildModuleSequence(analysis, styleGuide) {
  const policy = styleGuide?.modulePolicy ?? {};
  const fallbackModules = inferRequiredModules(analysis, styleGuide);
  const primary = policy.primaryModules ?? [];
  const secondary = policy.secondaryModules ?? [];
  const detail = policy.detailModules ?? [];
  const forbidden = new Set(policy.forbiddenModules ?? analysis.forbiddenModules ?? []);
  const targetCount = Math.max(1, policy.targetNodeCount ?? fallbackModules.length ?? 6);
  const sequence = [];
  const buckets = [primary, secondary, detail, fallbackModules];

  for (let bucketIndex = 0; sequence.length < targetCount && bucketIndex < buckets.length; bucketIndex += 1) {
    const bucket = buckets[bucketIndex];
    for (const moduleName of bucket) {
      if (forbidden.has(moduleName)) {
        continue;
      }
      if (!sequence.includes(moduleName)) {
        sequence.push(moduleName);
      }
      if (sequence.length >= targetCount) {
        break;
      }
    }
  }

  const reusablePool = [...new Set([...primary, ...secondary, ...detail, ...fallbackModules])]
    .filter((moduleName) => !forbidden.has(moduleName));

  let refillIndex = 0;
  while (sequence.length < targetCount && reusablePool.length > 0) {
    sequence.push(reusablePool[refillIndex % reusablePool.length]);
    refillIndex += 1;
  }

  return sequence;
}

function getLayerPattern(styleGuide, count) {
  const pattern = styleGuide?.compositionPolicy?.layerPattern ?? [];
  if (pattern.length >= count) {
    return pattern.slice(0, count);
  }

  const fallback = ['foreground', 'foreground', 'midground', 'midground', 'background', 'background', 'overlay'];
  const result = [];
  for (let index = 0; index < count; index += 1) {
    result.push(pattern[index] ?? fallback[index] ?? 'midground');
  }
  return result;
}

function buildBaileNodes() {
  return [
    {
      id: 'favela-left-back-1',
      module: 'favela-side-block-left',
      layer: 'background',
      anchor: { x: 70, y: 114 },
      heightTier: 'primary',
      variationSeed: 1,
      children: [],
    },
    {
      id: 'favela-right-back-2',
      module: 'favela-side-block-right',
      layer: 'background',
      anchor: { x: 124, y: 112 },
      heightTier: 'primary',
      variationSeed: 2,
      children: [],
    },
    {
      id: 'favela-left-mid-3',
      module: 'favela-side-block-left',
      layer: 'midground',
      anchor: { x: 48, y: 124 },
      heightTier: 'primary',
      variationSeed: 3,
      children: [],
    },
    {
      id: 'favela-right-mid-4',
      module: 'favela-side-block-right',
      layer: 'midground',
      anchor: { x: 144, y: 122 },
      heightTier: 'primary',
      variationSeed: 4,
      children: [],
    },
    {
      id: 'street-main-5',
      module: 'street-segment',
      layer: 'midground',
      anchor: { x: 96, y: 126 },
      heightTier: 'primary',
      variationSeed: 5,
      children: [],
    },
    {
      id: 'stage-main-6',
      module: 'stage',
      layer: 'midground',
      anchor: { x: 96, y: 92 },
      heightTier: 'primary',
      variationSeed: 6,
      children: [],
    },
    {
      id: 'truss-main-7',
      module: 'truss',
      layer: 'overlay',
      anchor: { x: 96, y: 88 },
      heightTier: 'secondary',
      variationSeed: 7,
      children: [],
    },
    {
      id: 'crowd-front-left-8',
      module: 'crowd-mass',
      layer: 'foreground',
      anchor: { x: 82, y: 126 },
      heightTier: 'secondary',
      variationSeed: 8,
      children: [],
    },
    {
      id: 'crowd-front-right-9',
      module: 'crowd-mass',
      layer: 'foreground',
      anchor: { x: 110, y: 124 },
      heightTier: 'secondary',
      variationSeed: 9,
      children: [],
    },
    {
      id: 'crowd-mid-10',
      module: 'crowd-mass',
      layer: 'foreground',
      anchor: { x: 96, y: 112 },
      heightTier: 'secondary',
      variationSeed: 10,
      children: [],
    },
    {
      id: 'speaker-main-11',
      module: 'speaker-stack',
      layer: 'foreground',
      anchor: { x: 96, y: 100 },
      heightTier: 'detail',
      variationSeed: 11,
      children: [],
    },
    {
      id: 'tent-left-12',
      module: 'tent',
      layer: 'foreground',
      anchor: { x: 58, y: 116 },
      heightTier: 'detail',
      variationSeed: 12,
      children: [],
    },
    {
      id: 'tent-right-13',
      module: 'tent',
      layer: 'foreground',
      anchor: { x: 136, y: 114 },
      heightTier: 'detail',
      variationSeed: 13,
      children: [],
    },
    {
      id: 'canopy-vendors-14',
      module: 'canopy-strip',
      layer: 'overlay',
      anchor: { x: 96, y: 108 },
      heightTier: 'detail',
      variationSeed: 14,
      children: [],
    },
    {
      id: 'pole-grid-15',
      module: 'pole',
      layer: 'overlay',
      anchor: { x: 96, y: 118 },
      heightTier: 'detail',
      variationSeed: 15,
      children: [],
    },
    {
      id: 'wires-grid-16',
      module: 'wires',
      layer: 'overlay',
      anchor: { x: 96, y: 84 },
      heightTier: 'detail',
      variationSeed: 16,
      children: [],
    },
  ];
}

function buildNodesFromRequiredModules(analysis, styleGuide) {
  const normalizedType = String(analysis.assetType ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (normalizedType.includes('baile')) {
    return buildBaileNodes();
  }

  const modules = buildModuleSequence(analysis, styleGuide);
  const compositionPolicy = styleGuide?.compositionPolicy ?? {};
  const baseAnchor = compositionPolicy.baseAnchor ?? { x: 96, y: 124 };
  const columns = Math.max(1, compositionPolicy.columns ?? 3);
  const xStep = compositionPolicy.xStep ?? 18;
  const yStep = compositionPolicy.yStep ?? 6;
  const rowLift = compositionPolicy.rowLift ?? 10;
  const layerPattern = getLayerPattern(styleGuide, modules.length);

  return modules.map((moduleName, index) => ({
    id: `${normalizeToken(moduleName)}-${index + 1}`,
    module: moduleName,
    layer: layerPattern[index],
    anchor: {
      x: baseAnchor.x + (index % columns) * xStep,
      y: baseAnchor.y - Math.floor(index / columns) * rowLift - (index % columns) * yStep,
    },
    heightTier: index < Math.max(2, Math.ceil(modules.length / 3)) ? 'primary' : index < Math.max(4, Math.ceil((modules.length * 2) / 3)) ? 'secondary' : 'detail',
    variationSeed: index + 1,
    children: [],
  }));
}

export async function buildSceneGraph({ analysis, styleGuide }) {
  const root = createSceneGraphRoot({
    assetType: analysis.assetType,
    category: analysis.category,
    density: analysis.density ?? pickDensity(analysis.category),
    dominantHeight: analysis.dominantHeight ?? pickDominantHeight(analysis.category),
    silhouette: analysis.silhouette,
    materials: analysis.materials,
    requiredModules: inferRequiredModules(analysis, styleGuide),
    forbiddenModules: analysis.forbiddenModules ?? analysis.forbiddenElements ?? [],
    composition: analysis.composition ?? analysis.compositionHints ?? {},
    styleGuide,
  });

  root.nodes = buildNodesFromRequiredModules(analysis, styleGuide);

  return root;
}
