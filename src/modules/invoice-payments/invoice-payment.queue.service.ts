import type { Queue } from 'bullmq';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { InvoicePaymentJobData } from './invoice-payment.types';

export interface EnqueueInvoicePaymentOptions {
  delay?: number;
  attempts?: number;
  priority?: number;
}

@Injectable()
export class InvoicePaymentQueueService {
  private readonly logger = new Logger(InvoicePaymentQueueService.name);

  constructor(
    @InjectQueue('invoicePaymentQueue')
    private readonly invoicePaymentQueue: Queue<InvoicePaymentJobData>,
  ) {}

  async enqueuePaymentDetection(
    data: InvoicePaymentJobData,
    options: EnqueueInvoicePaymentOptions = {},
  ): Promise<void> {
    const job = await this.invoicePaymentQueue.add('invoice-payment-detected', data, {
      removeOnComplete: 50,
      removeOnFail: 10,
      attempts: options.attempts ?? 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: options.delay ?? 0,
      priority: options.priority ?? 5,
    });

    this.logger.debug(
      `Queued invoice payment detection job ${job.id} from address ${data.walletAddress} with txid ${data.transactionHash}`,
    );
  }
}
