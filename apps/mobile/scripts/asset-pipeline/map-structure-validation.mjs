import fs from 'node:fs/promises';
import path from 'node:path';

import { ensureDir, fileExists, writeJsonFile } from './utils/fs.mjs';

function relativeFrom(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function buildReviewHtml({ generatedAt, summary, rows }) {
  const cards = rows
    .map(
      (row) => `
        <article class="card ${row.ok ? 'ok' : 'failed'}">
          <div class="preview">
            <img src="${row.previewSrc}" alt="${row.kind}" />
          </div>
          <div class="body">
            <h2>${row.kind}</h2>
            <p class="meta">${row.targetFamily} · ${row.targetCategory}</p>
            <p class="status">${row.ok ? 'Validado' : 'Com falha'}</p>
            <ul>
              <li>SVG: ${row.svgExists ? 'ok' : 'faltando'}</li>
              <li>Preview: ${row.previewExists ? 'ok' : 'faltando'}</li>
              <li>Manifesto: ${row.validationExists ? 'ok' : 'faltando'}</li>
              <li>Catálogo TS: ${row.catalogEntryExists ? 'ok' : 'faltando'}</li>
            </ul>
          </div>
        </article>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CS Rio · Revisão Visual do Catálogo</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #111315;
        --panel: #1a1d20;
        --border: #2c3136;
        --text: #f2efe9;
        --muted: #a7abae;
        --ok: #4dc17a;
        --bad: #e46c6c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      header {
        padding: 24px;
        border-bottom: 1px solid var(--border);
        background: linear-gradient(180deg, #171a1d 0%, #111315 100%);
      }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0; color: var(--muted); }
      .summary {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .pill {
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: #16191c;
      }
      main {
        padding: 24px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
      }
      .card.failed { border-color: var(--bad); }
      .preview {
        min-height: 190px;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 50% 20%, rgba(255,255,255,0.06), transparent 45%),
          linear-gradient(180deg, #192127 0%, #12171b 100%);
        padding: 16px;
      }
      .preview img {
        width: 100%;
        max-width: 180px;
        height: auto;
      }
      .body { padding: 14px 16px 18px; }
      .body h2 { margin: 0 0 6px; font-size: 16px; line-height: 1.25; }
      .meta { font-size: 13px; margin-bottom: 8px; }
      .status { color: var(--ok); font-weight: 700; margin-bottom: 10px; }
      .card.failed .status { color: var(--bad); }
      ul {
        margin: 0;
        padding-left: 18px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Revisão Visual do Catálogo</h1>
      <p>Gerado em ${generatedAt}. Validação final do catálogo de map structures.</p>
      <div class="summary">
        <div class="pill">Total: ${summary.totalKinds}</div>
        <div class="pill">OK: ${summary.okKinds}</div>
        <div class="pill">Falhas: ${summary.failedKinds}</div>
        <div class="pill">Previews: ${summary.previewCount}</div>
        <div class="pill">Catálogo TS: ${summary.catalogEntries}/${summary.totalKinds}</div>
      </div>
    </header>
    <main>
      ${cards}
    </main>
  </body>
</html>
`;
}

export async function validateMapStructureCatalog({ mobileRoot, pipelinePaths }) {
  const stage3ManifestPath = path.join(
    pipelinePaths.analysisDir,
    'map-structure-generation-stage3.json',
  );
  const generatedCatalogPath = path.join(
    mobileRoot,
    'src',
    'data',
    'generated',
    'mapStructureSvgCatalog.generated.ts',
  );
  const reviewDir = path.join(pipelinePaths.examplesDir, 'catalog-review');
  const reviewHtmlPath = path.join(reviewDir, 'index.html');
  const manifestPath = path.join(
    pipelinePaths.analysisDir,
    'map-structure-stage5-validation.json',
  );

  const stage3Manifest = JSON.parse(await fs.readFile(stage3ManifestPath, 'utf8'));
  const generatedCatalog = await fs.readFile(generatedCatalogPath, 'utf8');

  const rows = await Promise.all(
    stage3Manifest.results.map(async (result) => {
      const svgExists = await fileExists(result.outputFile);
      const previewExists = result.previewPath ? await fileExists(result.previewPath) : false;
      const validationExists = result.validationManifestPath
        ? await fileExists(result.validationManifestPath)
        : false;
      const catalogEntryExists = generatedCatalog.includes(`"${result.kind}":`);

      return {
        kind: result.kind,
        targetFamily: result.targetFamily,
        targetCategory: result.targetCategory,
        svgExists,
        previewExists,
        validationExists,
        catalogEntryExists,
        ok:
          result.ok &&
          svgExists &&
          previewExists &&
          validationExists &&
          catalogEntryExists,
        previewPath: result.previewPath,
        previewSrc: result.previewPath
          ? relativeFrom(reviewDir, result.previewPath)
          : '',
      };
    }),
  );

  const summary = {
    totalKinds: rows.length,
    okKinds: rows.filter((row) => row.ok).length,
    failedKinds: rows.filter((row) => !row.ok).length,
    previewCount: rows.filter((row) => row.previewExists).length,
    catalogEntries: rows.filter((row) => row.catalogEntryExists).length,
  };

  const output = {
    version: 1,
    stage: 'catalog-validate',
    ok: summary.failedKinds === 0,
    generatedAt: new Date().toISOString(),
    stage3ManifestPath,
    generatedCatalogPath,
    reviewHtmlPath,
    summary,
    rows,
  };

  await ensureDir(reviewDir);
  await writeJsonFile(manifestPath, output);
  await fs.writeFile(
    reviewHtmlPath,
    buildReviewHtml({
      generatedAt: output.generatedAt,
      summary,
      rows,
    }),
    'utf8',
  );

  return {
    ...output,
    manifestPath,
  };
}
