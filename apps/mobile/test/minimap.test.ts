import { describe, expect, it } from 'vitest';

import { projectPointToMinimap } from '../src/features/minimap';

describe('minimap projection', () => {
  it('projects positions into the usable minimap bounds', () => {
    const point = projectPointToMinimap({
      mapHeight: 200,
      mapWidth: 200,
      padding: 10,
      surfaceHeight: 120,
      surfaceWidth: 120,
      x: 100,
      y: 50,
    });

    expect(point.left).toBeCloseTo(60.25, 2);
    expect(point.top).toBeCloseTo(35.13, 2);
  });

  it('clamps out-of-bounds positions to the minimap edge', () => {
    const point = projectPointToMinimap({
      mapHeight: 200,
      mapWidth: 200,
      padding: 10,
      surfaceHeight: 120,
      surfaceWidth: 120,
      x: 999,
      y: -20,
    });

    expect(point.left).toBe(110);
    expect(point.top).toBe(10);
  });
});
