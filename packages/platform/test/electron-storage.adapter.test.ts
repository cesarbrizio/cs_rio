import { beforeEach, describe, expect, it, vi } from 'vitest';

import { desktopStorage } from '../src/desktop/electron-storage.adapter';

declare global {
  interface Window {
    electronAPI?: {
      storage: {
        getItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
      };
    };
  }
}

describe('desktopStorage', () => {
  beforeEach(() => {
    globalThis.window = {
      electronAPI: {
        storage: {
          getItem: vi.fn(async (key: string) => `value:${key}`),
          removeItem: vi.fn(async () => undefined),
          setItem: vi.fn(async () => undefined),
        },
      },
    } as unknown as Window & typeof globalThis;
  });

  it('delegates getItem to the electron bridge', async () => {
    await expect(desktopStorage.getItem('token')).resolves.toBe('value:token');
    expect(window.electronAPI?.storage.getItem).toHaveBeenCalledWith('token');
  });

  it('delegates setItem and removeItem to the electron bridge', async () => {
    await desktopStorage.setItem('token', 'abc');
    await desktopStorage.removeItem('token');

    expect(window.electronAPI?.storage.setItem).toHaveBeenCalledWith('token', 'abc');
    expect(window.electronAPI?.storage.removeItem).toHaveBeenCalledWith('token');
  });
});
