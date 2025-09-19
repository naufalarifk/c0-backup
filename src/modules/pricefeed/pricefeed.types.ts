export enum PriceFeedSource {
  BINANCE = 'binance',
  COINBASE = 'coinbase',
  KRAKEN = 'kraken',
  BITSTAMP = 'bitstamp',
  COINGECKO = 'coingecko',
  COINMARKETCAP = 'coinmarketcap',
  CUSTOM = 'custom',
}

export enum PriceFeedWorkerType {
  EXCHANGE_RATE_FETCHER = 'exchange-rate-fetcher',
  EXCHANGE_RATE_VALIDATOR = 'exchange-rate-validator',
  EXCHANGE_RATE_UPDATER = 'exchange-rate-updater',
}

export interface PriceFeedWorkerData {
  type: PriceFeedWorkerType;
  timestamp: Date;
}

export interface ExchangeRateFetcherData extends PriceFeedWorkerData {
  type: PriceFeedWorkerType.EXCHANGE_RATE_FETCHER;
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  sources: PriceFeedSource[];
}

export interface ExchangeRateValidatorData extends PriceFeedWorkerData {
  type: PriceFeedWorkerType.EXCHANGE_RATE_VALIDATOR;
  exchangeRateId: string;
  priceFeedId: string;
}

export interface ExchangeRateUpdaterData extends PriceFeedWorkerData {
  type: PriceFeedWorkerType.EXCHANGE_RATE_UPDATER;
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  source: PriceFeedSource;
  sourceDate: Date;
  retrievalDate: Date;
}

export type AnyPriceFeedWorkerData =
  | ExchangeRateFetcherData
  | ExchangeRateValidatorData
  | ExchangeRateUpdaterData;

export interface ExchangeRateData {
  bidPrice: string;
  askPrice: string;
  sourceDate: Date;
  retrievalDate: Date;
  metadata?: Record<string, unknown>;
}

export interface FetchExchangeRateParams {
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  sources?: PriceFeedSource[];
}

export interface PriceFeedProvider {
  /**
   * Fetch exchange rate data from the provider
   */
  fetchExchangeRate(params: FetchExchangeRateParams): Promise<ExchangeRateData>;

  /**
   * Check if the provider is currently available
   */
  isAvailable(): Promise<boolean>;
}

export interface PriceFeedConfig {
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  source: PriceFeedSource;
  symbol: string; // e.g., 'BTCUSDT', 'ETHUSDT'
  enabled: boolean;
  fetchInterval: number; // in milliseconds
  validationThreshold: number; // percentage difference threshold for validation
}

export function assertIsPriceFeedSource(source: unknown): asserts source is PriceFeedSource {
  if (!Object.values(PriceFeedSource).includes(source as PriceFeedSource)) {
    throw new Error(`Invalid price feed source: ${source}`);
  }
}

export function assertIsPriceFeedWorkerType(type: unknown): asserts type is PriceFeedWorkerType {
  if (!Object.values(PriceFeedWorkerType).includes(type as PriceFeedWorkerType)) {
    throw new Error(`Invalid price feed worker type: ${type}`);
  }
}
