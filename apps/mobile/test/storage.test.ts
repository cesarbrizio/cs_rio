import { beforeEach, describe, expect, it, vi } from 'vitest';

const { secureStoreApi, secureStoreState } = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    secureStoreApi: {
      getItemAsync: vi.fn(async (key: string) => state.get(key) ?? null),
      setItemAsync: vi.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
    },
    secureStoreState: state,
  };
});

vi.mock('expo-secure-store', () => secureStoreApi);

import { loadSeenEventResultKeys } from '../src/features/event-result-storage';
import { parseStoredStringArray } from '../src/features/storage';

describe('storage helpers', () => {
  beforeEach(() => {
    secureStoreState.clear();
    secureStoreApi.getItemAsync.mockClear();
    secureStoreApi.setItemAsync.mockClear();
  });

  it('warns and falls back to an empty array when persisted JSON is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseStoredStringArray('{invalid-json')).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storage] parseStoredStringArray: falha ao interpretar JSON persistido; usando array vazio.'),
    );

    warnSpy.mockRestore();
  });

  it('warns and resets the seen-key cache when SecureStore read fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    secureStoreApi.getItemAsync.mockRejectedValueOnce(new Error('secure-store-offline'));

    const result = await loadSeenEventResultKeys('player-1');

    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storage] event-result-storage: falha ao ler resultados de evento vistos; resetando cache local.'),
    );

    warnSpy.mockRestore();
  });
});
