import {
  PROPERTY_DEFINITIONS,
  type PropertySlotSummary,
  type PropertyType,
} from '@cs-rio/shared';
import { colors, type MapStructure } from '@cs-rio/domain';

import type { ProjectedFavela } from './homeTypes';

const PROPERTY_SLOT_STRUCTURE_KIND: Record<PropertyType, MapStructure['kind']> = {
  airplane: 'predio-comercial-moderno-2',
  art: 'predio-comercial-moderno-2',
  beach_house: 'casa-residencial-moderna-1',
  boca: 'boca',
  boat: 'predio-comercial-moderno-2',
  car: 'predio-comercial-moderno-1',
  factory: 'factory',
  front_store: 'predio-comercial-simples-1',
  helicopter: 'predio-comercial-moderno-2',
  house: 'casa-residencial-simples-1',
  jet_ski: 'predio-comercial-moderno-1',
  jewelry: 'predio-comercial-moderno-2',
  mansion: 'predio-residencial-moderno-1',
  puteiro: 'predio-comercial-moderno-2',
  rave: 'rave',
  slot_machine: 'predio-comercial-moderno-1',
  yacht: 'predio-residencial-moderno-2',
};

const PROPERTY_SLOT_DEFAULT_FOOTPRINT: Record<PropertyType, { h: number; w: number }> = {
  airplane: { w: 2, h: 2 },
  art: { w: 2, h: 2 },
  beach_house: { w: 2, h: 2 },
  boca: { w: 2, h: 2 },
  boat: { w: 2, h: 2 },
  car: { w: 2, h: 2 },
  factory: { w: 5, h: 4 },
  front_store: { w: 2, h: 2 },
  helicopter: { w: 2, h: 2 },
  house: { w: 2, h: 2 },
  jet_ski: { w: 2, h: 2 },
  jewelry: { w: 2, h: 2 },
  mansion: { w: 2, h: 2 },
  puteiro: { w: 2, h: 2 },
  rave: { w: 4, h: 3 },
  slot_machine: { w: 2, h: 2 },
  yacht: { w: 2, h: 2 },
};

function resolvePropertySlotAccent(input: {
  ownerId: string | null;
  playerId: string | null | undefined;
}): string {
  if (!input.ownerId) {
    return colors.success;
  }

  if (input.playerId && input.ownerId === input.playerId) {
    return colors.info;
  }

  return colors.warning;
}

function resolvePropertySlotLabel(slot: PropertySlotSummary): string {
  const definition = PROPERTY_DEFINITIONS.find((entry) => entry.type === slot.propertyType);
  const label = definition?.label ?? slot.propertyType;
  return slot.ownerLabel ? `${label} · ${slot.ownerLabel}` : `${label} · Livre`;
}

export function buildStaticStructures(input: {
  baseStructures: MapStructure[];
  currentRegionPropertySlots: PropertySlotSummary[];
  playerId?: string | null;
  projectedFavelas: ProjectedFavela[];
}): MapStructure[] {
  const propertyStructuresById = new Map(
    input.currentRegionPropertySlots.map((slot) => {
      const existingStructure =
        input.baseStructures.find((structure) => structure.id === slot.structureId) ?? null;
      const kind = existingStructure?.kind ?? PROPERTY_SLOT_STRUCTURE_KIND[slot.propertyType];
      const footprint =
        existingStructure?.footprint ?? PROPERTY_SLOT_DEFAULT_FOOTPRINT[slot.propertyType];

      return [
        slot.structureId,
        {
          accent: resolvePropertySlotAccent({
            ownerId: slot.ownerId,
            playerId: input.playerId,
          }),
          footprint,
          id: slot.structureId,
          kind,
          label: resolvePropertySlotLabel(slot),
          position: existingStructure?.position ?? {
            x: slot.gridPosition.x,
            y: slot.gridPosition.y,
          },
        } satisfies MapStructure,
      ] as const;
    }),
  );
  const nonFavelaStructures = input.baseStructures.filter(
    (structure) =>
      structure.kind !== 'favela-cluster' && !propertyStructuresById.has(structure.id),
  );
  const dynamicFavelaStructures = input.projectedFavelas.map(({ center, favela }) => {
    const footprint =
      favela.difficulty >= 8
        ? { w: 5, h: 4 }
        : favela.difficulty >= 6
          ? { w: 5, h: 4 }
          : { w: 4, h: 3 };

    return {
      footprint,
      id: `favela-visual:${favela.id}`,
      kind: 'favela-cluster' as const,
      label: favela.name,
      position: {
        x: center.x - Math.floor(footprint.w / 2),
        y: center.y - Math.floor(footprint.h / 2),
      },
    };
  });

  return [
    ...nonFavelaStructures,
    ...propertyStructuresById.values(),
    ...dynamicFavelaStructures,
  ];
}
