import type { CSSProperties } from 'react';

import {
  MAP_STRUCTURE_CATALOG,
  type MapStructureCategory,
} from '@shared/map/structureCatalog';
import type { MapStructureKind } from '@shared/map/types';

import { STRUCTURE_CATEGORY_ORDER, useEditorStore } from '../state/editorStore';
import { useStructureImageCatalog } from '../structures/useStructureImageCatalog';

const CATEGORY_LABELS: Record<MapStructureCategory, string> = {
  clandestino: 'Clandestino',
  comercial: 'Comercial',
  equipamento: 'Equipamento',
  favela: 'Favela',
  industrial: 'Industrial',
  institucional: 'Institucional',
  residencial: 'Residencial',
};

function buildPlaceholderStyle(kind: MapStructureKind): CSSProperties {
  const structure = MAP_STRUCTURE_CATALOG[kind];

  return {
    '--structure-preview-detail': structure.palette.detail,
    '--structure-preview-outline': structure.palette.outline,
    '--structure-preview-roof': structure.palette.roof,
    '--structure-preview-soft': structure.palette.detailSoft,
  } as CSSProperties;
}

export function StructureCatalog() {
  const activeLayerName = useEditorStore((state) => state.activeLayerName);
  const activeStructureCategory = useEditorStore((state) => state.activeStructureCategory);
  const activeTool = useEditorStore((state) => state.activeTool);
  const selectedStructureKind = useEditorStore((state) => state.selectedStructureKind);
  const setActiveLayerName = useEditorStore((state) => state.setActiveLayerName);
  const setActiveStructureCategory = useEditorStore((state) => state.setActiveStructureCategory);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setSelectedStructureKind = useEditorStore((state) => state.setSelectedStructureKind);
  const structureEntries = Object.values(MAP_STRUCTURE_CATALOG)
    .filter((entry) => entry.category === activeStructureCategory)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  const { imageCatalog } = useStructureImageCatalog(
    structureEntries.map((structure) => structure.kind),
  );

  return (
    <section className="panel panel-structures">
      <div className="panel-section-head">
        <h2>Estruturas</h2>
        <span>{structureEntries.length} itens</span>
      </div>

      <div className="structure-tabs">
        {STRUCTURE_CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={`chip-button${activeStructureCategory === category ? ' is-active' : ''}`}
            onClick={() => setActiveStructureCategory(category)}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="structure-grid">
        {structureEntries.map((structure) => (
          <button
            key={structure.kind}
            type="button"
            className={`structure-card${
              selectedStructureKind === structure.kind ? ' is-active' : ''
            }`}
            onClick={() => {
              setActiveLayerName('structures');
              setSelectedStructureKind(structure.kind);
              setActiveTool('place');
            }}
          >
            {imageCatalog[structure.kind] ? (
              <img
                className="structure-card-preview"
                src={imageCatalog[structure.kind]?.src}
                alt=""
              />
            ) : (
              <div
                className="structure-card-preview structure-card-preview-placeholder"
                style={buildPlaceholderStyle(structure.kind)}
              >
                <span>{structure.kind}</span>
              </div>
            )}
            <strong>{structure.label}</strong>
            <span>{CATEGORY_LABELS[structure.category]}</span>
            <span>
              {structure.defaultFootprint.w}x{structure.defaultFootprint.h} tiles
            </span>
          </button>
        ))}
      </div>

      <div className="context-hint">
        {activeLayerName === 'structures' && activeTool === 'place'
          ? 'Clique no mapa para posicionar. V para Select e mover. X para Delete e clicar para remover.'
          : 'Clique num card acima para selecionar a estrutura. O tool Place e a layer structures serao ativados automaticamente.'}
      </div>
    </section>
  );
}
