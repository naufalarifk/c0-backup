import { Injectable, Logger } from '@nestjs/common';

import {
  AnyPriceFeedWorkerData,
  ExchangeRateFetcherData,
  PriceFeedSource,
  PriceFeedWorkerType,
} from '../pricefeed.types';
import { PriceFeedWorker, PriceFeedWorkerBase } from '../pricefeed-worker.abstract';
import { CoinMarketCapProvider } from '../providers/coinmarketcap.provider';

@Injectable()
@PriceFeedWorker(PriceFeedWorkerType.EXCHANGE_RATE_FETCHER)
export class ExchangeRateFetcherWorker extends PriceFeedWorkerBase<ExchangeRateFetcherData> {
  private readonly logger = new Logger(ExchangeRateFetcherWorker.name);

  constructor(private readonly coinMarketCapProvider: CoinMarketCapProvider) {
    super();
  }

  async processWork(data: ExchangeRateFetcherData): Promise<void> {
    this.logger.log(
      `Fetching exchange rates for ${data.baseCurrencyTokenId}/${data.quoteCurrencyTokenId} on ${data.blockchainKey}`,
    );

    try {
      // Simulate fetching exchange rates from multiple sources
      const results = await this.fetchFromSources(data);

      this.logger.log(
        `Successfully fetched ${results.length} exchange rates for ${data.baseCurrencyTokenId}/${data.quoteCurrencyTokenId}`,
      );

      // Here you would typically queue the results for further processing
      // or directly update the database
      for (const result of results) {
        this.logger.debug(
          `Rate from ${result.source}: bid=${result.bidPrice}, ask=${result.askPrice}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rates for ${data.baseCurrencyTokenId}/${data.quoteCurrencyTokenId}:`,
        error,
      );
      throw error;
    }
  }

  canProcess(data: AnyPriceFeedWorkerData): data is ExchangeRateFetcherData {
    return data.type === PriceFeedWorkerType.EXCHANGE_RATE_FETCHER;
  }

  getPriority(): number {
    return 15; // Higher priority for real-time data fetching
  }

  private async fetchFromSources(data: ExchangeRateFetcherData): Promise<
    Array<{
      source: PriceFeedSource;
      bidPrice: string;
      askPrice: string;
      symbol: string;
      timestamp: Date;
      blockchainKey: string;
    }>
  > {
    const results: Array<{
      source: PriceFeedSource;
      bidPrice: string;
      askPrice: string;
      symbol: string;
      timestamp: Date;
      blockchainKey: string;
    }> = [];

    for (const source of data.sources) {
      try {
        const rate = await this.fetchFromSource(source, data);
        if (rate) {
          results.push(rate);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch from ${source}:`, error);
        // Continue with other sources
      }
    }

    return results;
  }

  private async fetchFromSource(source: PriceFeedSource, data: ExchangeRateFetcherData) {
    const fetchParams = {
      blockchainKey: data.blockchainKey,
      baseCurrencyTokenId: data.baseCurrencyTokenId,
      quoteCurrencyTokenId: data.quoteCurrencyTokenId,
      sources: [source],
    };

    let exchangeRateData;

    switch (source) {
      case PriceFeedSource.COINMARKETCAP:
        if (!(await this.coinMarketCapProvider.isAvailable())) {
          throw new Error('CoinMarketCap provider is not available');
        }
        exchangeRateData = await this.coinMarketCapProvider.fetchExchangeRate(fetchParams);
        break;

      case PriceFeedSource.COINGECKO:
        // TODO: Implement CoinGecko provider
        throw new Error('CoinGecko provider not yet implemented');

      case PriceFeedSource.BINANCE:
      case PriceFeedSource.COINBASE:
      case PriceFeedSource.KRAKEN:
      case PriceFeedSource.BITSTAMP:
        // TODO: Implement other providers
        throw new Error(`${source} provider not yet implemented`);

      default:
        throw new Error(`Unsupported price feed source: ${source}`);
    }

    return {
      source,
      bidPrice: exchangeRateData.bidPrice,
      askPrice: exchangeRateData.askPrice,
      symbol: `${data.baseCurrencyTokenId}${data.quoteCurrencyTokenId}`,
      timestamp: exchangeRateData.sourceDate,
      blockchainKey: data.blockchainKey,
    };
  }
}
