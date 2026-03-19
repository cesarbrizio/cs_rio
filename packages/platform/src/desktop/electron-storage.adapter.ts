import type { StoragePort } from '../contracts/storage.port';

function resolveStorageBridge(): NonNullable<NonNullable<Window['electronAPI']>['storage']> {
  if (!window.electronAPI?.storage) {
    throw new Error('Electron storage bridge indisponivel.');
  }

  return window.electronAPI.storage;
}

export const desktopStorage: StoragePort = {
  async getItem(key) {
    const storageBridge = resolveStorageBridge();
    return storageBridge.getItem(key);
  },
  async removeItem(key) {
    const storageBridge = resolveStorageBridge();
    await storageBridge.removeItem(key);
  },
  async setItem(key, value) {
    const storageBridge = resolveStorageBridge();
    await storageBridge.setItem(key, value);
  },
};
