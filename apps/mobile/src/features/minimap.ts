export interface MinimapProjectionInput {
  mapHeight: number;
  mapWidth: number;
  padding: number;
  surfaceHeight: number;
  surfaceWidth: number;
  x: number;
  y: number;
}

export interface MinimapProjectedPoint {
  left: number;
  top: number;
}

export function projectPointToMinimap(input: MinimapProjectionInput): MinimapProjectedPoint {
  const usableWidth = Math.max(input.surfaceWidth - input.padding * 2, 1);
  const usableHeight = Math.max(input.surfaceHeight - input.padding * 2, 1);
  const widthRatio = clamp(input.x / Math.max(input.mapWidth - 1, 1), 0, 1);
  const heightRatio = clamp(input.y / Math.max(input.mapHeight - 1, 1), 0, 1);

  return {
    left: input.padding + usableWidth * widthRatio,
    top: input.padding + usableHeight * heightRatio,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
