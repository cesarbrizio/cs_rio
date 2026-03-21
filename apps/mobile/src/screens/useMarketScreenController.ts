import { useFocusEffect } from '@react-navigation/native';
import type { PlayerInventoryItem } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  filterAuctionableInventoryItems,
  filterMarketAuctions,
  filterMarketOrders,
  filterRepairableInventoryItems,
  filterSellableInventoryItems,
  formatMarketCurrency,
  sanitizeOrderPrice,
  sanitizeOrderQuantity,
  type MarketItemTypeFilter,
  type MarketPanelTab,
} from '../features/market';
import { buildAuctionMutationMessage, buildMarketMutationMessage } from './marketScreenSupport';
import { formatApiError, inventoryApi, marketApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';

export function useMarketScreenController(initialTab?: MarketPanelTab) {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [activeTab, setActiveTab] = useState<MarketPanelTab>(initialTab ?? 'buy');
  const [itemTypeFilter, setItemTypeFilter] = useState<MarketItemTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [auctionBook, setAuctionBook] = useState<Awaited<
    ReturnType<typeof marketApi.getAuctionBook>
  > | null>(null);
  const [orderBook, setOrderBook] = useState<Awaited<
    ReturnType<typeof marketApi.getOrderBook>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedAuctionInventoryItemId, setSelectedAuctionInventoryItemId] = useState<
    string | null
  >(null);
  const [selectedBuyOrderId, setSelectedBuyOrderId] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [auctionBidInput, setAuctionBidInput] = useState('');
  const [auctionBuyoutInput, setAuctionBuyoutInput] = useState('1800');
  const [auctionDurationInput, setAuctionDurationInput] = useState('60');
  const [auctionStartInput, setAuctionStartInput] = useState('1000');
  const [auctionNowMs, setAuctionNowMs] = useState(Date.now());
  const [buyQuantityInput, setBuyQuantityInput] = useState('1');
  const [sellPriceInput, setSellPriceInput] = useState('1200');
  const [sellQuantityInput, setSellQuantityInput] = useState('1');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadMarket = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await refreshPlayerProfile();
      const nextItemTypeFilter =
        itemTypeFilter === 'weapon' || itemTypeFilter === 'vest' ? itemTypeFilter : undefined;
      const [nextAuctionBook, nextOrderBook] = await Promise.all([
        marketApi.getAuctionBook(nextItemTypeFilter ? { itemType: nextItemTypeFilter } : {}),
        marketApi.getOrderBook(itemTypeFilter === 'all' ? {} : { itemType: itemTypeFilter }),
      ]);

      setAuctionBook(nextAuctionBook);
      setOrderBook(nextOrderBook);
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsLoading(false);
    }
  }, [itemTypeFilter, refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadMarket();
    }, [loadMarket]),
  );

  const auctionNotifications = useMemo(
    () => auctionBook?.notifications.slice(0, 3) ?? [],
    [auctionBook?.notifications],
  );
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
    () => filterAuctionableInventoryItems(player?.inventory ?? [], search, itemTypeFilter),
    [itemTypeFilter, player?.inventory, search],
  );
  const sellableItems = useMemo(
    () => filterSellableInventoryItems(player?.inventory ?? [], search, itemTypeFilter),
    [itemTypeFilter, player?.inventory, search],
  );
  const repairableItems = useMemo(
    () => filterRepairableInventoryItems(player?.inventory ?? [], search, itemTypeFilter),
    [itemTypeFilter, player?.inventory, search],
  );
  const selectedAuction = useMemo(
    () =>
      marketAuctions.find((auction) => auction.id === selectedAuctionId) ??
      marketAuctions[0] ??
      null,
    [marketAuctions, selectedAuctionId],
  );
  const selectedAuctionMinNextBid = selectedAuction?.minNextBid ?? null;
  const selectedAuctionKey = selectedAuction?.id ?? null;
  const selectedAuctionInventoryItem = useMemo(
    () =>
      auctionableItems.find((item) => item.id === selectedAuctionInventoryItemId) ??
      auctionableItems[0] ??
      null,
    [auctionableItems, selectedAuctionInventoryItemId],
  );
  const selectedBuyOrder = useMemo(
    () => sellOrders.find((order) => order.id === selectedBuyOrderId) ?? sellOrders[0] ?? null,
    [selectedBuyOrderId, sellOrders],
  );
  const selectedInventoryItem = useMemo(
    () =>
      sellableItems.find((item) => item.id === selectedInventoryItemId) ?? sellableItems[0] ?? null,
    [selectedInventoryItemId, sellableItems],
  );
  const activeListingsCount = useMemo(
    () =>
      myOrders.filter((order) => order.status === 'open').length +
      myAuctions.filter((auction) => auction.status === 'open').length,
    [myAuctions, myOrders],
  );
  const hasAuctionCountdowns =
    activeTab === 'auction' &&
    (marketAuctions.length > 0 || myAuctions.some((auction) => auction.status === 'open'));

  useFocusEffect(
    useCallback(() => {
      setAuctionNowMs(Date.now());

      if (!hasAuctionCountdowns) {
        return undefined;
      }

      const intervalId = setInterval(() => {
        setAuctionNowMs(Date.now());
      }, 5_000);

      return () => {
        clearInterval(intervalId);
      };
    }, [hasAuctionCountdowns]),
  );

  useEffect(() => {
    if (selectedAuction && selectedAuction.id !== selectedAuctionId) {
      setSelectedAuctionId(selectedAuction.id);
    }
  }, [selectedAuction, selectedAuctionId]);

  useEffect(() => {
    if (
      selectedAuctionInventoryItem &&
      selectedAuctionInventoryItem.id !== selectedAuctionInventoryItemId
    ) {
      setSelectedAuctionInventoryItemId(selectedAuctionInventoryItem.id);
    }
  }, [selectedAuctionInventoryItem, selectedAuctionInventoryItemId]);

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

  useEffect(() => {
    if (selectedAuctionMinNextBid !== null) {
      setAuctionBidInput(String(Math.ceil(selectedAuctionMinNextBid)));
    }
  }, [selectedAuctionKey, selectedAuctionMinNextBid]);

  useEffect(() => {
    if (!selectedInventoryItem || !selectedInventoryItem.stackable) {
      setSellQuantityInput('1');
    }
  }, [selectedInventoryItem]);

  const handleBuy = useCallback(async () => {
    if (!selectedBuyOrder) {
      setError('Selecione uma ordem de venda para comprar.');
      return;
    }

    const quantity = sanitizeOrderQuantity(buyQuantityInput, selectedBuyOrder.remainingQuantity);

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await marketApi.createOrder({
        itemId: selectedBuyOrder.itemId,
        itemType: selectedBuyOrder.itemType,
        pricePerUnit: selectedBuyOrder.pricePerUnit,
        quantity,
        side: 'buy',
        systemOfferId: selectedBuyOrder.systemOfferId ?? null,
      });
      const message = buildMarketMutationMessage('buy', response, selectedBuyOrder.itemName);
      setFeedback(message);
      setBootstrapStatus(message);
      await loadMarket();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [buyQuantityInput, loadMarket, selectedBuyOrder, setBootstrapStatus]);

  const handleSell = useCallback(async () => {
    if (!selectedInventoryItem || !selectedInventoryItem.itemId) {
      setError('Selecione um item do inventário para vender.');
      return;
    }

    const quantity = selectedInventoryItem.stackable
      ? sanitizeOrderQuantity(sellQuantityInput, selectedInventoryItem.quantity)
      : 1;
    const pricePerUnit = sanitizeOrderPrice(sellPriceInput);

    if (pricePerUnit <= 0) {
      setError('Informe um preco unitario valido para anunciar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await marketApi.createOrder({
        inventoryItemId: selectedInventoryItem.id,
        itemId: selectedInventoryItem.itemId,
        itemType: selectedInventoryItem.itemType,
        pricePerUnit,
        quantity,
        side: 'sell',
      });
      const message = buildMarketMutationMessage(
        'sell',
        response,
        selectedInventoryItem.itemName ?? selectedInventoryItem.itemType,
      );
      setFeedback(message);
      setBootstrapStatus(message);
      await loadMarket();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadMarket, selectedInventoryItem, sellPriceInput, sellQuantityInput, setBootstrapStatus]);

  const handleCreateAuction = useCallback(async () => {
    if (!selectedAuctionInventoryItem || !selectedAuctionInventoryItem.itemId) {
      setError('Selecione um item elegível para leiloar.');
      return;
    }

    const startingBid = sanitizeOrderPrice(auctionStartInput);
    const buyoutPrice = auctionBuyoutInput.trim() ? sanitizeOrderPrice(auctionBuyoutInput) : null;
    const durationMinutes = Number.parseInt(auctionDurationInput.trim(), 10);

    if (startingBid <= 0) {
      setError('Informe um lance inicial válido para o leilão.');
      return;
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setError('Informe uma duração válida em minutos para o leilão.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await marketApi.createAuction({
        buyoutPrice,
        durationMinutes,
        inventoryItemId: selectedAuctionInventoryItem.id,
        itemId: selectedAuctionInventoryItem.itemId,
        itemType: selectedAuctionInventoryItem.itemType as 'vest' | 'weapon',
        startingBid,
      });
      const message = buildAuctionMutationMessage(
        'create',
        response,
        selectedAuctionInventoryItem.itemName ?? selectedAuctionInventoryItem.itemType,
      );
      setFeedback(message);
      setBootstrapStatus(message);
      await loadMarket();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    auctionBuyoutInput,
    auctionDurationInput,
    auctionStartInput,
    loadMarket,
    selectedAuctionInventoryItem,
    setBootstrapStatus,
  ]);

  const handleBidAuction = useCallback(async () => {
    if (!selectedAuction) {
      setError('Selecione um leilão aberto para dar lance.');
      return;
    }

    const amount = sanitizeOrderPrice(auctionBidInput);

    if (amount <= 0) {
      setError('Informe um valor de lance válido.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await marketApi.bidAuction(selectedAuction.id, {
        amount,
      });
      const message = buildAuctionMutationMessage('bid', response, selectedAuction.itemName);
      setFeedback(message);
      setBootstrapStatus(message);
      await loadMarket();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [auctionBidInput, loadMarket, selectedAuction, setBootstrapStatus]);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      setError(null);
      setIsSubmitting(true);

      try {
        const response = await marketApi.cancel(orderId);
        const message = `Ordem cancelada. ${
          response.returnedQuantity > 0 ? `Itens devolvidos: ${response.returnedQuantity}. ` : ''
        }${
          response.refundedAmount > 0
            ? `Reserva liberada: ${formatMarketCurrency(response.refundedAmount)}.`
            : ''
        }`.trim();
        setFeedback(message);
        setBootstrapStatus(message);
        await loadMarket();
      } catch (nextError) {
        setError(formatApiError(nextError).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadMarket, setBootstrapStatus],
  );

  const handleRepair = useCallback(
    async (inventoryItem: PlayerInventoryItem) => {
      setError(null);
      setIsSubmitting(true);

      try {
        const response = await inventoryApi.repair(inventoryItem.id);
        const message = `${inventoryItem.itemName ?? inventoryItem.itemType} reparado por ${formatMarketCurrency(response.repairCost)}.`;
        setFeedback(message);
        setBootstrapStatus(message);
        await loadMarket();
      } catch (nextError) {
        setError(formatApiError(nextError).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadMarket, setBootstrapStatus],
  );

  const dismissResult = useCallback(() => {
    setError(null);
    setFeedback(null);
  }, []);

  return {
    activeListingsCount,
    activeTab,
    auctionBook,
    auctionBidInput,
    auctionBuyoutInput,
    auctionDurationInput,
    auctionNotifications,
    auctionNowMs,
    auctionStartInput,
    auctionableItems,
    buyQuantityInput,
    dismissResult,
    error,
    feedback,
    handleBidAuction,
    handleBuy,
    handleCancelOrder,
    handleCreateAuction,
    handleRepair,
    handleSell,
    isLoading,
    isSubmitting,
    itemTypeFilter,
    marketAuctions,
    myAuctions,
    myOrders,
    orderBook,
    player,
    repairableItems,
    search,
    selectedAuction,
    selectedAuctionId,
    selectedAuctionInventoryItem,
    selectedAuctionInventoryItemId,
    selectedBuyOrder,
    selectedBuyOrderId,
    selectedInventoryItem,
    selectedInventoryItemId,
    sellOrders,
    sellPriceInput,
    sellQuantityInput,
    sellableItems,
    setActiveTab,
    setAuctionBidInput,
    setAuctionBuyoutInput,
    setAuctionDurationInput,
    setAuctionStartInput,
    setBuyQuantityInput,
    setItemTypeFilter,
    setSearch,
    setSelectedAuctionId,
    setSelectedAuctionInventoryItemId,
    setSelectedBuyOrderId,
    setSelectedInventoryItemId,
    setSellPriceInput,
    setSellQuantityInput,
  };
}
