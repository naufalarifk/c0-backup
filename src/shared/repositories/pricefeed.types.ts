// Exchange Rate Management Types
export interface PlatformRetrievesExchangeRatesParams {
  blockchainKey?: string;
  baseCurrencyTokenId?: string;
  quoteCurrencyTokenId?: string;
  limit?: number;
  offset?: number;
}

export interface ExchangeRate {
  id: string;
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
  blockchain: string;
  baseCurrency: string;
  quoteCurrency: string;
  source: string;
}

export interface PlatformRetrievesExchangeRatesResult {
  exchangeRates: ExchangeRate[];
}

export interface PlatformFeedsExchangeRateParams {
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
}

export interface PlatformFeedsExchangeRateResult {
  id: string;
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
}

// New interfaces for simplified architecture
export interface PriceFeed {
  id: string;
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  source: string;
  quoteCurrencyDecimals: number;
}

export interface PlatformRetrievesActivePriceFeedsResult {
  priceFeeds: PriceFeed[];
}

// Enhanced types for Finance Config API
export interface CurrencyInfo {
  blockchainKey: string;
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
}

export interface EnhancedExchangeRate {
  id: number;
  baseAsset: CurrencyInfo;
  quoteAsset: CurrencyInfo;
  bidPrice: string;
  askPrice: string;
  midPrice: string;
  source: string;
  sourceDate: string;
  retrievalDate: string;
}

export interface UserViewsExchangeRatesParams {
  baseCurrencyBlockchainKey?: string;
  baseCurrencyTokenId?: string;
  quoteCurrencyBlockchainKey?: string;
  quoteCurrencyTokenId?: string;
  source?: string;
}

export interface UserViewsExchangeRatesResult {
  exchangeRates: EnhancedExchangeRate[];
  lastUpdated: string;
}
