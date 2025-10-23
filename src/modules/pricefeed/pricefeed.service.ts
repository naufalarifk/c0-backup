import type { Queue } from 'bullmq';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { defaultPricefeedConfig } from './pricefeed.config';
import { PriceFeedProviderFactory } from './pricefeed-provider.factory';
import {
  assertPriceFeedSource,
  type PriceFeedRequest,
  type PriceFeedStoreEvent,
} from './pricefeed-provider.types';

@Injectable()
export class PricefeedService {
  private readonly logger = new TelemetryLogger(PricefeedService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly providerFactory: PriceFeedProviderFactory,
    private readonly configService: ConfigService,
    @InjectQueue('pricefeedQueue')
    private readonly pricefeedQueue: Queue,
  ) {}

  /**
   * Fetches prices from providers and dispatches them to the pricefeed queue for storage
   */
  async fetchPrices(): Promise<void> {
    this.logger.log('Starting price feed fetch cycle');

    try {
      const { priceFeeds } = await this.repository.platformRetrievesActivePriceFeeds();
      this.logger.log(`Found ${priceFeeds.length} active price feeds`);

      const fetchTimeout = this.configService.get<number>(
        'PRICEFEED_FETCH_TIMEOUT',
        defaultPricefeedConfig.fetchTimeout,
      );

      const results = await Promise.allSettled(
        priceFeeds.map(async priceFeed => {
          try {
            assertPriceFeedSource(priceFeed.source);

            const provider = this.providerFactory.getProvider(priceFeed.source);

            if (!provider) {
              this.logger.warn(`No provider found for source: ${priceFeed.source}`);
              return;
            }

            const request: PriceFeedRequest = {
              priceFeedId: priceFeed.id,
              blockchainKey: priceFeed.blockchainKey,
              baseCurrencyTokenId: priceFeed.baseCurrencyTokenId,
              quoteCurrencyTokenId: priceFeed.quoteCurrencyTokenId,
              source: priceFeed.source,
            };

            const priceData = await Promise.race([
              provider.fetchPrice(request),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Fetch timeout')), fetchTimeout),
              ),
            ]);

            this.logger.debug(
              `Successfully fetched price for ${priceFeed.baseCurrencyTokenId}/${priceFeed.quoteCurrencyTokenId} from ${priceFeed.source}`,
            );

            // Dispatch to pricefeed queue for storage
            await this.dispatchPriceFeedStoreEvent({
              priceFeedId: priceFeed.id,
              blockchainKey: priceFeed.blockchainKey,
              baseCurrencyTokenId: priceFeed.baseCurrencyTokenId,
              quoteCurrencyTokenId: priceFeed.quoteCurrencyTokenId,
              bidPrice: priceData.bidPrice,
              askPrice: priceData.askPrice,
              retrievalDate: priceData.retrievalDate,
              sourceDate: priceData.sourceDate,
            });
          } catch (error) {
            // this.logger.error(`Failed to fetch price for feed ${priceFeed.id}:`, error);
          }
        }),
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      this.logger.log(`Price fetch cycle completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      this.logger.error('Error during price feed fetch cycle:', error);
      throw error;
    }
  }

  /**
   * Dispatches a price feed store event to the pricefeed queue
   * This can be called by the scheduler or by an admin endpoint to manually set prices
   */
  async dispatchPriceFeedStoreEvent(event: PriceFeedStoreEvent): Promise<void> {
    try {
      await this.pricefeedQueue.add('storePriceFeed', event, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      this.logger.debug(
        `Dispatched price feed store event for ${event.baseCurrencyTokenId}/${event.quoteCurrencyTokenId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch price feed store event: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
