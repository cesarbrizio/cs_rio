import {
  loadSeenWarResultKeys as loadSeenWarResultKeysFromDomain,
  rememberSeenWarResult as rememberSeenWarResultFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenWarResultKeys(playerId: string): Promise<Set<string>> {
  return loadSeenWarResultKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenWarResult(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenWarResultFromDomain(expoStorage, playerId, key);
}
