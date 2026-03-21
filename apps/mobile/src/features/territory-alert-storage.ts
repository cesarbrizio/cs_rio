import {
  loadSeenTerritoryAlertKeys as loadSeenTerritoryAlertKeysFromDomain,
  rememberSeenTerritoryAlert as rememberSeenTerritoryAlertFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenTerritoryAlertKeys(playerId: string): Promise<Set<string>> {
  return loadSeenTerritoryAlertKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenTerritoryAlert(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenTerritoryAlertFromDomain(expoStorage, playerId, key);
}
