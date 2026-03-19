import {
  loadSeenPrivateMessageIds as loadSeenPrivateMessageIdsFromDomain,
  rememberSeenPrivateMessage as rememberSeenPrivateMessageFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenPrivateMessageIds(playerId: string): Promise<Set<string>> {
  return loadSeenPrivateMessageIdsFromDomain(expoStorage, playerId);
}

export function rememberSeenPrivateMessage(
  playerId: string,
  messageId: string,
): Promise<Set<string>> {
  return rememberSeenPrivateMessageFromDomain(expoStorage, playerId, messageId);
}
