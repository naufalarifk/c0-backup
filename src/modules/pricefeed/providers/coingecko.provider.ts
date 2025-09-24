import { Injectable } from '@nestjs/common';

import { PriceFeedSource } from '../pricefeed.types';
import {
  CurrencyPair,
  ExchangeRateResponse,
  PriceFeedProvider,
  PriceFeedProviderConfig,
} from '../pricefeed-provider.abstract';

@Injectable()
export class CoinGeckoProvider extends PriceFeedProvider {
  private readonly supportedPairs: CurrencyPair[] = [
    { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
    { base: 'ETH', quote: 'USDT', symbol: 'ETHUSDT' },
    { base: 'BTC', quote: 'ETH', symbol: 'BTCETH' },
    // Add more supported pairs as needed
  ];

  constructor() {
    const config: PriceFeedProviderConfig = {
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: {
        requestsPerSecond: 5,
        requestsPerMinute: 100,
      },
      timeout: 10000,
    };

    super(config, PriceFeedSource.COINGECKO);
  }

  async fetchExchangeRate(pair: CurrencyPair): Promise<ExchangeRateResponse> {
    if (!this.supportsCurrencyPair(pair)) {
      throw new Error(`Currency pair ${pair.symbol} not supported by CoinGecko provider`);
    }

    await this.handleRateLimit();

    try {
      // In a real implementation, you would make an HTTP request here
      // For now, we'll simulate the response
      const mockPrice = this.generateMockPrice(pair);

      const response: ExchangeRateResponse = {
        symbol: pair.symbol,
        bidPrice: (mockPrice * 0.999).toFixed(8), // Slightly lower bid
        askPrice: (mockPrice * 1.001).toFixed(8), // Slightly higher ask
        timestamp: new Date(),
        source: this.source,
      };

      if (!this.validateExchangeRate(response)) {
        throw new Error(`Invalid exchange rate data for ${pair.symbol}`);
      }

      this.logger.log(`Fetched rate for ${pair.symbol}: ${response.bidPrice}/${response.askPrice}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to fetch rate for ${pair.symbol} from CoinGecko:`, error);
      throw error;
    }
  }

  supportsCurrencyPair(pair: CurrencyPair): boolean {
    return this.supportedPairs.some(p => p.base === pair.base && p.quote === pair.quote);
  }

  getSupportedPairs(): CurrencyPair[] {
    return [...this.supportedPairs];
  }

  private generateMockPrice(pair: CurrencyPair): number {
    // Mock prices for different pairs
    const mockPrices = {
      BTCUSDT: 45000 + (Math.random() - 0.5) * 1000,
      ETHUSDT: 3000 + (Math.random() - 0.5) * 200,
      BTCETH: 15 + (Math.random() - 0.5) * 1,
    };

    return mockPrices[pair.symbol as keyof typeof mockPrices] || 1;
  }

  /**
   * CoinGecko-specific method to get coin ID mapping
   */
  //   private getCoinId(symbol: string): string {
  //     const coinIdMap: Record<string, string> = {
  //       BTC: 'bitcoin',
  //       ETH: 'ethereum',
  //       USDT: 'tether',
  //       // Add more mappings as needed
  //     };

  //     return coinIdMap[symbol] || symbol.toLowerCase();
  //   }

  /**
   * Example of provider-specific functionality
   */
  async getHistoricalData(
    pair: CurrencyPair,
    days: number = 7,
  ): Promise<
    Array<{
      timestamp: Date;
      price: number;
    }>
  > {
    this.logger.log(`Fetching ${days} days of historical data for ${pair.symbol}`);

    // Mock historical data
    const historicalData: Array<{
      timestamp: Date;
      price: number;
    }> = [];
    const now = Date.now();
    const basePrice = this.generateMockPrice(pair);

    for (let i = days; i >= 0; i--) {
      historicalData.push({
        timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
        price: basePrice * (1 + (Math.random() - 0.5) * 0.1), // ±5% variation
      });
    }

    return historicalData;
  }
}
