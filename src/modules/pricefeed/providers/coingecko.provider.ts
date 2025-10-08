import type { PriceData, PriceFeedRequest } from '../pricefeed-provider.types';

import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { AbstractPriceFeedProvider, PriceFeedProvider } from '../pricefeed-provider.abstract';

interface CoinGeckoPriceResponse {
  [key: string]: {
    [currency: string]: number;
  };
}

@Injectable()
@PriceFeedProvider('coingecko')
export class CoinGeckoPriceFeedProvider extends AbstractPriceFeedProvider {
  private readonly logger = new TelemetryLogger(CoinGeckoPriceFeedProvider.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  private getCoinGeckoId(tokenId: string): string {
    const mapping: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDT: 'tether',
      USDC: 'usd-coin',
      BNB: 'binancecoin',
    };

    return mapping[tokenId.toUpperCase()] || tokenId.toLowerCase();
  }

  async fetchPrice(request: PriceFeedRequest): Promise<PriceData> {
    const baseCoinId = this.getCoinGeckoId(request.baseCurrencyTokenId);
    const quoteCoinId = this.getCoinGeckoId(request.quoteCurrencyTokenId);

    this.logger.debug(`Fetching price from CoinGecko: ${baseCoinId} vs ${quoteCoinId}`);

    try {
      const response = await fetch(
        `${this.baseUrl}/simple/price?ids=${baseCoinId}&vs_currencies=${quoteCoinId}&include_last_updated_at=true`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as CoinGeckoPriceResponse;

      if (!data[baseCoinId] || typeof data[baseCoinId][quoteCoinId] !== 'number') {
        throw new Error('Invalid response from CoinGecko API: missing price data');
      }

      const price = data[baseCoinId][quoteCoinId];
      const retrievalDate = new Date();

      // CoinGecko simple price API doesn't provide bid/ask spread, so we use the same price
      // For more accurate bid/ask, you'd need their pro API or tickers endpoint
      const priceStr = price.toString();

      return {
        bidPrice: priceStr,
        askPrice: priceStr,
        sourceDate: retrievalDate, // CoinGecko simple API doesn't provide detailed timestamps
        retrievalDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch price from CoinGecko for ${baseCoinId}/${quoteCoinId}:`,
        error,
      );
      throw error;
    }
  }
}
