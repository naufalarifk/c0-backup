import type { PriceData, PriceFeedRequest } from '../pricefeed-provider.types';

import { AbstractPriceFeedProvider, PriceFeedProvider } from '../pricefeed-provider.abstract';

@PriceFeedProvider('random')
export class RandomPriceFeedProvider extends AbstractPriceFeedProvider {
  private readonly basePrices: Record<string, number> = {
    'slip44:0': 65000, // BTC in USD
    'slip44:60': 3200, // ETH in USD
    'slip44:714': 650, // BNB in USD
    'slip44:501': 180, // SOL in USD
    'iso4217:usd': 1.0, // USD in USD (stable)
  };

  async fetchPrice(request: PriceFeedRequest): Promise<PriceData> {
    const basePrice = this.basePrices[request.baseCurrencyTokenId];
    const quotePrice = this.basePrices[request.quoteCurrencyTokenId];

    if (!basePrice || !quotePrice) {
      throw new Error(
        `Unsupported currency pair: ${request.baseCurrencyTokenId}/${request.quoteCurrencyTokenId}`,
      );
    }

    const rate = basePrice / quotePrice;

    // Add realistic spread (0.01-0.05%)
    const spread = 0.0001 + Math.random() * 0.0004;
    const bidPrice = rate * (1 - spread / 2);
    const askPrice = rate * (1 + spread / 2);

    // Add small random price variation (±0.5%)
    const variation = 0.995 + Math.random() * 0.01;
    const finalBidPrice = bidPrice * variation;
    const finalAskPrice = askPrice * variation;

    const now = new Date();

    return {
      bidPrice: finalBidPrice.toFixed(12),
      askPrice: finalAskPrice.toFixed(12),
      sourceDate: now,
      retrievalDate: now,
    };
  }
}
