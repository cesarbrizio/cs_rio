import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray, warnStorageFallback } from './storage';

const MAX_STORED_KEYS = 60;
const STORAGE_PREFIX = 'cs_rio_seen_war_results:';

export async function loadSeenWarResultKeys(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch (error) {
    warnStorageFallback('war-result-storage', 'falha ao ler resultados de guerra vistos; resetando cache local', error);
    return new Set();
  }
}

export async function rememberSeenWarResult(playerId: string, key: string): Promise<Set<string>> {
  const current = await loadSeenWarResultKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
