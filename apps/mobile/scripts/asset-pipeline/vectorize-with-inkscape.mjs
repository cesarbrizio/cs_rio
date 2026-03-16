import fs from 'node:fs/promises';

import { commandExists, runCommand } from './utils/process.mjs';

export async function detectInkscape() {
  const available = await commandExists('inkscape');
  if (!available) {
    return {
      available: false,
      version: null,
      command: 'inkscape',
    };
  }

  const versionResult = await runCommand('inkscape', ['--version']);
  return {
    available: versionResult.code === 0,
    version: versionResult.stdout.trim() || versionResult.stderr.trim() || null,
    command: 'inkscape',
  };
}

export async function vectorizeWithInkscape({ scenePath, vectorizedPath }) {
  const inkscape = await detectInkscape();

  if (!inkscape.available) {
    return {
      ok: false,
      stage: 'vectorization',
      tool: 'inkscape',
      status: 'missing-dependency',
      scenePath,
      vectorizedPath,
      message:
        'Inkscape CLI nao encontrado. Instale `inkscape` no Ubuntu para habilitar a vetorizacao automatizada da Etapa 4.',
    };
  }

  const args = [
    scenePath,
    '--export-type=svg',
    `--export-filename=${vectorizedPath}`,
    '--export-plain-svg',
  ];

  const result = await runCommand(inkscape.command, args);

  if (result.code !== 0) {
    return {
      ok: false,
      stage: 'vectorization',
      tool: 'inkscape',
      status: 'inkscape-error',
      scenePath,
      vectorizedPath,
      command: [inkscape.command, ...args].join(' '),
      stdout: result.stdout,
      stderr: result.stderr,
      message: 'Inkscape retornou erro ao exportar o SVG vetorizado.',
    };
  }

  const svgOutput = await fs.readFile(vectorizedPath, 'utf8');

  return {
    ok: true,
    stage: 'vectorization',
    tool: 'inkscape',
    status: 'ok',
    scenePath,
    vectorizedPath,
    command: [inkscape.command, ...args].join(' '),
    version: inkscape.version,
    bytes: Buffer.byteLength(svgOutput, 'utf8'),
  };
}
