import { Pressable, Text, TextInput, View } from 'react-native';
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
  type MarketItemTypeFilter,
} from '../features/market';
import { colors } from '../theme/colors';
import {
  AuctionCard,
  Banner,
  EmptyState,
  InventoryItemCard,
  MutationResultModal,
  OrderCard,
  resolveItemTypeFilterLabel,
  SectionCard,
  styles,
  SummaryCard,
} from './MarketScreen.parts';
import { useMarketScreenController } from './useMarketScreenController';

type MarketScreenProps = NativeStackScreenProps<RootStackParamList, 'Market'>;

const ITEM_TYPE_FILTERS: MarketItemTypeFilter[] = ['all', 'weapon', 'vest', 'drug'];

export function MarketScreen({ route }: MarketScreenProps): JSX.Element {
  const {
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
  } = useMarketScreenController(route.params?.initialTab);

  return (
    <InGameScreenLayout
      subtitle="Livro de ordens, leilões raros, busca local, filtros por tipo e manutenção do loadout em um mesmo painel clandestino."
      title="Negociar"
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
              style={[styles.segmentLabel, activeTab === tab ? styles.segmentLabelActive : null]}
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

      {isLoading ? (
        <Banner copy="Atualizando mercado, leilões e inventário..." tone="neutral" />
      ) : null}

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
                          Preco alvo {formatMarketCurrency(order.pricePerUnit)} · restante{' '}
                          {order.remainingQuantity}x
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
                          Lance atual{' '}
                          {formatMarketCurrency(auction.currentBid ?? auction.startingBid)} ·
                          próximo mínimo {formatMarketCurrency(auction.minNextBid)} · termina em{' '}
                          {formatAuctionCountdown(auction.endsAt, auctionNowMs)}
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
                          Prof {item.proficiency} · durabilidade {item.durability ?? '--'}/
                          {item.maxDurability ?? '--'}
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
        onClose={dismissResult}
        tone={error ? 'danger' : 'info'}
        visible={Boolean(error ?? feedback)}
      />
    </InGameScreenLayout>
  );
}
