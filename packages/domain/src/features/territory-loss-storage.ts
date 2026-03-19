import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 80,
  readFailureMessage: 'falha ao ler perdas territoriais vistas; resetando cache local',
  scope: 'territory-loss-storage',
  storagePrefix: 'cs_rio_seen_territory_losses:',
});

export function loadSeenTerritoryLossKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenTerritoryLoss(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
