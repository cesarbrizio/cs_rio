import type { MapStructureKind } from './types.js';

export {
  mapStructureSvgMarkupByKind,
  mapStructureSvgSourceByKind,
} from './generated/mapStructureSvgCatalog.generated.js';

export type MapStructureSvgMarkupCatalog = Record<MapStructureKind, string>;
export type MapStructureSvgSource = 'generated' | 'legacy';
