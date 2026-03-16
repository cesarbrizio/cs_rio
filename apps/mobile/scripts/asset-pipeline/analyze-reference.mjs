import path from 'node:path';

import { getImageMetadata } from './utils/image-metadata.mjs';
import { loadProjectConfigs, resolveStyleGuide } from './style-guide.mjs';

const MATERIAL_LIBRARY = {
  favela: ['concreto cru', 'reboco gasto', 'tijolo aparente', 'telha metalica', 'caixa d\'agua', 'lona'],
  barraco: ['madeira reaproveitada', 'telha metalica', 'placa improvisada', 'reboco parcial'],
  nightlife: ['lona', 'metal pintado', 'caixa de som', 'luz colorida', 'palco improvisado'],
  hospital: ['concreto pintado', 'vidro', 'placa medica', 'volume institucional'],
  prison: ['concreto', 'grade metalica', 'torre', 'portao reforcado'],
  factory: ['galpao', 'concreto', 'metal', 'chamine', 'doca de carga'],
  junkyard: ['sucata metalica', 'telha', 'container', 'pilha de material'],
  market: ['toldo', 'placa comercial', 'estrutura leve', 'estoque exposto'],
  wealthy: ['concreto claro', 'vidro amplo', 'madeira nobre', 'pergolado'],
  residential: ['alvenaria', 'telhado', 'garagem', 'varanda'],
  poor: ['alvenaria simples', 'telha', 'reboco parcial', 'anexo improvisado'],
};

