import type { AnyPriceFeedWorkerData, PriceFeedWorkerType } from './pricefeed.types';

import { DiscoveryService } from '@nestjs/core';

export const PriceFeedWorker = DiscoveryService.createDecorator<PriceFeedWorkerType>();

export abstract class PriceFeedWorkerBase<
  T extends AnyPriceFeedWorkerData = AnyPriceFeedWorkerData,
> {
  abstract processWork(data: T): Promise<void>;

  /**
   * Validate if this worker can process the given data
   */
  abstract canProcess(data: AnyPriceFeedWorkerData): data is T;

  /**
   * Get the priority for this worker (higher number = higher priority)
   */
  getPriority(): number {
    return 10;
  }

  /**
   * Get retry configuration for failed jobs
   */
  getRetryConfig(): {
    attempts: number;
    backoff: { type: 'fixed' | 'exponential'; delay: number };
  } {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };
  }
}
