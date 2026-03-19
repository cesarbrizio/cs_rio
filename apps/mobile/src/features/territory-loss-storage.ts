import {
  loadSeenTerritoryLossKeys as loadSeenTerritoryLossKeysFromDomain,
  rememberSeenTerritoryLoss as rememberSeenTerritoryLossFromDomain,
} from '@cs-rio/domain/features';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

export function loadSeenTerritoryLossKeys(playerId: string): Promise<Set<string>> {
  return loadSeenTerritoryLossKeysFromDomain(expoStorage, playerId);
}

export function rememberSeenTerritoryLoss(
  playerId: string,
  key: string,
): Promise<Set<string>> {
  return rememberSeenTerritoryLossFromDomain(expoStorage, playerId, key);
}
