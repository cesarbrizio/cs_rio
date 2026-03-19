import {
  type MarketAuctionBookResponse,
  type MarketAuctionMutationResponse,
  type MarketOrderBookResponse,
  type MarketOrderMutationResponse,
  type PlayerInventoryItem,
} from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  filterAuctionableInventoryItems,
  filterMarketAuctions,
  filterMarketOrders,
  filterRepairableInventoryItems,
  filterSellableInventoryItems,
  sanitizeOrderPrice,
  sanitizeOrderQuantity,
  type MarketItemTypeFilter,
  type MarketPanelTab,
} from './marketHelpers';

interface UseMarketControllerInput {
  inventoryApi: {
    repair: (inventoryItemId: string) => Promise<unknown>;
  };
  marketApi: {
    bidAuction: (
      auctionId: string,
      input: { amount: number },
    ) => Promise<MarketAuctionMutationResponse>;
    cancel: (orderId: string) => Promise<MarketOrderMutationResponse>;
    createAuction: (input: {
      buyoutPrice?: number | null;
      durationMinutes: number;
      inventoryItemId: string;
      itemId: string;
      itemType: 'weapon' | 'vest';
      startingBid: number;
    }) => Promise<MarketAuctionMutationResponse>;
    createOrder: (input: {
      inventoryItemId?: string | null;
      itemId: string;
      itemType: PlayerInventoryItem['itemType'];
      pricePerUnit: number;
      quantity: number;
      side: 'buy' | 'sell';
      systemOfferId?: string | null;
    }) => Promise<MarketOrderMutationResponse>;
    getAuctionBook: (filters?: {
      itemType?: 'vest' | 'weapon';
    }) => Promise<MarketAuctionBookResponse>;
    getOrderBook: (filters?: {
      itemType?: PlayerInventoryItem['itemType'];
    }) => Promise<MarketOrderBookResponse>;
  };
  playerInventory: PlayerInventoryItem[];
  refreshPlayerProfile: () => Promise<unknown>;
}

