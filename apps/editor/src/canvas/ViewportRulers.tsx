import { useMemo } from 'react';

import { useEditorStore } from '../state/editorStore';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildTicks(min: number, max: number, limit: number) {
  const tickCount = 5;

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    const value = Math.round(min + (max - min) * ratio);

    return {
      label: clamp(value, 0, Math.max(limit - 1, 0)),
      ratio,
    };
  });
}

export function ViewportRulers() {
  const map = useEditorStore((state) => state.map);
  const hoveredTile = useEditorStore((state) => state.hoveredTile);
  const visibleBounds = useEditorStore((state) => state.renderPlan.visibleBounds);
  const xTicks = useMemo(
    () => buildTicks(visibleBounds.minX, visibleBounds.maxX, map.width),
    [map.width, visibleBounds.maxX, visibleBounds.minX],
  );
  const yTicks = useMemo(
    () => buildTicks(visibleBounds.minY, visibleBounds.maxY, map.height),
    [map.height, visibleBounds.maxY, visibleBounds.minY],
  );

  return (
    <>
      <div className="viewport-corner">
        <strong>XY</strong>
        <span>{hoveredTile ? `${hoveredTile.x},${hoveredTile.y}` : 'sem hover'}</span>
      </div>

      <div className="viewport-ruler viewport-ruler-top">
        {xTicks.map((tick) => (
          <span
            key={`x-${tick.ratio}-${tick.label}`}
            className="viewport-ruler-tick"
            style={{ left: `${tick.ratio * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <div className="viewport-ruler viewport-ruler-left">
        {yTicks.map((tick) => (
          <span
            key={`y-${tick.ratio}-${tick.label}`}
            className="viewport-ruler-tick"
            style={{ top: `${tick.ratio * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </>
  );
}
