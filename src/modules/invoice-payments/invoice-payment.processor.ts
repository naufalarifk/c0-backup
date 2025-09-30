import type { Job } from 'bullmq';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { InvoicePaymentService } from './invoice-payment.service';
import { InvoicePaymentJobData } from './invoice-payment.types';

@Injectable()
@Processor('invoicePaymentQueue')
export class InvoicePaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicePaymentProcessor.name);

  constructor(private readonly invoicePaymentService: InvoicePaymentService) {
    super();
  }

  async process(job: Job<InvoicePaymentJobData>): Promise<void> {
    const { invoiceId, transactionHash, amount, detectedAt } = job.data;

    this.logger.debug(
      `Processing invoice payment job ${job.id} for invoice ${invoiceId} (tx: ${transactionHash})`,
    );

    await this.invoicePaymentService.recordPayment({
      invoiceId,
      transactionHash,
      amount,
      paymentDate: new Date(detectedAt),
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InvoicePaymentJobData>) {
    this.logger.debug(`Invoice payment job ${job.id} completed for invoice ${job.data.invoiceId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InvoicePaymentJobData>, error: Error) {
    this.logger.error(
      `Invoice payment job ${job.id} failed for invoice ${job.data.invoiceId}: ${error.message}`,
    );
  }
}
