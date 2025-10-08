import type { Queue } from 'bullmq';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { toLowestDenomination } from '../../shared/utils/decimal';
import { defaultPricefeedConfig } from './pricefeed.config';
import { PriceFeedProviderFactory } from './pricefeed-provider.factory';
import { assertPriceFeedSource, type PriceFeedRequest } from './pricefeed-provider.types';

@Injectable()
export class PricefeedService {
  private readonly logger = new Logger(PricefeedService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly providerFactory: PriceFeedProviderFactory,
    private readonly configService: ConfigService,
    @InjectQueue('valuationQueue')
    private readonly valuationQueue: Queue,
  ) {}

  async fetchAndStorePrices(): Promise<void> {
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

            const bidPriceLowest = toLowestDenomination(
              priceData.bidPrice,
              priceFeed.quoteCurrencyDecimals,
            );
            const askPriceLowest = toLowestDenomination(
              priceData.askPrice,
              priceFeed.quoteCurrencyDecimals,
            );

            const result = await this.repository.platformFeedsExchangeRate({
              priceFeedId: priceFeed.id,
              bidPrice: bidPriceLowest,
              askPrice: askPriceLowest,
              retrievalDate: priceData.retrievalDate,
              sourceDate: priceData.sourceDate,
            });

            this.logger.debug(
              `Successfully fetched and stored price for ${priceFeed.baseCurrencyTokenId}/${priceFeed.quoteCurrencyTokenId} from ${priceFeed.source}`,
            );

            // Emit exchange rate updated event to valuation queue
            await this.emitExchangeRateUpdatedEvent({
              exchangeRateId: result.id,
              priceFeedId: result.priceFeedId,
              blockchainKey: priceFeed.blockchainKey,
              baseCurrencyTokenId: priceFeed.baseCurrencyTokenId,
              quoteCurrencyTokenId: priceFeed.quoteCurrencyTokenId,
              bidPrice: result.bidPrice,
              askPrice: result.askPrice,
              retrievalDate: result.retrievalDate,
              sourceDate: result.sourceDate,
            });
          } catch (error) {
            this.logger.error(`Failed to fetch price for feed ${priceFeed.id}:`, error);
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
