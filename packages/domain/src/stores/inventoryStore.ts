import type { DrugConsumeResponse, InventoryListResponse, InventoryRepairResponse, PlayerProfile } from '@cs-rio/shared';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

import type { AuthStoreState } from './authStore';

export interface InventoryStoreState {
  consumeDrugInventoryItem: (inventoryItemId: string) => Promise<DrugConsumeResponse>;
  equipInventoryItem: (inventoryItemId: string) => Promise<InventoryListResponse>;
  repairInventoryItem: (inventoryItemId: string) => Promise<InventoryRepairResponse>;
  unequipInventoryItem: (inventoryItemId: string) => Promise<InventoryListResponse>;
}

interface InventoryStoreDependencies {
  authStore: Pick<UseBoundStore<StoreApi<AuthStoreState>>, 'setState'>;
  formatApiError: (error: unknown) => Error;
  inventoryApi: {
    consume: (inventoryItemId: string) => Promise<DrugConsumeResponse>;
    equip: (inventoryItemId: string) => Promise<InventoryListResponse>;
    repair: (inventoryItemId: string) => Promise<InventoryRepairResponse>;
    unequip: (inventoryItemId: string) => Promise<InventoryListResponse>;
  };
}

export function createInventoryStore(dependencies: InventoryStoreDependencies) {
  return create<InventoryStoreState>(() => ({
    async consumeDrugInventoryItem(inventoryItemId) {
      dependencies.authStore.setState({ isLoading: true });

      try {
        const response = await dependencies.inventoryApi.consume(inventoryItemId);
        dependencies.authStore.setState({
          isLoading: false,
          player: response.player,
        });

        return response;
      } catch (error) {
        dependencies.authStore.setState({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    async equipInventoryItem(inventoryItemId) {
      dependencies.authStore.setState({ isLoading: true });

      try {
        const response = await dependencies.inventoryApi.equip(inventoryItemId);
        dependencies.authStore.setState((state) => ({
          isLoading: false,
          player: applyInventoryItemsToPlayer(state.player, response.items),
        }));

        return response;
      } catch (error) {
        dependencies.authStore.setState({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    async repairInventoryItem(inventoryItemId) {
      dependencies.authStore.setState({ isLoading: true });

      try {
        const response = await dependencies.inventoryApi.repair(inventoryItemId);
        dependencies.authStore.setState((state) => ({
          isLoading: false,
          player: applyRepairToPlayer(state.player, response),
        }));

        return response;
      } catch (error) {
        dependencies.authStore.setState({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    async unequipInventoryItem(inventoryItemId) {
      dependencies.authStore.setState({ isLoading: true });

      try {
        const response = await dependencies.inventoryApi.unequip(inventoryItemId);
        dependencies.authStore.setState((state) => ({
          isLoading: false,
          player: applyInventoryItemsToPlayer(state.player, response.items),
        }));

        return response;
      } catch (error) {
        dependencies.authStore.setState({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
  }));
}

function applyInventoryItemsToPlayer(
  player: PlayerProfile | null,
  items: PlayerProfile['inventory'],
): PlayerProfile | null {
  if (!player) {
    return player;
  }

  return {
    ...player,
    inventory: items,
  };
}

function applyRepairToPlayer(
  player: PlayerProfile | null,
  response: InventoryRepairResponse,
): PlayerProfile | null {
  if (!player) {
    return player;
  }

  return {
    ...player,
    inventory: response.items,
    resources: {
      ...player.resources,
      money: Math.max(0, player.resources.money - response.repairCost),
    },
  };
}
