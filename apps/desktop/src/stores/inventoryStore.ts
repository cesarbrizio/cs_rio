import { createInventoryStore } from '@cs-rio/domain/stores';

import { formatApiError, inventoryApi } from '../services/api';
import { useAuthStore } from './authStore';

export const useInventoryStore = createInventoryStore({
  authStore: useAuthStore,
  formatApiError,
  inventoryApi,
});