function normalizeToken(token) {
  return token
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeFilePath(filePath) {
  return normalizeToken(filePath)
    .split(/\s+/)
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function inferCategory(assetType, references) {
  const tokens = unique(references.flatMap((reference) => reference.tokens));
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela') || tokens.some((token) => ['favela', 'barraco', 'tend'].includes(token))) {
    return 'favela';
  }
  if (normalizedType.includes('baile') || normalizedType.includes('rave') || tokens.some((token) => ['funk', 'party', 'baile', 'palco'].includes(token))) {
    return 'nightlife';
  }
  if (normalizedType.includes('hospital') || tokens.includes('hospital')) {
    return 'hospital';
  }
  if (normalizedType.includes('prison') || normalizedType.includes('prisao') || tokens.includes('prison')) {
    return 'prison';
  }
  if (normalizedType.includes('factory') || normalizedType.includes('doca') || normalizedType.includes('docas') || tokens.some((token) => ['factory', 'fabrica'].includes(token))) {
    return 'factory';
  }
  if (normalizedType.includes('junkyard') || normalizedType.includes('desmanche') || tokens.some((token) => ['junkyard', 'desmanche'].includes(token))) {
    return 'junkyard';
  }
  if (normalizedType.includes('mercado') || normalizedType.includes('market')) {
    return 'market';
  }
  if (tokens.some((token) => ['luxo', 'mansion', 'houses', 'casa'].includes(token))) {
    return 'wealthy';
  }
  if (tokens.some((token) => ['neighboor', 'residencial', 'residence'].includes(token))) {
    return 'residential';
  }
  return 'poor';
}

function inferSilhouette(category, references) {
  const averageRatio =
    references.reduce((sum, reference) => sum + reference.aspectRatio, 0) /
    Math.max(1, references.length);

  if (category === 'favela') {
    return {
      primaryMassing: 'clustered-lowrise',
      roofProfile: 'mixed-flat-and-patched',
      heightProfile: averageRatio > 1 ? 'low-spread' : 'stacked-irregular',
      skyline: 'broken-dense',
      footprintProfile: 'irregular-cluster',
      detailPriority: ['telhados sobrepostos', 'anexos', 'escadas externas', 'caixas d\'agua', 'adensamento'],
    };
  }

  if (category === 'nightlife') {
    return {
      primaryMassing: 'open-event-structure',
      roofProfile: 'stage-or-cover',
      heightProfile: 'low-with-signature-elements',
      skyline: 'equipment-and-light-rig',
      footprintProfile: 'wide-frontage',
      detailPriority: ['palco', 'cobertura', 'caixas de som', 'luzes', 'faixa frontal'],
    };
  }

  if (category === 'hospital') {
    return {
      primaryMassing: 'institutional-block',
      roofProfile: 'flat-technical',
      heightProfile: 'midrise-clear',
      skyline: 'clean-medical',
      footprintProfile: 'campus-or-l-block',
      detailPriority: ['entrada', 'cruz medica', 'anexo funcional', 'sinalizacao', 'heliponto se houver'],
    };
  }

  if (category === 'factory' || category === 'junkyard') {
    return {
      primaryMassing: 'industrial-complex',
      roofProfile: 'shed-and-flat-mix',
      heightProfile: 'low-bulk-with-utility-elements',
      skyline: 'chimney-crane-or-piles',
      footprintProfile: 'wide-industrial',
      detailPriority: ['galpao', 'doca', 'sucata ou equipamento', 'portao', 'anexo tecnico'],
    };
  }

  if (category === 'wealthy') {
    return {
      primaryMassing: 'clean-modern-residence',
      roofProfile: 'flat-or-minimalist',
      heightProfile: 'midrise-boxy',
      skyline: 'ordered-luxury',
      footprintProfile: 'terraced-or-l-shaped',
      detailPriority: ['varanda', 'vidro amplo', 'garagem', 'pergolado', 'volumes sobrepostos'],
    };
  }

  return {
    primaryMassing: 'readable-urban-structure',
    roofProfile: 'mixed',
    heightProfile: averageRatio > 1.15 ? 'spread' : 'compact',
    skyline: 'clear-and-readable',
    footprintProfile: 'balanced',
    detailPriority: ['entrada', 'janelas', 'volume principal', 'anexo secundario'],
  };
}

function inferVolumetry(category, references) {
  const tallestReference = references.reduce((selected, current) => {
    if (!selected) {
      return current;
    }
    return current.height > selected.height ? current : selected;
  }, null);

  const averageWidth = Math.round(
    references.reduce((sum, reference) => sum + reference.width, 0) / Math.max(1, references.length),
  );
  const averageHeight = Math.round(
    references.reduce((sum, reference) => sum + reference.height, 0) / Math.max(1, references.length),
  );

  return {
    stackCountHint:
      category === 'favela'
        ? '3-to-9-readable-masses'
        : category === 'wealthy'
          ? '2-to-4-ordered-masses'
          : category === 'nightlife'
            ? '1-to-3-open-masses'
            : '2-to-5-main-masses',
    mainMassBias:
      category === 'hospital'
        ? 'institutional-core-with-annexes'
        : category === 'factory' || category === 'junkyard'
          ? 'horizontal-base-with-utility-additions'
          : category === 'wealthy'
            ? 'stacked-clean-boxes'
            : 'irregular-main-volume',
    averageReferenceSize: {
      width: averageWidth,
      height: averageHeight,
    },
    tallestReference: tallestReference
      ? {
          file: tallestReference.file,
          width: tallestReference.width,
          height: tallestReference.height,
        }
      : null,
  };
}

function inferDensity(category, assetType, references, tokens) {
  const normalizedType = normalizeToken(assetType);
  const averageRatio =
    references.reduce((sum, reference) => sum + reference.aspectRatio, 0) /
    Math.max(1, references.length);

  if (normalizedType.includes('favela cluster')) {
    return 'high';
  }

  if (normalizedType.includes('barraco')) {
    return 'medium-high';
  }

  if (normalizedType.includes('baile')) {
    return 'medium';
  }

  if (category === 'favela') {
    return averageRatio > 1.15 ? 'medium-high' : 'high';
  }

  if (category === 'nightlife') {
    return tokens.includes('palco') ? 'medium' : 'medium-low';
  }

  if (category === 'hospital' || category === 'wealthy') {
    return 'low';
  }

  return 'medium-low';
}

function inferDominantHeight(category, assetType, silhouette, volumetry) {
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela cluster')) {
    return 'mid-rise-irregular';
  }

  if (normalizedType.includes('barraco')) {
    return 'low-rise-irregular';
  }

  if (normalizedType.includes('baile')) {
    return 'low-rise-open-core';
  }

  if (category === 'favela') {
    return silhouette.heightProfile === 'stacked-irregular' ? 'mid-rise-irregular' : 'low-rise-spread';
  }

  if (category === 'nightlife') {
    return 'low-rise-open-core';
  }

  if (category === 'hospital') {
    return 'mid-rise-institutional';
  }

  if (category === 'factory' || category === 'junkyard') {
    return 'low-rise-horizontal';
  }

  if (category === 'wealthy') {
    return volumetry.mainMassBias === 'stacked-clean-boxes' ? 'mid-rise-clean' : 'low-rise-clean';
  }

  return 'mixed';
}

