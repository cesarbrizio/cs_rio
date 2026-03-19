import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSeenKeyStorage } from '../src/features/seen-key-storage';

const storageState = new Map<string, string>();

const storage = {
  getItem: vi.fn(async (key: string) => storageState.get(key) ?? null),
  removeItem: vi.fn(async (key: string) => {
    storageState.delete(key);
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    storageState.set(key, value);
  }),
};

const helper = createSeenKeyStorage({
  maxStoredKeys: 2,
  readFailureMessage: 'falha ao ler itens vistos; resetando cache local',
  scope: 'seen-key-storage-test',
  storagePrefix: 'test:',
});

describe('createSeenKeyStorage', () => {
  beforeEach(() => {
    storageState.clear();
    storage.getItem.mockClear();
    storage.removeItem.mockClear();
    storage.setItem.mockClear();
  });

  it('falls back to an empty set when persisted data is invalid', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storageState.set('test:player-1', '{invalid-json');

    const result = await helper.loadSeenKeys(storage, 'player-1');

    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[storage] parseStoredStringArray: falha ao interpretar JSON persistido; usando array vazio.',
      ),
    );

    warnSpy.mockRestore();
  });

  it('keeps only the most recent keys within the configured cap', async () => {
    await helper.rememberSeenKey(storage, 'player-1', 'a');
    await helper.rememberSeenKey(storage, 'player-1', 'b');
    const result = await helper.rememberSeenKey(storage, 'player-1', 'c');

    expect([...result]).toEqual(['b', 'c']);
  });
});
