import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 60,
  readFailureMessage: 'falha ao ler resultados de guerra vistos; resetando cache local',
  scope: 'war-result-storage',
  storagePrefix: 'cs_rio_seen_war_results:',
});

export function loadSeenWarResultKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenWarResult(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
