import { Logger } from '@nestjs/common';

import { PriceFeedSource } from './pricefeed.types';

export interface PriceFeedProviderConfig {
  apiKey?: string;
  baseUrl: string;
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  timeout?: number;
}

export interface CurrencyPair {
  base: string;
  quote: string;
  symbol: string; // e.g., 'BTCUSDT'
}

export interface ExchangeRateResponse {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  timestamp: Date;
  source: PriceFeedSource;
}

export abstract class PriceFeedProvider {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly config: PriceFeedProviderConfig,
    protected readonly source: PriceFeedSource,
  ) {}

  /**
   * Fetch exchange rate for a specific currency pair
   */
  abstract fetchExchangeRate(pair: CurrencyPair): Promise<ExchangeRateResponse>;

  /**
   * Fetch multiple exchange rates at once
   */
  async fetchMultipleExchangeRates(pairs: CurrencyPair[]): Promise<ExchangeRateResponse[]> {
    // Default implementation: fetch one by one
    const results: ExchangeRateResponse[] = [];

    for (const pair of pairs) {
      try {
        const rate = await this.fetchExchangeRate(pair);
        results.push(rate);
      } catch (error) {
        this.logger.error(`Failed to fetch rate for ${pair.symbol}:`, error);
        // Continue with other pairs
      }
    }

    return results;
  }

  /**
   * Check if the provider supports a specific currency pair
   */
  abstract supportsCurrencyPair(pair: CurrencyPair): boolean;

  /**
   * Get supported currency pairs
   */
  abstract getSupportedPairs(): CurrencyPair[];

  /**
   * Validate exchange rate data
   */
  protected validateExchangeRate(rate: ExchangeRateResponse): boolean {
    if (!rate.bidPrice || !rate.askPrice) {
      return false;
    }

    const bid = parseFloat(rate.bidPrice);
    const ask = parseFloat(rate.askPrice);

    // Basic validation: bid should be less than or equal to ask
    if (bid > ask) {
      this.logger.warn(`Invalid spread: bid (${bid}) > ask (${ask}) for ${rate.symbol}`);
      return false;
    }

    // Check for reasonable values (not zero or negative)
    if (bid <= 0 || ask <= 0) {
      this.logger.warn(`Invalid prices: bid (${bid}), ask (${ask}) for ${rate.symbol}`);
      return false;
    }

    return true;
  }

  /**
   * Handle rate limiting
   */
  protected async handleRateLimit(): Promise<void> {
    if (this.config.rateLimit) {
      // Simple rate limiting - could be enhanced with more sophisticated algorithms
      const delay = 1000 / this.config.rateLimit.requestsPerSecond;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
