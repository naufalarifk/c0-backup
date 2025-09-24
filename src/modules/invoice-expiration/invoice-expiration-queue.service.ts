import type { Queue } from 'bullmq';
import type { InvoiceExpirationWorkerData } from './invoice-expiration.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface QueueInvoiceExpirationOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

@Injectable()
export class InvoiceExpirationQueueService {
  private readonly logger = new Logger(InvoiceExpirationQueueService.name);

  constructor(
    @InjectQueue('invoiceExpirationQueue')
    private readonly invoiceExpirationQueue: Queue<InvoiceExpirationWorkerData>,
  ) {}

  async queueInvoiceExpirationCheck(
    data: InvoiceExpirationWorkerData = { type: 'invoice-expiration-check' },
    options: QueueInvoiceExpirationOptions = {},
  ): Promise<void> {
    try {
      const job = await this.invoiceExpirationQueue.add(
        'invoice-expiration-check',
        {
          ...data,
          asOfDate: data.asOfDate || new Date().toISOString(),
        },
        {
          priority: options.priority ?? 5,
          delay: options.delay ?? 0,
          attempts: options.attempts ?? 3,
          backoff: options.backoff ?? {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      );

      this.logger.log(`Queued invoice expiration check with job ID: ${job.id}`);
    } catch (error) {
      this.logger.error('Failed to queue invoice expiration check:', error);
      throw error;
    }
  }

  /**
   * Scheduled cron job that runs every 5 minutes to check for expired invoices
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'invoice-expiration-check',
  })
  async handleScheduledInvoiceExpirationCheck(): Promise<void> {
    this.logger.debug('Starting scheduled invoice expiration check');

    try {
      await this.queueInvoiceExpirationCheck({
        type: 'invoice-expiration-check',
        asOfDate: new Date().toISOString(),
        batchSize: 100, // Process up to 100 invoices per batch
      });

      this.logger.log('Successfully queued scheduled invoice expiration check');
    } catch (error) {
      this.logger.error('Failed to queue scheduled invoice expiration check:', error);
      // Don't throw - we don't want to crash the scheduler
    }
  }

  async getQueueStatus() {
    const waiting = await this.invoiceExpirationQueue.getWaiting();
    const active = await this.invoiceExpirationQueue.getActive();
    const completed = await this.invoiceExpirationQueue.getCompleted();
    const failed = await this.invoiceExpirationQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}
