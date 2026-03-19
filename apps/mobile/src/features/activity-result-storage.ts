import {
  loadSeenActivityResultKeys as loadSeenActivityResultKeysFromDomain,
  rememberSeenActivityResult as rememberSeenActivityResultFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenActivityResultKeys(playerId: string): Promise<Set<string>> {
  return loadSeenActivityResultKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenActivityResult(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenActivityResultFromDomain(expoStorage, playerId, key);
}
