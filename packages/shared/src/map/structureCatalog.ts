import type { PropertyType } from '../types.js';
import type { MapStructureKind } from './types.js';
import { catalogEntries } from './structureCatalogEntries.js';
import { buildMapStructurePlacement } from './structureCatalogPlacement.js';
import type { MapStructureDefinition } from './structureCatalogTypes.js';

export * from './structureCatalogTypes.js';

const normalizedCatalogEntries: MapStructureDefinition[] = catalogEntries.map((entry) => ({
  ...entry,
  placement: buildMapStructurePlacement(entry),
}));

export const MAP_STRUCTURE_CATALOG: Record<MapStructureKind, MapStructureDefinition> =
  Object.fromEntries(normalizedCatalogEntries.map((entry) => [entry.kind, entry])) as Record<
    MapStructureKind,
    MapStructureDefinition
  >;

export function isMapStructureKind(value: string): value is MapStructureKind {
  return Object.hasOwn(MAP_STRUCTURE_CATALOG, value);
}

export function getMapStructureDefinition(kind: MapStructureKind): MapStructureDefinition {
  return MAP_STRUCTURE_CATALOG[kind];
}

export function isMapStructurePurchasable(kind: MapStructureKind): boolean {
  return Boolean(MAP_STRUCTURE_CATALOG[kind].purchasable);
}

export function listMapStructurePropertyTypeOptions(kind: MapStructureKind): PropertyType[] {
  return MAP_STRUCTURE_CATALOG[kind].propertyTypeOptions ?? [];
}
