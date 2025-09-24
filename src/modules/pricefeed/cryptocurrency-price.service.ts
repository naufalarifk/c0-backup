import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PriceFeedService } from './pricefeed.service';
import { PriceFeedSource, PriceFeedWorkerType } from './pricefeed.types';

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface RateLimitInfo {
  creditsRemaining: number;
  rateLimitReset?: Date;
  requestsPerMinute?: number;
}

export interface ServiceStatus {
  queueStatus: QueueStatus;
  apiCreditsRemaining?: number;
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Production service for managing cryptocurrency price data collection
 * Handles scheduled price fetches and bulk operations for major cryptocurrencies
 */
@Injectable()
export class CryptocurrencyPriceService {
  private readonly logger = new Logger(CryptocurrencyPriceService.name);

  constructor(private readonly priceFeedService: PriceFeedService) {}

  /**
   * Scheduled task to fetch major cryptocurrency prices every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async fetchMajorCryptoPrices(): Promise<void> {
    this.logger.log('Starting scheduled cryptocurrency price fetch...');

    try {
      const cryptoPairs = [
        {
          blockchainKey: 'bitcoin',
          baseCurrencyTokenId: 'BTC',
          quoteCurrencyTokenId: 'USD',
        },
        {
          blockchainKey: 'ethereum',
          baseCurrencyTokenId: 'ETH',
          quoteCurrencyTokenId: 'USD',
        },
        {
          blockchainKey: 'binancecoin',
          baseCurrencyTokenId: 'BNB',
          quoteCurrencyTokenId: 'USD',
        },
        {
          blockchainKey: 'cardano',
          baseCurrencyTokenId: 'ADA',
          quoteCurrencyTokenId: 'USD',
        },
        {
          blockchainKey: 'solana',
          baseCurrencyTokenId: 'SOL',
          quoteCurrencyTokenId: 'USD',
        },
      ];

      for (const pair of cryptoPairs) {
        await this.priceFeedService.queueExchangeRateFetch({
          ...pair,
          sources: [PriceFeedSource.COINMARKETCAP],
        });
      }

      this.logger.log(`Queued price fetch for ${cryptoPairs.length} cryptocurrency pairs`);
    } catch (error) {
      this.logger.error('Failed to queue scheduled price fetch:', error);
    }
  }

  /**
   * Fetch Bitcoin price immediately for urgent updates
   */
  async fetchBitcoinPriceNow(): Promise<void> {
    this.logger.log('Fetching Bitcoin price immediately...');

    try {
      await this.priceFeedService.processWork({
        type: PriceFeedWorkerType.EXCHANGE_RATE_FETCHER,
        timestamp: new Date(),
        blockchainKey: 'bitcoin',
        baseCurrencyTokenId: 'BTC',
        quoteCurrencyTokenId: 'USD',
        sources: [PriceFeedSource.COINMARKETCAP],
      });

      this.logger.log('Bitcoin price fetch completed successfully');
    } catch (error) {
      this.logger.error('Bitcoin price fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch multiple cryptocurrency prices at once
   */
  async fetchCryptoBulk(): Promise<void> {
    this.logger.log('Starting bulk cryptocurrency price fetch...');

    try {
      const bulkPairs = [
        { baseCurrency: 'BTC', quoteCurrency: 'USD', blockchain: 'bitcoin' },
        { baseCurrency: 'ETH', quoteCurrency: 'USD', blockchain: 'ethereum' },
        { baseCurrency: 'ADA', quoteCurrency: 'USD', blockchain: 'cardano' },
        { baseCurrency: 'DOT', quoteCurrency: 'USD', blockchain: 'polkadot' },
        { baseCurrency: 'LINK', quoteCurrency: 'USD', blockchain: 'chainlink' },
      ];

      const promises = bulkPairs.map(pair =>
        this.priceFeedService.queueExchangeRateFetch({
          blockchainKey: pair.blockchain,
          baseCurrencyTokenId: pair.baseCurrency,
          quoteCurrencyTokenId: pair.quoteCurrency,
          sources: [PriceFeedSource.COINMARKETCAP],
        }),
      );

      await Promise.all(promises);

      this.logger.log(`Bulk queued ${bulkPairs.length} cryptocurrency price fetches`);
    } catch (error) {
      this.logger.error('Bulk cryptocurrency price fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get current service status and queue information
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    try {
      const queueStatus = await this.priceFeedService.getQueueStatus();

      this.logger.log(
        `Price Feed Queue Status - Waiting: ${queueStatus.waiting}, ` +
          `Active: ${queueStatus.active}, Completed: ${queueStatus.completed}, Failed: ${queueStatus.failed}`,
      );

      return {
        queueStatus,
      };
    } catch (error) {
      this.logger.error('Failed to get service status:', error);
      throw error;
    }
  }

  /**
   * Fetch specific cryptocurrency pair on demand
   */
  async fetchCryptocurrencyPair(
    blockchainKey: string,
    baseCurrency: string,
    quoteCurrency: string = 'USD',
  ): Promise<void> {
    this.logger.log(`Fetching ${baseCurrency}/${quoteCurrency} price...`);

    try {
      await this.priceFeedService.processWork({
        type: PriceFeedWorkerType.EXCHANGE_RATE_FETCHER,
        timestamp: new Date(),
        blockchainKey,
        baseCurrencyTokenId: baseCurrency,
        quoteCurrencyTokenId: quoteCurrency,
        sources: [PriceFeedSource.COINMARKETCAP],
      });

      this.logger.log(`Successfully fetched ${baseCurrency}/${quoteCurrency} price`);
    } catch (error) {
      this.logger.error(`Failed to fetch ${baseCurrency}/${quoteCurrency} price:`, error);
      throw error;
    }
  }
}
