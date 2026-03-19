import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreMock = {
  deleteItemAsync: vi.fn(async () => undefined),
  getItemAsync: vi.fn(async (key: string) => `stored:${key}`),
  setItemAsync: vi.fn(async () => undefined),
};

vi.mock('expo-secure-store', () => secureStoreMock);

describe('expoStorage', () => {
  beforeEach(() => {
    secureStoreMock.deleteItemAsync.mockClear();
    secureStoreMock.getItemAsync.mockClear();
    secureStoreMock.setItemAsync.mockClear();
  });

  it('reads and writes through expo-secure-store', async () => {
    const { expoStorage } = await import('../src/mobile/expo-storage.adapter');

    await expect(expoStorage.getItem('token')).resolves.toBe('stored:token');
    await expoStorage.setItem('token', 'value');
    await expoStorage.removeItem('token');

    expect(secureStoreMock.getItemAsync).toHaveBeenCalledWith('token');
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith('token', 'value');
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith('token');
  });
});
