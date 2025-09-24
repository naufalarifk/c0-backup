import type {
  ExchangeRateData,
  FetchExchangeRateParams,
  PriceFeedProvider,
} from '../pricefeed.types';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CoinMarketCapQuote {
  price: number;
  volume_24h: number;
  volume_change_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  market_cap: number;
  market_cap_dominance?: number;
  fully_diluted_market_cap?: number;
  last_updated: string;
}

export interface CoinMarketCapCurrency {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  num_market_pairs: number;
  date_added: string;
  tags: string[];
  max_supply: number | null;
  circulating_supply: number;
  total_supply: number;
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
  is_active: number;
  infinite_supply: boolean;
  cmc_rank: number;
  is_fiat: number;
  self_reported_circulating_supply: number | null;
  self_reported_market_cap: number | null;
  tvl_ratio: number | null;
  last_updated: string;
  quote: Record<string, CoinMarketCapQuote>;
}

export interface CoinMarketCapResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: Record<string, CoinMarketCapCurrency> | CoinMarketCapCurrency[];
}

export interface CoinMarketCapMapEntry {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number;
  is_active: number;
  first_historical_data: string;
  last_historical_data: string;
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
}

export interface CoinMarketCapMetadata {
  volume24h: number;
  volumeChange24h: number;
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
  marketCap: number;
  cmcRank: number;
  numMarketPairs: number;
  circulatingSupply: number;
  maxSupply: number | null;
  creditsUsed: number;
}

/**
 * CoinMarketCap API provider for fetching cryptocurrency exchange rates
 *
 * Supports both latest quotes and historical data fetching.
 * Uses CMC IDs for more reliable identification of cryptocurrencies.
 *
 * @see https://coinmarketcap.com/api/documentation/v1/
 */
