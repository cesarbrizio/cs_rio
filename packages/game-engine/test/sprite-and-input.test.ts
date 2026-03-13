import { describe, expect, it } from 'vitest';

import { AnimationController, InputHandler, SpriteSheet } from '../src/index.js';

const asepriteLikeData = {
  frames: [
    { filename: 'idle_s_0', frame: { x: 0, y: 0, w: 48, h: 64 }, duration: 180 },
    { filename: 'walk_s_0', frame: { x: 48, y: 0, w: 48, h: 64 }, duration: 90 },
    { filename: 'walk_s_1', frame: { x: 96, y: 0, w: 48, h: 64 }, duration: 90 },
  ],
  meta: {
    frameTags: [
      { name: 'idle_s', from: 0, to: 0 },
      { name: 'walk_s', from: 1, to: 2 },
    ],
  },
};

describe('sprite sheet helpers', () => {
  it('parses frames and clips from aseprite data', () => {
    const sheet = SpriteSheet.fromAseprite(asepriteLikeData);

    expect(sheet.getFrame('walk_s_1')).toMatchObject({ x: 96, y: 0, width: 48, height: 64 });
    expect(sheet.getClip('walk_s')?.frameIds).toEqual(['walk_s_0', 'walk_s_1']);
  });

  it('advances animation using frame durations', () => {
    const sheet = SpriteSheet.fromAseprite(asepriteLikeData);
    const controller = new AnimationController(sheet, 'walk_s');

    expect(controller.getCurrentFrameId()).toBe('walk_s_0');
    expect(controller.update(95)).toBe('walk_s_1');
    expect(controller.update(95)).toBe('walk_s_0');
  });
});

describe('input handler', () => {
  it('ignores taps inside UI rects', () => {
    let didTap = false;
    const input = new InputHandler({
      cameraProvider: () => ({
        x: 0,
        y: 64,
        zoom: 1,
        viewportWidth: 320,
        viewportHeight: 240,
        mode: 'free',
      }),
      tileSize: { width: 128, height: 64 },
      uiRects: [{ x: 0, y: 0, width: 100, height: 40 }],
      callbacks: {
        onTap: () => {
          didTap = true;
        },
      },
    });

    expect(input.handleTap({ x: 40, y: 20 })).toBe(false);
    expect(didTap).toBe(false);
  });

  it('translates a valid tap into world tile coordinates', () => {
    let selectedTile = '';
    const input = new InputHandler({
      cameraProvider: () => ({
        x: 0,
        y: 64,
        zoom: 1,
        viewportWidth: 320,
        viewportHeight: 240,
        mode: 'free',
      }),
      tileSize: { width: 128, height: 64 },
      callbacks: {
        onTap: (point) => {
          selectedTile = `${point.x}:${point.y}`;
        },
      },
    });

    expect(input.handleTap({ x: 160, y: 112 })).toBe(true);
    expect(selectedTile).toBe('1:1');
  });
});
