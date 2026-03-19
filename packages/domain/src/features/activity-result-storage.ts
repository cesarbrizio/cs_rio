import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 80,
  readFailureMessage: 'falha ao ler resultados de atividade vistos; resetando cache local',
  scope: 'activity-result-storage',
  storagePrefix: 'cs_rio_seen_activity_results:',
});

export function loadSeenActivityResultKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenActivityResult(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
