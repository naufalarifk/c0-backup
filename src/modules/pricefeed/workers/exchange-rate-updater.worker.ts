import { Inject, Injectable, Logger } from '@nestjs/common';

import { PricefeedRepository } from '../../../shared/repositories/pricefeed.repository';
import {
  AnyPriceFeedWorkerData,
  ExchangeRateUpdaterData,
  PriceFeedWorkerType,
} from '../pricefeed.types';
import { PriceFeedWorker, PriceFeedWorkerBase } from '../pricefeed-worker.abstract';

@Injectable()
@PriceFeedWorker(PriceFeedWorkerType.EXCHANGE_RATE_UPDATER)
export class ExchangeRateUpdaterWorker extends PriceFeedWorkerBase<ExchangeRateUpdaterData> {
  private readonly logger = new Logger(ExchangeRateUpdaterWorker.name);

  constructor(
    @Inject(PricefeedRepository)
    private readonly repository: PricefeedRepository,
  ) {
    super();
  }

  async processWork(data: ExchangeRateUpdaterData): Promise<void> {
    this.logger.log(
      `Updating exchange rate for price feed ${data.priceFeedId} from source ${data.source}`,
    );

    try {
      const result = await this.repository.platformFeedsExchangeRate({
        priceFeedId: data.priceFeedId,
        bidPrice: data.bidPrice,
        askPrice: data.askPrice,
        retrievalDate: data.retrievalDate,
        sourceDate: data.sourceDate,
      });

      this.logger.log(
        `Successfully updated exchange rate: ID ${result.id}, bid=${result.bidPrice}, ask=${result.askPrice}`,
      );

      // Optional: Trigger additional processing like notifications or validations
      await this.postUpdateProcessing(result);
    } catch (error) {
      this.logger.error(
        `Failed to update exchange rate for price feed ${data.priceFeedId}:`,
        error,
      );
      throw error;
    }
  }

  canProcess(data: AnyPriceFeedWorkerData): data is ExchangeRateUpdaterData {
    return data.type === PriceFeedWorkerType.EXCHANGE_RATE_UPDATER;
  }

  getPriority(): number {
    return 12; // Medium priority for database updates
  }

  getRetryConfig(): {
    attempts: number;
    backoff: { type: 'fixed' | 'exponential'; delay: number };
  } {
    return {
      attempts: 5, // More retries for database operations
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    };
  }

  private async postUpdateProcessing(result: {
    id: string;
    priceFeedId: string;
    bidPrice: string;
    askPrice: string;
    retrievalDate: Date;
    sourceDate: Date;
  }): Promise<void> {
    // Here you could:
    // 1. Trigger LTV calculations for active loans
    // 2. Send notifications for significant price changes
    // 3. Update cache or other derived data
    // 4. Log metrics for monitoring

    this.logger.debug(`Post-update processing for exchange rate ${result.id}`);

    // Example: Check for significant price movements
    await this.checkPriceMovements(result);
  }

  private async checkPriceMovements(result: {
    priceFeedId: string;
    bidPrice: string;
    askPrice: string;
  }): Promise<void> {
    try {
      // Get recent rates for comparison
      const recentRates = await this.repository.platformRetrievesExchangeRates({
        // This would need to be enhanced to filter by priceFeedId
      });

      if (recentRates.exchangeRates.length > 1) {
        const currentMidPrice = (parseFloat(result.bidPrice) + parseFloat(result.askPrice)) / 2;
        const previousRate = recentRates.exchangeRates[1]; // Second most recent
        const previousMidPrice =
          (parseFloat(previousRate.bidPrice) + parseFloat(previousRate.askPrice)) / 2;

        const changePercent = ((currentMidPrice - previousMidPrice) / previousMidPrice) * 100;

        if (Math.abs(changePercent) > 5) {
          // 5% threshold
          this.logger.warn(
            `Significant price movement detected: ${changePercent.toFixed(2)}% for price feed ${result.priceFeedId}`,
          );

          // Here you could trigger alerts or notifications
        }
      }
    } catch (error) {
      this.logger.error('Failed to check price movements:', error);
      // Don't throw - this is optional processing
    }
  }
}
