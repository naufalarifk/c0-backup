// Exchange Rate Management Types
export interface PlatformRetrievesExchangeRatesParams {
  blockchainKey?: string;
  baseCurrencyTokenId?: string;
  quoteCurrencyTokenId?: string;
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
