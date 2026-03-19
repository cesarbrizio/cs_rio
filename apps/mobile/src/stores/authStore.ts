import { createAuthStore } from '@cs-rio/domain/stores';
import { expoStorage } from '@cs-rio/platform/mobile/expo-storage';

import {
  authApi,
  formatApiError,
  installApiObservabilityInterceptors,
  installAuthInterceptors,
  playerApi,
} from '../services/api';

type AppStoreModule = {
  resetAppStoreForLogout: () => void;
};

export const useAuthStore = createAuthStore({
  authApi,
  formatApiError,
  installApiObservabilityInterceptors,
  installAuthInterceptors,
  onLogout: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resetAppStoreForLogout } = require('./appStore') as AppStoreModule;
    resetAppStoreForLogout();
  },
  playerApi,
  storage: expoStorage,
});
