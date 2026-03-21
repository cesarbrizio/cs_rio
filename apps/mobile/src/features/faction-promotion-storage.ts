import {
  loadSeenFactionPromotionKeys as loadSeenFactionPromotionKeysFromDomain,
  rememberSeenFactionPromotion as rememberSeenFactionPromotionFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenFactionPromotionKeys(playerId: string): Promise<Set<string>> {
  return loadSeenFactionPromotionKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenFactionPromotion(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenFactionPromotionFromDomain(expoStorage, playerId, key);
}
