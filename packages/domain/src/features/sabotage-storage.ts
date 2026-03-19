import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 100,
  readFailureMessage: 'falha ao ler cues de sabotagem vistos; resetando cache local',
  scope: 'sabotage-storage',
  storagePrefix: 'cs_rio_seen_sabotage_cues:',
});

export function loadSeenSabotageCueKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenSabotageCue(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
