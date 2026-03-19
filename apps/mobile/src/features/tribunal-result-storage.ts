import {
  loadSeenTribunalCueKeys as loadSeenTribunalCueKeysFromDomain,
  rememberSeenTribunalCue as rememberSeenTribunalCueFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenTribunalCueKeys(playerId: string): Promise<Set<string>> {
  return loadSeenTribunalCueKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenTribunalCue(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenTribunalCueFromDomain(expoStorage, playerId, key);
}
