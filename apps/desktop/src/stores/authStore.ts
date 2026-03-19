import { createAuthStore } from '@cs-rio/domain/stores';
import { desktopStorage } from '@cs-rio/platform/desktop';

import {
  authApi,
  formatApiError,
  installApiObservabilityInterceptors,
  installAuthInterceptors,
  playerApi,
} from '../services/api';

export const useAuthStore = createAuthStore({
  authApi,
  formatApiError,
  installApiObservabilityInterceptors,
  installAuthInterceptors,
  playerApi,
  storage: desktopStorage,
});
