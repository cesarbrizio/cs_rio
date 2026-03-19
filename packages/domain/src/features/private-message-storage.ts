import type { StoragePort } from '@cs-rio/platform';

import { createSeenKeyStorage } from './seen-key-storage';

const storageHelper = createSeenKeyStorage({
  maxStoredKeys: 120,
  readFailureMessage: 'falha ao ler mensagens privadas vistas; resetando cache local',
  scope: 'private-message-storage',
  storagePrefix: 'cs_rio_seen_private_messages:',
});

export function loadSeenPrivateMessageIds(
  storage: StoragePort,
  playerId: string,
): Promise<Set<string>> {
  return storageHelper.loadSeenKeys(storage, playerId);
}

export function rememberSeenPrivateMessage(
  storage: StoragePort,
  playerId: string,
  messageId: string,
): Promise<Set<string>> {
  return storageHelper.rememberSeenKey(storage, playerId, messageId);
}
