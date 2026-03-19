import { useEffect, useMemo, useState } from 'react';

import type { MapStructureKind } from '@shared/map/types';

import { hasStructurePng, loadStructurePngImage } from './structurePngLoader';
import { loadStructureSvgMarkup } from './structureSvgLoader';

type StructureImageCatalog = Partial<Record<MapStructureKind, HTMLImageElement>>;

const structureImageByKind = new Map<MapStructureKind, HTMLImageElement>();
const structureImagePromiseByKind = new Map<MapStructureKind, Promise<HTMLImageElement>>();

function stripFloorShadow(markup: string) {
  return markup.replace(/<ellipse\b[^>]*\/>/g, '');
}

function buildRequestedKindsKey(requestedKinds: readonly MapStructureKind[]) {
  return [...new Set(requestedKinds)].sort((left, right) => left.localeCompare(right)).join('|');
}

async function loadStructureImageFromSvg(kind: MapStructureKind): Promise<HTMLImageElement> {
  const markup = await loadStructureSvgMarkup(kind);
  const objectUrl = URL.createObjectURL(
    new Blob([stripFloorShadow(markup)], { type: 'image/svg+xml' }),
  );

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => {
      structureImageByKind.set(kind, image);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load structure SVG for ${kind}`));
    });
    image.src = objectUrl;
  });
}

async function loadStructureImage(kind: MapStructureKind) {
  const cachedImage = structureImageByKind.get(kind);

  if (cachedImage) {
    return cachedImage;
  }

  const loadingImage = structureImagePromiseByKind.get(kind);

  if (loadingImage) {
    return loadingImage;
  }

  const nextPromise = (async () => {
    // Prefer PNG (3D render) over SVG (generated placeholder)
    if (hasStructurePng(kind)) {
      const pngImage = await loadStructurePngImage(kind);

      if (pngImage) {
        structureImageByKind.set(kind, pngImage);
        return pngImage;
      }
    }

    return loadStructureImageFromSvg(kind);
  })().finally(() => {
    structureImagePromiseByKind.delete(kind);
  });

  structureImagePromiseByKind.set(kind, nextPromise);
  return nextPromise;
}

function buildImageCatalog(requestedKinds: readonly MapStructureKind[]) {
  return requestedKinds.reduce<StructureImageCatalog>((catalog, kind) => {
    const image = structureImageByKind.get(kind);

    if (image) {
      catalog[kind] = image;
    }

    return catalog;
  }, {});
}

export function useStructureImageCatalog(requestedKinds: readonly MapStructureKind[]) {
  const [version, setVersion] = useState(0);
  const requestedKindsKey = useMemo(
    () => buildRequestedKindsKey(requestedKinds),
    [requestedKinds],
  );
  const normalizedKinds = useMemo(
    () => (requestedKindsKey.length > 0 ? (requestedKindsKey.split('|') as MapStructureKind[]) : []),
    [requestedKindsKey],
  );

  useEffect(() => {
    let isActive = true;

    for (const kind of normalizedKinds) {
      if (structureImageByKind.has(kind)) {
        continue;
      }

      void loadStructureImage(kind)
        .catch(() => null)
        .finally(() => {
          if (isActive) {
            setVersion((current) => current + 1);
          }
        });
    }

    return () => {
      isActive = false;
    };
  }, [normalizedKinds]);

  return useMemo(
    () => ({
      imageCatalog: buildImageCatalog(normalizedKinds),
      loadingKinds: normalizedKinds.filter((kind) => !structureImageByKind.has(kind)),
      version,
    }),
    [normalizedKinds, version],
  );
}
