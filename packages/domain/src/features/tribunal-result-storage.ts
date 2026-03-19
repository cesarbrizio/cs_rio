import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 80,
  readFailureMessage: 'falha ao ler cues de tribunal vistos; resetando cache local',
  scope: 'tribunal-result-storage',
  storagePrefix: 'cs_rio_seen_tribunal_cues:',
});

export function loadSeenTribunalCueKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenTribunalCue(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
