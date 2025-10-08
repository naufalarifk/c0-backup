import type { Job } from 'bullmq';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { WalletBalanceCollectorQueueService } from '../wallet-balance-collector/wallet-balance-collector.queue.service';
import { InvoicePaymentService } from './invoice-payment.service';
import { InvoicePaymentJobData } from './invoice-payment.types';

@Injectable()
@Processor('invoicePaymentQueue')
export class InvoicePaymentProcessor extends WorkerHost {
  private readonly logger = new TelemetryLogger(InvoicePaymentProcessor.name);

  constructor(
    private readonly invoicePaymentService: InvoicePaymentService,
    private readonly walletBalanceCollectorQueue: WalletBalanceCollectorQueueService,
  ) {
    super();
  }

  async process(job: Job<InvoicePaymentJobData>): Promise<void> {
    const {
      invoiceId,
      blockchainKey,
      walletAddress,
      walletDerivationPath,
      transactionHash,
      amount,
      detectedAt,
    } = job.data;

    this.logger.debug(
      `Processing invoice payment job ${job.id} for invoice of wallet ${walletAddress} on blockchain ${blockchainKey}`,
    );

    await this.invoicePaymentService.recordPayment({
      walletAddress,
      transactionHash,
      amount,
      paymentDate: new Date(detectedAt),
    });

    // After recording payment, trigger balance collection
    this.logger.debug(
      `Triggering balance collection for invoice if wallet ${walletAddress} on blockchain ${blockchainKey}`,
    );

    await this.walletBalanceCollectorQueue.enqueueBalanceCollection({
      blockchainKey,
      walletAddress,
      walletDerivationPath,
      transactionHash,
      paidAmount: amount,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InvoicePaymentJobData>) {
    this.logger.debug(
      `Invoice payment job ${job.id} completed for invoice of wallet ${job.data.walletAddress}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InvoicePaymentJobData>, error: Error) {
    this.logger.error(
      `Invoice payment job ${job.id} failed for invoice of wallet ${job.data.walletAddress}: ${error.message}`,
    );
  }
}
