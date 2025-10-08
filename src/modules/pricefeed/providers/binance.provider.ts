import type { PriceData, PriceFeedRequest } from '../pricefeed-provider.types';

import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { AbstractPriceFeedProvider, PriceFeedProvider } from '../pricefeed-provider.abstract';

interface BinanceTickerResponse {
  symbol: string;
  bidPrice: string;
  askPrice: string;
}

@Injectable()
@PriceFeedProvider('binance')
export class BinancePriceFeedProvider extends AbstractPriceFeedProvider {
  private readonly logger = new TelemetryLogger(BinancePriceFeedProvider.name);
  private readonly baseUrl = 'https://api.binance.com/api/v3';

  async fetchPrice(request: PriceFeedRequest): Promise<PriceData> {
    const symbol = `${request.baseCurrencyTokenId}${request.quoteCurrencyTokenId}`.toUpperCase();

    this.logger.debug(`Fetching price from Binance for symbol: ${symbol}`);

    try {
      const response = await fetch(`${this.baseUrl}/ticker/bookTicker?symbol=${symbol}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as BinanceTickerResponse;

      if (!data.bidPrice || !data.askPrice) {
        throw new Error('Invalid response from Binance API: missing price data');
      }

      const retrievalDate = new Date();

      return {
        bidPrice: data.bidPrice,
        askPrice: data.askPrice,
        sourceDate: retrievalDate, // Binance doesn't provide source timestamp
        retrievalDate,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch price from Binance for ${symbol}:`, error);
      throw error;
    }
  }
}