function inferRequiredElements(category, tokens) {
  const shared = ['silhueta clara', 'fachada legivel', 'entrada visivel', 'massa principal reconhecivel'];

  if (category === 'favela') {
    return unique([
      ...shared,
      'anexos sobrepostos',
      'telhados variados',
      'escada ou passagem externa',
      'caixa d\'agua ou elemento de cobertura',
      'densidade perceptivel',
    ]);
  }

  if (category === 'nightlife') {
    return unique([
      ...shared,
      'palco ou area de evento',
      'luz ou elemento de destaque noturno',
      'estrutura de som ou cobertura',
      'frente legivel para atividade social',
    ]);
  }

  if (category === 'hospital') {
    return unique([
      ...shared,
      'sinal medico',
      'bloco institucional',
      'entrada ou emergencia',
      'janelas amplas e claras',
    ]);
  }

  if (category === 'prison') {
    return unique([
      ...shared,
      'grade ou portao reforcado',
      'volume austero',
      'leitura de controle',
    ]);
  }

  if (category === 'factory') {
    return unique([
      ...shared,
      'galpao ou bloco produtivo',
      'anexo tecnico',
      'doca/portao/chamine',
    ]);
  }

  if (category === 'junkyard') {
    return unique([
      ...shared,
      'pilha de sucata ou material',
      'galpao ou cobertura parcial',
      'portao e area de trabalho externa',
    ]);
  }

  if (category === 'wealthy') {
    return unique([
      ...shared,
      'volumes modernos sobrepostos',
      'janela ampla',
      'garagem/pergolado/varanda',
      'acabamento limpo',
    ]);
  }

  if (tokens.includes('garagem') || tokens.includes('garage')) {
    shared.push('garagem frontal');
  }

  return unique(shared);
}

function inferForbiddenElements(category) {
  const shared = ['fundo solido', 'icone abstrato isolado', 'simbolo sem volumetria', 'detalhe microilegivel'];

  if (category === 'favela') {
    return unique([...shared, 'quarteirao higienizado', 'simetria excessiva', 'fachada de condominio limpo']);
  }

  if (category === 'nightlife') {
    return unique([...shared, 'palco sem area util', 'balada genérica de cubo fechado']);
  }

  if (category === 'hospital') {
    return unique([...shared, 'clínica genérica sem leitura institucional', 'casinha com cruz sem contexto']);
  }

  if (category === 'wealthy') {
    return unique([...shared, 'cabana simplificada', 'telhado improvisado', 'textura de favela']);
  }

  return shared;
}

function inferRequiredModules(category, assetType, tokens, density) {
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela cluster')) {
    return ['cluster-core-dense', 'cluster-step-left', 'cluster-step-right', 'cluster-roofline', 'cluster-service-strip', 'water-tank', 'stair'];
  }

  if (normalizedType.includes('barraco')) {
    return ['barraco-unit', 'barraco-stacked', 'barraco-corner', 'barraco-roof-patch', 'external-pipe'];
  }

  if (normalizedType.includes('baile')) {
    return ['favela-side-block-left', 'favela-side-block-right', 'street-segment', 'stage', 'truss', 'crowd-mass', 'speaker-stack', 'wires'];
  }

  if (category === 'favela') {
    return density === 'high'
      ? ['wide-building', 'building-3f', 'building-2f', 'narrow-building', 'corrugated-roof', 'water-tank', 'stair', 'awning']
      : ['building-2f', 'building-1f', 'corrugated-roof', 'small-window', 'awning'];
  }

  if (category === 'nightlife') {
    return ['street-segment', 'stage', 'truss', 'crowd-mass', 'speaker-stack', 'pole', 'wires'];
  }

  return ['anchor-shadow'];
}

function inferForbiddenModules(category, assetType) {
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela cluster')) {
    return ['stage', 'truss', 'speaker-stack', 'street-segment'];
  }

  if (normalizedType.includes('baile')) {
    return ['cluster-core-dense', 'cluster-step-left', 'cluster-step-right', 'barraco-roof-patch'];
  }

  if (category === 'favela') {
    return ['stage', 'truss'];
  }

  if (category === 'nightlife') {
    return ['cluster-core-dense', 'barraco-unit'];
  }

  return [];
}

