import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray, warnStorageFallback } from './storage';

const MAX_STORED_KEYS = 100;
const STORAGE_PREFIX = 'cs_rio_seen_sabotage_cues:';

export async function loadSeenSabotageCueKeys(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch (error) {
    warnStorageFallback('sabotage-storage', 'falha ao ler cues de sabotagem vistos; resetando cache local', error);
    return new Set();
  }
}

export async function rememberSeenSabotageCue(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  const current = await loadSeenSabotageCueKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
