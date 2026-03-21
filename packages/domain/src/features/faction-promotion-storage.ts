import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 20,
  readFailureMessage: 'falha ao ler promocoes de faccao vistas; resetando cache local',
  scope: 'faction-promotion-storage',
  storagePrefix: 'cs_rio_seen_faction_promotions:',
});

export function loadSeenFactionPromotionKeys(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenFactionPromotion(
  storage: StoragePort,
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, key);
}