function inferLegibilityRules(category) {
  const baseRules = [
    'priorizar silhueta reconhecivel em zoom de mapa',
    'manter contraste entre massa principal e secundarias',
    'evitar detalhes finos abaixo da escala de leitura',
    'destacar entradas, vazios e anexos com hierarquia visual',
  ];

  if (category === 'favela') {
    return [...baseRules, 'a densidade deve ser lida pela sobreposição de massas e telhados', 'o asset nao pode parecer uma unica caixa limpa'];
  }

  if (category === 'nightlife') {
    return [...baseRules, 'o tema noturno deve aparecer por luz e palco, nao por excesso de glow'];
  }

  if (category === 'hospital') {
    return [...baseRules, 'o simbolo medico deve ajudar a leitura, mas nao substituir a arquitetura'];
  }

  return baseRules;
}

function inferPaletteHints(category) {
  if (category === 'favela') {
    return {
      base: ['concreto gasto', 'tijolo queimado', 'cinza irregular', 'azul desbotado', 'verde gasto'],
      accents: ['caixa d\'agua azul', 'toldo verde', 'placa enferrujada'],
      avoid: ['neon puro dominante', 'paleta corporate limpa'],
    };
  }

  if (category === 'nightlife') {
    return {
      base: ['concreto escuro', 'metal escuro', 'madeira gasta'],
      accents: ['magenta', 'ciano', 'ambar', 'roxo quente'],
      avoid: ['pastel lavado demais'],
    };
  }

  if (category === 'hospital') {
    return {
      base: ['branco institucional', 'cinza claro', 'azul frio', 'bege clinico'],
      accents: ['vermelho medico', 'turquesa medico'],
      avoid: ['saturacao de festa'],
    };
  }

  if (category === 'wealthy') {
    return {
      base: ['concreto claro', 'areia', 'madeira nobre', 'vidro frio'],
      accents: ['grafite', 'bronze'],
      avoid: ['textura caotica de favela'],
    };
  }

  return {
    base: ['cinza urbano', 'bege', 'madeira', 'metal'],
    accents: ['azul frio', 'ambar'],
    avoid: ['cores sem hierarquia'],
  };
}

function inferCameraHints(category) {
  return {
    projection: 'isometric-2:1',
    pitch: 'fixed-game-map',
    yawBias:
      category === 'wealthy'
        ? 'front-left-favoring-clean-facades'
        : category === 'favela'
          ? 'front-left-with-depth-for-density'
          : 'front-left-readable',
    framing:
      category === 'nightlife'
        ? 'show-frontage-and-stage'
        : category === 'factory'
          ? 'show-horizontal-spread'
          : 'show-main-volume-and-entry',
  };
}

function inferCompositionHints(category) {
  if (category === 'favela') {
    return {
      preferredLayering: ['base mass', 'secondary roof', 'annexes', 'circulation', 'utility objects'],
      clusterBias: 'dense-overlap',
      readabilityPriority: ['roofline', 'density', 'entry rhythm'],
    };
  }

  if (category === 'nightlife') {
    return {
      preferredLayering: ['stage footprint', 'cover', 'lighting', 'equipment'],
      clusterBias: 'wide-front-open-core',
      readabilityPriority: ['event silhouette', 'lights', 'social frontage'],
    };
  }

  return {
    preferredLayering: ['main volume', 'secondary volume', 'roofline', 'entry', 'detail accents'],
    clusterBias: 'balanced',
    readabilityPriority: ['main silhouette', 'entry', 'materials'],
  };
}

