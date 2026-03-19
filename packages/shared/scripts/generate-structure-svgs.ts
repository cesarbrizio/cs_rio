import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MapStructureKind } from '../src/map/types.ts';
import { mapStructureSvgMarkupByKind } from '../src/map/generated/mapStructureSvgCatalog.generated.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '../src/map/generated/svgs');
const indexFilePath = path.join(outputDirectory, 'index.ts');

function buildIndexSource(kinds: readonly MapStructureKind[]) {
  const serializedKinds = JSON.stringify(kinds, null, 2);

  return `import type { MapStructureKind } from '../../types.js';

export const AVAILABLE_SVG_KINDS = ${serializedKinds} as const satisfies readonly MapStructureKind[];
`;
}

async function writeFileIfChanged(filePath: string, contents: string) {
  const normalizedContents = contents.endsWith('\n') ? contents : `${contents}\n`;

  try {
    const currentContents = await fs.readFile(filePath, 'utf8');

    if (currentContents === normalizedContents) {
      return false;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.writeFile(filePath, normalizedContents, 'utf8');
  return true;
}

async function removeStaleSvgFiles(validKinds: readonly MapStructureKind[]) {
  const validFileNames = new Set(validKinds.map((kind) => `${kind}.svg`));
  const currentEntries = await fs.readdir(outputDirectory, { withFileTypes: true });

  await Promise.all(
    currentEntries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.endsWith('.svg'))
      .filter((entry) => !validFileNames.has(entry.name))
      .map((entry) => fs.rm(path.join(outputDirectory, entry.name))),
  );
}

async function main() {
  const kinds = Object.keys(mapStructureSvgMarkupByKind).sort((left, right) =>
    left.localeCompare(right, 'en'),
  ) as MapStructureKind[];

  await fs.mkdir(outputDirectory, { recursive: true });
  await removeStaleSvgFiles(kinds);

  const writeResults = await Promise.all([
    ...kinds.map((kind) =>
      writeFileIfChanged(path.join(outputDirectory, `${kind}.svg`), mapStructureSvgMarkupByKind[kind]),
    ),
    writeFileIfChanged(indexFilePath, buildIndexSource(kinds)),
  ]);
  const updatedFiles = writeResults.filter(Boolean).length;

  console.log(
    `[shared] structure SVG files ready: ${kinds.length} assets, ${updatedFiles} file(s) updated.`,
  );
}

main().catch((error) => {
  console.error('[shared] failed to generate structure SVG files');
  console.error(error);
  process.exitCode = 1;
});
