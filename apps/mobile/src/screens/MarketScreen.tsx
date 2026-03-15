import { useFocusEffect } from '@react-navigation/native';
import {
  type MarketAuctionMutationResponse,
  type MarketAuctionSummary,
  type MarketOrderMutationResponse,
  type MarketOrderSummary,
  type PlayerInventoryItem,
} from '@cs-rio/shared';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { NpcInflationPanel } from '../components/NpcInflationPanel';
import {
  filterAuctionableInventoryItems,
  filterMarketAuctions,
  filterMarketOrders,
  filterRepairableInventoryItems,
  filterSellableInventoryItems,
  formatAuctionCountdown,
  formatMarketCurrency,
  resolveMarketTabLabel,
  sanitizeOrderPrice,
  sanitizeOrderQuantity,
  type MarketItemTypeFilter,
  type MarketPanelTab,
} from '../features/market';
import { formatApiError, inventoryApi, marketApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

type MarketScreenProps = NativeStackScreenProps<RootStackParamList, 'Market'>;

const ITEM_TYPE_FILTERS: MarketItemTypeFilter[] = ['all', 'weapon', 'vest', 'drug'];

export function MarketScreen({ route }: MarketScreenProps): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [activeTab, setActiveTab] = useState<MarketPanelTab>(route.params?.initialTab ?? 'buy');
  const [itemTypeFilter, setItemTypeFilter] = useState<MarketItemTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [auctionBook, setAuctionBook] = useState<Awaited<ReturnType<typeof marketApi.getAuctionBook>> | null>(null);
  const [orderBook, setOrderBook] = useState<Awaited<ReturnType<typeof marketApi.getOrderBook>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedAuctionInventoryItemId, setSelectedAuctionInventoryItemId] = useState<string | null>(null);
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
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

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
    () => marketAuctions.find((auction) => auction.id === selectedAuctionId) ?? marketAuctions[0] ?? null,
    [marketAuctions, selectedAuctionId],
  );
  const selectedAuctionMinNextBid = selectedAuction?.minNextBid ?? null;
  const selectedAuctionKey = selectedAuction?.id ?? null;
  const selectedAuctionInventoryItem = useMemo(
    () =>
      auctionableItems.find((item) => item.id === selectedAuctionInventoryItemId) ?? auctionableItems[0] ?? null,
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
  const hasAuctionCountdowns = activeTab === 'auction' && (
    marketAuctions.length > 0 ||
    myAuctions.some((auction) => auction.status === 'open')
  );

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
    if (selectedAuctionInventoryItem && selectedAuctionInventoryItem.id !== selectedAuctionInventoryItemId) {
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

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await marketApi.cancel(orderId);
      const message = `Ordem cancelada. ${response.returnedQuantity > 0 ? `Itens devolvidos: ${response.returnedQuantity}. ` : ''}${response.refundedAmount > 0 ? `Reserva liberada: ${formatMarketCurrency(response.refundedAmount)}.` : ''}`.trim();
      setFeedback(message);
      setBootstrapStatus(message);
      await loadMarket();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadMarket, setBootstrapStatus]);

  const handleRepair = useCallback(async (inventoryItem: PlayerInventoryItem) => {
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
  }, [loadMarket, setBootstrapStatus]);

  return (
    <InGameScreenLayout
      subtitle="Livro de ordens, leilões raros, busca local, filtros por tipo e manutenção do loadout em um mesmo painel clandestino."
      title="Mercado Negro"
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Caixa" value={formatMarketCurrency(player?.resources.money ?? 0)} />
        <SummaryCard label="Ativos" value={`${activeListingsCount}`} />
        <SummaryCard
          label="Taxa"
          value={`${Math.round((orderBook?.marketFeeRate ?? auctionBook?.marketFeeRate ?? 0.05) * 100)}%`}
        />
        <SummaryCard label="Leilões vivos" value={`${marketAuctions.length}`} />
      </View>

      <NpcInflationPanel summary={orderBook?.npcInflation ?? null} />

      <View style={styles.segmentRow}>
        {(['buy', 'sell', 'repair', 'auction'] as const).map((tab) => (
          <Pressable
            accessibilityLabel={`Abrir aba ${resolveMarketTabLabel(tab)}`}
            accessibilityRole="button"
            key={tab}
            onPress={() => {
              setActiveTab(tab);
            }}
            style={({ pressed }) => [
              styles.segmentButton,
              activeTab === tab ? styles.segmentButtonActive : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                activeTab === tab ? styles.segmentLabelActive : null,
              ]}
            >
              {resolveMarketTabLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterCard}>
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar por item ou código..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={search}
        />
        <View style={styles.filterRow}>
          {ITEM_TYPE_FILTERS.map((filterId) => (
            <Pressable
              accessibilityLabel={`Filtrar por ${resolveItemTypeFilterLabel(filterId)}`}
              accessibilityRole="button"
              key={filterId}
              onPress={() => {
                setItemTypeFilter(filterId);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                itemTypeFilter === filterId ? styles.filterChipActive : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  itemTypeFilter === filterId ? styles.filterChipLabelActive : null,
                ]}
              >
                {resolveItemTypeFilterLabel(filterId)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {auctionNotifications.length > 0 ? (
        <SectionCard
          eyebrow="Radar"
          subtitle="Notificações recentes sobre leilões encerrados, lances superados e arremates."
          title="Feed de Leilão"
        >
          <View style={styles.listColumn}>
            {auctionNotifications.map((notification) => (
              <View key={notification.id} style={styles.notificationCard}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationCopy}>{notification.message}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {isLoading ? <Banner copy="Atualizando mercado, leilões e inventário..." tone="neutral" /> : null}

      {activeTab === 'buy' ? (
        <>
          <SectionCard
            eyebrow="Livro de vendas"
            subtitle="Selecione uma ordem de venda existente para abrir uma buy order com o mesmo preco e consumir a oferta imediatamente."
            title="Comprar do order book"
          >
            {sellOrders.length > 0 ? (
              <View style={styles.listColumn}>
                {sellOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    accent={selectedBuyOrder?.id === order.id}
                    onPress={() => {
                      setSelectedBuyOrderId(order.id);
                    }}
                    order={order}
                  >
                    {selectedBuyOrder?.id === order.id ? (
                      <View style={styles.tradeCard}>
                        <Text style={styles.tradeTitle}>{order.itemName}</Text>
                        <Text style={styles.tradeCopy}>
                          Preco alvo {formatMarketCurrency(order.pricePerUnit)} · restante {order.remainingQuantity}x
                        </Text>
                        <Text style={styles.tradeHint}>
                          {order.sourceType === 'system'
                            ? `Origem: ${order.sourceLabel ?? 'Fornecedor da rodada'}`
                            : 'Origem: anúncio de outro jogador'}
                        </Text>
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={setBuyQuantityInput}
                          placeholder="Quantidade"
                          placeholderTextColor={colors.muted}
                          style={styles.numericInput}
                          value={buyQuantityInput}
                        />
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => {
                            void handleBuy();
                          }}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            isSubmitting ? styles.primaryButtonDisabled : null,
                            pressed ? styles.buttonPressed : null,
                          ]}
                        >
                          <Text style={styles.primaryButtonLabel}>
                            {isSubmitting ? 'Processando...' : 'Comprar agora'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </OrderCard>
                ))}
              </View>
            ) : (
              <EmptyState copy="Ainda não há ofertas ativas para este filtro. O livro mistura anúncios de jogadores e lotes limitados do fornecedor da rodada." />
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Suas ordens"
            subtitle="Acompanhe as ordens abertas e cancele as que ainda não casaram."
            title="Minha mesa"
          >
            {myOrders.length > 0 ? (
              <View style={styles.listColumn}>
                {myOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    actionLabel={order.status === 'open' ? 'Cancelar' : undefined}
                    accent={false}
                    onAction={
                      order.status === 'open'
                        ? () => {
                            void handleCancelOrder(order.id);
                          }
                        : undefined
                    }
                    order={order}
                  />
                ))}
              </View>
            ) : (
              <EmptyState copy="Você ainda não abriu ordens no mercado negro." />
            )}
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'sell' ? (
        <SectionCard
          eyebrow="Inventario"
          subtitle="Selecione um item elegível, informe o preço unitário e publique a oferta. Itens quebrados ficam reservados para o painel de reparo."
          title="Anunciar venda"
        >
          {sellableItems.length > 0 ? (
            <View style={styles.listColumn}>
              {sellableItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  accent={selectedInventoryItem?.id === item.id}
                  item={item}
                  onPress={() => {
                    setSelectedInventoryItemId(item.id);
                  }}
                >
                  {selectedInventoryItem?.id === item.id ? (
                    <View style={styles.tradeCard}>
                      <Text style={styles.tradeTitle}>{item.itemName ?? item.itemType}</Text>
                      <Text style={styles.tradeCopy}>
                        Quantidade disponível {item.quantity}x · proficiência {item.proficiency}
                      </Text>
                      <TextInput
                        editable={item.stackable}
                        keyboardType="number-pad"
                        onChangeText={setSellQuantityInput}
                        placeholder="Quantidade"
                        placeholderTextColor={colors.muted}
                        style={[
                          styles.numericInput,
                          !item.stackable ? styles.numericInputDisabled : null,
                        ]}
                        value={item.stackable ? sellQuantityInput : '1'}
                      />
                      <TextInput
                        keyboardType="decimal-pad"
                        onChangeText={setSellPriceInput}
                        placeholder="Preço unitário"
                        placeholderTextColor={colors.muted}
                        style={styles.numericInput}
                        value={sellPriceInput}
                      />
                      <Pressable
                        disabled={isSubmitting}
                        onPress={() => {
                          void handleSell();
                        }}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          isSubmitting ? styles.primaryButtonDisabled : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryButtonLabel}>
                          {isSubmitting ? 'Publicando...' : 'Anunciar no mercado'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </InventoryItemCard>
              ))}
            </View>
          ) : (
            <EmptyState copy="Nenhum item elegivel para venda foi encontrado com os filtros atuais." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'repair' ? (
        <SectionCard
          eyebrow="Oficina fria"
          subtitle="Repare armas e coletes com desgaste para voltar a operar ou revender o item sem cair no bloqueio de equipamento quebrado."
          title="Reparar equipamento"
        >
          {repairableItems.length > 0 ? (
            <View style={styles.listColumn}>
              {repairableItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  accent={false}
                  actionLabel="Reparar"
                  item={item}
                  onAction={() => {
                    void handleRepair(item);
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState copy="Nenhum equipamento danificado precisa de reparo agora." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'auction' ? (
        <>
          <SectionCard
            eyebrow="Leilões ativos"
            subtitle="Itens raros e individuais seguem por lance crescente. O servidor liquida automaticamente quando o cronômetro expira."
            title="Dar lance"
          >
            {marketAuctions.length > 0 ? (
              <View style={styles.listColumn}>
                {marketAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    accent={selectedAuction?.id === auction.id}
                    auction={auction}
                    countdown={formatAuctionCountdown(auction.endsAt, auctionNowMs)}
                    onPress={() => {
                      setSelectedAuctionId(auction.id);
                    }}
                  >
                    {selectedAuction?.id === auction.id ? (
                      <View style={styles.tradeCard}>
                        <Text style={styles.tradeTitle}>{auction.itemName}</Text>
                        <Text style={styles.tradeCopy}>
                          Lance atual {formatMarketCurrency(auction.currentBid ?? auction.startingBid)} · próximo mínimo {formatMarketCurrency(auction.minNextBid)} · termina em {formatAuctionCountdown(auction.endsAt, auctionNowMs)}
                        </Text>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={setAuctionBidInput}
                          placeholder="Seu lance"
                          placeholderTextColor={colors.muted}
                          style={styles.numericInput}
                          value={auctionBidInput}
                        />
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => {
                            void handleBidAuction();
                          }}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            isSubmitting ? styles.primaryButtonDisabled : null,
                            pressed ? styles.buttonPressed : null,
                          ]}
                        >
                          <Text style={styles.primaryButtonLabel}>
                            {isSubmitting ? 'Enviando lance...' : 'Dar lance'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </AuctionCard>
                ))}
              </View>
            ) : (
              <EmptyState copy="Nenhum leilão aberto bateu com os filtros atuais." />
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Criar leilão"
            subtitle="Selecione um equipamento individual, defina lance inicial, compra imediata opcional e a duração em minutos."
            title="Publicar item raro"
          >
            {auctionableItems.length > 0 ? (
              <View style={styles.listColumn}>
                {auctionableItems.map((item) => (
                  <InventoryItemCard
                    key={item.id}
                    accent={selectedAuctionInventoryItem?.id === item.id}
                    item={item}
                    onPress={() => {
                      setSelectedAuctionInventoryItemId(item.id);
                    }}
                  >
                    {selectedAuctionInventoryItem?.id === item.id ? (
                      <View style={styles.tradeCard}>
                        <Text style={styles.tradeTitle}>{item.itemName ?? item.itemType}</Text>
                        <Text style={styles.tradeCopy}>
                          Prof {item.proficiency} · durabilidade {item.durability ?? '--'}/{item.maxDurability ?? '--'}
                        </Text>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={setAuctionStartInput}
                          placeholder="Lance inicial"
                          placeholderTextColor={colors.muted}
                          style={styles.numericInput}
                          value={auctionStartInput}
                        />
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={setAuctionBuyoutInput}
                          placeholder="Compra imediata (opcional)"
                          placeholderTextColor={colors.muted}
                          style={styles.numericInput}
                          value={auctionBuyoutInput}
                        />
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={setAuctionDurationInput}
                          placeholder="Duração em minutos"
                          placeholderTextColor={colors.muted}
                          style={styles.numericInput}
                          value={auctionDurationInput}
                        />
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => {
                            void handleCreateAuction();
                          }}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            isSubmitting ? styles.primaryButtonDisabled : null,
                            pressed ? styles.buttonPressed : null,
                          ]}
                        >
                          <Text style={styles.primaryButtonLabel}>
                            {isSubmitting ? 'Publicando...' : 'Criar leilão'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </InventoryItemCard>
                ))}
              </View>
            ) : (
              <EmptyState copy="Nenhum equipamento apto para leilão foi encontrado. O sistema aceita apenas armas e coletes não empilháveis e fora de uso." />
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Seus leilões"
            subtitle="Histórico curto dos leilões criados por você e status atual de cada um."
            title="Minha banca"
          >
            {myAuctions.length > 0 ? (
              <View style={styles.listColumn}>
                {myAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    accent={false}
                    auction={auction}
                    countdown={
                      auction.status === 'open'
                        ? formatAuctionCountdown(auction.endsAt, auctionNowMs)
                        : auction.status
                    }
                  />
                ))}
              </View>
            ) : (
              <EmptyState copy="Você ainda não publicou leilões nesta rodada." />
            )}
          </SectionCard>
        </>
      ) : null}

      <MutationResultModal
        message={error ?? feedback}
        onClose={() => {
          setError(null);
          setFeedback(null);
        }}
        tone={error ? 'danger' : 'info'}
        visible={Boolean(error ?? feedback)}
      />
    </InGameScreenLayout>
  );
}

function buildAuctionMutationMessage(
  action: 'bid' | 'create',
  response: MarketAuctionMutationResponse,
  itemName: string,
): string {
  if (response.settlement?.winnerPlayerId) {
    return `Leilão resolvido: ${itemName} foi arrematado por ${formatMarketCurrency(response.settlement.grossTotal)}.`;
  }

  return action === 'create'
    ? `Leilão publicado para ${itemName}.`
    : `Lance registrado em ${itemName}.`;
}

function buildMarketMutationMessage(
  side: 'buy' | 'sell',
  response: MarketOrderMutationResponse,
  itemName: string,
): string {
  if (response.matchedTrades.length > 0) {
    const tradedQuantity = response.matchedTrades.reduce((total, trade) => total + trade.quantity, 0);
    return side === 'buy'
      ? `Compra executada: ${itemName} (${tradedQuantity}x).`
      : `Venda executada: ${itemName} (${tradedQuantity}x).`;
  }

  return side === 'buy'
    ? `Ordem de compra aberta para ${itemName}.`
    : `Ordem de venda publicada para ${itemName}.`;
}

function resolveItemTypeFilterLabel(filterId: MarketItemTypeFilter): string {
  if (filterId === 'all') {
    return 'Tudo';
  }

  if (filterId === 'weapon') {
    return 'Armas';
  }

  if (filterId === 'vest') {
    return 'Coletes';
  }

  return 'Drogas';
}

function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral' | 'success';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger'
          ? styles.bannerDanger
          : tone === 'success'
            ? styles.bannerSuccess
            : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

function SectionCard({
  children,
  eyebrow,
  subtitle,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function AuctionCard({
  accent,
  auction,
  children,
  countdown,
  onPress,
}: {
  accent: boolean;
  auction: MarketAuctionSummary;
  children?: ReactNode;
  countdown: string;
  onPress?: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar leilão de ${auction.itemName}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{auction.itemType}</Text>
          <Text style={styles.listCardTitle}>{auction.itemName}</Text>
          <Text style={styles.listCardMeta}>
            Atual {formatMarketCurrency(auction.currentBid ?? auction.startingBid)} · próximo {formatMarketCurrency(auction.minNextBid)}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeLabel}>{countdown}</Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

function OrderCard({
  actionLabel,
  accent,
  children,
  onAction,
  onPress,
  order,
}: {
  actionLabel?: string;
  accent: boolean;
  children?: ReactNode;
  onAction?: () => void;
  onPress?: () => void;
  order: MarketOrderSummary;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar ordem de ${order.itemName}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{order.itemType}</Text>
          <Text style={styles.listCardTitle}>{order.itemName}</Text>
          <Text style={styles.listCardMeta}>
            {order.remainingQuantity}x restantes · {formatMarketCurrency(order.pricePerUnit)}
          </Text>
          <Text style={styles.listCardMetaMuted}>
            {order.sourceType === 'system'
              ? order.sourceLabel ?? 'Fornecedor da rodada'
              : 'Anúncio de jogador'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeLabel}>{order.status}</Text>
        </View>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {children}
    </Pressable>
  );
}

function InventoryItemCard({
  actionLabel,
  accent,
  children,
  item,
  onAction,
  onPress,
}: {
  actionLabel?: string;
  accent: boolean;
  children?: ReactNode;
  item: PlayerInventoryItem;
  onAction?: () => void;
  onPress?: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar item ${item.itemName ?? item.itemType}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{item.itemType}</Text>
          <Text style={styles.listCardTitle}>{item.itemName ?? item.itemType}</Text>
          <Text style={styles.listCardMeta}>
            {item.quantity}x · durabilidade {item.durability ?? '--'}/{item.maxDurability ?? '--'} · prof {item.proficiency}
          </Text>
        </View>
        {item.isEquipped ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeLabel}>equipado</Text>
          </View>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {children}
    </Pressable>
  );
}

function MutationResultModal({
  message,
  onClose,
  tone,
  visible,
}: {
  message: string | null;
  onClose: () => void;
  tone: 'danger' | 'info';
  visible: boolean;
}): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo]}>
          <Text style={styles.modalTitle}>{tone === 'danger' ? 'Ação falhou' : 'Ação executada'}</Text>
          <Text style={styles.modalCopy}>{message}</Text>
          <Pressable
            accessibilityLabel="Fechar resultado do mercado"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.modalButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    gap: 6,
    minWidth: '47%',
    padding: 14,
  },
  summaryValue: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  segmentButtonActive: {
    backgroundColor: '#2f2516',
    borderColor: colors.accent,
  },
  segmentLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  segmentLabelActive: {
    color: colors.text,
  },
  filterCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 20,
    gap: 12,
    padding: 14,
  },
  searchInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: colors.accent,
  },
  filterChipLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  filterChipLabelActive: {
    color: colors.text,
  },
  banner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerNeutral: {
    backgroundColor: colors.panel,
  },
  bannerDanger: {
    backgroundColor: '#3b1f1f',
  },
  bannerSuccess: {
    backgroundColor: '#17311c',
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 22,
    gap: 8,
    padding: 16,
  },
  sectionEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionBody: {
    gap: 12,
    marginTop: 4,
  },
  listColumn: {
    gap: 10,
  },
  notificationCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  notificationCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  listCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  listCardActive: {
    borderColor: colors.accent,
  },
  listCardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  listCardCopy: {
    flex: 1,
    gap: 4,
  },
  listCardEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  listCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listCardMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  listCardMetaMuted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2f2516',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tradeCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  tradeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  tradeCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  tradeHint: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  numericInput: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  numericInputDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 13, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#3b1f1f',
    borderColor: 'rgba(220, 102, 102, 0.32)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  modalButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  modalButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
