import type { MapEntityKind, MapStructureKind } from '@cs-rio/shared';
import { colors } from './colors';

export type { MapEntityKind, MapStructureKind } from '@cs-rio/shared';

export interface MapGroundPatch {
  accent?: string;
  center: { x: number; y: number };
  fill: string;
  id: string;
  kind:
    | 'blocked'
    | 'commercial-yard'
    | 'concrete'
    | 'earth'
    | 'favela-core'
    | 'greenery'
    | 'hillside'
    | 'industrial-yard'
    | 'vacant-lot';
  label?: string;
  radiusTiles: { x: number; y: number };
}

export interface MapLandmark {
  accent?: string;
  id: string;
  label: string;
  position: { x: number; y: number };
  shape: 'gate' | 'plaza' | 'tower' | 'warehouse';
}

export interface MapStructure {
  accent?: string;
  footprint: { h: number; w: number };
  id: string;
  interactiveEntityId?: string;
  kind: MapStructureKind;
  label?: string;
  position: { x: number; y: number };
}

export interface MapVisualPreset {
  contextSpots: Array<{
    entityId: string;
    position: { x: number; y: number };
    reach: number;
    title: string;
  }>;
  entities: Array<{
    color?: string;
    id: string;
    kind: MapEntityKind;
    label?: string;
    position: { x: number; y: number };
  }>;
  groundPatches: MapGroundPatch[];
  landmarks: MapLandmark[];
  structures: MapStructure[];
  trails: Array<{
    accent?: string;
    id: string;
    kind: 'alley' | 'avenue' | 'stairs' | 'street';
    label: string;
    points: Array<{ x: number; y: number }>;
  }>;
  zoneSlots: Array<{
    accent: string;
    center: { x: number; y: number };
    id: string;
    radiusTiles: { x: number; y: number };
  }>;
}

function structure(
  id: string,
  kind: MapStructureKind,
  x: number,
  y: number,
  footprint: { h: number; w: number },
  options: {
    accent?: string;
    interactiveEntityId?: string;
    label?: string;
  } = {},
): MapStructure {
  return {
    accent: options.accent,
    footprint,
    id,
    interactiveEntityId: options.interactiveEntityId,
    kind,
    label: options.label,
    position: { x, y },
  };
}

interface CompactPresetOptions {
  anchor: { x: number; y: number };
  patchScale?: number;
  positionScale?: number;
  reachScale?: number;
  zoneScale?: number;
}

function compactPoint(
  point: { x: number; y: number },
  anchor: { x: number; y: number },
  scale: number,
) {
  return {
    x: Math.round(anchor.x + (point.x - anchor.x) * scale),
    y: Math.round(anchor.y + (point.y - anchor.y) * scale),
  };
}

function compactRadius(
  radius: { x: number; y: number },
  scale: number,
  minimum: { x: number; y: number },
) {
  return {
    x: Math.max(minimum.x, Math.round(radius.x * scale)),
    y: Math.max(minimum.y, Math.round(radius.y * scale)),
  };
}

function compactMapPreset(
  preset: MapVisualPreset,
  options: CompactPresetOptions,
): MapVisualPreset {
  const positionScale = options.positionScale ?? 0.36;
  const patchScale = options.patchScale ?? 0.58;
  const zoneScale = options.zoneScale ?? 0.66;
  const reachScale = options.reachScale ?? 0.82;

  return {
    entities: preset.entities.map((entity) => ({
      ...entity,
      position: compactPoint(entity.position, options.anchor, positionScale),
    })),
    contextSpots: preset.contextSpots.map((spot) => ({
      ...spot,
      position: compactPoint(spot.position, options.anchor, positionScale),
      reach: Math.max(4, Math.round(spot.reach * reachScale)),
    })),
    groundPatches: preset.groundPatches.map((patch) => ({
      ...patch,
      center: compactPoint(patch.center, options.anchor, positionScale),
      radiusTiles: compactRadius(patch.radiusTiles, patchScale, { x: 6, y: 4 }),
    })),
    landmarks: preset.landmarks.map((landmark) => ({
      ...landmark,
      position: compactPoint(landmark.position, options.anchor, positionScale),
    })),
    structures: preset.structures.map((structureItem) => ({
      ...structureItem,
      position: compactPoint(structureItem.position, options.anchor, positionScale),
    })),
    trails: preset.trails.map((trail) => ({
      ...trail,
      points: trail.points.map((point) => compactPoint(point, options.anchor, positionScale)),
    })),
    zoneSlots: preset.zoneSlots.map((slot) => ({
      ...slot,
      center: compactPoint(slot.center, options.anchor, positionScale),
      radiusTiles: compactRadius(slot.radiusTiles, zoneScale, { x: 4, y: 3 }),
    })),
  };
}

const INTERACTIVE_STRUCTURE_KINDS = new Set<MapStructureKind>([
  'favela-cluster',
  'boca',
  'baile',
  'rave',
  'hospital',
  'prison',
  'factory',
  'mercado-negro',
  'treino',
  'universidade',
  'docas',
  'desmanche',
]);

function prunePresetToInteractive(preset: MapVisualPreset): MapVisualPreset {
  return {
    ...preset,
    landmarks: [],
    structures: preset.structures.filter((structureItem) =>
      INTERACTIVE_STRUCTURE_KINDS.has(structureItem.kind),
    ),
    trails: [],
  };
}

function repositionEntities(
  entities: MapVisualPreset['entities'],
  positions: Record<string, { x: number; y: number }>,
) {
  return entities.map((entity) => {
    const nextPosition = positions[entity.id];

    return nextPosition
      ? {
          ...entity,
          position: nextPosition,
        }
      : entity;
  });
}

function repositionContextSpots(
  spots: MapVisualPreset['contextSpots'],
  positions: Record<string, { x: number; y: number }>,
) {
  return spots.map((spot) => {
    const nextPosition = positions[spot.entityId];

    return nextPosition
      ? {
          ...spot,
          position: nextPosition,
        }
      : spot;
  });
}

function repositionStructures(
  structures: MapVisualPreset['structures'],
  positions: Record<string, { x: number; y: number }>,
) {
  return structures.map((structureItem) => {
    const nextPosition = positions[structureItem.id];

    return nextPosition
      ? {
          ...structureItem,
          position: nextPosition,
        }
      : structureItem;
  });
}

const centroPreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-negro', kind: 'market', label: 'Mercado Negro', position: { x: 108, y: 100 } },
    { color: '#7fb0ff', id: 'hospital-centro', kind: 'hospital', label: 'Hospital', position: { x: 48, y: 86 } },
    { color: '#e0b04b', id: 'treino-centro', kind: 'training', label: 'Treino', position: { x: 70, y: 88 } },
    { color: '#8cc7ff', id: 'universidade-centro', kind: 'university', label: 'Universidade', position: { x: 132, y: 82 } },
    { color: '#86bbd8', id: 'boca-prototipo', kind: 'boca', label: 'Boca', position: { x: 64, y: 128 } },
    { color: '#4cb071', id: 'fabrica-prototipo', kind: 'factory', label: 'Fábrica', position: { x: 154, y: 110 } },
    { color: '#d487ff', id: 'baile-prototipo', kind: 'party', label: 'Baile', position: { x: 82, y: 138 } },
    { color: '#6db7ff', id: 'rave-centro', kind: 'party', label: 'Rave', position: { x: 104, y: 132 } },
    { color: '#74b9ff', id: 'docas-centro', kind: 'docks', label: 'Docas', position: { x: 164, y: 88 } },
  ],
  contextSpots: [
    { entityId: 'mercado-negro', position: { x: 108, y: 100 }, reach: 6, title: 'Mercado Negro' },
    { entityId: 'hospital-centro', position: { x: 48, y: 86 }, reach: 5, title: 'Hospital' },
    { entityId: 'treino-centro', position: { x: 70, y: 88 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-centro', position: { x: 132, y: 82 }, reach: 5, title: 'Universidade' },
    { entityId: 'boca-prototipo', position: { x: 64, y: 128 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-prototipo', position: { x: 154, y: 110 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-prototipo', position: { x: 82, y: 138 }, reach: 6, title: 'Baile' },
    { entityId: 'rave-centro', position: { x: 104, y: 132 }, reach: 6, title: 'Rave' },
    { entityId: 'docas-centro', position: { x: 164, y: 88 }, reach: 6, title: 'Docas' },
  ],
  groundPatches: [
    {
      accent: '#566650',
      center: { x: 104, y: 106 },
      fill: '#44503f',
      id: 'centro-base-verde',
      kind: 'greenery',
      radiusTiles: { x: 60, y: 34 },
    },
    {
      accent: '#74644f',
      center: { x: 120, y: 138 },
      fill: '#5a4f43',
      id: 'centro-laje-sul',
      kind: 'vacant-lot',
      radiusTiles: { x: 24, y: 13 },
    },
    {
      accent: '#886b52',
      center: { x: 170, y: 94 },
      fill: '#685747',
      id: 'centro-terra-cais',
      kind: 'earth',
      radiusTiles: { x: 18, y: 10 },
    },
    {
      accent: '#67645b',
      center: { x: 106, y: 102 },
      fill: '#5b5750',
      id: 'centro-miolo-urbano',
      kind: 'concrete',
      radiusTiles: { x: 30, y: 16 },
    },
    {
      accent: '#7c715d',
      center: { x: 108, y: 96 },
      fill: '#6f6554',
      id: 'centro-setor-comercial',
      kind: 'commercial-yard',
      radiusTiles: { x: 20, y: 10 },
    },
    {
      accent: '#6c6358',
      center: { x: 158, y: 92 },
      fill: '#5f564c',
      id: 'centro-setor-portuario',
      kind: 'industrial-yard',
      radiusTiles: { x: 20, y: 10 },
    },
    {
      accent: '#596654',
      center: { x: 58, y: 122 },
      fill: '#505e4b',
      id: 'centro-encosta-providencia',
      kind: 'hillside',
      radiusTiles: { x: 16, y: 11 },
    },
    {
      accent: '#7c5b4d',
      center: { x: 70, y: 128 },
      fill: '#64463a',
      id: 'centro-favela-providencia',
      kind: 'favela-core',
      radiusTiles: { x: 15, y: 10 },
    },
    {
      accent: '#8f6344',
      center: { x: 180, y: 94 },
      fill: '#46352d',
      id: 'centro-bloqueio-cais',
      kind: 'blocked',
      radiusTiles: { x: 7, y: 5 },
    },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'centro-entrada-providencia', label: 'Entrada da Providência', position: { x: 66, y: 118 }, shape: 'gate' },
    { accent: '#d8c27c', id: 'centro-praca-mercado', label: 'Praça do Comércio', position: { x: 108, y: 100 }, shape: 'plaza' },
    { accent: '#7a5f43', id: 'centro-armazem-cais', label: 'Pátio do Cais', position: { x: 162, y: 90 }, shape: 'warehouse' },
  ],
  structures: [
    structure('centro-hospital', 'hospital', 44, 84, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-centro' }),
    structure('centro-treino', 'treino', 68, 86, { w: 3, h: 2 }, { interactiveEntityId: 'treino-centro' }),
    structure('centro-universidade', 'universidade', 128, 80, { w: 5, h: 3 }, { interactiveEntityId: 'universidade-centro' }),
    structure('centro-mercado', 'mercado-negro', 106, 98, { w: 4, h: 3 }, { interactiveEntityId: 'mercado-negro' }),
    structure('centro-docas', 'docas', 158, 86, { w: 7, h: 3 }, { interactiveEntityId: 'docas-centro' }),
    structure('centro-fabrica', 'factory', 150, 108, { w: 5, h: 4 }, { interactiveEntityId: 'fabrica-prototipo' }),
    structure('centro-baile', 'baile', 80, 136, { w: 4, h: 3 }, { interactiveEntityId: 'baile-prototipo' }),
    structure('centro-rave', 'rave', 102, 130, { w: 4, h: 3 }, { interactiveEntityId: 'rave-centro' }),
    structure('centro-boca', 'boca', 62, 126, { w: 2, h: 2 }, { interactiveEntityId: 'boca-prototipo' }),
    structure('centro-prisao', 'prison', 38, 96, { w: 4, h: 3 }),

    structure('centro-predio-com-1', 'predio-comercial-moderno-1', 84, 84, { w: 2, h: 2 }),
    structure('centro-predio-com-2', 'predio-comercial-moderno-2', 90, 84, { w: 2, h: 2 }),
    structure('centro-predio-com-3', 'predio-comercial-simples-1', 96, 86, { w: 2, h: 2 }),
    structure('centro-predio-com-4', 'predio-comercial-simples-2', 102, 84, { w: 2, h: 2 }),
    structure('centro-predio-com-5', 'predio-comercial-moderno-1', 108, 84, { w: 2, h: 2 }),
    structure('centro-predio-com-6', 'predio-comercial-moderno-2', 114, 86, { w: 2, h: 2 }),
    structure('centro-predio-com-7', 'predio-comercial-simples-1', 120, 88, { w: 2, h: 2 }),
    structure('centro-predio-com-8', 'predio-comercial-simples-2', 126, 88, { w: 2, h: 2 }),
    structure('centro-predio-com-9', 'predio-comercial-moderno-1', 94, 94, { w: 2, h: 2 }),
    structure('centro-predio-com-10', 'predio-comercial-moderno-2', 100, 94, { w: 2, h: 2 }),
    structure('centro-predio-com-11', 'predio-comercial-simples-1', 110, 94, { w: 2, h: 2 }),
    structure('centro-predio-com-12', 'predio-comercial-simples-2', 118, 96, { w: 2, h: 2 }),
    structure('centro-predio-com-13', 'predio-comercial-moderno-1', 126, 96, { w: 2, h: 2 }),
    structure('centro-predio-com-14', 'predio-comercial-moderno-2', 134, 98, { w: 2, h: 2 }),

    structure('centro-predio-res-1', 'predio-residencial-simples-1', 92, 108, { w: 2, h: 2 }),
    structure('centro-predio-res-2', 'predio-residencial-simples-2', 98, 110, { w: 2, h: 2 }),
    structure('centro-predio-res-3', 'predio-residencial-moderno-1', 106, 110, { w: 2, h: 2 }),
    structure('centro-predio-res-4', 'predio-residencial-moderno-2', 112, 112, { w: 2, h: 2 }),
    structure('centro-predio-res-5', 'predio-residencial-simples-1', 120, 112, { w: 2, h: 2 }),
    structure('centro-predio-res-6', 'predio-residencial-simples-2', 126, 114, { w: 2, h: 2 }),
    structure('centro-predio-res-7', 'predio-residencial-moderno-1', 134, 114, { w: 2, h: 2 }),
    structure('centro-predio-res-8', 'predio-residencial-moderno-2', 140, 114, { w: 2, h: 2 }),

    structure('centro-porto-1', 'predio-comercial-simples-1', 146, 92, { w: 2, h: 2 }),
    structure('centro-porto-2', 'predio-comercial-simples-2', 152, 92, { w: 2, h: 2 }),
    structure('centro-porto-3', 'predio-comercial-simples-1', 148, 100, { w: 2, h: 2 }),
    structure('centro-porto-4', 'predio-comercial-simples-2', 154, 100, { w: 2, h: 2 }),

    structure('centro-favela-core', 'favela-cluster', 54, 116, { w: 10, h: 8 }),
    structure('centro-favela-core-2', 'favela-cluster', 66, 126, { w: 7, h: 6 }),
    structure('centro-favela-core-3', 'favela-cluster', 76, 118, { w: 6, h: 5 }),
    structure('centro-barraco-1', 'barraco-1', 54, 116, { w: 1, h: 1 }),
    structure('centro-barraco-2', 'barraco-2', 58, 118, { w: 1, h: 1 }),
    structure('centro-barraco-3', 'barraco-3', 62, 120, { w: 1, h: 1 }),
    structure('centro-barraco-4', 'barraco-4', 66, 122, { w: 1, h: 1 }),
    structure('centro-barraco-5', 'barraco-5', 70, 124, { w: 1, h: 1 }),
    structure('centro-barraco-6', 'barraco-1', 74, 126, { w: 1, h: 1 }),
    structure('centro-barraco-7', 'barraco-2', 78, 128, { w: 1, h: 1 }),
    structure('centro-barraco-8', 'barraco-3', 82, 130, { w: 1, h: 1 }),
    structure('centro-barraco-9', 'barraco-4', 64, 128, { w: 1, h: 1 }),
    structure('centro-barraco-10', 'barraco-5', 68, 130, { w: 1, h: 1 }),
    structure('centro-barraco-11', 'barraco-1', 72, 132, { w: 1, h: 1 }),
    structure('centro-barraco-12', 'barraco-2', 76, 134, { w: 1, h: 1 }),
    structure('centro-barraco-13', 'barraco-3', 80, 122, { w: 1, h: 1 }),
    structure('centro-barraco-14', 'barraco-4', 84, 124, { w: 1, h: 1 }),
    structure('centro-barraco-15', 'barraco-5', 88, 126, { w: 1, h: 1 }),
  ],
  trails: [
    {
      accent: '#efe1bf',
      id: 'centro-avenida-cais',
      kind: 'avenue',
      label: 'Avenida do Cais',
      points: [
        { x: 34, y: 94 },
        { x: 72, y: 96 },
        { x: 106, y: 96 },
        { x: 140, y: 94 },
        { x: 172, y: 90 },
      ],
    },
    {
      accent: '#dfd6c0',
      id: 'centro-rua-central',
      kind: 'street',
      label: 'Rua Central',
      points: [
        { x: 86, y: 84 },
        { x: 94, y: 90 },
        { x: 102, y: 98 },
        { x: 110, y: 108 },
        { x: 116, y: 120 },
        { x: 120, y: 132 },
      ],
    },
    {
      accent: '#dfd6c0',
      id: 'centro-rua-hospital-mercado',
      kind: 'street',
      label: 'Rua do Hospital',
      points: [
        { x: 44, y: 86 },
        { x: 56, y: 90 },
        { x: 70, y: 94 },
        { x: 86, y: 98 },
        { x: 100, y: 100 },
      ],
    },
    {
      accent: '#d8d1c0',
      id: 'centro-rua-docas-fabrica',
      kind: 'street',
      label: 'Rua das Docas',
      points: [
        { x: 120, y: 100 },
        { x: 134, y: 100 },
        { x: 148, y: 102 },
        { x: 162, y: 106 },
      ],
    },
    {
      accent: '#dcc9a0',
      id: 'centro-beco-providencia',
      kind: 'alley',
      label: 'Beco da Providência',
      points: [
        { x: 64, y: 134 },
        { x: 70, y: 128 },
        { x: 76, y: 122 },
        { x: 82, y: 116 },
      ],
    },
    {
      accent: '#d9c395',
      id: 'centro-escadaria-morro',
      kind: 'stairs',
      label: 'Escadaria do Morro',
      points: [
        { x: 54, y: 132 },
        { x: 58, y: 124 },
        { x: 62, y: 116 },
        { x: 66, y: 108 },
      ],
    },
  ],
  zoneSlots: [
    { accent: '#7b1f27', center: { x: 66, y: 124 }, id: 'centro-z1', radiusTiles: { x: 11, y: 8 } },
    { accent: '#6d6060', center: { x: 106, y: 98 }, id: 'centro-z2', radiusTiles: { x: 12, y: 7 } },
    { accent: '#6c5b7b', center: { x: 130, y: 86 }, id: 'centro-z3', radiusTiles: { x: 10, y: 6 } },
    { accent: '#8a4f4f', center: { x: 140, y: 110 }, id: 'centro-z4', radiusTiles: { x: 10, y: 6 } },
    { accent: '#58627b', center: { x: 160, y: 92 }, id: 'centro-z5', radiusTiles: { x: 10, y: 6 } },
    { accent: '#5e7161', center: { x: 96, y: 132 }, id: 'centro-z6', radiusTiles: { x: 8, y: 5 } },
  ],
};

const zonaNortePreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-negro', kind: 'market', label: 'Mercado Negro', position: { x: 94, y: 112 } },
    { color: '#7fb0ff', id: 'hospital-zn', kind: 'hospital', label: 'Hospital', position: { x: 50, y: 94 } },
    { color: '#e0b04b', id: 'treino-zn', kind: 'training', label: 'Treino', position: { x: 68, y: 96 } },
    { color: '#8cc7ff', id: 'universidade-zn', kind: 'university', label: 'Universidade', position: { x: 152, y: 82 } },
    { color: '#86bbd8', id: 'boca-prototipo', kind: 'boca', label: 'Boca', position: { x: 102, y: 136 } },
    { color: '#4cb071', id: 'fabrica-prototipo', kind: 'factory', label: 'Fábrica', position: { x: 156, y: 116 } },
    { color: '#d487ff', id: 'baile-prototipo', kind: 'party', label: 'Baile', position: { x: 120, y: 152 } },
    { color: '#cf8056', id: 'desmanche-zn', kind: 'scrapyard', label: 'Desmanche', position: { x: 170, y: 106 } },
  ],
  contextSpots: [
    { entityId: 'mercado-negro', position: { x: 94, y: 112 }, reach: 5, title: 'Mercado Negro' },
    { entityId: 'hospital-zn', position: { x: 50, y: 94 }, reach: 4, title: 'Hospital' },
    { entityId: 'treino-zn', position: { x: 68, y: 96 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-zn', position: { x: 152, y: 82 }, reach: 4, title: 'Universidade' },
    { entityId: 'boca-prototipo', position: { x: 102, y: 136 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-prototipo', position: { x: 156, y: 116 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-prototipo', position: { x: 120, y: 152 }, reach: 6, title: 'Baile' },
    { entityId: 'desmanche-zn', position: { x: 170, y: 106 }, reach: 5, title: 'Desmanche' },
  ],
  groundPatches: [
    {
      accent: '#53624f',
      center: { x: 108, y: 118 },
      fill: '#414e40',
      id: 'zn-base-verde',
      kind: 'greenery',
      radiusTiles: { x: 68, y: 40 },
    },
    {
      accent: '#715f4f',
      center: { x: 54, y: 96 },
      fill: '#5b5044',
      id: 'zn-vazio-noroeste',
      kind: 'vacant-lot',
      radiusTiles: { x: 20, y: 12 },
    },
    {
      accent: '#7f674d',
      center: { x: 142, y: 154 },
      fill: '#665545',
      id: 'zn-talude-terra',
      kind: 'earth',
      radiusTiles: { x: 24, y: 14 },
    },
    {
      accent: '#474c49',
      center: { x: 110, y: 112 },
      fill: '#414541',
      id: 'zn-suburbio-asfaltado',
      kind: 'concrete',
      radiusTiles: { x: 30, y: 16 },
    },
    {
      accent: '#536450',
      center: { x: 86, y: 132 },
      fill: '#4c5b49',
      id: 'zn-encosta-penha',
      kind: 'hillside',
      radiusTiles: { x: 18, y: 12 },
    },
    {
      accent: '#576b53',
      center: { x: 130, y: 150 },
      fill: '#50614d',
      id: 'zn-encosta-alemao',
      kind: 'hillside',
      radiusTiles: { x: 18, y: 11 },
    },
    {
      accent: '#775542',
      center: { x: 94, y: 136 },
      fill: '#5e4033',
      id: 'zn-favela-penha',
      kind: 'favela-core',
      radiusTiles: { x: 16, y: 10 },
    },
    {
      accent: '#6d4f3d',
      center: { x: 132, y: 154 },
      fill: '#593d31',
      id: 'zn-favela-alemao',
      kind: 'favela-core',
      radiusTiles: { x: 16, y: 10 },
    },
    {
      accent: '#72624f',
      center: { x: 158, y: 112 },
      fill: '#5f5244',
      id: 'zn-polo-industrial',
      kind: 'industrial-yard',
      radiusTiles: { x: 18, y: 10 },
    },
    {
      accent: '#6f624f',
      center: { x: 66, y: 110 },
      fill: '#5d5346',
      id: 'zn-conjunto-popular',
      kind: 'commercial-yard',
      radiusTiles: { x: 15, y: 9 },
    },
    {
      accent: '#c98449',
      center: { x: 182, y: 94 },
      fill: '#4b3428',
      id: 'zn-bloqueio',
      kind: 'blocked',
      radiusTiles: { x: 7, y: 4 },
    },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'zn-entrada', label: 'Subida da Penha', position: { x: 88, y: 124 }, shape: 'gate' },
    { accent: '#78c68c', id: 'zn-quadra', label: 'Quadra da Comunidade', position: { x: 116, y: 146 }, shape: 'plaza' },
    { accent: '#7c6142', id: 'zn-galpao', label: 'Pátio do Desmanche', position: { x: 168, y: 108 }, shape: 'warehouse' },
  ],
  structures: [
    structure('zn-hospital', 'hospital', 46, 92, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-zn' }),
    structure('zn-treino', 'treino', 64, 96, { w: 3, h: 2 }, { interactiveEntityId: 'treino-zn' }),
    structure('zn-universidade', 'universidade', 148, 80, { w: 4, h: 3 }, { interactiveEntityId: 'universidade-zn' }),
    structure('zn-mercado', 'mercado-negro', 92, 110, { w: 3, h: 2 }, { interactiveEntityId: 'mercado-negro' }),
    structure('zn-boca', 'boca', 100, 134, { w: 2, h: 2 }, { interactiveEntityId: 'boca-prototipo' }),
    structure('zn-fabrica', 'factory', 152, 114, { w: 5, h: 4 }, { interactiveEntityId: 'fabrica-prototipo' }),
    structure('zn-baile', 'baile', 116, 150, { w: 4, h: 3 }, { interactiveEntityId: 'baile-prototipo' }),
    structure('zn-rave', 'rave', 132, 150, { w: 4, h: 3 }),
    structure('zn-desmanche', 'desmanche', 166, 104, { w: 5, h: 3 }, { interactiveEntityId: 'desmanche-zn' }),
    structure('zn-prisao', 'prison', 34, 104, { w: 4, h: 3 }),

    structure('zn-favela-cluster-1', 'favela-cluster', 84, 124, { w: 10, h: 8 }),
    structure('zn-favela-cluster-2', 'favela-cluster', 100, 134, { w: 8, h: 6 }),
    structure('zn-favela-cluster-3', 'favela-cluster', 118, 148, { w: 10, h: 7 }),
    structure('zn-favela-cluster-4', 'favela-cluster', 136, 152, { w: 9, h: 6 }),

    structure('zn-barraco-1', 'barraco-1', 82, 124, { w: 1, h: 1 }),
    structure('zn-barraco-2', 'barraco-2', 86, 126, { w: 1, h: 1 }),
    structure('zn-barraco-3', 'barraco-3', 90, 128, { w: 1, h: 1 }),
    structure('zn-barraco-4', 'barraco-4', 94, 130, { w: 1, h: 1 }),
    structure('zn-barraco-5', 'barraco-5', 98, 132, { w: 1, h: 1 }),
    structure('zn-barraco-6', 'barraco-1', 102, 134, { w: 1, h: 1 }),
    structure('zn-barraco-7', 'barraco-2', 106, 136, { w: 1, h: 1 }),
    structure('zn-barraco-8', 'barraco-3', 110, 138, { w: 1, h: 1 }),
    structure('zn-barraco-9', 'barraco-4', 114, 142, { w: 1, h: 1 }),
    structure('zn-barraco-10', 'barraco-5', 118, 144, { w: 1, h: 1 }),
    structure('zn-barraco-11', 'barraco-1', 122, 148, { w: 1, h: 1 }),
    structure('zn-barraco-12', 'barraco-2', 126, 150, { w: 1, h: 1 }),
    structure('zn-barraco-13', 'barraco-3', 130, 152, { w: 1, h: 1 }),
    structure('zn-barraco-14', 'barraco-4', 134, 154, { w: 1, h: 1 }),
    structure('zn-barraco-15', 'barraco-5', 138, 156, { w: 1, h: 1 }),
    structure('zn-barraco-16', 'barraco-1', 142, 158, { w: 1, h: 1 }),
    structure('zn-barraco-17', 'barraco-2', 146, 156, { w: 1, h: 1 }),
    structure('zn-barraco-18', 'barraco-3', 150, 154, { w: 1, h: 1 }),

    structure('zn-casa-1', 'casa-residencial-simples-1', 56, 106, { w: 2, h: 2 }),
    structure('zn-casa-2', 'casa-residencial-simples-2', 62, 108, { w: 2, h: 2 }),
    structure('zn-casa-3', 'casa-residencial-simples-1', 68, 110, { w: 2, h: 2 }),
    structure('zn-casa-4', 'casa-residencial-simples-2', 74, 112, { w: 2, h: 2 }),
    structure('zn-casa-5', 'casa-residencial-simples-1', 58, 116, { w: 2, h: 2 }),
    structure('zn-casa-6', 'casa-residencial-simples-2', 64, 118, { w: 2, h: 2 }),
    structure('zn-casa-7', 'casa-residencial-simples-1', 70, 120, { w: 2, h: 2 }),
    structure('zn-casa-8', 'casa-residencial-simples-2', 76, 122, { w: 2, h: 2 }),
    structure('zn-casa-9', 'casa-residencial-simples-1', 54, 122, { w: 2, h: 2 }),
    structure('zn-casa-10', 'casa-residencial-simples-2', 60, 124, { w: 2, h: 2 }),

    structure('zn-predio-1', 'predio-residencial-simples-1', 144, 92, { w: 2, h: 2 }),
    structure('zn-predio-2', 'predio-residencial-simples-2', 150, 94, { w: 2, h: 2 }),
    structure('zn-predio-3', 'predio-residencial-simples-1', 146, 100, { w: 2, h: 2 }),
    structure('zn-predio-4', 'predio-residencial-simples-2', 152, 102, { w: 2, h: 2 }),
    structure('zn-predio-5', 'predio-comercial-simples-1', 158, 110, { w: 2, h: 2 }),
    structure('zn-predio-6', 'predio-comercial-simples-2', 164, 112, { w: 2, h: 2 }),
    structure('zn-predio-7', 'predio-residencial-simples-1', 140, 108, { w: 2, h: 2 }),
    structure('zn-predio-8', 'predio-residencial-simples-2', 146, 110, { w: 2, h: 2 }),
  ],
  trails: [
    {
      accent: '#e7dbb8',
      id: 'zn-avenida-suburbana',
      kind: 'avenue',
      label: 'Avenida Suburbana',
      points: [
        { x: 34, y: 110 },
        { x: 60, y: 110 },
        { x: 90, y: 112 },
        { x: 122, y: 112 },
        { x: 154, y: 110 },
        { x: 178, y: 108 },
      ],
    },
    {
      accent: '#d9d0bd',
      id: 'zn-rua-hospital-mercado',
      kind: 'street',
      label: 'Rua do Mercado',
      points: [
        { x: 46, y: 94 },
        { x: 56, y: 100 },
        { x: 66, y: 104 },
        { x: 78, y: 108 },
        { x: 92, y: 112 },
      ],
    },
    {
      accent: '#d8d8d0',
      id: 'zn-rua-industrial',
      kind: 'street',
      label: 'Rua Industrial',
      points: [
        { x: 138, y: 96 },
        { x: 146, y: 100 },
        { x: 154, y: 104 },
        { x: 162, y: 108 },
        { x: 170, y: 112 },
      ],
    },
    {
      accent: '#d4c39e',
      id: 'zn-beco-penha',
      kind: 'alley',
      label: 'Beco da Penha',
      points: [
        { x: 92, y: 146 },
        { x: 98, y: 140 },
        { x: 104, y: 134 },
        { x: 110, y: 128 },
      ],
    },
    {
      accent: '#d9c395',
      id: 'zn-escadaria-penha',
      kind: 'stairs',
      label: 'Escadaria da Penha',
      points: [
        { x: 82, y: 142 },
        { x: 86, y: 134 },
        { x: 90, y: 126 },
        { x: 94, y: 118 },
      ],
    },
  ],
  zoneSlots: [
    { accent: '#5d7a5f', center: { x: 64, y: 110 }, id: 'zn-z1', radiusTiles: { x: 9, y: 6 } },
    { accent: '#466856', center: { x: 88, y: 132 }, id: 'zn-z2', radiusTiles: { x: 10, y: 7 } },
    { accent: '#4a644d', center: { x: 108, y: 142 }, id: 'zn-z3', radiusTiles: { x: 9, y: 6 } },
    { accent: '#5d6652', center: { x: 132, y: 152 }, id: 'zn-z4', radiusTiles: { x: 10, y: 7 } },
    { accent: '#66604f', center: { x: 154, y: 110 }, id: 'zn-z5', radiusTiles: { x: 10, y: 6 } },
    { accent: '#54655a', center: { x: 168, y: 104 }, id: 'zn-z6', radiusTiles: { x: 8, y: 5 } },
  ],
};

const zonaSulPreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-zs', kind: 'market', label: 'Mercado Negro', position: { x: 118, y: 102 } },
    { color: '#7fb0ff', id: 'hospital-zs', kind: 'hospital', label: 'Hospital', position: { x: 74, y: 90 } },
    { color: '#e0b04b', id: 'treino-zs', kind: 'training', label: 'Treino', position: { x: 98, y: 92 } },
    { color: '#8cc7ff', id: 'universidade-zs', kind: 'university', label: 'Universidade', position: { x: 142, y: 88 } },
    { color: '#86bbd8', id: 'boca-zs', kind: 'boca', label: 'Boca', position: { x: 66, y: 132 } },
    { color: '#4cb071', id: 'fabrica-zs', kind: 'factory', label: 'Fábrica', position: { x: 154, y: 118 } },
    { color: '#d487ff', id: 'baile-zs', kind: 'party', label: 'Baile', position: { x: 84, y: 140 } },
    { color: '#6db7ff', id: 'rave-zs', kind: 'party', label: 'Rave', position: { x: 134, y: 126 } },
  ],
  contextSpots: [
    { entityId: 'mercado-zs', position: { x: 118, y: 102 }, reach: 6, title: 'Mercado Negro' },
    { entityId: 'hospital-zs', position: { x: 74, y: 90 }, reach: 5, title: 'Hospital' },
    { entityId: 'treino-zs', position: { x: 98, y: 92 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-zs', position: { x: 142, y: 88 }, reach: 5, title: 'Universidade' },
    { entityId: 'boca-zs', position: { x: 66, y: 132 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-zs', position: { x: 154, y: 118 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-zs', position: { x: 84, y: 140 }, reach: 6, title: 'Baile' },
    { entityId: 'rave-zs', position: { x: 134, y: 126 }, reach: 6, title: 'Rave' },
  ],
  groundPatches: [
    { accent: '#5f7658', center: { x: 112, y: 106 }, fill: '#4b5d48', id: 'zs-base-verde', kind: 'greenery', radiusTiles: { x: 64, y: 36 } },
    { accent: '#6e685a', center: { x: 118, y: 100 }, fill: '#5a554c', id: 'zs-miolo-urbano', kind: 'concrete', radiusTiles: { x: 28, y: 15 } },
    { accent: '#85735e', center: { x: 132, y: 96 }, fill: '#706352', id: 'zs-faixa-nobre', kind: 'commercial-yard', radiusTiles: { x: 18, y: 9 } },
    { accent: '#5d6b58', center: { x: 68, y: 126 }, fill: '#53624f', id: 'zs-encosta', kind: 'hillside', radiusTiles: { x: 16, y: 10 } },
    { accent: '#7c5a4d', center: { x: 74, y: 134 }, fill: '#64463a', id: 'zs-favela', kind: 'favela-core', radiusTiles: { x: 14, y: 9 } },
    { accent: '#6d655b', center: { x: 152, y: 118 }, fill: '#5f574c', id: 'zs-servico', kind: 'industrial-yard', radiusTiles: { x: 14, y: 8 } },
    { accent: '#766555', center: { x: 160, y: 136 }, fill: '#5f5245', id: 'zs-vazio', kind: 'vacant-lot', radiusTiles: { x: 18, y: 10 } },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'zs-orla', label: 'Orla Alta', position: { x: 138, y: 92 }, shape: 'plaza' },
    { accent: '#d8c27c', id: 'zs-subida', label: 'Subida do Morro', position: { x: 74, y: 120 }, shape: 'gate' },
    { accent: '#7c6142', id: 'zs-clube', label: 'Clube da Zona Sul', position: { x: 132, y: 122 }, shape: 'tower' },
  ],
  structures: [
    structure('zs-hospital', 'hospital', 70, 88, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-zs' }),
    structure('zs-treino', 'treino', 96, 90, { w: 3, h: 2 }, { interactiveEntityId: 'treino-zs' }),
    structure('zs-universidade', 'universidade', 138, 86, { w: 5, h: 3 }, { interactiveEntityId: 'universidade-zs' }),
    structure('zs-mercado', 'mercado-negro', 116, 100, { w: 4, h: 3 }, { interactiveEntityId: 'mercado-zs' }),
    structure('zs-fabrica', 'factory', 150, 116, { w: 4, h: 3 }, { interactiveEntityId: 'fabrica-zs' }),
    structure('zs-baile', 'baile', 82, 138, { w: 4, h: 3 }, { interactiveEntityId: 'baile-zs' }),
    structure('zs-rave', 'rave', 130, 124, { w: 4, h: 3 }, { interactiveEntityId: 'rave-zs' }),
    structure('zs-boca', 'boca', 64, 130, { w: 2, h: 2 }, { interactiveEntityId: 'boca-zs' }),
    structure('zs-prisao', 'prison', 38, 108, { w: 4, h: 3 }),

    structure('zs-favela-core-1', 'favela-cluster', 62, 122, { w: 8, h: 6 }),
    structure('zs-favela-core-2', 'favela-cluster', 74, 132, { w: 7, h: 5 }),
    structure('zs-barraco-1', 'barraco-1', 62, 122, { w: 1, h: 1 }),
    structure('zs-barraco-2', 'barraco-2', 66, 124, { w: 1, h: 1 }),
    structure('zs-barraco-3', 'barraco-3', 70, 126, { w: 1, h: 1 }),
    structure('zs-barraco-4', 'barraco-4', 74, 128, { w: 1, h: 1 }),
    structure('zs-barraco-5', 'barraco-5', 78, 130, { w: 1, h: 1 }),

    structure('zs-predio-1', 'predio-residencial-moderno-1', 108, 86, { w: 2, h: 2 }),
    structure('zs-predio-2', 'predio-residencial-moderno-2', 114, 86, { w: 2, h: 2 }),
    structure('zs-predio-3', 'predio-comercial-moderno-1', 120, 88, { w: 2, h: 2 }),
    structure('zs-predio-4', 'predio-comercial-moderno-2', 126, 88, { w: 2, h: 2 }),
    structure('zs-predio-5', 'predio-residencial-moderno-1', 132, 92, { w: 2, h: 2 }),
    structure('zs-predio-6', 'predio-residencial-moderno-2', 138, 94, { w: 2, h: 2 }),
    structure('zs-casa-1', 'casa-residencial-moderna-1', 146, 104, { w: 2, h: 2 }),
    structure('zs-casa-2', 'casa-residencial-moderna-2', 152, 106, { w: 2, h: 2 }),
    structure('zs-casa-3', 'casa-residencial-moderna-1', 140, 110, { w: 2, h: 2 }),
  ],
  trails: [
    { accent: '#efe1bf', id: 'zs-avenida-orla', kind: 'avenue', label: 'Avenida da Orla', points: [{ x: 42, y: 98 }, { x: 84, y: 98 }, { x: 122, y: 96 }, { x: 164, y: 94 }] },
    { accent: '#dfd6c0', id: 'zs-rua-servicos', kind: 'street', label: 'Rua do Comércio', points: [{ x: 90, y: 88 }, { x: 100, y: 94 }, { x: 112, y: 100 }, { x: 124, y: 108 }] },
    { accent: '#d8d1c0', id: 'zs-rua-morro', kind: 'street', label: 'Rua do Morro', points: [{ x: 62, y: 108 }, { x: 68, y: 116 }, { x: 74, y: 124 }, { x: 80, y: 132 }] },
    { accent: '#d4c39e', id: 'zs-beco', kind: 'alley', label: 'Beco do Vidigal', points: [{ x: 68, y: 136 }, { x: 74, y: 130 }, { x: 80, y: 124 }, { x: 86, y: 118 }] },
    { accent: '#d9c395', id: 'zs-escadaria', kind: 'stairs', label: 'Escadaria da Encosta', points: [{ x: 58, y: 134 }, { x: 62, y: 126 }, { x: 66, y: 118 }, { x: 70, y: 110 }] },
  ],
  zoneSlots: [
    { accent: '#58735b', center: { x: 132, y: 94 }, id: 'zs-z1', radiusTiles: { x: 10, y: 6 } },
    { accent: '#6c6a60', center: { x: 112, y: 100 }, id: 'zs-z2', radiusTiles: { x: 10, y: 6 } },
    { accent: '#546458', center: { x: 72, y: 130 }, id: 'zs-z3', radiusTiles: { x: 10, y: 7 } },
    { accent: '#6d5f50', center: { x: 150, y: 118 }, id: 'zs-z4', radiusTiles: { x: 8, y: 5 } },
  ],
};

const zonaOestePreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-zo', kind: 'market', label: 'Mercado Negro', position: { x: 102, y: 112 } },
    { color: '#7fb0ff', id: 'hospital-zo', kind: 'hospital', label: 'Hospital', position: { x: 62, y: 96 } },
    { color: '#e0b04b', id: 'treino-zo', kind: 'training', label: 'Treino', position: { x: 84, y: 98 } },
    { color: '#8cc7ff', id: 'universidade-zo', kind: 'university', label: 'Universidade', position: { x: 150, y: 92 } },
    { color: '#86bbd8', id: 'boca-zo', kind: 'boca', label: 'Boca', position: { x: 118, y: 136 } },
    { color: '#4cb071', id: 'fabrica-zo', kind: 'factory', label: 'Fábrica', position: { x: 162, y: 120 } },
    { color: '#d487ff', id: 'baile-zo', kind: 'party', label: 'Baile', position: { x: 96, y: 148 } },
    { color: '#cf8056', id: 'desmanche-zo', kind: 'scrapyard', label: 'Desmanche', position: { x: 150, y: 138 } },
  ],
  contextSpots: [
    { entityId: 'mercado-zo', position: { x: 102, y: 112 }, reach: 6, title: 'Mercado Negro' },
    { entityId: 'hospital-zo', position: { x: 62, y: 96 }, reach: 5, title: 'Hospital' },
    { entityId: 'treino-zo', position: { x: 84, y: 98 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-zo', position: { x: 150, y: 92 }, reach: 5, title: 'Universidade' },
    { entityId: 'boca-zo', position: { x: 118, y: 136 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-zo', position: { x: 162, y: 120 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-zo', position: { x: 96, y: 148 }, reach: 6, title: 'Baile' },
    { entityId: 'desmanche-zo', position: { x: 150, y: 138 }, reach: 5, title: 'Desmanche' },
  ],
  groundPatches: [
    { accent: '#5e714f', center: { x: 108, y: 118 }, fill: '#485841', id: 'zo-base', kind: 'greenery', radiusTiles: { x: 66, y: 38 } },
    { accent: '#6b624f', center: { x: 104, y: 114 }, fill: '#5a5347', id: 'zo-miolo', kind: 'concrete', radiusTiles: { x: 28, y: 16 } },
    { accent: '#766b56', center: { x: 154, y: 128 }, fill: '#615447', id: 'zo-industrial', kind: 'industrial-yard', radiusTiles: { x: 18, y: 10 } },
    { accent: '#655b4d', center: { x: 66, y: 120 }, fill: '#554b41', id: 'zo-vazio', kind: 'vacant-lot', radiusTiles: { x: 20, y: 12 } },
    { accent: '#7b5949', center: { x: 118, y: 140 }, fill: '#644438', id: 'zo-favela', kind: 'favela-core', radiusTiles: { x: 15, y: 9 } },
    { accent: '#586650', center: { x: 132, y: 146 }, fill: '#4f5d4b', id: 'zo-encosta', kind: 'hillside', radiusTiles: { x: 16, y: 10 } },
    { accent: '#836854', center: { x: 170, y: 100 }, fill: '#665244', id: 'zo-terra', kind: 'earth', radiusTiles: { x: 16, y: 9 } },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'zo-terminal', label: 'Terminal Oeste', position: { x: 98, y: 110 }, shape: 'plaza' },
    { accent: '#7c6142', id: 'zo-galpao', label: 'Pátio da Cidade', position: { x: 156, y: 130 }, shape: 'warehouse' },
    { accent: '#d8c27c', id: 'zo-subida', label: 'Subida da Cidade', position: { x: 122, y: 132 }, shape: 'gate' },
  ],
  structures: [
    structure('zo-hospital', 'hospital', 58, 94, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-zo' }),
    structure('zo-treino', 'treino', 82, 96, { w: 3, h: 2 }, { interactiveEntityId: 'treino-zo' }),
    structure('zo-universidade', 'universidade', 146, 90, { w: 4, h: 3 }, { interactiveEntityId: 'universidade-zo' }),
    structure('zo-mercado', 'mercado-negro', 100, 110, { w: 4, h: 3 }, { interactiveEntityId: 'mercado-zo' }),
    structure('zo-fabrica', 'factory', 158, 118, { w: 5, h: 4 }, { interactiveEntityId: 'fabrica-zo' }),
    structure('zo-desmanche', 'desmanche', 146, 136, { w: 5, h: 3 }, { interactiveEntityId: 'desmanche-zo' }),
    structure('zo-baile', 'baile', 94, 146, { w: 4, h: 3 }, { interactiveEntityId: 'baile-zo' }),
    structure('zo-boca', 'boca', 116, 134, { w: 2, h: 2 }, { interactiveEntityId: 'boca-zo' }),
    structure('zo-prisao', 'prison', 40, 114, { w: 4, h: 3 }),
    structure('zo-favela-1', 'favela-cluster', 112, 134, { w: 9, h: 6 }),
    structure('zo-favela-2', 'favela-cluster', 126, 144, { w: 8, h: 6 }),
    structure('zo-barraco-1', 'barraco-1', 112, 134, { w: 1, h: 1 }),
    structure('zo-barraco-2', 'barraco-2', 116, 136, { w: 1, h: 1 }),
    structure('zo-barraco-3', 'barraco-3', 120, 138, { w: 1, h: 1 }),
    structure('zo-barraco-4', 'barraco-4', 124, 140, { w: 1, h: 1 }),
    structure('zo-barraco-5', 'barraco-5', 128, 142, { w: 1, h: 1 }),
    structure('zo-casa-1', 'casa-residencial-simples-1', 64, 110, { w: 2, h: 2 }),
    structure('zo-casa-2', 'casa-residencial-simples-2', 70, 112, { w: 2, h: 2 }),
    structure('zo-casa-3', 'casa-residencial-moderna-1', 76, 114, { w: 2, h: 2 }),
    structure('zo-casa-4', 'casa-residencial-moderna-2', 82, 116, { w: 2, h: 2 }),
    structure('zo-predio-1', 'predio-residencial-simples-1', 138, 98, { w: 2, h: 2 }),
    structure('zo-predio-2', 'predio-residencial-simples-2', 144, 100, { w: 2, h: 2 }),
    structure('zo-predio-3', 'predio-comercial-simples-1', 150, 102, { w: 2, h: 2 }),
  ],
  trails: [
    { accent: '#efe1bf', id: 'zo-avenida', kind: 'avenue', label: 'Avenida Oeste', points: [{ x: 36, y: 112 }, { x: 72, y: 112 }, { x: 108, y: 114 }, { x: 146, y: 118 }, { x: 176, y: 122 }] },
    { accent: '#dfd6c0', id: 'zo-rua-terminal', kind: 'street', label: 'Rua do Terminal', points: [{ x: 58, y: 96 }, { x: 70, y: 102 }, { x: 84, y: 108 }, { x: 98, y: 112 }] },
    { accent: '#d8d1c0', id: 'zo-rua-industrial', kind: 'street', label: 'Rua da Cidade', points: [{ x: 132, y: 108 }, { x: 142, y: 116 }, { x: 152, y: 124 }, { x: 160, y: 132 }] },
    { accent: '#d4c39e', id: 'zo-beco', kind: 'alley', label: 'Beco da Cidade', points: [{ x: 114, y: 146 }, { x: 120, y: 140 }, { x: 126, y: 134 }, { x: 132, y: 128 }] },
    { accent: '#d9c395', id: 'zo-escadaria', kind: 'stairs', label: 'Escadaria do Talude', points: [{ x: 126, y: 150 }, { x: 130, y: 142 }, { x: 134, y: 134 }, { x: 138, y: 126 }] },
  ],
  zoneSlots: [
    { accent: '#5f7357', center: { x: 96, y: 112 }, id: 'zo-z1', radiusTiles: { x: 11, y: 7 } },
    { accent: '#6d5f4f', center: { x: 152, y: 126 }, id: 'zo-z2', radiusTiles: { x: 10, y: 6 } },
    { accent: '#59644f', center: { x: 122, y: 140 }, id: 'zo-z3', radiusTiles: { x: 9, y: 6 } },
  ],
};

const zonaSudoestePreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-zso', kind: 'market', label: 'Mercado Negro', position: { x: 96, y: 118 } },
    { color: '#7fb0ff', id: 'hospital-zso', kind: 'hospital', label: 'Hospital', position: { x: 54, y: 102 } },
    { color: '#e0b04b', id: 'treino-zso', kind: 'training', label: 'Treino', position: { x: 76, y: 108 } },
    { color: '#8cc7ff', id: 'universidade-zso', kind: 'university', label: 'Universidade', position: { x: 144, y: 102 } },
    { color: '#86bbd8', id: 'boca-zso', kind: 'boca', label: 'Boca', position: { x: 112, y: 146 } },
    { color: '#4cb071', id: 'fabrica-zso', kind: 'factory', label: 'Fábrica', position: { x: 156, y: 128 } },
    { color: '#d487ff', id: 'baile-zso', kind: 'party', label: 'Baile', position: { x: 88, y: 154 } },
    { color: '#cf8056', id: 'desmanche-zso', kind: 'scrapyard', label: 'Desmanche', position: { x: 166, y: 142 } },
  ],
  contextSpots: [
    { entityId: 'mercado-zso', position: { x: 96, y: 118 }, reach: 6, title: 'Mercado Negro' },
    { entityId: 'hospital-zso', position: { x: 54, y: 102 }, reach: 5, title: 'Hospital' },
    { entityId: 'treino-zso', position: { x: 76, y: 108 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-zso', position: { x: 144, y: 102 }, reach: 5, title: 'Universidade' },
    { entityId: 'boca-zso', position: { x: 112, y: 146 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-zso', position: { x: 156, y: 128 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-zso', position: { x: 88, y: 154 }, reach: 6, title: 'Baile' },
    { entityId: 'desmanche-zso', position: { x: 166, y: 142 }, reach: 5, title: 'Desmanche' },
  ],
  groundPatches: [
    { accent: '#55664f', center: { x: 108, y: 124 }, fill: '#445141', id: 'zso-base', kind: 'greenery', radiusTiles: { x: 66, y: 40 } },
    { accent: '#6a604f', center: { x: 102, y: 122 }, fill: '#5a5145', id: 'zso-miolo', kind: 'concrete', radiusTiles: { x: 26, y: 15 } },
    { accent: '#705f50', center: { x: 150, y: 136 }, fill: '#5f5247', id: 'zso-industrial', kind: 'industrial-yard', radiusTiles: { x: 18, y: 10 } },
    { accent: '#7c5b49', center: { x: 104, y: 148 }, fill: '#644438', id: 'zso-favela', kind: 'favela-core', radiusTiles: { x: 18, y: 10 } },
    { accent: '#596650', center: { x: 118, y: 152 }, fill: '#4f5d4b', id: 'zso-encosta', kind: 'hillside', radiusTiles: { x: 18, y: 10 } },
    { accent: '#7a6752', center: { x: 64, y: 134 }, fill: '#605345', id: 'zso-vazio', kind: 'vacant-lot', radiusTiles: { x: 20, y: 12 } },
    { accent: '#816750', center: { x: 176, y: 112 }, fill: '#675244', id: 'zso-terra', kind: 'earth', radiusTiles: { x: 14, y: 8 } },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'zso-terminal', label: 'Pátio do Conjunto', position: { x: 94, y: 118 }, shape: 'plaza' },
    { accent: '#7c6142', id: 'zso-galpao', label: 'Galpão do Corredor', position: { x: 156, y: 136 }, shape: 'warehouse' },
    { accent: '#d8c27c', id: 'zso-subida', label: 'Subida do Conjunto', position: { x: 108, y: 142 }, shape: 'gate' },
  ],
  structures: [
    structure('zso-hospital', 'hospital', 50, 100, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-zso' }),
    structure('zso-treino', 'treino', 74, 106, { w: 3, h: 2 }, { interactiveEntityId: 'treino-zso' }),
    structure('zso-universidade', 'universidade', 140, 100, { w: 4, h: 3 }, { interactiveEntityId: 'universidade-zso' }),
    structure('zso-mercado', 'mercado-negro', 94, 116, { w: 4, h: 3 }, { interactiveEntityId: 'mercado-zso' }),
    structure('zso-fabrica', 'factory', 152, 126, { w: 5, h: 4 }, { interactiveEntityId: 'fabrica-zso' }),
    structure('zso-desmanche', 'desmanche', 162, 140, { w: 5, h: 3 }, { interactiveEntityId: 'desmanche-zso' }),
    structure('zso-baile', 'baile', 86, 152, { w: 4, h: 3 }, { interactiveEntityId: 'baile-zso' }),
    structure('zso-boca', 'boca', 110, 144, { w: 2, h: 2 }, { interactiveEntityId: 'boca-zso' }),
    structure('zso-prisao', 'prison', 38, 120, { w: 4, h: 3 }),
    structure('zso-favela-1', 'favela-cluster', 98, 144, { w: 10, h: 7 }),
    structure('zso-favela-2', 'favela-cluster', 116, 152, { w: 8, h: 6 }),
    structure('zso-barraco-1', 'barraco-1', 98, 144, { w: 1, h: 1 }),
    structure('zso-barraco-2', 'barraco-2', 102, 146, { w: 1, h: 1 }),
    structure('zso-barraco-3', 'barraco-3', 106, 148, { w: 1, h: 1 }),
    structure('zso-barraco-4', 'barraco-4', 110, 150, { w: 1, h: 1 }),
    structure('zso-barraco-5', 'barraco-5', 114, 152, { w: 1, h: 1 }),
    structure('zso-casa-1', 'casa-residencial-simples-1', 58, 118, { w: 2, h: 2 }),
    structure('zso-casa-2', 'casa-residencial-simples-2', 64, 120, { w: 2, h: 2 }),
    structure('zso-casa-3', 'casa-residencial-simples-1', 70, 122, { w: 2, h: 2 }),
    structure('zso-predio-1', 'predio-residencial-simples-1', 136, 110, { w: 2, h: 2 }),
    structure('zso-predio-2', 'predio-residencial-simples-2', 142, 112, { w: 2, h: 2 }),
  ],
  trails: [
    { accent: '#efe1bf', id: 'zso-avenida', kind: 'avenue', label: 'Avenida do Corredor', points: [{ x: 34, y: 118 }, { x: 70, y: 120 }, { x: 106, y: 122 }, { x: 144, y: 126 }, { x: 176, y: 130 }] },
    { accent: '#dfd6c0', id: 'zso-rua-servico', kind: 'street', label: 'Rua do Conjunto', points: [{ x: 52, y: 104 }, { x: 64, y: 110 }, { x: 78, y: 116 }, { x: 92, y: 120 }] },
    { accent: '#d8d1c0', id: 'zso-rua-industrial', kind: 'street', label: 'Rua do Galpão', points: [{ x: 134, y: 118 }, { x: 144, y: 126 }, { x: 154, y: 134 }, { x: 164, y: 140 }] },
    { accent: '#d4c39e', id: 'zso-beco', kind: 'alley', label: 'Beco do Conjunto', points: [{ x: 104, y: 154 }, { x: 110, y: 148 }, { x: 116, y: 142 }, { x: 122, y: 136 }] },
    { accent: '#d9c395', id: 'zso-escadaria', kind: 'stairs', label: 'Escadaria do Talude', points: [{ x: 94, y: 156 }, { x: 98, y: 148 }, { x: 102, y: 140 }, { x: 106, y: 132 }] },
  ],
  zoneSlots: [
    { accent: '#5c7058', center: { x: 94, y: 120 }, id: 'zso-z1', radiusTiles: { x: 10, y: 6 } },
    { accent: '#6d5f50', center: { x: 152, y: 134 }, id: 'zso-z2', radiusTiles: { x: 10, y: 6 } },
    { accent: '#59644f', center: { x: 108, y: 150 }, id: 'zso-z3', radiusTiles: { x: 10, y: 6 } },
  ],
};

const baixadaPreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-bx', kind: 'market', label: 'Mercado Negro', position: { x: 110, y: 122 } },
    { color: '#7fb0ff', id: 'hospital-bx', kind: 'hospital', label: 'Hospital', position: { x: 60, y: 110 } },
    { color: '#e0b04b', id: 'treino-bx', kind: 'training', label: 'Treino', position: { x: 82, y: 114 } },
    { color: '#8cc7ff', id: 'universidade-bx', kind: 'university', label: 'Universidade', position: { x: 148, y: 112 } },
    { color: '#86bbd8', id: 'boca-bx', kind: 'boca', label: 'Boca', position: { x: 126, y: 146 } },
    { color: '#4cb071', id: 'fabrica-bx', kind: 'factory', label: 'Fábrica', position: { x: 162, y: 130 } },
    { color: '#d487ff', id: 'baile-bx', kind: 'party', label: 'Baile', position: { x: 94, y: 154 } },
    { color: '#cf8056', id: 'desmanche-bx', kind: 'scrapyard', label: 'Desmanche', position: { x: 168, y: 148 } },
  ],
  contextSpots: [
    { entityId: 'mercado-bx', position: { x: 110, y: 122 }, reach: 6, title: 'Mercado Negro' },
    { entityId: 'hospital-bx', position: { x: 60, y: 110 }, reach: 5, title: 'Hospital' },
    { entityId: 'treino-bx', position: { x: 82, y: 114 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-bx', position: { x: 148, y: 112 }, reach: 5, title: 'Universidade' },
    { entityId: 'boca-bx', position: { x: 126, y: 146 }, reach: 5, title: 'Boca' },
    { entityId: 'fabrica-bx', position: { x: 162, y: 130 }, reach: 6, title: 'Fábrica' },
    { entityId: 'baile-bx', position: { x: 94, y: 154 }, reach: 6, title: 'Baile' },
    { entityId: 'desmanche-bx', position: { x: 168, y: 148 }, reach: 5, title: 'Desmanche' },
  ],
  groundPatches: [
    { accent: '#5a6a52', center: { x: 112, y: 128 }, fill: '#475541', id: 'bx-base', kind: 'greenery', radiusTiles: { x: 70, y: 42 } },
    { accent: '#6e624f', center: { x: 108, y: 126 }, fill: '#5a5145', id: 'bx-miolo', kind: 'concrete', radiusTiles: { x: 24, y: 14 } },
    { accent: '#7e6b55', center: { x: 156, y: 142 }, fill: '#655648', id: 'bx-industrial', kind: 'industrial-yard', radiusTiles: { x: 20, y: 12 } },
    { accent: '#7f6953', center: { x: 74, y: 140 }, fill: '#665547', id: 'bx-terra', kind: 'earth', radiusTiles: { x: 24, y: 14 } },
    { accent: '#7a5a49', center: { x: 124, y: 150 }, fill: '#644438', id: 'bx-favela', kind: 'favela-core', radiusTiles: { x: 15, y: 9 } },
    { accent: '#5c6651', center: { x: 132, y: 156 }, fill: '#53604d', id: 'bx-hillside', kind: 'hillside', radiusTiles: { x: 14, y: 8 } },
    { accent: '#71614f', center: { x: 54, y: 122 }, fill: '#5b4f43', id: 'bx-vazio', kind: 'vacant-lot', radiusTiles: { x: 20, y: 12 } },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'bx-patio', label: 'Pátio da Baixada', position: { x: 110, y: 122 }, shape: 'plaza' },
    { accent: '#7c6142', id: 'bx-galpao', label: 'Galpão da Linha', position: { x: 160, y: 140 }, shape: 'warehouse' },
    { accent: '#d8c27c', id: 'bx-subida', label: 'Subida do Dique', position: { x: 120, y: 144 }, shape: 'gate' },
  ],
  structures: [
    structure('bx-hospital', 'hospital', 56, 108, { w: 4, h: 3 }, { interactiveEntityId: 'hospital-bx' }),
    structure('bx-treino', 'treino', 80, 112, { w: 3, h: 2 }, { interactiveEntityId: 'treino-bx' }),
    structure('bx-universidade', 'universidade', 144, 110, { w: 4, h: 3 }, { interactiveEntityId: 'universidade-bx' }),
    structure('bx-mercado', 'mercado-negro', 108, 120, { w: 4, h: 3 }, { interactiveEntityId: 'mercado-bx' }),
    structure('bx-fabrica', 'factory', 158, 128, { w: 5, h: 4 }, { interactiveEntityId: 'fabrica-bx' }),
    structure('bx-desmanche', 'desmanche', 164, 146, { w: 5, h: 3 }, { interactiveEntityId: 'desmanche-bx' }),
    structure('bx-baile', 'baile', 92, 152, { w: 4, h: 3 }, { interactiveEntityId: 'baile-bx' }),
    structure('bx-boca', 'boca', 124, 144, { w: 2, h: 2 }, { interactiveEntityId: 'boca-bx' }),
    structure('bx-prisao', 'prison', 42, 132, { w: 4, h: 3 }),
    structure('bx-favela-1', 'favela-cluster', 118, 144, { w: 9, h: 6 }),
    structure('bx-favela-2', 'favela-cluster', 132, 152, { w: 7, h: 5 }),
    structure('bx-barraco-1', 'barraco-1', 118, 144, { w: 1, h: 1 }),
    structure('bx-barraco-2', 'barraco-2', 122, 146, { w: 1, h: 1 }),
    structure('bx-barraco-3', 'barraco-3', 126, 148, { w: 1, h: 1 }),
    structure('bx-barraco-4', 'barraco-4', 130, 150, { w: 1, h: 1 }),
    structure('bx-barraco-5', 'barraco-5', 134, 152, { w: 1, h: 1 }),
    structure('bx-casa-1', 'casa-residencial-simples-1', 62, 126, { w: 2, h: 2 }),
    structure('bx-casa-2', 'casa-residencial-simples-2', 68, 128, { w: 2, h: 2 }),
    structure('bx-casa-3', 'casa-residencial-simples-1', 74, 130, { w: 2, h: 2 }),
    structure('bx-predio-1', 'predio-comercial-simples-1', 150, 120, { w: 2, h: 2 }),
    structure('bx-predio-2', 'predio-comercial-simples-2', 156, 122, { w: 2, h: 2 }),
  ],
  trails: [
    { accent: '#efe1bf', id: 'bx-avenida', kind: 'avenue', label: 'Avenida da Linha', points: [{ x: 36, y: 124 }, { x: 74, y: 124 }, { x: 112, y: 126 }, { x: 150, y: 130 }, { x: 178, y: 136 }] },
    { accent: '#dfd6c0', id: 'bx-rua-centro', kind: 'street', label: 'Rua do Dique', points: [{ x: 58, y: 110 }, { x: 72, y: 116 }, { x: 88, y: 120 }, { x: 104, y: 122 }] },
    { accent: '#d8d1c0', id: 'bx-rua-industrial', kind: 'street', label: 'Rua do Galpão', points: [{ x: 140, y: 124 }, { x: 150, y: 132 }, { x: 160, y: 140 }, { x: 168, y: 146 }] },
    { accent: '#d4c39e', id: 'bx-beco', kind: 'alley', label: 'Beco da Linha', points: [{ x: 120, y: 154 }, { x: 126, y: 148 }, { x: 132, y: 142 }, { x: 138, y: 136 }] },
    { accent: '#d9c395', id: 'bx-escadaria', kind: 'stairs', label: 'Escadaria do Dique', points: [{ x: 110, y: 156 }, { x: 114, y: 148 }, { x: 118, y: 140 }, { x: 122, y: 132 }] },
  ],
  zoneSlots: [
    { accent: '#5d7057', center: { x: 104, y: 122 }, id: 'bx-z1', radiusTiles: { x: 10, y: 6 } },
    { accent: '#6d5f50', center: { x: 156, y: 138 }, id: 'bx-z2', radiusTiles: { x: 10, y: 6 } },
    { accent: '#59644f', center: { x: 126, y: 150 }, id: 'bx-z3', radiusTiles: { x: 9, y: 6 } },
  ],
};

const compactedCentroPreset = compactMapPreset(centroPreset, {
  anchor: { x: 128, y: 116 },
});

const compactedZonaNortePreset = compactMapPreset(zonaNortePreset, {
  anchor: { x: 112, y: 88 },
});

const compactedZonaSulPreset = compactMapPreset(zonaSulPreset, {
  anchor: { x: 160, y: 132 },
});

const compactedZonaOestePreset = compactMapPreset(zonaOestePreset, {
  anchor: { x: 84, y: 120 },
});

const compactedZonaSudoestePreset = compactMapPreset(zonaSudoestePreset, {
  anchor: { x: 76, y: 148 },
});

const compactedBaixadaPreset = compactMapPreset(baixadaPreset, {
  anchor: { x: 44, y: 172 },
});

const interactiveCentroPreset = prunePresetToInteractive(compactedCentroPreset);
const interactiveZonaNortePreset = prunePresetToInteractive(compactedZonaNortePreset);
const interactiveZonaSulPreset = prunePresetToInteractive(compactedZonaSulPreset);
const interactiveZonaOestePreset = prunePresetToInteractive(compactedZonaOestePreset);
const interactiveZonaSudoestePreset = prunePresetToInteractive(compactedZonaSudoestePreset);
const interactiveBaixadaPreset = prunePresetToInteractive(compactedBaixadaPreset);

const centroInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-negro': { x: 126, y: 108 },
  'hospital-centro': { x: 104, y: 98 },
  'treino-centro': { x: 116, y: 100 },
  'universidade-centro': { x: 140, y: 96 },
  'boca-prototipo': { x: 114, y: 130 },
  'fabrica-prototipo': { x: 148, y: 122 },
  'baile-prototipo': { x: 122, y: 138 },
  'rave-centro': { x: 136, y: 134 },
  'docas-centro': { x: 152, y: 102 },
};

const centroInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'centro-hospital': { x: 102, y: 96 },
  'centro-treino': { x: 116, y: 100 },
  'centro-universidade': { x: 138, y: 96 },
  'centro-mercado': { x: 124, y: 108 },
  'centro-docas': { x: 148, y: 100 },
  'centro-fabrica': { x: 146, y: 120 },
  'centro-baile': { x: 120, y: 136 },
  'centro-rave': { x: 134, y: 132 },
  'centro-boca': { x: 112, y: 128 },
  'centro-prisao': { x: 96, y: 102 },
  'centro-favela-core': { x: 104, y: 118 },
  'centro-favela-core-2': { x: 112, y: 126 },
  'centro-favela-core-3': { x: 98, y: 126 },
};

const centroCompactInteractivePreset: MapVisualPreset = {
  ...interactiveCentroPreset,
  entities: repositionEntities(interactiveCentroPreset.entities, centroInteractiveEntityPositions),
  contextSpots: repositionContextSpots(
    interactiveCentroPreset.contextSpots,
    centroInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#5d7058',
      center: { x: 124, y: 116 },
      fill: '#4a5a47',
      id: 'centro-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 30, y: 18 },
    },
    {
      accent: '#74685a',
      center: { x: 126, y: 108 },
      fill: '#61574d',
      id: 'centro-miolo-comercial-compacto',
      kind: 'commercial-yard',
      radiusTiles: { x: 13, y: 8 },
    },
    {
      accent: '#736452',
      center: { x: 150, y: 104 },
      fill: '#625345',
      id: 'centro-faixa-portuaria-compacta',
      kind: 'industrial-yard',
      radiusTiles: { x: 11, y: 7 },
    },
    {
      accent: '#5c6754',
      center: { x: 108, y: 126 },
      fill: '#52604d',
      id: 'centro-encosta-providencia-compacta',
      kind: 'hillside',
      radiusTiles: { x: 10, y: 7 },
    },
    {
      accent: '#7d5b4d',
      center: { x: 114, y: 128 },
      fill: '#64463a',
      id: 'centro-favela-providencia-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 12, y: 8 },
    },
    {
      accent: '#8b6548',
      center: { x: 156, y: 102 },
      fill: '#564036',
      id: 'centro-bloqueio-cais-compacto',
      kind: 'blocked',
      radiusTiles: { x: 4, y: 3 },
    },
  ],
  structures: repositionStructures(
    interactiveCentroPreset.structures,
    centroInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#7b1f27', center: { x: 118, y: 126 }, id: 'centro-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#6d6060', center: { x: 146, y: 110 }, id: 'centro-z2', radiusTiles: { x: 6, y: 4 } },
    { accent: '#6c5b7b', center: { x: 136, y: 118 }, id: 'centro-z3', radiusTiles: { x: 6, y: 4 } },
    { accent: '#8a4f4f', center: { x: 106, y: 106 }, id: 'centro-z4', radiusTiles: { x: 6, y: 4 } },
    { accent: '#58627b', center: { x: 100, y: 122 }, id: 'centro-z5', radiusTiles: { x: 6, y: 4 } },
    { accent: '#5e7161', center: { x: 94, y: 114 }, id: 'centro-z6', radiusTiles: { x: 5, y: 4 } },
  ],
};

const zonaNorteInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-negro': { x: 118, y: 112 },
  'hospital-zn': { x: 96, y: 102 },
  'treino-zn': { x: 108, y: 106 },
  'universidade-zn': { x: 144, y: 96 },
  'boca-prototipo': { x: 116, y: 132 },
  'fabrica-prototipo': { x: 146, y: 124 },
  'baile-prototipo': { x: 124, y: 140 },
  'desmanche-zn': { x: 154, y: 118 },
};

const zonaNorteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zn-hospital': { x: 94, y: 100 },
  'zn-treino': { x: 108, y: 104 },
  'zn-universidade': { x: 142, y: 94 },
  'zn-mercado': { x: 116, y: 110 },
  'zn-boca': { x: 114, y: 130 },
  'zn-fabrica': { x: 144, y: 122 },
  'zn-baile': { x: 122, y: 138 },
  'zn-rave': { x: 136, y: 136 },
  'zn-desmanche': { x: 152, y: 116 },
  'zn-prisao': { x: 88, y: 112 },
  'zn-favela-cluster-1': { x: 104, y: 120 },
  'zn-favela-cluster-2': { x: 116, y: 128 },
  'zn-favela-cluster-3': { x: 130, y: 134 },
  'zn-favela-cluster-4': { x: 142, y: 128 },
};