function inferComposition(category, assetType, silhouette, density, dominantHeight) {
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela cluster')) {
    return {
      layout: 'compressed-terraced-cluster',
      primaryAxis: 'diagonal-left-to-right',
      stacking: 'compressed',
      streetPresence: 'low',
      edgeNoise: 'high',
      anchorMass: 'center-left',
      layering: ['cluster-core', 'terraces', 'roofline', 'service-strip', 'utility'],
      variationPriority: ['roof-height', 'annex-offset', 'utility-top'],
    };
  }

  if (normalizedType.includes('barraco')) {
    return {
      layout: 'single-or-stacked-shelter',
      primaryAxis: 'front-left',
      stacking: 'loose',
      streetPresence: 'medium-low',
      edgeNoise: 'medium',
      anchorMass: 'center',
      layering: ['core-volume', 'roof', 'access', 'utility'],
      variationPriority: ['roof-patch', 'pipe-side', 'awning-front'],
    };
  }

  if (normalizedType.includes('baile')) {
    return {
      layout: 'favela-street-event',
      primaryAxis: 'street-depth',
      stacking: 'open-core',
      streetPresence: 'high',
      edgeNoise: 'medium',
      anchorMass: 'center-stage',
      layering: ['favela-edges', 'street', 'stage', 'crowd', 'utility-overhead'],
      variationPriority: ['crowd-density', 'tent-position', 'pole-spacing'],
    };
  }

  return {
    layout: silhouette.primaryMassing ?? 'balanced-cluster',
    primaryAxis: category === 'nightlife' ? 'street-depth' : 'front-left',
    stacking: density === 'high' ? 'compressed' : 'balanced',
    streetPresence: category === 'nightlife' ? 'high' : 'medium',
    edgeNoise: density === 'high' ? 'high' : 'medium',
    anchorMass: dominantHeight.startsWith('mid-rise') ? 'center' : 'center-left',
    layering: ['main-volume', 'secondary-volume', 'roof', 'detail'],
    variationPriority: ['height', 'roof', 'attachments'],
  };
}

export async function analyzeReferences({
  assetType,
  referenceFiles,
  styleGuideName,
  pipelinePaths,
}) {
  const projectConfigs = await loadProjectConfigs(pipelinePaths.pipelineRoot, styleGuideName);

  const references = [];
  for (const file of referenceFiles) {
    const metadata = await getImageMetadata(file);
    const tokens = tokenizeFilePath(file);
    references.push({
      file,
      fileName: path.basename(file),
      relativeDirectory: path.relative(pipelinePaths.mobileRoot, path.dirname(file)),
      ...metadata,
      tokens,
    });
  }

  const category = inferCategory(assetType, references);
  const allTokens = unique(references.flatMap((reference) => reference.tokens));
  const resolvedStyleGuide = resolveStyleGuide(projectConfigs, category, styleGuideName, assetType);
  const silhouette = inferSilhouette(category, references);
  const volumetry = inferVolumetry(category, references);
  const density = inferDensity(category, assetType, references, allTokens);
  const dominantHeight = inferDominantHeight(category, assetType, silhouette, volumetry);
  const requiredElements = inferRequiredElements(category, allTokens);
  const forbiddenElements = inferForbiddenElements(category);
  const requiredModules = unique([
    ...inferRequiredModules(category, assetType, allTokens, density),
    ...(resolvedStyleGuide.modulePolicy?.primaryModules ?? []),
    ...(resolvedStyleGuide.modulePolicy?.secondaryModules ?? []),
    ...(resolvedStyleGuide.modulePolicy?.detailModules ?? []),
  ]);
  const forbiddenModules = unique([
    ...inferForbiddenModules(category, assetType),
    ...(resolvedStyleGuide.modulePolicy?.forbiddenModules ?? []),
  ]);
  const composition = inferComposition(category, assetType, silhouette, density, dominantHeight);

  return {
    version: 2,
    stage: 'analysis',
    generatedAt: new Date().toISOString(),
    assetType,
    styleGuide: styleGuideName,
    category,
    resolvedStyleGuide,
    referenceFiles: references,
    density,
    silhouette,
    dominantHeight,
    materials: unique([
      ...(MATERIAL_LIBRARY[category] ?? []),
      ...(projectConfigs.materials.categories?.[category] ?? []),
    ]),
    volumetry,
    requiredElements,
    forbiddenElements,
    requiredModules,
    forbiddenModules,
    legibilityRules: inferLegibilityRules(category),
    cameraHints: inferCameraHints(category),
    paletteHints: inferPaletteHints(category),
    composition,
    compositionHints: inferCompositionHints(category),
    projectStyleGuide: {
      name: projectConfigs.styleGuide.name,
      version: projectConfigs.styleGuide.version,
      projection: projectConfigs.perspective.projection,
      baseViewBox: projectConfigs.validation.baseViewBox,
      family: resolvedStyleGuide.family,
      resolvedProfile: resolvedStyleGuide.resolvedProfile,
      visual: resolvedStyleGuide.visual,
      modulePolicy: resolvedStyleGuide.modulePolicy,
      compositionPolicy: resolvedStyleGuide.compositionPolicy,
      variationPolicy: resolvedStyleGuide.variationPolicy,
      visualRules: resolvedStyleGuide.visualRules,
    },
  };
}
