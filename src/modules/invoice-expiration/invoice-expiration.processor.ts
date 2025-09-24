import type { Job } from 'bullmq';
import type { InvoiceExpirationWorkerData } from './invoice-expiration.types';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { InvoiceExpirationService } from './invoice-expiration.service';

@Injectable()
@Processor('invoiceExpirationQueue')
export class InvoiceExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceExpirationProcessor.name);

  constructor(private readonly invoiceExpirationService: InvoiceExpirationService) {
    super();
  }

  async process(job: Job<InvoiceExpirationWorkerData>): Promise<void> {
    this.logger.log(`Processing invoice expiration job ${job.id} of type ${job.data.type}`);

    try {
      const result = await this.invoiceExpirationService.processExpiredInvoices(job.data);

      this.logger.log(
        `Invoice expiration job ${job.id} completed successfully. ` +
          `Processed: ${result.processedCount}, Expired: ${result.expiredCount}, Errors: ${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`Job ${job.id} had ${result.errors.length} errors:`, result.errors);
      }
    } catch (error) {
      this.logger.error(`Invoice expiration job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InvoiceExpirationWorkerData>) {
    this.logger.log(`Invoice expiration job ${job.id} has been completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InvoiceExpirationWorkerData>, err: Error) {
    this.logger.error(`Invoice expiration job ${job.id} has failed with error:`, err);
  }

  @OnWorkerEvent('active')
  onActive(job: Job<InvoiceExpirationWorkerData>) {
    this.logger.debug(`Invoice expiration job ${job.id} is now active`);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job<InvoiceExpirationWorkerData>) {
    this.logger.warn(`Invoice expiration job ${job.id} has stalled`);
  }
}
