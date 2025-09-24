import type { Queue } from 'bullmq';
import type { AnyPriceFeedWorkerData } from './pricefeed.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

export interface QueuePriceFeedWorkerOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

@Injectable()
export class PriceFeedQueueService {
  private readonly logger = new Logger(PriceFeedQueueService.name);

  constructor(
    @InjectQueue('pricefeedQueue')
    private readonly pricefeedQueue: Queue<AnyPriceFeedWorkerData>,
  ) {}

  async queueWork(
    data: AnyPriceFeedWorkerData,
    options: QueuePriceFeedWorkerOptions = {},
  ): Promise<void> {
    try {
      const job = await this.pricefeedQueue.add(`pricefeed-worker-${data.type}`, data, {
        priority: options.priority ?? 10,
        delay: options.delay ?? 0,
        attempts: options.attempts ?? 3,
        backoff: options.backoff ?? {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(`Queued price feed work ${data.type} with job ID: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue price feed work ${data.type}:`, error);
      throw error;
    }
  }

  async queueExchangeRateFetch(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    sources: string[];
    delay?: number;
  }): Promise<void> {
    const { delay, ...workData } = params;
    await this.queueWork(
      {
        type: 'exchange-rate-fetcher' as const,
        timestamp: new Date(),
        ...workData,
      } as AnyPriceFeedWorkerData,
      { delay },
    );
  }

  async queueExchangeRateUpdate(params: {
    priceFeedId: string;
    bidPrice: string;
    askPrice: string;
    source: string;
    sourceDate: Date;
    retrievalDate: Date;
    delay?: number;
  }): Promise<void> {
    const { delay, ...workData } = params;
    await this.queueWork(
      {
        type: 'exchange-rate-updater' as const,
        timestamp: new Date(),
        ...workData,
      } as AnyPriceFeedWorkerData,
      { delay },
    );
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.pricefeedQueue.getWaiting(),
      this.pricefeedQueue.getActive(),
      this.pricefeedQueue.getCompleted(),
      this.pricefeedQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}
