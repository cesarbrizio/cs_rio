import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray, warnStorageFallback } from './storage';

const MAX_STORED_KEYS = 80;
const STORAGE_PREFIX = 'cs_rio_seen_event_results:';

export async function loadSeenEventResultKeys(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch (error) {
    warnStorageFallback('event-result-storage', 'falha ao ler resultados de evento vistos; resetando cache local', error);
    return new Set();
  }
}

export async function rememberSeenEventResult(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  const current = await loadSeenEventResultKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
