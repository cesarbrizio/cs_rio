import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

import { VERSION, optimize } from 'svgo';

const require = createRequire(import.meta.url);

const SVGO_CONFIG = {
  multipass: true,
  js2svg: {
    pretty: false,
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          convertShapeToPath: false,
        },
      },
    },
    {
      name: 'sortAttrs',
    },
  ],
};

export async function detectSvgo() {
  try {
    const resolvedModulePath = require.resolve('svgo');

    return {
      available: true,
      version: VERSION ?? 'available',
      packagePath: resolvedModulePath,
      tool: 'svgo',
    };
  } catch {
    return {
      available: false,
      version: null,
      packagePath: null,
      tool: 'svgo',
    };
  }
}

export async function optimizeSvg({ inputPath, optimizedPath }) {
  const svgo = await detectSvgo();

  if (!svgo.available) {
    return {
      ok: false,
      stage: 'optimization',
      tool: 'svgo',
      status: 'missing-dependency',
      inputPath,
      optimizedPath,
      message: 'SVGO nao encontrado no workspace mobile. Instale `svgo` para habilitar a Etapa 5.',
    };
  }

  const source = await fs.readFile(inputPath, 'utf8');
  const result = optimize(source, {
    ...SVGO_CONFIG,
    path: inputPath,
  });

  if ('error' in result && result.error) {
    return {
      ok: false,
      stage: 'optimization',
      tool: 'svgo',
      status: 'svgo-error',
      inputPath,
      optimizedPath,
      version: svgo.version,
      message: result.error,
    };
  }

  await fs.writeFile(optimizedPath, `${result.data}\n`, 'utf8');
  const optimizedSvg = await fs.readFile(optimizedPath, 'utf8');

  return {
    ok: true,
    stage: 'optimization',
    tool: 'svgo',
    status: 'ok',
    inputPath,
    optimizedPath,
    version: svgo.version,
    bytes: Buffer.byteLength(optimizedSvg, 'utf8'),
  };
}
