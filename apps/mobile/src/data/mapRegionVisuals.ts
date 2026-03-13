import { colors } from '../theme/colors';

export type MapEntityKind =
  | 'boca'
  | 'docks'
  | 'factory'
  | 'hospital'
  | 'market'
  | 'party'
  | 'scrapyard'
  | 'training'
  | 'university';

export interface MapGroundPatch {
  accent?: string;
  center: { x: number; y: number };
  fill: string;
  id: string;
  kind: 'block' | 'blocked' | 'favela-ground' | 'slope' | 'yard';
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

const centroPreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-negro', kind: 'market', label: 'Mercado Negro', position: { x: 86, y: 92 } },
    { color: '#7fb0ff', id: 'hospital-centro', kind: 'hospital', label: 'Hospital', position: { x: 76, y: 70 } },
    { color: '#e0b04b', id: 'treino-centro', kind: 'training', label: 'Treino', position: { x: 94, y: 74 } },
    { color: '#8cc7ff', id: 'universidade-centro', kind: 'university', label: 'Universidade', position: { x: 126, y: 82 } },
    { color: '#86bbd8', id: 'boca-prototipo', kind: 'boca', label: 'Boca', position: { x: 118, y: 104 } },
    { color: '#4cb071', id: 'fabrica-prototipo', kind: 'factory', label: 'Fábrica', position: { x: 98, y: 122 } },
    { color: '#d487ff', id: 'baile-prototipo', kind: 'party', label: 'Baile', position: { x: 140, y: 116 } },
    { color: '#74b9ff', id: 'docas-centro', kind: 'docks', label: 'Docas', position: { x: 144, y: 88 } },
  ],
  contextSpots: [
    { entityId: 'mercado-negro', position: { x: 86, y: 92 }, reach: 4, title: 'Mercado Negro' },
    { entityId: 'hospital-centro', position: { x: 76, y: 70 }, reach: 4, title: 'Hospital' },
    { entityId: 'treino-centro', position: { x: 94, y: 74 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-centro', position: { x: 126, y: 82 }, reach: 4, title: 'Universidade' },
    { entityId: 'boca-prototipo', position: { x: 118, y: 104 }, reach: 4, title: 'Boca' },
    { entityId: 'fabrica-prototipo', position: { x: 98, y: 122 }, reach: 4, title: 'Fábrica' },
    { entityId: 'baile-prototipo', position: { x: 140, y: 116 }, reach: 4, title: 'Baile' },
    { entityId: 'docas-centro', position: { x: 144, y: 88 }, reach: 4, title: 'Docas' },
  ],
  groundPatches: [
    {
      accent: '#b39a72',
      center: { x: 102, y: 92 },
      fill: '#8c826f',
      id: 'centro-quadra-mercado',
      kind: 'block',
      radiusTiles: { x: 13, y: 8 },
    },
    {
      accent: '#8a7559',
      center: { x: 130, y: 86 },
      fill: '#6f6551',
      id: 'centro-patio-portuario',
      kind: 'yard',
      label: 'Pátio portuário',
      radiusTiles: { x: 11, y: 7 },
    },
    {
      accent: '#6e7354',
      center: { x: 70, y: 108 },
      fill: '#5b6147',
      id: 'centro-encosta-providencia',
      kind: 'slope',
      label: 'Encosta',
      radiusTiles: { x: 9, y: 7 },
    },
    {
      accent: '#cb7c48',
      center: { x: 153, y: 100 },
      fill: '#453126',
      id: 'centro-area-bloqueada',
      kind: 'blocked',
      label: 'Fechado',
      radiusTiles: { x: 8, y: 5 },
    },
    {
      accent: '#6f6658',
      center: { x: 88, y: 118 },
      fill: '#7a725f',
      id: 'centro-quadra-baixa',
      kind: 'block',
      radiusTiles: { x: 14, y: 8 },
    },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'marco-porto', label: 'Cais', position: { x: 126, y: 86 }, shape: 'warehouse' },
    { accent: '#8b744f', id: 'marco-praca', label: 'Praça', position: { x: 98, y: 96 }, shape: 'plaza' },
    { accent: '#c57f4b', id: 'marco-entrada-morro', label: 'Entrada do Morro', position: { x: 74, y: 102 }, shape: 'gate' },
  ],
  trails: [
    {
      accent: '#e0d6b1',
      id: 'via-portuaria',
      kind: 'avenue',
      label: 'Via portuária',
      points: [
        { x: 34, y: 62 },
        { x: 68, y: 82 },
        { x: 112, y: 100 },
        { x: 156, y: 114 },
      ],
    },
    {
      accent: '#d6ccb2',
      id: 'ladeira-providencia',
      kind: 'street',
      label: 'Ladeira',
      points: [
        { x: 58, y: 114 },
        { x: 66, y: 106 },
        { x: 72, y: 96 },
        { x: 78, y: 84 },
      ],
    },
    {
      accent: '#d9ceb0',
      id: 'beco-mercado',
      kind: 'alley',
      label: 'Beco',
      points: [
        { x: 90, y: 120 },
        { x: 104, y: 111 },
        { x: 120, y: 103 },
      ],
    },
  ],
  zoneSlots: [
    { accent: '#7b1f27', center: { x: 72, y: 102 }, id: 'centro-z1', radiusTiles: { x: 7, y: 5 } },
    { accent: '#6d6060', center: { x: 89, y: 94 }, id: 'centro-z2', radiusTiles: { x: 6, y: 4 } },
    { accent: '#6c5b7b', center: { x: 104, y: 92 }, id: 'centro-z3', radiusTiles: { x: 6, y: 4 } },
    { accent: '#8a4f4f', center: { x: 118, y: 97 }, id: 'centro-z4', radiusTiles: { x: 7, y: 5 } },
    { accent: '#58627b', center: { x: 132, y: 104 }, id: 'centro-z5', radiusTiles: { x: 6, y: 4 } },
    { accent: '#5e7161', center: { x: 146, y: 110 }, id: 'centro-z6', radiusTiles: { x: 5, y: 4 } },
  ],
};

