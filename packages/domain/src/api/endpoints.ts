import { buildCoreApiModules } from './endpoints-core';
import { buildFactionApiModules } from './endpoints-faction';
import { buildOperationsApiModules } from './endpoints-operations';
import type {
  ApiRequester,
  MarketAuctionBookFilters,
  MarketOrderBookFilters,
} from './endpoints-types';

export type { ApiRequester, MarketAuctionBookFilters, MarketOrderBookFilters };

export function createApiModules(requester: ApiRequester) {
  return {
    ...buildCoreApiModules(requester),
    ...buildFactionApiModules(requester),
    ...buildOperationsApiModules(requester),
  };
}

export type ApiModules = ReturnType<typeof createApiModules>;
