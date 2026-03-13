import {
  type InventoryItemType,
  type MarketAuctionSummary,
  type MarketOrderSummary,
  type PlayerInventoryItem,
} from '@cs-rio/shared';

export type MarketPanelTab = 'auction' | 'buy' | 'repair' | 'sell';
export type MarketItemTypeFilter = 'all' | InventoryItemType;

export function filterAuctionableInventoryItems(
  items: PlayerInventoryItem[],
  search: string,
  itemTypeFilter: MarketItemTypeFilter,
): PlayerInventoryItem[] {
  return items
    .filter((item) => item.itemType === 'weapon' || item.itemType === 'vest')
    .filter((item) => item.itemId && matchesInventoryItemType(item.itemType, itemTypeFilter))
    .filter((item) => !item.isEquipped && !item.stackable && (item.durability ?? 0) > 0)
    .filter((item) => matchesSearch(item.itemName, item.itemId, search))
    .sort((left, right) =>
      (left.itemName ?? left.itemId ?? '').localeCompare(right.itemName ?? right.itemId ?? '', 'pt-BR'),
    );
}

export function filterMarketAuctions(
  auctions: MarketAuctionSummary[],
  search: string,
  itemTypeFilter: MarketItemTypeFilter,
): MarketAuctionSummary[] {
  return auctions
    .filter((auction) => matchesInventoryItemType(auction.itemType, itemTypeFilter))
    .filter((auction) => matchesSearch(auction.itemName, auction.itemId, search))
    .sort((left, right) => left.endsAt.localeCompare(right.endsAt));
}

export function filterMarketOrders(
  orders: MarketOrderSummary[],
  search: string,
  itemTypeFilter: MarketItemTypeFilter,
): MarketOrderSummary[] {
  return orders
    .filter((order) => matchesInventoryItemType(order.itemType, itemTypeFilter))
    .filter((order) => matchesSearch(order.itemName, order.itemId, search))
    .sort((left, right) => left.pricePerUnit - right.pricePerUnit);
}

export function filterRepairableInventoryItems(
  items: PlayerInventoryItem[],
  search: string,
  itemTypeFilter: MarketItemTypeFilter,
): PlayerInventoryItem[] {
  return items
    .filter((item) => item.itemType === 'weapon' || item.itemType === 'vest')
    .filter((item) => matchesInventoryItemType(item.itemType, itemTypeFilter))
    .filter((item) => (item.maxDurability ?? 0) > 0 && (item.durability ?? 0) < (item.maxDurability ?? 0))
    .filter((item) => matchesSearch(item.itemName, item.itemId, search))
    .sort((left, right) => (left.durability ?? 0) - (right.durability ?? 0));
}

export function filterSellableInventoryItems(
  items: PlayerInventoryItem[],
  search: string,
  itemTypeFilter: MarketItemTypeFilter,
): PlayerInventoryItem[] {
  return items
    .filter((item) => item.itemId && matchesInventoryItemType(item.itemType, itemTypeFilter))
    .filter((item) => !item.isEquipped)
    .filter((item) => item.stackable || (item.durability ?? 0) > 0)
    .filter((item) => matchesSearch(item.itemName, item.itemId, search))
    .sort((left, right) =>
      (left.itemName ?? left.itemId ?? '').localeCompare(right.itemName ?? right.itemId ?? '', 'pt-BR'),
    );
}

export function formatAuctionCountdown(endsAt: string, nowMs: number): string {
  const remainingMs = new Date(endsAt).getTime() - nowMs;

  if (remainingMs <= 0) {
    return 'Encerrando';
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatMarketCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function resolveMarketTabLabel(tab: MarketPanelTab): string {
  if (tab === 'auction') {
    return 'Leilão';
  }

  if (tab === 'buy') {
    return 'Comprar';
  }

  if (tab === 'sell') {
    return 'Vender';
  }

  return 'Reparar';
}

export function sanitizeOrderPrice(value: string, fallback = 0): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}

export function sanitizeOrderQuantity(
  value: string,
  maxQuantity: number,
  fallback = 1,
): number {
  const parsed = Number.parseInt(value.trim(), 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, Math.max(1, maxQuantity));
}

function matchesInventoryItemType(
  itemType: InventoryItemType,
  itemTypeFilter: MarketItemTypeFilter,
): boolean {
  return itemTypeFilter === 'all' ? true : itemType === itemTypeFilter;
}

function matchesSearch(itemName: string | null, itemId: string | null, search: string): boolean {
  if (!search.trim()) {
    return true;
  }

  const normalizedSearch = search.trim().toLowerCase();
  return `${itemName ?? ''} ${itemId ?? ''}`.toLowerCase().includes(normalizedSearch);
}
