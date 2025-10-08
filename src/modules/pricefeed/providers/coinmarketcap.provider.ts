import type { PriceData, PriceFeedRequest } from '../pricefeed-provider.types';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { AbstractPriceFeedProvider, PriceFeedProvider } from '../pricefeed-provider.abstract';

interface CoinMarketCapQuoteResponse {
  data: {
    [symbol: string]: {
      quote: {
        [currency: string]: {
          price: number;
          last_updated: string;
        };
      };
    };
  };
}

@Injectable()
@PriceFeedProvider('coinmarketcap')
export class CoinMarketCapPriceFeedProvider extends AbstractPriceFeedProvider {
  private readonly logger = new TelemetryLogger(CoinMarketCapPriceFeedProvider.name);
  private readonly baseUrl = 'https://pro-api.coinmarketcap.com/v1';
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('PRICEFEED_COINMARKETCAP_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn('CoinMarketCap API key not configured');
    }
  }

  async fetchPrice(request: PriceFeedRequest): Promise<PriceData> {
    if (!this.apiKey) {
      throw new Error('CoinMarketCap API key is not configured');
    }

    const baseSymbol = request.baseCurrencyTokenId.toUpperCase();
    const quoteSymbol = request.quoteCurrencyTokenId.toUpperCase();

    this.logger.debug(`Fetching price from CoinMarketCap: ${baseSymbol} vs ${quoteSymbol}`);

    try {
      const url = `${this.baseUrl}/cryptocurrency/quotes/latest?symbol=${baseSymbol}&convert=${quoteSymbol}`;

      const response = await fetch(url, {
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as CoinMarketCapQuoteResponse;

      if (!data.data[baseSymbol]?.quote[quoteSymbol]) {
        throw new Error(`No price data found for ${baseSymbol}/${quoteSymbol}`);
      }

      const priceInfo = data.data[baseSymbol].quote[quoteSymbol];
      const price = priceInfo.price.toString();
      const sourceDate = new Date(priceInfo.last_updated);
      const retrievalDate = new Date();

      // CoinMarketCap doesn't provide bid/ask spread in this endpoint
      return {
        bidPrice: price,
        askPrice: price,
        sourceDate,
        retrievalDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch price from CoinMarketCap for ${baseSymbol}/${quoteSymbol}:`,
        error,
      );
      throw error;
    }
  }
}