const zonaNorteCompactInteractivePreset: MapVisualPreset = {
  ...interactiveZonaNortePreset,
  entities: repositionEntities(
    interactiveZonaNortePreset.entities,
    zonaNorteInteractiveEntityPositions,
  ),
  contextSpots: repositionContextSpots(
    interactiveZonaNortePreset.contextSpots,
    zonaNorteInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#5a6c53',
      center: { x: 122, y: 118 },
      fill: '#485845',
      id: 'zn-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 30, y: 18 },
    },
    {
      accent: '#6f6658',
      center: { x: 104, y: 108 },
      fill: '#5f564b',
      id: 'zn-miolo-popular-compacto',
      kind: 'concrete',
      radiusTiles: { x: 12, y: 8 },
    },
    {
      accent: '#7a5948',
      center: { x: 122, y: 130 },
      fill: '#644438',
      id: 'zn-favela-penha-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 13, y: 8 },
    },
    {
      accent: '#735441',
      center: { x: 138, y: 130 },
      fill: '#5d4033',
      id: 'zn-favela-alemao-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 12, y: 8 },
    },
    {
      accent: '#5d6854',
      center: { x: 116, y: 138 },
      fill: '#51604d',
      id: 'zn-encosta-compacta',
      kind: 'hillside',
      radiusTiles: { x: 12, y: 7 },
    },
    {
      accent: '#6f624f',
      center: { x: 148, y: 120 },
      fill: '#605345',
      id: 'zn-faixa-industrial-compacta',
      kind: 'industrial-yard',
      radiusTiles: { x: 10, y: 7 },
    },
    {
      accent: '#7b6a56',
      center: { x: 154, y: 104 },
      fill: '#665749',
      id: 'zn-vazio-operacional-compacto',
      kind: 'vacant-lot',
      radiusTiles: { x: 8, y: 5 },
    },
  ],
  structures: repositionStructures(
    interactiveZonaNortePreset.structures,
    zonaNorteInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#526a53', center: { x: 136, y: 126 }, id: 'zn-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#5a654f', center: { x: 104, y: 124 }, id: 'zn-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#58684f', center: { x: 98, y: 116 }, id: 'zn-z3', radiusTiles: { x: 6, y: 4 } },
    { accent: '#5a6b5a', center: { x: 146, y: 130 }, id: 'zn-z4', radiusTiles: { x: 8, y: 5 } },
    { accent: '#5f6a53', center: { x: 118, y: 136 }, id: 'zn-z5', radiusTiles: { x: 7, y: 5 } },
    { accent: '#66604f', center: { x: 152, y: 118 }, id: 'zn-z6', radiusTiles: { x: 6, y: 4 } },
  ],
};

const zonaSulInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-zs': { x: 148, y: 120 },
  'hospital-zs': { x: 136, y: 112 },
  'treino-zs': { x: 146, y: 114 },
  'universidade-zs': { x: 160, y: 108 },
  'boca-zs': { x: 126, y: 136 },
  'fabrica-zs': { x: 164, y: 130 },
  'baile-zs': { x: 132, y: 144 },
  'rave-zs': { x: 154, y: 138 },
};

const zonaSulInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zs-hospital': { x: 134, y: 110 },
  'zs-treino': { x: 146, y: 114 },
  'zs-universidade': { x: 158, y: 106 },
  'zs-mercado': { x: 146, y: 118 },
  'zs-fabrica': { x: 162, y: 128 },
  'zs-baile': { x: 130, y: 142 },
  'zs-rave': { x: 152, y: 136 },
  'zs-boca': { x: 124, y: 134 },
  'zs-prisao': { x: 128, y: 118 },
  'zs-favela-core-1': { x: 124, y: 132 },
  'zs-favela-core-2': { x: 132, y: 140 },
};

const zonaSulCompactInteractivePreset: MapVisualPreset = {
  ...interactiveZonaSulPreset,
  entities: repositionEntities(interactiveZonaSulPreset.entities, zonaSulInteractiveEntityPositions),
  contextSpots: repositionContextSpots(
    interactiveZonaSulPreset.contextSpots,
    zonaSulInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#5f7658',
      center: { x: 148, y: 128 },
      fill: '#4c5d49',
      id: 'zs-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 28, y: 16 },
    },
    {
      accent: '#887561',
      center: { x: 150, y: 118 },
      fill: '#706352',
      id: 'zs-faixa-nobre-compacta',
      kind: 'commercial-yard',
      radiusTiles: { x: 11, y: 7 },
    },
    {
      accent: '#5c6a57',
      center: { x: 128, y: 138 },
      fill: '#53624f',
      id: 'zs-encosta-compacta',
      kind: 'hillside',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#7c5a4d',
      center: { x: 130, y: 138 },
      fill: '#64463a',
      id: 'zs-favela-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#6c6458',
      center: { x: 164, y: 132 },
      fill: '#5f574c',
      id: 'zs-servicos-compacto',
      kind: 'industrial-yard',
      radiusTiles: { x: 9, y: 5 },
    },
  ],
  structures: repositionStructures(
    interactiveZonaSulPreset.structures,
    zonaSulInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#58735b', center: { x: 126, y: 138 }, id: 'zs-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#5c6f5e', center: { x: 136, y: 132 }, id: 'zs-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#607462', center: { x: 144, y: 128 }, id: 'zs-z3', radiusTiles: { x: 6, y: 4 } },
    { accent: '#647767', center: { x: 152, y: 136 }, id: 'zs-z4', radiusTiles: { x: 6, y: 4 } },
  ],
};

const zonaOesteInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-zo': { x: 108, y: 126 },
  'hospital-zo': { x: 92, y: 118 },
  'treino-zo': { x: 102, y: 120 },
  'universidade-zo': { x: 142, y: 114 },
  'boca-zo': { x: 122, y: 140 },
  'fabrica-zo': { x: 148, y: 134 },
  'baile-zo': { x: 116, y: 148 },
  'desmanche-zo': { x: 154, y: 144 },
};

const zonaOesteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zo-hospital': { x: 90, y: 116 },
  'zo-treino': { x: 102, y: 120 },
  'zo-universidade': { x: 140, y: 112 },
  'zo-mercado': { x: 106, y: 124 },
  'zo-fabrica': { x: 146, y: 132 },
  'zo-desmanche': { x: 152, y: 142 },
  'zo-baile': { x: 114, y: 146 },
  'zo-boca': { x: 120, y: 138 },
  'zo-prisao': { x: 86, y: 126 },
  'zo-favela-1': { x: 116, y: 136 },
  'zo-favela-2': { x: 132, y: 144 },
};

const zonaOesteCompactInteractivePreset: MapVisualPreset = {
  ...interactiveZonaOestePreset,
  entities: repositionEntities(
    interactiveZonaOestePreset.entities,
    zonaOesteInteractiveEntityPositions,
  ),
  contextSpots: repositionContextSpots(
    interactiveZonaOestePreset.contextSpots,
    zonaOesteInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#5f714f',
      center: { x: 116, y: 132 },
      fill: '#4b5a46',
      id: 'zo-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 28, y: 16 },
    },
    {
      accent: '#6b624f',
      center: { x: 104, y: 124 },
      fill: '#5a5347',
      id: 'zo-miolo-misto-compacto',
      kind: 'concrete',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#7b5949',
      center: { x: 124, y: 142 },
      fill: '#644438',
      id: 'zo-favela-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 11, y: 7 },
    },
    {
      accent: '#596650',
      center: { x: 132, y: 146 },
      fill: '#4f5d4b',
      id: 'zo-encosta-compacta',
      kind: 'hillside',
      radiusTiles: { x: 9, y: 6 },
    },
    {
      accent: '#746b56',
      center: { x: 150, y: 138 },
      fill: '#615447',
      id: 'zo-industrial-compacto',
      kind: 'industrial-yard',
      radiusTiles: { x: 10, y: 6 },
    },
  ],
  structures: repositionStructures(
    interactiveZonaOestePreset.structures,
    zonaOesteInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#5f7357', center: { x: 118, y: 140 }, id: 'zo-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#6d5f4f', center: { x: 132, y: 144 }, id: 'zo-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#59644f', center: { x: 148, y: 136 }, id: 'zo-z3', radiusTiles: { x: 6, y: 4 } },
  ],
};

const zonaSudoesteInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-zso': { x: 98, y: 132 },
  'hospital-zso': { x: 84, y: 124 },
  'treino-zso': { x: 94, y: 126 },
  'universidade-zso': { x: 136, y: 122 },
  'boca-zso': { x: 110, y: 144 },
  'fabrica-zso': { x: 142, y: 140 },
  'baile-zso': { x: 100, y: 152 },
  'desmanche-zso': { x: 152, y: 150 },
};

const zonaSudoesteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zso-hospital': { x: 82, y: 122 },
  'zso-treino': { x: 94, y: 126 },
  'zso-universidade': { x: 134, y: 120 },
  'zso-mercado': { x: 96, y: 130 },
  'zso-fabrica': { x: 140, y: 138 },
  'zso-desmanche': { x: 150, y: 148 },
  'zso-baile': { x: 98, y: 150 },
  'zso-boca': { x: 108, y: 142 },
  'zso-prisao': { x: 78, y: 132 },
  'zso-favela-1': { x: 102, y: 144 },
  'zso-favela-2': { x: 118, y: 150 },
};

const zonaSudoesteCompactInteractivePreset: MapVisualPreset = {
  ...interactiveZonaSudoestePreset,
  entities: repositionEntities(
    interactiveZonaSudoestePreset.entities,
    zonaSudoesteInteractiveEntityPositions,
  ),
  contextSpots: repositionContextSpots(
    interactiveZonaSudoestePreset.contextSpots,
    zonaSudoesteInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#56664f',
      center: { x: 112, y: 142 },
      fill: '#445141',
      id: 'zso-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 28, y: 16 },
    },
    {
      accent: '#6a604f',
      center: { x: 96, y: 132 },
      fill: '#5a5145',
      id: 'zso-miolo-denso-compacto',
      kind: 'concrete',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#7c5b49',
      center: { x: 108, y: 148 },
      fill: '#644438',
      id: 'zso-favela-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 12, y: 7 },
    },
    {
      accent: '#596650',
      center: { x: 120, y: 152 },
      fill: '#4f5d4b',
      id: 'zso-encosta-compacta',
      kind: 'hillside',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#705f50',
      center: { x: 146, y: 146 },
      fill: '#5f5247',
      id: 'zso-corredor-industrial-compacto',
      kind: 'industrial-yard',
      radiusTiles: { x: 10, y: 6 },
    },
  ],
  structures: repositionStructures(
    interactiveZonaSudoestePreset.structures,
    zonaSudoesteInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#5b6e55', center: { x: 102, y: 146 }, id: 'zso-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#61725b', center: { x: 116, y: 150 }, id: 'zso-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#6a6452', center: { x: 144, y: 144 }, id: 'zso-z3', radiusTiles: { x: 6, y: 4 } },
  ],
};

