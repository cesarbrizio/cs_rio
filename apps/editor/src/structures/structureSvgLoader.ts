import { AVAILABLE_SVG_KINDS } from '@shared/map/generated/svgs/index';
import type { MapStructureKind } from '@shared/map/types';

const structureSvgMarkupByKind = new Map<MapStructureKind, string>();
const structureSvgMarkupPromiseByKind = new Map<MapStructureKind, Promise<string>>();
const availableSvgKinds = new Set<MapStructureKind>(AVAILABLE_SVG_KINDS);
const svgModules = import.meta.glob(
  '../../../../packages/shared/src/map/generated/svgs/*.svg',
  {
    import: 'default',
    query: '?raw',
  },
) as Record<string, () => Promise<string>>;

function getSvgModulePath(kind: MapStructureKind) {
  return `../../../../packages/shared/src/map/generated/svgs/${kind}.svg`;
}

export function getStructureSvgMarkup(kind: MapStructureKind) {
  return structureSvgMarkupByKind.get(kind) ?? null;
}

export function isStructureSvgMarkupLoading(kind: MapStructureKind) {
  return structureSvgMarkupPromiseByKind.has(kind);
}

export async function loadStructureSvgMarkup(kind: MapStructureKind) {
  const cachedMarkup = structureSvgMarkupByKind.get(kind);

  if (cachedMarkup) {
    return cachedMarkup;
  }

  const loadingMarkup = structureSvgMarkupPromiseByKind.get(kind);

  if (loadingMarkup) {
    return loadingMarkup;
  }

  if (!availableSvgKinds.has(kind)) {
    throw new Error(`Structure SVG is not available for kind "${kind}".`);
  }

  const importer = svgModules[getSvgModulePath(kind)];

  if (!importer) {
    throw new Error(`Missing generated SVG module for kind "${kind}".`);
  }

  const nextPromise = importer()
    .then((markup) => {
      structureSvgMarkupByKind.set(kind, markup);
      return markup;
    })
    .finally(() => {
      structureSvgMarkupPromiseByKind.delete(kind);
    });

  structureSvgMarkupPromiseByKind.set(kind, nextPromise);
  return nextPromise;
}
