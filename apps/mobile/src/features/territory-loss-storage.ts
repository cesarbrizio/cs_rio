import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray, warnStorageFallback } from './storage';

const MAX_STORED_KEYS = 80;
const STORAGE_PREFIX = 'cs_rio_seen_territory_losses:';

export async function loadSeenTerritoryLossKeys(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch (error) {
    warnStorageFallback('territory-loss-storage', 'falha ao ler perdas territoriais vistas; resetando cache local', error);
    return new Set();
  }
}

export async function rememberSeenTerritoryLoss(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  const current = await loadSeenTerritoryLossKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
