import { useEditorStore } from '../state/editorStore';

const LAYER_HINTS: Record<string, string> = {
  buildings: 'Tilelayer. Use Paint/Erase para editar tiles.',
  collision: 'Tilelayer. Paint alterna collision on/off. Ative overlay Collision para ver.',
  region_markers: 'Objectgroup. Place para adicionar. Select para mover/editar. Delete/X para remover.',
  spawn_points: 'Objectgroup. Place para adicionar. Select para mover/editar. Delete/X para remover.',
  structures: 'Objectgroup. Escolha no Catalogo para Place. Select para mover. Delete/X para remover.',
  terrain: 'Tilelayer. Use Paint/Erase para editar tiles.',
};

function getLayerHint(layerName: string, layerType: string): string {
  return LAYER_HINTS[layerName] ?? (layerType === 'tilelayer' ? 'Tilelayer. Use Paint/Erase.' : 'Objectgroup. Use Select/Place/Delete.');
}

export function LayerPanel() {
  const activeLayerName = useEditorStore((state) => state.activeLayerName);
  const layerSummaries = useEditorStore((state) => state.layerSummaries);
  const setActiveLayerName = useEditorStore((state) => state.setActiveLayerName);
  const setLayerVisibility = useEditorStore((state) => state.setLayerVisibility);

  return (
    <section className="panel panel-layers">
      <div className="panel-section-head">
        <h2>Layers</h2>
        <span>clique para ativar</span>
      </div>

      <div className="layer-list">
        {layerSummaries.map((layer) => (
          <div
            key={layer.name}
            className={`layer-row${activeLayerName === layer.name ? ' is-active' : ''}`}
          >
            <button
              type="button"
              className="layer-select"
              onClick={() => setActiveLayerName(layer.name)}
            >
              <strong>{layer.name}</strong>
              <span>{layer.type === 'objectgroup' ? 'objetos' : 'tiles'} &bull; {getLayerHint(layer.name, layer.type)}</span>
            </button>

            <label className="layer-visibility">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(event) => setLayerVisibility(layer.name, event.target.checked)}
              />
              <span>visivel</span>
            </label>
          </div>
        ))}
      </div>

      <p className="panel-note">
        Ferramentas Paint/Erase funcionam apenas em tilelayers. Place/Select/Delete funcionam em objectgroups (structures, spawn_points, region_markers).
      </p>
    </section>
  );
}
