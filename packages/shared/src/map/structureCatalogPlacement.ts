import type {
  MapStructureDefinition,
  MapStructurePlacement,
} from './structureCatalogTypes.js';

export function buildMapStructurePlacement(
  entry: Omit<MapStructureDefinition, 'placement'>,
): MapStructurePlacement {
  if (entry.detailPreset === 'barraco') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.12,
        scaleX: 0.52,
        scaleY: 0.46,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.18,
        scale: 0.62,
      },
    };
  }

  if (entry.detailPreset === 'favela-cluster') {
    return {
      interactionFootprintScale: 0.84,
      lot: {
        offsetX: 0,
        offsetY: 0.1,
        scaleX: 0.58,
        scaleY: 0.48,
        shape: 'compound',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.16,
        scale: 0.48,
      },
    };
  }

  if (entry.detailPreset === 'boca') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.1,
        scaleX: 0.56,
        scaleY: 0.48,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.15,
        scale: 0.6,
      },
    };
  }

  if (entry.detailPreset === 'nightlife') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.09,
        scaleX: 0.6,
        scaleY: 0.48,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: 0.6,
      },
    };
  }

  if (entry.detailPreset === 'factory') {
    const industrialScale =
      entry.kind === 'docas' ? 0.78 : entry.kind === 'desmanche' ? 0.68 : 0.74;

    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.08,
        scaleX: industrialScale - 0.1,
        scaleY: 0.52,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: entry.kind === 'docas' ? 0.62 : entry.kind === 'desmanche' ? 0.58 : 0.6,
      },
    };
  }

  if (entry.detailPreset === 'market') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.1,
        scaleX: 0.58,
        scaleY: 0.48,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.15,
        scale: 0.6,
      },
    };
  }

  if (entry.detailPreset === 'service') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.06,
        scaleX: 0.6,
        scaleY: 0.52,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: 0.64,
      },
    };
  }

  if (entry.detailPreset === 'prison') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.06,
        scaleX: 0.62,
        scaleY: 0.52,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: 0.64,
      },
    };
  }

  if (entry.detailPreset === 'university') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.06,
        scaleX: 0.62,
        scaleY: 0.52,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: 0.64,
      },
    };
  }

  if (entry.detailPreset === 'tower') {
    const isModern = entry.kind.includes('moderno');

    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.03,
        scaleX: isModern ? 0.58 : 0.62,
        scaleY: isModern ? 0.5 : 0.54,
        shape: 'block',
      },
      sprite: {
        offsetX: 0,
        offsetY: -0.08,
        scale: isModern ? 0.68 : 0.72,
      },
    };
  }

  if (entry.detailPreset === 'casa') {
    const isModern = entry.kind.includes('moderna');

    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.08,
        scaleX: isModern ? 0.64 : 0.68,
        scaleY: isModern ? 0.52 : 0.56,
        shape: 'diamond',
      },
      sprite: {
        offsetX: 0,
        offsetY: -0.05,
        scale: isModern ? 0.7 : 0.74,
      },
    };
  }

  return {
    interactionFootprintScale: 1,
    lot: {
      offsetX: 0,
      offsetY: 0.05,
      scaleX: 0.72,
      scaleY: 0.58,
      shape: 'diamond',
    },
    sprite: {
      offsetX: 0,
      offsetY: -0.05,
      scale: 0.72,
    },
  };
}
