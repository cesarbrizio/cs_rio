interface EditorStatsPanelProps {
  activeLayerName: string;
  activeTool: string;
  cameraZoom: number;
  currentFileName: string;
  hoveredTile: { x: number; y: number } | null;
  isDirty: boolean;
  mapHeight: number;
  mapWidth: number;
  redoCount: number;
  regionCount: number;
  selectedLabel: string;
  spawnCount: number;
  structureCount: number;
  tileClipboardLabel: string;
  undoCount: number;
  visibleTiles: number;
}

function formatHoveredTileLabel(
  hoveredTile: { x: number; y: number } | null,
  mapWidth: number,
  mapHeight: number,
) {
  if (!hoveredTile) {
    return 'Passe o cursor sobre um tile';
  }

  return `Tile ${hoveredTile.x}, ${hoveredTile.y} de ${mapWidth - 1}, ${mapHeight - 1}`;
}

export function EditorStatsPanel(props: EditorStatsPanelProps) {
  return (
    <div className="panel panel-stats">
      <div className="stat-row">
        <span>Zoom</span>
        <strong>{props.cameraZoom.toFixed(2)}x</strong>
      </div>
      <div className="stat-row">
        <span>Arquivo / Dirty</span>
        <strong>{props.currentFileName} • {props.isDirty ? 'sim' : 'nao'}</strong>
      </div>
      <div className="stat-row">
        <span>Tiles visíveis</span>
        <strong>{props.visibleTiles}</strong>
      </div>
      <div className="stat-row">
        <span>Estruturas / Spawns / Regions</span>
        <strong>{props.structureCount} / {props.spawnCount} / {props.regionCount}</strong>
      </div>
      <div className="stat-row">
        <span>Tool / Layer</span>
        <strong>{props.activeTool} • {props.activeLayerName}</strong>
      </div>
      <div className="stat-row">
        <span>Clipboard</span>
        <strong>{props.tileClipboardLabel}</strong>
      </div>
      <div className="stat-row">
        <span>Seleção</span>
        <strong>{props.selectedLabel}</strong>
      </div>
      <div className="stat-row">
        <span>Undo / Redo</span>
        <strong>{props.undoCount} / {props.redoCount}</strong>
      </div>
      <div className="stat-row">
        <span>Hover</span>
        <strong>{formatHoveredTileLabel(props.hoveredTile, props.mapWidth, props.mapHeight)}</strong>
      </div>
    </div>
  );
}
