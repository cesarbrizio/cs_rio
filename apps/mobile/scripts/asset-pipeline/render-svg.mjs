import { group, svgDocument } from './utils/svg.mjs';

function parseViewBox(viewBox) {
  const parts = String(viewBox)
    .trim()
    .split(/\s+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new Error(`viewBox invalido: ${viewBox}`);
  }

  return {
    minX: parts[0],
    minY: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

function extractSvgContent(svgMarkup) {
  const match = svgMarkup.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!match) {
    throw new Error('Nao foi possivel extrair o conteudo interno do SVG de composicao.');
  }
  return match[1];
}

function computeFitTransform(sourceViewBox, targetViewBox, padding = 8) {
  const availableWidth = Math.max(1, targetViewBox.width - padding * 2);
  const availableHeight = Math.max(1, targetViewBox.height - padding * 2);
  const scale = Math.min(availableWidth / sourceViewBox.width, availableHeight / sourceViewBox.height);
  const scaledWidth = sourceViewBox.width * scale;
  const scaledHeight = sourceViewBox.height * scale;
  const translateX = targetViewBox.minX + (targetViewBox.width - scaledWidth) / 2 - sourceViewBox.minX * scale;
  const translateY = targetViewBox.minY + (targetViewBox.height - scaledHeight) / 2 - sourceViewBox.minY * scale;

  return {
    scale: Number(scale.toFixed(4)),
    translateX: Number(translateX.toFixed(2)),
    translateY: Number(translateY.toFixed(2)),
    padding,
  };
}

export async function renderSvg({ sceneGraph, compositionResult, targetViewBox = '0 0 160 160' }) {
  const sourceViewBox = parseViewBox(compositionResult.compositionViewBox ?? '0 0 192 160');
  const target = parseViewBox(targetViewBox);
  const fit = computeFitTransform(sourceViewBox, target, 10);
  const compositionContent = extractSvgContent(compositionResult.compositionSvg);

  const finalContent = group(
    group(compositionContent, {
      transform: `translate(${fit.translateX} ${fit.translateY}) scale(${fit.scale})`,
      id: `${sceneGraph.assetType}-render-root`,
    }),
    {
      id: `${sceneGraph.assetType}-asset`,
      'data-asset-type': sceneGraph.assetType,
      'data-category': sceneGraph.category,
      'data-density': sceneGraph.density,
    },
  );

  const finalSvg = svgDocument({
    viewBox: targetViewBox,
    content: finalContent,
  });

  return {
    stage: 'render-svg',
    assetType: sceneGraph.assetType,
    category: sceneGraph.category,
    status: 'rendered',
    targetViewBox,
    sourceViewBox: compositionResult.compositionViewBox ?? '0 0 192 160',
    fit,
    finalSvg,
    note: 'Etapa 5 concluida: o renderer final agora materializa um SVG final a partir da composicao modular.',
    compositionSummary: {
      nodeCount: sceneGraph.nodes.length,
      resolvedModules: compositionResult.resolvedModules.length,
      skippedModules: compositionResult.skippedModules.length,
    },
  };
}
