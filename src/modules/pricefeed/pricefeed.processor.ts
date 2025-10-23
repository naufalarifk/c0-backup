import type { Queue } from 'bullmq';
import type { PriceFeedStoreEvent } from './pricefeed-provider.types';

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';
import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Processor('pricefeedQueue')
export class PricefeedProcessor extends WorkerHost {
  private readonly logger = new TelemetryLogger(PricefeedProcessor.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    @InjectQueue('valuationQueue')
    private readonly valuationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'storePriceFeed':
        return await this.handleStorePriceFeed(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return { success: false, message: 'Unknown job type' };
    }
  }

  /**
   * Handles storing price feed data and emitting exchange rate updated event
   */
  private async handleStorePriceFeed(
    job: Job,
  ): Promise<{ success: boolean; exchangeRateId: string }> {
    try {
      const data: unknown = job.data;
      assertDefined(data);

      // Validate event data using typeshaper
      assertPropString(data, 'priceFeedId');
      assertPropString(data, 'blockchainKey');
      assertPropString(data, 'baseCurrencyTokenId');
      assertPropString(data, 'quoteCurrencyTokenId');
      assertProp(check(isString), data, 'bidPrice');
      assertProp(check(isString), data, 'askPrice');
      assertProp(isInstanceOf(Date), data, 'retrievalDate');
      assertProp(isInstanceOf(Date), data, 'sourceDate');

      const event: PriceFeedStoreEvent = {
        priceFeedId: data.priceFeedId,
        blockchainKey: data.blockchainKey,
        baseCurrencyTokenId: data.baseCurrencyTokenId,
        quoteCurrencyTokenId: data.quoteCurrencyTokenId,
        bidPrice: data.bidPrice,
        askPrice: data.askPrice,
        retrievalDate: data.retrievalDate,
        sourceDate: data.sourceDate,
      };

      this.logger.log(
        `Storing price feed: ${event.baseCurrencyTokenId}/${event.quoteCurrencyTokenId}`,
      );

      // Price data from provider is in decimal form
      // The repository's platformFeedsExchangeRate will convert to smallest units with 12 decimals
      const result = await this.repository.platformFeedsExchangeRate({
        priceFeedId: event.priceFeedId,
        bidPrice: event.bidPrice,
        askPrice: event.askPrice,
        retrievalDate: event.retrievalDate,
        sourceDate: event.sourceDate,
      });

      this.logger.debug(
        `Successfully stored price for ${event.baseCurrencyTokenId}/${event.quoteCurrencyTokenId}`,
      );

      // Emit exchange rate updated event to valuation queue
      await this.emitExchangeRateUpdatedEvent({
        exchangeRateId: result.id,
        priceFeedId: result.priceFeedId,
        blockchainKey: event.blockchainKey,
        baseCurrencyTokenId: event.baseCurrencyTokenId,
        quoteCurrencyTokenId: event.quoteCurrencyTokenId,
        bidPrice: result.bidPrice,
        askPrice: result.askPrice,
        retrievalDate: result.retrievalDate,
        sourceDate: result.sourceDate,
      });

      return {
        success: true,
        exchangeRateId: result.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to store price feed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Emits exchange rate updated event to valuation queue for loan valuation processing
   */
  private async emitExchangeRateUpdatedEvent(event: {
    exchangeRateId: string;
    priceFeedId: string;
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    bidPrice: string;
    askPrice: string;
    retrievalDate: Date;
    sourceDate: Date;
  }): Promise<void> {
    try {
      await this.valuationQueue.add('exchangeRateUpdated', event, {
        priority: 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      this.logger.debug(
        `Emitted exchange rate update event for ${event.baseCurrencyTokenId}/${event.quoteCurrencyTokenId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit exchange rate update event: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - we don't want to fail price feed updates if event emission fails
    }
  }
}
