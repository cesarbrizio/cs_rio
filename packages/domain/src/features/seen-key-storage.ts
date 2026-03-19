import type { StoragePort } from '@cs-rio/platform';

import { parseStoredStringArray, warnStorageFallback } from './storage';

interface SeenKeyStorageOptions {
  maxStoredKeys: number;
  readFailureMessage: string;
  scope: string;
  storagePrefix: string;
}

export function createSeenKeyStorage(options: SeenKeyStorageOptions) {
  return {
    async loadSeenKeys(storage: StoragePort, playerId: string): Promise<Set<string>> {
      try {
        return new Set(
          parseStoredStringArray(
            await storage.getItem(`${options.storagePrefix}${playerId}`),
          ),
        );
      } catch (error) {
        warnStorageFallback(
          options.scope,
          options.readFailureMessage,
          error,
        );
        return new Set();
      }
    },
    async rememberSeenKey(
      storage: StoragePort,
      playerId: string,
      key: string,
    ): Promise<Set<string>> {
      const current = await this.loadSeenKeys(storage, playerId);
      current.add(key);
      const trimmed = [...current].slice(-options.maxStoredKeys);
      await storage.setItem(`${options.storagePrefix}${playerId}`, JSON.stringify(trimmed));
      return new Set(trimmed);
    },
  };
}
