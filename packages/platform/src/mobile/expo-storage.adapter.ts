import * as SecureStore from 'expo-secure-store';

import type { StoragePort } from '../contracts/storage.port';

export const expoStorage: StoragePort = {
  async getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
};
