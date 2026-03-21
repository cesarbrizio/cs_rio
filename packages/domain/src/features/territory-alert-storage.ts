import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 80,
  readFailureMessage: 'falha ao ler alertas territoriais vistos; resetando cache local',
  scope: 'territory-alert-storage',
  storagePrefix: 'cs_rio_seen_territory_alerts:',
});

export function loadSeenTerritoryAlertKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenTerritoryAlert(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
