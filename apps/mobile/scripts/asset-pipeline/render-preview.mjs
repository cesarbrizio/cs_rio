import fs from 'node:fs/promises';

let cachedResvg = null;

async function loadResvg() {
  if (!cachedResvg) {
    cachedResvg = import('@resvg/resvg-js');
  }
  return cachedResvg;
}

function parseViewBox(viewBox) {
  const parts = String(viewBox)
    .trim()
    .split(/\s+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new Error(`viewBox invalido para preview: ${viewBox}`);
  }

  return {
    width: parts[2],
    height: parts[3],
  };
}

export async function detectPreviewRenderer() {
  try {
    const module = await loadResvg();
    const version = module?.version ?? 'available';
    return {
      available: true,
      version,
    };
  } catch {
    return {
      available: false,
      version: null,
    };
  }
}

export async function renderPreview({
  assetType,
  category,
  svgMarkup,
  previewPath,
  targetViewBox,
  previewWidth = 512,
}) {
  const previewRenderer = await detectPreviewRenderer();

  if (!previewRenderer.available) {
    return {
      stage: 'render-preview',
      assetType,
      category,
      status: 'missing-dependency',
      ok: false,
      message: 'Dependencia ausente: @resvg/resvg-js',
    };
  }

  const { Resvg } = await loadResvg();
  const { width, height } = parseViewBox(targetViewBox);
  const previewHeight = Math.max(1, Math.round((previewWidth * height) / width));

  const resvg = new Resvg(svgMarkup, {
    fitTo: {
      mode: 'width',
      value: previewWidth,
    },
    background: 'rgba(0,0,0,0)',
  });

  const pngBuffer = resvg.render().asPng();
  await fs.writeFile(previewPath, pngBuffer);

  return {
    stage: 'render-preview',
    assetType,
    category,
    status: 'rendered',
    ok: true,
    previewPath,
    previewWidth,
    previewHeight,
    note: 'Etapa 6 concluida: preview PNG gerado a partir do SVG final.',
  };
}