const zonaNortePreset: MapVisualPreset = {
  entities: [
    { color: '#d95f5f', id: 'mercado-negro', kind: 'market', label: 'Mercado Negro', position: { x: 86, y: 92 } },
    { color: '#7fb0ff', id: 'hospital-zn', kind: 'hospital', label: 'Hospital', position: { x: 68, y: 76 } },
    { color: '#e0b04b', id: 'treino-zn', kind: 'training', label: 'Treino', position: { x: 92, y: 72 } },
    { color: '#8cc7ff', id: 'universidade-zn', kind: 'university', label: 'Universidade', position: { x: 136, y: 72 } },
    { color: '#86bbd8', id: 'boca-prototipo', kind: 'boca', label: 'Boca', position: { x: 120, y: 100 } },
    { color: '#4cb071', id: 'fabrica-prototipo', kind: 'factory', label: 'Fábrica', position: { x: 144, y: 122 } },
    { color: '#d487ff', id: 'baile-prototipo', kind: 'party', label: 'Baile', position: { x: 102, y: 134 } },
    { color: '#cf8056', id: 'desmanche-zn', kind: 'scrapyard', label: 'Desmanche', position: { x: 156, y: 98 } },
  ],
  contextSpots: [
    { entityId: 'mercado-negro', position: { x: 86, y: 92 }, reach: 4, title: 'Mercado Negro' },
    { entityId: 'hospital-zn', position: { x: 68, y: 76 }, reach: 4, title: 'Hospital' },
    { entityId: 'treino-zn', position: { x: 92, y: 72 }, reach: 4, title: 'Treino' },
    { entityId: 'universidade-zn', position: { x: 136, y: 72 }, reach: 4, title: 'Universidade' },
    { entityId: 'boca-prototipo', position: { x: 120, y: 100 }, reach: 4, title: 'Boca' },
    { entityId: 'fabrica-prototipo', position: { x: 144, y: 122 }, reach: 4, title: 'Fábrica' },
    { entityId: 'baile-prototipo', position: { x: 102, y: 134 }, reach: 4, title: 'Baile' },
    { entityId: 'desmanche-zn', position: { x: 156, y: 98 }, reach: 4, title: 'Desmanche' },
  ],
  groundPatches: [
    {
      accent: '#75836a',
      center: { x: 102, y: 90 },
      fill: '#717865',
      id: 'zn-quadra-central',
      kind: 'block',
      radiusTiles: { x: 14, y: 9 },
    },
    {
      accent: '#5f725e',
      center: { x: 120, y: 104 },
      fill: '#50624f',
      id: 'zn-miolo-favela',
      kind: 'favela-ground',
      label: 'Miolo da favela',
      radiusTiles: { x: 13, y: 8 },
    },
    {
      accent: '#5b714f',
      center: { x: 82, y: 66 },
      fill: '#4f6747',
      id: 'encosta-norte',
      kind: 'slope',
      label: 'Encosta',
      radiusTiles: { x: 10, y: 7 },
    },
    {
      accent: '#ce8344',
      center: { x: 154, y: 86 },
      fill: '#524030',
      id: 'talude-fechado',
      kind: 'blocked',
      label: 'Fechado',
      radiusTiles: { x: 9, y: 5 },
    },
    {
      accent: '#6d7866',
      center: { x: 146, y: 120 },
      fill: '#6c7561',
      id: 'zn-quadra-industrial',
      kind: 'block',
      radiusTiles: { x: 12, y: 8 },
    },
  ],
  landmarks: [
    { accent: '#d8c27c', id: 'marco-subida', label: 'Subida', position: { x: 78, y: 84 }, shape: 'gate' },
    { accent: '#7bcf99', id: 'marco-quadra', label: 'Quadra', position: { x: 108, y: 114 }, shape: 'plaza' },
    { accent: '#7c6142', id: 'marco-galpao', label: 'Galpão', position: { x: 140, y: 124 }, shape: 'warehouse' },
  ],
  trails: [
    {
      accent: '#ddd3ad',
      id: 'via-comunitaria',
      kind: 'avenue',
      label: 'Via comunitária',
      points: [
        { x: 36, y: 58 },
        { x: 66, y: 74 },
        { x: 102, y: 92 },
        { x: 148, y: 120 },
      ],
    },
    {
      accent: '#c8d1bf',
      id: 'subida-principal',
      kind: 'street',
      label: 'Subida',
      points: [
        { x: 66, y: 118 },
        { x: 72, y: 104 },
        { x: 78, y: 90 },
        { x: 84, y: 74 },
      ],
    },
    {
      accent: '#d2c8ae',
      id: 'beco-da-quadra',
      kind: 'alley',
      label: 'Beco',
      points: [
        { x: 111, y: 124 },
        { x: 118, y: 114 },
        { x: 128, y: 106 },
      ],
    },
  ],
  zoneSlots: [
    { accent: '#4c6f54', center: { x: 62, y: 82 }, id: 'zn-z1', radiusTiles: { x: 6, y: 4 } },
    { accent: '#35624a', center: { x: 78, y: 74 }, id: 'zn-z2', radiusTiles: { x: 7, y: 5 } },
    { accent: '#325f52', center: { x: 96, y: 80 }, id: 'zn-z3', radiusTiles: { x: 8, y: 5 } },
    { accent: '#456e61', center: { x: 112, y: 92 }, id: 'zn-z4', radiusTiles: { x: 8, y: 6 } },
    { accent: '#547a70', center: { x: 132, y: 104 }, id: 'zn-z5', radiusTiles: { x: 7, y: 5 } },
    { accent: '#64877a', center: { x: 146, y: 118 }, id: 'zn-z6', radiusTiles: { x: 6, y: 4 } },
  ],
};

export function getMapVisualPreset(regionId?: string | null): MapVisualPreset {
  if (regionId === 'zona_norte') {
    return zonaNortePreset;
  }

  return centroPreset;
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
