import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { PriceFeedService } from './pricefeed.service';
import { AnyPriceFeedWorkerData } from './pricefeed.types';

@Processor('pricefeedQueue')
export class PriceFeedProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceFeedProcessor.name);

  constructor(private readonly priceFeedService: PriceFeedService) {
    super();
  }

  async process(job: Job<AnyPriceFeedWorkerData>): Promise<void> {
    const { data } = job;

    this.logger.log(`Processing price feed job: ${job.name} (ID: ${job.id})`);
    this.logger.debug(`Job data: ${JSON.stringify(data, null, 2)}`);

    try {
      await this.priceFeedService.processWork(data);

      this.logger.log(`Successfully completed job: ${job.name} (ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to process job: ${job.name} (ID: ${job.id})`, error);
      throw error;
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<AnyPriceFeedWorkerData>): Promise<void> {
    this.logger.log(`Job completed: ${job.name} (ID: ${job.id})`);
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job<AnyPriceFeedWorkerData>, error: Error): Promise<void> {
    this.logger.error(`Job failed: ${job.name} (ID: ${job.id})`, error);

    // Could implement additional failure handling here:
    // - Send alerts
    // - Update monitoring metrics
    // - Trigger fallback mechanisms
  }

  /**
   * Handle job stalling
   */
  async onStalled(job: Job<AnyPriceFeedWorkerData>): Promise<void> {
    this.logger.warn(`Job stalled: ${job.name} (ID: ${job.id})`);
  }

  /**
   * Handle job progress updates
   */
  async onProgress(job: Job<AnyPriceFeedWorkerData>, progress: number | object): Promise<void> {
    this.logger.debug(`Job progress: ${job.name} (ID: ${job.id}) - ${JSON.stringify(progress)}`);
  }
}
