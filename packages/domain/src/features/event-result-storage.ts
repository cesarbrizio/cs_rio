import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 80,
  readFailureMessage: 'falha ao ler resultados de evento vistos; resetando cache local',
  scope: 'event-result-storage',
  storagePrefix: 'cs_rio_seen_event_results:',
});

export function loadSeenEventResultKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenEventResult(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
