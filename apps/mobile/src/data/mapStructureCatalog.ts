import type { MapStructureKind } from './mapRegionVisuals';

export type MapStructureCategory =
  | 'clandestino'
  | 'comercial'
  | 'equipamento'
  | 'favela'
  | 'industrial'
  | 'institucional'
  | 'residencial';

export type MapStructureDetailPreset =
  | 'barraco'
  | 'boca'
  | 'casa'
  | 'favela-cluster'
  | 'factory'
  | 'market'
  | 'nightlife'
  | 'prison'
  | 'service'
  | 'tower'
  | 'training'
  | 'university';

export type MapStructureLotShape = 'block' | 'compound' | 'diamond' | 'yard';

export interface MapStructurePlacement {
  interactionFootprintScale: number;
  lot: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    shape: MapStructureLotShape;
  };
  sprite: {
    offsetX: number;
    offsetY: number;
    scale: number;
  };
}

export interface MapStructureDefinition {
  category: MapStructureCategory;
  defaultFootprint: { h: number; w: number };
  detailPreset: MapStructureDetailPreset;
  height: number;
  kind: MapStructureKind;
  label: string;
  palette: {
    detail: string;
    detailSoft: string;
    glow: string;
    leftWall: string;
    outline: string;
    rightWall: string;
    roof: string;
  };
  placement: MapStructurePlacement;
}

