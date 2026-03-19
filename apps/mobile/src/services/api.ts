import {
  configureSharedApiClient,
  type MarketAuctionBookFilters,
  type MarketOrderBookFilters,
} from '@cs-rio/domain/api';

import { appEnv } from '../config/env';
import { recordApiMetric } from '../features/mobile-observability';

const apiClient = configureSharedApiClient({
  env: appEnv,
  onApiMetric: recordApiMetric,
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
