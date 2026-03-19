import { useEditorStore } from '../state/editorStore';
import type { EditorBrushMode, EditorToolName } from '../tools/ToolManager';

const TOOL_OPTIONS: Array<{
  hint: string;
  label: string;
  shortcut: string;
  value: EditorToolName;
}> = [
  {
    hint: 'Seleciona e arrasta objetos. Em tilelayer, seleciona regiao retangular.',
    label: 'Select',
    shortcut: 'V',
    value: 'select',
  },
  {
    hint: 'Posiciona estrutura, spawn ou region no tile clicado.',
    label: 'Place',
    shortcut: 'P',
    value: 'place',
  },
  {
    hint: 'Clique num objeto no mapa para remover imediatamente.',
    label: 'Delete',
    shortcut: 'X',
    value: 'delete',
  },
  {
    hint: 'Pinta tiles com o GID selecionado. Clique e arraste.',
    label: 'Paint',
    shortcut: 'B',
    value: 'paint',
  },
  {
    hint: 'Apaga tiles (GID 0). Clique e arraste.',
    label: 'Erase',
    shortcut: 'E',
    value: 'erase',
  },
  {
    hint: 'Captura o GID do tile clicado para usar no Paint.',
    label: 'Eyedropper',
    shortcut: 'I',
    value: 'eyedropper',
  },
];

const BRUSH_OPTIONS: Array<{ label: string; value: EditorBrushMode }> = [
  { label: '1x1', value: 'brush_1' },
  { label: '3x3', value: 'brush_3' },
  { label: '5x5', value: 'brush_5' },
  { label: 'Line', value: 'line' },
  { label: 'Rect', value: 'rectangle' },
];

function getContextHint(activeTool: EditorToolName, activeLayerName: string): string {
  const isTileLayer = activeLayerName === 'terrain' || activeLayerName === 'buildings' || activeLayerName === 'collision';
  const isStructures = activeLayerName === 'structures';
  const isMarker = activeLayerName === 'spawn_points' || activeLayerName === 'region_markers';

  if (activeTool === 'select') {
    if (isStructures) return 'Clique numa estrutura para selecionar. Arraste para mover. Delete/Backspace para remover.';
    if (isMarker) return 'Clique num marcador para selecionar. Arraste para mover. Delete/Backspace para remover.';
    if (isTileLayer) return 'Arraste para selecionar uma regiao retangular. Ctrl+C para copiar, Ctrl+V para colar.';
    return 'Selecione a layer desejada no painel Layers.';
  }

  if (activeTool === 'place') {
    if (isStructures) return 'Clique no mapa para posicionar a estrutura selecionada no catalogo.';
    if (isMarker) return `Clique no mapa para adicionar um ${activeLayerName === 'spawn_points' ? 'spawn point' : 'region marker'}.`;
    if (isTileLayer) return 'Place funciona em object layers. Troque para structures, spawn_points ou region_markers.';
    return 'Selecione structures, spawn_points ou region_markers no painel Layers.';
  }

  if (activeTool === 'delete') {
    if (isStructures) return 'Clique numa estrutura no mapa para remover.';
    if (isMarker) return `Clique num marcador no mapa para remover.`;
    if (isTileLayer) return 'Delete funciona em object layers. Troque para structures, spawn_points ou region_markers.';
    return 'Selecione uma object layer no painel Layers.';
  }

  if (activeTool === 'paint') {
    if (activeLayerName === 'collision') return 'Clique para alternar collision (liga/desliga). Ative o overlay Collision para visualizar.';
    if (isTileLayer) return 'Clique e arraste para pintar com o tile selecionado na Palette.';
    if (isStructures || isMarker) return 'Paint funciona em tilelayers. Troque para terrain, buildings ou collision.';
    return 'Selecione uma tilelayer no painel Layers.';
  }

  if (activeTool === 'erase') {
    if (isTileLayer) return 'Clique e arraste para apagar tiles (define GID 0).';
    if (isStructures || isMarker) return 'Erase funciona em tilelayers. Troque para terrain, buildings ou collision.';
    return 'Selecione uma tilelayer no painel Layers.';
  }

  if (activeTool === 'eyedropper') {
    if (isTileLayer) return 'Clique num tile para capturar o GID e usar no Paint.';
    return 'Eyedropper funciona em tilelayers.';
  }

  return '';
}

export function ToolBar() {
  const activeLayerName = useEditorStore((state) => state.activeLayerName);
  const activeTool = useEditorStore((state) => state.activeTool);
  const brushMode = useEditorStore((state) => state.brushMode);
  const undoCount = useEditorStore((state) => state.history.undoStack.length);
  const redoCount = useEditorStore((state) => state.history.redoStack.length);
  const layerSummaries = useEditorStore((state) => state.layerSummaries);
  const overlayVisibility = useEditorStore((state) => state.overlayVisibility);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setBrushMode = useEditorStore((state) => state.setBrushMode);
  const setOverlayVisibility = useEditorStore((state) => state.setOverlayVisibility);
  const activeLayer = layerSummaries.find((layer) => layer.name === activeLayerName);
  const showBrushControls =
    activeLayer?.type === 'tilelayer' &&
    (activeTool === 'paint' || activeTool === 'erase');
  const contextHint = getContextHint(activeTool, activeLayerName);

  return (
    <section className="panel panel-tools">
      <div className="panel-section-head">
        <h2>Ferramentas</h2>
        <span>{undoCount} undo &bull; {redoCount} redo</span>
      </div>

      <div className="tool-grid">
        {TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.value}
            type="button"
            className={`tool-button${activeTool === tool.value ? ' is-active' : ''}`}
            onClick={() => setActiveTool(tool.value)}
            title={tool.hint}
          >
            <strong>{tool.label} <span className="tool-shortcut">{tool.shortcut}</span></strong>
            <span>{tool.hint}</span>
          </button>
        ))}
      </div>

      {contextHint ? (
        <div className="context-hint">
          {contextHint}
        </div>
      ) : null}

      {showBrushControls ? (
        <>
          <div className="panel-section-head panel-section-head-compact">
            <h3>Brush</h3>
            <span>Ctrl+Z / Ctrl+Shift+Z</span>
          </div>

          <div className="chip-grid">
            {BRUSH_OPTIONS.map((brush) => (
              <button
                key={brush.value}
                type="button"
                className={`chip-button${brushMode === brush.value ? ' is-active' : ''}`}
                onClick={() => setBrushMode(brush.value)}
              >
                {brush.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="panel-section-head panel-section-head-compact">
        <h3>Overlays</h3>
        <span>visualizacao</span>
      </div>

      <div className="chip-grid chip-grid-overlays">
        <button
          type="button"
          className={`chip-button${overlayVisibility.grid ? ' is-active' : ''}`}
          onClick={() => setOverlayVisibility('grid', !overlayVisibility.grid)}
        >
          Grid
        </button>
        <button
          type="button"
          className={`chip-button${overlayVisibility.collision ? ' is-active' : ''}`}
          onClick={() => setOverlayVisibility('collision', !overlayVisibility.collision)}
        >
          Collision
        </button>
        <button
          type="button"
          className={`chip-button${overlayVisibility.spawnPoints ? ' is-active' : ''}`}
          onClick={() => setOverlayVisibility('spawnPoints', !overlayVisibility.spawnPoints)}
        >
          Spawns
        </button>
        <button
          type="button"
          className={`chip-button${overlayVisibility.regionMarkers ? ' is-active' : ''}`}
          onClick={() => setOverlayVisibility('regionMarkers', !overlayVisibility.regionMarkers)}
        >
          Regions
        </button>
      </div>
    </section>
  );
}
