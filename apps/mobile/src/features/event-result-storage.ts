import {
  loadSeenEventResultKeys as loadSeenEventResultKeysFromDomain,
  rememberSeenEventResult as rememberSeenEventResultFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenEventResultKeys(playerId: string): Promise<Set<string>> {
  return loadSeenEventResultKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenEventResult(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenEventResultFromDomain(expoStorage, playerId, key);
}
