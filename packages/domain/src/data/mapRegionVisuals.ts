import { colors } from './colors';
import {
  compactMapPreset,
  prunePresetToInteractive,
  repositionContextSpots,
  repositionEntities,
  repositionStructures,
  type MapVisualPreset,
} from './mapRegionVisualTypes';
import {
  baixadaPreset,
  centroPreset,
  zonaNortePreset,
  zonaOestePreset,
  zonaSulPreset,
  zonaSudoestePreset,
} from './mapRegionVisualPresets';

export type { MapEntityKind, MapStructureKind } from '@cs-rio/shared';
export type {
  MapGroundPatch,
  MapLandmark,
  MapStructure,
  MapVisualPreset,
} from './mapRegionVisualTypes';

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
  'universidade-centro': { x: 140, y: 96 },
  'boca-prototipo': { x: 114, y: 130 },
  'fabrica-prototipo': { x: 148, y: 122 },
  'baile-prototipo': { x: 122, y: 138 },
  'rave-centro': { x: 136, y: 134 },
  'docas-centro': { x: 152, y: 102 },
};

const centroInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'centro-hospital': { x: 102, y: 96 },
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
  'universidade-zn': { x: 144, y: 96 },
  'boca-prototipo': { x: 116, y: 132 },
  'fabrica-prototipo': { x: 146, y: 124 },
  'baile-prototipo': { x: 124, y: 140 },
  'desmanche-zn': { x: 154, y: 118 },
};

const zonaNorteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zn-hospital': { x: 94, y: 100 },
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
  'universidade-zs': { x: 160, y: 108 },
  'boca-zs': { x: 126, y: 136 },
  'fabrica-zs': { x: 164, y: 130 },
  'baile-zs': { x: 132, y: 144 },
  'rave-zs': { x: 154, y: 138 },
};

const zonaSulInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zs-hospital': { x: 134, y: 110 },
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
  'universidade-zo': { x: 142, y: 114 },
  'boca-zo': { x: 122, y: 140 },
  'fabrica-zo': { x: 148, y: 134 },
  'baile-zo': { x: 116, y: 148 },
  'desmanche-zo': { x: 154, y: 144 },
};

const zonaOesteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zo-hospital': { x: 90, y: 116 },
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
  'universidade-zso': { x: 136, y: 122 },
  'boca-zso': { x: 110, y: 144 },
  'fabrica-zso': { x: 142, y: 140 },
  'baile-zso': { x: 100, y: 152 },
  'desmanche-zso': { x: 152, y: 150 },
};

const zonaSudoesteInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'zso-hospital': { x: 82, y: 122 },
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
  'universidade-bx': { x: 108, y: 162 },
  'boca-bx': { x: 94, y: 178 },
  'fabrica-bx': { x: 120, y: 174 },
  'baile-bx': { x: 78, y: 184 },
  'desmanche-bx': { x: 128, y: 182 },
};

const baixadaInteractiveStructurePositions: Record<string, { x: number; y: number }> = {
  'bx-hospital': { x: 56, y: 162 },
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
