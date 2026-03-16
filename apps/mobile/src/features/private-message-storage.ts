import * as SecureStore from 'expo-secure-store';

import { parseStoredStringArray } from './storage';

const MAX_STORED_KEYS = 120;
const STORAGE_PREFIX = 'cs_rio_seen_private_messages:';

export async function loadSeenPrivateMessageIds(playerId: string): Promise<Set<string>> {
  try {
    return new Set(
      parseStoredStringArray(await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`)),
    );
  } catch {
    return new Set();
  }
}

export async function rememberSeenPrivateMessage(
  playerId: string,
  messageId: string,
): Promise<Set<string>> {
  const current = await loadSeenPrivateMessageIds(playerId);
  current.add(messageId);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