@Injectable()
export class CoinMarketCapProvider implements PriceFeedProvider {
  private readonly logger = new Logger(CoinMarketCapProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://pro-api.coinmarketcap.com';

  // Cache for symbol to CMC ID mapping
  private readonly symbolToIdCache = new Map<string, number>();
  private cacheExpiry = 0;
  private readonly cacheTtl = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PRICEFEED_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn('CoinMarketCap API key not found in environment variables');
    } else {
      this.logger.log('CoinMarketCap API key configured successfully');
    }
  }

  /**
   * Make HTTP requests using native fetch API
   */
  private async makeRequest<T = unknown>(
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    // Add query parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    this.logger.debug(`Making request to: ${endpoint}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = (await response.json()) as T;

      // Log credits used if available
      if (typeof data === 'object' && data !== null && 'status' in data) {
        const responseWithStatus = data as { status?: { credit_count?: number } };
        const credits = responseWithStatus.status?.credit_count || 0;
        this.logger.debug(`Request completed. Credits used: ${credits}`);
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          this.logger.error('Request timed out after 30 seconds');
          throw new Error('Request timeout');
        }
        this.logger.error('Request error:', error.message);
      } else {
        this.logger.error('Unknown error occurred:', String(error));
      }
      throw error;
    }
  }

  /**
   * Handle HTTP error responses
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData?.status?.error_message || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    if (response.status === 429) {
      this.logger.warn(
        'Rate limit exceeded. Consider upgrading your plan or reducing request frequency.',
      );
    } else if (response.status === 401) {
      this.logger.error('Authentication failed. Check your API key.');
    } else if (response.status === 403) {
      this.logger.error('Forbidden. Your API plan may not support this endpoint.');
    }

    this.logger.error(`API Error: ${response.status} - ${errorMessage}`);
    throw new Error(`API Error: ${response.status} - ${errorMessage}`);
  }

  /**
   * Check if API key is configured
   */
  get hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get masked API key for debugging (shows first 8 and last 4 characters)
   */
  get maskedApiKey(): string {
    if (!this.apiKey) return 'NOT_CONFIGURED';
    return this.apiKey.length > 12
      ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
      : this.apiKey.substring(0, 4) + '***';
  }

  /**
   * Check if the CoinMarketCap API is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.makeRequest<{
        status: {
          error_code: number;
        };
      }>('/v1/key/info');
      return response.status?.error_code === 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('CoinMarketCap API availability check failed:', errorMessage);
      return false;
    }
  }

  /**
   * Fetch exchange rate data from CoinMarketCap
   *
   * @param params - Parameters for fetching exchange rate
   * @returns Exchange rate data
   */
  async fetchExchangeRate(params: FetchExchangeRateParams): Promise<ExchangeRateData> {
    const { baseCurrencyTokenId, quoteCurrencyTokenId } = params;

    try {
      // Get CMC ID for base currency
      const baseCmcId = await this.getCmcId(baseCurrencyTokenId);
      if (!baseCmcId) {
        throw new Error(`Could not find CoinMarketCap ID for ${baseCurrencyTokenId}`);
      }

      // Fetch latest quotes
      const response = await this.makeRequest<CoinMarketCapResponse>(
        '/v2/cryptocurrency/quotes/latest',
        {
          id: baseCmcId.toString(),
          convert: quoteCurrencyTokenId,
          aux: 'num_market_pairs,cmc_rank,date_added,tags,platform,max_supply,circulating_supply,total_supply',
        },
      );

      if (response.status.error_code !== 0) {
        throw new Error(`CoinMarketCap API error: ${response.status.error_message}`);
      }

      const data = response.data as Record<string, CoinMarketCapCurrency>;
      const currencyData = data[baseCmcId.toString()];

      if (!currencyData) {
        throw new Error(`No data found for ${baseCurrencyTokenId} (ID: ${baseCmcId})`);
      }

      const quote = currencyData.quote[quoteCurrencyTokenId];
      if (!quote) {
        throw new Error(`No quote found for ${baseCurrencyTokenId}/${quoteCurrencyTokenId}`);
      }

      // For CoinMarketCap, bid/ask spread is not directly available
      // We'll use the price as both bid and ask, or apply a small spread
      const price = quote.price;
      const spread = price * 0.001; // 0.1% spread estimation

      const exchangeRateData: ExchangeRateData = {
        bidPrice: (price - spread / 2).toString(),
        askPrice: (price + spread / 2).toString(),
        sourceDate: new Date(quote.last_updated),
        retrievalDate: new Date(),
        metadata: {
          volume24h: quote.volume_24h,
          volumeChange24h: quote.volume_change_24h,
          percentChange1h: quote.percent_change_1h,
          percentChange24h: quote.percent_change_24h,
          percentChange7d: quote.percent_change_7d,
          percentChange30d: quote.percent_change_30d,
          marketCap: quote.market_cap,
          cmcRank: currencyData.cmc_rank,
          numMarketPairs: currencyData.num_market_pairs,
          circulatingSupply: currencyData.circulating_supply,
          maxSupply: currencyData.max_supply,
          creditsUsed: response.status.credit_count,
        },
      };

      this.logger.log(
        `Fetched ${baseCurrencyTokenId}/${quoteCurrencyTokenId} rate: ` +
          `${exchangeRateData.bidPrice}-${exchangeRateData.askPrice} (Credits: ${response.status.credit_count})`,
      );

      return exchangeRateData;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch exchange rate for ${baseCurrencyTokenId}/${quoteCurrencyTokenId}:`,
        errorMessage,
      );
      throw error;
    }
  }

  /**
   * Get CoinMarketCap ID for a cryptocurrency symbol
   * Uses caching to minimize API calls
   *
   * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'ETH')
   * @returns CoinMarketCap ID or null if not found
   */
  private async getCmcId(symbol: string): Promise<number | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    if (this.symbolToIdCache.has(upperSymbol) && Date.now() < this.cacheExpiry) {
      return this.symbolToIdCache.get(upperSymbol) || null;
    }

    // Refresh cache if expired or empty
    if (Date.now() >= this.cacheExpiry) {
      await this.refreshIdCache();
    }

    return this.symbolToIdCache.get(upperSymbol) || null;
  }

  /**
   * Refresh the symbol to CMC ID cache
   * Fetches the latest cryptocurrency map from CoinMarketCap
   */
  private async refreshIdCache(): Promise<void> {
    try {
      this.logger.debug('Refreshing CoinMarketCap ID cache...');

      const response = await this.makeRequest<{
        data: CoinMarketCapMapEntry[];
        status: CoinMarketCapResponse['status'];
      }>('/v1/cryptocurrency/map', {
        listing_status: 'active',
        limit: '5000', // Get top 5000 currencies
        sort: 'cmc_rank',
      });

      if (response.status.error_code !== 0) {
        throw new Error(`Failed to fetch cryptocurrency map: ${response.status.error_message}`);
      }

      // Clear cache and repopulate
      this.symbolToIdCache.clear();

      for (const currency of response.data) {
        // Use the highest ranked currency for duplicate symbols
        if (
          !this.symbolToIdCache.has(currency.symbol) ||
          currency.rank < (this.symbolToIdCache.get(currency.symbol) || Infinity)
        ) {
          this.symbolToIdCache.set(currency.symbol, currency.id);
        }
      }

      // Set cache expiry
      this.cacheExpiry = Date.now() + this.cacheTtl;

      this.logger.debug(`Cached ${this.symbolToIdCache.size} cryptocurrency mappings`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to refresh CMC ID cache:', errorMessage);
      // Don't throw error, just log it - we can still try to work with existing cache
    }
  }

  /**
   * Get API usage information
   * Useful for monitoring credit consumption
   */
  async getApiUsage(): Promise<{
    plan: string;
    creditLimitDaily: number;
    creditLimitMonthly: number;
    creditLimitDailyUsed: number;
    creditLimitMonthlyUsed: number;
    creditLimitDailyReset: string;
    creditLimitMonthlyReset: string;
    rateLimit: number;
  } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await this.makeRequest<{
        status: { error_code: number };
        data: {
          plan: {
            name: string;
            credit_limit_daily: number;
            credit_limit_monthly: number;
            rate_limit_request_per_minute: number;
          };
          usage: {
            current_day: {
              credits_used: number;
              credits_left: number;
            };
            current_month: {
              credits_used: number;
              credits_left: number;
            };
          };
        };
      }>('/v1/key/info');

      if (response.status.error_code !== 0) {
        return null;
      }

      return {
        plan: response.data.plan.name,
        creditLimitDaily: response.data.plan.credit_limit_daily,
        creditLimitMonthly: response.data.plan.credit_limit_monthly,
        creditLimitDailyUsed: response.data.usage.current_day.credits_used,
        creditLimitMonthlyUsed: response.data.usage.current_month.credits_used,
        creditLimitDailyReset: response.data.usage.current_day.credits_left.toString(),
        creditLimitMonthlyReset: response.data.usage.current_month.credits_left.toString(),
        rateLimit: response.data.plan.rate_limit_request_per_minute,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get API usage info:', errorMessage);
      return null;
    }
  }

  /**
   * Bulk fetch exchange rates for multiple currency pairs
   * More efficient than individual calls when fetching many pairs
   *
   * @param pairs - Array of currency pairs to fetch
   * @returns Array of exchange rate data
   */
  async fetchMultipleExchangeRates(pairs: FetchExchangeRateParams[]): Promise<ExchangeRateData[]> {
    if (pairs.length === 0) {
      return [];
    }

    // Group by quote currency for more efficient API usage
    const quoteGroups = new Map<string, FetchExchangeRateParams[]>();

    for (const pair of pairs) {
      const quote = pair.quoteCurrencyTokenId;
      if (!quoteGroups.has(quote)) {
        quoteGroups.set(quote, []);
      }
      quoteGroups.get(quote)!.push(pair);
    }

    const results: ExchangeRateData[] = [];

    for (const [quoteCurrency, quotePairs] of Array.from(quoteGroups.entries())) {
      try {
        // Get CMC IDs for all base currencies in this group
        const cmcIds: number[] = [];
        const pairMap = new Map<number, FetchExchangeRateParams>();

        for (const pair of quotePairs) {
          const cmcId = await this.getCmcId(pair.baseCurrencyTokenId);
          if (cmcId) {
            cmcIds.push(cmcId);
            pairMap.set(cmcId, pair);
          }
        }

        if (cmcIds.length === 0) {
          continue;
        }

        // Fetch quotes for all currencies in this group
        const response = await this.makeRequest<CoinMarketCapResponse>(
          '/v2/cryptocurrency/quotes/latest',
          {
            id: cmcIds.join(','),
            convert: quoteCurrency,
            aux: 'num_market_pairs,cmc_rank',
          },
        );

        if (response.status.error_code !== 0) {
          this.logger.error(`Bulk fetch error: ${response.status.error_message}`);
          continue;
        }

        const data = response.data as Record<string, CoinMarketCapCurrency>;

        // Process each currency in the response
        for (const [cmcIdStr, currencyData] of Object.entries(data)) {
          const cmcId = parseInt(cmcIdStr);
          const pair = pairMap.get(cmcId);

          if (!pair) continue;

          const quote = currencyData.quote[quoteCurrency];
          if (!quote) continue;

          const price = quote.price;
          const spread = price * 0.001; // 0.1% spread estimation

          results.push({
            bidPrice: (price - spread / 2).toString(),
            askPrice: (price + spread / 2).toString(),
            sourceDate: new Date(quote.last_updated),
            retrievalDate: new Date(),
            metadata: {
              volume24h: quote.volume_24h,
              percentChange24h: quote.percent_change_24h,
              marketCap: quote.market_cap,
              cmcRank: currencyData.cmc_rank,
              numMarketPairs: currencyData.num_market_pairs,
              baseCurrency: pair.baseCurrencyTokenId,
              quoteCurrency: pair.quoteCurrencyTokenId,
            },
          });
        }

        this.logger.log(
          `Bulk fetched ${results.length} exchange rates for quote currency: ${quoteCurrency}`,
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to bulk fetch rates for quote currency ${quoteCurrency}:`,
          errorMessage,
        );
      }
    }

    return results;
  }
}
