import { Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { MapStructureKind } from '@shared/map/types';
import { mapStructureSvgMarkupByKind } from '@shared/map/structureSvgCatalog';

export type MapStructureSvgCatalog = Record<
  MapStructureKind,
  ReturnType<typeof Skia.SVG.MakeFromString>
>;

export function useMapStructureSvgCatalog() {
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(mapStructureSvgMarkupByKind).map(([kind, markup]) => [
          kind,
          // Strip the baked-in floor shadow so structures sit directly on the map.
          Skia.SVG.MakeFromString(markup.replace(/<ellipse\b[^>]*\/>/g, '')),
        ]),
      ) as MapStructureSvgCatalog,
    [],
  );
}
