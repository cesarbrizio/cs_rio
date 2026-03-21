import {
  formatAuctionCountdown,
  formatMarketCurrency,
  resolveMarketTabLabel,
  useMarketController,
} from '@cs-rio/ui/hooks';
import { useState } from 'react';

import { Badge, Button, Card, Tabs } from '../components/ui';
import { inventoryApi, marketApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

const marketTabs = ['buy', 'sell', 'auction', 'repair'] as const;

export function MarketScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [buyQuantity, setBuyQuantity] = useState('1');
  const [sellPrice, setSellPrice] = useState('1500');
  const [sellQuantity, setSellQuantity] = useState('1');
  const [bidAmount, setBidAmount] = useState('2500');
  const [auctionStartingBid, setAuctionStartingBid] = useState('2000');
  const [auctionBuyoutPrice, setAuctionBuyoutPrice] = useState('5000');
  const [auctionDurationMinutes, setAuctionDurationMinutes] = useState('60');
  const {
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
  } = useMarketController({
    inventoryApi,
    marketApi,
    playerInventory: player?.inventory ?? [],
    refreshPlayerProfile,
  });

  if (!player) {
    return <></>;
  }

  const tabs = marketTabs.map((tab) => ({
    id: tab,
    label: resolveMarketTabLabel(tab),
  }));
  const feeRate = orderBook?.marketFeeRate ?? auctionBook?.marketFeeRate ?? 0;

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => void loadMarket()} variant="secondary">
              {isLoading ? 'Sincronizando...' : 'Atualizar mercado'}
            </Button>
            <Button onClick={() => setActiveTab('repair')} variant="ghost">
              Ir para reparo
            </Button>
          </>
        }
        badges={[
          { label: `${sellOrders.length} ordens`, tone: 'info' },
          { label: `${marketAuctions.length} leiloes`, tone: 'warning' },
          { label: `${feeRate}% taxa`, tone: 'neutral' },
        ]}
        description="Compre, venda, repare equipamento e dispute leiloes no mesmo balcão clandestino."
        title="Negociar"
      />

      {feedback ? <FeedbackCard message={feedback} title="Mercado atualizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no mercado" tone="danger" /> : null}

      <Card className="desktop-panel">
        <Tabs activeId={activeTab} items={tabs} onChange={(value) => setActiveTab(value as typeof activeTab)} />
        <div className="desktop-filter-row">
          <FormField label="Buscar item">
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="arma, colete, droga..."
              value={search}
            />
          </FormField>
          <FormField label="Filtro de tipo">
            <select
              onChange={(event) => setItemTypeFilter(event.target.value as typeof itemTypeFilter)}
              value={itemTypeFilter}
            >
              <option value="all">Tudo</option>
              <option value="weapon">Arma</option>
              <option value="vest">Colete</option>
              <option value="drug">Droga</option>
              <option value="component">Componente</option>
              <option value="consumable">Consumivel</option>
              <option value="boost">Boost</option>
              <option value="property_upgrade">Upgrade</option>
            </select>
          </FormField>
        </div>
      </Card>

      <div className="desktop-metric-grid">
        <MetricCard label="Caixa" tone="warning" value={formatMarketCurrency(player.resources.money)} />
        <MetricCard label="Banco" tone="info" value={formatMarketCurrency(player.resources.bankMoney)} />
        <MetricCard label="Minhas ordens" tone="neutral" value={`${myOrders.length}`} />
        <MetricCard label="Meus leiloes" tone="success" value={`${myAuctions.length}`} />
      </div>

      <div className="desktop-market-grid">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>{resolveLeftTitle(activeTab)}</h3>
            <Badge tone="neutral">{resolveLeftCount(activeTab, { auctionableItems, marketAuctions, repairableItems, sellOrders, sellableItems })}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {activeTab === 'buy'
              ? sellOrders.map((order) => (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedBuyOrder?.id === order.id ? 'desktop-list-row--active' : ''}`}
                    key={order.id}
                    onClick={() => setSelectedBuyOrderId(order.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{order.itemName}</strong>
                      <Badge tone="warning">{formatMarketCurrency(order.pricePerUnit)}</Badge>
                    </div>
                    <small>Qtd restante {order.remainingQuantity}</small>
                    <small>{order.sourceLabel ?? 'mercado player'} · {order.itemType}</small>
                  </button>
                ))
              : null}

            {activeTab === 'sell'
              ? sellableItems.map((item) => (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedInventoryItem?.id === item.id ? 'desktop-list-row--active' : ''}`}
                    key={item.id}
                    onClick={() => setSelectedInventoryItemId(item.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{item.itemName ?? item.itemType}</strong>
                      <Badge tone="info">{item.quantity}</Badge>
                    </div>
                    <small>{item.itemType} · peso {item.totalWeight}</small>
                    <small>{item.stackable ? 'Empilhavel' : 'Unico'} · durabilidade {resolveDurability(item)}</small>
                  </button>
                ))
              : null}

            {activeTab === 'auction'
              ? marketAuctions.map((auction) => (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedAuction?.id === auction.id ? 'desktop-list-row--active' : ''}`}
                    key={auction.id}
                    onClick={() => setSelectedAuctionId(auction.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{auction.itemName}</strong>
                      <Badge tone="warning">{formatAuctionCountdown(auction.endsAt, nowMs)}</Badge>
                    </div>
                    <small>
                      Lance atual {formatMarketCurrency(auction.currentBid ?? auction.startingBid)} · proximo {formatMarketCurrency(auction.minNextBid)}
                    </small>
                    <small>{auction.itemType}</small>
                  </button>
                ))
              : null}

            {activeTab === 'repair'
              ? repairableItems.map((item) => (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedInventoryItem?.id === item.id ? 'desktop-list-row--active' : ''}`}
                    key={item.id}
                    onClick={() => setSelectedInventoryItemId(item.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{item.itemName ?? item.itemType}</strong>
                      <Badge tone="danger">{resolveDurability(item)}</Badge>
                    </div>
                    <small>{item.itemType} · proficiencia {item.proficiency}</small>
                  </button>
                ))
              : null}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {activeTab === 'buy' ? (
            <>
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Comprar ordem selecionada</h3>
                  <Badge tone="info">{selectedBuyOrder?.itemName ?? 'Sem ordem'}</Badge>
                </div>
                {selectedBuyOrder ? (
                  <>
                    <div className="desktop-grid-3">
                      <MetricCard label="Preco unitario" tone="warning" value={formatMarketCurrency(selectedBuyOrder.pricePerUnit)} />
                      <MetricCard label="Qtd restante" tone="neutral" value={`${selectedBuyOrder.remainingQuantity}`} />
                      <MetricCard label="Tipo" tone="info" value={selectedBuyOrder.itemType} />
                    </div>
                    <FormField label="Quantidade">
                      <input
                        onChange={(event) => setBuyQuantity(event.target.value)}
                        value={buyQuantity}
                      />
                    </FormField>
                    <Button
                      disabled={!selectedBuyOrder || isSubmitting}
                      onClick={() => void buySelectedOrder(buyQuantity)}
                      variant="primary"
                    >
                      {isSubmitting ? 'Comprando...' : 'Comprar agora'}
                    </Button>
                  </>
                ) : (
                  <p>Escolha uma ordem do livro para comprar.</p>
                )}
              </Card>

              <Card className="desktop-panel">
                <h3>Minhas ordens</h3>
                <div className="desktop-scroll-list">
                  {myOrders.map((order) => (
                    <div className="desktop-list-row" key={order.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{order.itemName}</strong>
                        <Badge tone="neutral">{order.side}</Badge>
                      </div>
                      <small>
                        {formatMarketCurrency(order.pricePerUnit)} · restante {order.remainingQuantity}
                      </small>
                      <Button
                        disabled={isSubmitting}
                        onClick={() => void cancelOrder(order.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'sell' ? (
            <>
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Anunciar item</h3>
                  <Badge tone="info">{selectedInventoryItem?.itemName ?? 'Sem item'}</Badge>
                </div>
                {selectedInventoryItem ? (
                  <>
                    <div className="desktop-grid-3">
                      <MetricCard label="Disponivel" value={`${selectedInventoryItem.quantity}`} />
                      <MetricCard label="Tipo" tone="neutral" value={selectedInventoryItem.itemType} />
                      <MetricCard label="Durabilidade" tone="warning" value={resolveDurability(selectedInventoryItem)} />
                    </div>
                    <div className="desktop-grid-2">
                      <FormField label="Preco unitario">
                        <input
                          onChange={(event) => setSellPrice(event.target.value)}
                          value={sellPrice}
                        />
                      </FormField>
                      <FormField label="Quantidade">
                        <input
                          onChange={(event) => setSellQuantity(event.target.value)}
                          value={sellQuantity}
                        />
                      </FormField>
                    </div>
                    <Button
                      disabled={isSubmitting}
                      onClick={() => void sellInventoryItem(sellPrice, sellQuantity)}
                      variant="primary"
                    >
                      {isSubmitting ? 'Anunciando...' : 'Criar ordem de venda'}
                    </Button>
                  </>
                ) : (
                  <p>Escolha um item vendavel do inventario.</p>
                )}
              </Card>

              <Card className="desktop-panel">
                <h3>Minhas ordens ativas</h3>
                <div className="desktop-scroll-list">
                  {myOrders.map((order) => (
                    <div className="desktop-list-row" key={order.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{order.itemName}</strong>
                        <Badge tone="warning">{formatMarketCurrency(order.pricePerUnit)}</Badge>
                      </div>
                      <small>Qtd {order.remainingQuantity} · lado {order.side}</small>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'auction' ? (
            <>
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Leilao selecionado</h3>
                  <Badge tone="warning">{selectedAuction?.itemName ?? 'Sem leilao'}</Badge>
                </div>
                {selectedAuction ? (
                  <>
                    <div className="desktop-grid-3">
                      <MetricCard label="Lance atual" tone="warning" value={formatMarketCurrency(selectedAuction.currentBid ?? selectedAuction.startingBid)} />
                      <MetricCard label="Min proximo" tone="danger" value={formatMarketCurrency(selectedAuction.minNextBid)} />
                      <MetricCard label="Encerra" tone="info" value={formatAuctionCountdown(selectedAuction.endsAt, nowMs)} />
                    </div>
                    <FormField label="Lance">
                      <input
                        onChange={(event) => setBidAmount(event.target.value)}
                        value={bidAmount}
                      />
                    </FormField>
                    <Button
                      disabled={isSubmitting}
                      onClick={() => void bidSelectedAuction(bidAmount)}
                      variant="primary"
                    >
                      {isSubmitting ? 'Enviando lance...' : 'Dar lance'}
                    </Button>
                  </>
                ) : (
                  <p>Escolha um leilao aberto para ofertar.</p>
                )}
              </Card>

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Criar leilao</h3>
                  <Badge tone="info">{auctionableItems.length} elegiveis</Badge>
                </div>
                <FormField label="Item">
                  <select
                    onChange={(event) => setSelectedInventoryItemId(event.target.value)}
                    value={selectedInventoryItem?.id ?? ''}
                  >
                    <option value="">Selecione</option>
                    {auctionableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.itemName ?? item.itemType}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="desktop-grid-3">
                  <FormField label="Lance inicial">
                    <input
                      onChange={(event) => setAuctionStartingBid(event.target.value)}
                      value={auctionStartingBid}
                    />
                  </FormField>
                  <FormField label="Buyout">
                    <input
                      onChange={(event) => setAuctionBuyoutPrice(event.target.value)}
                      value={auctionBuyoutPrice}
                    />
                  </FormField>
                  <FormField label="Duracao (min)">
                    <input
                      onChange={(event) => setAuctionDurationMinutes(event.target.value)}
                      value={auctionDurationMinutes}
                    />
                  </FormField>
                </div>
                <Button
                  disabled={isSubmitting || !selectedInventoryItem}
                  onClick={() =>
                    void createAuctionForItem({
                      buyoutPriceInput: auctionBuyoutPrice,
                      durationMinutesInput: auctionDurationMinutes,
                      startingBidInput: auctionStartingBid,
                    })
                  }
                  variant="primary"
                >
                  {isSubmitting ? 'Criando...' : 'Criar leilao'}
                </Button>
              </Card>

              <Card className="desktop-panel">
                <h3>Meus leiloes</h3>
                <div className="desktop-scroll-list">
                  {myAuctions.map((auction) => (
                    <div className="desktop-list-row" key={auction.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{auction.itemName}</strong>
                        <Badge tone="warning">{formatAuctionCountdown(auction.endsAt, nowMs)}</Badge>
                      </div>
                      <small>
                        Lance atual {formatMarketCurrency(auction.currentBid ?? auction.startingBid)}
                      </small>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'repair' ? (
            <>
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Reparo de loadout</h3>
                  <Badge tone="danger">{selectedInventoryItem ? resolveDurability(selectedInventoryItem) : '--'}</Badge>
                </div>
                {selectedInventoryItem ? (
                  <>
                    <div className="desktop-grid-3">
                      <MetricCard label="Item" tone="neutral" value={selectedInventoryItem.itemName ?? selectedInventoryItem.itemType} />
                      <MetricCard label="Tipo" tone="info" value={selectedInventoryItem.itemType} />
                      <MetricCard label="Durabilidade" tone="danger" value={resolveDurability(selectedInventoryItem)} />
                    </div>
                    <Button
                      disabled={isSubmitting}
                      onClick={() => void repairInventoryItem(selectedInventoryItem.id)}
                      variant="primary"
                    >
                      {isSubmitting ? 'Reparando...' : 'Reparar item'}
                    </Button>
                  </>
                ) : (
                  <p>Escolha um item com desgaste para reparar.</p>
                )}
              </Card>

              <Card className="desktop-panel">
                <h3>Notificacoes de leilao</h3>
                <div className="desktop-scroll-list">
                  {(auctionBook?.notifications ?? []).map((notification) => (
                    <div className="desktop-list-row" key={notification.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{notification.title}</strong>
                        <Badge tone="info">{notification.type}</Badge>
                      </div>
                      <small>{notification.message}</small>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function resolveDurability(item: {
  durability: number | null;
  maxDurability: number | null;
}): string {
  if (item.durability === null || item.maxDurability === null) {
    return '--';
  }

  return `${item.durability}/${item.maxDurability}`;
}

function resolveLeftTitle(
  activeTab: 'auction' | 'buy' | 'repair' | 'sell',
): string {
  if (activeTab === 'buy') {
    return 'Livro de ordens';
  }

  if (activeTab === 'sell') {
    return 'Itens do inventario';
  }

  if (activeTab === 'auction') {
    return 'Leiloes abertos';
  }

  return 'Itens para reparo';
}

function resolveLeftCount(
  activeTab: 'auction' | 'buy' | 'repair' | 'sell',
  values: {
    auctionableItems: unknown[];
    marketAuctions: unknown[];
    repairableItems: unknown[];
    sellOrders: unknown[];
    sellableItems: unknown[];
  },
): string {
  if (activeTab === 'buy') {
    return `${values.sellOrders.length}`;
  }

  if (activeTab === 'sell') {
    return `${values.sellableItems.length}`;
  }

  if (activeTab === 'auction') {
    return `${values.marketAuctions.length}`;
  }

  if (values.repairableItems.length > 0) {
    return `${values.repairableItems.length}`;
  }

  return `${values.auctionableItems.length}`;
}
