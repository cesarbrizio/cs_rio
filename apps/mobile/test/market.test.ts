import { type PlayerInventoryItem } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import {
  filterMarketOrders,
  filterRepairableInventoryItems,
  filterSellableInventoryItems,
  formatMarketCurrency,
  sanitizeOrderPrice,
  sanitizeOrderQuantity,
} from '../src/features/market';

describe('market helpers', () => {
  it('filters sell orders by search and item type', () => {
    const filtered = filterMarketOrders(
      [
        {
          createdAt: '2026-03-10T12:00:00.000Z',
          expiresAt: '2026-03-11T12:00:00.000Z',
          id: 'order-1',
          itemId: 'weapon-1',
          itemName: 'Pistola de treino',
          itemType: 'weapon',
          playerId: 'seller-1',
          pricePerUnit: 950,
          quantity: 1,
          remainingQuantity: 1,
          side: 'sell',
          status: 'open',
        },
        {
          createdAt: '2026-03-10T12:00:00.000Z',
          expiresAt: '2026-03-11T12:00:00.000Z',
          id: 'order-2',
          itemId: 'drug-1',
          itemName: 'Maconha',
          itemType: 'drug',
          playerId: 'seller-2',
          pricePerUnit: 120,
          quantity: 4,
          remainingQuantity: 4,
          side: 'sell',
          status: 'open',
        },
      ],
      'pistola',
      'weapon',
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('order-1');
  });

  it('separates sellable and repairable inventory items', () => {
    const items: PlayerInventoryItem[] = [
      {
        durability: 40,
        equipSlot: null,
        id: 'inventory-1',
        isEquipped: false,
        itemId: 'weapon-1',
        itemName: 'Pistola de treino',
        itemType: 'weapon',
        levelRequired: 2,
        maxDurability: 120,
        proficiency: 18,
        quantity: 1,
        stackable: false,
        totalWeight: 3,
        unitWeight: 3,
      },
      {
        durability: 0,
        equipSlot: null,
        id: 'inventory-2',
        isEquipped: false,
        itemId: 'vest-1',
        itemName: 'Colete usado',
        itemType: 'vest',
        levelRequired: 2,
        maxDurability: 100,
        proficiency: 0,
        quantity: 1,
        stackable: false,
        totalWeight: 4,
        unitWeight: 4,
      },
      {
        durability: null,
        equipSlot: null,
        id: 'inventory-3',
        isEquipped: false,
        itemId: 'drug-1',
        itemName: 'Maconha',
        itemType: 'drug',
        levelRequired: 1,
        maxDurability: null,
        proficiency: 0,
        quantity: 3,
        stackable: true,
        totalWeight: 3,
        unitWeight: 1,
      },
    ];

    expect(filterSellableInventoryItems(items, '', 'all').map((item) => item.id)).toEqual([
      'inventory-3',
      'inventory-1',
    ]);
    expect(filterRepairableInventoryItems(items, '', 'all').map((item) => item.id)).toEqual([
      'inventory-2',
      'inventory-1',
    ]);
  });

  it('formats currency and sanitizes order inputs', () => {
    expect(formatMarketCurrency(1520)).toBe('R$ 1.520');
    expect(sanitizeOrderQuantity('8', 3)).toBe(3);
    expect(sanitizeOrderQuantity('0', 4)).toBe(1);
    expect(sanitizeOrderPrice('2450,90')).toBe(2450.9);
    expect(sanitizeOrderPrice('-1', 500)).toBe(500);
  });
});
