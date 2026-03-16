import type { KeyValueDelete } from './key-value-store.js';

export function buildPlayerProfileCacheKey(playerId: string): string {
  return `player:profile:${playerId}`;
}

export async function invalidatePlayerProfileCache(
  keyValueStore: KeyValueDelete | null | undefined,
  playerId: string | null | undefined,
): Promise<void> {
  if (!playerId || !keyValueStore?.delete) {
    return;
  }

  await keyValueStore.delete(buildPlayerProfileCacheKey(playerId));
}

export async function invalidatePlayerProfileCaches(
  keyValueStore: KeyValueDelete | null | undefined,
  playerIds: Iterable<string | null | undefined>,
): Promise<void> {
  if (!keyValueStore?.delete) {
    return;
  }

  const uniquePlayerIds = [...new Set([...playerIds].filter((playerId): playerId is string => Boolean(playerId)))];

  if (uniquePlayerIds.length === 0) {
    return;
  }

  await Promise.allSettled(
    uniquePlayerIds.map(async (playerId) => {
      await keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));
    }),
  );
}