const catalogEntries: Array<Omit<MapStructureDefinition, 'placement'>> = [
  {
    category: 'favela',
    defaultFootprint: { w: 1, h: 1 },
    detailPreset: 'barraco',
    height: 12,
    kind: 'barraco-1',
    label: 'Barraco 1',
    palette: {
      detail: '#2a1d18',
      detailSoft: '#8b6554',
      glow: '#a96b57',
      leftWall: '#563c33',
      outline: '#1b120f',
      rightWall: '#735046',
      roof: '#a17361',
    },
  },
  {
    category: 'favela',
    defaultFootprint: { w: 1, h: 1 },
    detailPreset: 'barraco',
    height: 12,
    kind: 'barraco-2',
    label: 'Barraco 2',
    palette: {
      detail: '#2a1d18',
      detailSoft: '#775849',
      glow: '#94614f',
      leftWall: '#4f372f',
      outline: '#1b120f',
      rightWall: '#6a4a3f',
      roof: '#946959',
    },
  },
  {
    category: 'favela',
    defaultFootprint: { w: 1, h: 1 },
    detailPreset: 'barraco',
    height: 12,
    kind: 'barraco-3',
    label: 'Barraco 3',
    palette: {
      detail: '#291d18',
      detailSoft: '#6a5244',
      glow: '#8b5b49',
      leftWall: '#47332c',
      outline: '#1b120f',
      rightWall: '#5f463a',
      roof: '#876152',
    },
  },
  {
    category: 'favela',
    defaultFootprint: { w: 1, h: 1 },
    detailPreset: 'barraco',
    height: 12,
    kind: 'barraco-4',
    label: 'Barraco 4',
    palette: {
      detail: '#291d18',
      detailSoft: '#907159',
      glow: '#b67c59',
      leftWall: '#5d4337',
      outline: '#1b120f',
      rightWall: '#7a5847',
      roof: '#b18467',
    },
  },
  {
    category: 'favela',
    defaultFootprint: { w: 1, h: 1 },
    detailPreset: 'barraco',
    height: 12,
    kind: 'barraco-5',
    label: 'Barraco 5',
    palette: {
      detail: '#271c18',
      detailSoft: '#8f6a4f',
      glow: '#aa7156',
      leftWall: '#583d31',
      outline: '#1b120f',
      rightWall: '#6f4f40',
      roof: '#9f745a',
    },
  },
  {
    category: 'favela',
    defaultFootprint: { w: 6, h: 5 },
    detailPreset: 'favela-cluster',
    height: 18,
    kind: 'favela-cluster',
    label: 'Favela',
    palette: {
      detail: '#2a1d18',
      detailSoft: '#7f5b4b',
      glow: '#8a4f4f',
      leftWall: '#4c352f',
      outline: '#1e1411',
      rightWall: '#68483e',
      roof: '#8f6255',
    },
  },
  {
    category: 'clandestino',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'boca',
    height: 18,
    kind: 'boca',
    label: 'Boca de Fumo',
    palette: {
      detail: '#211a14',
      detailSoft: '#8b6d4a',
      glow: '#d58e38',
      leftWall: '#4d3827',
      outline: '#19120e',
      rightWall: '#6a4b34',
      roof: '#9f744c',
    },
  },
  {
    category: 'clandestino',
    defaultFootprint: { w: 4, h: 3 },
    detailPreset: 'nightlife',
    height: 22,
    kind: 'baile',
    label: 'Baile',
    palette: {
      detail: '#241728',
      detailSoft: '#8b63a1',
      glow: '#d15ff1',
      leftWall: '#4a3555',
      outline: '#1d1220',
      rightWall: '#694b7b',
      roof: '#9f73b6',
    },
  },
  {
    category: 'clandestino',
    defaultFootprint: { w: 4, h: 3 },
    detailPreset: 'nightlife',
    height: 22,
    kind: 'rave',
    label: 'Rave',
    palette: {
      detail: '#221b2f',
      detailSoft: '#668bd2',
      glow: '#70d7ff',
      leftWall: '#3f4e68',
      outline: '#1b1421',
      rightWall: '#5d7598',
      roof: '#7895c2',
    },
  },
  {
    category: 'institucional',
    defaultFootprint: { w: 3, h: 3 },
    detailPreset: 'service',
    height: 28,
    kind: 'hospital',
    label: 'Hospital',
    palette: {
      detail: '#213040',
      detailSoft: '#9cb7d0',
      glow: '#7fb0ff',
      leftWall: '#556a7f',
      outline: '#17212c',
      rightWall: '#7289a3',
      roof: '#96abc2',
    },
  },
  {
    category: 'institucional',
    defaultFootprint: { w: 4, h: 3 },
    detailPreset: 'prison',
    height: 28,
    kind: 'prison',
    label: 'Prisão',
    palette: {
      detail: '#2a2f36',
      detailSoft: '#8c99a8',
      glow: '#7f8ea0',
      leftWall: '#5a6673',
      outline: '#1b2128',
      rightWall: '#758290',
      roof: '#97a4b2',
    },
  },
  {
    category: 'industrial',
    defaultFootprint: { w: 4, h: 3 },
    detailPreset: 'factory',
    height: 28,
    kind: 'factory',
    label: 'Fábrica',
    palette: {
      detail: '#182028',
      detailSoft: '#5b646c',
      glow: '#6f8ea8',
      leftWall: '#3f454d',
      outline: '#14181d',
      rightWall: '#59616c',
      roof: '#7d8794',
    },
  },
  {
    category: 'clandestino',
    defaultFootprint: { w: 3, h: 2 },
    detailPreset: 'market',
    height: 18,
    kind: 'mercado-negro',
    label: 'Mercado Negro',
    palette: {
      detail: '#281d30',
      detailSoft: '#806295',
      glow: '#b277d8',
      leftWall: '#4f395d',
      outline: '#201523',
      rightWall: '#6b4f7b',
      roof: '#8a66a3',
    },
  },
  {
    category: 'equipamento',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'training',
    height: 22,
    kind: 'treino',
    label: 'Treino',
    palette: {
      detail: '#2c2519',
      detailSoft: '#b79a60',
      glow: '#e0b04b',
      leftWall: '#635338',
      outline: '#211b12',
      rightWall: '#8a744c',
      roof: '#b5965f',
    },
  },
  {
    category: 'institucional',
    defaultFootprint: { w: 4, h: 3 },
    detailPreset: 'university',
    height: 38,
    kind: 'universidade',
    label: 'Universidade',
    palette: {
      detail: '#213040',
      detailSoft: '#9cb7d0',
      glow: '#7fb0ff',
      leftWall: '#556a7f',
      outline: '#17212c',
      rightWall: '#7289a3',
      roof: '#96abc2',
    },
  },
  {
    category: 'industrial',
    defaultFootprint: { w: 5, h: 3 },
    detailPreset: 'factory',
    height: 28,
    kind: 'docas',
    label: 'Docas',
    palette: {
      detail: '#182028',
      detailSoft: '#5b646c',
      glow: '#74b9ff',
      leftWall: '#3f454d',
      outline: '#14181d',
      rightWall: '#59616c',
      roof: '#7d8794',
    },
  },
  {
    category: 'industrial',
    defaultFootprint: { w: 3, h: 2 },
    detailPreset: 'factory',
    height: 22,
    kind: 'desmanche',
    label: 'Desmanche',
    palette: {
      detail: '#1f1f1f',
      detailSoft: '#746859',
      glow: '#cf8056',
      leftWall: '#47413a',
      outline: '#171412',
      rightWall: '#655b50',
      roof: '#8b7e6f',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 34,
    kind: 'predio-residencial-simples-1',
    label: 'Prédio residencial simples 1',
    palette: {
      detail: '#2f343b',
      detailSoft: '#c8d1d9',
      glow: '#a7b9c7',
      leftWall: '#6b727c',
      outline: '#242930',
      rightWall: '#89919b',
      roof: '#bfc8d2',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 34,
    kind: 'predio-residencial-simples-2',
    label: 'Prédio residencial simples 2',
    palette: {
      detail: '#31363d',
      detailSoft: '#d4d8dd',
      glow: '#b2bfc8',
      leftWall: '#717780',
      outline: '#272b30',
      rightWall: '#8c949d',
      roof: '#c8d0d8',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 46,
    kind: 'predio-residencial-moderno-1',
    label: 'Prédio residencial moderno 1',
    palette: {
      detail: '#25313a',
      detailSoft: '#b8c6d2',
      glow: '#7ec8ff',
      leftWall: '#566774',
      outline: '#1d252d',
      rightWall: '#748897',
      roof: '#9eb0bf',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 46,
    kind: 'predio-residencial-moderno-2',
    label: 'Prédio residencial moderno 2',
    palette: {
      detail: '#21303a',
      detailSoft: '#a8c0d8',
      glow: '#69baff',
      leftWall: '#4f6678',
      outline: '#1b242b',
      rightWall: '#6e879b',
      roof: '#93abc1',
    },
  },
  {
    category: 'comercial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 34,
    kind: 'predio-comercial-simples-1',
    label: 'Prédio comercial simples 1',
    palette: {
      detail: '#27313b',
      detailSoft: '#9eb4c4',
      glow: '#82b4d0',
      leftWall: '#5f6d79',
      outline: '#1d252d',
      rightWall: '#778794',
      roof: '#a8b8c6',
    },
  },
  {
    category: 'comercial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 34,
    kind: 'predio-comercial-simples-2',
    label: 'Prédio comercial simples 2',
    palette: {
      detail: '#2a3138',
      detailSoft: '#b4c2cd',
      glow: '#94b4ca',
      leftWall: '#626f79',
      outline: '#21272d',
      rightWall: '#7b8993',
      roof: '#b9c5cf',
    },
  },
  {
    category: 'comercial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 46,
    kind: 'predio-comercial-moderno-1',
    label: 'Prédio comercial moderno 1',
    palette: {
      detail: '#24323b',
      detailSoft: '#b9d1e1',
      glow: '#86cbff',
      leftWall: '#5b7281',
      outline: '#1c252d',
      rightWall: '#7c96a7',
      roof: '#a7bbca',
    },
  },
  {
    category: 'comercial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'tower',
    height: 46,
    kind: 'predio-comercial-moderno-2',
    label: 'Prédio comercial moderno 2',
    palette: {
      detail: '#1f2f3a',
      detailSoft: '#a8c7df',
      glow: '#6ab9ff',
      leftWall: '#516a7c',
      outline: '#182128',
      rightWall: '#7290a4',
      roof: '#99b6ca',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'casa',
    height: 20,
    kind: 'casa-residencial-simples-1',
    label: 'Casa residencial simples 1',
    palette: {
      detail: '#3a2c20',
      detailSoft: '#d3c4b0',
      glow: '#d1b184',
      leftWall: '#6f5d4a',
      outline: '#2d2218',
      rightWall: '#8d765f',
      roof: '#b79c7d',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'casa',
    height: 20,
    kind: 'casa-residencial-simples-2',
    label: 'Casa residencial simples 2',
    palette: {
      detail: '#392d22',
      detailSoft: '#c6b49c',
      glow: '#cda26e',
      leftWall: '#665443',
      outline: '#2c2119',
      rightWall: '#846d57',
      roof: '#ad8d6f',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'casa',
    height: 20,
    kind: 'casa-residencial-moderna-1',
    label: 'Casa residencial moderna 1',
    palette: {
      detail: '#33414d',
      detailSoft: '#d5dde5',
      glow: '#8ec8ff',
      leftWall: '#667380',
      outline: '#2b333a',
      rightWall: '#8793a0',
      roof: '#c4d0da',
    },
  },
  {
    category: 'residencial',
    defaultFootprint: { w: 2, h: 2 },
    detailPreset: 'casa',
    height: 20,
    kind: 'casa-residencial-moderna-2',
    label: 'Casa residencial moderna 2',
    palette: {
      detail: '#32414c',
      detailSoft: '#c7d6e2',
      glow: '#72b8f2',
      leftWall: '#60717f',
      outline: '#28333b',
      rightWall: '#8193a2',
      roof: '#b8c9d7',
    },
  },
];

function buildMapStructurePlacement(
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

  if (entry.detailPreset === 'training') {
    return {
      interactionFootprintScale: 1,
      lot: {
        offsetX: 0,
        offsetY: 0.08,
        scaleX: 0.56,
        scaleY: 0.46,
        shape: 'yard',
      },
      sprite: {
        offsetX: 0,
        offsetY: 0.14,
        scale: 0.58,
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

const normalizedCatalogEntries: MapStructureDefinition[] = catalogEntries.map((entry) => ({
  ...entry,
  placement: buildMapStructurePlacement(entry),
}));

export const MAP_STRUCTURE_CATALOG: Record<MapStructureKind, MapStructureDefinition> =
  Object.fromEntries(normalizedCatalogEntries.map((entry) => [entry.kind, entry])) as Record<
    MapStructureKind,
    MapStructureDefinition
  >;

export function getMapStructureDefinition(kind: MapStructureKind): MapStructureDefinition {
  return MAP_STRUCTURE_CATALOG[kind];
}
