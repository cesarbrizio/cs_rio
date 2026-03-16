import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray } from './storage';

const MAX_STORED_KEYS = 80;
const STORAGE_PREFIX = 'cs_rio_seen_tribunal_cues:';

export async function loadSeenTribunalCueKeys(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch {
    return new Set();
  }
}

export async function rememberSeenTribunalCue(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  const current = await loadSeenTribunalCueKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
