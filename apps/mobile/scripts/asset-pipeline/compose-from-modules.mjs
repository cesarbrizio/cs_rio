import { group, svgDocument } from './utils/svg.mjs';
import { createSeededRandom, jitterPair, pickOne } from './utils/variation.mjs';

const LAYER_ORDER = {
  background: 0,
  midground: 1,
  foreground: 2,
  overlay: 3,
};

function normalizeLayer(layer) {
  return LAYER_ORDER[layer] ?? 1;
}

function getCategoryJitter(category) {
  if (category === 'favela') {
    return { x: 8, y: 6 };
  }
  if (category === 'nightlife') {
    return { x: 6, y: 4 };
  }
  return { x: 4, y: 3 };
}

function getStyleJitter(sceneGraph) {
  const configured = sceneGraph.styleGuide?.variationPolicy?.jitter;
  if (configured?.x && configured?.y) {
    return configured;
  }
  return getCategoryJitter(sceneGraph.category);
}

function getCategoryScale(random, category) {
  if (category === 'favela') {
    return Number((0.96 + random() * 0.1).toFixed(3));
  }
  if (category === 'nightlife') {
    return Number((0.98 + random() * 0.06).toFixed(3));
  }
  return Number((0.98 + random() * 0.04).toFixed(3));
}

function getStyleScale(random, sceneGraph) {
  const configured = sceneGraph.styleGuide?.variationPolicy?.scale;
  if (configured?.min && configured?.max) {
    return Number((configured.min + random() * (configured.max - configured.min)).toFixed(3));
  }
  return getCategoryScale(random, sceneGraph.category);
}

function buildVariantBag(node, moduleDefinition, random, sceneGraph) {
  const materialHint = pickOne(random, sceneGraph.materials ?? []);
  const slotHint = pickOne(random, moduleDefinition.slots ?? []);

  return {
    materialHint,
    slotHint,
    profile: sceneGraph.styleGuide?.resolvedProfile ?? null,
    family: sceneGraph.styleGuide?.family ?? null,
    density: sceneGraph.density,
    roofVariation: sceneGraph.styleGuide?.variationPolicy?.roofVariation ?? null,
    materialVariation: sceneGraph.styleGuide?.variationPolicy?.materialVariation ?? null,
    attachmentVariation: sceneGraph.styleGuide?.variationPolicy?.attachmentVariation ?? null,
    visualRules: sceneGraph.styleGuide?.visualRules ?? [],
  };
}

function renderPlacementFragment(node, moduleDefinition, placement) {
  return group(moduleDefinition.fragment, {
    id: `placement-${node.id}`,
    transform: `translate(${placement.x} ${placement.y}) scale(${placement.scale})`,
    'data-module-id': moduleDefinition.id,
    'data-node-id': node.id,
    'data-layer': node.layer,
  });
}

export async function composeFromModules({ sceneGraph, moduleLibrary }) {
  const jitter = getStyleJitter(sceneGraph);

  const resolvedModules = sceneGraph.nodes
    .map((node) => {
      const moduleDefinition = moduleLibrary.modules[node.module] ?? null;

      if (!moduleDefinition) {
        return {
          id: node.id,
          module: node.module,
          resolved: null,
          layer: node.layer,
          anchor: node.anchor,
          skipped: true,
        };
      }

      const random = createSeededRandom(`${sceneGraph.assetType}:${node.id}:${node.variationSeed}`);
      const offset = jitterPair(random, jitter.x, jitter.y);
      const scale = getStyleScale(random, sceneGraph);
      const placement = {
        x: node.anchor.x - moduleDefinition.anchor.x + offset.x,
        y: node.anchor.y - moduleDefinition.anchor.y + offset.y,
        scale,
      };

      return {
        id: node.id,
        module: node.module,
        resolved: {
          id: moduleDefinition.id,
          family: moduleDefinition.family,
          footprint: moduleDefinition.footprint,
          slots: moduleDefinition.slots,
        },
        layer: node.layer,
        anchor: node.anchor,
        placement,
        variants: buildVariantBag(node, moduleDefinition, random, sceneGraph),
        fragment: renderPlacementFragment(node, moduleDefinition, placement),
        skipped: false,
      };
    })
    .sort((left, right) => {
      const layerOrder = normalizeLayer(left.layer) - normalizeLayer(right.layer);
      if (layerOrder !== 0) {
        return layerOrder;
      }
      return (left.anchor?.y ?? 0) - (right.anchor?.y ?? 0);
    });

  const compositionSvg = svgDocument({
    viewBox: '0 0 192 160',
    content: resolvedModules
      .filter((item) => !item.skipped)
      .map((item) => item.fragment)
      .join(''),
  });

  return {
    stage: 'compose-from-modules',
    assetType: sceneGraph.assetType,
    category: sceneGraph.category,
    styleGuide: {
      resolvedProfile: sceneGraph.styleGuide?.resolvedProfile ?? null,
      family: sceneGraph.styleGuide?.family ?? null,
      variationPolicy: sceneGraph.styleGuide?.variationPolicy ?? {},
      compositionPolicy: sceneGraph.styleGuide?.compositionPolicy ?? {},
    },
    moduleFamilies: moduleLibrary.families,
    resolvedModules: resolvedModules.map(({ fragment, ...item }) => item),
    compositionViewBox: '0 0 192 160',
    compositionSvg,
    skippedModules: resolvedModules.filter((item) => item.skipped).map((item) => item.module),
    note: 'Etapa 4 concluida: compositor modular agora monta uma cena intermediaria real a partir do scene graph e da biblioteca.',
  };
}