const baixadaInteractiveEntityPositions: Record<string, { x: number; y: number }> = {
  'mercado-bx': { x: 86, y: 170 },
  'hospital-bx': { x: 58, y: 164 },
  'treino-bx': { x: 70, y: 166 },
  'universidade-bx': { x: 108, y: 162 },
  'boca-bx': { x: 94, y: 178 },
  'fabrica-bx': { x: 120, y: 174 },
  'baile-bx': { x: 78, y: 184 },
  'desmanche-bx': { x: 128, y: 182 },
};

const baixadaInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'bx-hospital': { x: 56, y: 162 },
  'bx-treino': { x: 70, y: 166 },
  'bx-universidade': { x: 106, y: 160 },
  'bx-mercado': { x: 84, y: 168 },
  'bx-fabrica': { x: 118, y: 172 },
  'bx-desmanche': { x: 126, y: 180 },
  'bx-baile': { x: 76, y: 182 },
  'bx-boca': { x: 92, y: 176 },
  'bx-prisao': { x: 54, y: 172 },
  'bx-favela-1': { x: 90, y: 176 },
  'bx-favela-2': { x: 104, y: 182 },
};

const baixadaCompactInteractivePreset: MapVisualPreset = {
  ...interactiveBaixadaPreset,
  entities: repositionEntities(interactiveBaixadaPreset.entities, baixadaInteractiveEntityPositions),
  contextSpots: repositionContextSpots(
    interactiveBaixadaPreset.contextSpots,
    baixadaInteractiveEntityPositions,
  ),
  groundPatches: [
    {
      accent: '#607155',
      center: { x: 90, y: 174 },
      fill: '#4e5d49',
      id: 'bx-base-verde-compacto',
      kind: 'greenery',
      radiusTiles: { x: 26, y: 15 },
    },
    {
      accent: '#7a6752',
      center: { x: 96, y: 180 },
      fill: '#605345',
      id: 'bx-terra-logistica-compacta',
      kind: 'earth',
      radiusTiles: { x: 12, y: 7 },
    },
    {
      accent: '#705f50',
      center: { x: 120, y: 176 },
      fill: '#5f5247',
      id: 'bx-faixa-industrial-compacta',
      kind: 'industrial-yard',
      radiusTiles: { x: 11, y: 7 },
    },
    {
      accent: '#7b5949',
      center: { x: 96, y: 180 },
      fill: '#644438',
      id: 'bx-favela-compacta',
      kind: 'favela-core',
      radiusTiles: { x: 10, y: 6 },
    },
    {
      accent: '#68604f',
      center: { x: 74, y: 170 },
      fill: '#5a5145',
      id: 'bx-miolo-compacto',
      kind: 'concrete',
      radiusTiles: { x: 9, y: 5 },
    },
  ],
  structures: repositionStructures(
    interactiveBaixadaPreset.structures,
    baixadaInteractiveStructurePositions,
  ),
  zoneSlots: [
    { accent: '#5d7057', center: { x: 90, y: 178 }, id: 'bx-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#6d5f50', center: { x: 104, y: 182 }, id: 'bx-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#59644f', center: { x: 118, y: 176 }, id: 'bx-z3', radiusTiles: { x: 6, y: 4 } },
  ],
};

