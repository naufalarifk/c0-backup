import { Inject, Injectable, Logger } from '@nestjs/common';

import { PricefeedRepository } from '../../shared/repositories/pricefeed.repository';
import { AnyPriceFeedWorkerData, PriceFeedSource, PriceFeedWorkerType } from './pricefeed.types';
import { PriceFeedQueueService } from './pricefeed-queue.service';
import { PriceFeedWorkerFactory } from './pricefeed-worker.factory';

@Injectable()
export class PriceFeedService {
  private readonly logger = new Logger(PriceFeedService.name);

  constructor(
    @Inject(PricefeedRepository)
    private readonly repository: PricefeedRepository,
    private readonly workerFactory: PriceFeedWorkerFactory,
    private readonly queueService: PriceFeedQueueService,
  ) {}

  /**
   * Get a worker by type
   */
  getWorkerByType(type: PriceFeedWorkerType) {
    const worker = this.workerFactory.getWorker(type);
    if (!worker) {
      throw new Error(`No worker found for type: ${type}`);
    }
    return worker;
  }

  /**
   * Get a worker that can process the given data
   */
  getWorkerByData(data: AnyPriceFeedWorkerData) {
    const worker = this.workerFactory.getWorkerByData(data);
    if (!worker) {
      throw new Error(`No worker found for data type: ${data.type}`);
    }
    return worker;
  }

  /**
   * Process work data directly (synchronous processing)
   */
  async processWork(data: AnyPriceFeedWorkerData): Promise<void> {
    try {
      const worker = this.getWorkerByData(data);
      await worker.processWork(data);
      this.logger.log(`Successfully processed work: ${data.type}`);
    } catch (error) {
      this.logger.error(`Failed to process work ${data.type}:`, error);
      throw error;
    }
  }

  /**
   * Queue work for asynchronous processing
   */
  async queueWork(data: AnyPriceFeedWorkerData, delay?: number): Promise<void> {
    await this.queueService.queueWork(data, { delay });
  }

  /**
   * Retrieve exchange rates from repository
   */
  async getExchangeRates(params: {
    blockchainKey?: string;
    baseCurrencyTokenId?: string;
    quoteCurrencyTokenId?: string;
  }) {
    return await this.repository.platformRetrievesExchangeRates(params);
  }

  /**
   * Update exchange rate in repository
   */
  async updateExchangeRate(params: {
    priceFeedId: string;
    bidPrice: string;
    askPrice: string;
    retrievalDate: Date;
    sourceDate: Date;
  }) {
    return await this.repository.platformFeedsExchangeRate(params);
  }

  /**
   * Queue exchange rate fetch for specific currency pair
   */
  async queueExchangeRateFetch(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    sources?: PriceFeedSource[];
    delay?: number;
  }): Promise<void> {
    const sources = params.sources ?? [PriceFeedSource.COINMARKETCAP];

    await this.queueService.queueExchangeRateFetch({
      blockchainKey: params.blockchainKey,
      baseCurrencyTokenId: params.baseCurrencyTokenId,
      quoteCurrencyTokenId: params.quoteCurrencyTokenId,
      sources,
      delay: params.delay,
    });
  }

  /**
   * Queue exchange rate update
   */
  async queueExchangeRateUpdate(data: {
    priceFeedId: string;
    bidPrice: string;
    askPrice: string;
    source: PriceFeedSource;
    sourceDate: Date;
    retrievalDate: Date;
  }): Promise<void> {
    await this.queueService.queueExchangeRateUpdate({
      priceFeedId: data.priceFeedId,
      bidPrice: data.bidPrice,
      askPrice: data.askPrice,
      source: data.source,
      sourceDate: data.sourceDate,
      retrievalDate: data.retrievalDate,
    });
  }

  /**
   * Get queue status for monitoring
   */
  async getQueueStatus() {
    return await this.queueService.getQueueStatus();
  }

  /**
   * Find price feed ID for testing
   */
  async findTestPriceFeedId(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    source?: string;
  }) {
    return await this.repository.systemFindsTestPriceFeedId(params);
  }

  /**
   * Create test price feeds
   */
  async createTestPriceFeeds(
    priceFeeds: Array<{
      blockchainKey: string;
      baseCurrencyTokenId: string;
      quoteCurrencyTokenId: string;
      source: string;
    }>,
  ) {
    return await this.repository.systemCreatesTestPriceFeeds({ priceFeeds });
  }
}
