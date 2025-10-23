export type PriceData = {
  bidPrice: string;
  askPrice: string;
  sourceDate: Date;
  retrievalDate: Date;
};

export type PriceFeedRequest = {
  priceFeedId: string;
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  source: string;
};

export type PriceFeedSource = 'binance' | 'coingecko' | 'coinmarketcap' | 'random';

export function isPriceFeedSource(value: string): value is PriceFeedSource {
  return ['binance', 'coingecko', 'coinmarketcap', 'random'].includes(value);
}

export function assertPriceFeedSource(value: string): asserts value is PriceFeedSource {
  if (!isPriceFeedSource(value)) {
    throw new Error(`Invalid price feed source: ${value}`);
  }
}

/**
 * Event payload for storing price feed data
 * This is dispatched to the pricefeedQueue for processing
 */
export type PriceFeedStoreEvent = {
  priceFeedId: string;
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  bidPrice: string; // Decimal string
  askPrice: string; // Decimal string
  retrievalDate: Date;
  sourceDate: Date;
};
