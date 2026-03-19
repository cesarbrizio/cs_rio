import { useEditorStore } from '../state/editorStore';

function TileSwatch(props: { fill: string; stroke: string }) {
  return (
    <svg
      className="tile-swatch"
      viewBox="0 0 48 32"
      aria-hidden="true"
    >
      <polygon
        fill={props.fill}
        points="24,3 45,16 24,29 3,16"
        stroke={props.stroke}
        strokeWidth="2"
      />
    </svg>
  );
}

export function TilePalette() {
  const selectedGid = useEditorStore((state) => state.selectedGid);
  const tilePalette = useEditorStore((state) => state.tilePalette);
  const setSelectedGid = useEditorStore((state) => state.setSelectedGid);

  return (
    <section className="panel panel-palette">
      <div className="panel-section-head">
        <h2>Tile Palette</h2>
        <span>{tilePalette.length} tipos</span>
      </div>

      <div className="palette-grid">
        {tilePalette.map((tile) => (
          <button
            key={tile.gid}
            type="button"
            className={`palette-tile${selectedGid === tile.gid ? ' is-active' : ''}`}
            onClick={() => setSelectedGid(tile.gid)}
          >
            <TileSwatch fill={tile.fill} stroke={tile.stroke} />
            <strong>{tile.label}</strong>
            <span>GID {tile.gid}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