export function useMarketController({
  inventoryApi,
  marketApi,
  playerInventory,
  refreshPlayerProfile,
}: UseMarketControllerInput) {
  const [activeTab, setActiveTab] = useState<MarketPanelTab>('buy');
  const [itemTypeFilter, setItemTypeFilter] = useState<MarketItemTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [auctionBook, setAuctionBook] = useState<MarketAuctionBookResponse | null>(null);
  const [orderBook, setOrderBook] = useState<MarketOrderBookResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedBuyOrderId, setSelectedBuyOrderId] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadMarket = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await refreshPlayerProfile();
      const nextAuctionFilter =
        itemTypeFilter === 'weapon' || itemTypeFilter === 'vest' ? { itemType: itemTypeFilter } : {};
      const nextOrderFilter = itemTypeFilter === 'all' ? {} : { itemType: itemTypeFilter };
      const [nextAuctionBook, nextOrderBook] = await Promise.all([
        marketApi.getAuctionBook(nextAuctionFilter),
        marketApi.getOrderBook(nextOrderFilter),
      ]);

      setAuctionBook(nextAuctionBook);
      setOrderBook(nextOrderBook);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar mercado.');
    } finally {
      setIsLoading(false);
    }
  }, [itemTypeFilter, marketApi, refreshPlayerProfile]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const marketAuctions = useMemo(
    () => filterMarketAuctions(auctionBook?.auctions ?? [], search, itemTypeFilter),
    [auctionBook?.auctions, itemTypeFilter, search],
  );
  const myAuctions = useMemo(
    () => filterMarketAuctions(auctionBook?.myAuctions ?? [], search, itemTypeFilter),
    [auctionBook?.myAuctions, itemTypeFilter, search],
  );
  const sellOrders = useMemo(
    () => filterMarketOrders(orderBook?.sellOrders ?? [], search, itemTypeFilter),
    [itemTypeFilter, orderBook?.sellOrders, search],
  );
  const myOrders = useMemo(
    () => filterMarketOrders(orderBook?.myOrders ?? [], search, itemTypeFilter),
    [itemTypeFilter, orderBook?.myOrders, search],
  );
  const auctionableItems = useMemo(
    () => filterAuctionableInventoryItems(playerInventory, search, itemTypeFilter),
    [itemTypeFilter, playerInventory, search],
  );
  const sellableItems = useMemo(
    () => filterSellableInventoryItems(playerInventory, search, itemTypeFilter),
    [itemTypeFilter, playerInventory, search],
  );
  const repairableItems = useMemo(
    () => filterRepairableInventoryItems(playerInventory, search, itemTypeFilter),
    [itemTypeFilter, playerInventory, search],
  );

  const selectedAuction = useMemo(
    () => marketAuctions.find((auction) => auction.id === selectedAuctionId) ?? marketAuctions[0] ?? null,
    [marketAuctions, selectedAuctionId],
  );
  const selectedBuyOrder = useMemo(
    () => sellOrders.find((order) => order.id === selectedBuyOrderId) ?? sellOrders[0] ?? null,
    [selectedBuyOrderId, sellOrders],
  );
  const selectedInventoryItem = useMemo(
    () =>
      sellableItems.find((item) => item.id === selectedInventoryItemId) ??
      repairableItems.find((item) => item.id === selectedInventoryItemId) ??
      auctionableItems.find((item) => item.id === selectedInventoryItemId) ??
      sellableItems[0] ??
      repairableItems[0] ??
      auctionableItems[0] ??
      null,
    [auctionableItems, repairableItems, selectedInventoryItemId, sellableItems],
  );

  useEffect(() => {
    if (selectedAuction && selectedAuction.id !== selectedAuctionId) {
      setSelectedAuctionId(selectedAuction.id);
    }
  }, [selectedAuction, selectedAuctionId]);

  useEffect(() => {
    if (selectedBuyOrder && selectedBuyOrder.id !== selectedBuyOrderId) {
      setSelectedBuyOrderId(selectedBuyOrder.id);
    }
  }, [selectedBuyOrder, selectedBuyOrderId]);

  useEffect(() => {
    if (selectedInventoryItem && selectedInventoryItem.id !== selectedInventoryItemId) {
      setSelectedInventoryItemId(selectedInventoryItem.id);
    }
  }, [selectedInventoryItem, selectedInventoryItemId]);

  const runMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setError(null);
      setIsSubmitting(true);

      try {
        await operation();
        await refreshPlayerProfile();
        await loadMarket();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Falha ao executar operacao de mercado.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadMarket, refreshPlayerProfile],
  );

  const buySelectedOrder = useCallback(
    async (quantityInput: string) => {
      if (!selectedBuyOrder) {
        setError('Selecione uma ordem de venda para comprar.');
        return;
      }

      const quantity = sanitizeOrderQuantity(quantityInput, selectedBuyOrder.remainingQuantity);

      await runMutation(async () => {
        const response = await marketApi.createOrder({
          itemId: selectedBuyOrder.itemId,
          itemType: selectedBuyOrder.itemType,
          pricePerUnit: selectedBuyOrder.pricePerUnit,
          quantity,
          side: 'buy',
          systemOfferId: selectedBuyOrder.systemOfferId ?? null,
        });

        setFeedback(buildMarketMutationMessage('buy', response, selectedBuyOrder.itemName));
      });
    },
    [marketApi, runMutation, selectedBuyOrder],
  );

  const sellInventoryItem = useCallback(
    async (priceInput: string, quantityInput: string) => {
      if (!selectedInventoryItem || !selectedInventoryItem.itemId) {
        setError('Selecione um item do inventario para vender.');
        return;
      }

      const quantity = selectedInventoryItem.stackable
        ? sanitizeOrderQuantity(quantityInput, selectedInventoryItem.quantity)
        : 1;
      const pricePerUnit = sanitizeOrderPrice(priceInput);

      if (pricePerUnit <= 0) {
        setError('Informe um preco unitario valido para anunciar.');
        return;
      }

      const itemId = selectedInventoryItem.itemId;
      const itemType = selectedInventoryItem.itemType;

      await runMutation(async () => {
        const response = await marketApi.createOrder({
          inventoryItemId: selectedInventoryItem.id,
          itemId,
          itemType,
          pricePerUnit,
          quantity,
          side: 'sell',
        });

        setFeedback(
          buildMarketMutationMessage(
            'sell',
            response,
            selectedInventoryItem.itemName ?? selectedInventoryItem.itemType,
          ),
        );
      });
    },
    [marketApi, runMutation, selectedInventoryItem],
  );

  const createAuctionForItem = useCallback(
    async (input: {
      buyoutPriceInput?: string;
      durationMinutesInput: string;
      startingBidInput: string;
    }) => {
      if (!selectedInventoryItem || !selectedInventoryItem.itemId) {
        setError('Selecione um item elegivel para leiloar.');
        return;
      }

      if (selectedInventoryItem.itemType !== 'weapon' && selectedInventoryItem.itemType !== 'vest') {
        setError('Somente armas e coletes entram em leilao.');
        return;
      }

      const startingBid = sanitizeOrderPrice(input.startingBidInput);
      const durationMinutes = Math.max(15, Number.parseInt(input.durationMinutesInput, 10) || 60);
      const buyoutPrice = input.buyoutPriceInput
        ? sanitizeOrderPrice(input.buyoutPriceInput, 0)
        : null;
      const itemId = selectedInventoryItem.itemId;
      const itemType = selectedInventoryItem.itemType;

      await runMutation(async () => {
        const response = await marketApi.createAuction({
          buyoutPrice: buyoutPrice && buyoutPrice > 0 ? buyoutPrice : null,
          durationMinutes,
          inventoryItemId: selectedInventoryItem.id,
          itemId,
          itemType,
          startingBid,
        });

        setFeedback(
          `Leilao criado para ${response.auction.itemName} com lance inicial em ${response.auction.startingBid.toLocaleString('pt-BR')}.`,
        );
      });
    },
    [marketApi, runMutation, selectedInventoryItem],
  );

  const bidSelectedAuction = useCallback(
    async (amountInput: string) => {
      if (!selectedAuction) {
        setError('Selecione um leilao para ofertar.');
        return;
      }

      const amount = sanitizeOrderPrice(amountInput);

      if (amount <= 0) {
        setError('Informe um lance valido.');
        return;
      }

      await runMutation(async () => {
        const response = await marketApi.bidAuction(selectedAuction.id, { amount });
        setFeedback(`Lance enviado para ${response.auction.itemName}.`);
      });
    },
    [marketApi, runMutation, selectedAuction],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      await runMutation(async () => {
        const response = await marketApi.cancel(orderId);
        setFeedback(`Ordem ${response.order.itemName} cancelada.`);
      });
    },
    [marketApi, runMutation],
  );

  const repairInventoryItem = useCallback(
    async (inventoryItemId: string) => {
      await runMutation(async () => {
        await inventoryApi.repair(inventoryItemId);
        setFeedback('Item reparado e inventario sincronizado.');
      });
    },
    [inventoryApi, runMutation],
  );

  return {
    activeTab,
    auctionBook,
    auctionableItems,
    bidSelectedAuction,
    buySelectedOrder,
    cancelOrder,
    createAuctionForItem,
    error,
    feedback,
    isLoading,
    isSubmitting,
    itemTypeFilter,
    loadMarket,
    marketAuctions,
    myAuctions,
    myOrders,
    nowMs,
    orderBook,
    repairInventoryItem,
    repairableItems,
    search,
    sellInventoryItem,
    sellOrders,
    sellableItems,
    selectedAuction,
    selectedBuyOrder,
    selectedInventoryItem,
    setActiveTab,
    setItemTypeFilter,
    setSearch,
    setSelectedAuctionId,
    setSelectedBuyOrderId,
    setSelectedInventoryItemId,
  };
}

function buildMarketMutationMessage(
  kind: 'buy' | 'sell',
  response: MarketOrderMutationResponse,
  itemName: string,
): string {
  if (kind === 'buy') {
    if (response.matchedTrades.length > 0) {
      return `Compra de ${itemName} executada em ${response.matchedTrades.length} lote(s).`;
    }

    return `Oferta de compra enviada para ${itemName}.`;
  }

  if (response.matchedTrades.length > 0) {
    return `Venda de ${itemName} executada em ${response.matchedTrades.length} lote(s).`;
  }

  return `Anuncio de venda criado para ${itemName}.`;
}
