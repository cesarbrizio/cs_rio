import { describe, expect, it } from 'vitest';

import { buildHudContextTarget } from '../src/features/hudContextActions';

describe('hud context actions', () => {
  it('maps player entities to social actions', () => {
    const target = buildHudContextTarget('player:session-1');

    expect(target.title).toBe('Jogador próximo');
    expect(target.actions.map((action) => action.id)).toEqual([
      'view_profile',
      'invite_squad',
      'send_message',
    ]);
  });

  it('maps black market entities to commerce actions', () => {
    const target = buildHudContextTarget('room_centro:black_market');

    expect(target.title).toBe('Mercado Negro');
    expect(target.actions[0]?.label).toBe('Comprar');
  });

  it('maps factory entities to production actions', () => {
    const target = buildHudContextTarget('zona_norte:fabrica-prototipo');

    expect(target.title).toBe('Fábrica');
    expect(target.actions.map((action) => action.id)).toEqual([
      'manage',
      'stock',
      'collect',
    ]);
  });
});