const tightenedCentroPreset = compactMapPreset(centroCompactInteractivePreset, {
  anchor: { x: 128, y: 116 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

const tightenedZonaNortePreset = compactMapPreset(zonaNorteCompactInteractivePreset, {
  anchor: { x: 112, y: 88 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

const tightenedZonaSulPreset = compactMapPreset(zonaSulCompactInteractivePreset, {
  anchor: { x: 160, y: 132 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

const tightenedZonaOestePreset = compactMapPreset(zonaOesteCompactInteractivePreset, {
  anchor: { x: 84, y: 120 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

const tightenedZonaSudoestePreset = compactMapPreset(zonaSudoesteCompactInteractivePreset, {
  anchor: { x: 76, y: 148 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

const tightenedBaixadaPreset = compactMapPreset(baixadaCompactInteractivePreset, {
  anchor: { x: 44, y: 172 },
  patchScale: 0.56,
  positionScale: 0.46,
  reachScale: 0.84,
  zoneScale: 0.5,
});

export function getMapVisualPreset(regionId?: string | null): MapVisualPreset {
  if (regionId === 'zona_sul') {
    return tightenedZonaSulPreset;
  }

  if (regionId === 'zona_norte') {
    return tightenedZonaNortePreset;
  }

  if (regionId === 'zona_oeste') {
    return tightenedZonaOestePreset;
  }

  if (regionId === 'zona_sudoeste') {
    return tightenedZonaSudoestePreset;
  }

  if (regionId === 'baixada') {
    return tightenedBaixadaPreset;
  }

  return tightenedCentroPreset;
}

export function resolveZoneAccentFromRelation(relation: 'ally' | 'enemy' | 'neutral'): string {
  if (relation === 'ally') {
    return colors.success;
  }

  if (relation === 'enemy') {
    return colors.danger;
  }

  return colors.muted;
}
