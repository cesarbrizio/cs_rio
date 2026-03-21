import type { InventoryItemType } from '@cs-rio/shared';
import type { AxiosRequestConfig } from 'axios';

export interface MarketOrderBookFilters {
  itemId?: string;
  itemType?: InventoryItemType;
}

export interface MarketAuctionBookFilters {
  itemId?: string;
  itemType?: 'vest' | 'weapon';
}

export interface ApiRequester {
  del: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  get: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  patch: <TResponse, TBody>(
    url: string,
    data: TBody,
    config?: AxiosRequestConfig<TBody>,
  ) => Promise<TResponse>;
  post: <TResponse, TBody>(
    url: string,
    data: TBody,
    config?: AxiosRequestConfig<TBody>,
  ) => Promise<TResponse>;
  postEmpty: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
}
