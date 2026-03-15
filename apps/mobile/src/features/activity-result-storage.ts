import * as SecureStore from 'expo-secure-store';

const MAX_STORED_KEYS = 80;
const STORAGE_PREFIX = 'cs_rio_seen_activity_results:';

export async function loadSeenActivityResultKeys(playerId: string): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(`${STORAGE_PREFIX}${playerId}`);

    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

export async function rememberSeenActivityResult(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  const current = await loadSeenActivityResultKeys(playerId);
  current.add(key);
  const trimmed = [...current].slice(-MAX_STORED_KEYS);
  await SecureStore.setItemAsync(`${STORAGE_PREFIX}${playerId}`, JSON.stringify(trimmed));
  return new Set(trimmed);
}
