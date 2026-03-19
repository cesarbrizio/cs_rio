import {
  loadSeenSabotageCueKeys as loadSeenSabotageCueKeysFromDomain,
  rememberSeenSabotageCue as rememberSeenSabotageCueFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenSabotageCueKeys(playerId: string): Promise<Set<string>> {
  return loadSeenSabotageCueKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenSabotageCue(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenSabotageCueFromDomain(expoStorage, playerId, key);
}
