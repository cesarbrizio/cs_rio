import { describe, expect, it } from 'vitest';

import { Camera, cartToIso, findPath, isoToCart, MovementController, TilemapRenderer, parseTilemap, screenToTile } from '../src/index.js';

describe('isometric helpers', () => {
  it('converts cartesian coordinates to isometric space', () => {
    expect(cartToIso({ x: 2, y: 1 })).toEqual({ x: 64, y: 96 });
  });

  it('converts back from isometric coordinates', () => {
    const cartPoint = isoToCart({ x: 64, y: 96 });

    expect(cartPoint.x).toBe(2);
    expect(cartPoint.y).toBe(1);
  });

  it('keeps camera pan inside bounds', () => {
    const camera = new Camera(
      { x: 100, y: 100, zoom: 1, viewportWidth: 200, viewportHeight: 200, mode: 'free' },
      { minX: 0, minY: 0, maxX: 300, maxY: 300 },
    );

    expect(camera.panTo({ x: 500, y: -20 })).toEqual({
      x: 200,
      y: 100,
      zoom: 1,
      viewportWidth: 200,
      viewportHeight: 200,
      mode: 'free',
    });
  });

  it('converts a screen tap back into a tile coordinate through the camera', () => {
    const camera = new Camera({ x: 0, y: 64, zoom: 1, viewportWidth: 320, viewportHeight: 240, mode: 'free' });

    expect(screenToTile({ x: 160, y: 112 }, camera.getState())).toEqual({ x: 1, y: 1 });
  });

  it('applies inertia to the free camera pan', () => {
    const camera = new Camera({
      x: 0,
      y: 64,
      zoom: 1,
      viewportWidth: 320,
      viewportHeight: 240,
      mode: 'free',
    });

    const velocity = camera.applyInertia({ x: 120, y: 0 }, 16);

    expect(velocity.x).toBeLessThan(120);
    expect(camera.getState().x).toBeLessThan(0);
  });
});

describe('tilemap parsing and rendering', () => {
  const rawMap = {
    width: 4,
    height: 4,
    tilewidth: 128,
    tileheight: 64,
    orientation: 'isometric',
    tilesets: [
      {
        firstgid: 1,
        name: 'city',
        tilecount: 4,
        columns: 2,
        tilewidth: 128,
        tileheight: 64,
        tiles: [
          { id: 0, properties: [{ name: 'color', value: '#335c67' }] },
          { id: 1, properties: [{ name: 'color', value: '#9e2a2b' }] },
        ],
      },
    ],
    layers: [
      {
        id: 1,
        name: 'terrain',
        type: 'tilelayer',
        width: 4,
        height: 4,
        data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        id: 2,
        name: 'collision',
        type: 'tilelayer',
        width: 4,
        height: 4,
        data: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        id: 3,
        name: 'structures',
        type: 'objectgroup',
        objects: [
          {
            id: 20,
            name: 'mercado-central',
            type: 'mercado-negro',
            x: 128,
            y: 64,
            width: 384,
            height: 128,
            properties: [
              { name: 'kind', value: 'mercado-negro' },
              { name: 'footprintW', value: 3 },
              { name: 'footprintH', value: 2 },
              { name: 'interactiveEntityId', value: 'mercado-negro' },
            ],
          },
        ],
      },
    ],
  };

  it('extracts collision data from a tiled map', () => {
    const map = parseTilemap(rawMap);

    expect(map.collisionSet.has('1:1')).toBe(true);
    expect(map.layers[0]?.tiles).toHaveLength(16);
  });

  it('builds a culled render plan', () => {
    const map = parseTilemap(rawMap);
    const renderer = new TilemapRenderer({ width: 128, height: 64 });
    const plan = renderer.buildRenderPlan(map, {
      x: 0,
      y: 128,
      zoom: 1,
      viewportWidth: 320,
      viewportHeight: 240,
      mode: 'free',
    });

    expect(plan.ground.length).toBeGreaterThan(0);
    expect(plan.ground.every((tile) => tile.fill.length > 0)).toBe(true);
  });

  it('extracts structures from tiled object layers', () => {
    const map = parseTilemap(rawMap);

    expect(map.structures).toEqual([
      {
        footprint: { w: 3, h: 2 },
        gridX: 1,
        gridY: 1,
        height: 128,
        id: 'mercado-central',
        interactiveEntityId: 'mercado-negro',
        kind: 'mercado-negro',
        label: undefined,
        name: 'mercado-central',
        objectId: 20,
        properties: {
          footprintH: 2,
          footprintW: 3,
          interactiveEntityId: 'mercado-negro',
          kind: 'mercado-negro',
        },
        type: 'mercado-negro',
        width: 384,
        x: 128,
        y: 64,
      },
    ]);
  });
});

describe('pathfinding and movement', () => {
  it('avoids blocked tiles while computing a path', () => {
    const path = findPath(
      { x: 0, y: 0 },
      { x: 3, y: 3 },
      [{ x: 1, y: 1, walkable: false }],
    );

    expect(path.length).toBeGreaterThan(0);
    expect(path.some((node) => node.x === 1 && node.y === 1)).toBe(false);
  });

  it('moves the player along the queued path', () => {
    const controller = new MovementController({ x: 0, y: 0 }, 4);
    controller.setPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);

    const state = controller.update(250);

    expect(state.isMoving).toBe(true);
    expect(state.position.x).toBeGreaterThan(0);
  });
});
