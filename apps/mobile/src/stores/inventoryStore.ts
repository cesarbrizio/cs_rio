import {
  type DrugConsumeResponse,
  type InventoryListResponse,
  type InventoryRepairResponse,
  type PlayerProfile,
} from '@cs-rio/shared';
import { create } from 'zustand';

import { formatApiError, inventoryApi } from '../services/api';
import { useAuthStore } from './authStore';

interface InventoryStore {
  consumeDrugInventoryItem: (inventoryItemId: string) => Promise<DrugConsumeResponse>;
  equipInventoryItem: (inventoryItemId: string) => Promise<InventoryListResponse>;
  repairInventoryItem: (inventoryItemId: string) => Promise<InventoryRepairResponse>;
  unequipInventoryItem: (inventoryItemId: string) => Promise<InventoryListResponse>;
}

export const useInventoryStore = create<InventoryStore>(() => ({
  async consumeDrugInventoryItem(inventoryItemId) {
    useAuthStore.setState({ isLoading: true });

    try {
      const response = await inventoryApi.consume(inventoryItemId);
      useAuthStore.setState({
        isLoading: false,
        player: response.player,
      });

      return response;
    } catch (error) {
      useAuthStore.setState({ isLoading: false });
      throw formatApiError(error);
    }
  },
  async equipInventoryItem(inventoryItemId) {
    useAuthStore.setState({ isLoading: true });

    try {
      const response = await inventoryApi.equip(inventoryItemId);
      useAuthStore.setState((state) => ({
        isLoading: false,
        player: applyInventoryItemsToPlayer(state.player, response.items),
      }));

      return response;
    } catch (error) {
      useAuthStore.setState({ isLoading: false });
      throw formatApiError(error);
    }
  },
  async repairInventoryItem(inventoryItemId) {
    useAuthStore.setState({ isLoading: true });

    try {
      const response = await inventoryApi.repair(inventoryItemId);
      useAuthStore.setState((state) => ({
        isLoading: false,
        player: applyRepairToPlayer(state.player, response),
      }));

      return response;
    } catch (error) {
      useAuthStore.setState({ isLoading: false });
      throw formatApiError(error);
    }
  },
  async unequipInventoryItem(inventoryItemId) {
    useAuthStore.setState({ isLoading: true });

    try {
      const response = await inventoryApi.unequip(inventoryItemId);
      useAuthStore.setState((state) => ({
        isLoading: false,
        player: applyInventoryItemsToPlayer(state.player, response.items),
      }));

      return response;
    } catch (error) {
      useAuthStore.setState({ isLoading: false });
      throw formatApiError(error);
    }
  },
}));

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
