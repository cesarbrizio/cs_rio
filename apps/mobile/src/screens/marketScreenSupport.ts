import type { MarketAuctionMutationResponse, MarketOrderMutationResponse } from '@cs-rio/shared';

import { formatMarketCurrency } from '../features/market';

export function buildAuctionMutationMessage(
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

export function buildMarketMutationMessage(
  side: 'buy' | 'sell',
  response: MarketOrderMutationResponse,
  itemName: string,
): string {
  if (response.matchedTrades.length > 0) {
    const tradedQuantity = response.matchedTrades.reduce(
      (total, trade) => total + trade.quantity,
      0,
    );
    return side === 'buy'
      ? `Compra executada: ${itemName} (${tradedQuantity}x).`
      : `Venda executada: ${itemName} (${tradedQuantity}x).`;
  }

  return side === 'buy'
    ? `Ordem de compra aberta para ${itemName}.`
    : `Ordem de venda publicada para ${itemName}.`;
}
