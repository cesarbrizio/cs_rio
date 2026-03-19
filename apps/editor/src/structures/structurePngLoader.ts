import type { MapStructureKind } from '@shared/map/types';

/**
 * Maps MapStructureKind to the PNG filename (without extension) in
 * packages/shared/assets/structures/.
 *
 * Only kinds that have a PNG asset need to be listed here.
 */
const PNG_KIND_TO_FILENAME: Partial<Record<MapStructureKind, string>> = {
  'baile': 'baile_funk',
  'boca': 'boca',
  'desmanche': 'ferro-velho',
  'favela-cluster': 'favela',
  'hospital': 'hospital-publico',
  'prison': 'prisão',
  'rave': 'rave',
  'universidade': 'universidade',
};

const pngModules = import.meta.glob(
  '../../../../packages/shared/assets/structures/*.png',
  { import: 'default', eager: true },
) as Record<string, string>;

function getPngUrl(kind: MapStructureKind): string | null {
  const filename = PNG_KIND_TO_FILENAME[kind];

  if (!filename) {
    return null;
  }

  const modulePath = `../../../../packages/shared/assets/structures/${filename}.png`;
  const url = pngModules[modulePath];

  return typeof url === 'string' ? url : null;
}

const structurePngImageByKind = new Map<MapStructureKind, HTMLImageElement>();
const structurePngPromiseByKind = new Map<MapStructureKind, Promise<HTMLImageElement | null>>();

export function hasStructurePng(kind: MapStructureKind): boolean {
  return PNG_KIND_TO_FILENAME[kind] !== undefined;
}

export function getStructurePngImage(kind: MapStructureKind): HTMLImageElement | null {
  return structurePngImageByKind.get(kind) ?? null;
}

export async function loadStructurePngImage(kind: MapStructureKind): Promise<HTMLImageElement | null> {
  const cached = structurePngImageByKind.get(kind);

  if (cached) {
    return cached;
  }

  const loading = structurePngPromiseByKind.get(kind);

  if (loading) {
    return loading;
  }

  const url = getPngUrl(kind);

  if (!url) {
    return null;
  }

  const nextPromise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => {
      structurePngImageByKind.set(kind, image);
      resolve(image);
    });
    image.addEventListener('error', () => {
      resolve(null);
    });
    image.src = url;
  }).finally(() => {
    structurePngPromiseByKind.delete(kind);
  });

  structurePngPromiseByKind.set(kind, nextPromise);
  return nextPromise;
}
