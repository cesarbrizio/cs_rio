import {
  configureSharedApiClient,
  type ApiMetricInput,
  type MarketAuctionBookFilters,
  type MarketOrderBookFilters,
} from '@cs-rio/domain/api';
import { viteEnv } from '@cs-rio/platform/desktop';

function recordDesktopApiMetric(input: ApiMetricInput): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const status = input.statusCode ?? 'ERR';
  const duration = Math.round(input.durationMs);
  const suffix = input.errorMessage ? ` · ${input.errorMessage}` : '';

  console.info(`[desktop api] ${input.method} ${input.path} → ${status} em ${duration}ms${suffix}`);
}

const apiClient = configureSharedApiClient({
  env: viteEnv,
  onApiMetric: recordDesktopApiMetric,
});

export const {
  api,
  authApi,
  bichoApi,
  bocaApi,
  contactApi,
  crimesApi,
  eventApi,
  factoryApi,
  factionApi,
  factionCrimeApi,
  formatApiError,
  frontStoreApi,
  hospitalApi,
  installApiObservabilityInterceptors,
  installAuthInterceptors,
  inventoryApi,
  marketApi,
  playerApi,
  privateMessageApi,
  prisonApi,
  propertyApi,
  puteiroApi,
  pvpApi,
  raveApi,
  roundApi,
  slotMachineApi,
  territoryApi,
  trainingApi,
  tribunalApi,
  universityApi,
} = apiClient;

export type { MarketAuctionBookFilters, MarketOrderBookFilters };
